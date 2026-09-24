/**
 * check:fusion-sync — la fusion linéaire rend exactement ce que rendait l'ancienne.
 *
 * Dix mille lots aléatoires (identifiants qui se répètent, horodatages égaux,
 * plus anciens, plus récents, lots vides, cartes vides) : la nouvelle fusion
 * (une copie par lot) et l'ancienne (une copie par fiche) doivent produire la
 * même carte, fiche pour fiche — et rendre la carte d'origine inchangée,
 * même référence, quand rien ne gagne. Puis la mesure : 20 000 fiches.
 */
import assert from 'node:assert/strict';
import { fusionnerFicheAncienne, fusionnerLot, type FicheSync } from '../src/lib/fusionSync.ts';

type F = FicheSync & { v: number };
let graine = 42;
const hasard = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
const date = () => `2026-09-${String(10 + Math.floor(hasard() * 5)).padStart(2, '0')}T10:0${Math.floor(hasard() * 3)}:00.000Z`;
let n = 0;
for (let essai = 0; essai < 10_000; essai++) {
  const carte: Record<string, F> = {};
  for (let i = 0; i < Math.floor(hasard() * 20); i++) { const id = `r${Math.floor(hasard() * 25)}`; carte[id] = { id, updatedAt: date(), v: n++ }; }
  const lot: F[] = Array.from({ length: Math.floor(hasard() * 30) }, () => ({ id: `r${Math.floor(hasard() * 25)}`, updatedAt: date(), v: n++ }));
  let ancienne = carte;
  for (const f of lot) ancienne = fusionnerFicheAncienne(ancienne, f);
  const nouvelle = fusionnerLot(carte, lot);
  assert.deepEqual(nouvelle, ancienne, `essai ${essai}`);
  if (ancienne === carte) assert.equal(nouvelle, carte, `essai ${essai} : rien ne change, même référence`);
}
const gros: F[] = Array.from({ length: 20_000 }, (_, i) => ({ id: `m${i}`, updatedAt: '2026-09-24T10:00:00.000Z', v: i }));
let t = Date.now();
fusionnerLot({}, gros);
const lineaire = Date.now() - t;
t = Date.now();
let a: Record<string, F> = {};
for (const f of gros.slice(0, 5000)) a = fusionnerFicheAncienne(a, f);
const ancienne5000 = Date.now() - t;
console.log(`Fusion : OK — 10 000 lots aléatoires identiques à l'ancienne fusion. 20 000 fiches : ${lineaire} ms (l'ancienne : ${ancienne5000} ms pour 5 000 seulement).`);
