/**
 * Contrôle du LECTEUR DE SAUVEGARDE.
 *
 * Une sauvegarde qu'on ne peut pas relire est une promesse qu'on découvre
 * fausse le jour où l'on en a besoin — c'est-à-dire le jour où l'on a déjà
 * tout perdu par ailleurs. `inspecterSauvegarde` est ce qui répond « ce
 * fichier vaut quelque chose » ou « refaites-en une », et il faut donc qu'il
 * ne se trompe jamais dans le sens rassurant.
 *
 * Deux principes tenus ici :
 *
 *   1. le pire cas est le fichier BIEN FORMÉ ET VIDE — il n'a l'air de rien,
 *      il s'ouvre sans erreur, et il ne contient pas une fiche. C'est celui
 *      qu'on range en lieu sûr sans y revenir ;
 *   2. un doute penche toujours du côté qui alerte. Un fichier non reconnu
 *      n'est pas « probablement bon ».
 *
 *   npm run check:sauvegarde
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));

async function loadFromSrc<T>(entry: string): Promise<T> {
  const built = await esbuild.build({
    entryPoints: [path.join(here, '..', entry)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    target: 'node22',
    charset: 'utf8',
  });
  return (await import(
    `data:text/javascript;charset=utf-8;base64,${Buffer.from(built.outputFiles[0].text, 'utf8').toString('base64')}`
  )) as T;
}

type Rapport = {
  titre: string;
  origine: 'serveur' | 'local' | null;
  organisation: string | null;
  exporteLe: string | null;
  ageJours: number | null;
  collections: { nom: string; total: number; supprimes: number }[];
  totalFiches: number;
  supervision: { incidents: number; etouffoirs: number; maintenances: number } | null;
  sectionsManquantes: string[];
  avertissements: string[];
};

const { inspecterSauvegarde, SAUVEGARDE_AGE_ALERTE_JOURS } = await loadFromSrc<{
  inspecterSauvegarde: (brut: unknown, maintenant?: Date) => Rapport;
  SAUVEGARDE_AGE_ALERTE_JOURS: number;
}>('src/lib/backupInspect.ts');

const MAINTENANT = new Date('2026-08-29T12:00:00Z');
const jourMoins = (n: number) => new Date(MAINTENANT.getTime() - n * 86_400_000).toISOString();

let vus = 0;
const dit = (nom: string, fn: () => void) => {
  fn();
  vus += 1;
  console.log(`  ✓ ${nom}`);
};
const alerte = (r: Rapport, motif: RegExp) =>
  r.avertissements.some((a) => motif.test(a));

/*
  LE FICHIER DE RÉFÉRENCE.

  Ce n'est pas une invention : c'est la forme rendue par
  `GET /v1/auth/organization/export`, relevée sur un serveur qui tourne. Un
  gabarit écrit de mémoire aurait fini par décrire un format que le serveur
  n'envoie plus, et le contrôle serait passé au vert sur une fiction.
*/
const EXPORT_SERVEUR = {
  kind: 'amn-export',
  version: 2,
  exportedAt: jourMoins(2),
  organization: { id: 'org-1', name: 'Fleuriste d Essai', plan: 'business_standard' },
  users: [{ email: 'fleuriste.essai@exemple.test', role: 'owner', status: 'active' }],
  sites: [{ id: 's1', name: 'Vitrine', tier: 'sentinel', url: null }],
  supervision: {
    incidents: [
      { id: 'i1', actor: '203.0.113.7', suppressedBy: null, kinds: ['sql_injection'], alertCount: 1 },
      { id: 'i2', actor: '198.51.100.4', suppressedBy: 'e1', kinds: ['brute_force'], alertCount: 1 },
    ],
    suppressions: [{ id: 'e1', kind: 'brute_force', actor: '198.51.100.4' }],
    maintenance: [{ id: 'm1', reason: 'Migration' }],
    incidentsTronques: false,
  },
  collections: {
    clients: [
      { id: 'c1', updatedAt: jourMoins(3), deleted: false, data: { nom: 'Mme Roux' } },
      { id: 'c2', updatedAt: jourMoins(3), deleted: true, data: { nom: 'Ancienne fiche' } },
    ],
    invoices: [{ id: 'f1', updatedAt: jourMoins(4), deleted: false, data: { total: 120 } }],
  },
  notice: 'Cet export contient les données de votre organisation…',
};

console.log('\nContrôle du lecteur de sauvegarde\n');

/* ─── L'export serveur, le cas nominal ───────────────────────────────────── */

dit('un export serveur est reconnu comme complet', () => {
  const r = inspecterSauvegarde(EXPORT_SERVEUR, MAINTENANT);
  assert.equal(r.origine, 'serveur');
  assert.equal(r.organisation, 'Fleuriste d Essai');
  assert.equal(r.ageJours, 2);
  assert.deepEqual(r.avertissements, [], 'une bonne sauvegarde ne fait pas de bruit');
});

dit('les fiches sont comptées, les supprimées repérées', () => {
  const r = inspecterSauvegarde(EXPORT_SERVEUR, MAINTENANT);
  assert.equal(r.totalFiches, 3);
  const clients = r.collections.find((c) => c.nom === 'clients')!;
  assert.equal(clients.total, 2);
  // Une fiche supprimée EST dans l'export, marquée : la taire rendrait le
  // fichier incomplet. Elle est donc comptée à part, pas retirée du total.
  assert.equal(clients.supprimes, 1);
});

dit('les collections sont rangées de la plus grosse à la plus petite', () => {
  const r = inspecterSauvegarde(EXPORT_SERVEUR, MAINTENANT);
  assert.deepEqual(r.collections.map((c) => c.nom), ['clients', 'invoices']);
});

dit('la supervision est résumée telle qu’elle est', () => {
  const r = inspecterSauvegarde(EXPORT_SERVEUR, MAINTENANT);
  assert.deepEqual(r.supervision, { incidents: 2, etouffoirs: 1, maintenances: 1 });
});

/* ─── Ce qui doit ALERTER ────────────────────────────────────────────────── */

dit('LE PIRE CAS : un fichier bien formé et vide le dit en premier', () => {
  const r = inspecterSauvegarde({ ...EXPORT_SERVEUR, collections: {} }, MAINTENANT);
  assert.equal(r.totalFiches, 0);
  assert.match(
    r.avertissements[0],
    /aucune fiche/i,
    'c’est le seul avertissement qu’on lira si on n’en lit qu’un',
  );
});

dit('un fichier étranger n’est jamais donné pour bon', () => {
  for (const etranger of [{}, { kind: 'autre-chose' }, null, 'texte', 42, []]) {
    const r = inspecterSauvegarde(etranger, MAINTENANT);
    assert.equal(r.origine, null, `origine pour ${JSON.stringify(etranger)}`);
    assert.ok(alerte(r, /pas une sauvegarde/i), 'et il le dit');
  }
});

dit('l’instantané local annonce qu’il est partiel', () => {
  const local = {
    kind: 'amn-backup',
    version: 1,
    exportedAt: jourMoins(1),
    data: { clients: [{ id: 'c1' }], tasks: [{ id: 't1' }, { id: 't2' }] },
  };
  const r = inspecterSauvegarde(local, MAINTENANT);
  assert.equal(r.origine, 'local');
  // Deux formats, un seul décompte : l'instantané range sous `data`.
  assert.equal(r.totalFiches, 3);
  assert.ok(alerte(r, /partie de vos données/i));
});

dit('une section illisible à l’export rend le fichier incomplet, et ça se dit', () => {
  const r = inspecterSauvegarde(
    { ...EXPORT_SERVEUR, unavailable: ['suppressions'] },
    MAINTENANT,
  );
  assert.deepEqual(r.sectionsManquantes, ['suppressions']);
  assert.ok(alerte(r, /Incomplète.*suppressions/i));
});

dit('une liste d’incidents tronquée est signalée', () => {
  const r = inspecterSauvegarde(
    { ...EXPORT_SERVEUR, supervision: { ...EXPORT_SERVEUR.supervision, incidentsTronques: true } },
    MAINTENANT,
  );
  assert.ok(alerte(r, /tronquée/i));
});

dit('une vieille sauvegarde dit son âge en clair', () => {
  const vieille = inspecterSauvegarde(
    { ...EXPORT_SERVEUR, exportedAt: jourMoins(SAUVEGARDE_AGE_ALERTE_JOURS + 1) },
    MAINTENANT,
  );
  assert.ok(alerte(vieille, new RegExp(`${SAUVEGARDE_AGE_ALERTE_JOURS + 1} jours`)));

  // La borne elle-même ne déclenche pas : « 90 jours » n'est pas « plus de 90 ».
  const juste = inspecterSauvegarde(
    { ...EXPORT_SERVEUR, exportedAt: jourMoins(SAUVEGARDE_AGE_ALERTE_JOURS) },
    MAINTENANT,
  );
  assert.ok(!alerte(juste, /jours/), 'pas d’alerte sur la borne exacte');
});

dit('un fichier sans date le dit plutôt que de la deviner', () => {
  const { exportedAt: _sans, ...prive } = EXPORT_SERVEUR;
  const r = inspecterSauvegarde(prive, MAINTENANT);
  assert.equal(r.ageJours, null);
  assert.ok(alerte(r, /ne dit pas quand/i));

  const cassee = inspecterSauvegarde({ ...EXPORT_SERVEUR, exportedAt: 'pas-une-date' }, MAINTENANT);
  assert.equal(cassee.ageJours, null);
  assert.ok(alerte(cassee, /ne dit pas quand/i));
});

/* ─── Ce qui ne doit PAS faire tomber ────────────────────────────────────── */

dit('un fichier abîmé est lu sans exception', () => {
  const abime = {
    kind: 'amn-export',
    exportedAt: jourMoins(1),
    organization: 'pas un objet',
    collections: { clients: 'pas un tableau', invoices: [{ id: 'f1' }] },
    supervision: 'pas un objet',
    unavailable: ['sites', 7, null],
  };
  const r = inspecterSauvegarde(abime, MAINTENANT);
  assert.equal(r.organisation, null, 'un nom absent reste absent, il ne devient pas du texte');
  assert.deepEqual(r.collections.map((c) => c.nom), ['invoices'], 'ce qui n’est pas une liste est ignoré');
  assert.equal(r.supervision, null);
  assert.deepEqual(r.sectionsManquantes, ['sites'], 'seules les chaînes sont retenues');
});

/* ─── L'intitulé ne rassure que s'il en a le droit ───────────────────────── */

/*
  LA RÈGLE LA PLUS IMPORTANTE DU FICHIER, et celle qui a failli manquer.

  L'intitulé disait « Sauvegarde complète » dès que le fichier venait du
  serveur — donc juste au-dessus de « ne contient aucune fiche » et « a 400
  jours ». Le mot le plus gros de l'encadré démentait les trois lignes en
  dessous, et c'est celui-là qu'on retient en refermant l'écran.

  C'est le défaut de la salutation d'accueil, qui disait « la nuit est calme »
  au-dessus de douze sites hors ligne. Il se répare de la même façon : le mot
  qui rassure se MÉRITE, et le défaut penche du côté qui ne ment pas.

  La règle est balayée sur tous les cas défavorables plutôt que sur un
  exemple : c'est la seule façon de garantir qu'aucune combinaison n'ouvre une
  brèche.
*/
dit('un intitulé ne rassure JAMAIS pendant qu’un avertissement contredit', () => {
  const defavorables: [string, unknown][] = [
    ['vide', { ...EXPORT_SERVEUR, collections: {} }],
    ['ancienne', { ...EXPORT_SERVEUR, exportedAt: jourMoins(400) }],
    ['incomplète', { ...EXPORT_SERVEUR, unavailable: ['sites'] }],
    ['tronquée', {
      ...EXPORT_SERVEUR,
      supervision: { ...EXPORT_SERVEUR.supervision, incidentsTronques: true },
    }],
    ['sans date', { ...EXPORT_SERVEUR, exportedAt: null }],
    ['repli local', { kind: 'amn-backup', exportedAt: jourMoins(1), data: { clients: [{ id: 'c1' }] } }],
    ['étrangère', { kind: 'autre-chose' }],
  ];
  for (const [nom, doc] of defavorables) {
    const r = inspecterSauvegarde(doc, MAINTENANT);
    assert.ok(r.avertissements.length > 0, `${nom} : le cas doit produire un avertissement`);
    assert.ok(
      !/complète/i.test(r.titre),
      `${nom} : l’intitulé « ${r.titre} » rassure alors que « ${r.avertissements[0]} »`,
    );
  }
});

dit('et il rassure quand c’est mérité', () => {
  const r = inspecterSauvegarde(EXPORT_SERVEUR, MAINTENANT);
  assert.equal(r.avertissements.length, 0);
  assert.equal(r.titre, 'Sauvegarde complète', 'le témoin : une bonne sauvegarde le dit');
});

dit('la section illisible est nommée dans une phrase qui s’accorde', () => {
  const une = inspecterSauvegarde({ ...EXPORT_SERVEUR, unavailable: ['sites'] }, MAINTENANT);
  assert.ok(
    une.avertissements.some((a) => a.includes('la section « sites » n’a pas pu être lue')),
    'singulier',
  );
  const deux = inspecterSauvegarde(
    { ...EXPORT_SERVEUR, unavailable: ['sites', 'suppressions'] },
    MAINTENANT,
  );
  assert.ok(
    deux.avertissements.some((a) =>
      a.includes('les sections « sites », « suppressions » n’ont pas pu être lues'),
    ),
    'pluriel',
  );
});

console.log(`\nOK — ${vus} contrôles.\n`);
