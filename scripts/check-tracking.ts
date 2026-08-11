/**
 * Contrôle des moteurs Dépenses et Temps.
 *
 * Même raison d'être que `check:money` : ce que ces deux modules calculent ne
 * se vérifie pas à l'œil. Un budget qui bascule en « dépassé » à l'euro pile,
 * un mois de décembre qui passe à `2026-13`, une durée négative parce que
 * l'horloge a été remise à l'heure au milieu d'un chronomètre — trois bugs
 * silencieux, dont deux ne se manifesteraient qu'une fois par an.
 *
 *   npm run check:tracking
 */

import assert from 'node:assert/strict';
import {
  budgetVerdict,
  categoryBreakdown,
  categoryKey,
  currentMonth,
  defaultConfig,
  monthOf,
  normalizeConfig,
  shiftMonth,
  totalCents,
  type Expense,
} from '../src/state/expenseEngine.ts';
import { parsePositiveAmount } from '../src/lib/money.ts';
import {
  durationMs,
  formatDuration,
  formatStopwatch,
  isRunning,
  manualRange,
  msToBillableHours,
  normalizeTimeConfig,
  parseDurationInput,
  totalMs,
  weekStart,
} from '../src/state/timeEngine.ts';

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

function expense(partial: Partial<Expense> & { amountCents: number }): Expense {
  return {
    id: partial.id ?? `exp-${Math.random().toString(36).slice(2)}`,
    amountCents: partial.amountCents,
    category: partial.category ?? 'autre',
    spentAt: partial.spentAt ?? '2026-08-11',
    note: partial.note ?? '',
    photoDataUrl: partial.photoDataUrl ?? '',
    projectId: partial.projectId,
    createdAt: partial.createdAt ?? '2026-08-11T10:00:00.000Z',
    updatedAt: partial.updatedAt ?? '2026-08-11T10:00:00.000Z',
  };
}

console.log('Contrôle des moteurs — Dépenses et Temps\n');

/* ------------------------------- Les dépenses ------------------------------ */

check('la saisie d’un montant passe par la frontière euros/centimes existante', () => {
  assert.equal(parsePositiveAmount('12,50'), 1250);
  assert.equal(parsePositiveAmount('1 234,56'), 123456);
  assert.equal(parsePositiveAmount(''), 0);
  assert.equal(parsePositiveAmount('abc'), 0);
  // Une dépense négative est une faute de frappe, pas une recette.
  assert.equal(parsePositiveAmount('-40'), 0);
});

check('le total d’un mois est la somme exacte des dépenses', () => {
  const rows = [1999, 1999, 1999, 1].map((amountCents) => expense({ amountCents }));
  assert.equal(totalCents(rows), 5998);
  assert.equal(totalCents([]), 0);
});

check('le budget n’est PAS dépassé à l’euro pile', () => {
  const exact = budgetVerdict(50000, 50000);
  assert.equal(exact.state, 'ok', 'atteindre le budget n’est pas le dépasser');
  assert.equal(exact.deltaCents, 0);
  const over = budgetVerdict(50001, 50000);
  assert.equal(over.state, 'over');
  assert.equal(over.deltaCents, 1);
  const under = budgetVerdict(42000, 50000);
  assert.equal(under.state, 'ok');
  assert.equal(under.deltaCents, 8000, 'il reste 80 €');
});

check('sans budget réglé, rien n’est signalé', () => {
  const none = budgetVerdict(999999, 0);
  assert.equal(none.state, 'none');
  assert.equal(none.ratio, 0);
});

check('la barre de budget ne déborde jamais de son cadre', () => {
  assert.equal(budgetVerdict(300000, 100000).ratio, 1, 'triplé, la barre reste pleine');
  assert.equal(budgetVerdict(25000, 100000).ratio, 0.25);
});

check('la répartition somme à 100 % et se trie du plus gros au plus petit', () => {
  const config = defaultConfig();
  const rows = [
    expense({ amountCents: 6000, category: 'deplacement' }),
    expense({ amountCents: 3000, category: 'fournitures' }),
    expense({ amountCents: 1000, category: 'materiel' }),
  ];
  const slices = categoryBreakdown(rows, config);
  assert.deepEqual(
    slices.map((s) => s.key),
    ['deplacement', 'fournitures', 'materiel'],
  );
  assert.equal(slices[0].share, 0.6);
  const sum = slices.reduce((acc, s) => acc + s.share, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, 'les parts font bien 1');
});

check('un budget réglé mais jamais consommé reste visible', () => {
  // Sans cette règle, on réglerait deux fois le même budget sans jamais le
  // voir apparaître à l'écran.
  const config = { ...defaultConfig(), categoryBudgets: { materiel: 20000 } };
  const slices = categoryBreakdown([expense({ amountCents: 5000, category: 'fournitures' })], config);
  const materiel = slices.find((s) => s.key === 'materiel');
  assert.ok(materiel, 'la catégorie budgétée apparaît');
  assert.equal(materiel.totalCents, 0);
  assert.equal(materiel.budget.state, 'ok');
});

check('un mois vide ne produit ni NaN ni division par zéro', () => {
  const slices = categoryBreakdown([], defaultConfig());
  assert.deepEqual(slices, []);
});

check('le passage d’une année à l’autre est exact dans les deux sens', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-08', 0), '2026-08');
  assert.equal(shiftMonth('2026-01', -13), '2024-12');
  assert.equal(shiftMonth('2026-11', 14), '2028-01');
});

check('une dépense du 1er du mois ne tombe pas dans le mois précédent', () => {
  // Le piège classique : passer par un Date et perdre un jour sur le fuseau.
  assert.equal(monthOf('2026-08-01'), '2026-08');
  assert.equal(monthOf('2026-12-31'), '2026-12');
  assert.equal(currentMonth(new Date('2026-01-01T00:30:00')).length, 7);
});

check('une clé de catégorie est stable, sans accent ni espace', () => {
  assert.equal(categoryKey('Déplacement'), 'deplacement');
  assert.equal(categoryKey('Sous-traitance & régie'), 'sous-traitance-regie');
  assert.equal(categoryKey('  Matériel  '), 'materiel');
  assert.ok(categoryKey('💡').length > 0, 'jamais de clé vide');
});

check('un réglage abîmé redonne un module utilisable', () => {
  const broken = normalizeConfig({ categories: [], categoryBudgets: { a: -5, b: 0, c: 1200 } });
  assert.equal(broken.categories.length, defaultConfig().categories.length);
  // Un budget à zéro ou négatif est retiré, pas conservé : sinon l'écran
  // afficherait « dépassé » dès la première dépense.
  assert.deepEqual(broken.categoryBudgets, { c: 1200 });
  assert.deepEqual(normalizeConfig(undefined).categoryBudgets, {});
});

/* --------------------------------- Le temps -------------------------------- */

check('une période terminée mesure exactement son écart', () => {
  const entry = { startedAt: '2026-08-11T09:00:00.000Z', endedAt: '2026-08-11T11:30:00.000Z' };
  assert.equal(durationMs(entry), 2.5 * 3600000);
  assert.equal(isRunning(entry), false);
});

check('une période en cours se mesure jusqu’à maintenant', () => {
  const start = new Date('2026-08-11T09:00:00.000Z');
  const now = start.getTime() + 90 * 60000;
  const entry = { startedAt: start.toISOString(), endedAt: '' };
  assert.equal(isRunning(entry), true);
  assert.equal(durationMs(entry, now), 90 * 60000);
});

check('une horloge remise à l’heure ne fait jamais DIMINUER un total', () => {
  // Fin antérieure au début : sans garde, la durée serait négative et le total
  // de la semaine baisserait en ajoutant du travail.
  const entry = { startedAt: '2026-08-11T11:00:00.000Z', endedAt: '2026-08-11T09:00:00.000Z' };
  assert.equal(durationMs(entry), 0);
  const entries = [entry, { startedAt: '2026-08-11T09:00:00.000Z', endedAt: '2026-08-11T10:00:00.000Z' }];
  assert.equal(totalMs(entries), 3600000);
});

check('un horodatage illisible vaut zéro et non NaN', () => {
  assert.equal(durationMs({ startedAt: 'pas une date', endedAt: '' }), 0);
  assert.equal(durationMs({ startedAt: '2026-08-11T09:00:00.000Z', endedAt: 'x' }), 0);
});

check('les durées s’écrivent comme on les lit', () => {
  assert.equal(formatDuration(0), '0 min');
  assert.equal(formatDuration(45 * 60000), '45 min');
  assert.equal(formatDuration(2 * 3600000 + 5 * 60000), '2 h 05');
  assert.equal(formatDuration(3600000), '1 h 00');
  assert.equal(formatDuration(Number.NaN), '0 min');
});

check('le chronomètre affiche bien les secondes', () => {
  assert.equal(formatStopwatch(0), '00:00:00');
  assert.equal(formatStopwatch(7 * 1000), '00:00:07');
  assert.equal(formatStopwatch(3661 * 1000), '01:01:01');
  assert.equal(formatStopwatch(-5), '00:00:00');
});

check('la conversion en heures facturables s’arrête au centième', () => {
  assert.equal(msToBillableHours(3600000), 1);
  assert.equal(msToBillableHours(5400000), 1.5);
  assert.equal(msToBillableHours(20 * 60000), 0.33);
  assert.equal(msToBillableHours(0), 0);
});

check('une saisie manuelle produit une période, pas une durée à part', () => {
  // C'est l'invariant du module : la durée se relit toujours du début et de la
  // fin, qu'elle vienne du chronomètre ou de la main.
  const range = manualRange('2026-08-11', 150);
  assert.equal(durationMs(range), 150 * 60000);
  assert.equal(isRunning(range), false);
  // Et elle reste bien dans le jour demandé.
  assert.ok(range.startedAt.startsWith('2026-08-1'), 'le jour est conservé');
});

check('la durée tapée est comprise sous toutes ses formes', () => {
  assert.equal(parseDurationInput('2'), 120);
  assert.equal(parseDurationInput('2h'), 120);
  assert.equal(parseDurationInput('1h30'), 90);
  assert.equal(parseDurationInput('45min'), 45);
  assert.equal(parseDurationInput('45m'), 45);
  assert.equal(parseDurationInput('1,5'), 90);
  assert.equal(parseDurationInput('1.5h'), 90);
  assert.equal(parseDurationInput(''), 0);
  assert.equal(parseDurationInput('bonjour'), 0);
});

check('la semaine commence un lundi, y compris le dimanche', () => {
  // 2026-08-11 est un mardi ; la semaine part du lundi 10.
  assert.equal(weekStart('2026-08-11'), '2026-08-10');
  assert.equal(weekStart('2026-08-10'), '2026-08-10', 'le lundi est son propre début');
  // Le dimanche 16 appartient encore à la semaine du 10 — le piège de
  // `getDay()`, qui vaut 0 ce jour-là.
  assert.equal(weekStart('2026-08-16'), '2026-08-10');
  assert.equal(weekStart('2026-08-17'), '2026-08-17', 'le lundi suivant');
});

check('le tarif horaire refuse les valeurs absurdes', () => {
  assert.equal(normalizeTimeConfig({ hourlyRateCents: 7500 }).hourlyRateCents, 7500);
  assert.equal(normalizeTimeConfig({ hourlyRateCents: -1 }).hourlyRateCents, 0);
  assert.equal(normalizeTimeConfig(undefined).hourlyRateCents, 0);
});

console.log('');
if (failures.length > 0) {
  console.error(`ÉCHEC — ${failures.length} contrôle(s) en échec :`);
  for (const name of failures) console.error(`  · ${name}`);
  process.exit(1);
}
console.log('OK — budgets, mois, durées et semaines sont exacts.');
