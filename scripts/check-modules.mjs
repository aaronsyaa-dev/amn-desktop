#!/usr/bin/env node
/**
 * Contrôle de cohérence des MODULES, sur les quatre listes qui doivent
 * s'accorder — et qui, jusqu'ici, ne s'accordaient pas.
 *
 * Le défaut qui a motivé ce script : les modules Dépenses et Temps ont été
 * ajoutés au catalogue Business et à la table de routes du contexte client,
 * mais pas à la barre latérale de ce contexte. Résultat, pendant une session
 * de support, l'opérateur ne voyait PAS deux écrans que la cliente a pourtant
 * chez elle — alors que le fichier dit lui-même, en toutes lettres, que
 * l'opérateur doit voir exactement ce qu'elle voit. Rien n'a échoué, rien n'a
 * prévenu ; le module manquait simplement d'un endroit sur quatre.
 *
 * Les quatre listes :
 *
 *   1. `ORG_MODULES` (amn-api) — ce que la console d'administration sait
 *      ouvrir ou fermer. C'est le serveur qui arbitre.
 *   2. `NAV_SECTIONS` de `modules.business.ts` — les écrans que l'édition
 *      Business connaît.
 *   3. La table de routes de `appRoot.business.tsx` — un module listé sans
 *      route mène à une redirection silencieuse vers l'accueil.
 *   4. `CLIENT_MODULES` de `ClientSidebar.tsx` et la table
 *      `ClientContextRoutes` — ce que voit l'opérateur en support.
 *
 * Ce que ce contrôle N'EST PAS : une frontière de sécurité. Un module fermé
 * retire un écran ; l'isolation des données reste celle d'amn-api, par
 * `org_id`. Ce script vérifie la cohérence de l'affichage, rien d'autre.
 *
 *   node scripts/check-modules.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const notes = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

/**
 * Toujours ouverts, jamais négociables : une organisation sans accueil ni
 * paramètres n'est pas dégradée, elle est cassée. Ils n'ont donc rien à faire
 * dans `ORG_MODULES`, et leur absence n'est pas une divergence.
 */
const ALWAYS_ON = new Set(['home', 'settings']);

/**
 * Absents du contexte de support, volontairement.
 *
 * `vault` : le Coffre-fort est LOCAL au poste et n'est jamais synchronisé (voir
 * `VaultEntry` dans shared/api.ts). L'afficher dans la barre de la cliente
 * montrerait le coffre-fort de l'opérateur au milieu des écrans de la cliente —
 * un écran qui ment sur ce qu'il montre, ce qui est pire que son absence.
 */
const NOT_IN_SUPPORT = new Map([
  ['vault', 'coffre-fort local au poste, jamais celui de la cliente'],
]);

/* ---------------------------------------------------------------- lecture -- */

/**
 * `{ key: 'x', … to: '/y' }` → paires clé/chemin, dans l'ordre du fichier.
 *
 * `[^\n}]` et non `[^}]` : une SECTION porte elle aussi une `key` (« travail »,
 * « systeme ») et ouvre ensuite `items: [`. Sans la borne de fin de ligne, la
 * clé de la section s'appariait au `to:` du premier module de la section, et le
 * contrôle réclamait une route pour un intitulé de rubrique.
 */
function navEntries(source) {
  const out = [];
  const re = /\{\s*key:\s*'([^']+)'[^\n}]*?to:\s*'([^']+)'/g;
  let match;
  while ((match = re.exec(source)) !== null) out.push({ key: match[1], to: match[2] });
  return out;
}

/**
 * Les commentaires retirés avant toute lecture de littéraux.
 *
 * Les commentaires de ces dépôts sont rédigés en français, où l'apostrophe est
 * le même caractère que le guillemet simple de JavaScript : « l'inverse » se
 * lisait comme une chaîne, et une phrase entière remontait comme un nom de
 * module inconnu.
 */
function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Les blocs `<Route …>` d'une table, un par chemin déclaré. */
function routeBlocks(table) {
  const parts = table.split(/(?=path=")/g);
  const out = [];
  for (const part of parts) {
    const at = /^path="([^"]+)"/.exec(part);
    if (at) out.push({ to: at[1], body: part });
  }
  return out;
}

/** Le corps d'une fonction/déclaration, du nom donné jusqu'au marqueur de fin. */
function slice(source, from, to) {
  const start = source.indexOf(from);
  if (start === -1) return '';
  const end = to ? source.indexOf(to, start + from.length) : -1;
  return source.slice(start, end === -1 ? source.length : end);
}

const apiModules = (() => {
  for (const candidate of ['/workspace/amn-api', path.join(ROOT, '..', 'amn-api')]) {
    const file = path.join(candidate, 'src/db/tenancy.js');
    if (!fs.existsSync(file)) continue;
    const block = /export const ORG_MODULES = \[([\s\S]*?)\];/.exec(
      withoutComments(fs.readFileSync(file, 'utf-8')),
    );
    if (!block) return null;
    return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  }
  return null;
})();

const businessSrc = withoutComments(read('src/edition/modules.business.ts'));
const businessNav = navEntries(slice(businessSrc, 'export const NAV_SECTIONS', 'export const ACTIVITY_TABS'));
const businessRoutes = read('src/edition/appRoot.business.tsx');

const internalSrc = withoutComments(read('src/edition/modules.internal.ts'));
const internalNav = navEntries(slice(internalSrc, 'export const NAV_SECTIONS', 'export const AJMANI_EMAIL'));
const internalRoutes = read('src/edition/appRoot.internal.tsx');
const amnRouteTable = slice(internalRoutes, 'function AmnRoutes', 'function ClientContextRoutes');
const clientRouteTable = slice(internalRoutes, 'function ClientContextRoutes', null);

const sidebarSrc = withoutComments(read('src/client-context/ClientSidebar.tsx'));
const clientNav = navEntries(slice(sidebarSrc, 'const CLIENT_MODULES', 'export const CLIENT_NAV_ITEMS'));

/* --------------------------------------------------------------- contrôles -- */

if (businessNav.length === 0) failures.push('Aucun module lu dans modules.business.ts — le lecteur est cassé.');
if (clientNav.length === 0) failures.push('Aucun module lu dans ClientSidebar.tsx — le lecteur est cassé.');
if (internalNav.length === 0) failures.push('Aucun module lu dans modules.internal.ts — le lecteur est cassé.');

// 1. Le catalogue Business et ORG_MODULES décrivent le même produit.
if (apiModules) {
  for (const { key } of businessNav) {
    if (ALWAYS_ON.has(key)) continue;
    if (!apiModules.includes(key)) {
      failures.push(
        `« ${key} » est un module de l'édition Business mais n'est pas dans ORG_MODULES ` +
          `(amn-api/src/db/tenancy.js) : impossible de le fermer pour une organisation, ` +
          `la console d'administration refusera la clé.`,
      );
    }
  }
  for (const key of apiModules) {
    if (!businessNav.some((entry) => entry.key === key)) {
      failures.push(
        `« ${key} » est dans ORG_MODULES (amn-api) mais n'existe dans aucun catalogue du ` +
          `desktop : l'ouvrir pour une organisation n'afficherait rien.`,
      );
    }
  }
} else {
  notes.push('amn-api introuvable localement — comparaison avec ORG_MODULES sautée.');
}

// 2. Un module annoncé doit avoir sa route, sinon il redirige vers l'accueil.
for (const [label, nav, table] of [
  ['édition Business', businessNav, businessRoutes],
  ['édition interne', internalNav, amnRouteTable],
  ['contexte client (support)', clientNav, clientRouteTable],
]) {
  for (const { key, to } of nav) {
    if (to === '/') continue; // l'accueil est monté à part dans chaque table
    if (!table.includes(`path="${to}"`)) {
      failures.push(
        `${label} : le module « ${key} » pointe vers ${to}, qui n'a pas de route — ` +
          `le clic ramène à l'accueil sans rien dire.`,
      );
    }
  }
}

// 3. Une route protégée par ModuleRoute doit l'être avec la clé du catalogue.
for (const [label, nav, table] of [
  ['édition Business', businessNav, businessRoutes],
  ['contexte client (support)', clientNav, clientRouteTable],
]) {
  const blocks = routeBlocks(table);
  for (const { key, to } of nav) {
    if (ALWAYS_ON.has(key) || to === '/') continue;
    // Le bloc de CETTE route, et pas un empan de caractères : sans la
    // découpe, `path="/settings"` allait chercher le `module=` de la route
    // suivante et déclarait une protection qui n'existait pas.
    const block = blocks.find((b) => b.to === to);
    const route = block ? /module="([^"]+)"/.exec(block.body) : null;
    if (!route) {
      failures.push(
        `${label} : la route ${to} n'est pas protégée par <ModuleRoute> — fermer le module ` +
          `« ${key} » retirerait l'entrée de la barre mais laisserait l'écran atteignable ` +
          `par un onglet mémorisé.`,
      );
    } else if (route[1] !== key) {
      failures.push(
        `${label} : la route ${to} est protégée par le module « ${route[1] }» alors que le ` +
          `catalogue l'annonce sous « ${key} » — fermer l'un n'aurait aucun effet sur l'autre.`,
      );
    }
  }
}

// 4. Le support voit ce que voit la cliente. LE contrôle qui manquait.
const businessKeys = businessNav.map((e) => e.key);
const clientKeys = clientNav.map((e) => e.key);

for (const key of businessKeys) {
  if (clientKeys.includes(key)) continue;
  const reason = NOT_IN_SUPPORT.get(key);
  if (reason) continue; // exclusion documentée, voir NOT_IN_SUPPORT
  failures.push(
    `« ${key} » existe chez la cliente (catalogue Business) mais pas dans CLIENT_MODULES ` +
      `(ClientSidebar.tsx) : en support, l'opérateur ne verrait pas un écran qu'elle a. ` +
      `L'ajouter, ou l'exclure explicitement dans NOT_IN_SUPPORT avec sa raison.`,
  );
}

for (const key of clientKeys) {
  if (!businessKeys.includes(key)) {
    failures.push(
      `« ${key} » est dans la barre du contexte client mais pas dans le catalogue Business : ` +
        `l'opérateur verrait un écran que la cliente n'a pas — le contexte de support cesse ` +
        `alors de refléter son application.`,
    );
  }
  if (NOT_IN_SUPPORT.has(key)) {
    failures.push(
      `« ${key} » est listé dans NOT_IN_SUPPORT (${NOT_IN_SUPPORT.get(key)}) et pourtant ` +
        `présent dans CLIENT_MODULES : l'exclusion et la barre se contredisent.`,
    );
  }
}

/* ---------------------------------------------------------------- verdict -- */

for (const note of notes) console.log(`  note  ${note}`);

if (failures.length > 0) {
  console.error('\nModules : incohérences trouvées.\n');
  for (const failure of failures) console.error(`  ✗ ${failure}\n`);
  process.exit(1);
}

console.log(
  `\nModules : les catalogues s'accordent ` +
    `(${businessKeys.length} en Business, ${internalNav.length} en interne, ` +
    `${clientKeys.length} en support).`,
);
