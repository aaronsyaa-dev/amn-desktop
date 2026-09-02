/**
 * Contrôle de la grâce du serveur qui redémarre (Bloc 8).
 *
 * `src/shared/reprise.ts` décide quand une lecture est rejouée et ce qu'on
 * dit quand on renonce. Quatre propriétés, chacune contre une régression
 * précise :
 *
 *   1. un 502 puis un 200 rend le résultat — et l'attente a été signalée,
 *      puis éteinte ;
 *   2. un 500 n'est PAS rejoué : le serveur a répondu, il faut le montrer ;
 *   3. quatre 502 de suite finissent en français, en trois parties, avec le
 *      code entre parenthèses — jamais « Bad Gateway » nu ;
 *   4. un réseau muet est rejoué le même nombre de fois, puis l'erreur
 *      d'origine remonte (c'est elle qui porte le marqueur « injoignable »).
 *
 *   npm run check:reprise
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

type Tentative<T> = { ok: true; valeur: T } | { ok: false; statut: number };
interface Reprise {
  DELAIS_REPRISE_MS: readonly number[];
  serveurAbsent(statut: number): boolean;
  messageServeurAbsent(statut?: number): string;
  avecReprise<T>(
    tenter: () => Promise<Tentative<T>>,
    options?: { signaler?: (enCours: boolean) => void; attendre?: (ms: number) => Promise<void> },
  ): Promise<T>;
}

const R = await loadFromSrc<Reprise>('src/shared/reprise.ts');
const failures: string[] = [];
const check = (nom: string, f: () => Promise<void>) =>
  f().catch((err) => failures.push(`${nom} — ${err instanceof Error ? err.message : String(err)}`));

const immediat = async () => {};

await check('502 puis 200 : le résultat arrive, et l’attente a été dite puis éteinte', async () => {
  const reponses: Tentative<string>[] = [{ ok: false, statut: 502 }, { ok: false, statut: 503 }, { ok: true, valeur: 'liste' }];
  const signaux: boolean[] = [];
  const valeur = await R.avecReprise(async () => reponses.shift()!, { signaler: (v) => signaux.push(v), attendre: immediat });
  assert.equal(valeur, 'liste');
  assert.deepEqual(signaux, [true, false], 'allumé une fois, éteint une fois');
});

await check('500 : pas de reprise, le serveur a répondu', async () => {
  let appels = 0;
  await assert.rejects(
    R.avecReprise(async () => {
      appels += 1;
      return { ok: false, statut: 500 };
    }, { attendre: immediat }),
  );
  assert.equal(appels, 1);
});

await check('quatre 502 : l’erreur est en français, en trois parties, avec le code entre parenthèses', async () => {
  let appels = 0;
  const signaux: boolean[] = [];
  await assert.rejects(
    R.avecReprise(async () => {
      appels += 1;
      return { ok: false, statut: 502 };
    }, { signaler: (v) => signaux.push(v), attendre: immediat }),
    (err: Error) => {
      assert.match(err.message, /^Le serveur n’a pas répondu \(502\)\./, 'ce qui s’est passé');
      assert.match(err.message, /Rien n’est perdu/, 'ce que ça signifie');
      assert.match(err.message, /Réessayez dans un instant\.$/, 'ce qu’on peut faire');
      assert.ok(!/Bad Gateway/.test(err.message), 'jamais le texte anglais nu');
      return true;
    },
  );
  assert.equal(appels, R.DELAIS_REPRISE_MS.length + 1, 'une tentative, puis une reprise par délai');
  assert.deepEqual(signaux, [true, false]);
});

await check('réseau muet : rejoué autant de fois, puis l’erreur d’origine remonte', async () => {
  let appels = 0;
  await assert.rejects(
    R.avecReprise(async () => {
      appels += 1;
      throw new Error('[amn-api-injoignable] amn-api est injoignable.');
    }, { attendre: immediat }),
    /amn-api-injoignable/,
  );
  assert.equal(appels, R.DELAIS_REPRISE_MS.length + 1);
});

await check('les codes d’absence sont exactement 502, 503, 504', async () => {
  assert.deepEqual([500, 501, 502, 503, 504, 505].filter(R.serveurAbsent), [502, 503, 504]);
  const somme = R.DELAIS_REPRISE_MS.reduce((a, b) => a + b, 0);
  assert.ok(somme <= 8000, `l’attente totale reste courte (${somme} ms)`);
});

if (failures.length > 0) {
  console.error('\nGrâce du serveur : contrôles en échec.\n');
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log('Grâce du serveur : cinq contrôles verts — 502/503/504 rejoués, 500 montré, erreur en trois parties.');
