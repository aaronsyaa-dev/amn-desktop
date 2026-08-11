/**
 * Contrôle arithmétique de la facturation.
 *
 * Ce script existe parce qu'une erreur d'un centime ne se voit pas. Un écran
 * mal aligné se remarque en une seconde ; un total de TVA faux de deux
 * centimes traverse un devis, une facture, un envoi au client et une
 * déclaration sans que personne ne s'arrête dessus — jusqu'au jour où le
 * comptable demande pourquoi la somme des lignes ne fait pas le total.
 *
 * Il n'y a pas de lanceur de tests dans ce dépôt, et en ajouter un pour un
 * seul module serait disproportionné. On suit donc la convention déjà en place
 * ici : un `scripts/check-*` qui sort 0 ou 1, exécutable à la main comme en CI.
 *
 *   npm run check:money
 *
 * Node 22 sait exécuter du TypeScript en retirant les types, ce qui permet de
 * contrôler LE code réellement livré plutôt qu'une copie réécrite en JS.
 */

import assert from 'node:assert/strict';
import {
  documentTotals,
  eurosToCents,
  formatCents,
  formatVatRate,
  lineAmounts,
} from '../src/lib/money.ts';

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

/** Les espaces d'`Intl` ne sont pas des espaces ordinaires — on compare sur du normalisé. */
function normalized(text: string): string {
  return text.replace(/\s/g, ' ');
}

console.log('Contrôle arithmétique — src/lib/money.ts\n');

check('la saisie en euros devient des centimes entiers', () => {
  assert.equal(eurosToCents('1234.56'), 123456);
  assert.equal(eurosToCents('1234,56'), 123456);
  assert.equal(eurosToCents('1 234,56'), 123456);
  assert.equal(eurosToCents(1234.56), 123456);
  assert.equal(eurosToCents('1234'), 123400);
  assert.equal(eurosToCents(''), 0);
  assert.equal(eurosToCents('abc'), 0);
});

check('un montant recopié depuis l’écran se relit sans perte', () => {
  // L'aller-retour complet : ce que l'application affiche doit pouvoir être
  // collé dans un champ de saisie et redonner exactement la même valeur.
  for (const cents of [1, 99, 100, 1999, 123456, 100000000]) {
    assert.equal(eurosToCents(formatCents(cents)), cents, `aller-retour sur ${cents}`);
  }
});

check('trois lignes à 19,99 € font bien 59,97 € (et non 59,970000000000006)', () => {
  const { netCents } = documentTotals([{ quantity: 3, unitPriceCents: 1999, vatRate: 20 }]);
  assert.equal(netCents, 5997);
  assert.equal(normalized(formatCents(netCents)), '59,97 €');
});

check('0,1 + 0,2 vaut 0,30 — le piège des flottants', () => {
  const { netCents } = documentTotals([
    { quantity: 1, unitPriceCents: eurosToCents('0.10'), vatRate: 0 },
    { quantity: 1, unitPriceCents: eurosToCents('0.20'), vatRate: 0 },
  ]);
  assert.equal(netCents, 30);
  assert.equal(normalized(formatCents(netCents)), '0,30 €');
});

check('une quantité décimale s’arrondit une seule fois', () => {
  // 2,5 × 33,33 € = 83,325 € → 83,33 € (arrondi commercial), pas 83,32 €.
  const { netCents } = lineAmounts(2.5, 3333, 20);
  assert.equal(netCents, 8333);
});

check('la TVA est arrondie sur la base de la ligne, pas sur le prix unitaire', () => {
  // 3 × 19,99 € = 59,97 € HT ; 20 % = 11,994 € → 11,99 €.
  // Arrondir le PU d'abord donnerait 3 × 4,00 = 12,00 € : un centime de trop.
  const { vatCents, grossCents } = lineAmounts(3, 1999, 20);
  assert.equal(vatCents, 1199);
  assert.equal(grossCents, 7196);
});

check('la TVA se ventile par taux et les bases se recomposent', () => {
  const totals = documentTotals([
    { quantity: 1, unitPriceCents: 10000, vatRate: 20 },
    { quantity: 2, unitPriceCents: 5000, vatRate: 20 },
    { quantity: 1, unitPriceCents: 10000, vatRate: 5.5 },
  ]);
  assert.equal(totals.vatBuckets.length, 2, 'deux taux distincts');
  const [reduced, standard] = totals.vatBuckets;
  assert.equal(reduced.rate, 5.5, 'trié par taux croissant');
  assert.equal(reduced.netCents, 10000);
  assert.equal(reduced.vatCents, 550);
  assert.equal(standard.rate, 20);
  assert.equal(standard.netCents, 20000);
  assert.equal(standard.vatCents, 4000);

  // La règle qui compte pour un comptable : le pied de page est la somme des
  // ventilations, à l'unité près.
  assert.equal(totals.netCents, reduced.netCents + standard.netCents);
  assert.equal(totals.vatCents, reduced.vatCents + standard.vatCents);
  assert.equal(totals.grossCents, totals.netCents + totals.vatCents);
});

check('le total est TOUJOURS la somme exacte des lignes', () => {
  // Le seul invariant qui doit tenir quelles que soient les valeurs : c'est
  // lui qui rend une facture vérifiable à la main.
  const lines = [
    { quantity: 1, unitPriceCents: 3333, vatRate: 20 },
    { quantity: 7, unitPriceCents: 1417, vatRate: 5.5 },
    { quantity: 2.5, unitPriceCents: 8999, vatRate: 10 },
    { quantity: 0.5, unitPriceCents: 12345, vatRate: 2.1 },
    { quantity: 13, unitPriceCents: 777, vatRate: 0 },
  ];
  const totals = documentTotals(lines);
  const byHand = lines.reduce(
    (acc, l) => {
      const amounts = lineAmounts(l.quantity, l.unitPriceCents, l.vatRate);
      return { net: acc.net + amounts.netCents, vat: acc.vat + amounts.vatCents };
    },
    { net: 0, vat: 0 },
  );
  assert.equal(totals.netCents, byHand.net);
  assert.equal(totals.vatCents, byHand.vat);
  assert.equal(totals.grossCents, byHand.net + byHand.vat);
});

check('un document vide vaut zéro et non NaN', () => {
  const totals = documentTotals([]);
  assert.equal(totals.netCents, 0);
  assert.equal(totals.vatCents, 0);
  assert.equal(totals.grossCents, 0);
  assert.deepEqual(totals.vatBuckets, []);
});

check('une saisie absurde ne propage jamais NaN dans un total', () => {
  // Un champ vidé donne `Number('')` = 0, mais `Number('x')` donne NaN : sans
  // garde, un seul caractère de trop rendrait la facture entière illisible.
  const totals = documentTotals([
    { quantity: Number.NaN, unitPriceCents: 1000, vatRate: 20 },
    { quantity: 2, unitPriceCents: Number.NaN, vatRate: 20 },
    { quantity: 1, unitPriceCents: 5000, vatRate: Number.NaN },
  ]);
  assert.ok(Number.isFinite(totals.netCents), 'net fini');
  assert.ok(Number.isFinite(totals.vatCents), 'TVA finie');
  assert.equal(totals.netCents, 5000);
});

check('les taux s’affichent à la française', () => {
  assert.equal(formatVatRate(20), '20 %');
  assert.equal(formatVatRate(5.5), '5,5 %');
  assert.equal(formatVatRate(0), '0 %');
});

console.log('');
if (failures.length > 0) {
  console.error(`ÉCHEC — ${failures.length} contrôle(s) en échec :`);
  for (const name of failures) console.error(`  · ${name}`);
  process.exit(1);
}
console.log('OK — l’arithmétique de facturation est exacte au centime.');
