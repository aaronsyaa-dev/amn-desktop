import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, X } from 'lucide-react';
import { centsToInput, parsePositiveAmount } from '../../lib/money';
import { categoryKey, type ExpenseConfig } from '../../state/expenseEngine';
import { useFermetureEchap } from '../../lib/useFermetureEchap';

/**
 * Les catégories et les budgets, au même endroit.
 *
 * Réunis parce que c'est la même question posée deux fois — « comment je range
 * mes dépenses, et combien je me donne » — et parce qu'un budget se règle sur
 * une catégorie : deux écrans auraient obligé à faire l'aller-retour à chaque
 * ligne.
 *
 * ## Le budget est une somme, pas une formule
 *
 * On saisit un montant par mois et par catégorie, ou une enveloppe totale par
 * projet. Il n'y a ni report du reliquat, ni prorata, ni prévisionnel glissant :
 * ce sont exactement les mécanismes qui rendent un tableur de budget
 * incompréhensible à celui qui ne l'a pas construit. Ce qui est affiché
 * ensuite — « il reste 80 € », « dépassé de 45 € » — est donc toujours une
 * soustraction que l'utilisatrice peut refaire de tête.
 */
export function BudgetPanel({
  config,
  projects,
  onSave,
  onClose,
}: {
  config: ExpenseConfig;
  /** Les projets ouverts, pour proposer une enveloppe par projet. */
  projects: { id: string; title: string }[];
  onSave: (next: ExpenseConfig) => void;
  onClose: () => void;
}) {
  // Échap ferme, comme partout ailleurs. Voir lib/useFermetureEchap.
  useFermetureEchap(true, onClose);

  const [draft, setDraft] = useState<ExpenseConfig>(() => structuredClone(config));
  const [newCategory, setNewCategory] = useState('');

  const patch = (next: Partial<ExpenseConfig>) => setDraft((prev) => ({ ...prev, ...next }));

  const setLabel = (key: string, label: string) =>
    patch({ categories: draft.categories.map((c) => (c.key === key ? { ...c, label } : c)) });

  const setAmount = (scope: 'categoryBudgets' | 'projectBudgets', key: string, raw: string) => {
    const cents = parsePositiveAmount(raw);
    const next = { ...draft[scope] };
    // Un champ vidé RETIRE le budget plutôt que d'en poser un à zéro : sinon
    // l'écran afficherait « dépassé » sur la première dépense venue.
    if (cents > 0) next[key] = cents;
    else delete next[key];
    patch({ [scope]: next });
  };

  const addCategory = () => {
    const label = newCategory.trim();
    if (!label) return;
    const key = categoryKey(label);
    if (draft.categories.some((c) => c.key === key)) {
      setNewCategory('');
      return;
    }
    patch({ categories: [...draft.categories, { key, label }] });
    setNewCategory('');
  };

  const removeCategory = (key: string) => {
    // Jamais zéro catégorie : la saisie n'aurait plus rien à proposer.
    if (draft.categories.length <= 1) return;
    const budgets = { ...draft.categoryBudgets };
    delete budgets[key];
    patch({
      categories: draft.categories.filter((c) => c.key !== key),
      categoryBudgets: budgets,
    });
  };

  const save = () => {
    onSave(draft);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col border border-border-strong bg-surface"
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            Catégories et budgets
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-9 w-9 items-center justify-center text-text-secondary hover:text-text-primary"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Catégories · budget par mois
          </p>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">
            Laissez un budget vide si vous n’en voulez pas : rien ne sera signalé pour cette
            catégorie.
          </p>

          <div className="mt-3 flex flex-col gap-2">
            {draft.categories.map((cat) => (
              <div key={cat.key} className="flex items-center gap-2">
                <input
                  value={cat.label}
                  onChange={(e) => setLabel(cat.key, e.target.value)}
                  aria-label={`Nom de la catégorie ${cat.label}`}
                  className="input-focus min-h-11 min-w-0 flex-1 border border-border bg-bg px-3 text-sm text-text-primary outline-none"
                />
                <div className="flex min-h-11 w-28 flex-shrink-0 items-center border border-border bg-bg px-2">
                  <input
                    defaultValue={centsToInput(draft.categoryBudgets[cat.key] ?? 0)}
                    onChange={(e) => setAmount('categoryBudgets', cat.key, e.target.value)}
                    inputMode="decimal"
                    placeholder="—"
                    aria-label={`Budget mensuel de ${cat.label}`}
                    className="min-w-0 flex-1 bg-transparent text-right text-sm tabular-nums text-text-primary outline-none"
                  />
                  <span className="ml-1 flex-shrink-0 text-sm text-text-muted">€</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeCategory(cat.key)}
                  disabled={draft.categories.length <= 1}
                  aria-label={`Retirer ${cat.label}`}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center border border-border text-text-muted transition-colors hover:border-danger hover:text-danger disabled:opacity-30 disabled:hover:border-border disabled:hover:text-text-muted"
                >
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCategory();
                }
              }}
              placeholder="Ajouter une catégorie"
              className="input-focus min-h-11 min-w-0 flex-1 border border-dashed border-border bg-bg px-3 text-sm text-text-primary outline-none"
            />
            <button
              type="button"
              onClick={addCategory}
              aria-label="Ajouter la catégorie"
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center border border-border text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            >
              <Plus size={16} strokeWidth={2.25} />
            </button>
          </div>

          {/* ------------------------------------------------- projets ----- */}
          {projects.length > 0 && (
            <>
              <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                Projets · enveloppe totale
              </p>
              <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                Pas un budget par mois : le total que ce projet ne doit pas dépasser, du début à
                la fin.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {projects.map((project) => (
                  <div key={project.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm text-text-primary">
                      {project.title || 'Sans titre'}
                    </span>
                    <div className="flex min-h-11 w-28 flex-shrink-0 items-center border border-border bg-bg px-2">
                      <input
                        defaultValue={centsToInput(draft.projectBudgets[project.id] ?? 0)}
                        onChange={(e) => setAmount('projectBudgets', project.id, e.target.value)}
                        inputMode="decimal"
                        placeholder="—"
                        aria-label={`Enveloppe du projet ${project.title}`}
                        className="min-w-0 flex-1 bg-transparent text-right text-sm tabular-nums text-text-primary outline-none"
                      />
                      <span className="ml-1 flex-shrink-0 text-sm text-text-muted">€</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-border p-3">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 items-center border border-border px-3 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={save}
            className="flex min-h-11 items-center bg-accent px-4 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            Enregistrer
          </button>
        </div>
      </motion.div>
    </div>
  );
}
