/**
 * Contrôle d'avant-publication : l'application empaquetée est-elle complète ?
 *
 * Le raisonnement et les règles vivent dans `scripts/package-rules.mjs`, parce
 * que le hook `postPackage` de `forge.config.ts` s'en sert aussi : deux copies
 * de cette liste finiraient par diverger, et ce serait le jour où l'une des
 * deux servirait à valider une livraison.
 *
 *   npm run check:package
 *   npm run check:package -- --dir "out/AMN Business-win32-x64"
 */

import fs from 'node:fs';
import path from 'node:path';
import { auditPackage, REMEDE } from './package-rules.mjs';

const args = process.argv.slice(2);
const flag = (nom) => {
  const i = args.indexOf(`--${nom}`);
  return i >= 0 ? args[i + 1] : null;
};

/**
 * Les dossiers de `out/` qui sont VRAIMENT une application empaquetée.
 *
 * Reconnue à son contenu (`resources/app.asar`), et non à sa position. La
 * première version excluait `make` par son nom et prenait tout le reste — elle
 * a donc audité `out/publish-dry-run`, le dossier d'état que Forge écrit
 * pendant `publish --dry-run`, et déclaré l'exécutable manquant. Mesuré : le
 * contrôle censé protéger la publication l'aurait bloquée dès la première
 * vraie release, sur un problème inexistant.
 *
 * Une liste de noms à exclure aurait le même défaut au prochain dossier que
 * Forge décide d'écrire là. Le contenu, lui, ne ment pas.
 */
function paquetsSousOut() {
  const dossiers = [];
  // Les deux chaînes d'empaquetage : `out/` (Forge, conservé pour le dev) et
  // `dist-app/` (electron-builder, la chaîne de publication).
  for (const racine of ['out', 'dist-app']) {
    if (!fs.existsSync(racine)) continue;
    for (const e of fs.readdirSync(racine, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const d = path.join(racine, e.name);
      if (fs.existsSync(path.join(d, 'resources', 'app.asar'))) dossiers.push(d);
    }
  }
  return dossiers;
}

const dossiers = flag('dir') ? [flag('dir')] : paquetsSousOut();
if (dossiers.length === 0) {
  console.error(
    'Aucune application empaquetée trouvée.\n' +
      'Lancez `npm run package` (ou `npm run make`), ou passez le dossier avec --dir.',
  );
  process.exit(2);
}

let echecs = 0;
for (const dossier of dossiers) {
  const { plateforme, executable, reference, problemes, nonCouvert } = auditPackage(dossier);

  if (nonCouvert) {
    console.error(`\n${dossier} — paquet macOS, disposition non couverte. Vérification manuelle requise.`);
    echecs += 1;
    continue;
  }

  console.log(`\nContrôle du paquet ${plateforme} — ${dossier}`);
  if (reference) console.log(`  référence : node_modules/electron/dist (Electron ${reference})`);
  else console.log('  référence : liste critique (dist Electron absent ou d’une autre plateforme)');

  if (problemes.length > 0) {
    echecs += 1;
    console.error(`\n  ÉCHEC — ${problemes.length} problème(s) : cette application ne démarrera pas.\n`);
    for (const p of problemes) console.error(`    ✗ ${p}`);
  } else {
    console.log(`  OK — moteur Electron complet, application présente (${executable}).`);
  }
}

if (echecs > 0) {
  console.error(`\nNe publiez pas cet artefact.\n${REMEDE}`);
  process.exit(1);
}
