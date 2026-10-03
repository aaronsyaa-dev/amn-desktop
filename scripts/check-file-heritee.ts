/**
 * MIGRATION DE LA FILE D'ENVOI AU CHANGEMENT DE VERSION — rien ne se perd.
 *
 * La PR #34 (miroir et file indexés par organisation) mettait l'ancienne file
 * « en quarantaine » sans jamais la renvoyer, et la déconnexion l'effaçait.
 * Mesuré dans le bac à sable : un client créé hors ligne disparaissait à la
 * mise à jour, et n'atteignait jamais le serveur.
 *
 * Ce contrôle rejoue les DEUX états qu'on trouve sur un vrai poste — l'ancienne
 * clé `amn.sync.__envoi` (version d'avant #34) et la quarantaine
 * `amn.sync.quarantaine.__envoi` (version #34) — avec une entrée au format réel,
 * capturée dans l'ancienne version, et exige :
 *
 *   · que rien ne soit effacé avant d'avoir été écrit ailleurs ;
 *   · que la file mise de côté survive à la déconnexion (hors `amn.sync.*`) ;
 *   · qu'elle soit rejouée pour un compte d'une seule organisation ;
 *   · qu'elle ne le soit PAS pour un autre compte, un autre auteur, ni un
 *     compte membre de plusieurs organisations — gardée, pas perdue.
 *
 *   npm run check:file-heritee
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

interface Entree {
  collection: string;
  id: string;
  geste: 'ecriture' | 'suppression';
  donnees?: Record<string, unknown>;
  pose: string;
  essais?: number;
}
interface FileHeritee {
  proprietaire: string | null;
  entrees: Entree[];
}
type Stockage = { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void };

const { CLE_FILE_HERITEE, lireFileHeritee, mettreDeCote, partager, conserverSeulement } = await loadFromSrc<{
  CLE_FILE_HERITEE: string;
  lireFileHeritee(s: Stockage): FileHeritee;
  mettreDeCote(s: Stockage, email: string | null): FileHeritee;
  partager(f: FileHeritee, o: { email: string | null; nombreOrganisations: number }): { aRejouer: Entree[]; aGarder: Entree[]; raison: string | null };
  conserverSeulement(s: Stockage, f: FileHeritee, restantes: Entree[]): void;
}>('src/lib/fileHeritee.ts');

function stockage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  const journal: string[] = [];
  const s: Stockage = {
    getItem: (k) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k, v) => {
      journal.push(`set ${k}`);
      m.set(k, v);
    },
    removeItem: (k) => {
      journal.push(`del ${k}`);
      m.delete(k);
    },
  };
  return { s, m, journal };
}
/** Ce que fait la déconnexion (AuthContext.logout). */
const deconnecter = (m: Map<string, string>) => {
  for (const k of [...m.keys()]) if (k.startsWith('amn.sync.')) m.delete(k);
};

// Entrée au format RÉEL, capturée dans la version d'avant #34 (bac à sable).
const ZOE: Entree = {
  collection: 'clients',
  id: '1791069069669072',
  geste: 'ecriture',
  donnees: { name: 'Zoé Hors-ligne', company: '', status: 'prospect', _by: 'proprio@exemple.test' },
  pose: '2026-10-03T23:11:09.669Z',
  essais: 2,
};
const SUPPRESSION: Entree = { collection: 'tasks', id: 't-1', geste: 'suppression', pose: '2026-10-03T23:12:00.000Z' };
const AUTRE_AUTEUR: Entree = { ...ZOE, id: 'c-2', donnees: { name: 'Fiche de quelqu’un d’autre', _by: 'autre@exemple.test' }, pose: '2026-10-03T23:13:00.000Z' };

let n = 0;
const ok = (titre: string) => console.log(`  ✓ ${++n}. ${titre}`);

console.log('Migration de la file d’envoi au changement de version :');

// 1. Version d'avant #34 → mise de côté, sans trou.
{
  const { s, m, journal } = stockage({ 'amn.sync.__envoi': JSON.stringify([ZOE, SUPPRESSION]) });
  const f = mettreDeCote(s, 'proprio@exemple.test');
  assert.equal(f.entrees.length, 2);
  assert.equal(f.proprietaire, 'proprio@exemple.test');
  assert.equal(m.has('amn.sync.__envoi'), false, 'l’ancienne clé est retirée');
  assert.ok(journal.indexOf(`set ${CLE_FILE_HERITEE}`) < journal.indexOf('del amn.sync.__envoi'), 'écrite AVANT d’effacer');
  ok('l’ancienne file est mise de côté, écrite avant d’être retirée');

  deconnecter(m);
  assert.equal(lireFileHeritee(s).entrees.length, 2, 'la déconnexion ne l’efface plus');
  ok('elle survit à la déconnexion');
}

// 2. Version #34 (quarantaine) → récupérée elle aussi.
{
  const { s, m } = stockage({ 'amn.sync.quarantaine.__envoi': JSON.stringify([ZOE]) });
  const f = mettreDeCote(s, 'proprio@exemple.test');
  assert.deepEqual(f.entrees.map((e) => e.id), [ZOE.id]);
  assert.equal(m.has('amn.sync.quarantaine.__envoi'), false);
  ok('la quarantaine de la version #34 est récupérée');
}

// 3. Idempotent, sans doublon.
{
  const { s } = stockage({ 'amn.sync.__envoi': JSON.stringify([ZOE]), 'amn.sync.quarantaine.__envoi': JSON.stringify([ZOE]) });
  mettreDeCote(s, 'proprio@exemple.test');
  const deux = mettreDeCote(s, 'proprio@exemple.test');
  assert.equal(deux.entrees.length, 1);
  ok('rejouée deux fois, la mise de côté ne crée pas de doublon');
}

// 4. Un compte, une organisation → tout repart.
{
  const f: FileHeritee = { proprietaire: 'proprio@exemple.test', entrees: [ZOE, SUPPRESSION] };
  const r = partager(f, { email: 'proprio@exemple.test', nombreOrganisations: 1 });
  assert.deepEqual(r.aRejouer.map((e) => e.id), [ZOE.id, SUPPRESSION.id]);
  assert.equal(r.aGarder.length, 0);
  assert.equal(r.raison, null);
  ok('compte d’une seule organisation : écritures et suppressions rejouées');
}

// 5. Jeton partagé d'AMN DevSec (aucune appartenance listée) → une seule organisation possible.
{
  const r = partager({ proprietaire: 'proprio@exemple.test', entrees: [ZOE] }, { email: 'proprio@exemple.test', nombreOrganisations: 0 });
  assert.equal(r.aRejouer.length, 1);
  ok('aucune appartenance listée : rejouée (une seule organisation possible)');
}

// 6. Plusieurs organisations → gardée, jamais rangée au hasard.
{
  const r = partager({ proprietaire: 'proprio@exemple.test', entrees: [ZOE] }, { email: 'proprio@exemple.test', nombreOrganisations: 2 });
  assert.equal(r.aRejouer.length, 0);
  assert.equal(r.aGarder.length, 1);
  assert.equal(r.raison, 'plusieurs-organisations');
  ok('compte de plusieurs organisations : gardée, pas rejouée');
}

// 7. Autre compte connecté → gardée.
{
  const r = partager({ proprietaire: 'proprio@exemple.test', entrees: [ZOE] }, { email: 'quelquun@exemple.test', nombreOrganisations: 1 });
  assert.equal(r.aRejouer.length, 0);
  assert.equal(r.raison, 'autre-compte');
  ok('autre compte connecté : gardée');
}

// 8. Auteur différent → seule l'entrée concernée reste.
{
  const f: FileHeritee = { proprietaire: 'proprio@exemple.test', entrees: [ZOE, AUTRE_AUTEUR] };
  const r = partager(f, { email: 'proprio@exemple.test', nombreOrganisations: 1 });
  assert.deepEqual(r.aRejouer.map((e) => e.id), [ZOE.id]);
  assert.deepEqual(r.aGarder.map((e) => e.id), [AUTRE_AUTEUR.id]);
  ok('écriture d’un autre auteur : gardée, les siennes rejouées');
}

// 9. Ce qui est repris sort de la file héritée ; le reste y demeure.
{
  const { s } = stockage();
  const f: FileHeritee = { proprietaire: 'proprio@exemple.test', entrees: [ZOE, AUTRE_AUTEUR] };
  conserverSeulement(s, f, [AUTRE_AUTEUR]);
  assert.deepEqual(lireFileHeritee(s).entrees.map((e) => e.id), [AUTRE_AUTEUR.id]);
  conserverSeulement(s, f, []);
  assert.equal(s.getItem(CLE_FILE_HERITEE), null);
  ok('la file héritée ne garde que ce qui n’a pas été repris');
}

console.log(`\nFile héritée : ${n} propriétés vérifiées — aucune écriture perdue ni abandonnée au changement de version.`);
