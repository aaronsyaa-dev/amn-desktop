/**
 * Contrôle de la tendance d'activité (BLOC E).
 *
 * Une tendance fausse ne plante pas : elle s'affiche. « +100 % » sur deux
 * enregistrements contre un, un `Infinity` bien visible dès qu'une période
 * précédente est vide, un « +3 % » hebdomadaire qui apprend à ne plus lire le
 * chiffre — aucun de ces défauts ne se voit depuis l'éditeur de code. Ils se
 * voient sur le bandeau de la Tour de contrôle, c'est-à-dire trop tard.
 *
 * Ce contrôle fixe les quatre cas que `computeTrend` doit distinguer, et
 * surtout les deux où il doit se TAIRE : quand il n'y a rien à comparer, et
 * quand l'écart tient dans le bruit.
 *
 *   npm run check:trend
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

type TrendDirection = 'up' | 'down' | 'flat' | 'new' | 'none';
interface Trend {
  direction: TrendDirection;
  percent: number | null;
  sentence: string;
}
interface TrendModule {
  computeTrend(current: number, previous: number): Trend;
  trendSymbol(direction: TrendDirection): string;
  SEUIL_BRUIT: number;
}

const { computeTrend, trendSymbol, SEUIL_BRUIT } = await loadFromSrc<TrendModule>('src/lib/trend.ts');

const failures: string[] = [];
function check(name: string, run: () => void) {
  try {
    run();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push(name);
    console.error(`  ÉCHEC ${name}`);
    console.error(`         ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
  }
}

console.log('Tendance d’activité — ce qu’elle dit, et ce qu’elle refuse de dire\n');

check('deux périodes vides : aucune tendance, et aucun pourcentage', () => {
  const t = computeTrend(0, 0);
  assert.equal(t.direction, 'none');
  assert.equal(t.percent, null, 'un 0 % ici prétendrait qu’on a mesuré quelque chose');
  assert.equal(trendSymbol(t.direction), '', 'rien à signaler : rien à afficher');
});

check('période précédente vide : un DÉBUT, pas une hausse de x %', () => {
  const t = computeTrend(7, 0);
  assert.equal(t.direction, 'new');
  assert.equal(t.percent, null);
  // Le vrai défaut que ce cas existe pour empêcher : (7 - 0) / 0 = Infinity.
  assert.ok(!/Infinity|NaN/.test(t.sentence), t.sentence);
  assert.notEqual(trendSymbol(t.direction), '↑', 'une flèche ferait croire à une progression mesurée');
});

check('un écart sous le seuil reste du bruit', () => {
  // 41 contre 40 : +2,5 %, arrondi à +3.
  const t = computeTrend(41, 40);
  assert.equal(t.direction, 'flat');
  assert.ok(Math.abs(t.percent as number) < SEUIL_BRUIT);
  assert.equal(trendSymbol(t.direction), '');
});

check('au-delà du seuil, la hausse est dite', () => {
  const t = computeTrend(30, 20);
  assert.equal(t.direction, 'up');
  assert.equal(t.percent, 50);
  assert.equal(trendSymbol(t.direction), '↑');
  assert.match(t.sentence, /\+50 %/);
});

check('une baisse se dit baisse — rien n’est enjolivé', () => {
  const t = computeTrend(10, 20);
  assert.equal(t.direction, 'down');
  assert.equal(t.percent, -50);
  assert.equal(trendSymbol(t.direction), '↓');
});

check('tomber à zéro est une baisse de 100 %, pas une absence de tendance', () => {
  const t = computeTrend(0, 12);
  assert.equal(t.direction, 'down');
  assert.equal(t.percent, -100);
});

check('les valeurs absurdes venues du réseau ne ressortent pas en face', () => {
  for (const [c, p] of [
    [Number.NaN, 10],
    [Number.POSITIVE_INFINITY, 10],
    [-5, 10],
    [10, Number.NaN],
    [10, -3],
  ] as Array<[number, number]>) {
    const t = computeTrend(c, p);
    assert.ok(
      t.percent === null || Number.isFinite(t.percent),
      `computeTrend(${c}, ${p}) rend ${t.percent}`,
    );
    assert.ok(!/Infinity|NaN|undefined/.test(t.sentence), `${c}/${p} → ${t.sentence}`);
  }
});

check('le seuil est un seuil : juste au-dessus, ça parle', () => {
  // Le seuil vaut 5 : 105 contre 100 fait exactement +5 %, donc pas du bruit.
  const t = computeTrend(100 + SEUIL_BRUIT, 100);
  assert.equal(t.direction, 'up', 'à la limite exacte, la variation est retenue');
  assert.equal(t.percent, SEUIL_BRUIT);
});

if (failures.length > 0) {
  console.error(`\n${failures.length} contrôle(s) en échec :`);
  for (const name of failures) console.error(`  - ${name}`);
  process.exit(1);
}
console.log('\nTendance : tous les contrôles passent.');
