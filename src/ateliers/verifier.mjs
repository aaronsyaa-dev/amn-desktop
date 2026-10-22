/**
 * LE VÉRIFICATEUR DE L'ATELIER (F1) — `node src/ateliers/verifier.mjs [module…]`.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Sans navigateur, sans réseau, sans build servi. Pour chaque dossier de
 * `src/ateliers/` (hors `_commun`) :
 *
 *   1. LES PIÈCES : module.ts, logique.ts, donnees.ts, i18n.ts, tests.ts,
 *      Ecran.tsx, la spec `docs/atelier/modules/<id>.md`, l'aperçu
 *      `docs/atelier/apercus/<id>.html` et une ligne dans `docs/atelier/PRET.md`.
 *   2. LE MANIFESTE, confronté au registre de S1 : famille du socle, action de
 *      cette famille, id et route libres (ni dans le registre, ni chez un voisin),
 *      au moins un verbe et un mot-clé, un niveau connu.
 *   3. LES TEXTES : mêmes clés en anglais et en français, aucune vide.
 *   4. LES TESTS du module (`TESTS`, trois au moins), tous verts.
 *   5. L'ÉCRAN, rendu hors navigateur en français et en anglais : il se rend,
 *      il porte le cadre de l'atelier, un seul bouton blanc plein.
 *   6. LES SOURCES : imports limités au socle, au cadre commun, à React,
 *      lucide-react et framer-motion (aucun autre module, aucune couture
 *      `@edition`) ; aucun appel réseau ni stockage ; aucune couleur en dur ;
 *      aucun émoji.
 *   7. L'ISOLEMENT : aucun fichier hors `src/ateliers/` n'importe l'atelier.
 *      Rien n'est branché au rail, aux routes ni au registre.
 *   8. L'APERÇU HTML est autonome : aucune ressource chargée du réseau.
 *
 * Un `.mjs` et non un `.ts` : `tsconfig.json` couvre `src/` sans
 * `allowImportingTsExtensions`, et le retrait de types de Node exige des
 * imports en `.ts`. esbuild construit donc chaque module à la volée, comme
 * le font `check:navigation` et `check:socle`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dossierAteliers = path.join(racine, 'src/ateliers');
const lire = (rel) => fs.readFileSync(path.join(racine, rel), 'utf8');
const existe = (rel) => fs.existsSync(path.join(racine, rel));

let echecs = 0;
let vus = 0;
const dit = async (nom, fn) => {
  try {
    await fn();
    vus += 1;
    console.log(`  ✓ ${nom}`);
  } catch (err) {
    echecs += 1;
    console.error(`  ✗ ${nom}\n      ${String(err?.message ?? err).split('\n').join('\n      ')}`);
  }
};
const exiger = (cond, message) => {
  if (!cond) throw new Error(message);
};

async function charger(code) {
  const construit = await esbuild.build({
    stdin: { contents: code, resolveDir: dossierAteliers, loader: 'tsx' },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    charset: 'utf8',
    jsx: 'automatic',
    loader: { '.css': 'empty', '.woff': 'empty', '.woff2': 'empty' },
    tsconfig: path.join(racine, 'tsconfig.json'),
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', __AMN_EDITION__: '"internal"', __AMN_VERSION__: '"0.0.0"' },
    logLevel: 'silent',
  });
  return import(`data:text/javascript;charset=utf-8;base64,${Buffer.from(construit.outputFiles[0].text, 'utf8').toString('base64')}`);
}

const demandes = process.argv.slice(2);
const modules = fs
  .readdirSync(dossierAteliers, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
  .map((e) => e.name)
  .filter((n) => demandes.length === 0 || demandes.includes(n))
  .sort();

const { REGISTRE, ACTIONS, FAMILLES, NIVEAUX } = await charger(
  [
    "export { REGISTRE, ACTIONS } from '../refonte/navigation/registre';",
    "export { FAMILLES } from '../socle/familles';",
    "export { NIVEAUX } from './_commun/manifeste';",
  ].join('\n'),
);

const PIECES = ['module.ts', 'logique.ts', 'donnees.ts', 'i18n.ts', 'tests.ts', 'Ecran.tsx'];
const IMPORTS_PERMIS = [/^\.\/[\w.-]+$/, /^\.\.\/_commun\/[\w.-]+$/, /^\.\.\/\.\.\/socle(\/[\w.-]+)*$/, /^\.\.\/\.\.\/i18n$/, /^react$/, /^lucide-react$/, /^framer-motion$/];
const RESEAU = /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|\bimport\s*\(/;
const COULEUR_PALETTE =
  /\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|shadow)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|white|black)\b/;
const COULEUR_EN_DUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/;
const EMOJI = /\p{Extended_Pictographic}/u;
const sansCommentaires = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const importsDe = (s) => [...s.matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g)].map((x) => x[1]);

const pret = existe('docs/atelier/PRET.md') ? lire('docs/atelier/PRET.md') : '';
const routesRegistre = new Set(REGISTRE.map((e) => e.route));
const idsRegistre = new Set(REGISTRE.map((e) => e.id));
const routesVues = new Map();

for (const id of modules) {
  console.log(`\nAtelier — ${id}\n`);
  const rel = `src/ateliers/${id}`;

  await dit('les pièces sont là (code, tests, spec, aperçu, ligne dans PRET.md)', () => {
    for (const p of PIECES) exiger(existe(`${rel}/${p}`), `${rel}/${p} manquant`);
    exiger(existe(`docs/atelier/modules/${id}.md`), `docs/atelier/modules/${id}.md manquant`);
    exiger(existe(`docs/atelier/apercus/${id}.html`), `docs/atelier/apercus/${id}.html manquant`);
    exiger(new RegExp('`' + id + '`').test(pret), `aucune ligne \`${id}\` dans docs/atelier/PRET.md`);
  });
  if (!PIECES.every((p) => existe(`${rel}/${p}`))) continue;

  let charge;
  await dit('le module se construit', async () => {
    charge = await charger(
      [
        `export { MODULE } from './${id}/module';`,
        `export { TESTS } from './${id}/tests';`,
        `export { DICOS } from './${id}/i18n';`,
        `export { default as Ecran } from './${id}/Ecran';`,
        "export { createElement } from 'react';",
        "export { renderToStaticMarkup } from 'react-dom/server.browser';",
        "export { changerLangue } from '../i18n';",
      ].join('\n'),
    );
  });
  if (!charge) continue;
  const { MODULE, TESTS, DICOS, Ecran, createElement, renderToStaticMarkup, changerLangue } = charge;

  await dit('le manifeste suit le registre de S1 (famille, action, verbes, mots-clés, niveau)', () => {
    exiger(MODULE.id === id, `id « ${MODULE.id} » ≠ dossier « ${id} »`);
    exiger(/^\/[a-z0-9-/]+$/.test(MODULE.route), `route « ${MODULE.route} » mal formée`);
    exiger(!idsRegistre.has(id), `id « ${id} » déjà pris dans le registre`);
    exiger(!routesRegistre.has(MODULE.route), `route ${MODULE.route} déjà prise dans le registre`);
    exiger(!routesVues.has(MODULE.route), `route ${MODULE.route} déjà prise par ${routesVues.get(MODULE.route)}`);
    routesVues.set(MODULE.route, id);
    exiger(FAMILLES.includes(MODULE.famille), `famille inconnue : ${MODULE.famille}`);
    const [f, a] = MODULE.action.split('.');
    exiger(f === MODULE.famille, `action ${MODULE.action} hors de la famille ${MODULE.famille}`);
    exiger(ACTIONS[f]?.includes(a), `action « ${a} » inconnue de ${f} (connues : ${ACTIONS[f]?.join(', ')})`);
    exiger(MODULE.verbes.length >= 1 && MODULE.verbes.every((v) => v.trim().length > 3), 'au moins un verbe, non vide');
    exiger(MODULE.motsCles.length >= 1 && MODULE.motsCles.every((v) => v.trim().length > 0), 'au moins un mot-clé, non vide');
    exiger(NIVEAUX.includes(MODULE.niveau), `niveau inconnu : ${MODULE.niveau}`);
    exiger(MODULE.nom?.trim() && MODULE.pourQui?.trim(), 'nom et pourQui obligatoires');
    exiger(!MODULE.aValider || MODULE.pourquoi, 'aValider sans pourquoi');
  });

  await dit('les textes : mêmes clés en anglais et en français, aucune vide', () => {
    const en = Object.keys(DICOS.en).sort();
    const fr = Object.keys(DICOS.fr).sort();
    exiger(JSON.stringify(en) === JSON.stringify(fr), 'clés différentes entre en et fr');
    for (const l of ['en', 'fr']) for (const [k, v] of Object.entries(DICOS[l])) exiger(String(v).trim(), `${l}.${k} vide`);
  });

  await dit(`les tests du module (${TESTS?.length ?? 0})`, () => {
    exiger(Array.isArray(TESTS) && TESTS.length >= 3, 'au moins trois tests');
    const fautes = [];
    for (const t of TESTS) {
      try {
        t.f();
      } catch (err) {
        fautes.push(`${t.nom} : ${err.message}`);
      }
    }
    exiger(fautes.length === 0, fautes.join('\n'));
  });

  for (const langue of ['fr', 'en']) {
    await dit(`l’écran se rend (${langue}), dans le cadre, avec un seul bouton blanc plein`, () => {
      changerLangue(langue);
      const html = renderToStaticMarkup(createElement(Ecran));
      exiger(html.includes('data-atelier'), 'l’écran ne passe pas par CadreAtelier');
      exiger(html.includes(`data-famille="${MODULE.famille}"`), 'famille absente du cadre');
      const primaires = html.match(/hover:bg-socle-primaire-survol/g)?.length ?? 0;
      exiger(primaires <= 1, `${primaires} boutons primaires rendus`);
      exiger(!/undefined|NaN|\{\w+\}/.test(html.replace(/<[^>]+>/g, ' ')), 'texte « undefined », « NaN » ou trou {x} non rempli à l’écran');
    });
  }
  changerLangue(null);

  await dit('les sources : imports permis, ni réseau ni stockage, ni couleur en dur, ni émoji', () => {
    const fautes = [];
    for (const f of fs.readdirSync(path.join(racine, rel))) {
      if (!/\.tsx?$/.test(f)) continue;
      const brut = lire(`${rel}/${f}`);
      const src = sansCommentaires(brut);
      for (const i of importsDe(src)) if (!IMPORTS_PERMIS.some((r) => r.test(i))) fautes.push(`${f} importe ${i}`);
      if (RESEAU.test(src)) fautes.push(`${f} : appel réseau, import dynamique ou stockage (${src.match(RESEAU)[0]})`);
      if (f.endsWith('.tsx')) {
        if (COULEUR_PALETTE.test(src)) fautes.push(`${f} : couleur de palette (${src.match(COULEUR_PALETTE)[0]})`);
        if (COULEUR_EN_DUR.test(src)) fautes.push(`${f} : couleur en dur (${src.match(COULEUR_EN_DUR)[0]})`);
        const primaires = src.match(/variante="primaire"/g)?.length ?? 0;
        if (primaires > 1) fautes.push(`${f} : ${primaires} boutons primaires dans le source`);
      }
      if (EMOJI.test(brut)) fautes.push(`${f} : émoji`);
    }
    exiger(fautes.length === 0, fautes.join('\n'));
  });

  await dit('l’aperçu HTML est autonome (aucune ressource du réseau)', () => {
    if (!existe(`docs/atelier/apercus/${id}.html`)) throw new Error('aperçu manquant');
    const h = lire(`docs/atelier/apercus/${id}.html`);
    exiger(/<!doctype html>/i.test(h), 'doctype manquant');
    exiger(!/(?:src|href)\s*=\s*["']\s*(?:https?:)?\/\//i.test(h) && !/@import|url\(\s*["']?(?:https?:)?\/\//i.test(h), 'ressource chargée du réseau');
    exiger(/Inter/.test(h), 'police Inter non demandée');
    exiger(!EMOJI.test(h), 'émoji');
  });
}

console.log('\nAtelier — l’isolement\n');

await dit('aucun fichier hors src/ateliers n’importe l’atelier (rien de branché)', () => {
  const fautes = [];
  const parcourir = (dir) => {
    for (const e of fs.readdirSync(path.join(racine, dir), { withFileTypes: true })) {
      const r = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'out', '.vite', path.join('src', 'ateliers')].includes(r) || e.name === 'node_modules') continue;
        parcourir(r);
      } else if (/\.(?:[cm]?[jt]sx?)$/.test(e.name)) {
        if (/ateliers\//.test(importsDe(lire(r)).join('\n'))) fautes.push(r);
      }
    }
  };
  for (const d of ['src', 'scripts']) parcourir(d);
  for (const f of ['vite.edition.ts', 'vite.renderer.config.mts', 'tsconfig.json', 'tsconfig.business.json']) if (existe(f) && /ateliers/.test(lire(f))) fautes.push(f);
  exiger(fautes.length === 0, `importent l’atelier : ${fautes.join(', ')}`);
});

await dit('un module n’en importe aucun autre (chacun se supprime seul)', () => {
  const fautes = [];
  for (const id of modules)
    for (const f of fs.readdirSync(path.join(dossierAteliers, id)))
      if (/\.tsx?$/.test(f)) for (const i of importsDe(lire(`src/ateliers/${id}/${f}`))) if (/^\.\.\/(?!_commun\/|\.\.\/)/.test(i)) fautes.push(`${id}/${f} → ${i}`);
  exiger(fautes.length === 0, fautes.join('\n'));
});

console.log('');
if (echecs > 0) {
  console.error(`ÉCHEC — ${echecs} propriété(s) de l’atelier ne tiennent pas (${modules.length} module(s)).`);
  process.exit(1);
}
console.log(`OK — ${vus} propriétés tiennent, ${modules.length} module(s) d’atelier.`);
process.exit(0);
