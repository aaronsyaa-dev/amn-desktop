import { app, BrowserWindow, ipcMain, shell } from 'electron';
import type { AppUpdater } from 'electron-updater';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { IPC } from '../shared/api';
import type { UpdateCheck } from '../shared/api';
import { IS_BUSINESS } from '../edition/edition';
import { remoteConfig } from './remoteConfig';

/**
 * LES MISES À JOUR, ET POURQUOI IL Y EN A DEUX CANAUX (BLOC O)
 * ═══════════════════════════════════════════════════════════
 *
 * ## L'édition interne
 *
 * Elle passe par `electron-updater`, qui lit `latest.yml` dans les Releases
 * GitHub du dépôt (publié par electron-builder), télécharge l'installeur NSIS
 * en différentiel et le met de côté tout seul, en arrière-plan. Quand une
 * version est prête, on prévient le renderer, qui montre un panneau soigné
 * avec un seul bouton (voir UpdateReady.tsx).
 *
 * (Historique : ce canal passait par Squirrel.Windows via update-electron-app.
 * Quatre versions installées d'affilée ne démarraient plus alors que leurs
 * artefacts, autopsiés octet par octet, étaient sains — la mécanique
 * d'installation Squirrel elle-même était le maillon défaillant. Migration
 * complète : electron-builder.config.mjs.)
 *
 * ## L'édition Business, et le défaut que ce fichier corrige
 *
 * Elle n'avait aucun canal. Chaque correctif devait être réinstallé à la main
 * chez chaque cliente : tenable à une, intenable à cinq, et dangereux — une
 * cliente peut rester des semaines sur une version dont le défaut de sécurité
 * est corrigé depuis longtemps, sans que personne ne s'en aperçoive.
 *
 * Elle ne peut PAS emprunter le canal interne, et ce n'est pas une question de
 * réglage : les Releases de `aaronsyaa-dev/amn-desktop` portent les artefacts
 * de l'édition INTERNE. Y brancher une cliente lui installerait notre
 * application — Tour de contrôle, produits de cybersécurité, tout. Le canal
 * Business est donc ailleurs : amn-api, qui tient déjà le registre
 * `business_releases` et sert déjà l'installeur aux nouvelles clientes.
 *
 * Les deux chaînes ne se croisent nulle part :
 *
 *     publication   interne : CI, sur un tag `v*`   Business : Aaron, à la main
 *     dépôt         interne : Releases GitHub     Business : registre amn-api
 *     mécanique     interne : Squirrel            Business : ce fichier
 *     déclencheur   interne : automatique         Business : décidé par Aaron
 *
 * `scripts/check-update-channel.mjs` refuse tout code qui rapprocherait ces
 * deux colonnes, et `scripts/publish-release.mjs` relit l'artefact avant de
 * l'enregistrer : un installeur interne ne peut pas entrer dans le canal
 * client par distraction.
 *
 * ## Ce que « mise à jour automatique » veut dire ici, exactement
 *
 * Vérification en arrière-plan, téléchargement en arrière-plan, vérification
 * d'empreinte, puis UN geste : « Redémarrer et installer ». Le redémarrage
 * n'est pas une facilité qu'on s'accorde — un exécutable en cours d'exécution
 * ne peut pas se remplacer lui-même sous Windows. C'est écrit noir sur blanc
 * dans docs/BUSINESS.md plutôt que promis autrement.
 */

/** Toutes les six heures : assez pour un correctif du jour, assez peu pour ne rien coûter. */
const BUSINESS_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Au démarrage, on laisse l'application s'ouvrir avant d'aller sur le réseau. */
const BUSINESS_FIRST_DELAY_MS = 45 * 1000;

/**
 * Le canal de l'édition Business.
 *
 * Déduit de l'adresse d'amn-api, déjà connue du processus principal : une
 * installation cliente n'a qu'elle, et elle l'a forcément — sans elle
 * l'application ne saurait même pas connecter sa propriétaire.
 * `AMN_BUSINESS_UPDATE_URL` reste possible pour pointer ailleurs (un essai, un
 * miroir) sans reconstruire la logique.
 */
function businessFeed(): string {
  const explicite = (process.env.AMN_BUSINESS_UPDATE_URL || '').replace(/\/$/, '');
  if (explicite) return explicite;
  return remoteConfig.apiUrl ? `${remoteConfig.apiUrl}/v1/updates/business` : '';
}

/**
 * Compare deux versions `x.y.z`. > 0 si `a` est postérieure à `b`.
 *
 * Numérique segment par segment, jamais lexicographique : en chaînes, « 1.2.9 »
 * l'emporte sur « 1.2.10 » et une cliente reste bloquée en croyant être à jour.
 * La même fonction existe côté amn-api ; les deux comparent, et c'est
 * volontaire — le poste ne doit pas installer une version antérieure à la
 * sienne même si le serveur la lui propose.
 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    String(v ?? '')
      .replace(/^v/, '')
      .split('.')
      .map((n) => Number.parseInt(n, 10) || 0);
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** La version mise de côté, prête à s'installer. */
let staged: { version: string; notes: string; file: string } | null = null;
/**
 * L'updater interne (electron-updater), branché par `setupAutoUpdate`.
 * Chargé paresseusement : le dev et l'édition Business ne le touchent jamais.
 */
let interne: AppUpdater | null = null;
/** Un téléchargement est en cours — on n'en lance pas un second. */
let fetching = '';

/** Où les installeurs téléchargés attendent. */
function stagingDir(): string {
  return path.join(app.getPath('userData'), 'mises-a-jour');
}

/** Un nom de fichier sûr : ce qui vient du serveur ne compose pas un chemin. */
function safeName(filename: string, version: string): string {
  const base = path.basename(String(filename || '')).replace(/[^A-Za-z0-9._ -]/g, '');
  return base || `amn-business-${version}.exe`;
}

function sha256File(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function annonceAuRenderer(version: string, notes: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.updateDownloaded, { version, notes });
  }
}

interface FluxBusiness {
  status?: string;
  version?: string;
  notes?: string;
  filename?: string;
  byteSize?: number;
  sha256?: string;
  url?: string;
  reason?: string;
}

/**
 * Télécharge, vérifie, met de côté — puis prévient l'écran.
 *
 * L'empreinte n'est pas une formalité : un téléchargement interrompu produit
 * un `.exe` tronqué, que Windows accepte de lancer et qui casse l'installation
 * d'une cliente. Un fichier dont l'empreinte ne correspond pas est effacé, pas
 * gardé « au cas où ».
 */
async function telechargerBusiness(flux: FluxBusiness): Promise<void> {
  const version = String(flux.version ?? '');
  const url = String(flux.url ?? '');
  const attendu = String(flux.sha256 ?? '').toLowerCase();
  if (!version || !url || !/^[0-9a-f]{64}$/.test(attendu)) return;
  if (fetching === version) return;
  fetching = version;

  const dossier = stagingDir();
  const cible = path.join(dossier, safeName(String(flux.filename ?? ''), version));

  try {
    fs.mkdirSync(dossier, { recursive: true });

    // Déjà là et intact : on ne retélécharge pas cent mégaoctets parce que
    // l'application a redémarré.
    if (fs.existsSync(cible) && sha256File(cible) === attendu) {
      staged = { version, notes: String(flux.notes ?? ''), file: cible };
      annonceAuRenderer(version, staged.notes);
      return;
    }

    const partiel = `${cible}.partiel`;
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`réponse ${res.status}`);
    await pipeline(Readable.fromWeb(res.body as never), fs.createWriteStream(partiel));

    const obtenu = sha256File(partiel);
    if (obtenu !== attendu) {
      fs.rmSync(partiel, { force: true });
      throw new Error(`empreinte inattendue (${obtenu.slice(0, 12)}… au lieu de ${attendu.slice(0, 12)}…)`);
    }

    fs.renameSync(partiel, cible);
    // Le droit d'exécution, posé APRÈS la vérification d'empreinte et jamais
    // avant : ce qu'on rend exécutable est ce qu'on a contrôlé. Sans lui, un
    // fichier téléchargé arrive en 0644 et ne peut pas être lancé — sous
    // Windows le bit n'existe pas et l'appel ne coûte rien, ailleurs il est la
    // différence entre une mise à jour qui s'applique et une qui reste là.
    try {
      fs.chmodSync(cible, 0o755);
    } catch {
      /* système de fichiers sans permissions — sans effet, pas une panne */
    }
    staged = { version, notes: String(flux.notes ?? ''), file: cible };

    // Le dossier ne garde que la version prête : les précédentes ne servent
    // plus à rien et pèsent une centaine de mégaoctets chacune.
    for (const entree of fs.readdirSync(dossier)) {
      const chemin = path.join(dossier, entree);
      if (chemin !== cible) fs.rmSync(chemin, { force: true });
    }

    // eslint-disable-next-line no-console
    console.log(`[amn] mise à jour Business ${version} téléchargée et vérifiée — prête à installer.`);
    annonceAuRenderer(version, staged.notes);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[amn] mise à jour Business — téléchargement abandonné :', err);
  } finally {
    fetching = '';
  }
}

/**
 * Vérifie à la demande, et rend un état NOMMÉ.
 *
 * Six situations qui ne se ressemblent que dans le code. Répondre « à jour »
 * quand on n'a pas pu regarder, ou quand rien n'est publié, serait le défaut à
 * ne pas commettre : quelqu'un qui n'est pas à jour lirait qu'il l'est.
 */
async function checkNow(): Promise<UpdateCheck> {
  if (!app.isPackaged) {
    return {
      status: 'unconfigured',
      reason: 'Application lancée depuis le code source : aucune mise à jour à vérifier.',
    };
  }

  if (IS_BUSINESS) return checkBusiness();

  // Édition interne : electron-updater interroge le flux des Releases GitHub.
  if (staged) return { status: 'ready', version: staged.version };
  if (!interne) {
    return {
      status: 'error',
      message: 'Le canal de mise à jour n’a pas pu être initialisé au démarrage.',
    };
  }
  try {
    const resultat = await interne.checkForUpdates();
    const distante = resultat?.updateInfo?.version ?? '';
    if (distante && compareVersions(distante, app.getVersion()) > 0) {
      // Le téléchargement part tout seul (autoDownload) ; le panneau « prête à
      // installer » apparaîtra quand `update-downloaded` tombera.
      return { status: 'downloading', version: distante };
    }
    return { status: 'uptodate', version: app.getVersion() };
  } catch (err) {
    return {
      status: 'error',
      message: `Vérification impossible : ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function checkBusiness(): Promise<UpdateCheck> {
  if (staged) return { status: 'ready', version: staged.version };
  if (fetching) return { status: 'downloading', version: fetching };

  const feed = businessFeed();
  if (!feed) {
    return {
      status: 'unconfigured',
      reason:
        'Cette installation ne connaît pas l’adresse d’AMN DevSec : les mises à jour ' +
        'automatiques sont indisponibles. Contactez AMN DevSec.',
    };
  }

  try {
    const url = `${feed}?platform=${encodeURIComponent(process.platform)}&version=${encodeURIComponent(app.getVersion())}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`réponse ${res.status}`);
    const flux = (await res.json()) as FluxBusiness;

    if (flux.status === 'uptodate') {
      return { status: 'uptodate', version: app.getVersion() };
    }
    if (flux.status === 'available') {
      const version = String(flux.version ?? '');
      // Garde-fou côté poste, en plus de celui du serveur : on n'installe
      // jamais une version antérieure à celle qui tourne, quoi qu'on nous
      // propose.
      if (!version || compareVersions(version, app.getVersion()) <= 0) {
        return { status: 'uptodate', version: app.getVersion() };
      }
      void telechargerBusiness(flux);
      return { status: 'downloading', version };
    }
    // `none` — rien n'est publié. Ce n'est pas « à jour » : c'est « il n'y a
    // rien à quoi se comparer ».
    return {
      status: 'unconfigured',
      reason:
        flux.reason ??
        'Aucune version n’est publiée sur le canal de mise à jour pour le moment.',
    };
  } catch (err) {
    return {
      status: 'error',
      message: `Vérification impossible : ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Applique la version mise de côté : on lance l'installeur, puis on s'efface.
 *
 * L'ordre compte. L'installeur Squirrel remplace des fichiers que l'exécutable
 * en cours tient ouverts ; il commence donc par attendre la fin du processus.
 * Le lancer APRÈS avoir quitté serait impossible — plus personne pour le
 * lancer — et quitter sans l'avoir lancé laisserait la cliente devant une
 * application fermée qui n'a rien mis à jour.
 */
async function appliquerBusiness(): Promise<void> {
  if (!staged) return;
  const fichier = staged.file;

  const lance = await new Promise<boolean>((resolve) => {
    try {
      const enfant = spawn(fichier, [], { detached: true, stdio: 'ignore' });
      enfant.once('error', () => resolve(false));
      enfant.once('spawn', () => {
        enfant.unref();
        resolve(true);
      });
    } catch {
      resolve(false);
    }
  });

  if (!lance) {
    // Repli : laisser le système choisir comment ouvrir le fichier. Sur
    // Windows c'est équivalent ; ailleurs, ça échoue proprement plutôt que de
    // quitter l'application pour rien.
    const probleme = await shell.openPath(fichier);
    if (probleme) {
      // eslint-disable-next-line no-console
      console.warn('[amn] installeur impossible à lancer :', probleme);
      return;
    }
  }

  app.quit();
}

export function setupAutoUpdate(): void {
  ipcMain.handle(IPC.updateCheck, () => checkNow());

  // Le bouton « Redémarrer et installer » du renderer arrive ici. Enregistré
  // même en développement pour que le canal IPC existe toujours (il ne fait
  // simplement rien quand rien n'est mis de côté).
  ipcMain.handle(IPC.updateInstall, async () => {
    if (IS_BUSINESS) {
      await appliquerBusiness();
      return;
    }
    try {
      interne?.quitAndInstall();
    } catch {
      /* rien de mis de côté / non supporté — on ignore */
    }
  });

  if (!app.isPackaged) return;

  if (IS_BUSINESS) {
    // Rondes de fond. Le premier passage est retardé : au démarrage, la cliente
    // attend son application, pas un téléchargement.
    const ronde = () => {
      void checkBusiness();
    };
    setTimeout(ronde, BUSINESS_FIRST_DELAY_MS).unref?.();
    setInterval(ronde, BUSINESS_INTERVAL_MS).unref?.();
    return;
  }

  try {
    // Requis paresseusement : le dev, les tests et la CI Linux ne chargent
    // jamais le code de mise à jour.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { autoUpdater: updater } = require('electron-updater') as typeof import('electron-updater');
    interne = updater;

    // Le flux (dépôt GitHub, canal) vient d'app-update.yml, écrit dans les
    // ressources par electron-builder à l'empaquetage : l'application n'a pas
    // à connaître l'adresse, et ne peut donc pas se tromper de dépôt.
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;

    updater.on('update-downloaded', (info) => {
      const version = info.version || 'nouvelle version';
      const notes = typeof info.releaseNotes === 'string' ? info.releaseNotes : '';
      staged = { version, notes, file: '' };
      annonceAuRenderer(version, notes);
    });
    updater.on('error', (err) => {
      // Non fatal — l'application vit très bien sans mise à jour ; le bouton
      // « Vérifier maintenant » remontera l'erreur en clair s'il est utilisé.
      // eslint-disable-next-line no-console
      console.warn('[amn] mise à jour interne — erreur :', err?.message ?? err);
    });

    // Une ronde à l'heure, comme avant, plus un premier passage différé : au
    // démarrage, l'opérateur attend sa fenêtre, pas un téléchargement.
    const ronde = () => {
      void interne?.checkForUpdates().catch(() => undefined);
    };
    setTimeout(ronde, 30_000).unref?.();
    setInterval(ronde, 60 * 60 * 1000).unref?.();
  } catch (err) {
    // Non-fatal: the app runs fine without auto-update.
    // eslint-disable-next-line no-console
    console.warn('[amn] auto-update unavailable:', err);
  }
}
