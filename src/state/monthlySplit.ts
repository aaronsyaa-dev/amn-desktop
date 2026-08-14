import { roundHalfAwayFromZero } from '../lib/money';

/**
 * Synthèse mensuelle et répartition entre associés (BLOC B).
 *
 * ## Ce que ce module ne fait PAS
 *
 * Il ne stocke rien. Aucune collection, aucune table, aucun réglage à
 * maintenir. Il AGRÈGE ce qui existe déjà : les factures encaissées
 * (Facturation), les dépenses (Dépenses/Budget), et le temps passé (Temps).
 *
 * C'était explicitement demandé, et c'est aussi la seule version tenable : une
 * base parallèle de « chiffres du mois » divergerait de la facturation à la
 * première correction faite d'un côté et pas de l'autre, et personne ne saurait
 * lequel des deux totaux croire.
 *
 * ## Les deux modes de répartition
 *
 * - **Équitable** : le bénéfice divisé par le nombre d'associés.
 * - **Pondérée par le travail** : au prorata du temps réellement enregistré
 *   par chacun sur le mois.
 *
 * Le second n'est possible que parce que chaque enregistrement synchronisé
 * porte l'adresse de son auteur (`WRITER_KEY` dans `SyncContext`) : le temps
 * est donc attribuable sans qu'on ait eu à ajouter un champ « qui » au module
 * Temps.
 *
 * Quand personne n'a enregistré de temps, la pondération n'a aucune base — elle
 * retombe alors sur l'équitable ET le dit, plutôt que de diviser par zéro ou
 * d'attribuer 100 % au premier de la liste.
 */

/** Un mois civil, `AAAA-MM`. Même convention que le moteur des dépenses. */
export type MonthKey = string;

export function monthOfDay(isoDay: string): MonthKey {
  return String(isoDay ?? '').slice(0, 7);
}

export interface MonthlyInvoice {
  /** Jour d'encaissement ; vide si impayée. */
  paidAt: string;
  status: string;
  /** Total TTC encaissé, en centimes. */
  grossCents: number;
}

export interface MonthlyExpense {
  spentAt: string;
  amountCents: number;
}

export interface MonthlyWork {
  /** Adresse de la personne qui a enregistré le temps. */
  who: string;
  /** Jour ISO du début. */
  day: string;
  /** Durée en millisecondes. */
  durationMs: number;
}

export interface PartnerShare {
  who: string;
  /** Millisecondes travaillées sur le mois. */
  workedMs: number;
  /** Part du total, 0–1. */
  weight: number;
  /** Montant attribué, en centimes. */
  amountCents: number;
}

export type SplitMode = 'equal' | 'weighted';

export interface MonthlySummary {
  month: MonthKey;
  /** Encaissé sur le mois (factures marquées payées ce mois-là). */
  revenueCents: number;
  /** Dépenses du mois. */
  expensesCents: number;
  /** Ce qui reste. Peut être négatif — un mois peut être mauvais. */
  profitCents: number;
  shares: PartnerShare[];
  /** Mode réellement appliqué : voir `fellBackToEqual`. */
  mode: SplitMode;
  /**
   * Vrai quand la pondération a été demandée mais qu'aucun temps n'a été
   * enregistré. L'écran DOIT le dire : une répartition « pondérée » qui est en
   * fait équitable, sans le signaler, se découvre au moment du virement.
   */
  fellBackToEqual: boolean;
}

/**
 * Répartit un montant en centimes ENTIERS, sans perdre ni inventer un centime.
 *
 * Le reste de la division est distribué un centime à la fois, aux plus grosses
 * parts d'abord. Sans cela, 100 centimes entre trois associés donnent trois
 * fois 33 et un centime s'évapore — sur douze mois, les comptes ne tombent
 * plus juste et personne ne sait pourquoi.
 */
export function distributeCents(totalCents: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return new Array(n).fill(0);

  const sign = totalCents < 0 ? -1 : 1;
  const amount = Math.abs(totalCents);

  const exact = weights.map((w) => (amount * w) / sum);
  const floors = exact.map((v) => Math.floor(v));
  let remainder = amount - floors.reduce((a, b) => a + b, 0);

  // Les plus grosses décimales d'abord, puis l'ordre de déclaration pour que
  // deux exécutions identiques donnent le même résultat.
  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);

  const out = [...floors];
  for (const entry of order) {
    if (remainder <= 0) break;
    out[entry.index] += 1;
    remainder -= 1;
  }
  return out.map((v) => v * sign);
}

/**
 * La synthèse d'un mois.
 *
 * `partners` est la liste des associés — donnée, pas devinée : quelqu'un qui
 * n'a pas enregistré de temps ce mois-là reste un associé et doit apparaître,
 * à zéro s'il le faut.
 */
export function monthlySummary(input: {
  month: MonthKey;
  partners: string[];
  invoices: MonthlyInvoice[];
  expenses: MonthlyExpense[];
  work: MonthlyWork[];
  mode: SplitMode;
}): MonthlySummary {
  const { month, partners, mode } = input;

  const revenueCents = input.invoices
    .filter((i) => i.status === 'paid' && monthOfDay(i.paidAt) === month)
    .reduce((sum, i) => sum + (Number.isFinite(i.grossCents) ? i.grossCents : 0), 0);

  const expensesCents = input.expenses
    .filter((e) => monthOfDay(e.spentAt) === month)
    .reduce((sum, e) => sum + (Number.isFinite(e.amountCents) ? e.amountCents : 0), 0);

  const profitCents = revenueCents - expensesCents;

  const workedByPartner = new Map<string, number>(partners.map((p) => [p, 0]));
  for (const entry of input.work) {
    if (monthOfDay(entry.day) !== month) continue;
    if (!workedByPartner.has(entry.who)) continue; // un non-associé ne pondère rien
    const ms = Number.isFinite(entry.durationMs) ? Math.max(0, entry.durationMs) : 0;
    workedByPartner.set(entry.who, (workedByPartner.get(entry.who) ?? 0) + ms);
  }

  const worked = partners.map((p) => workedByPartner.get(p) ?? 0);
  const totalWorked = worked.reduce((a, b) => a + b, 0);
  const fellBackToEqual = mode === 'weighted' && totalWorked === 0;
  const effective: SplitMode = fellBackToEqual ? 'equal' : mode;

  const weights = effective === 'weighted' ? worked : partners.map(() => 1);
  const amounts = distributeCents(profitCents, weights);
  const weightSum = weights.reduce((a, b) => a + b, 0) || 1;

  return {
    month,
    revenueCents,
    expensesCents,
    profitCents,
    mode: effective,
    fellBackToEqual,
    shares: partners.map((who, index) => ({
      who,
      workedMs: worked[index],
      weight: weights[index] / weightSum,
      amountCents: amounts[index] ?? 0,
    })),
  };
}

/** Les douze derniers mois, du plus récent au plus ancien. */
export function recentMonths(count = 12, now = new Date()): MonthKey[] {
  const out: MonthKey[] = [];
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  for (let i = 0; i < count; i += 1) {
    out.push(`${year}-${String(month).padStart(2, '0')}`);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return out;
}

/** `2026-03` → « mars 2026 ». */
export function monthLabel(month: MonthKey): string {
  const [y, m] = String(month).split('-').map(Number);
  if (!y || !m) return month;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Millisecondes → « 12 h 30 ». */
export function formatWorked(ms: number): string {
  const minutes = roundHalfAwayFromZero(ms / 60000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}
