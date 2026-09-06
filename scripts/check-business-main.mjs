#!/usr/bin/env node
/**
 * Contrôle d'hygiène du PROCESS MAIN et du PRÉCHARGEMENT livrés à une cliente.
 *
 * `check-business-bundle.mjs` relit le build web, le plus exposé des deux. Mais
 * l'app Electron d'une cliente a un second bundle, invisible depuis le
 * navigateur : le process main, qui a les droits du poste. C'est là que vivait
 * le contrôle à distance (`injectRemoteInput` → `SendInput` de user32.dll : la
 * vraie souris, le vrai clavier), enregistré sans condition d'édition jusqu'à
 * l'audit de sécurité. Le build web n'en montrait rien, et il passait au vert.
 *
 * Ce script construit donc main + preload en édition Business, comme le fait
 * electron-forge (build.lib), dans un dossier temporaire, et les relit avec
 * les motifs interdits — les généraux ET ceux qui n'ont de sens que côté Node.
 *
 * CONTRÔLE POSITIF : il construit AUSSI le main de l'édition interne et exige
 * d'y trouver `SendInput`. Sans ça, renommer le module suffirait à rendre le
 * contrôle vide — il dirait « aucune trace » sans plus rien savoir chercher.
 * Un contrôle qui ne peut pas échouer ne contrôle rien.
 *
 * Usage :  node scripts/check-business-main.mjs
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { FORBIDDEN, FORBIDDEN_NODE } from './business-bundle-rules.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'amn-main-'));
const failures = [];

async function construire(edition) {
  const outDir = path.join(TMP, edition);
  const previous = process.env.AMN_EDITION;
  process.env.AMN_EDITION = edition;
  try {
    for (const [configFile, entry, name] of [
      ['vite.main.config.ts', 'src/main.ts', 'main'],
      ['vite.preload.config.ts', 'src/preload.ts', 'preload'],
    ]) {
      await build({
        configFile: path.join(ROOT, configFile),
        root: ROOT,
        logLevel: 'error',
        build: {
          outDir: path.join(outDir, name),
          emptyOutDir: true,
          // Minifié, comme le build de production : c'est CE bundle-là qui
          // part chez la cliente. Non minifié, le contrôle relevait des
          // commentaires — « SSL Monitor (BLOC 6) » dans le transport partagé —
          // que la production n'embarque pas, et ratait ce qui compte.
          minify: true,
          ssr: true,
          lib: { entry: path.join(ROOT, entry), formats: ['cjs'], fileName: () => `${name}.js` },
        },
      });
    }
  } finally {
    if (previous === undefined) delete process.env.AMN_EDITION;
    else process.env.AMN_EDITION = previous;
  }
  return {
    main: fs.readFileSync(path.join(outDir, 'main', 'main.js'), 'utf-8'),
    preload: fs.readFileSync(path.join(outDir, 'preload', 'preload.js'), 'utf-8'),
  };
}

function chercher(contenu, regles) {
  const lower = contenu.toLowerCase();
  const trouves = [];
  for (const rule of regles) {
    const haystack = rule.caseSensitive ? contenu : lower;
    const needle = rule.caseSensitive ? rule.pattern : rule.pattern.toLowerCase();
    const index = haystack.indexOf(needle);
    if (index !== -1) {
      trouves.push({
        pattern: rule.pattern,
        why: rule.why,
        excerpt: contenu.slice(Math.max(0, index - 50), index + needle.length + 50).replace(/\s+/g, ' '),
      });
    }
  }
  return trouves;
}

console.log('Contrôle du process main Business\n');
console.log('  build interne (contrôle positif)…');
const interne = await construire('internal');
console.log('  build Business…');
const business = await construire('business');

/* 1. Le contrôle positif : la chose à interdire existe bien, et on la voit —
   dans le main (l'appel natif) ET dans le preload (le canal du pont). */
for (const [nom, contenu, motif] of [
  ['main', interne.main, 'SendInput'],
  ['preload', interne.preload, 'injectRemoteInput'],
]) {
  if (chercher(contenu, [{ pattern: motif, why: '', caseSensitive: true }]).length === 0) {
    failures.push(
      `Contrôle positif raté : « ${motif} » est introuvable dans le ${nom} INTERNE. ` +
        'Soit le contrôle à distance a changé de forme, soit le build ne construit pas ce ' +
        "qu'on croit — dans les deux cas, ce script ne sait plus ce qu'il cherche.",
    );
  } else {
    console.log(`  OK  le ${nom} interne contient bien « ${motif} » — le contrôle voit ce qu’il doit voir`);
  }
}

/* 2. Le bundle Business est bien un bundle Business. */
if (!business.main.includes('AMN Business')) {
  failures.push('Le main construit ne porte pas « AMN Business » : ce n’est pas l’édition attendue.');
}
if (business.preload.length < 1024) {
  failures.push(`Préchargement Business anormalement court (${business.preload.length} octets).`);
}

/* 3. Aucune trace, dans les deux bundles, des deux listes. */
for (const [nom, contenu] of [['main', business.main], ['preload', business.preload]]) {
  for (const f of chercher(contenu, [...FORBIDDEN, ...FORBIDDEN_NODE])) {
    failures.push(`${nom}.js — « ${f.pattern} » (${f.why})\n      …${f.excerpt}…`);
  }
}

fs.rmSync(TMP, { recursive: true, force: true });

console.log('');
if (failures.length === 0) {
  console.log(
    `OK — main et preload Business sans trace de contrôle à distance ni d’AMN DevSec ` +
      `(${FORBIDDEN.length + FORBIDDEN_NODE.length} motifs).`,
  );
  process.exit(0);
}
console.error(`ÉCHEC  ${failures.length} problème(s) :\n`);
for (const f of failures) console.error(`  - ${f}`);
process.exit(1);
