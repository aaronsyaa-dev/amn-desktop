/**
 * Le plafond du miroir local, exercé en Node sur le vrai module.
 *
 * Ce que ces cas protègent, en une phrase : une poignée de photos ne doit pas
 * pouvoir faire disparaître une écriture faite hors ligne.
 *
 *   npm run check:mirror
 */
import assert from 'node:assert/strict';
import {
  MIRROR_BUDGET_BYTES,
  fitToBudget,
  reclaimLargest,
  type MirrorStorage,
} from '../src/state/mirrorBudget.ts';
import type { RemoteRecord } from '../src/shared/api.ts';

let n = 0;
function cas(titre: string, fn: () => void): void {
  fn();
  n += 1;
  console.log(`  OK  ${titre}`);
}

/** Un média, tel que l'écran Médias en produit un : une image en data URL. */
function media(id: string, jour: string, kilooctets: number): RemoteRecord {
  return {
    id,
    collection: 'media',
    updatedAt: `2026-09-${jour}T10:00:00.000Z`,
    deleted: false,
    data: { name: `${id}.jpg`, dataUrl: `data:image/jpeg;base64,${'A'.repeat(kilooctets * 1024)}` },
  };
}

function stockage(entrees: Record<string, string>): MirrorStorage & { cles(): string[] } {
  const m = new Map(Object.entries(entrees));
  return {
    get length() {
      return m.size;
    },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => m.get(k) ?? null,
    removeItem: (k) => void m.delete(k),
    cles: () => [...m.keys()],
  };
}

console.log('\nPlafond du miroir local\n');

/* ------------------------------------------------------------------ budget */

cas('une collection de texte passe entière, sans y toucher', () => {
  const clients: RemoteRecord[] = Array.from({ length: 500 }, (_, i) => ({
    id: `c${i}`,
    collection: 'clients',
    updatedAt: '2026-09-01T10:00:00.000Z',
    deleted: false,
    data: { name: `Client ${i}`, phone: '06 12 34 56 78', notes: 'x'.repeat(200) },
  }));
  const garde = fitToBudget(clients);
  assert.equal(garde.length, clients.length);
  assert.equal(garde, clients, 'sous le budget, c’est le tableau d’origine qui ressort');
});

cas('dix photos dépassent le budget et sont tronquées', () => {
  const photos = Array.from({ length: 10 }, (_, i) => media(`m${i}`, String(10 + i).padStart(2, '0'), 400));
  assert.ok(JSON.stringify(photos).length > MIRROR_BUDGET_BYTES, 'le cas de départ est bien un dépassement');
  const garde = fitToBudget(photos);
  assert.ok(garde.length < photos.length, 'il en reste moins');
  assert.ok(garde.length > 0, 'mais pas zéro : les plus récentes restent consultables hors ligne');
  assert.ok(JSON.stringify(garde).length <= MIRROR_BUDGET_BYTES, 'et ça tient dans le budget');
});

cas('ce qui est gardé, ce sont les plus récents', () => {
  const photos = [media('vieux', '01', 500), media('recent', '20', 500), media('moyen', '10', 500)];
  const garde = fitToBudget(photos);
  assert.equal(garde[0].id, 'recent', 'le plus récent d’abord');
  assert.ok(
    !garde.some((r) => r.id === 'vieux'),
    'et c’est le plus vieux qui saute — un enregistrement créé hors ligne porte la date du moment, il ne doit jamais être le premier écarté',
  );
});

cas('un seul enregistrement plus gros que le budget ne bloque pas tout', () => {
  const garde = fitToBudget([media('enorme', '15', 2000)]);
  assert.deepEqual(garde, [], 'il est écarté, et le miroir s’écrit vide plutôt que de jeter une exception');
});

cas('une collection vide reste une collection vide', () => {
  assert.deepEqual(fitToBudget([]), []);
});

/* ----------------------------------------------------------- reprise de place */

cas('la reprise jette le plus gros miroir, et lui seul', () => {
  const s = stockage({
    'amn.sync.media': 'x'.repeat(900),
    'amn.sync.clients': 'x'.repeat(100),
    'amn.outbox.org-42': 'x'.repeat(50),
  });
  assert.equal(reclaimLargest(s, 'amn.sync.'), true);
  assert.deepEqual(s.cles().sort(), ['amn.outbox.org-42', 'amn.sync.clients']);
});

cas('la reprise ne touche jamais à la file d’attente', () => {
  const s = stockage({ 'amn.outbox.org-42': 'x'.repeat(5000), 'amn.sync.notes': 'x'.repeat(10) });
  reclaimLargest(s, 'amn.sync.');
  assert.ok(s.cles().includes('amn.outbox.org-42'), 'même énorme, la file survit : c’est elle qu’on protège');
});

cas('plus rien à jeter : elle rend false, ce qui arrête la boucle', () => {
  assert.equal(reclaimLargest(stockage({ 'amn.outbox.o': 'x' }), 'amn.sync.'), false, 'aucun miroir');
  assert.equal(reclaimLargest(stockage({}), 'amn.sync.'), false, 'stockage vide');
  assert.equal(reclaimLargest(stockage({ 'amn.sync.vide': '' }), 'amn.sync.'), false, 'un miroir vide ne libère rien');
});

cas('un stockage qui jette se comporte comme un stockage sans rien à jeter', () => {
  const casse: MirrorStorage = {
    get length(): number {
      throw new Error('SecurityError: accès au stockage refusé');
    },
    key: () => null,
    getItem: () => null,
    removeItem: () => undefined,
  };
  assert.equal(reclaimLargest(casse, 'amn.sync.'), false);
});

console.log(`\nOK — ${n} cas : les photos cèdent le stockage, jamais une écriture en attente.`);
