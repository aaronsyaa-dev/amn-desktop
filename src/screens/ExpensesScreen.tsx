import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, Receipt, SlidersHorizontal, X } from 'lucide-react';
import { useExpenses } from '../state/useExpenses';
import { useProjectPicker } from '../state/useProjects';
import {
  categoryLabel,
  currentMonth,
  monthLabel,
  shiftMonth,
  type CategorySlice,
  type Expense,
  type MonthKey,
} from '../state/expenseEngine';
import { formatCents } from '../lib/money';
import { formatShortDay } from '../state/useInvoices';
import { ExpenseForm } from '../components/expenses/ExpenseForm';
import { BudgetPanel } from '../components/expenses/BudgetPanel';
import { ProjectTag } from '../components/projects/ProjectPicker';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { EmptyState, FirstRun } from '../components/EmptyState';
import { useFermetureEchap } from '../lib/useFermetureEchap';
import { useLangue, t as tr } from '../i18n';

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
  // Abonnement à la langue : sans lui, l'écran gardait les libellés de la
  // langue active AU MONTAGE et ne suivait pas un changement en cours de route.
  useLangue();
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
        eyebrow={tr('hist.expenses.posteDeTravailDepenses')}
        title={tr('hist.expenses.depenses')}
        description={tr('hist.expenses.ceQueVousSortez')}
        /* Le total du mois est le grand chiffre du ruban, juste en dessous : le
           répéter ici en ferait le troisième endroit où lire la même somme.
           L'en-tête dit ce que le ruban ne dit pas — combien de lignes, et
           combien portent leur justificatif. */
        stats={[
          { label: tr('hist.expenses.depensesCeMois'), value: monthExpenses.length },
          {
            label: tr('hist.expenses.justificatifs'),
            value: monthExpenses.filter((e) => e.photoDataUrl).length,
            title: tr('hist.expenses.surNLignes', { n: monthExpenses.length }),
          },
        ]}
        actions={
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setBudgetsOpen(true)}
            title={tr('hist.expenses.categoriesEtBudgets')}
            aria-label={tr('hist.expenses.categoriesEtBudgets')}
            className="flex h-11 w-11 items-center justify-center border border-border text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:h-9 md:w-9"
          >
            <SlidersHorizontal size={16} strokeWidth={1.9} />
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
            <span className="hidden sm:inline">{tr('hist.expenses.nouvelleDepense')}</span>
            <span className="sm:hidden">{tr('hist.expenses.depense')}</span>
          </button>
        </div>
        }
      />

      {/* ------------------------------------------------------ le mois ----- */}
      {/*
        LE RUBAN DE MOIS — l'objet dominant de l'écran Dépenses.

        Il y avait une flèche, un chiffre, une flèche. On voyait le mois en
        cours, et RIEN d'autre : pour savoir si 1 964 € était beaucoup, il
        fallait reculer, lire, avancer, se souvenir. Un ruban pose les cinq
        derniers côte à côte, et la comparaison se fait sans cliquer — c'est
        tout le propos de « le mois » comme objet dominant.
      */}
      <RubanDeMois
        mois={month}
        totalDe={(m) => totalOf(ofMonth(m))}
        peutReculer={canGoBack}
        onChoisir={(m) => {
          setMonth(m);
          setCategoryFilter(null);
        }}
        onDecaler={goToMonth}
      />

      {/* -------------------------------------------------- répartition ----- */}
      {breakdown.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-4">
            <p className="eyebrow flex-shrink-0">{tr('hist.expenses.parCategorie')}</p>
            <span className="h-px flex-1 bg-border-section" aria-hidden />
            <p className="eyebrow flex-shrink-0">{tr('hist.expenses.budgetMensuel')}</p>
          </div>
          <div className="flex flex-col">
            {breakdown.map((slice) => (
              <LigneDeCategorie
                key={slice.key}
                slice={slice}
                active={categoryFilter === slice.key}
                onToggle={() =>
                  setCategoryFilter((prev) => (prev === slice.key ? null : slice.key))
                }
              />
            ))}
          </div>
        </section>
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
            action={{ label: tr('hist.expenses.saisirUneDepense'), onClick: () => setFormOpen(true) }}
          >{tr('hist.expenses.montantCategoriePhotoDu')}</FirstRun>
        ) : (
          <EmptyState
            action={{ label: tr('hist.expenses.saisirUneDepense'), onClick: () => setFormOpen(true) }}
          >
            {monthExpenses.length === 0
              ? 'Rien de dépensé sur ce mois.'
              : 'Aucune dépense dans cette catégorie.'}
          </EmptyState>
        )
      ) : (
        /*
          LE MOIS, JOUR PAR JOUR.

          C'était une grille de vignettes carrées, rangée par rien de visible.
          La photo du justificatif reste — elle est utile, et c'était une
          décision prise exprès — mais elle passe en vignette de 34 px au bord
          d'une LIGNE datée : une dépense se lit d'abord par son jour et son
          montant, l'objet vient confirmer. La grille demandait de chercher la
          date en bas de chaque carte, en neuf pixels.
        */
        <section>
          <div className="mb-1 flex items-center gap-4">
            <p className="eyebrow flex-shrink-0">{tr('hist.expenses.leMoisJourParJour')}</p>
            <span className="h-px flex-1 bg-border-section" aria-hidden />
            <p className="eyebrow flex-shrink-0">
              {tr('hist.expenses.nDepenses', { n: visible.length })}
            </p>
          </div>
          <motion.ul variants={staggerContainer} initial="initial" animate="animate" className="flex flex-col">
            {visible.map((expense) => (
              <LigneDeDepense
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
          </motion.ul>
        </section>
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

/**
 * LE RUBAN DE MOIS.
 *
 * Cinq cellules : les quatre mois précédents, puis celui qu'on regarde, plus
 * large et levé. Chacune porte son total, donc la comparaison est immédiate —
 * c'est la seule chose que l'ancienne paire de flèches ne pouvait pas donner.
 *
 * Les flèches restent : elles servent à sortir de la fenêtre de cinq mois, pas
 * à se déplacer dedans.
 */
function RubanDeMois({
  mois,
  totalDe,
  peutReculer,
  onChoisir,
  onDecaler,
}: {
  mois: MonthKey;
  totalDe: (m: MonthKey) => number;
  peutReculer: boolean;
  onChoisir: (m: MonthKey) => void;
  onDecaler: (delta: number) => void;
}) {
  const cellules = useMemo(
    () => [4, 3, 2, 1, 0].map((recul) => shiftMonth(mois, -recul)),
    [mois],
  );
  /* « septembre 2026 » pour le mois courant, « septembre » pour les autres :
     l'année ne se répète pas cinq fois quand elle ne change pas. */
  const court = (m: MonthKey) => monthLabel(m).replace(/\s+\d{4}$/, '');

  return (
    <div className="flex items-stretch border border-border bg-surface">
      <button
        type="button"
        onClick={() => onDecaler(-1)}
        disabled={!peutReculer}
        aria-label={tr('hist.expenses.moisPrecedent')}
        className="flex w-11 flex-shrink-0 items-center justify-center border-r border-border text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:opacity-30"
      >
        <ChevronLeft size={16} strokeWidth={2} />
      </button>

      <div className="grid min-w-0 flex-1 grid-cols-3 sm:grid-cols-5">
        {cellules.map((m, i) => {
          const courant = m === mois;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onChoisir(m)}
              /* Sous 640 px il n'y a plus la place pour cinq mois : on garde
                 les trois derniers, dont celui qu'on regarde. */
              className={`flex flex-col items-start gap-2 border-r border-border px-4 py-4 text-left transition-colors last:border-r-0 ${
                i < 2 ? 'hidden sm:flex' : 'flex'
              } ${courant ? 'bg-elevated' : 'hover:bg-surface-hover'}`}
            >
              <span className={`eyebrow ${courant ? 'text-text-secondary' : ''}`}>
                {courant ? monthLabel(m) : court(m)}
              </span>
              <span
                className={`tnum truncate font-mono font-semibold leading-none tracking-[-0.03em] ${
                  courant ? 'text-[27px] text-text-primary' : 'text-[17px] text-text-muted'
                }`}
              >
                {formatCents(totalDe(m))}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onDecaler(1)}
        aria-label="Mois suivant"
        className="flex w-11 flex-shrink-0 items-center justify-center border-l border-border text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
      >
        <ChevronRight size={16} strokeWidth={2} />
      </button>
    </div>
  );
}

/**
 * UNE CATÉGORIE, SON BUDGET, SA BARRE.
 *
 * L'AMBRE DE L'ÉCRAN vit ici, et nulle part ailleurs : la catégorie dépassée.
 * Le badge « dépassé de … » et la portion de barre au-delà du budget disent la
 * même chose, d'où le `data-signal-groupe` qui les compte pour un. Une
 * catégorie DANS son budget est un état sain — elle n'a pas d'ambre, et c'est
 * la règle 3 du paquet de design.
 *
 * Les catégories sans budget n'ont pas de barre du tout : une barre suppose
 * une échelle, et sans budget il n'y en a aucune. Elles disent leur montant,
 * et le surtitre dit pourquoi elles n'ont rien de plus.
 */
function LigneDeCategorie({
  slice,
  active,
  onToggle,
}: {
  slice: CategorySlice;
  active: boolean;
  onToggle: () => void;
}) {
  const { budget } = slice;
  const depasse = budget.state === 'over';
  const sansBudget = budget.state === 'none';
  /*
    L'ÉCHELLE DE LA BARRE CHANGE QUAND LE BUDGET EST DÉPASSÉ, et c'est ce qui la
    rend lisible.

    Tant qu'on tient, l'échelle est le BUDGET : la barre dit quelle part en est
    consommée, et le vide à droite dit ce qui reste. Une fois dépassé, cette
    échelle ne peut plus rien dire — un dépassement de 5 % et un dépassement du
    double donnent tous deux une barre pleine. L'échelle devient donc le
    DÉPENSÉ : la portion pleine marque le budget, les rayures marquent ce qui
    est passé au-delà, et leur longueur relative dit de combien.
  */
  const echelle = depasse ? Math.max(1, budget.spentCents) : Math.max(1, budget.budgetCents);
  const partTenue = sansBudget ? 0 : (Math.min(budget.spentCents, budget.budgetCents) / echelle) * 100;
  const partDepassement = depasse ? (budget.deltaCents / echelle) * 100 : 0;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      data-signal-groupe={depasse ? 'categorie-depassee' : undefined}
      className={`flex flex-col gap-2.5 border-b border-[#161616] px-3 py-3.5 text-left transition-colors last:border-b-0 ${
        active ? 'bg-surface-hover' : 'hover:bg-surface-hover'
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
        <span className="text-[14.5px] font-semibold text-text-primary">{slice.label}</span>
        {depasse && (
          <span className="signal-plate px-2 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.2em]">
            {tr('hist.expenses.depasseDe', { montant: formatCents(budget.deltaCents) })}
          </span>
        )}
        {sansBudget && <span className="eyebrow">{tr('hist.expenses.sansBudget')}</span>}
        <span className="tnum ml-auto font-mono text-[14.5px] font-semibold tracking-[-0.03em] text-text-primary">
          {formatCents(slice.totalCents)}
        </span>
        {!sansBudget && (
          <span className="tnum flex-shrink-0 font-mono text-[11px] tracking-[0.1em] text-text-muted">
            / {formatCents(budget.budgetCents)}
          </span>
        )}
      </div>

      {!sansBudget && (
        <span className="flex h-[5px] w-full overflow-hidden bg-[#1a1a1a]" aria-hidden>
          <span className={depasse ? 'bg-signal' : 'bg-[#4a4a48]'} style={{ width: `${partTenue}%` }} />
          {partDepassement > 0 && (
            <span
              className="bg-signal-muted"
              style={{
                width: `${partDepassement}%`,
                backgroundImage:
                  'repeating-linear-gradient(135deg, var(--color-signal) 0 2px, transparent 2px 5px)',
              }}
            />
          )}
        </span>
      )}
    </button>
  );
}

/**
 * UNE LIGNE DE DÉPENSE — jour, justificatif, intitulé, catégorie, montant.
 *
 * La vignette du justificatif garde sa place mais pas sa taille : 34 px
 * suffisent à reconnaître un objet qu'on a photographié soi-même, et une
 * dépense sans photo n'ouvre plus un carré vide — le cadre dit simplement
 * « sans justificatif », ce qui est une information utile au moment de la
 * déclaration.
 */
function LigneDeDepense({
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
    <motion.li variants={staggerItem} className="border-b border-[#161616] last:border-b-0">
      <div className="flex items-center gap-4 py-3">
        <span className="tnum w-[52px] flex-shrink-0 font-mono text-[11px] tracking-[0.1em] text-text-muted">
          {formatShortDay(expense.spentAt)}
        </span>

        {expense.photoDataUrl ? (
          <button
            type="button"
            onClick={onOpenPhoto}
            aria-label={tr('hist.expenses.voirLeJustificatif')}
            className="h-[34px] w-[34px] flex-shrink-0 overflow-hidden border border-border bg-bg"
          >
            <img src={expense.photoDataUrl} alt="" className="h-full w-full object-cover" />
          </button>
        ) : (
          <span
            className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center border border-dashed border-border text-text-muted"
            title={tr('hist.expenses.sansJustificatif')}
          >
            <Receipt size={13} strokeWidth={1.9} />
          </span>
        )}

        <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
          <span className="block truncate text-[14.5px] text-text-primary">
            {expense.note || label}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="eyebrow">{label}</span>
            {!expense.photoDataUrl && (
              <>
                <span className="eyebrow">·</span>
                <span className="eyebrow">{tr('hist.expenses.sansJustificatif')}</span>
              </>
            )}
            <ProjectTag projectId={expense.projectId} />
          </span>
        </button>

        <span className="tnum flex-shrink-0 font-mono text-[14.5px] font-semibold tracking-[-0.03em] text-text-primary">
          {formatCents(expense.amountCents)}
        </span>
      </div>
    </motion.li>
  );
}

