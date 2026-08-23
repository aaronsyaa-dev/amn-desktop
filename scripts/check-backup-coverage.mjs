#!/usr/bin/env node
/**
 * Garde-fou de la sauvegarde.
 *
 * Le bug corrigé ici avait tenu des mois sans rien casser : `collectBackup`
 * tenait SA PROPRE liste de collections, recopiée à la main. Le produit en a
 * gagné douze de plus, la liste n'a pas suivi, et l'export a continué de
 * s'afficher « Exporté » en ne ramenant que neuf collections sur vingt et une.
 * Pire, six de ces neuf étaient lues dans les magasins d'AVANT la migration
 * (`api.tasks.list()` et compagnie), donc vides ou périmées sur un poste à
 * jour.
 *
 * Une liste recopiée ne se garde pas, elle se supprime : `collectBackup`
 * dérive maintenant de `SYNCED_COLLECTIONS`. Ce script vérifie que cette
 * propriété tient encore, parce qu'elle est facile à défaire sans le vouloir.
 *
 *   1. backup.ts importe SYNCED_COLLECTIONS et ne tient aucune liste à lui.
 *   2. backup.ts ne lit aucun magasin hérité (le bug d'origine).
 *   3. Un chemin de restauration existe ET l'écran l'appelle — un export qu'on
 *      ne peut pas relire n'est pas une sauvegarde, c'est un fichier.
 *   4. L'écran ne promet pas une « copie complète » sans dire ce qui manque.
 *
 * Ce que ce script NE voit PAS : si amn-api refuse une collection à
 * l'exécution. C'est `check-sync-parity.mjs` avec sa sonde runtime qui le dit.
 *
 * Usage :  node scripts/check-backup-coverage.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const notes = [];
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

const backup = read('src/lib/backup.ts');
const settings = read('src/screens/SettingsScreen.tsx');
const sync = read('src/state/SyncContext.tsx');

/* ---------------------------------------------------------------- sources -- */

const declared = (() => {
  const src = read('src/shared/api.ts');
  const block = /export type SyncedCollection =([\s\S]*?);/.exec(src);
  if (!block) throw new Error('SyncedCollection introuvable dans src/shared/api.ts');
  return [...block[1].matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]);
})();

/** Le code sans ses commentaires : une explication ne doit pas valoir preuve. */
const sansCommentaires = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const backupCode = sansCommentaires(backup);
const settingsCode = sansCommentaires(settings);

console.log(`Collections déclarées : ${declared.length}`);

/* ----------------------------------------------------------------- 1 & 2 -- */

if (!/import\s*\{[^}]*\bSYNCED_COLLECTIONS\b[^}]*\}\s*from\s*'[^']*SyncContext'/.test(backupCode)) {
  failures.push(
    "src/lib/backup.ts n'importe plus SYNCED_COLLECTIONS depuis SyncContext : " +
      "il tient donc une liste à lui, et c'est exactement ce qui a fait perdre douze collections.",
  );
}

if (!/export const SYNCED_COLLECTIONS/.test(sync)) {
  failures.push(
    "SYNCED_COLLECTIONS n'est plus exportée par src/state/SyncContext.tsx — " +
      'la sauvegarde ne peut plus en dériver.',
  );
}

/* Une liste de collections écrite en dur dans backup.ts. On tolère jusqu'à
   deux noms cités (un message d'erreur peut en nommer), au-delà c'est une
   liste. */
const citees = [...new Set([...backupCode.matchAll(/'([a-zA-Z]+)'/g)]
  .map((m) => m[1])
  .filter((n) => declared.includes(n)))];
if (citees.length > 2) {
  failures.push(
    `src/lib/backup.ts cite ${citees.length} collections en dur (${citees.join(', ')}) : ` +
      'la liste doit venir de SYNCED_COLLECTIONS, pas du fichier.',
  );
}

/* Le bug d'origine : lire les magasins d'avant la migration. */
const legacy = (() => {
  const block = /export const LEGACY_MIGRATION_ONLY_STORES = \[([\s\S]*?)\] as const;/.exec(
    read('src/lib/bridge.ts'),
  );
  return block ? [...block[1].matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]) : [];
})();
for (const c of legacy) {
  const appel = new RegExp(`\\b(api|bridge\\(\\))\\.${c}\\.list\\s*\\(`);
  if (appel.test(backupCode)) {
    failures.push(
      `src/lib/backup.ts appelle api.${c}.list() : c'est le magasin d'AVANT la migration ` +
        `(LEGACY_MIGRATION_ONLY_STORES), pas la collection synchronisée. Sur un poste à jour, ` +
        `cette lecture rend une liste vide ou périmée. Utiliser remote.listRecords('${c}').`,
    );
  }
}
if (legacy.length > 0) {
  notes.push(`${legacy.length} magasin(s) hérité(s) surveillé(s) : ${legacy.join(', ')}.`);
}

/* Les pierres tombales ne doivent pas repartir dans le fichier : les
   restaurer les ressusciterait, puisque l'écriture ne transporte que `data`. */
if (!/\.deleted\b/.test(backupCode)) {
  failures.push(
    "src/lib/backup.ts ne filtre plus les enregistrements supprimés : une restauration " +
      'ferait revenir tout ce que la cliente a effacé.',
  );
}

/* ---------------------------------------------------------------------- 3 -- */

if (!/export async function restoreBackup/.test(backup)) {
  failures.push(
    "src/lib/backup.ts n'exporte pas restoreBackup : un export qu'on ne peut pas relire " +
      "n'est pas une sauvegarde.",
  );
}
if (!/\brestoreBackup\b/.test(settingsCode)) {
  failures.push(
    "L'écran Réglages n'appelle pas restoreBackup : la restauration existe dans le code " +
      "mais reste hors d'atteinte de la cliente.",
  );
}
/* La restauration doit écrire par remote.upsertRecord, PAS par le upsert de
   SyncContext, qui avale l'erreur réseau. Une restauration qui échoue en
   silence est pire que pas de restauration : elle affiche les données
   revenues alors que rien n'a été écrit. */
if (!/remote\.upsertRecord/.test(backupCode)) {
  failures.push(
    "La restauration n'écrit pas par remote.upsertRecord — si elle passe par le upsert de " +
      "SyncContext, une panne réseau est avalée et la restauration se déclare réussie à vide.",
  );
}

/* ---------------------------------------------------------------------- 4 -- */

const promesse = /copie\s+compl[eè]te/i.test(settings);
const reserve = /coffre-fort/i.test(settings);
if (promesse && !reserve) {
  failures.push(
    "L'écran Réglages promet une « copie complète » sans nommer ce qui n'y est pas. " +
      'Le coffre-fort est exclu volontairement : le dire coûte une phrase, ' +
      "le taire fait découvrir l'absence le jour de la restauration.",
  );
}

/* ----------------------------------------------------------------- report -- */

console.log('');
for (const n of notes) console.log(`NOTE  ${n}`);
if (failures.length === 0) {
  console.log(
    `OK — la sauvegarde dérive des ${declared.length} collections synchronisées, ` +
      'se restaure, et ne promet rien qu\'elle ne tienne.',
  );
  process.exit(0);
}
console.error(`\n${failures.length} problème(s) de couverture de sauvegarde :`);
for (const f of failures) console.error(`  - ${f}`);
process.exit(1);
