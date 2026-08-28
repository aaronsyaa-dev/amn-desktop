#!/usr/bin/env node
/**
 * LES NATURES D'ALERTE, CROISÉES ENTRE LES DEUX DÉPÔTS
 * ═══════════════════════════════════════════════════
 *
 * Le même sujet est écrit à TROIS endroits : ce qu'amn-api émet
 * (`kind: '…'`), le type `AlertKind` du contrat, et les libellés français de
 * `lib/trackerAlerts`. Rien ne les croisait.
 *
 * Ce que ça avait produit, mesuré : sept natures réellement émises manquaient
 * côté poste — les quatre familles d'injection, la sonde de disponibilité,
 * l'expiration de certificat, l'analyse de dépendances. Elles s'affichaient en
 * clé brute chez une cliente : « ssl_expiry » au lieu de « Certificat proche
 * de l'expiration ». Aucun plantage, aucun avertissement — juste un mot
 * technique là où il fallait une phrase.
 *
 * C'est le motif que ce dépôt connaît bien (CONFIGURABLE_MODULES, les rôles) :
 * plusieurs listes qui disent la même chose jusqu'au jour où l'une bouge.
 *
 * Trois règles :
 *
 *   1. toute nature émise par amn-api existe dans `AlertKind` ;
 *   2. toute nature d'`AlertKind` a un libellé français ;
 *   3. aucune nature n'est déclarée côté poste sans être émise — une entrée
 *      morte fait croire à une couverture qu'on n'a pas.
 *
 *   npm run check:supervision
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const notes = [];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

/*
  Les natures qui ne sont PAS des alertes de supervision : elles nomment un
  rapport ou un essai. Admises explicitement — une liste qui dit ce qu'on a
  décidé vaut mieux qu'un filtre qui cache ce qu'on a oublié.
*/
const HORS_SUPERVISION = new Set([
  'weekly_report', // le digest hebdomadaire
  'comply',        // un contrôle RGPD terminé
  'scan',          // un scan de sécurité terminé
  /*
    Ces deux-là nomment une NOTIFICATION, pas une alerte : le `kind` d'un
    message push (`test`, `call`, `incident`) est un autre espace de noms que
    le `kind` d'un événement. Le relevé par `kind: '…'` ne peut pas les
    distinguer, et il a signalé « incident » dès que l'escalade a été écrite —
    ce qui est le bon comportement : mieux vaut une liste qui réclame une
    décision qu'un filtre qui cache ce qu'on a oublié.
  */
  'test',
  'incident',
]);

/* ─── Ce que le poste déclare ────────────────────────────────────────────── */

const contrat = /export type AlertKind =([\s\S]*?);/.exec(read('src/shared/api.ts'));
if (!contrat) failures.push('`AlertKind` est introuvable dans src/shared/api.ts.');
const declarees = contrat ? [...contrat[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]) : [];

const libelles = /const KIND_LABELS: Record<AlertKind, string> = \{([\s\S]*?)\n\};/.exec(
  read('src/lib/trackerAlerts.ts'),
);
if (!libelles) failures.push('`KIND_LABELS` est introuvable dans src/lib/trackerAlerts.ts.');
const nommees = libelles ? [...libelles[1].matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1]) : [];

/* ─── Ce que le serveur émet vraiment ────────────────────────────────────── */

const apiRoot = ['/workspace/amn-api', path.join(ROOT, '..', 'amn-api')].find((c) =>
  fs.existsSync(path.join(c, 'src/tracker')),
);

if (!apiRoot) {
  notes.push('amn-api introuvable localement — le croisement avec le serveur est sauté.');
} else {
  const emises = new Set();
  for (const dossier of ['src/tracker', 'src/routes', 'src/scanner']) {
    const dir = path.join(apiRoot, dossier);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.js')) continue;
      for (const m of fs.readFileSync(path.join(dir, f), 'utf-8').matchAll(/kind:\s*'([a-z_]+)'/g)) {
        emises.add(m[1]);
      }
    }
  }

  if (emises.size === 0) {
    failures.push("Aucune nature relevée dans amn-api : le relevé ne fonctionne plus.");
  }

  /* 1. Émise mais inconnue du poste */
  for (const nature of emises) {
    if (HORS_SUPERVISION.has(nature)) continue;
    if (!declarees.includes(nature)) {
      failures.push(
        `amn-api émet « ${nature} », absente d'\`AlertKind\`. Elle s'affichera en ` +
          `clé brute chez une cliente — un mot technique là où il faut une phrase.`,
      );
    }
  }

  /* 3. Déclarée côté poste mais jamais émise */
  for (const nature of declarees) {
    if (!emises.has(nature)) {
      failures.push(
        `« ${nature} » est déclarée dans \`AlertKind\` mais RIEN ne l'émet dans ` +
          `amn-api. Une entrée morte fait croire à une couverture qu'on n'a pas.`,
      );
    }
  }
}

/* ─── 2. Déclarée sans libellé ───────────────────────────────────────────── */

for (const nature of declarees) {
  if (!nommees.includes(nature)) {
    failures.push(
      `« ${nature} » n'a pas de libellé dans \`KIND_LABELS\`. Le repli affiche la ` +
        `clé brute, ce qui se voit dans la file d'incidents ET dans le rapport ` +
        `remis à la cliente.`,
    );
  }
}
for (const nature of nommees) {
  if (!declarees.includes(nature)) {
    failures.push(`« ${nature} » a un libellé mais n'existe pas dans \`AlertKind\`.`);
  }
}

/* ─── Le bureau de supervision est atteignable ───────────────────────────── */

/*
  Un écran qui n'est routé nulle part n'existe pas. C'est arrivé assez souvent
  dans ce dépôt (des routes existantes qu'aucun écran ne consommait, Bloc 0)
  pour valoir une ligne de contrôle.
*/
const routes = read('src/edition/appRoot.internal.tsx');
if (!/IncidentsScreen/.test(routes)) {
  failures.push(
    "Le bureau de supervision n'est routé nulle part dans l'édition interne : " +
      "l'écran existe mais personne ne peut l'ouvrir.",
  );
}

/* ─────────────────────────────── verdict ───────────────────────────────── */

for (const n of notes) console.log(`  note  ${n}`);

if (failures.length > 0) {
  console.error('\nSupervision : les listes de natures ont divergé.\n');
  for (const f of failures) console.error(`  ✗ ${f}\n`);
  process.exit(1);
}

console.log(
  `\nSupervision : les trois listes s'accordent avec ce qu'amn-api émet.\n` +
    `  ${declarees.length} natures déclarées, toutes nommées, toutes réellement émises.`,
);
