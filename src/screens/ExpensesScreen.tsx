import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, SlidersHorizontal, X } from 'lucide-react';
import { useExpenses } from '../state/useExpenses';
import { useProjectPicker } from '../state/useProjects';
import {
  categoryLabel,
  currentMonth,
  monthLabel,
  shiftMonth,
  type BudgetVerdict,
  type CategorySlice,
  type Expense,
} from '../state/expenseEngine';
import { formatCents, formatCentsCompact } from '../lib/money';
import { formatShortDay } from '../state/useInvoices';
import { ExpenseForm } from '../components/expenses/ExpenseForm';
import { BudgetPanel } from '../components/expenses/BudgetPanel';
import { ProjectTag } from '../components/projects/ProjectPicker';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { EmptyState, FirstRun } from '../components/EmptyState';
import { useFermetureEchap } from '../lib/useFermetureEchap';

/**
 * Dépenses — le module qui ne doit surtout pas ressembler à un tableur.
 *
 * ## Trois décisions de forme, et pourquoi
 *
 * 1. **Un mois à la fois.** Pas de filtre de dates, pas de plage à composer :
 *    une flèche à gauche, une flèche à droite. « Combien j'ai dépensé ce
 *    mois-ci » est la question qu'on se pose réellement, et elle doit être
 *    répondue avant même d'avoir cliqué.
 * 2. **Des barres, pas des nombres empilés.** La répartition par catégorie se
 *    lit d'un regard : la longueur DIT la proportion. Une colonne de montants
 *    alignés demande de comparer mentalement des chiffres — c'est exactement
 *    l'effort que le tableur impose et que ce module doit retirer.
 * 3. **Des fiches avec la photo, pas des lignes.** Une dépense de matériel
 *    avec la photo du produit se reconnaît sans lire. C'est utile partout, et
 *    décisif dans un métier où l'objet compte autant que son prix.
 *
 * ## La couleur
 *
 * Les barres sont dessinées dans l'accent de l'organisation, à des opacités
 * décroissantes — jamais dans une palette arc-en-ciel. Le noir et blanc plus
 * un accent est l'identité du produit ; une catégorie ne mérite pas d'y faire
 * exception, et sept teintes inventées ici seraient illisibles chez la
 * cliente qui a choisi l'ambre.
 */
export function ExpensesScreen() {
  const {
    config,
    saveConfig,
    // La liste COMPLÈTE, et pas seulement celle du mois : elle distingue
    // « module jamais utilisé » de « rien ce mois-ci », qui n'appellent pas le
    // même écran vide.
    expenses,
    ofMonth,
    monthsWithData,
    createExpense,
    updateExpense,
    deleteExpense,
    breakdownOf,
    totalOf,
  } = useExpenses();
  const projects = useProjectPicker();

  const [month, setMonth] = useState(() => currentMonth());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [budgetsOpen, setBudgetsOpen] = useState(false);
  const [preview, setPreview] = useState<Expense | null>(null);

  /*
    L'aperçu plein écran se ferme à Échap. Sortir d'un plein écran est
    précisément ce que cette touche fait partout ailleurs — dans le
    navigateur, dans le lecteur vidéo, dans le système.
  */
  useFermetureEchap(preview !== null, () => setPreview(null));
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const monthExpenses = useMemo(() => ofMonth(month), [ofMonth, month]);
  const total = useMemo(() => totalOf(monthExpenses), [monthExpenses, totalOf]);
  const breakdown = useMemo(() => breakdownOf(monthExpenses), [breakdownOf, monthExpenses]);

  const visible = useMemo(
    () => (categoryFilter ? monthExpenses.filter((e) => e.category === categoryFilter) : monthExpenses),
    [monthExpenses, categoryFilter],
  );

  /** Le plus ancien mois qui porte quelque chose — au-delà, reculer n'a rien à montrer. */
  const oldest = monthsWithData[monthsWithData.length - 1];
  const canGoBack = !oldest || month > oldest;

  const goToMonth = (delta: number) => {
    setMonth((prev) => shiftMonth(prev, delta));
    setCategoryFilter(null);
  };

  return (
    <section className="flex flex-col gap-4">
      <ScreenHeader
        eyebrow="Poste de travail · Dépenses"
        title="Dépenses"
        description="Ce que vous sortez, mois par mois."
        stats={[
          { label: 'Ce mois-ci', value: formatCentsCompact(total) },
          { label: 'Lignes affichées', value: visible.length },
        ]}
        actions={
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setBudgetsOpen(true)}
            title="Catégories et budgets"
            aria-label="Catégories et budgets"
            className="flex h-11 w-11 items-center justify-center border border-border text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:h-9 md:w-9"
          >
            <SlidersHorizontal size={16} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="flex h-11 items-center gap-2 bg-accent px-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover md:h-9"
          >
            <Plus size={16} strokeWidth={2.25} />
            <span className="hidden sm:inline">Nouvelle dépense</span>
            <span className="sm:hidden">Dépense</span>
          </button>
        </div>
        }
      />

      {/* ------------------------------------------------------ le mois ----- */}
      <div className="flex items-center gap-3 border border-border bg-surface p-4">
        <button
          type="button"
          onClick={() => goToMonth(-1)}
          disabled={!canGoBack}
          aria-label="Mois précédent"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center border border-border text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-30"
        >
          <ChevronLeft size={18} strokeWidth={2} />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
            {monthLabel(month)}
          </p>
          <p className="mt-0.5 truncate text-3xl font-bold tabular-nums tracking-tight text-text-primary sm:text-4xl">
            {formatCentsCompact(total)}
          </p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            {monthExpenses.length === 0
              ? 'aucune dépense'
              : `${monthExpenses.length} dépense${monthExpenses.length > 1 ? 's' : ''}`}
          </p>
        </div>

        <button
          type="button"
          onClick={() => goToMonth(1)}
          aria-label="Mois suivant"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center border border-border text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
        >
          <ChevronRight size={18} strokeWidth={2} />
        </button>
      </div>

      {/* -------------------------------------------------- répartition ----- */}
      {breakdown.length > 0 && (
        <div className="flex flex-col gap-2.5 border border-border bg-surface p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Répartition
          </p>
          {breakdown.map((slice, index) => (
            <CategoryBar
              key={slice.key}
              slice={slice}
              rank={index}
              active={categoryFilter === slice.key}
              onToggle={() =>
                setCategoryFilter((prev) => (prev === slice.key ? null : slice.key))
              }
            />
          ))}
        </div>
      )}

      {/* ------------------------------------------------------ les fiches -- */}
      {categoryFilter && (
        <button
          type="button"
          onClick={() => setCategoryFilter(null)}
          className="flex min-h-11 items-center gap-2 self-start border border-border-strong bg-accent-muted px-3 font-mono text-[10px] uppercase tracking-widest text-text-primary"
        >
          {categoryLabel(config, categoryFilter)}
          <X size={13} strokeWidth={2.25} />
        </button>
      )}

      {visible.length === 0 ? (
        /*
          DÉPENSES (BLOC A) — une boîte centrée de 8 rem, une icône et deux
          phrases pour dire qu'il n'y a rien. Le vide occupait la surface d'un
          contenu. Deux cas distincts, deux traitements :
          « jamais utilisé » explique le module ; « rien ce mois-ci » ne dit
          qu'une ligne, parce qu'il n'y a rien à expliquer.
        */
        expenses.length === 0 ? (
          <FirstRun
            title="Suivre ce que vous sortez"
            action={{ label: 'Saisir une dépense', onClick: () => setFormOpen(true) }}
          >
            Montant, catégorie, photo du reçu — trois gestes. Les dépenses saisies ici alimentent
            la synthèse du mois et les calculateurs de marge.
          </FirstRun>
        ) : (
          <EmptyState
            action={{ label: 'Saisir une dépense', onClick: () => setFormOpen(true) }}
          >
            {monthExpenses.length === 0
              ? 'Rien de dépensé sur ce mois.'
              : 'Aucune dépense dans cette catégorie.'}
          </EmptyState>
        )
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          {visible.map((expense) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              label={categoryLabel(config, expense.category)}
              onOpenPhoto={() => setPreview(expense)}
              onEdit={() => {
                setEditing(expense);
                setFormOpen(true);
              }}
            />
          ))}
        </motion.div>
      )}

      <AnimatePresence>
        {formOpen && (
          <ExpenseForm
            key={editing?.id ?? 'new'}
            config={config}
            expense={editing ?? undefined}
            defaultDay={defaultDayFor(month)}
            onSubmit={(values) => {
              if (editing) updateExpense(editing.id, values);
              else createExpense(values);
            }}
            onDelete={
              editing
                ? () => {
                    deleteExpense(editing.id);
                    setFormOpen(false);
                    setEditing(null);
                  }
                : undefined
            }
            onClose={() => {
              setFormOpen(false);
              setEditing(null);
            }}
          />
        )}

        {budgetsOpen && (
          <BudgetPanel
            config={config}
            projects={projects}
            onSave={saveConfig}
            onClose={() => setBudgetsOpen(false)}
          />
        )}

        {preview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreview(null)}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-6"
          >
            <button
              type="button"
              aria-label="Fermer"
              onClick={() => setPreview(null)}
              className="absolute right-4 top-4 text-white/70 hover:text-white"
            >
              <X size={20} strokeWidth={2} />
            </button>
            <img src={preview.photoDataUrl} alt="Justificatif" className="max-h-full max-w-full object-contain" />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/**
 * Le jour proposé à la saisie.
 *
 * Aujourd'hui quand on est sur le mois courant — c'est le cas de loin le plus
 * fréquent. Sur un mois passé qu'on est en train de compléter, le 1er de ce
 * mois-là : proposer la date du jour ferait atterrir la dépense dans un autre
 * mois que celui qu'on regarde, ce qui se remarque trop tard.
 */
function defaultDayFor(month: string): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  const today = local.toISOString().slice(0, 10);
  return today.startsWith(month) ? today : `${month}-01`;
}

/* ------------------------------- La répartition ---------------------------- */

function CategoryBar({
  slice,
  rank,
  active,
  onToggle,
}: {
  slice: CategorySlice;
  rank: number;
  active: boolean;
  onToggle: () => void;
}) {
  // L'accent, dégradé par rang : la plus grosse catégorie est la plus franche.
  // Plancher à 0,3 pour que la dernière barre reste visible sur le fond.
  const opacity = Math.max(0.3, 1 - rank * 0.14);

  /*
    Où poser le repère de budget sur la barre.

    La barre entière représente le total du MOIS, et sa portion pleine la part
    de cette catégorie. Le repère doit donc être placé sur la même échelle :
    `budget / total du mois`. Le total du mois se retrouve à partir de ce
    qu'on a déjà — `totalCents / share` — plutôt que d'être passé en plus, ce
    qui obligerait chaque appelant à le calculer de son côté.
  */
  const monthTotalCents = slice.share > 0 ? slice.totalCents / slice.share : 0;
  const markerPercent =
    slice.budget.state !== 'none' && monthTotalCents > 0
      ? Math.min(100, (slice.budget.budgetCents / monthTotalCents) * 100)
      : null;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`group flex w-full flex-col gap-1 border px-2.5 py-2 text-left transition-colors ${
        active ? 'border-border-strong bg-accent-muted' : 'border-transparent hover:bg-surface-hover'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-sm text-text-primary">{slice.label}</span>
        <span className="flex-shrink-0 font-mono text-xs tabular-nums text-text-secondary">
          {formatCents(slice.totalCents)}
        </span>
      </div>

      <div className="relative h-2 w-full bg-bg">
        <div
          className="absolute inset-y-0 left-0 bg-accent"
          style={{ width: `${Math.round(slice.share * 100)}%`, opacity }}
        />
        {/* Le repère de budget : un trait vertical sur la barre, à l'endroit où
            le budget serait atteint. Il n'y a rien à lire — la barre le
            dépasse, ou non. */}
        {markerPercent !== null && (
          <div
            className="absolute inset-y-[-2px] w-px bg-text-primary"
            style={{ left: `${markerPercent}%` }}
          />
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted">
          {Math.round(slice.share * 100)} %
        </span>
        <BudgetChip verdict={slice.budget} />
      </div>
    </button>
  );
}

/**
 * « Il reste 80 € » / « Dépassé de 45 € ».
 *
 * Une phrase, pas un pourcentage : « 112 % du budget » oblige à faire le
 * calcul pour savoir ce que ça représente, et c'est précisément le genre de
 * détour qu'on veut éviter.
 */
function BudgetChip({ verdict }: { verdict: BudgetVerdict }) {
  if (verdict.state === 'none') return null;
  const over = verdict.state === 'over';
  return (
    <span
      className={`flex-shrink-0 border px-1.5 py-px font-mono text-[9px] uppercase tracking-widest ${
        over ? 'border-danger/50 bg-danger-muted text-danger' : 'border-border text-text-muted'
      }`}
    >
      {over ? `Dépassé de ${formatCentsCompact(verdict.deltaCents)}` : `Il reste ${formatCentsCompact(verdict.deltaCents)}`}
    </span>
  );
}

/* --------------------------------- Les fiches ------------------------------ */

function ExpenseCard({
  expense,
  label,
  onOpenPhoto,
  onEdit,
}: {
  expense: Expense;
  label: string;
  onOpenPhoto: () => void;
  onEdit: () => void;
}) {
  return (
    <motion.article variants={staggerItem} className="flex flex-col border border-border bg-surface">
      {expense.photoDataUrl ? (
        <button
          type="button"
          onClick={onOpenPhoto}
          aria-label="Voir le justificatif"
          className="aspect-square overflow-hidden bg-bg"
        >
          <img
            src={expense.photoDataUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-200 hover:scale-105"
          />
        </button>
      ) : (
        /* Sans photo, la fiche garde la même forme : une grille où une carte
           sur deux fait la moitié de la hauteur se lit beaucoup moins bien
           qu'une grille régulière. La place est prise par le montant. */
        <button
          type="button"
          onClick={onEdit}
          className="flex aspect-square items-center justify-center bg-bg px-2 transition-colors hover:bg-surface-hover"
        >
          <span className="text-center text-xl font-bold tabular-nums text-text-primary">
            {formatCentsCompact(expense.amountCents)}
          </span>
        </button>
      )}

      <button type="button" onClick={onEdit} className="flex flex-col gap-1 p-2 text-left">
        {expense.photoDataUrl && (
          <span className="text-sm font-bold tabular-nums text-text-primary">
            {formatCents(expense.amountCents)}
          </span>
        )}
        <span className="truncate border border-border px-1.5 py-px font-mono text-[9px] uppercase tracking-widest text-text-secondary">
          {label}
        </span>
        {expense.note && <span className="truncate text-xs text-text-secondary">{expense.note}</span>}
        <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
          {formatShortDay(expense.spentAt)}
        </span>
        <ProjectTag projectId={expense.projectId} />
      </button>
    </motion.article>
  );
}
