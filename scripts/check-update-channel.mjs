#!/usr/bin/env node
/**
 * LES DEUX CANAUX DE MISE À JOUR NE SE CROISENT NULLE PART (BLOC O)
 * ════════════════════════════════════════════════════════════════
 *
 * Depuis que les clientes se mettent à jour toutes seules, une confusion entre
 * les deux chaînes de publication n'est plus une erreur de rangement : c'est
 * l'installation d'AMN Desktop — Tour de contrôle, produits de cybersécurité,
 * jeton opérateur — chez quelqu'un qui a acheté un outil de gestion.
 *
 * Six règles, qui tiennent chacune un point où les deux chaînes pourraient se
 * toucher. Elles sont statiques : elles lisent le code, pas le comportement.
 * C'est leur limite et leur intérêt — elles échouent AVANT qu'on construise
 * quoi que ce soit, sur la machine de qui écrit la ligne fautive.
 *
 * Ce que ce contrôle NE remplace PAS : `scripts/publish-release.mjs`, qui relit
 * l'artefact empaqueté avant de l'enregistrer. Celui-là juge des octets ; ce
 * script-ci juge des intentions écrites dans le code.
 *
 *   node scripts/check-update-channel.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

/** Le code, commentaires retirés : une règle ne doit pas être satisfaite par une phrase. */
function code(rel) {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/* 1. Le bloc `publish` est débranché dans l'édition Business. ----------------
   electron-builder écrit `app-update.yml` (le flux qu'electron-updater lira)
   à partir de ce bloc. S'il existait dans un build Business, l'application
   d'une cliente saurait interroger les Releases du dépôt interne — et
   s'installerait notre édition à la première version publiée. */
{
  const builder = code('electron-builder.config.mjs');
  if (!/publish:\s*IS_BUSINESS\s*\n?\s*\?\s*null/.test(builder)) {
    failures.push(
      'electron-builder.config.mjs : `publish` doit valoir null dans l’édition Business ' +
        '(`publish: IS_BUSINESS ? null : [...]`). Un tableau vide ne suffit PAS — mesuré : ' +
        'electron-builder déduit alors le dépôt du remote git et écrit app-update.yml.',
    );
  }
  // La valeur de config ne prouve rien : le hook afterPack doit refuser
  // l'artefact lui-même si le flux y apparaît.
  const hook = code('scripts/eb-after-pack.mjs');
  if (!/app-update\.yml/.test(hook) || !/throw new Error/.test(hook)) {
    failures.push(
      'scripts/eb-after-pack.mjs doit REFUSER un build Business contenant app-update.yml — ' +
        'c’est le contrôle sur l’artefact, pas sur la config.',
    );
  }
}

/* 2. Le canal interne est inatteignable depuis un build Business. ------------
   `electron-updater` lit les Releases de aaronsyaa-dev/amn-desktop, qui
   portent les artefacts INTERNES. La sortie anticipée doit venir avant. */
{
  const updater = code('src/main/updater.ts');
  /*
    L'ancre est `if (!app.isPackaged) return;`, et il a fallu deux essais pour
    y arriver. Chercher un `if (IS_BUSINESS)` « quelque part avant le
    branchement du canal » ne prouvait rien : `setupAutoUpdate` en contient un
    autre, dans le gestionnaire IPC d'installation, qui satisfaisait la règle
    à lui seul. La garde pouvait donc disparaître de l'endroit qui compte sans
    que rien ne bronche — mesuré en la retirant, pas supposé.

    Entre le retour « pas empaqueté » et l'appel au service public, il n'y a
    plus qu'une chose : la sortie Business. C'est celle-là qu'on exige.
  */
  const debut = updater.indexOf('if (!app.isPackaged) return;');
  const service = updater.indexOf("require('electron-updater')");
  const amont = debut === -1 || service === -1 || debut > service ? '' : updater.slice(debut, service);
  if (!amont) {
    failures.push(
      'src/main/updater.ts : impossible de lire `setupAutoUpdate` avant le chargement ' +
        "d'electron-updater — le contrôle ne peut rien affirmer.",
    );
  } else if (!/if\s*\(IS_BUSINESS\)\s*\{[\s\S]*?\breturn;/.test(amont)) {
    failures.push(
      'src/main/updater.ts : `setupAutoUpdate` doit sortir sur `if (IS_BUSINESS) { … return; }` ' +
        "AVANT le chargement d'electron-updater. Un build Business branché sur le flux " +
        'GitHub installerait l’édition interne chez une cliente.',
    );
  }
}

/* 3. Le flux Business ne pointe jamais GitHub. -------------------------------
   Il se déduit de l'adresse d'amn-api. Une URL github.com ici voudrait dire
   qu'on est retombé sur les Releases du dépôt. */
{
  const updater = code('src/main/updater.ts');
  const feed = updater.slice(updater.indexOf('function businessFeed'), updater.indexOf('export function compareVersions'));
  if (/github/i.test(feed)) {
    failures.push(
      'src/main/updater.ts : `businessFeed()` mentionne GitHub. Le canal des clientes ' +
        'est amn-api, jamais les Releases du dépôt interne.',
    );
  }
  if (!/v1\/updates\/business/.test(feed)) {
    failures.push(
      'src/main/updater.ts : `businessFeed()` doit viser `/v1/updates/business` sur amn-api.',
    );
  }
}

/* 4. La CI ne construit et ne publie QUE l'édition interne. ------------------
   Le jour où le workflow apprendrait `make:business`, la publication des
   clientes cesserait d'être un geste décidé par Aaron. */
{
  const workflow = read('.github/workflows/release.yml');
  for (const interdit of ['AMN_EDITION: business', 'AMN_EDITION=business', 'make:business', 'publish:release', 'build:web:business']) {
    if (workflow.includes(interdit)) {
      failures.push(
        `.github/workflows/release.yml contient « ${interdit} » : la publication Business ` +
          'doit rester un geste manuel d’Aaron, décidé version par version.',
      );
    }
  }
}

/* 5. Le jeton opérateur n'entre pas dans un build Business. ------------------
   La machine d'Aaron a forcément ce jeton dans son `.env` — c'est la même qui
   construit l'édition interne. Le build doit refuser de le prendre. */
{
  const vite = code('vite.main.config.ts');
  if (!/edition\s*!==\s*'business'/.test(vite)) {
    failures.push(
      'vite.main.config.ts : le jeton opérateur doit être exclu des builds Business ' +
        '(`edition !== \'business\'`). Sans ça l’application d’une cliente se ' +
        'synchronise sur l’espace d’AMN DevSec avant même qu’elle se connecte.',
    );
  }
  if (!/__AMN_TOKEN_BAKED__/.test(vite)) {
    failures.push(
      'vite.main.config.ts : le build doit inscrire `__AMN_TOKEN_BAKED__` dans le bundle — ' +
        'c’est ce marqueur que la publication relit dans l’artefact.',
    );
  }
}

/* 6. La publication relit l'artefact avant de l'enregistrer. ----------------- */
{
  const publish = code('scripts/publish-release.mjs');
  if (!/ARTIFACT_FORBIDDEN/.test(publish) || !/ARTIFACT_REQUIRED/.test(publish)) {
    failures.push(
      'scripts/publish-release.mjs doit relire l’artefact empaqueté avec ' +
        'ARTIFACT_FORBIDDEN / ARTIFACT_REQUIRED avant d’enregistrer une version. ' +
        'Le nom d’un fichier n’a jamais prouvé son contenu.',
    );
  }
  if (!/process\.exit\(1\)/.test(publish)) {
    failures.push(
      'scripts/publish-release.mjs doit SORTIR EN ERREUR quand l’artefact est refusé, ' +
        'pas seulement l’écrire.',
    );
  }
}

/* ─── 7. La mise à jour cliente s'applique EN SILENCE (BLOC 3) ─────────── */

/*
  Le canal client fait tout seul le trajet complet : il interroge le flux,
  télécharge, vérifie l'empreinte SHA-256, met de côté, lance l'installeur et
  quitte. Un seul maillon manquait, et il ne se voyait qu'à la toute fin :
  l'installeur était lancé SANS argument.

  Avec un NSIS `oneClick`, ça n'ouvre pas d'assistant — mais ça affiche une
  bannière de progression, sur la machine de quelqu'un qui ne s'attendait à
  rien. La mise à jour était automatique de bout en bout SAUF ce dernier écran.

  `/S` est le mode silencieux de NSIS, et il n'a de sens que sous Windows.
*/
{
  const updater = read('src/main/updater.ts');
  if (!/process\.platform === 'win32' \? \['\/S'\]/.test(updater)) {
    failures.push(
      "src/main/updater.ts ne lance plus l'installeur client avec `/S` sous Windows : " +
        "la mise à jour d'une cliente afficherait une bannière d'installation sur une " +
        "machine dont personne ne s'occupe.",
    );
  }
  if (/installeur Squirrel/.test(updater)) {
    failures.push(
      "src/main/updater.ts parle encore de « l'installeur Squirrel », abandonné depuis la " +
        "migration vers NSIS. Un commentaire faux sur le chemin de mise à jour coûte plus " +
        "cher qu'un commentaire absent.",
    );
  }
}

/* ─── 8. La mise à jour de la PWA se VOIT (BLOC 4) ──────────────────────── */

/*
  Le poste de bureau avait `UpdateReady`. La PWA n'avait rien : le service
  worker appelait `skipWaiting()` dès l'installation, prenait la main
  immédiatement, et la page continuait de faire tourner l'ANCIEN JavaScript
  sans jamais être rechargée ni le dire.

  Ce que ça donnait sur un téléphone : une PWA laissée ouverte gardait
  l'ancienne version des jours durant. Aucun message, et le seul remède —
  fermer complètement l'application — n'est ni évident ni fait par personne.

  Trois choses tiennent ce correctif, et chacune casse le motif si elle
  disparaît :

    · le worker n'appelle plus `skipWaiting()` à l'INSTALLATION ;
    · il l'appelle sur MESSAGE, quand la page a obtenu l'accord ;
    · la page recharge sur `controllerchange`, jamais au clic — sinon l'ancien
      worker sert encore les anciens fichiers et la page « neuve » repart sur
      l'ancienne version.
*/
/*
  Commentaires retirés AVANT lecture. Le premier jet lisait le commentaire
  « PAS de `skipWaiting()` ici » comme du code et accusait le correctif d'être
  le défaut — un contrôle qui ne distingue pas ce qui s'exécute de ce qui
  s'explique accuse toujours au mauvais endroit.
*/
const sansCommentaires = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const sw = sansCommentaires(fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf-8'));
const notice = sansCommentaires(
  fs.readFileSync(path.join(ROOT, 'src/components/PwaUpdateNotice.tsx'), 'utf-8'),
);

const installBloc = /addEventListener\('install'[\s\S]*?\n\}\);/.exec(sw);
if (!installBloc) {
  failures.push("Le gestionnaire `install` du service worker est introuvable.");
} else if (/skipWaiting\(\)/.test(installBloc[0])) {
  failures.push(
    "Le service worker appelle `skipWaiting()` à l'INSTALLATION : il reprend donc " +
      "la main tout seul, sur une page qui continue de faire tourner l'ancien " +
      'JavaScript, et personne n’est prévenu. C’est exactement le défaut du Bloc 4.',
  );
}

if (!/addEventListener\('message'[\s\S]{0,300}?SKIP_WAITING[\s\S]{0,120}?skipWaiting\(\)/.test(sw)) {
  failures.push(
    "Le service worker n'écoute plus `SKIP_WAITING` : la page n'a plus aucun moyen " +
      "de lui dire d'y aller, et la mise à jour n'arrivera jamais.",
  );
}

if (!/addEventListener\('controllerchange'/.test(notice)) {
  failures.push(
    "`PwaUpdateNotice` n'écoute plus `controllerchange` : le rechargement ne serait " +
      'plus lié à la prise de contrôle, donc la page pourrait repartir sur l’ancienne ' +
      'version servie par l’ancien worker.',
  );
}

if (!/navigator\.serviceWorker\.controller/.test(notice)) {
  failures.push(
    "`PwaUpdateNotice` ne vérifie plus qu'un worker contrôlait déjà la page : la " +
      "bannière apparaîtrait à la PREMIÈRE visite, pour annoncer le remplacement " +
      "d'une version qui n'a jamais existé.",
  );
}

/* -------------------------------------------------------------- verdict -- */

if (failures.length > 0) {
  console.error('\nCanaux de mise à jour : les deux chaînes peuvent se croiser.\n');
  for (const failure of failures) console.error(`  ✗ ${failure}\n`);
  process.exit(1);
}

console.log(
  '\nCanaux de mise à jour : interne et Business restent séparés ' +
    '(8 règles, du publisher à la mise à jour visible sur la PWA).',
);
