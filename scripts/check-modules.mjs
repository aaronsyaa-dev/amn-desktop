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
 * Et une cinquième chose, qui n'est pas une liste : LE RANGEMENT. Les quatre
 * contrôles ci-dessus comparent des clés, et ils étaient tous verts pendant que
 * l'édition Business montrait ses quinze modules en liste plate — le catalogue
 * déclarait ses sections, le lanceur les affichait, la barre latérale les
 * ignorait. Aucun module ne manquait ; c'est leur mise en ordre qui manquait à
 * un endroit sur trois. Voir le contrôle 5.
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

/*
  5. LE RANGEMENT, PAS SEULEMENT LA LISTE.

  Les contrôles 1 à 4 comparent des CLÉS. Ils étaient tous verts pendant que
  l'édition Business montrait ses quinze modules en liste plate : le catalogue
  déclarait bien ses sections, le lanceur les affichait, et la barre latérale —
  la seule surface qu'une cliente a en permanence sous les yeux — les ignorait
  et n'affichait qu'une bande d'épinglés. Un module ne manquait nulle part ;
  c'est le rangement qui manquait à un endroit sur trois, et aucune clé ne
  pouvait le dire.

  D'où deux règles de plus :
    a. les surfaces qui listent les modules d'une cliente doivent lire les
       SECTIONS, pas la liste aplatie ;
    b. le découpage de son application et celui du contexte de support doivent
       s'accorder — mêmes intitulés, mêmes modules, dans le même ordre. Sinon
       l'opérateur range mentalement ses écrans autrement qu'elle.
*/

/** `{ key: 'x', label: 'Y', items: [ … ] }` → groupes, dans l'ordre du fichier. */
function navGroups(source) {
  const groups = [];
  // Une SECTION porte `key` puis `label` sur la ligne suivante ; un MODULE
  // porte `key` … `to` sur une seule ligne. La borne `[^\n}]` est ce qui
  // distingue les deux — voir `navEntries`.
  const re = /key:\s*'([^']+)',\s*\n\s*label:\s*'([^']+)'|\{\s*key:\s*'([^']+)'[^\n}]*?to:\s*'([^']+)'/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    if (match[2] !== undefined) groups.push({ label: match[2], keys: [] });
    else if (groups.length > 0) groups[groups.length - 1].keys.push(match[3]);
  }
  return groups;
}

/** `{ label: 'Pilotage', keys: ['home', …] }` → la même forme. */
function keyGroups(source) {
  const groups = [];
  const re = /label:\s*'([^']+)',\s*keys:\s*\[([^\]]*)\]/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    groups.push({ label: match[1], keys: [...match[2].matchAll(/'([^']+)'/g)].map((m) => m[1]) });
  }
  return groups;
}

/*
  5a. Les surfaces lisent bien un découpage, et pas une liste aplatie.

  Deux moitiés, parce qu'une seule ne suffit pas : ce qu'il FAUT lire (les
  sections) et ce qu'il ne faut PAS lire. `NAV_ITEMS` et `itemsForSpace()` sont
  précisément les deux façons d'obtenir le catalogue à plat — c'est par
  `NAV_ITEMS` que la barre Business affichait sa bande d'épinglés sans jamais
  voir les sections que le catalogue déclarait pourtant.

  `\bNAV_ITEMS\b` et non la sous-chaîne : `CLIENT_NAV_ITEMS`, l'export que
  `ClientSidebar` destine à la barre du pouce, la contient sans être elle.
*/
for (const [fichier, requis, interdits] of [
  /*
    La barre de l'édition INTERNE a été la dernière à rejoindre cette liste, et
    c'est instructif : le catalogue déclarait ses six groupes depuis toujours,
    trois surfaces sur quatre les affichaient, et la quatrième — celle
    qu'Aaron a sous les yeux tous les jours — montrait une bande d'épinglés qui
    avait fini par contenir les dix-huit modules, à plat, sans un intitulé.
    Une règle qui ne couvre que les surfaces d'une édition laisse l'autre
    dériver.
  */
  ['src/components/Sidebar.tsx', ['sectionsForSpace(', 'section.label'], [/\bNAV_ITEMS\b/, /itemsForSpace\(/]],
  ['src/business/BusinessSidebar.tsx', ['sectionsForSpace(', 'section.label'], [/\bNAV_ITEMS\b/, /itemsForSpace\(/]],
  ['src/components/AppLauncher.tsx', ['sectionsForSpace(', 'section.label'], [/\bNAV_ITEMS\b/, /itemsForSpace\(/]],
  ['src/client-context/ClientSidebar.tsx', ['clientSections(', 'section.label'], [/\bNAV_ITEMS\b/, /itemsForSpace\(/]],
]) {
  const source = withoutComments(read(fichier));
  for (const marqueur of requis) {
    if (!source.includes(marqueur)) {
      failures.push(
        `${fichier} ne contient plus « ${marqueur} » : cette surface liste des modules et doit ` +
          `les RANGER en sections. Une liste plate y est déjà passée deux fois — côté cliente, ` +
          `puis côté interne — sans que rien ne le signale.`,
      );
    }
  }
  for (const interdit of interdits) {
    if (interdit.test(source)) {
      failures.push(
        `${fichier} lit le catalogue à plat (${interdit.source}) : cette surface doit passer ` +
          `par les sections, sinon on retrouve la liste plate que ce contrôle existe pour ` +
          `empêcher.`,
      );
    }
  }
}

// 5b. Son découpage et celui du support disent la même chose.
const businessGroups = navGroups(
  slice(businessSrc, 'export const NAV_SECTIONS', 'export const ACTIVITY_TABS'),
);
const clientGroups = keyGroups(slice(sidebarSrc, 'const CLIENT_SECTIONS', 'function clientModules'));

if (businessGroups.length === 0) failures.push('Aucune section lue dans modules.business.ts — le lecteur est cassé.');
if (clientGroups.length === 0) failures.push('Aucune section lue dans ClientSidebar.tsx — le lecteur est cassé.');

if (businessGroups.length > 0 && clientGroups.length > 0) {
  const attendus = businessGroups
    .map((g) => ({ label: g.label, keys: g.keys.filter((k) => !NOT_IN_SUPPORT.has(k)) }))
    .filter((g) => g.keys.length > 0);
  const decrire = (groups) => groups.map((g) => `${g.label} [${g.keys.join(', ')}]`).join(' · ');
  if (decrire(attendus) !== decrire(clientGroups)) {
    failures.push(
      `Le rangement du contexte de support ne reflète plus celui de l'édition Business.\n` +
        `      chez elle  : ${decrire(attendus)}\n` +
        `      en support : ${decrire(clientGroups)}`,
    );
  }
}

/*
  5c. Le même module porte le même NOM des deux côtés.

  L'agenda s'appelait « Agenda » chez elle et « Calendrier » en support : le
  même écran, deux mots. Au téléphone, quand elle décrit ce qu'elle voit,
  c'est le genre d'écart qui fait chercher un écran qui est sous les yeux.

  Les INTITULÉS seulement, pas les descriptions d'une ligne : celles-ci sont
  volontairement reformulées à la troisième personne en support (« Sa journée »
  contre « Votre journée »), et c'est juste.
*/
function navLabels(source) {
  const out = new Map();
  const re = /\{\s*key:\s*'([^']+)',\s*label:\s*'([^']+)'[^\n}]*?to:\s*'/g;
  let match;
  while ((match = re.exec(source)) !== null) out.set(match[1], match[2]);
  return out;
}

const businessLabels = navLabels(
  slice(businessSrc, 'export const NAV_SECTIONS', 'export const ACTIVITY_TABS'),
);
const clientLabels = navLabels(slice(sidebarSrc, 'const CLIENT_MODULES', 'export const CLIENT_NAV_ITEMS'));
for (const [key, label] of clientLabels) {
  const chezElle = businessLabels.get(key);
  if (chezElle && chezElle !== label) {
    failures.push(
      `« ${key} » s'appelle « ${chezElle} » dans son application et « ${label} » en support : ` +
        `le même écran porte deux noms selon qui le regarde.`,
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
  `\nModules : les catalogues et leur rangement s’accordent ` +
    `(${businessKeys.length} en Business, ${internalNav.length} en interne, ` +
    `${clientKeys.length} en support).`,
);
