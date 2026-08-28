#!/usr/bin/env node
/**
 * Enregistre un installeur Business construit LOCALEMENT auprès d'amn-api.
 *
 * C'est le seul geste manuel de la chaîne de livraison, et il est manuel pour
 * une raison qu'aucun code ne lèvera : l'installeur Windows est produit par
 * Squirrel, qui exige une machine Windows. amn-api tourne sous Linux — elle ne
 * peut pas fabriquer le `.exe`, elle peut seulement en tenir le registre et en
 * distribuer l'accès.
 *
 * La chaîne complète, du début à la fin :
 *
 *   1. sur une machine Windows :  npm run make:business
 *   2. sur la même machine :      npm run publish:release
 *   3. dans l'Atelier :           créer la cliente → deux liens sortent,
 *                                 l'activation du compte ET le téléchargement.
 *   4. chez les clientes déjà installées : rien à faire. Leur application
 *      interroge le canal toute seule et propose la mise à jour (BLOC O).
 *
 * IL N'Y A PAS D'INSTALLEUR PAR CLIENTE, et il ne peut pas y en avoir : l'app
 * Business est la même pour toutes, elle apprend son organisation à la
 * connexion. Ce qui change d'une cliente à l'autre est son COMPTE, déjà créé
 * par l'Atelier. On publie donc UNE version, et on en émet autant de liens
 * qu'on a de clientes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CE QUI A CHANGÉ AVEC LE BLOC O : CE SCRIPT VÉRIFIE CE QU'IL PUBLIE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Depuis que les clientes se mettent à jour toutes seules, ce registre n'est
 * plus une liste de liens : c'est un CANAL. Ce qu'on y enregistre s'installe
 * chez elles sans que personne ne regarde. Le geste devait donc cesser d'être
 * confiant.
 *
 * Il l'était : la découverte automatique prenait le premier `.exe` du dossier
 * `out/make/squirrel.windows/x64`, où les DEUX éditions déposent le leur. Un
 * `npm run make` (interne) lancé la veille, un `npm run publish:release` le
 * lendemain, et l'application d'AMN DevSec — Tour de contrôle et produits de
 * cybersécurité compris — devenait la mise à jour de toutes les clientes.
 *
 * Le script relit maintenant l'ARTEFACT lui-même avant de l'enregistrer :
 * l'application empaquetée qui accompagne l'installeur est ouverte et
 * comparée aux règles de `scripts/business-bundle-rules.mjs`. Un produit
 * interne dedans, ou un marqueur Business manquant, et la publication est
 * refusée. Le nom du fichier n'est jamais une preuve — c'est celui qui l'a
 * nommé qu'on croirait.
 *
 * Usage :
 *   AMN_API_URL=https://… OPERATOR_TOKEN=… node scripts/publish-release.mjs \
 *     [--file out/make/squirrel.windows/x64/AMN-Business-1.2.31-Setup.exe] \
 *     [--app  "out/AMN Desktop-win32-x64"]  # l'app empaquetée à relire
 *     [--location https://…]                # si les octets vivent ailleurs
 *     [--notes "Correctif de sécurité."]
 *
 * Sans `--location`, l'emplacement enregistré est le chemin ABSOLU du fichier :
 * ça ne vaut que si amn-api tourne sur cette machine-là. En déploiement réel,
 * téléversez le fichier sur un stockage objet et passez son URL.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ARTIFACT_FORBIDDEN, ARTIFACT_REQUIRED } from './business-bundle-rules.mjs';
import { auditPackage, REMEDE } from './package-rules.mjs';

/*
  LE NOM DE L'ÉDITION CLIENTE, LU DANS SA CONFIGURATION — jamais écrit ici.

  Ce script cherchait « AMN Business » partout : l'exécutable, le dossier
  déballé, et un filtre `/business/i` sur le nom de l'installeur. C'était juste
  avant le renommage du Bloc 1 ; depuis, l'édition CLIENTE s'appelle « AMN
  Desktop » et c'est l'édition INTERNE qui s'appelle « AMN Business ».

  Toutes les recherches de ce script étaient donc INVERSÉES. Deux conséquences,
  et la seconde est celle qui compte :

    · l'installeur cliente (`AMN Desktop-Setup-…exe`) n'était plus trouvé, et
      le script s'arrêtait sur « Aucun installeur Business trouvé » ;
    · si les deux builds étaient là, le filtre `/business/i` sélectionnait
      l'installeur INTERNE. La relecture de l'asar l'aurait refusé — elle
      cherche des marqueurs, pas des noms — mais on ne serait passé à côté de
      la publication de notre propre application chez toutes les clientes que
      grâce à un second contrôle.

  D'où la lecture de la configuration : `AMN_EDITION=business` donne le nom que
  le paquet portera VRAIMENT, et ce script ne peut plus se tromper d'édition en
  se fiant à une chaîne écrite un jour où elle était vraie.
*/
process.env.AMN_EDITION = 'business';
const configCliente = (await import('../electron-builder.config.mjs')).default;
const NOM_CLIENTE = configCliente.productName;
const EXEC_LINUX = configCliente.linux?.executableName ?? NOM_CLIENTE;

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};

const apiUrl = (process.env.AMN_API_URL || '').replace(/\/$/, '');
const token = process.env.OPERATOR_TOKEN || '';

if (!apiUrl || !token) {
  console.error('AMN_API_URL et OPERATOR_TOKEN sont obligatoires.');
  process.exit(1);
}

/**
 * L'application empaquetée de l'édition Business.
 *
 * `electron-forge package` la dépose dans `out/AMN Desktop-<plateforme>-<arch>`
 * — le nom vient de `packagerConfig.name`, qui dépend de `AMN_EDITION`. Deux
 * éditions, deux dossiers : c'est la seule séparation que le système de
 * fichiers nous donne, et elle sert de point de départ, jamais de preuve.
 */
function findPackagedApp() {
  const explicite = flag('app');
  if (explicite) return explicite;
  // electron-builder : le dossier déballé accompagne toujours l'installeur.
  // L'exécutable `amn-business` distingue l'édition — le nom du dossier, non.
  const builder = 'dist-app/win-unpacked';
  if (fs.existsSync(path.join(builder, `${NOM_CLIENTE}.exe`))) return builder;
  const builderLinux = 'dist-app/linux-unpacked';
  if (fs.existsSync(path.join(builderLinux, EXEC_LINUX))) return builderLinux;
  if (!fs.existsSync('out')) return null;
  const candidats = fs
    .readdirSync('out', { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.startsWith(`${NOM_CLIENTE}-`))
    .map((e) => path.join('out', e.name));
  return candidats[0] ?? null;
}

/**
 * Relit l'artefact et rend la liste de ce qui cloche.
 *
 * L'asar est lu comme un tas d'octets : le format concatène ses fichiers sans
 * les compresser, donc une chaîne présente dans un fichier est présente dans
 * l'archive. C'est grossier, et c'est exactement ce qu'il faut — on ne cherche
 * pas à comprendre le bundle, on cherche à savoir s'il porte des choses qui
 * n'ont rien à faire chez une cliente.
 */
function auditPackagedApp(appDir) {
  const asar = path.join(appDir, 'resources', 'app.asar');
  if (!fs.existsSync(asar)) {
    return [`app.asar introuvable dans ${appDir} — est-ce bien une application empaquetée ?`];
  }
  const octets = fs.readFileSync(asar).toString('latin1');
  const problemes = [];

  for (const { pattern, why, caseSensitive } of ARTIFACT_FORBIDDEN) {
    const trouve = caseSensitive
      ? octets.includes(pattern)
      : octets.toLowerCase().includes(pattern.toLowerCase());
    if (trouve) problemes.push(`« ${pattern} » ne doit pas s'y trouver (${why}).`);
  }
  for (const { pattern, why } of ARTIFACT_REQUIRED) {
    if (!octets.includes(pattern)) {
      problemes.push(`« ${pattern} » manque (${why}) — cet artefact n'a pas l'air d'être l'édition Business.`);
    }
  }
  return problemes;
}

/** Retrouve l'installeur produit par `make:business`, si on ne l'a pas nommé. */
function findInstaller() {
  // `dist-app/` d'abord : la chaîne electron-builder/NSIS est celle de la
  // publication depuis la migration hors Squirrel. Les chemins `out/make`
  // restent lus pour un artefact Forge historique passé avec --file.
  const roots = ['dist-app', 'out/make/squirrel.windows/x64', 'out/make/squirrel.windows/ia32', 'out/make'];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const found = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isFile() && /\.exe$/i.test(e.name))
      // Les deux éditions peuvent déposer leur installeur dans CE dossier.
      // Filtrer sur le nom ne prouve rien (voir l'audit de l'artefact plus
      // bas), mais évite de partir sur le mauvais fichier quand les deux sont là.
      /*
        Le nom du paquet CLIENT, et pas le mot « business » — qui désigne
        désormais l'édition interne. Filtrer sur le nom ne prouve rien (voir
        l'audit de l'artefact plus bas), mais il faut au moins partir sur le
        bon fichier quand les deux sont là.
      */
      .filter((e) => e.name.startsWith(NOM_CLIENTE))
      .map((e) => path.join(root, e.name));
    if (found.length > 0) return found[0];
  }
  return null;
}

const file = flag('file') ?? findInstaller();
if (!file || !fs.existsSync(file)) {
  console.error(
    `Aucun installeur « ${NOM_CLIENTE} » trouvé. Lancez \`npm run make:business\` sur une machine Windows,\n` +
      'ou passez le chemin avec --file.',
  );
  process.exit(1);
}

/* ------------------------- Le contrôle qui manquait ------------------------ */

const appDir = findPackagedApp();
if (!appDir || !fs.existsSync(appDir)) {
  console.error(
    'Application empaquetée introuvable : impossible de vérifier que cet installeur est\n' +
      `bien l’édition cliente. Attendu un dossier \`out/${NOM_CLIENTE}-…\` produit par\n` +
      '`npm run make:business`, ou passez-le avec --app.\n' +
      '\n' +
      'Publier sans cette vérification est refusé : ce qu’on enregistre ici s’installe\n' +
      'tout seul chez les clientes.',
  );
  process.exit(1);
}

/*
  LE MOTEUR AVANT LE CONTENU.

  L'audit qui suit répond à « est-ce bien l'édition Business ? ». Celui-ci
  répond à une question plus élémentaire, et qu'on n'avait jamais posée :
  « est-ce que ça démarre ? » Une livraison s'est installée proprement puis a
  refusé de s'ouvrir, faute d'`icudtl.dat` — un fichier du moteur Electron, pas
  du code. Vérifier l'édition d'un exécutable mort n'avance à rien.
*/
const moteur = auditPackage(appDir);
if (!moteur.nonCouvert && moteur.problemes.length > 0) {
  console.error(`\nPUBLICATION REFUSÉE — le moteur Electron est incomplet dans ${appDir} :\n`);
  for (const probleme of moteur.problemes) console.error(`  ✗ ${probleme}`);
  console.error(`\nCette application ne démarrerait pas chez la cliente.\n${REMEDE}`);
  process.exit(1);
}

const problemes = auditPackagedApp(appDir);
if (problemes.length > 0) {
  console.error(`\nPUBLICATION REFUSÉE — ${appDir} n’est pas une édition Business saine :\n`);
  for (const probleme of problemes) console.error(`  ✗ ${probleme}`);
  console.error(
    '\nRien n’a été enregistré. Reconstruisez avec `npm run make:business` (et non `npm run make`),\n' +
      'puis relancez.',
  );
  process.exit(1);
}
console.log(`Artefact vérifié : ${appDir} est bien l’édition Business.`);

/* ------------------------------ Enregistrement ----------------------------- */

const bytes = fs.readFileSync(file);
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
const version = JSON.parse(fs.readFileSync('package.json', 'utf-8')).version;
const location = flag('location') ?? path.resolve(file);
const platform = flag('platform') ?? 'win32';

const res = await fetch(`${apiUrl}/v1/admin/releases`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    version,
    platform,
    filename: path.basename(file),
    byteSize: bytes.length,
    sha256,
    location,
    notes: flag('notes') ?? '',
  }),
});

const body = await res.json().catch(() => null);
if (!res.ok) {
  console.error(`amn-api a refusé (${res.status}) :`, body?.error ?? '(pas de message)');
  process.exit(1);
}

console.log(`Version ${version} publiée sur le canal Business.`);
console.log(`  fichier   ${path.basename(file)}  (${(bytes.length / 1024 / 1024).toFixed(1)} Mo)`);
console.log(`  empreinte ${sha256}`);
console.log(`  emplacement ${location}`);
console.log('');
console.log('Les installations déjà en place la verront à leur prochaine ronde (6 h au plus),');
console.log('ou tout de suite via « Vérifier les mises à jour maintenant » dans leurs Paramètres.');
if (!/^https?:\/\//i.test(location)) {
  console.log('');
  console.log('ATTENTION : l’emplacement est un CHEMIN LOCAL. amn-api ne pourra servir ce');
  console.log('fichier que si elle tourne sur cette machine. Pour un vrai déploiement,');
  console.log('téléversez-le sur un stockage objet et relancez avec --location <URL>.');
}
