/**
 * Le moteur du module Dépenses — tout ce qui se calcule, sans écran.
 *
 * ## Pourquoi ce module existe séparément de l'écran
 *
 * Un budget dépassé, une répartition fausse d'un centime, un mois qui commence
 * un jour trop tôt : rien de tout cela ne se voit à l'œil. Ces fonctions sont
 * donc pures et vérifiées par `npm run check:tracking`, exactement comme
 * l'arithmétique de facturation l'est par `check:money`.
 *
 * ## Le parti pris du module
 *
 * Une dépense n'est PAS une ligne de comptabilité. Pas de TVA à ventiler, pas
 * de HT/TTC à distinguer, pas de numéro : un montant tel qu'il a été payé, une
 * catégorie prise dans une liste courte, un jour, et — c'est ce qui remplace
 * la colonne de tableur — la photo du justificatif. Tout ce qui relève de la
 * comptabilité vit déjà dans Facturation ; le mélanger ici redonnerait
 * précisément le tableur que ce module doit remplacer.
 */

/* -------------------------------- Les formes ------------------------------- */

export interface ExpenseCategory {
  /** Stable, jamais réaffichée : c'est elle que portent les dépenses. */
  key: string;
  label: string;
}

/** Ce qui est stocké pour une dépense (`id` est la clé d'enregistrement). */
export interface ExpenseData {
  /** Montant payé, en centimes entiers — voir src/lib/money.ts. */
  amountCents: number;
  /** Clé de catégorie. Une catégorie retirée du réglage laisse sa clé ici. */
  category: string;
  /** Jour ISO `AAAA-MM-JJ`. Une dépense n'a pas d'heure. */
  spentAt: string;
  note: string;
  /**
   * Photo du justificatif en data-URL, réduite avant stockage par le même
   * helper que la médiathèque (`resizeImageToDataUrl`). Chaîne vide = aucune.
   */
  photoDataUrl: string;
  /** Rattachement optionnel à un projet — le même `projectId` que partout. */
  projectId?: string;
  createdAt: string;
}

export interface Expense extends ExpenseData {
  id: string;
  updatedAt: string;
}

export interface ExpenseConfig {
  categories: ExpenseCategory[];
  /** Budget MENSUEL par clé de catégorie, en centimes. Absente = aucun budget. */
  categoryBudgets: Record<string, number>;
  /** Budget TOTAL par projet, en centimes. Absent = aucun budget. */
  projectBudgets: Record<string, number>;
}

/**
 * Les catégories de départ.
 *
 * Volontairement courtes et non métier : elles doivent parler à une agence
 * créative comme à un commerce. « Autre » est la soupape — sans elle, on
 * hésite, et une dépense qu'on hésite à ranger est une dépense qu'on ne
 * saisit pas.
 */
export function defaultConfig(): ExpenseConfig {
  return {
    categories: [
      { key: 'fournitures', label: 'Fournitures' },
      { key: 'deplacement', label: 'Déplacement' },
      { key: 'prestataire', label: 'Prestataire' },
      { key: 'materiel', label: 'Matériel' },
      { key: 'autre', label: 'Autre' },
    ],
    categoryBudgets: {},
    projectBudgets: {},
  };
}

/** Une clé de catégorie à partir d'un intitulé libre, sans accents ni espaces. */
export function categoryKey(label: string): string {
  const base = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  // Un intitulé fait uniquement d'emoji ou de ponctuation ne doit pas produire
  // une clé vide, qui collisionnerait avec la suivante du même genre.
  return base || `cat-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Relit un enregistrement de réglage en garantissant la forme.
 *
 * Un réglage à moitié écrit (version antérieure, écriture interrompue) doit
 * donner un module utilisable, pas un écran vide : l'absence de catégories
 * retombe sur les catégories de départ.
 */
export function normalizeConfig(row: Partial<ExpenseConfig> | undefined): ExpenseConfig {
  const fallback = defaultConfig();
  const categories = Array.isArray(row?.categories)
    ? row.categories
        .filter((c): c is ExpenseCategory => Boolean(c && typeof c.key === 'string'))
        .map((c) => ({ key: c.key, label: String(c.label ?? c.key) }))
    : [];
  return {
    categories: categories.length > 0 ? categories : fallback.categories,
    categoryBudgets: sanitizeAmounts(row?.categoryBudgets),
    projectBudgets: sanitizeAmounts(row?.projectBudgets),
  };
}

/** Ne garde que des montants entiers strictement positifs — 0 signifie « pas de budget ». */
function sanitizeAmounts(input: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!input || typeof input !== 'object') return out;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const cents = Math.round(Number(value));
    if (Number.isFinite(cents) && cents > 0) out[key] = cents;
  }
  return out;
}

/** L'intitulé d'une catégorie ; sa clé si elle a été retirée du réglage. */
export function categoryLabel(config: ExpenseConfig, key: string): string {
  const found = config.categories.find((c) => c.key === key);
  if (found) return found.label;
  return key || 'Sans catégorie';
}

/* --------------------------------- Les mois -------------------------------- */

/**
 * Le mois est manipulé comme une chaîne `AAAA-MM`, jamais comme un `Date`.
 *
 * C'est délibéré : `new Date(2026, 0, 31)` puis « mois suivant » donne le
 * 3 mars, et un décalage de fuseau suffit à faire tomber une dépense du
 * 1er août dans juillet. Sur des chaînes, aucun des deux ne peut arriver.
 */
export type MonthKey = string;

export function monthOf(isoDayOrStamp: string): MonthKey {
  return isoDayOrStamp.slice(0, 7);
}

export function currentMonth(now: Date = new Date()): MonthKey {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 7);
}

/** `2026-08` + 1 → `2026-09` ; `2026-12` + 1 → `2027-01`. */
export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7)) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(index)) return month;
  const total = year * 12 + index + delta;
  const nextYear = Math.floor(total / 12);
  const nextIndex = total - nextYear * 12;
  return `${String(nextYear).padStart(4, '0')}-${String(nextIndex + 1).padStart(2, '0')}`;
}

/** `2026-08` → « août 2026 ». */
export function monthLabel(month: MonthKey): string {
  const date = new Date(`${month}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/* -------------------------------- Les budgets ------------------------------- */

export type BudgetState = 'none' | 'ok' | 'over';

export interface BudgetVerdict {
  state: BudgetState;
  /** Budget retenu, en centimes ; 0 quand il n'y en a pas. */
  budgetCents: number;
  spentCents: number;
  /** Ce qu'il reste (positif) ou le dépassement (positif aussi — voir `state`). */
  deltaCents: number;
  /** Part consommée, bornée à 1 pour dessiner une barre qui ne déborde pas. */
  ratio: number;
}

/**
 * « Dans le budget » ou « dépassé », et de combien.
 *
 * Un seul calcul pour les deux portées (catégorie et projet) : deux versions
 * finiraient par diverger d'un `>` contre un `>=`, et c'est exactement le
 * genre d'écart qui fait dire à l'écran « dépassé » à l'euro pile.
 */
export function budgetVerdict(spentCents: number, budgetCents: number): BudgetVerdict {
  const spent = Number.isFinite(spentCents) ? Math.round(spentCents) : 0;
  const budget = Number.isFinite(budgetCents) && budgetCents > 0 ? Math.round(budgetCents) : 0;
  if (budget === 0) {
    return { state: 'none', budgetCents: 0, spentCents: spent, deltaCents: 0, ratio: 0 };
  }
  // Atteindre le budget exactement n'est PAS un dépassement : dire « dépassé »
  // à l'euro pile est faux, et c'est le premier reproche qu'on ferait à
  // l'indicateur.
  const over = spent > budget;
  return {
    state: over ? 'over' : 'ok',
    budgetCents: budget,
    spentCents: spent,
    deltaCents: Math.abs(budget - spent),
    ratio: Math.min(1, spent / budget),
  };
}

/* ------------------------------ Les répartitions ---------------------------- */

export interface CategorySlice {
  key: string;
  label: string;
  totalCents: number;
  /** Part du total du mois, de 0 à 1. Zéro si le mois est vide. */
  share: number;
  budget: BudgetVerdict;
}

/**
 * La répartition d'un mois par catégorie, du plus gros au plus petit.
 *
 * Les catégories sans dépense sont écartées SAUF si elles portent un budget :
 * un budget réglé puis jamais consommé doit se voir, sinon on ne saura pas
 * qu'il existe — et on le règlera une deuxième fois.
 */
export function categoryBreakdown(expenses: Expense[], config: ExpenseConfig): CategorySlice[] {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    const key = expense.category || 'autre';
    totals.set(key, (totals.get(key) ?? 0) + expense.amountCents);
  }
  for (const key of Object.keys(config.categoryBudgets)) {
    if (!totals.has(key)) totals.set(key, 0);
  }

  const grand = [...totals.values()].reduce((sum, value) => sum + value, 0);
  return [...totals.entries()]
    .map(([key, totalCents]) => ({
      key,
      label: categoryLabel(config, key),
      totalCents,
      share: grand > 0 ? totalCents / grand : 0,
      budget: budgetVerdict(totalCents, config.categoryBudgets[key] ?? 0),
    }))
    .sort((a, b) => b.totalCents - a.totalCents || a.label.localeCompare(b.label));
}

/** Le total, en centimes. Une somme d'entiers : jamais de dérive de virgule. */
export function totalCents(expenses: Expense[]): number {
  return expenses.reduce((sum, expense) => sum + expense.amountCents, 0);
}
