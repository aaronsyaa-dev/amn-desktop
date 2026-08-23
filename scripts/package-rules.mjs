/**
 * L'APPLICATION EMPAQUETÉE EST-ELLE COMPLÈTE ? (contrôle d'avant-publication)
 * ══════════════════════════════════════════════════════════════════════════
 *
 * ## Le défaut que ce contrôle existe pour attraper
 *
 * Une version livrée s'installait sans la moindre erreur — journaux Squirrel
 * propres, fichiers écrits, raccourci créé — puis refusait de démarrer :
 *
 *     ERROR:base\i18n\icu_util.cc:232]
 *     Invalid file descriptor to ICU data received.
 *
 * Windows, lui, affichait « Cette application ne peut pas s'exécuter sur votre
 * PC », ce qui envoie chercher un problème d'architecture ou de compatibilité
 * là où il n'y en a aucun. La vraie cause est plus bête : un fichier du moteur
 * Electron manquant à côté de l'exécutable — `icudtl.dat`, les données Unicode
 * sans lesquelles Chromium ne peut pas s'initialiser du tout.
 *
 * Ces fichiers ne viennent PAS du code de l'application : ils sont recopiés
 * tels quels depuis `node_modules/electron/dist` au moment de l'empaquetage.
 * Un `dist` incomplet — téléchargement interrompu, extraction partielle,
 * antivirus qui met `icudtl.dat` en quarantaine (c'est un faux positif
 * classique), disque plein — produit donc un installeur parfaitement valide
 * qui contient une application morte.
 *
 * Rien dans `npm run typecheck`, `lint` ou les contrôles de bundle ne peut voir
 * ça : ils lisent du code, et le code est irréprochable. Seul un contrôle qui
 * regarde l'ARTEFACT peut le voir, et il doit tourner avant de publier plutôt
 * qu'après l'installation chez une cliente.
 *
 * ## Comment il décide
 *
 * La référence, quand elle est disponible, est `node_modules/electron/dist` :
 * exactement les fichiers que l'empaqueteur recopie. Tout fichier présent là et
 * absent — ou de taille différente — dans le paquet est un défaut. C'est
 * volontairement une comparaison et non une liste écrite à la main : une liste
 * se périme à chaque montée d'Electron, et c'est précisément le jour où elle se
 * périme qu'elle laisserait passer un manque.
 *
 * La liste écrite à la main ne sert que de repli, pour auditer un paquet
 * construit ailleurs (une machine Windows, typiquement) depuis un poste qui n'a
 * pas le `dist` correspondant.
 *
 *   npm run check:package                 # détecte le dossier sous out/
 *   npm run check:package -- --dir "out/AMN Desktop-win32-x64"
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Repli quand le `dist` de référence n'est pas disponible.
 *
 * `icudtl.dat` est en tête parce que c'est celui qui a réellement cassé une
 * livraison ; les autres tuent le démarrage tout aussi sûrement.
 */
const CRITIQUES = {
  win32: [
    'icudtl.dat',
    'v8_context_snapshot.bin',
    'resources.pak',
    'chrome_100_percent.pak',
    'chrome_200_percent.pak',
    'ffmpeg.dll',
    'libEGL.dll',
    'libGLESv2.dll',
    'd3dcompiler_47.dll',
    'vk_swiftshader.dll',
  ],
  linux: [
    'icudtl.dat',
    'v8_context_snapshot.bin',
    'resources.pak',
    'chrome_100_percent.pak',
    'chrome_200_percent.pak',
    'libffmpeg.so',
  ],
};

/** En deçà, le fichier est là mais tronqué — un antivirus laisse parfois une coquille. */
const TAILLE_MINIMALE = { 'icudtl.dat': 1_000_000, 'resources.pak': 100_000 };

/*
  Ce que l'empaqueteur ne recopie PAS à l'identique, et qu'on ne compare donc
  pas : `resources/` (app.asar remplace default_app.asar) et le binaire
  Electron lui-même, renommé au nom du produit.
*/
const NON_COMPARABLES = new Set([
  'resources',
  'electron',
  'electron.exe',
  'version',
  'LICENSE',
  'LICENSES.chromium.html',
]);

const DIST = 'node_modules/electron/dist';

function tailleDe(p) {
  try {
    const s = fs.statSync(p);
    return s.isDirectory() ? -1 : s.size;
  } catch {
    return null;
  }
}

/**
 * Audite UN dossier d'application empaquetée.
 *
 * Rend `{ plateforme, executable, reference, problemes }`. Ne journalise rien
 * et ne quitte jamais le processus : l'appelant décide quoi en faire — le
 * script en ligne de commande affiche, le hook d'empaquetage fait échouer la
 * construction.
 */
export function auditPackage(dossier) {
  const problemes = [];
  if (!dossier || !fs.existsSync(dossier)) {
    return { plateforme: null, executable: null, reference: null, problemes: [`${dossier} : dossier introuvable`] };
  }

  const fichiers = fs.readdirSync(dossier);
  const plateforme = fichiers.some((f) => f.endsWith('.exe'))
    ? 'win32'
    : fichiers.some((f) => f.endsWith('.app'))
      ? 'darwin'
      : 'linux';

  if (plateforme === 'darwin') {
    // macOS range tout dans Contents/Frameworks : une autre disposition, et
    // nous ne livrons pas macOS. Mieux vaut le dire que rendre un vert qui ne
    // vérifierait rien.
    return { plateforme, executable: null, reference: null, problemes: [], nonCouvert: true };
  }

  // Comparer un paquet Windows à un `dist` Linux n'aurait aucun sens.
  const distPlateforme = fs.existsSync(path.join(DIST, 'electron.exe')) ? 'win32' : 'linux';
  const distUtilisable = fs.existsSync(DIST) && distPlateforme === plateforme;
  let reference = null;

  /*
    LA LISTE CRITIQUE EST VÉRIFIÉE DANS TOUS LES CAS, et c'est le fruit d'une
    erreur de conception attrapée à l'essai.

    Première version : le `dist` d'Electron servait de SEULE référence, et la
    liste écrite à la main n'était qu'un repli. Éprouvé en retirant `icudtl.dat`
    du `dist` — le contrôle est resté vert. Évidemment : un fichier absent de la
    référence n'est jamais comparé. Le contrôle aurait donc été le plus aveugle
    exactement dans le cas qu'il existe pour attraper, puisque c'est bien un
    `dist` amputé qui produit un paquet amputé.

    (L'essai a appris autre chose au passage : l'empaqueteur ne recopie pas
    depuis `node_modules/electron/dist` mais depuis le cache de téléchargement
    d'Electron. Retirer le fichier du `dist` ne suffit donc pas à casser un
    paquet — raison de plus pour ne pas faire de ce dossier l'unique juge.)

    Le `dist`, quand il correspond, ajoute une vérification de TAILLE que la
    liste seule ne peut pas faire.
  */
  for (const entree of CRITIQUES[plateforme]) {
    if (tailleDe(path.join(dossier, entree)) === null) {
      problemes.push(`${entree} — MANQUANT (fichier essentiel du moteur Electron)`);
    }
  }

  if (distUtilisable) {
    try {
      reference = fs.readFileSync(path.join(DIST, 'version'), 'utf-8').trim();
    } catch {
      reference = 'version inconnue';
    }
    for (const entree of fs.readdirSync(DIST)) {
      if (NON_COMPARABLES.has(entree)) continue;
      const attendu = tailleDe(path.join(DIST, entree));
      const obtenu = tailleDe(path.join(dossier, entree));
      if (obtenu === null) {
        // Déjà signalé par la liste critique le cas échéant : on ne le répète pas.
        if (!CRITIQUES[plateforme].includes(entree)) {
          problemes.push(`${entree} — MANQUANT dans le paquet (présent dans le dist Electron)`);
        }
      } else if (attendu >= 0 && obtenu !== attendu) {
        problemes.push(`${entree} — taille ${obtenu} au lieu de ${attendu} (fichier tronqué ou remplacé)`);
      }
    }
  }

  // Vérifié dans les deux modes : une comparaison de tailles ne dit rien si le
  // dist de référence est lui-même tronqué.
  for (const [nom, minimum] of Object.entries(TAILLE_MINIMALE)) {
    const taille = tailleDe(path.join(dossier, nom));
    if (taille !== null && taille >= 0 && taille < minimum) {
      problemes.push(`${nom} — ${taille} octets, sous le minimum de ${minimum} : fichier tronqué`);
    }
  }

  const asar = path.join(dossier, 'resources', 'app.asar');
  if (!fs.existsSync(asar)) {
    problemes.push('resources/app.asar — MANQUANT : le paquet ne contient pas l’application');
  } else if (fs.statSync(asar).size < 10_000) {
    problemes.push('resources/app.asar — anormalement petit');
  }

  const locales = path.join(dossier, 'locales');
  if (!fs.existsSync(locales) || fs.readdirSync(locales).length === 0) {
    problemes.push('locales/ — absent ou vide');
  }

  const executable = fichiers.find((f) =>
    plateforme === 'win32' ? f.endsWith('.exe') : /^amn-(desktop|business)$/.test(f),
  );
  if (!executable) problemes.push('exécutable — introuvable dans le paquet');

  return { plateforme, executable, reference, problemes };
}

/** Le conseil à donner quand un fichier du moteur manque. Partagé avec le hook. */
export const REMEDE =
  'Reconstruisez le moteur Electron avant tout :\n' +
  '  rm -rf node_modules/electron/dist   (Windows : rmdir /s /q node_modules\\electron\\dist)\n' +
  '  node node_modules/electron/install.js\n' +
  'puis relancez la construction. Si le fichier redisparaît, vérifiez la quarantaine\n' +
  'de l’antivirus : `icudtl.dat` en est une cible connue.';
