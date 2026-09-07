/**
 * Le devis chiffré, éprouvé en Node sur le vrai module.
 *
 * Ce que ces cas protègent : un devis qui part chez un artisan doit afficher
 * la somme exacte de ses lignes, et un devis d'AVANT cette version doit sortir
 * exactement comme il sortait déjà.
 *
 * L'arithmétique elle-même (totaux, TVA ventilée, acompte) est éprouvée dans
 * `check:money`, où elle vit.
 *
 *   npm run check:quote
 */
import assert from 'node:assert/strict';
import {
  displayLines,
  emptyQuoteLine,
  hasDetailedLines,
  normalizeQuoteLines,
  quoteLines,
  usableLines,
} from '../src/lib/quote.ts';
import { depositSplit, documentTotals, eurosToCents, formatCents, lineAmounts } from '../src/lib/money.ts';
import type { InvoiceLine } from '../src/shared/api.ts';

let n = 0;
function cas(titre: string, fn: () => void): void {
  fn();
  n += 1;
  console.log(`  OK  ${titre}`);
}

/** `Intl` sépare les milliers par une espace INSÉCABLE ; comparer à une
    espace ordinaire tapée à la main échouerait pour la mauvaise raison. */
const lisible = (texte: string): string => texte.replace(/\s/g, ' ');

const ligne = (label: string, quantity: number, euros: number, vatRate = 0): InvoiceLine => ({
  id: label,
  label,
  quantity,
  unitPriceCents: eurosToCents(euros),
  vatRate,
});

/** La ligne de secours telle que la fabriquera l'écran d'impression. */
const secours = (label: string, priceEuro: number): InvoiceLine => ({
  id: 'forfait',
  label,
  quantity: 1,
  unitPriceCents: eurosToCents(priceEuro),
  vatRate: 0,
});

console.log('\nLe devis chiffré\n');

/* -------------------------------------------------- les devis d'avant --- */

cas('un devis sans lignes sort comme avant : une ligne, son prix', () => {
  const vieux = { lines: undefined, priceEuro: 1450 };
  assert.equal(hasDetailedLines(vieux), false);
  const lignes = quoteLines(vieux, secours('Supervision annuelle', vieux.priceEuro));
  assert.equal(lignes.length, 1);
  assert.equal(lignes[0].label, 'Supervision annuelle');
  assert.equal(lignes[0].quantity, 1);
  assert.equal(lignes[0].unitPriceCents, 145000);
  assert.equal(lignes[0].vatRate, 0, 'aucune TVA inventée sur un document qui n’en portait pas');
  assert.equal(documentTotals(lignes).netCents, 145000);
  assert.equal(documentTotals(lignes).vatCents, 0);
});

cas('un tableau de lignes VIDE compte comme aucun détail', () => {
  assert.equal(hasDetailedLines({ lines: [] }), false);
  const lignes = quoteLines({ lines: [] }, secours('Forfait', 300));
  assert.equal(lignes.length, 1);
  assert.equal(lignes[0].label, 'Forfait');
});

cas('un prix à virgule ne perd pas son centime', () => {
  assert.equal(secours('x', 1234.56).unitPriceCents, 123456);
  assert.equal(secours('x', 19.99).unitPriceCents, 1999);
});

/* ---------------------------------------------------- le devis détaillé - */

cas('un chantier de maçon : le total est la somme exacte des lignes', () => {
  const chantier = {
    lines: [
      ligne('Mur en parpaings, 18 m² à 95 €/m²', 18, 95),
      ligne('Enduit de façade, 18 m²', 18, 42),
      ligne('Location échafaudage, 4 jours', 4, 65),
      ligne('Évacuation des gravats, forfait', 1, 180),
    ],
  };
  assert.equal(hasDetailedLines(chantier), true);
  const lignes = quoteLines(chantier, secours('jamais utilisé', 0));
  assert.equal(lignes.length, 4, 'la ligne de secours n’est pas ajoutée quand il y a du détail');
  const t = documentTotals(lignes);
  assert.equal(t.netCents, 171000 + 75600 + 26000 + 18000);
  assert.equal(t.netCents, 290600);
  assert.equal(lisible(formatCents(t.netCents)), '2 906,00 €');
  assert.equal(t.vatCents, 0, 'en franchise en base, aucune TVA');
});

cas('les lignes rendues sont bien celles du devis, sans copie ni réordonnancement', () => {
  const l = [ligne('a', 1, 10), ligne('b', 2, 20)];
  const rendues = quoteLines({ lines: l }, secours('x', 0));
  assert.equal(rendues, l);
});

cas('la quantité décimale s’arrondit une fois, pas deux', () => {
  // 2,5 jours à 33,33 € = 83,325 € → 83,33 €, et pas trois décimales au pied
  assert.equal(lineAmounts(2.5, 3333, 0).netCents, 8333);
  assert.equal(documentTotals([ligne('a', 2.5, 33.33), ligne('b', 2.5, 33.33)]).netCents, 16666);
});

cas('deux taux de TVA se ventilent taux par taux', () => {
  const t = documentTotals([ligne('main-d’œuvre rénovation', 1, 1000, 10), ligne('matériaux', 1, 500, 20)]);
  assert.equal(t.netCents, 150000);
  assert.equal(t.vatCents, 20000);
  assert.deepEqual(
    t.vatBuckets.map((b) => [b.rate, b.netCents, b.vatCents]),
    [
      [10, 100000, 10000],
      [20, 50000, 10000],
    ],
  );
});

/* ------------------------------ relecture de ce qui revient du serveur -- */

cas('des lignes malformées ne font pas afficher NaN sur un document envoyé', () => {
  const lues = normalizeQuoteLines([
    { id: 'a', label: 'Bonne ligne', quantity: 2, unitPriceCents: 5000, vatRate: 20 },
    { label: 'sans id', quantity: '3', unitPriceCents: '1500', vatRate: '10' },
    { id: 'c', label: 'chiffres cassés', quantity: 'beaucoup', unitPriceCents: null, vatRate: undefined },
    { id: 'd', label: 'centimes fractionnaires', quantity: 1, unitPriceCents: 1999.7, vatRate: 0 },
    null,
    'pas un objet',
    42,
  ]);
  assert.equal(lues.length, 4, 'ce qui n’est pas un objet est écarté');
  assert.equal(lues[1].id, 'line-1', 'un identifiant est fabriqué plutôt que laissé vide');
  assert.deepEqual([lues[1].quantity, lues[1].unitPriceCents, lues[1].vatRate], [3, 1500, 10]);
  assert.deepEqual([lues[2].quantity, lues[2].unitPriceCents, lues[2].vatRate], [0, 0, 0]);
  assert.equal(lues[3].unitPriceCents, 2000, 'un prix unitaire reste un entier de centimes');
  for (const l of lues) {
    const montant = lineAmounts(l.quantity, l.unitPriceCents, l.vatRate).netCents;
    assert.ok(Number.isFinite(montant), `ligne ${l.id} calculable`);
    assert.ok(!formatCents(montant).includes('NaN'), `ligne ${l.id} affichable`);
  }
  assert.ok(!formatCents(documentTotals(lues).grossCents).includes('NaN'), 'et le total aussi');
});

cas('les identifiants fabriqués restent distincts', () => {
  const lues = normalizeQuoteLines([{ label: 'a' }, { label: 'b' }, { label: 'c' }]);
  assert.equal(new Set(lues.map((l) => l.id)).size, 3);
});

cas('un tableau qui n’en est pas un se lit comme aucune ligne', () => {
  assert.deepEqual(normalizeQuoteLines(undefined), []);
  assert.deepEqual(normalizeQuoteLines(null), []);
  assert.deepEqual(normalizeQuoteLines('[]'), []);
  assert.deepEqual(normalizeQuoteLines({ 0: {} }), []);
  assert.deepEqual(normalizeQuoteLines(7), []);
});

/* ------------------------------------------------------ la saisie -------- */

cas('une ligne vierge est neutre dans les totaux', () => {
  const l = emptyQuoteLine('x');
  assert.equal(lineAmounts(l.quantity, l.unitPriceCents, l.vatRate).netCents, 0);
});

cas('une ligne restée vide n’est pas enregistrée', () => {
  const saisie = [ligne('Mur en parpaings', 18, 95), emptyQuoteLine('vide'), ligne('Enduit', 18, 42)];
  const gardees = usableLines(saisie);
  assert.equal(gardees.length, 2);
  assert.deepEqual(gardees.map((l) => l.label), ['Mur en parpaings', 'Enduit']);
});

cas('une ligne avec un intitulé mais pas de prix est gardée — c’est un poste à chiffrer', () => {
  assert.equal(usableLines([{ ...emptyQuoteLine('a'), label: 'Peinture, à confirmer' }]).length, 1);
});

cas('une ligne avec un prix mais pas d’intitulé est gardée — elle se voit sur le document', () => {
  assert.equal(usableLines([{ ...emptyQuoteLine('a'), unitPriceCents: 5000 }]).length, 1);
});

cas('un devis entièrement vide ne garde aucune ligne, et retombe donc sur le forfait', () => {
  const gardees = usableLines([emptyQuoteLine('a'), emptyQuoteLine('b')]);
  assert.deepEqual(gardees, []);
  assert.equal(hasDetailedLines({ lines: gardees }), false);
});

/* --------------------- c'est l'identité qui décide de la TVA ----------- */

cas('en franchise en base, aucune TVA n’est affichée, quoi que portent les lignes', () => {
  // L'enchaînement réel : elle fait un devis AVANT de remplir son identité,
  // donc les lignes naissent à 20 % ; elle coche ensuite la franchise.
  const saisies = [ligne('Parquet chêne, 20 m²', 20, 50, 20), ligne('Plinthes, forfait', 1, 120, 0)];
  const montrees = displayLines(saisies, true);

  assert.deepEqual(montrees.map((l) => l.vatRate), [0, 0]);
  const t = documentTotals(montrees);
  assert.equal(t.netCents, 112000);
  assert.equal(t.vatCents, 0, 'aucune taxe qu’elle n’a pas le droit de collecter');
  assert.equal(t.grossCents, t.netCents, 'le TTC est le HT : il n’y a rien en plus');
});

cas('les lignes ne sont pas modifiées : seul l’affichage l’est', () => {
  const saisies = [ligne('a', 1, 100, 20)];
  const montrees = displayLines(saisies, true);
  assert.equal(saisies[0].vatRate, 20, 'le devis garde ce qu’elle a saisi');
  assert.equal(montrees[0].vatRate, 0);
  assert.notEqual(montrees[0], saisies[0], 'la ligne affichée est une copie');
});

cas('assujettie, rien n’est touché', () => {
  const saisies = [ligne('a', 1, 100, 20), ligne('b', 1, 50, 10)];
  assert.equal(displayLines(saisies, false), saisies);
});

cas('le hors-taxes reste le même dans les deux cas — c’est ce qu’elle réclame', () => {
  const saisies = [ligne('Parquet', 20, 50, 20), ligne('Plinthes', 1, 120, 0)];
  assert.equal(documentTotals(displayLines(saisies, true)).netCents,
               documentTotals(displayLines(saisies, false)).netCents);
});

cas('un acompte suit le total réellement dû, pas un TTC fantôme', () => {
  const saisies = [ligne('Chantier', 1, 1000, 20)];
  const enFranchise = documentTotals(displayLines(saisies, true));
  const assujettie = documentTotals(displayLines(saisies, false));
  assert.equal(depositSplit(enFranchise.grossCents, 30).depositCents, 30000, '30 % de 1 000 €');
  assert.equal(depositSplit(assujettie.grossCents, 30).depositCents, 36000, '30 % de 1 200 € TTC');
});

cas('aucun taux n’est masqué dans la ventilation, pas même 0 %', () => {
  // La ventilation prétend décomposer le hors-taxes : une base absente ferait
  // que la somme des lignes affichées ne redonne pas le total imprimé.
  const t = documentTotals([ligne('Parquet', 20, 50, 20), ligne('Plinthes', 1, 120, 0)]);
  assert.deepEqual(t.vatBuckets.map((b) => b.rate), [0, 20]);
  assert.equal(t.vatBuckets.reduce((somme, b) => somme + b.netCents, 0), t.netCents);
});

console.log(`\nOK — ${n} cas : le détail s’ajoute sans réécrire un seul devis existant.`);
