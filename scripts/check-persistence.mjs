#!/usr/bin/env node
/**
 * OÙ VIT LA DONNÉE D'UN MODULE — le contrôle qui manquait
 * ═══════════════════════════════════════════════════════
 *
 * Ce dépôt a déjà perdu des données lors d'une mise à jour : la photo de profil,
 * qui existait en DEUX implémentations — une locale au poste, une côté serveur.
 * Le correctif d'alors a réparé ce cas-là. Rien ne garantissait qu'il n'y en
 * avait pas d'autres, ni qu'il n'en réapparaîtrait jamais.
 *
 * C'est ce que ce script vérifie, et il le vérifie DE FAÇON EXÉCUTABLE :
 *
 *   pour chaque module qu'on peut ouvrir à une cliente, la donnée qu'il produit
 *   doit avoir UNE seule source de vérité — le serveur.
 *
 * Un module dont la donnée vit ailleurs (base locale du poste, localStorage du
 * navigateur) a trois défauts qu'une cliente non technique ne peut ni prévoir
 * ni comprendre :
 *
 *   1. son téléphone et son ordinateur montrent des contenus DIFFÉRENTS, sans
 *      que rien ne l'annonce ;
 *   2. une réinstallation, un changement de machine ou un nettoyage de profil
 *      efface tout, définitivement et sans avertissement ;
 *   3. l'export de portabilité (RGPD) ne le contient pas — il ne connaît que ce
 *      que le serveur détient.
 *
 * Un module qui ne peut pas encore être synchronisé n'est donc PAS interdit :
 * il doit être déclaré ci-dessous, avec sa raison. Le script le rappelle à
 * chaque exécution. Ce qui est interdit, c'est de l'oublier.
 *
 *   node scripts/check-persistence.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/**
 * Le dépôt amn-api voisin. Deux emplacements sont essayés, et l'ordre compte :
 * une copie périmée traîne parfois à côté du desktop, et la lire ferait échouer
 * ce contrôle sur des collections qui existent bel et bien. Même résolution que
 * `check-sync-parity.mjs`, pour que les deux scripts ne puissent pas lire deux
 * vérités différentes.
 */
function findApiRoot() {
  // `AMN_API_ROOT` d'abord : en CI, `actions/checkout` ne sait écrire que
  // dans l'espace de travail, donc le dépôt voisin ne peut pas atterrir à
  // `../amn-api`. Voir scripts/api-root.mjs.
  for (const candidate of [process.env.AMN_API_ROOT, '/workspace/amn-api', path.join(ROOT, '..', 'amn-api')].filter(Boolean)) {
    if (fs.existsSync(path.join(candidate, 'src/routes/collections.js'))) return candidate;
  }
  return null;
}
const failures = [];
const notes = [];

function read(rel, base = ROOT) {
  return fs.readFileSync(path.join(base, rel), 'utf-8');
}

/* ------------------ 1. Ce que le serveur accepte réellement ---------------- */

function allowedCollections() {
  const src = read('src/routes/collections.js', API);
  const start = src.indexOf('const ALLOWED');
  const block = src.slice(start, src.indexOf(']);', start));
  // Uniquement les entrées de la liste, pas les mots des commentaires.
  return new Set([...block.matchAll(/^\s*'([a-zA-Z]+)',/gm)].map((m) => m[1]));
}

/* ------------- 2. Les modules ouvrables à une cliente, et leur donnée ------- */

/**
 * Le catalogue proposé à la création (voir src/data/tradeProfiles.ts). Lu dans
 * le fichier plutôt que recopié : un module ajouté là-bas entre
 * automatiquement dans ce contrôle, ce qui est tout l'intérêt.
 */
/**
 * Les modules qu'une cliente peut avoir sous les yeux.
 *
 * Deux sources, et la seconde a été ajoutée parce qu'elle manquait : les
 * modules TOUJOURS OUVERTS (`ALWAYS_ON_MODULES`, src/data/spaces.ts) n'ont pas
 * de clé serveur — un bonus inclus n'a pas d'interrupteur — et échappaient donc
 * à cette énumération, qui partait de `CONFIGURABLE_MODULES`. Le module
 * Personnel, dont le budget vit en `localStorage`, n'aurait jamais été
 * interrogé sur l'endroit où il range sa donnée. Or c'est exactement le cas
 * que ce script existe pour ne pas laisser passer : la question n'est pas
 * « ce module se vend-il ? », c'est « quelqu'un perdra-t-il quelque chose ? ».
 *
 * `home` et `settings` sont écartés : ce sont des écrans de l'application, pas
 * des modules qui produisent une donnée à eux.
 */
function offerableModules() {
  const src = read('src/data/tradeProfiles.ts');
  const start = src.indexOf('CONFIGURABLE_MODULES');
  const block = src.slice(start, src.indexOf('];', start));
  const configurables = [...block.matchAll(/\{ key: '([a-zA-Z]+)'/g)].map((m) => m[1]);

  const spaces = read('src/data/spaces.ts');
  const bloc = /export const ALWAYS_ON_MODULES = \[([\s\S]*?)\];/.exec(spaces);
  if (!bloc) {
    failures.push(
      'ALWAYS_ON_MODULES est introuvable dans src/data/spaces.ts — les modules toujours ' +
        'ouverts ne seraient pas interrogés sur l’endroit où vit leur donnée.',
    );
    return configurables;
  }
  const toujours = [...bloc[1].matchAll(/'([^']+)'/g)]
    .map((m) => m[1])
    .filter((key) => key !== 'home' && key !== 'settings');
  return [...configurables, ...toujours];
}

/**
 * La donnée que produit chaque module, déclarée à la main — et c'est voulu.
 *
 * On pourrait la déduire des `useCollection(...)` de chaque écran ; ce serait
 * plus court et plus fragile, parce qu'un module qui écrirait SANS passer par
 * la synchronisation (le défaut même qu'on traque) n'apparaîtrait nulle part.
 * Une déclaration explicite oblige à répondre pour chaque module, y compris
 * ceux qui n'écrivent rien.
 */
const MODULE_DATA = {
  agenda: ['appointments'],
  clients: ['clients', 'quotes'],
  invoices: ['invoices', 'billing'],
  projects: ['projects', 'projectConfig'],
  tasks: ['tasks'],
  expenses: ['expenses', 'expenseConfig'],
  time: ['timeEntries', 'timeConfig'],
  calculators: [], // Un moteur de calcul : il lit, il ne stocke rien.
  members: [], // Les comptes vivent chez amn-api (users, invitations) : l'écran lit et écrit par l'API, rien de local.
  assistance: [], // Les demandes vivent chez amn-api (support_requests) : lues et écrites par l'API, rien de local.
  orders: ['orders'],
  evenements: ['evenements'],
  notes: ['notes'],
  pages: ['pages'],
  media: ['media'],
  reports: ['reports'],
  vault: [], // Déclaré local ci-dessous.
  // Module Personnel (BLOC 2). `courses` roule sur la collection `pages` — la
  // liste de courses s'écrit au bureau et se relit dans le magasin, donc elle
  // se synchronise. `budget` ne stocke RIEN sur le serveur, délibérément :
  // déclaré local ci-dessous.
  courses: ['pages'],
  budget: [],
  library: [], // La Bibliothèque lit les catalogues ; Découvrir lit le catalogue serveur. Rien d'écrit.
  discover: [],
};

/**
 * OÙ CHAQUE MODULE EST ÉCRIT — pour aller regarder DANS le code, pas seulement
 * dans la liste des collections.
 *
 * La première règle de ce script vérifie qu'un module a bien une collection
 * côté serveur. Elle ne dit rien du cas le plus fourbe : un module qui a sa
 * collection ET, en plus, écrit une partie de sa donnée dans le stockage du
 * navigateur. C'est littéralement ce qui est arrivé à la photo de profil, et
 * ce qui a été retrouvé ici dans les notes — la note « personnelle » partait
 * en `localStorage`, donc invisible depuis le téléphone et effacée par une
 * réinstallation, sans que rien à l'écran ne la distingue des autres.
 *
 * D'où cette seconde règle : les fichiers qui portent un module ne peuvent pas
 * écrire dans le stockage local sans être déclarés ci-dessous.
 */
const MODULE_FILES = {
  library: ['src/screens/LibraryScreen.tsx', 'src/components/ModuleGrid.tsx'],
  discover: ['src/screens/LibraryScreen.tsx', 'src/components/ModuleGrid.tsx'],
  agenda: ['src/business/AgendaScreen.tsx', 'src/state/useAppointments.ts'],
  clients: ['src/screens/ClientsScreen.tsx', 'src/state/useClients.ts'],
  invoices: ['src/screens/InvoicesScreen.tsx', 'src/state/useInvoices.ts'],
  projects: ['src/screens/ProjectsScreen.tsx', 'src/state/useProjects.ts'],
  tasks: ['src/screens/TasksScreen.tsx'],
  expenses: ['src/screens/ExpensesScreen.tsx', 'src/state/useExpenses.ts'],
  time: ['src/screens/TimeScreen.tsx', 'src/state/useTimeTracking.ts'],
  calculators: ['src/screens/CalculatorsScreen.tsx'],
  members: ['src/screens/MembersScreen.tsx', 'src/components/settings/MembersSection.tsx'],
  assistance: ['src/screens/AssistanceScreen.tsx'],
  orders: ['src/screens/OrdersScreen.tsx', 'src/state/useOrders.ts'],
  evenements: [
    'src/screens/EventsScreen.tsx',
    'src/state/useEvenements.ts',
    'src/state/eventEngine.ts',
  ],
  notes: ['src/screens/NotesScreen.tsx', 'src/state/useNotes.ts'],
  pages: ['src/screens/PagesScreen.tsx', 'src/lib/pageBlocks.ts'],
  media: ['src/business/MediaSoloScreen.tsx', 'src/screens/MediaLibraryScreen.tsx'],
  reports: ['src/screens/ReportsScreen.tsx', 'src/state/useReports.ts'],
  vault: ['src/screens/VaultScreen.tsx', 'src/state/useVault.ts'],
  courses: ['src/screens/PagesScreen.tsx', 'src/lib/pageBlocks.ts'],
  budget: ['src/screens/PersonalBudgetScreen.tsx', 'src/state/usePersonalBudget.ts'],
};

/**
 * Les écritures locales admises DANS un fichier de module, et leur raison.
 *
 * Une entrée ici n'est pas un laissez-passer : c'est une dette qu'on relit. Le
 * nombre d'écritures est compté, donc en ajouter une nouvelle dans un fichier
 * déjà déclaré fait échouer le contrôle tant qu'on n'a pas dit pourquoi.
 */
const ECRITURES_LOCALES_ADMISES = {
  'src/state/usePersonalBudget.ts': {
    nombre: 1,
    raison:
      'le module Personnel est déclaré LOCAL_ONLY, et cette écriture EST la façon dont il ' +
      'l’est. La déclarer ici plutôt que d’exempter le fichier : le nombre est compté, donc ' +
      'une seconde écriture — un jour où l’on voudrait y ranger autre chose — fera échouer ' +
      'le contrôle tant que personne n’aura dit pourquoi.',
  },
  'src/state/useNotes.ts': {
    nombre: 1,
    raison:
      'la note PERSONNELLE de l’édition interne, qui ne peut pas passer par la ' +
      'collection partagée sans être diffusée à l’autre opérateur. Fermée dans ' +
      'l’édition Business (IS_BUSINESS force la portée « équipe »), où la ' +
      'cliente est seule et où le compromis n’achèterait donc rien.',
  },
};

/**
 * LES EXCEPTIONS, ET POURQUOI ELLES EN SONT.
 *
 * Tout ce qui figure ici est un module dont la donnée NE VIT PAS sur le
 * serveur. Chaque entrée doit dire pourquoi, et ce que la cliente doit en
 * savoir. Le script les affiche à chaque exécution : on ne peut donc pas les
 * oublier, seulement décider de les garder.
 */
const LOCAL_ONLY = {
  budget: {
    raison:
      'un solde bancaire et une date de paie. Les enregistrements synchronisés sont ' +
      'isolés PAR ORGANISATION, jamais par personne : dans une organisation à plusieurs, ' +
      'qui l’administre pourrait les lire. Le module s’appelle « Personnel » ; le tenir ' +
      'sur le poste est ce qui rend ce nom vrai.',
    consequence:
      'ces chiffres ne suivent pas sur le téléphone, sont perdus si la machine est ' +
      'réinstallée, et sont absents de l’export de portabilité. En contrepartie, ils ' +
      'ne sont lisibles par personne d’autre.',
    ecranPrevient: 'src/screens/PersonalBudgetScreen.tsx',
  },
  vault: {
    raison:
      'chiffré par le trousseau du système d’exploitation (Electron safeStorage), ' +
      'donc par une clé qui n’existe que sur CETTE machine et ne peut pas voyager. ' +
      'Le synchroniser demanderait un chiffrement par phrase secrète côté client — ' +
      'une vraie fonctionnalité, pas un raccourci.',
    consequence:
      'contenu différent entre téléphone et ordinateur, perdu si la machine est ' +
      'réinstallée, et absent de l’export de portabilité.',
    ecranPrevient: 'src/screens/VaultScreen.tsx',
  },
};

/* --------------------------------- Contrôle -------------------------------- */

const API = findApiRoot();
if (!API) {
  // Sans amn-api sous la main, ce contrôle ne peut rien affirmer. Il le DIT et
  // sort proprement, plutôt que de passer pour vert.
  console.log('NOTE  dépôt amn-api introuvable — contrôle de persistance sauté.');
  process.exit(0);
}

const allowed = allowedCollections();
const modules = offerableModules();

if (allowed.size === 0) failures.push('Impossible de lire la liste ALLOWED d’amn-api.');
if (modules.length === 0) failures.push('Impossible de lire CONFIGURABLE_MODULES.');

for (const mod of modules) {
  if (!(mod in MODULE_DATA)) {
    failures.push(
      `Module « ${mod} » proposé aux clientes mais absent de MODULE_DATA : ` +
        'déclarez la donnée qu’il produit, ou l’absence de donnée.',
    );
    continue;
  }

  const collections = MODULE_DATA[mod];
  for (const collection of collections) {
    if (!allowed.has(collection)) {
      failures.push(
        `Module « ${mod} » : la collection « ${collection} » n’est PAS acceptée par amn-api. ` +
          'Sa donnée ne quitterait jamais le poste — elle serait perdue à la première ' +
          'réinstallation et invisible depuis le téléphone.',
      );
    }
  }

  if (collections.length === 0 && !(mod in LOCAL_ONLY)) {
    notes.push(`Module « ${mod} » ne produit aucune donnée persistante — rien à synchroniser.`);
  }
}

/*
  RÈGLE 2 — aucun module n'écrit sa donnée dans le stockage du navigateur.

  Le stockage local n'est pas interdit partout : un onglet mémorisé, un rappel
  déjà émis, le miroir hors-ligne de SyncContext y ont leur place. Il est
  interdit DANS les fichiers qui portent un module métier, parce que là il
  devient une seconde source de vérité que le serveur ignore.
*/
const ECRITURE_LOCALE = /(localStorage|sessionStorage)\s*\.\s*setItem/g;

for (const mod of modules) {
  const fichiers = MODULE_FILES[mod];
  if (!fichiers) {
    failures.push(
      `Module « ${mod} » n’a pas de fichiers déclarés dans MODULE_FILES : ` +
        'impossible de vérifier qu’il n’écrit pas sa donnée en local.',
    );
    continue;
  }
  for (const rel of fichiers) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) {
      // Un fichier renommé ferait passer le contrôle sans rien vérifier :
      // c'est le silence qu'on refuse, pas le renommage.
      failures.push(`Module « ${mod} » : ${rel} est déclaré mais introuvable (renommé ?).`);
      continue;
    }
    const src = fs.readFileSync(abs, 'utf-8');
    const ecritures = [...src.matchAll(ECRITURE_LOCALE)].length;
    if (ecritures === 0) continue;

    const admis = ECRITURES_LOCALES_ADMISES[rel];
    if (!admis) {
      failures.push(
        `Module « ${mod} » : ${rel} écrit dans le stockage local (${ecritures} fois). ` +
          'Cette donnée-là ne partirait jamais sur le serveur — invisible depuis le ' +
          'téléphone, perdue à la réinstallation, absente de l’export. Déplacez-la ' +
          'vers une collection synchronisée, ou déclarez-la dans ECRITURES_LOCALES_ADMISES.',
      );
    } else if (ecritures !== admis.nombre) {
      failures.push(
        `Module « ${mod} » : ${rel} écrit dans le stockage local ${ecritures} fois, ` +
          `${admis.nombre} étai(en)t déclarée(s). Une écriture a été ajoutée — dites laquelle et pourquoi.`,
      );
    }
  }
}

/* Une exception doit rester justifiée ET prévenir la cliente à l'écran. */
for (const [mod, info] of Object.entries(LOCAL_ONLY)) {
  if (!modules.includes(mod)) {
    notes.push(`« ${mod} » n’est plus proposé aux clientes : son exception peut être retirée.`);
    continue;
  }
  const ecran = path.join(ROOT, info.ecranPrevient);
  if (!fs.existsSync(ecran)) {
    failures.push(`« ${mod} » : l’écran censé prévenir (${info.ecranPrevient}) est introuvable.`);
    continue;
  }
  const src = fs.readFileSync(ecran, 'utf-8');
  // L'avertissement doit être VISIBLE, donc dans du texte rendu — pas seulement
  // dans un commentaire de code que la cliente ne lira jamais.
  const sansCommentaires = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  if (!/cet (appareil|ordinateur)|cette machine|reste sur/i.test(sansCommentaires)) {
    failures.push(
      `« ${mod} » : sa donnée est locale, mais ${info.ecranPrevient} ne le dit pas à l’écran. ` +
        'Une cliente non technique supposera que tout est sauvegardé comme le reste.',
    );
  }
}

/* --------------------------------- Rapport --------------------------------- */

for (const note of notes) console.log(`NOTE  ${note}`);

if (Object.keys(LOCAL_ONLY).length > 0) {
  console.log('');
  console.log('DONNÉES QUI NE QUITTENT PAS LE POSTE — à relire à chaque livraison :');
  for (const [mod, info] of Object.entries(LOCAL_ONLY)) {
    console.log(`  · ${mod} — ${info.raison}`);
    console.log(`    conséquence : ${info.consequence}`);
  }
}

console.log('');
if (failures.length > 0) {
  for (const f of failures) console.error(`ÉCHEC ${f}`);
  console.error('');
  console.error(`${failures.length} problème(s) de persistance.`);
  process.exit(1);
}

console.log(
  `OK — les ${modules.length} modules ouvrables à une cliente ont leur donnée sur le serveur, ` +
    `sauf ${Object.keys(LOCAL_ONLY).length} exception(s) déclarée(s) et annoncée(s) à l’écran.`,
);
console.log(
  `OK — aucun de leurs fichiers n’écrit de donnée métier dans le stockage du navigateur, ` +
    `sauf ${Object.keys(ECRITURES_LOCALES_ADMISES).length} écriture(s) justifiée(s).`,
);
