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
  for (const candidate of ['/workspace/amn-api', path.join(ROOT, '..', 'amn-api')]) {
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
function offerableModules() {
  const src = read('src/data/tradeProfiles.ts');
  const start = src.indexOf('CONFIGURABLE_MODULES');
  const block = src.slice(start, src.indexOf('];', start));
  return [...block.matchAll(/\{ key: '([a-zA-Z]+)'/g)].map((m) => m[1]);
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
  orders: ['orders'],
  notes: ['notes'],
  media: ['media'],
  reports: ['reports'],
  vault: [], // Déclaré local ci-dessous.
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
