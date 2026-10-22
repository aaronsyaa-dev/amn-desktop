/**
 * Contrôle du BUS DE MOMENTS — `src/socle/moments.ts`, exercé hors application.
 *
 * Le bus n'est encore branché à aucun écran : c'est précisément le moment de
 * figer son contrat, avant que trois sessions s'y abonnent en le supposant.
 *
 *   · un abonné reçoit les moments de SON type, et `'*'` les reçoit tous ;
 *   · la désinscription est individuelle et idempotente ;
 *   · un abonné qui lève une erreur ne prive pas les suivants ;
 *   · se désinscrire pendant une émission ne décale personne ;
 *   · le journal passe avant les abonnés, et s'ôte ;
 *   · chaque type du catalogue a une famille connue et un ton connu.
 *
 *   npm run check:moments
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

type Moment = { type: string; charge: Record<string, unknown>; quand: number };
const bus = await loadFromSrc<{
  emit: (type: string, charge: unknown) => Moment;
  subscribe: (type: string, fn: (m: Moment) => void) => () => void;
  poserJournal: (fn: ((m: Moment) => void) | null) => void;
  reinitialiserMoments: () => void;
  TYPES_DE_MOMENTS: string[];
  CATALOGUE_DES_MOMENTS: Record<string, { famille: string; ton: string }>;
}>('src/socle/moments.ts');
const { FAMILLES } = await loadFromSrc<{ FAMILLES: readonly string[] }>('src/socle/familles.ts');

let vus = 0;
const dit = (nom: string, fn: () => void) => {
  bus.reinitialiserMoments();
  fn();
  vus += 1;
  console.log(`  ✓ ${nom}`);
};

console.log('Bus de moments\n');

dit('un abonné reçoit son type, avec la charge et l’heure', () => {
  const recus: Moment[] = [];
  bus.subscribe('facture.payee', (m) => recus.push(m));
  const avant = Date.now();
  const emis = bus.emit('facture.payee', { factureId: 'f-1' });
  assert.equal(recus.length, 1);
  assert.equal(recus[0], emis);
  assert.deepEqual(recus[0].charge, { factureId: 'f-1' });
  assert.ok(recus[0].quand >= avant && recus[0].quand <= Date.now());
});

dit('un abonné n’entend pas les autres types', () => {
  let appels = 0;
  bus.subscribe('client.cree', () => (appels += 1));
  bus.emit('facture.payee', { factureId: 'f-1' });
  assert.equal(appels, 0);
});

dit('« * » reçoit tout, après les abonnés du type', () => {
  const ordre: string[] = [];
  bus.subscribe('*', (m) => ordre.push(`*:${m.type}`));
  bus.subscribe('client.cree', () => ordre.push('client'));
  bus.emit('client.cree', { clientId: 'c-1' });
  bus.emit('message.recu', { conversationId: 'k-1' });
  assert.deepEqual(ordre, ['client', '*:client.cree', '*:message.recu']);
});

dit('la désinscription est individuelle et idempotente', () => {
  let a = 0;
  let b = 0;
  const fn = () => (a += 1);
  const off1 = bus.subscribe('tache.terminee', fn);
  bus.subscribe('tache.terminee', fn); // la même fonction, deux abonnements
  bus.subscribe('tache.terminee', () => (b += 1));
  off1();
  off1();
  bus.emit('tache.terminee', { tacheId: 't-1' });
  assert.equal(a, 1, 'le second abonnement de la même fonction reste');
  assert.equal(b, 1);
});

dit('un abonné qui casse ne prive pas les suivants', () => {
  const avant = globalThis.reportError;
  const erreurs: unknown[] = [];
  globalThis.reportError = (e: unknown) => erreurs.push(e);
  try {
    let suivant = 0;
    bus.subscribe('rdv.proche', () => {
      throw new Error('mascotte en panne');
    });
    bus.subscribe('rdv.proche', () => (suivant += 1));
    bus.subscribe('*', () => (suivant += 1));
    assert.doesNotThrow(() => bus.emit('rdv.proche', { rdvId: 'r-1', dansMinutes: 10 }));
    assert.equal(suivant, 2);
    assert.equal(erreurs.length, 1, 'l’erreur reste signalée');
  } finally {
    globalThis.reportError = avant;
  }
});

dit('se désinscrire pendant une émission ne décale personne', () => {
  const recus: string[] = [];
  let off: () => void = () => undefined;
  off = bus.subscribe('projet.cree', () => {
    recus.push('premier');
    off();
  });
  bus.subscribe('projet.cree', () => recus.push('second'));
  bus.emit('projet.cree', { projetId: 'p-1' });
  bus.emit('projet.cree', { projetId: 'p-2' });
  assert.deepEqual(recus, ['premier', 'second', 'second']);
});

dit('le journal passe avant les abonnés, et s’ôte', () => {
  const ordre: string[] = [];
  bus.poserJournal((m) => ordre.push(`journal:${m.type}`));
  bus.subscribe('*', () => ordre.push('abonne'));
  bus.emit('synchro.retablie', { horsLigneDepuisMs: 1000 });
  bus.poserJournal(null);
  bus.emit('synchro.retablie', { horsLigneDepuisMs: 2000 });
  assert.deepEqual(ordre, ['journal:synchro.retablie', 'abonne', 'abonne']);
});

dit('un journal qui casse ne casse pas le moment', () => {
  let recu = 0;
  bus.poserJournal(() => {
    throw new Error('console indisponible');
  });
  bus.subscribe('sauvegarde.terminee', () => (recu += 1));
  assert.doesNotThrow(() => bus.emit('sauvegarde.terminee', { reussie: true }));
  assert.equal(recu, 1);
});

dit('le catalogue : chaque type a une famille et un ton connus', () => {
  const tons = new Set(['fete', 'info', 'decision', 'critique']);
  assert.ok(bus.TYPES_DE_MOMENTS.length >= 10);
  for (const type of bus.TYPES_DE_MOMENTS) {
    const def = bus.CATALOGUE_DES_MOMENTS[type];
    assert.ok(FAMILLES.includes(def.famille), `${type} : famille inconnue ${def.famille}`);
    assert.ok(tons.has(def.ton), `${type} : ton inconnu ${def.ton}`);
  }
  for (const attendu of ['facture.payee', 'client.cree', 'rdv.proche', 'tentative.suspecte', 'message.recu']) {
    assert.ok(bus.TYPES_DE_MOMENTS.includes(attendu), `type attendu absent : ${attendu}`);
  }
  // Le critique est rare par construction : la liste est fermée, et l'allonger est une décision du CO.
  assert.deepEqual(
    bus.TYPES_DE_MOMENTS.filter((t) => bus.CATALOGUE_DES_MOMENTS[t].ton === 'critique'),
    ['tentative.suspecte', 'garde.escalade', 'garde.remontee-critique'],
  );
});

console.log(`\nOK — ${vus} propriétés du bus tiennent.`);
