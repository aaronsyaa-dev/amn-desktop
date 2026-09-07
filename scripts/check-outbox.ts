/**
 * La file de reprise hors ligne, exercée en Node avec un stockage en mémoire
 * et un faux transport. Chaque cas est une règle de src/state/outbox.ts :
 * si l'un casse, c'est la règle qui a changé, pas le test.
 *
 *   node --experimental-strip-types scripts/check-outbox.ts
 */
import assert from 'node:assert/strict';
import {
  enqueue,
  flushOutbox,
  isTransientNetworkError,
  outboxCounts,
  outboxKey,
  readOutbox,
  type OutboxSender,
  type OutboxStorage,
} from '../src/state/outbox.ts';
import type { RemoteRecord, SyncedCollection } from '../src/shared/api.ts';

/* Le préfixe est un PARAMÈTRE du module, pas une valeur qu'il connaît : le
   test en fournit un à lui, pour que ce soit visible. */
const API_UNREACHABLE_PREFIX = '[test-injoignable] ';
const FLUSH = { unreachablePrefix: API_UNREACHABLE_PREFIX };

function memoire(): OutboxStorage & { dump(): Record<string, string> } {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

const rec = (collection: string, id: string, data: Record<string, unknown> = {}, deleted = false): RemoteRecord =>
  ({ id, collection, data, updatedAt: '2026-09-06T00:00:00.000Z', deleted });

/** Un transport scriptable : `comportement` décide, par appel, ce qui arrive. */
function transport(comportement: (c: SyncedCollection, id: string) => 'ok' | 'reseau' | 'refus') {
  const appels: string[] = [];
  const sender: OutboxSender = {
    async upsert(c, id, data) {
      appels.push(`upsert ${c}/${id}`);
      const sort = comportement(c, id);
      if (sort === 'reseau') throw new Error(`${API_UNREACHABLE_PREFIX}coupé`);
      if (sort === 'refus') throw new Error('403 règle d’isolation');
      return rec(c, id, data);
    },
    async remove(c, id) {
      appels.push(`remove ${c}/${id}`);
      const sort = comportement(c, id);
      if (sort === 'reseau') throw new Error('fetch failed');
      if (sort === 'refus') throw new Error('404');
      return rec(c, id, {}, true);
    },
  };
  return { sender, appels };
}

let n = 0;
const cas = (nom: string, fn: () => Promise<void> | void) => Promise.resolve(fn()).then(() => { n += 1; console.log(`  OK  ${nom}`); });

await cas('la clé porte l’organisation, et le contexte client s’il y en a un', () => {
  assert.equal(outboxKey('org-1'), 'amn.outbox.org-1');
  assert.equal(outboxKey('org-1', 'cli-9'), 'amn.outbox.org-1.ctx-cli-9');
  assert.notEqual(outboxKey('org-1'), outboxKey('org-2'), 'deux organisations, deux files');
  assert.ok(!outboxKey('org-1').startsWith('amn.sync.'), 'hors du préfixe purgé avec le miroir');
});

await cas('une écriture rejouée deux fois est remplacée, à sa place', () => {
  const s = memoire(); const k = outboxKey('o');
  enqueue(s, k, { collection: 'tasks', id: 't1', data: { v: 1 } }, 'A');
  enqueue(s, k, { collection: 'notes', id: 'n1', data: { v: 1 } }, 'B');
  const apres = enqueue(s, k, { collection: 'tasks', id: 't1', data: { v: 2 } }, 'C');
  assert.equal(apres.length, 2);
  assert.deepEqual(apres.map((e) => `${e.collection}/${e.id}`), ['tasks/t1', 'notes/n1'], 'l’ordre d’origine est gardé');
  assert.deepEqual(apres[0].data, { v: 2 }, 'la dernière version locale est celle qui part');
  assert.equal(apres[0].attempts, 0, 'un remplacement remet le compteur à zéro');
});

await cas('une suppression est une entrée à data null', () => {
  const s = memoire(); const k = outboxKey('o');
  enqueue(s, k, { collection: 'clients', id: 'c1', data: null }, 'A');
  assert.equal(readOutbox(s, k)[0].data, null);
});

await cas('tout part dans l’ordre quand le réseau est là, et la file se vide', async () => {
  const s = memoire(); const k = outboxKey('o');
  enqueue(s, k, { collection: 'tasks', id: 't1', data: { a: 1 } }, 'A');
  enqueue(s, k, { collection: 'clients', id: 'c1', data: null }, 'B');
  enqueue(s, k, { collection: 'notes', id: 'n1', data: { b: 2 } }, 'C');
  const { sender, appels } = transport(() => 'ok');
  const r = await flushOutbox(s, k, sender, FLUSH);
  assert.deepEqual(appels, ['upsert tasks/t1', 'remove clients/c1', 'upsert notes/n1']);
  assert.equal(r.sent.length, 3);
  assert.equal(r.remaining.length, 0);
  assert.equal(r.halted, false);
  assert.equal(s.getItem(k), null, 'la clé disparaît quand la file est vide');
});

await cas('une panne réseau arrête tout, garde tout, dans l’ordre', async () => {
  const s = memoire(); const k = outboxKey('o');
  enqueue(s, k, { collection: 'tasks', id: 't1', data: {} }, 'A');
  enqueue(s, k, { collection: 'tasks', id: 't2', data: {} }, 'B');
  enqueue(s, k, { collection: 'tasks', id: 't3', data: {} }, 'C');
  const { sender, appels } = transport((_c, id) => (id === 't2' ? 'reseau' : 'ok'));
  const r = await flushOutbox(s, k, sender, FLUSH);
  assert.deepEqual(appels, ['upsert tasks/t1', 'upsert tasks/t2'], 't3 n’a pas été tenté');
  assert.equal(r.halted, true);
  assert.deepEqual(r.remaining.map((e) => e.id), ['t2', 't3']);
  assert.equal(r.remaining[0].attempts, 0, 'une panne réseau n’est pas un refus');
});

await cas('un refus du serveur est compté et la suite continue', async () => {
  const s = memoire(); const k = outboxKey('o');
  enqueue(s, k, { collection: 'tasks', id: 't1', data: {} }, 'A');
  enqueue(s, k, { collection: 'tasks', id: 't2', data: {} }, 'B');
  const { sender, appels } = transport((_c, id) => (id === 't1' ? 'refus' : 'ok'));
  const r = await flushOutbox(s, k, sender, FLUSH);
  assert.deepEqual(appels, ['upsert tasks/t1', 'upsert tasks/t2'], 't2 est passé malgré le refus de t1');
  assert.equal(r.halted, false);
  assert.deepEqual(r.remaining.map((e) => [e.id, e.attempts]), [['t1', 1]]);
  assert.match(r.remaining[0].lastError ?? '', /403/);
});

await cas('après cinq refus, l’entrée n’est plus rejouée mais elle reste visible', async () => {
  const s = memoire(); const k = outboxKey('o');
  enqueue(s, k, { collection: 'tasks', id: 't1', data: {} }, 'A');
  const { sender, appels } = transport(() => 'refus');
  for (let i = 0; i < 5; i += 1) await flushOutbox(s, k, sender, FLUSH);
  assert.equal(appels.length, 5);
  await flushOutbox(s, k, sender, FLUSH);
  assert.equal(appels.length, 5, 'sixième passage : pas de nouvel appel');
  const restant = readOutbox(s, k);
  assert.equal(restant.length, 1, 'elle n’a pas été perdue');
  assert.deepEqual(outboxCounts(restant), { pending: 0, rejected: 1 });
});

await cas('la classification des pannes réseau reconnaît les deux processus', () => {
  assert.ok(isTransientNetworkError(new Error(`${API_UNREACHABLE_PREFIX}x`), API_UNREACHABLE_PREFIX), 'navigateur');
  assert.ok(isTransientNetworkError(new TypeError('fetch failed'), API_UNREACHABLE_PREFIX), 'Electron / undici');
  assert.ok(isTransientNetworkError(new Error('connect ECONNREFUSED 127.0.0.1:8810'), API_UNREACHABLE_PREFIX));
  assert.ok(!isTransientNetworkError(new Error('403 Forbidden'), API_UNREACHABLE_PREFIX));
  assert.ok(!isTransientNetworkError(new Error('quota d’invité épuisé'), API_UNREACHABLE_PREFIX));
});

await cas('un stockage corrompu se lit comme une file vide', () => {
  const s = memoire(); const k = outboxKey('o');
  s.setItem(k, '{pas du json');
  assert.deepEqual(readOutbox(s, k), []);
  s.setItem(k, '{"pas":"un tableau"}');
  assert.deepEqual(readOutbox(s, k), []);
});

/* ------------------------------------------------------------------------ *
 * Stockage plein — la file gagne contre le cache
 * ------------------------------------------------------------------------ */

/**
 * Un stockage à capacité bornée, comme `localStorage` : au-delà du plafond,
 * `setItem` jette. `miroirs` simule les photos qui l'occupent déjà.
 */
function memoirePleine(plafond: number): OutboxStorage & { poids(): number; cles(): string[] } {
  const m = new Map<string, string>();
  const poids = () => [...m.entries()].reduce((total, [k, v]) => total + k.length + v.length, 0);
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => {
      const sans = m.has(k) ? poids() - k.length - (m.get(k) ?? '').length : poids();
      if (sans + k.length + v.length > plafond) throw new Error('QuotaExceededError');
      m.set(k, v);
    },
    removeItem: (k) => void m.delete(k),
    poids,
    cles: () => [...m.keys()],
  };
}

await cas('stockage plein : la file fait jeter le cache plutôt que de se perdre', () => {
  const s = memoirePleine(400);
  const k = outboxKey('o');
  // Le miroir occupe presque tout — comme une poignée de photos.
  s.setItem('amn.sync.media', 'x'.repeat(300));

  // Sans reprise de place : l'écriture ne rentre pas, et disparaît.
  enqueue(s, k, { collection: 'clients' as SyncedCollection, id: 'c1', data: { name: 'Hervé' } }, '2026-09-07T10:00:00.000Z');
  assert.deepEqual(readOutbox(s, k), [], 'sans reprise, c’est exactement la perte qu’on veut empêcher');

  // Avec reprise de place : le miroir cède, l'écriture tient.
  const reclaim = () => {
    const cle = s.cles().find((c) => c.startsWith('amn.sync.'));
    if (!cle) return false;
    s.removeItem(cle);
    return true;
  };
  enqueue(s, k, { collection: 'clients' as SyncedCollection, id: 'c1', data: { name: 'Hervé' } }, '2026-09-07T10:00:00.000Z', reclaim);
  const file = readOutbox(s, k);
  assert.equal(file.length, 1, 'l’écriture est en file');
  assert.equal(file[0].id, 'c1');
  assert.ok(!s.cles().includes('amn.sync.media'), 'le cache a cédé, c’est lui le jetable');
});

await cas('stockage plein et plus rien à jeter : on n’entre pas dans une boucle', () => {
  const s = memoirePleine(50);
  const k = outboxKey('o');
  let appels = 0;
  const reclaimInutile = () => {
    appels += 1;
    return false; // rien de jetable
  };
  enqueue(s, k, { collection: 'tasks' as SyncedCollection, id: 't1', data: { title: 'x' } }, '2026-09-07T10:00:00.000Z', reclaimInutile);
  assert.equal(appels, 1, 'une seule tentative quand la reprise dit qu’elle n’a rien libéré');
});

await cas('stockage plein pendant le vidage : la file rendue reste juste', async () => {
  const s = memoirePleine(360);
  const k = outboxKey('o');
  const reclaim = () => {
    const cle = s.cles().find((c) => c.startsWith('amn.sync.'));
    if (!cle) return false;
    s.removeItem(cle);
    return true;
  };
  enqueue(s, k, { collection: 'tasks' as SyncedCollection, id: 't1', data: {} }, '2026-09-07T10:00:00.000Z', reclaim);
  s.setItem('amn.sync.media', 'x'.repeat(200));

  const { sender } = transport(() => 'ok');
  const r = await flushOutbox(s, k, sender, { ...FLUSH, reclaim });
  assert.equal(r.sent.length, 1, 'l’écriture est partie');
  assert.deepEqual(readOutbox(s, k), [], 'et la file est vidée pour de bon, pas seulement en mémoire');
});

console.log(`\nOK — ${n} cas, la file de reprise fait ce que dit son en-tête.`);
