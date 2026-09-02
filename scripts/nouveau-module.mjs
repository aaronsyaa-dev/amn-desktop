#!/usr/bin/env node
/**
 * NOUVEAU MODULE — câbler un module partout où le produit le range.
 * ═══════════════════════════════════════════════════════════════════
 *
 * Un module vit à DOUZE endroits : trois catalogues (édition Business,
 * édition interne, contexte de support), trois tables de routes, le lexique
 * anglais, la liste des « pièces » d'animation, le garde de persistance, le
 * catalogue serveur, la liste des collections synchronisées (deux côtés).
 * Chacun est un littéral lu par un garde. En oublier un ne casse rien à la
 * compilation et casse quelque chose à l'écran — c'est exactement ce que
 * `check:modules` attrape, une fois le mal fait.
 *
 * Ce script fait les douze insertions depuis UNE description, dans le format
 * exact que les gardes lisent. L'écran, lui, s'écrit à la main : c'est le
 * monde du module, et personne ne le génère.
 *
 *   node scripts/nouveau-module.mjs spec.json
 *
 * spec.json :
 *   {
 *     "key": "polls", "label": "Sondages", "labelEn": "Polls",
 *     "hint": "Une question, un vote", "hintEn": "One question, one vote",
 *     "to": "/sondages", "icon": "Vote", "room": "tableau",
 *     "section": "collectif",                 // clé de section (Business + interne)
 *     "sectionLabel": "Collectif",            // intitulé (créé s'il manque)
 *     "sectionLabelEn": "Team",
 *     "screen": "PollsScreen", "screenFile": "src/screens/PollsScreen.tsx",
 *     "files": ["src/screens/PollsScreen.tsx", "src/state/usePolls.ts"],
 *     "collections": ["polls"],
 *     "summary": "Une question, des choix, un vote par personne.",
 *     "internalOnly": false
 *   }
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = [process.env.AMN_API_ROOT, path.join(ROOT, '..', 'amn-api')].filter(Boolean).find((c) => fs.existsSync(path.join(c, 'src/db/tenancy.js')));
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf-8'));
const { key, label, labelEn, hint, hintEn, to, icon, room = 'fiches', section, sectionLabel, sectionLabelEn, screen, screenFile, files = [], collections = [], summary, internalOnly = false, hintBusiness } = spec;
if (!key || !label || !to || !icon || !section || !screen) throw new Error('spec incomplète : key, label, to, icon, section, screen sont requis');

const read = (rel, base = ROOT) => fs.readFileSync(path.join(base, rel), 'utf-8');
const write = (rel, s, base = ROOT) => fs.writeFileSync(path.join(base, rel), s);
const fait = [];

function ajouterIcone(src, nom) {
  if (new RegExp(`\\b${nom},?\\n`).test(src.split("} from 'lucide-react'")[0])) return src;
  return src.replace("} from 'lucide-react';", `  ${nom},\n} from 'lucide-react';`);
}

/** Insère un module dans la section `section` de NAV_SECTIONS ; crée la section si elle manque. */
function insererDansCatalogue(rel, ligne, { space } = {}) {
  let src = read(rel);
  const debut = src.indexOf('export const NAV_SECTIONS');
  const fin = src.indexOf('\n];', debut);
  let bloc = src.slice(debut, fin);
  const marqueur = `key: '${section}',`;
  let i = bloc.indexOf(marqueur);
  if (i === -1) {
    // Nouvelle section, avant `Personnel` s'il existe, sinon avant `systeme`, sinon à la fin.
    const avant = ["key: 'personnel',", "key: 'systeme',"].map((m) => bloc.indexOf(m)).find((x) => x !== -1);
    const objet = `  {\n    key: '${section}',\n    label: '${sectionLabel}',\n${space ? `    space: '${space}',\n` : ''}    items: [\n${ligne}\n    ],\n  },\n`;
    if (avant !== undefined) {
      const ouverture = bloc.lastIndexOf('  {', avant);
      bloc = bloc.slice(0, ouverture) + objet + bloc.slice(ouverture);
    } else {
      bloc = bloc + '\n' + objet.trimEnd();
    }
    fait.push(`${rel} : section « ${sectionLabel} » créée avec ${key}`);
  } else {
    const items = bloc.indexOf('items: [', i);
    const fermeture = bloc.indexOf('\n    ],', items);
    if (bloc.slice(items, fermeture).includes(`key: '${key}'`)) {
      fait.push(`${rel} : ${key} déjà présent`);
    } else {
      bloc = bloc.slice(0, fermeture) + '\n' + ligne + bloc.slice(fermeture);
      fait.push(`${rel} : ${key} ajouté à « ${section} »`);
    }
  }
  src = src.slice(0, debut) + bloc + src.slice(fin);
  src = ajouterIcone(src, icon);
  write(rel, src);
}

const ligneNav = `      { key: '${key}', label: '${label}', to: '${to}', icon: ${icon}, hint: '${hint}' },`;
if (!internalOnly) insererDansCatalogue('src/edition/modules.business.ts', ligneNav);
insererDansCatalogue('src/edition/modules.internal.ts', ligneNav, { space: 'workspace' });

/* Contexte de support : CLIENT_MODULES + CLIENT_SECTIONS */
if (!internalOnly) {
  let src = read('src/client-context/ClientSidebar.tsx');
  if (!src.includes(`key: '${key}'`)) {
    const debut = src.indexOf('const CLIENT_MODULES');
    const fin = src.indexOf('\n];', debut);
    src = src.slice(0, fin) + `\n  { key: '${key}', label: '${label}', to: '${to}', icon: ${icon}, hint: '${hintBusiness ?? hint}' },` + src.slice(fin);
    const sec = src.indexOf(`{ label: '${sectionLabel}', keys: [`);
    if (sec === -1) {
      const fermeture = src.indexOf('\n];', src.indexOf('export const CLIENT_SECTIONS'));
      // Avant « Système », qui ferme toujours la liste.
      const systeme = src.lastIndexOf("  { label: 'Système'", fermeture);
      src = src.slice(0, systeme) + `  { label: '${sectionLabel}', keys: ['${key}'] },\n` + src.slice(systeme);
    } else {
      const crochet = src.indexOf(']', sec);
      src = src.slice(0, crochet) + `, '${key}'` + src.slice(crochet);
    }
    src = ajouterIcone(src, icon);
    write('src/client-context/ClientSidebar.tsx', src);
    fait.push('ClientSidebar : module et section');
  }
}

/* Modules réglables (atelier + dossier) */
if (!internalOnly) {
  let src = read('src/data/tradeProfiles.ts');
  if (!src.includes(`key: '${key}'`)) {
    const debut = src.indexOf('export const CONFIGURABLE_MODULES');
    const fin = src.indexOf('\n];', debut);
    src = src.slice(0, fin) + `\n  { key: '${key}', label: '${label}', hint: '${hint}' },` + src.slice(fin);
    write('src/data/tradeProfiles.ts', src);
    fait.push('tradeProfiles : CONFIGURABLE_MODULES');
  }
}

/* Persistance */
{
  let src = read('scripts/check-persistence.mjs');
  if (!new RegExp(`^  ${key}:`, 'm').test(src)) {
    const d1 = src.indexOf('const MODULE_DATA = {');
    const f1 = src.indexOf('\n};', d1);
    src = src.slice(0, f1) + `\n  ${key}: [${collections.map((c) => `'${c}'`).join(', ')}],` + src.slice(f1);
    const d2 = src.indexOf('const MODULE_FILES = {');
    const f2 = src.indexOf('\n};', d2);
    src = src.slice(0, f2) + `\n  ${key}: [${(files.length ? files : [screenFile]).map((f) => `'${f}'`).join(', ')}],` + src.slice(f2);
    write('scripts/check-persistence.mjs', src);
    fait.push('check-persistence : MODULE_DATA et MODULE_FILES');
  }
}

/* Lexique anglais */
{
  let src = read('src/i18n/nav.en.ts');
  if (!new RegExp(`^  ${key}:`, 'm').test(src)) {
    src = src.replace('export const NAV_EN_COMMUN: Record<string, TraductionNav> = {\n', `export const NAV_EN_COMMUN: Record<string, TraductionNav> = {\n  ${key}: { label: '${labelEn ?? label}', hint: '${hintEn ?? hint}' },\n`);
    if (sectionLabel && sectionLabelEn && !src.includes(`'${sectionLabel}':`) && !src.includes(`  ${sectionLabel}:`)) {
      src = src.replace('export const SECTIONS_EN_COMMUN: Record<string, string> = {\n', `export const SECTIONS_EN_COMMUN: Record<string, string> = {\n  '${sectionLabel}': '${sectionLabelEn}',\n`);
    }
    write('src/i18n/nav.en.ts', src);
    fait.push('nav.en.ts');
  }
}

/* Pièces d'animation */
for (const rel of internalOnly ? ['src/edition/modules.internal.ts'] : ['src/edition/modules.business.ts', 'src/edition/modules.internal.ts']) {
  let src = read(rel);
  if (!src.includes(`['${to}', `)) {
    src = src.replace("  ['/assistance', 'fil'],", `  ['/assistance', 'fil'],\n  ['${to}', '${room}'],`);
    write(rel, src);
  }
}

/* Routes */
const importLigne = `import { ${screen} } from '../screens/${path.basename(screenFile ?? `${screen}.tsx`, '.tsx')}';`;
if (!internalOnly) {
  let src = read('src/edition/appRoot.business.tsx');
  if (!src.includes(`path="${to}"`)) {
    src = src.replace("import { LibraryScreen } from '../screens/LibraryScreen';", `import { LibraryScreen } from '../screens/LibraryScreen';\n${importLigne}`);
    src = src.replace('        <Route path="/decouvrir" element={<LibraryScreen />} />', `        <Route\n          path="${to}"\n          element={\n            <ModuleRoute module="${key}">\n              <${screen} />\n            </ModuleRoute>\n          }\n        />\n        <Route path="/decouvrir" element={<LibraryScreen />} />`);
    write('src/edition/appRoot.business.tsx', src);
    fait.push('routes Business');
  }
}
{
  let src = read('src/edition/appRoot.internal.tsx');
  if (!src.includes(`path="${to}"`)) {
    src = src.replace("import { LibraryScreen } from '../screens/LibraryScreen';", `import { LibraryScreen } from '../screens/LibraryScreen';\n${importLigne}`);
    src = src.replace('        <Route path="/bibliotheque" element={<LibraryScreen />} />', `        <Route path="${to}" element={<${screen} />} />\n        <Route path="/bibliotheque" element={<LibraryScreen />} />`);
    if (!internalOnly) {
      src = src.replace('        <Route path="/administration" element={<ClientAdminScreen />} />', `        <Route\n          path="${to}"\n          element={\n            <ModuleRoute module="${key}">\n              <${screen} />\n            </ModuleRoute>\n          }\n        />\n        <Route path="/administration" element={<ClientAdminScreen />} />`);
    }
    write('src/edition/appRoot.internal.tsx', src);
    fait.push('routes internes' + (internalOnly ? '' : ' et contexte client'));
  }
}

/* Collections synchronisées — poste et serveur */
for (const c of collections) {
  let api = read('src/shared/api.ts');
  if (!api.includes(`  | '${c}'`)) {
    const debut = api.indexOf('export type SyncedCollection =');
    const fin = api.indexOf(';\n', debut);
    api = api.slice(0, fin) + `\n  | '${c}'` + api.slice(fin);
    write('src/shared/api.ts', api);
  }
  let ctx = read('src/state/SyncContext.tsx');
  if (!ctx.includes(`'${c}',`)) {
    const debut = ctx.indexOf('const SYNCED_COLLECTIONS');
    const fin = ctx.indexOf('\n];', debut);
    ctx = ctx.slice(0, fin) + `\n  '${c}',` + ctx.slice(fin);
    write('src/state/SyncContext.tsx', ctx);
  }
  if (API) {
    let col = read('src/routes/collections.js', API);
    if (!col.includes(`'${c}',`)) {
      const debut = col.indexOf('const ALLOWED = new Set([');
      const fin = col.indexOf(']);', debut);
      col = col.slice(0, fin) + `  '${c}',\n` + col.slice(fin);
      write('src/routes/collections.js', col, API);
    }
  }
  fait.push(`collection « ${c} » déclarée (poste, contexte, serveur)`);
}

/* Catalogue serveur */
if (API && !internalOnly) {
  let ten = read('src/db/tenancy.js', API);
  if (!ten.includes(`key: '${key}'`)) {
    const debut = ten.indexOf('export const MODULE_CATALOGUE = [');
    const fin = ten.indexOf('\n];', debut);
    ten = ten.slice(0, fin) + `\n  {\n    key: '${key}',\n    label: '${label}',\n    summary: '${(summary ?? hint).replace(/'/g, '’')}',\n  },` + ten.slice(fin);
    write('src/db/tenancy.js', ten, API);
    fait.push('amn-api : MODULE_CATALOGUE');
  }
}

console.log(`Module « ${label} » (${key}) câblé :`);
for (const f of fait) console.log(`  · ${f}`);
console.log(`Reste à écrire : ${screenFile ?? screen} — puis npm run check:modules, check:persistence, check:langue.`);
