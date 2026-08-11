import { useCallback, useMemo } from 'react';
import { useSync, useCollection, uid, stripMeta } from './SyncContext';
import {
  budgetVerdict,
  categoryBreakdown,
  defaultConfig,
  monthOf,
  normalizeConfig,
  totalCents,
  type Expense,
  type ExpenseConfig,
  type ExpenseData,
  type MonthKey,
} from './expenseEngine';

/**
 * Les dépenses.
 *
 * Le hook ne fait que lire, écrire et regrouper : tout ce qui se calcule vit
 * dans `expenseEngine.ts`, qui est pur et vérifié par `npm run check:tracking`.
 * C'est la même séparation que Projets/`projectEngine`, et pour la même
 * raison — un total faux ne se voit pas à l'écran, donc il doit être
 * vérifiable ailleurs qu'à l'œil.
 */

const CONFIG_ID = 'config';

export function useExpenses() {
  const { upsert, remove } = useSync();
  const rawExpenses = useCollection<Partial<ExpenseData>>('expenses');
  const rawConfig = useCollection<Partial<ExpenseConfig>>('expenseConfig');

  const config = useMemo<ExpenseConfig>(() => {
    const row = rawConfig.find((r) => r.id === CONFIG_ID);
    return row ? normalizeConfig(row) : defaultConfig();
  }, [rawConfig]);

  const expenses = useMemo<Expense[]>(
    () =>
      rawExpenses
        .map((row) => ({
          id: row.id,
          amountCents: Number(row.amountCents ?? 0),
          category: row.category ?? '',
          spentAt: row.spentAt ?? (row.createdAt ?? row.updatedAt).slice(0, 10),
          note: row.note ?? '',
          photoDataUrl: row.photoDataUrl ?? '',
          projectId: row.projectId,
          createdAt: row.createdAt ?? row.updatedAt,
          updatedAt: row.updatedAt,
        }))
        // Du plus récent au plus ancien : on saisit une dépense du jour et on
        // veut la voir apparaître en tête, pas la chercher.
        .sort((a, b) => b.spentAt.localeCompare(a.spentAt) || b.createdAt.localeCompare(a.createdAt)),
    [rawExpenses],
  );

  const saveConfig = useCallback(
    (next: ExpenseConfig) => upsert('expenseConfig', CONFIG_ID, { ...next }),
    [upsert],
  );

  const createExpense = useCallback(
    (input: Partial<ExpenseData> & { amountCents: number; category: string; spentAt: string }): string => {
      const id = uid('exp');
      upsert('expenses', id, {
        amountCents: Math.max(0, Math.round(input.amountCents)),
        category: input.category,
        spentAt: input.spentAt,
        note: input.note ?? '',
        photoDataUrl: input.photoDataUrl ?? '',
        projectId: input.projectId,
        createdAt: new Date().toISOString(),
      } satisfies ExpenseData);
      return id;
    },
    [upsert],
  );

  const updateExpense = useCallback(
    (id: string, patch: Partial<ExpenseData>) => {
      const current = rawExpenses.find((e) => e.id === id);
      if (!current) return;
      upsert('expenses', id, { ...stripMeta(current), ...patch });
    },
    [rawExpenses, upsert],
  );

  const deleteExpense = useCallback((id: string) => remove('expenses', id), [remove]);

  /** Les dépenses d'un mois `AAAA-MM`. */
  const ofMonth = useCallback(
    (month: MonthKey) => expenses.filter((e) => monthOf(e.spentAt) === month),
    [expenses],
  );

  /**
   * Les mois qui portent au moins une dépense, du plus récent au plus ancien.
   * Sert à ne pas proposer de naviguer indéfiniment vers un passé vide.
   */
  const monthsWithData = useMemo(
    () => [...new Set(expenses.map((e) => monthOf(e.spentAt)))].sort((a, b) => b.localeCompare(a)),
    [expenses],
  );

  /**
   * Le budget d'un projet : dépensé contre budget TOTAL (pas mensuel).
   *
   * Un projet a une enveloppe, pas un rythme mensuel — c'est ce qui le
   * distingue d'une catégorie, et c'est pour ça que les deux ne peuvent pas
   * partager le même réglage.
   */
  const projectBudget = useCallback(
    (projectId: string) =>
      budgetVerdict(
        totalCents(expenses.filter((e) => e.projectId === projectId)),
        config.projectBudgets[projectId] ?? 0,
      ),
    [expenses, config.projectBudgets],
  );

  /** Combien de dépenses portent l'identifiant de ce projet. */
  const countForProject = useCallback(
    (projectId: string) => expenses.filter((e) => e.projectId === projectId).length,
    [expenses],
  );

  return {
    config,
    saveConfig,
    expenses,
    ofMonth,
    monthsWithData,
    createExpense,
    updateExpense,
    deleteExpense,
    projectBudget,
    countForProject,
    /** Ré-exportés pour que l'écran n'ait pas à importer le moteur en plus du hook. */
    breakdownOf: (rows: Expense[]) => categoryBreakdown(rows, config),
    totalOf: totalCents,
  };
}
