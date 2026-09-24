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
import { useHaloSignal } from '../components/EtatEcran';
import { formatShortDay } from '../state/useInvoices';
import { ExpenseForm } from '../components/expenses/ExpenseForm';
import { BudgetPanel } from '../components/expenses/BudgetPanel';
import { ProjectTag } from '../components/projects/ProjectPicker';
import { LIGNES_PAR_PAGE, animationDeRang, staggerContainer } from '../lib/transitions';
import { PlusDeLignes } from '../components/PlusDeLignes';
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
  const [plafond, setPlafond] = useState(LIGNES_PAR_PAGE);
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

  /* ---------------------------------------------- l'objet dominant (12b) -- */

  const rails = useMemo(() => railsDeBudget(breakdown), [breakdown]);
  const sansBudget = useMemo(() => breakdown.filter((s) => s.budget.state === 'none'), [breakdown]);

  /*
    L'AMBRE VA À UN SEUL RAIL — le plus gros dépassement. Les autres rails
    dépassés gardent un segment hors rail, en gris clair : c'est le CRAN qui
    dit qu'ils sont sortis, pas une seconde couleur, et l'écran garde une
    seule région ambre.
  */
  const railAmbre = useMemo(
    () =>
      rails
        .filter((r) => r.depasse)
        .sort((a, b) => b.slice.budget.deltaCents - a.slice.budget.deltaCents)[0] ?? null,
    [rails],
  );
  const halo = useHaloSignal(!!railAmbre);

  const cuves = useMemo(
    () => cuvesDeLAnnee(month, (m) => totalOf(ofMonth(m))),
    [month, totalOf, ofMonth],
  );
  /* Le total de l'année SOMME les cuves affichées — pas la base entière : un
     total qui ne correspond à rien de visible n'est pas vérifiable. */
  const totalAnnee = useMemo(() => cuves.reduce((n, c) => n + c.totalCents, 0), [cuves]);
  const hautCuve = useMemo(() => Math.max(1, ...cuves.map((c) => c.totalCents)), [cuves]);

  const journal = useMemo(
    () => [...monthExpenses].sort((a, b) => b.spentAt.localeCompare(a.spentAt)).slice(0, 4),
    [monthExpenses],
  );

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

      {/* ----------------------------------------- les rails de budget ----- */}
      {/*
        LES RAILS — l'objet dominant de l'écran Dépenses (`12b`).

        Le ruban de mois l'était ; il descend d'un cran et devient les CUVES,
        juste en dessous. Ce qu'on vient vérifier ici n'est pas « combien ce
        mois » — c'est « est-ce que ça tient ». Un rail dont la longueur
        entière est le budget répond avant qu'on ait lu un chiffre, et un
        débordement se voit sortir par la droite.
      */}
      {rails.length > 0 && (
        <section className="panel-raised panel-raised-wide panel-ticks px-6 py-6">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <p className="eyebrow">{tr('hist.expenses.budgetMensuel')} · {monthLabel(month)}</p>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-text-muted">
              le cran de fin est au même endroit sur tous les rails
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {rails.map((rail) => {
              const signal = rail === railAmbre;
              return (
                <button
                  key={rail.slice.key}
                  type="button"
                  onClick={() =>
                    setCategoryFilter((prev) => (prev === rail.slice.key ? null : rail.slice.key))
                  }
                  aria-pressed={categoryFilter === rail.slice.key}
                  className={`grid items-center gap-x-4 text-left transition-colors ${RAIL_COLONNES} ${
                    categoryFilter === rail.slice.key ? 'bg-surface-hover' : 'hover:bg-surface-hover'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-semibold text-text-primary">
                      {rail.slice.label}
                    </span>
                    <span className="tnum block truncate font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
                      {formatCents(rail.slice.budget.spentCents)} sur{' '}
                      {formatCents(rail.slice.budget.budgetCents)}
                    </span>
                  </span>

                  {/* LA PISTE. Le rail s'arrête au cran ; au-delà, c'est le
                      dehors — et le fond y est plus sombre pour qu'on voie
                      que le segment est SORTI, pas qu'il continue. */}
                  <span className="relative block h-6 w-full">
                    <span className="absolute inset-y-0 left-0 bg-sunken" style={{ width: `${RAIL_CRAN}%` }} aria-hidden />
                    <span
                      className="absolute inset-y-0 right-0 bg-bg"
                      style={{ width: `${100 - RAIL_CRAN}%` }}
                      aria-hidden
                    />
                    <span
                      className="absolute inset-y-0 left-0 block bg-[#4a4a48]"
                      style={{ width: `${rail.dedans}%` }}
                    />
                    {rail.dehors > 0 && (
                      <span
                        className={`absolute inset-y-0 block ${signal ? `bg-signal ${halo}` : 'bg-border-strong'}`}
                        style={{ left: `${RAIL_CRAN}%`, width: `${rail.dehors}%` }}
                        data-signal-groupe={signal ? 'depassement' : undefined}
                      />
                    )}
                    {/* Le cran de fin : un filet clair, toujours au même x. */}
                    <span
                      aria-hidden
                      className="absolute inset-y-0 w-px bg-text-secondary"
                      style={{ left: `${RAIL_CRAN}%` }}
                    />
                    {rail.borne && (
                      <span className="absolute inset-y-0 right-1 flex items-center font-mono text-[11px] text-text-primary">
                        ›
                      </span>
                    )}
                  </span>

                  <span
                    className={`tnum text-right font-mono text-[13px] font-semibold ${
                      signal ? 'text-signal' : rail.depasse ? 'text-text-primary' : 'text-text-muted'
                    }`}
                    data-signal-groupe={signal ? 'depassement' : undefined}
                  >
                    {rail.depasse
                      ? `+ ${formatCents(rail.slice.budget.deltaCents)}`
                      : rail.auCran
                        ? 'au cran'
                        : `− ${formatCents(rail.slice.budget.deltaCents)}`}
                  </span>
                </button>
              );
            })}
          </div>

          {/* LA GRADUATION — même grille que les rails, cellules vides comprises. */}
          <div className={`mt-2 grid gap-x-4 ${RAIL_COLONNES}`}>
            <span aria-hidden />
            <div className="relative h-4">
              <span className="absolute left-0 top-0 font-mono text-[9.5px] uppercase tracking-[0.2em] text-text-muted">
                0
              </span>
              <span
                className="absolute top-0 -translate-x-1/2 whitespace-nowrap font-mono text-[9.5px] uppercase tracking-[0.2em] text-text-secondary"
                style={{ left: `${RAIL_CRAN}%` }}
              >
                budget
              </span>
              <span className="absolute right-0 top-0 font-mono text-[9.5px] uppercase tracking-[0.2em] text-text-muted">
                hors rail
              </span>
            </div>
            <span aria-hidden />
          </div>

          {sansBudget.length > 0 && (
            <p className="mt-5 border-t border-border-row pt-3 text-[12.5px] leading-relaxed text-text-muted">
              {sansBudget.length} catégorie{sansBudget.length > 1 ? 's' : ''} sans budget —{' '}
              {sansBudget.map((s) => s.label).join(', ')}. Pas de rail : un rail est une longueur,
              et sans budget il n’y en a aucune. Leur montant se lit dans le journal.
            </p>
          )}
        </section>
      )}

      {/* ------------------------------ les cuves et le journal du mois ----- */}
      <div className="grid items-start gap-4 lg:grid-cols-[1fr_300px]">
        {/*
          LES CUVES DE L'ANNÉE. Chacune est cliquable : c'est aussi le
          sélecteur de mois, et le ruban de flèches reste pour sortir de
          l'année en cours.
        */}
        <section className="panel px-5 py-4">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="eyebrow">L’année, mois par mois</p>
            <p className="tnum font-mono text-[13px] font-semibold text-text-primary">
              {formatCents(totalAnnee)}
              <span className="ml-2 text-[10px] font-normal uppercase tracking-[0.2em] text-text-muted">
                somme des cuves
              </span>
            </p>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => goToMonth(-1)}
              disabled={!canGoBack}
              aria-label={tr('hist.expenses.moisPrecedent')}
              className="flex h-11 w-7 flex-shrink-0 items-center justify-center border border-border text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-30"
            >
              <ChevronLeft size={15} strokeWidth={2} />
            </button>
            <div className="grid min-w-0 flex-1 gap-1.5" style={{ gridTemplateColumns: `repeat(${cuves.length}, minmax(0, 1fr))` }}>
              {cuves.map((cuve) => (
                <button
                  key={cuve.mois}
                  type="button"
                  onClick={() => {
                    setMonth(cuve.mois);
                    setCategoryFilter(null);
                  }}
                  title={`${monthLabel(cuve.mois)} · ${formatCents(cuve.totalCents)}`}
                  className="flex flex-col items-center gap-1.5"
                >
                  {/* LE CONTENANT, puis son contenu par le bas. C'est le cadre
                      qui fait la cuve : sans lui, une colonne courte ne dit
                      pas si elle est vide ou petite. */}
                  <span
                    className={`relative block w-full border ${
                      cuve.courant
                        ? 'border-border-strong bg-raised shadow-[inset_0_1px_0_rgba(255,255,255,.06)]'
                        : 'border-border bg-sunken'
                    }`}
                    style={{ height: CUVE_H }}
                  >
                    <span
                      className={`absolute inset-x-0 bottom-0 block ${cuve.courant ? 'bg-[#4a4a48]' : 'bg-[#2b2b2b]'}`}
                      style={{
                        height: `${hautCuve > 0 ? (cuve.totalCents / hautCuve) * 100 : 0}%`,
                      }}
                    />
                  </span>
                  <span
                    className={`font-mono text-[9.5px] uppercase tracking-[0.1em] ${
                      cuve.courant ? 'text-text-primary' : 'text-text-muted'
                    }`}
                  >
                    {cuve.libelle}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => goToMonth(1)}
              aria-label="Mois suivant"
              className="flex h-11 w-7 flex-shrink-0 items-center justify-center border border-border text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            >
              <ChevronRight size={15} strokeWidth={2} />
            </button>
          </div>
        </section>

        {/* LE JOURNAL — les quatre dernières lignes, catégorie en mono. */}
        <section className="panel px-5 py-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="eyebrow">Les dernières lignes</p>
            <p className="tnum font-mono text-[13px] font-semibold text-text-primary">
              {formatCents(totalOf(monthExpenses))}
            </p>
          </div>
          {journal.length === 0 ? (
            <p className="text-[13px] leading-relaxed text-text-secondary">
              Rien de saisi sur ce mois.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-border-row">
              {journal.map((e) => (
                <div key={e.id} className="flex items-baseline gap-3 py-2">
                  <span className="tnum w-[46px] flex-shrink-0 font-mono text-[11px] tracking-[0.1em] text-text-muted">
                    {formatShortDay(e.spentAt)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-text-secondary">
                      {e.note || 'Sans intitulé'}
                    </span>
                    <span className="block truncate font-mono text-[9.5px] uppercase tracking-[0.14em] text-text-muted">
                      {categoryLabel(config, e.category)}
                    </span>
                  </span>
                  <span className="tnum flex-shrink-0 font-mono text-[12.5px] text-text-primary">
                    {formatCents(e.amountCents)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

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
            {visible.slice(0, plafond).map((expense, rang) => (
              <LigneDeDepense
                key={expense.id}
                rang={rang}
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
          <PlusDeLignes affichees={Math.min(plafond, visible.length)} total={visible.length} onPlus={() => setPlafond((p) => p + LIGNES_PAR_PAGE)} />
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

/*
  LE RUBAN DE MOIS ET LA LIGNE DE CATÉGORIE ONT ÉTÉ RETIRÉS.

  Le ruban est devenu les CUVES de l'année — un cadre par mois, rempli par le
  bas — et la ligne de catégorie est devenue un RAIL, dont la longueur entière
  est le budget. Les deux anciens composants ne sont pas gardés « au cas où » :
  du code mort à côté de son remplaçant se fait rouvrir un jour par erreur, et
  l'ancienne barre mettait son échelle sur le dépensé, ce qui est précisément
  le défaut que les rails corrigent.
*/

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
  rang,
  expense,
  label,
  onOpenPhoto,
  onEdit,
}: {
  rang: number;
  expense: Expense;
  label: string;
  onOpenPhoto: () => void;
  onEdit: () => void;
}) {
  return (
    <motion.li {...animationDeRang(rang)} className="border-b border-[#161616] last:border-b-0">
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

/* ------------------------------------------- les rails de budget (`12b`) -- */

/**
 * LES RAILS DE BUDGET — l'objet dominant de Dépenses (`12b`).
 *
 * LA LONGUEUR ENTIÈRE DU RAIL EST LE BUDGET. Le remplissage ne peut donc pas
 * le dépasser : le dépassement SORT PAR LA DROITE, au-delà du cran de fin, et
 * c'est exactement ce qu'il est. On lit un débordement comme une chose qui
 * déborde, pas comme un nombre négatif.
 *
 * LA RÈGLE QUI FAIT MARCHER L'OBJET : le cran de fin est à la MÊME POSITION
 * sur tous les rails — 72 % de la piste. Posé à la longueur de chaque budget,
 * il se déplacerait d'une ligne à l'autre et deux budgets ne se compareraient
 * plus ; l'ancienne barre faisait exactement ça, en mettant l'échelle sur le
 * dépensé, et un dépassement de 10 € y ressemblait à un dépassement de 200 €.
 *
 * Il reste donc 28 % de piste pour le débordement, c'est-à-dire jusqu'à
 * 28 / 72 = 38,9 % au-dessus du budget. Au-delà, le segment est borné et un
 * chevron dit que c'est la piste qui s'arrête, pas la dépense.
 */
const RAIL_CRAN = 72;
/**
 * LA GRILLE PARTAGÉE — les rails ET leur graduation.
 *
 * Même règle que partout (§0.6) : une rangée de graduations partage la
 * `grid-template-columns` de ce qu'elle gradue, cellules vides comprises.
 * Recalibrée à la marge, la mention « budget » tomberait à côté du cran
 * qu'elle nomme.
 */
const RAIL_COLONNES =
  'grid-cols-[minmax(0,1fr)_minmax(0,3fr)_92px] md:grid-cols-[210px_minmax(0,1fr)_110px]';
const RAIL_MARGE_MAX = (100 - RAIL_CRAN) / RAIL_CRAN;

interface Rail {
  slice: CategorySlice;
  /** Part de piste tenue dans le budget, de 0 à RAIL_CRAN. */
  dedans: number;
  /** Part de piste au-delà du cran — 0 quand le budget tient. */
  dehors: number;
  depasse: boolean;
  /** Le dépassement sort de la piste : le chevron le dit. */
  borne: boolean;
  /** Dépensé exactement le budget, à l'euro : « au cran », pas « 100 % ». */
  auCran: boolean;
}

function railsDeBudget(slices: CategorySlice[]): Rail[] {
  return slices
    .filter((s) => s.budget.state !== 'none')
    .map((slice) => {
      const { budgetCents, spentCents } = slice.budget;
      const part = budgetCents > 0 ? spentCents / budgetCents : 0;
      const marge = Math.max(0, part - 1);
      return {
        slice,
        dedans: Math.min(1, part) * RAIL_CRAN,
        dehors: Math.min(marge, RAIL_MARGE_MAX) * RAIL_CRAN,
        depasse: slice.budget.state === 'over',
        borne: marge > RAIL_MARGE_MAX,
        auCran: spentCents === budgetCents,
      };
    });
}

/**
 * LES CUVES DE L'ANNÉE — un cadre par mois, rempli par le bas.
 *
 * Une cuve n'est pas une barre : elle a un CONTENANT visible, et c'est ce qui
 * permet de lire « à moitié pleine » sans axe ni graduation. Le mois courant
 * est en encre claire et en relief — c'est celui qu'on regarde, et il doit se
 * distinguer d'un mois clos sans qu'on cherche.
 *
 * RÈGLE : le total de l'année somme EXACTEMENT les cuves affichées. Un total
 * calculé sur toute la base au-dessus de neuf cuves serait un total qui ne
 * correspond à rien de visible, et personne ne saurait d'où vient l'écart.
 */
const CUVE_H = 132;

interface Cuve {
  mois: MonthKey;
  libelle: string;
  totalCents: number;
  courant: boolean;
}

function cuvesDeLAnnee(
  moisCourant: MonthKey,
  totalDe: (m: MonthKey) => number,
): Cuve[] {
  const annee = moisCourant.slice(0, 4);
  const dernier = Number(moisCourant.slice(5, 7));
  const cuves: Cuve[] = [];
  for (let n = 1; n <= dernier; n += 1) {
    const cle = `${annee}-${String(n).padStart(2, '0')}` as MonthKey;
    cuves.push({
      mois: cle,
      libelle: monthLabel(cle).replace(/\s+\d{4}$/, '').slice(0, 3),
      totalCents: totalDe(cle),
      courant: cle === moisCourant,
    });
  }
  return cuves;
}
