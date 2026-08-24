/**
 * Contrôle de l'INSTALLEUR Squirrel — ce qui part réellement chez une cliente.
 *
 * Le raisonnement vit dans `scripts/installer-rules.mjs`, parce que le hook
 * `postMake` de `forge.config.ts` s'en sert aussi.
 *
 *   npm run check:installer
 *   npm run check:installer -- --file "out/make/squirrel.windows/x64/xxx-full.nupkg"
 */

import fs from 'node:fs';
import path from 'node:path';
import { auditInstaller, REMEDE_INSTALLEUR } from './installer-rules.mjs';

const args = process.argv.slice(2);
const flag = (nom) => {
  const i = args.indexOf(`--${nom}`);
  return i >= 0 ? args[i + 1] : null;
};

function trouverNupkgs() {
  const racine = 'out/make/squirrel.windows';
  if (!fs.existsSync(racine)) return [];
  const out = [];
  for (const arch of fs.readdirSync(racine)) {
    const d = path.join(racine, arch);
    if (!fs.statSync(d).isDirectory()) continue;
    for (const f of fs.readdirSync(d)) if (f.endsWith('.nupkg')) out.push(path.join(d, f));
  }
  return out;
}

function trouverPaquet() {
  if (!fs.existsSync('out')) return null;
  const d = fs
    .readdirSync('out', { withFileTypes: true })
    .find((e) => e.isDirectory() && e.name !== 'make' && /win32/.test(e.name));
  return d ? path.join('out', d.name) : null;
}

const fichiers = flag('file') ? [flag('file')] : trouverNupkgs();
if (fichiers.length === 0) {
  console.error(
    'Aucun installeur Squirrel trouvé sous out/make/squirrel.windows/.\n' +
      'Ce contrôle ne concerne que Windows — sur une autre plateforme, il n’y a rien à vérifier ici.',
  );
  process.exit(2);
}

const paquet = trouverPaquet();
let echecs = 0;
for (const fichier of fichiers) {
  const { problemes, entrees } = auditInstaller(fichier, paquet);
  console.log(`\nContrôle de l'installeur — ${fichier} (${entrees} entrées)`);
  if (paquet) console.log(`  référence de taille : ${paquet}`);
  if (problemes.length > 0) {
    echecs += 1;
    console.error(`\n  ÉCHEC — ${problemes.length} problème(s) :\n`);
    for (const p of problemes) console.error(`    ✗ ${p}`);
  } else {
    console.log('  OK — l’installeur contient tout ce qu’il faut pour démarrer.');
  }
}

if (echecs > 0) {
  console.error(`\nNe publiez pas cet installeur.\n${REMEDE_INSTALLEUR}`);
  process.exit(1);
}
