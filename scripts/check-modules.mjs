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
/**
 * Les modules toujours ouverts — RELUS dans `src/data/spaces.ts`, jamais
 * recopiés ici.
 *
 * La première version de ce contrôle en tenait sa propre copie. La règle
 * existait donc dans le script et nulle part dans l'application : la section
 * « Personnel » passait le contrôle et ne s'affichait chez aucune cliente dont
 * les modules sont listés explicitement, puisque `isModuleEnabled` ne
 * connaissait que `home` et `settings`. Deux listes qui disent la même chose
 * finissent toujours par ne plus la dire.
 */
const ALWAYS_ON = (() => {
  const source = read('src/data/spaces.ts');
  const bloc = /export const ALWAYS_ON_MODULES = \[([\s\S]*?)\];/.exec(source);
  if (!bloc) {
    throw new Error(
      'ALWAYS_ON_MODULES est introuvable dans src/data/spaces.ts — ce contrôle lit cette ' +
        'liste-là et refuse d’en inventer une autre.',
    );
  }
  return new Set([...bloc[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));
})();

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
  /*
    Même raisonnement que le Coffre-fort, et le même défaut évité.

    « budget » lit `localStorage` sur LE POSTE : en session de support, il
    afficherait le solde bancaire de l'opérateur sous la bannière de la
    cliente. « courses » est une page de portée `personnel` — la liste de
    courses de quelqu'un n'a rien à faire dans un écran de supervision, même
    la sienne.

    Un écran qui ment sur ce qu'il montre est pire que son absence.
  */
  ['budget', 'chiffres personnels, locaux au poste — jamais ceux de la cliente'],
  ['courses', 'liste personnelle : ne regarde pas le support'],
  /*
    « members » lit et modifie les comptes de l'organisation de la SESSION :
    en support, ce serait ceux d'AMN DevSec sous la bannière de la cliente —
    le même défaut que la section Membres des Réglages, déjà masquée là-bas.
    Les comptes d'une cliente se gèrent depuis son dossier, dans la Tour.
  */
  ['members', 'comptes de la session, pas de la cliente : son dossier les gère'],
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

/**
 * Le CATALOGUE serveur : clé, intitulé, phrase. Lu en même temps que les clés
 * parce que les deux viennent maintenant du même endroit — `ORG_MODULES` est
 * dérivé de `MODULE_CATALOGUE` (amn-api), il ne peut donc plus en diverger.
 */
const apiCatalogue = (() => {
  // `AMN_API_ROOT` d'abord : en CI, `actions/checkout` ne sait écrire que
  // dans l'espace de travail, donc le dépôt voisin ne peut pas atterrir à
  // `../amn-api`. Voir scripts/api-root.mjs.
  for (const candidate of [process.env.AMN_API_ROOT, '/workspace/amn-api', path.join(ROOT, '..', 'amn-api')].filter(Boolean)) {
    const file = path.join(candidate, 'src/db/tenancy.js');
    if (!fs.existsSync(file)) continue;
    const source = withoutComments(fs.readFileSync(file, 'utf-8'));
    const bloc = /export const MODULE_CATALOGUE = \[([\s\S]*?)\n\];/.exec(source);
    if (!bloc) return null;
    const out = [];
    const re = /key:\s*'([^']+)',\s*label:\s*'([^']+)',\s*summary:\s*'([^']*)'/g;
    let m;
    while ((m = re.exec(bloc[1])) !== null) out.push({ key: m[1], label: m[2], summary: m[3] });
    return out;
  }
  return null;
})();

/**
 * Les CLÉS, dérivées du catalogue — comme côté serveur.
 *
 * `ORG_MODULES` n'est plus un littéral depuis le BLOC 4 : c'est
 * `MODULE_CATALOGUE.map(m => m.key)`. Le lire par expression régulière comme
 * une liste de chaînes rendait donc une liste vide, et ce script annonçait
 * « amn-api introuvable » alors qu'il l'avait bien lu — un contrôle qui se
 * saute lui-même en silence est pire qu'un contrôle absent.
 */
const apiModules = apiCatalogue ? apiCatalogue.map((entry) => entry.key) : null;

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
    if (ALWAYS_ON.has(key)) {
      failures.push(
        `« ${key} » est déclaré TOUJOURS OUVERT côté desktop (ALWAYS_ON) et pourtant présent ` +
          `dans ORG_MODULES (amn-api) : la console d'administration croit pouvoir le fermer, ` +
          `alors que l'écran resterait là. Choisir l'un des deux.`,
      );
      continue;
    }
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

/*
  6. UNE IDENTITÉ PAR MODULE, ET UNE SEULE SOURCE (BLOC 4)

  Ce qui a motivé ces règles est arrivé pendant le chantier précédent : le
  module « pages » a été déclaré dans ORG_MODULES, dans les deux catalogues
  d'édition, dans les deux tables de routes et dans la barre de support — et
  oublié dans `CONFIGURABLE_MODULES`. Les cinq contrôles ci-dessus sont restés
  verts, parce qu'aucun ne connaissait cette sixième liste. Conséquence
  concrète : l'atelier de création ne proposait pas le module, et
  `check:persistence` — qui énumère depuis CETTE liste — ne demandait donc
  jamais où vivait sa donnée. Un module invisible à deux contrôles sur trois.

  D'où deux règles de plus, et surtout un déplacement : l'identité d'un module
  (sa clé, son intitulé, sa phrase) vit désormais dans `MODULE_CATALOGUE` côté
  amn-api, et `ORG_MODULES` en est DÉRIVÉ. C'est le serveur qui arbitre, comme
  pour les modules ouverts ; le desktop s'y accorde.
*/
if (apiCatalogue) {
  // 6a. Chaque module a de quoi être nommé à quelqu'un qui ne connaît pas nos
  // clés. C'est la condition minimale pour qu'un module puisse un jour être
  // proposé, décrit, ou facturé : « orders » n'est pas un nom de produit.
  for (const entry of apiCatalogue) {
    if (!entry.label || entry.label.length < 2) {
      failures.push(`Le module « ${entry.key} » n'a pas d'intitulé lisible dans MODULE_CATALOGUE.`);
    }
    if (!entry.summary || entry.summary.length < 20) {
      failures.push(
        `Le module « ${entry.key} » n'a pas de phrase de description (ou elle est trop courte) : ` +
          `une cliente doit pouvoir comprendre ce qu'elle demande sans qu'on l'appelle.`,
      );
    }
  }
  if (apiModules && apiCatalogue.length !== apiModules.length) {
    failures.push(
      `MODULE_CATALOGUE (${apiCatalogue.length}) et ORG_MODULES (${apiModules.length}) ne ` +
        `décrivent pas le même nombre de modules — ORG_MODULES doit être DÉRIVÉ du catalogue, ` +
        `jamais recopié.`,
    );
  }

  /*
    6b. L'atelier de création propose exactement les modules qui existent.

    C'est la règle qui manquait. `CONFIGURABLE_MODULES` alimente l'atelier ET
    sert de point de départ à `check:persistence` : un module absent d'ici est
    à la fois impossible à ouvrir à la création et jamais interrogé sur l'endroit
    où il range sa donnée.
  */
  const source = withoutComments(read('src/data/tradeProfiles.ts'));
  const bloc = slice(source, 'export const CONFIGURABLE_MODULES', '];');
  const configurables = [...bloc.matchAll(/key:\s*'([^']+)',\s*label:\s*'([^']+)'/g)].map((m) => ({
    key: m[1],
    label: m[2],
  }));
  if (configurables.length === 0) {
    failures.push('Aucun module lu dans CONFIGURABLE_MODULES — le lecteur est cassé.');
  }
  const cles = new Set(configurables.map((m) => m.key));
  for (const entry of apiCatalogue) {
    if (!cles.has(entry.key)) {
      failures.push(
        `« ${entry.key} » existe côté serveur (MODULE_CATALOGUE) mais pas dans ` +
          `CONFIGURABLE_MODULES (src/data/tradeProfiles.ts) : l'atelier ne saurait pas l'ouvrir ` +
          `à une nouvelle cliente, et check:persistence ne demanderait jamais où vit sa donnée.`,
      );
    }
  }
  const connues = new Set(apiCatalogue.map((e) => e.key));
  for (const mod of configurables) {
    if (!connues.has(mod.key)) {
      failures.push(
        `« ${mod.key} » est proposé par l'atelier mais n'existe pas dans MODULE_CATALOGUE ` +
          `(amn-api) : le serveur refuserait la clé à la création.`,
      );
    }
  }
  // Le même module porte le même nom des deux côtés : « Facturation » ici et
  // « Factures » là est le genre d'écart qui fait chercher un écran au
  // téléphone (voir aussi le contrôle 5c).
  const parCle = new Map(apiCatalogue.map((e) => [e.key, e.label]));
  for (const mod of configurables) {
    const serveur = parCle.get(mod.key);
    if (serveur && serveur !== mod.label) {
      failures.push(
        `« ${mod.key} » s'appelle « ${serveur} » côté serveur et « ${mod.label} » dans ` +
          `l'atelier : la cliente lit l'un, nous parlons de l'autre.`,
      );
    }
  }
} else {
  notes.push('MODULE_CATALOGUE illisible — les contrôles d’identité de module sont sautés.');
}

/*
  7. LES MÉTIERS (BLOC 6)

  Trois listes, et elles servent à trois choses différentes :

    - `ORG_TRADES` (amn-api) : ce que le serveur ACCEPTE d'écrire. Un métier
      absent d'ici est refusé à la création, quoi qu'affiche l'atelier.
    - `TRADE_PROFILES` (src/data/tradeProfiles.ts) : ce que l'atelier PROPOSE.
      Un métier proposé mais inconnu du serveur fait échouer la création après
      coup, alors que tout paraissait bien rempli.
    - `PAR_METIER` (src/lib/roleLabels.ts) : les intitulés de rôle. Un métier
      sans intitulés n'est pas une panne — on retombe sur les génériques — mais
      c'est le geste qu'on oublie, et le résultat est une cliente à qui l'on
      avait promis sa langue et qui lit la nôtre.
*/
const tradesApi = (() => {
  // `AMN_API_ROOT` d'abord : en CI, `actions/checkout` ne sait écrire que
  // dans l'espace de travail, donc le dépôt voisin ne peut pas atterrir à
  // `../amn-api`. Voir scripts/api-root.mjs.
  for (const candidate of [process.env.AMN_API_ROOT, '/workspace/amn-api', path.join(ROOT, '..', 'amn-api')].filter(Boolean)) {
    const file = path.join(candidate, 'src/db/tenancy.js');
    if (!fs.existsSync(file)) continue;
    const bloc = /export const ORG_TRADES = \[([\s\S]*?)\];/.exec(
      withoutComments(fs.readFileSync(file, 'utf-8')),
    );
    if (!bloc) return null;
    return [...bloc[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  }
  return null;
})();

if (tradesApi) {
  const profils = [...withoutComments(read('src/data/tradeProfiles.ts')).matchAll(/^\s*id: '([^']+)',$/gm)]
    .map((m) => m[1]);
  if (profils.length === 0) failures.push('Aucun métier lu dans TRADE_PROFILES — le lecteur est cassé.');

  for (const id of profils) {
    if (!tradesApi.includes(id)) {
      failures.push(
        `Le métier « ${id} » est proposé par l'atelier mais absent d'ORG_TRADES (amn-api) : ` +
          `la création serait refusée après que tout a été rempli.`,
      );
    }
  }
  for (const id of tradesApi) {
    if (!profils.includes(id)) {
      failures.push(
        `Le métier « ${id} » est accepté par le serveur mais n'existe dans aucun profil de ` +
          `l'atelier : rien ne permettrait de le choisir.`,
      );
    }
  }

  const labels = withoutComments(read('src/lib/roleLabels.ts'));
  const bloc = slice(labels, 'const PAR_METIER', '\n};');
  const avecLibelles = [...bloc.matchAll(/^\s{2}([a-zA-Z]+):\s*\{/gm)].map((m) => m[1]);
  for (const id of tradesApi) {
    if (!avecLibelles.includes(id)) {
      failures.push(
        `Le métier « ${id} » n'a pas d'intitulés de rôle dans src/lib/roleLabels.ts : ses ` +
          `comptes s'afficheraient « Propriétaire » et « Membre » alors que tout l'intérêt du ` +
          `métier est de dire « Gérante » et « Vendeur ».`,
      );
    }
  }
} else {
  notes.push('ORG_TRADES illisible — les contrôles de métier sont sautés.');
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
