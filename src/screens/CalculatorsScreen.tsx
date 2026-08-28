import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { motion } from 'framer-motion';
import { Calculator, Scale, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { useExpenses } from '../state/useExpenses';
import { useInvoices, invoiceTotals } from '../state/useInvoices';
import { useTimeTracking } from '../state/useTimeTracking';
import { useCollection, recordWriter } from '../state/SyncContext';
import { evaluateProfile, outputsOf, type CalcKind } from '../state/calcEngine';
import { CALC_PROFILES, DEFAULT_CALC_PROFILE_ID, calcProfileById } from '../state/calcProfiles';
import {
  formatWorked,
  monthLabel,
  monthlySummary,
  recentMonths,
  type SplitMode,
} from '../state/monthlySplit';
import { formatCents } from '../lib/money';
import { defaultText, formatValue, parseValue } from '../lib/calcFormat';
import { durationMs } from '../state/timeEngine';
import { staggerContainer, staggerItem } from '../lib/transitions';

/**
 * Calculateurs métier (BLOCS A/B/C).
 *
 * L'écran ne connaît AUCUN métier. Il lit `CALC_PROFILES`, affiche les entrées
 * déclarées, déroule le moteur et montre les sorties. Ajouter un calculateur
 * n'oblige donc à toucher ni ce fichier, ni le moteur — c'est la promesse du
 * BLOC A, et c'est ce qui la rend vérifiable.
 *
 * La synthèse mensuelle, en dessous, n'a pas de base à elle : elle agrège la
 * Facturation, les Dépenses et le Temps qui existent déjà.
 */
export function CalculatorsScreen() {
  const [profileId, setProfileId] = useState(DEFAULT_CALC_PROFILE_ID);
  const profile = calcProfileById(profileId) ?? CALC_PROFILES[0];

  /*
    Le TEXTE saisi est conservé, pas le nombre.

    Une première version gardait les centimes et réaffichait `centsToInput` à
    chaque frappe : taper « 45,50 » devenait impossible, puisque le « 4 » se
    réécrivait aussitôt en « 4.00 » et que le « 5 » suivant donnait 4,005 €.
    C'est la convention déjà suivie par le formulaire de dépense et par les
    lignes de facture — le champ appartient à la personne qui tape, la
    conversion se fait à la lecture.

    Chaque profil garde sa propre saisie : revenir sur un calculateur après en
    avoir consulté un autre ne doit pas avoir tout remis à zéro.
  */
  const [texts, setTexts] = useState<Record<string, Record<string, string>>>({});
  const current = useMemo(() => texts[profile.id] ?? {}, [texts, profile.id]);

  const parsed = useMemo(() => {
    const out: Record<string, number> = {};
    for (const input of profile.inputs) {
      const raw = current[input.key];
      // Jamais touché : le moteur applique la valeur par défaut du profil.
      if (raw === undefined) continue;
      out[input.key] = parseValue(raw, input.kind);
    }
    return out;
  }, [profile, current]);

  const result = useMemo(() => evaluateProfile(profile, parsed), [profile, parsed]);
  /*
    `outputsOf` rend LA RÉPONSE EN PREMIER, pas la première étape calculée.

    L'écran met en avant `outputs[0]` — plus grand, filet d'accent. Tant que
    cette liste suivait l'ordre du CALCUL, cette mise en avant tombait sur un
    intermédiaire : le calculateur « Prix client » ouvrait sur les charges
    sociales, « Rentabilité d'un événement » sur les coûts fixes. L'ordre des
    étapes est contraint par les dépendances, jamais par l'importance ; c'est
    donc au profil de nommer sa tête (`headline`), et `check:calc` exige
    qu'il le fasse.
  */
  const outputs = outputsOf(result);

  const setValue = (key: string, raw: string) =>
    setTexts((prev) => ({ ...prev, [profile.id]: { ...(prev[profile.id] ?? {}), [key]: raw } }));

  return (
    <motion.section
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-5"
    >
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow="Poste de travail · Calculateurs"
          title="Calculateurs"
          description="Un seul moteur, aucune formule écrite en dur — chaque métier a le sien."
          stats={[
            { label: 'Métiers couverts', value: CALC_PROFILES.length },
            { label: 'Métier affiché', value: profile.label },
          ]}
        />
      </motion.div>

      {/* --------------------------- Choix du métier --------------------------- */}
      <motion.div variants={staggerItem} className="flex flex-wrap gap-1.5">
        {CALC_PROFILES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setProfileId(entry.id)}
            aria-pressed={entry.id === profile.id}
            className={`flex min-h-11 items-center border px-3 text-xs transition-colors md:min-h-0 md:py-2 ${
              entry.id === profile.id
                ? 'border-border-strong bg-accent-muted text-text-primary'
                : 'border-border text-text-muted hover:text-text-secondary'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </motion.div>

      <motion.p variants={staggerItem} className="text-sm leading-relaxed text-text-secondary">
        {profile.description}
      </motion.p>

      <motion.div variants={staggerItem} className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        {/* ------------------------------ Entrées ------------------------------ */}
        <section className="border border-border bg-surface p-4">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            Ce que vous savez
          </h2>
          <div className="flex flex-col gap-3">
            {profile.inputs.map((input) => (
              <label key={input.key} className="block">
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  {input.label}
                  {input.kind === 'percent' && ' (%)'}
                </span>
                <input
                  inputMode="decimal"
                  value={current[input.key] ?? defaultText(input.defaultValue, input.kind)}
                  onChange={(e) => setValue(input.key, e.target.value)}
                  placeholder={defaultText(input.defaultValue, input.kind)}
                  className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-right font-mono text-sm tabular-nums text-text-primary outline-none"
                />
                {input.help && (
                  <span className="mt-1 block text-[11px] leading-relaxed text-text-muted">
                    {input.help}
                  </span>
                )}
              </label>
            ))}
          </div>
        </section>

        {/* ------------------------------ Résultats ---------------------------- */}
        <section className="border border-border bg-surface p-4">
          <h2 className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            <Calculator size={13} strokeWidth={1.75} />
            Ce que ça donne
          </h2>

          {result.errors.length > 0 && (
            <ul className="mb-3 flex flex-col gap-1">
              {result.errors.map((err) => (
                <li
                  key={err.key}
                  className="border border-warning/40 bg-warning-muted px-3 py-2 text-xs leading-relaxed text-text-primary"
                >
                  {err.message}
                </li>
              ))}
            </ul>
          )}

          <dl className="flex flex-col gap-px bg-border">
            {outputs.map((line, index) => (
              <div
                key={line.key}
                className={`bg-surface px-3 py-2.5 ${index === 0 ? 'border-l-2 border-accent' : ''}`}
              >
                <dt className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  {line.label}
                </dt>
                <dd
                  className={`mt-0.5 font-mono tabular-nums ${
                    index === 0 ? 'text-xl text-text-primary' : 'text-sm text-text-secondary'
                  }`}
                >
                  {formatValue(line.value, line.kind)}
                </dd>
                {line.help && (
                  <p className="mt-1 text-[11px] leading-relaxed text-text-muted">{line.help}</p>
                )}
              </div>
            ))}
          </dl>

          {/* Le détail : les étapes intermédiaires, pour que le chiffre soit
              vérifiable plutôt qu'à croire sur parole. */}
          {result.lines.some((l) => !l.output) && (
            <details className="mt-3">
              <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-text-muted hover:text-text-secondary">
                Détail du calcul
              </summary>
              <dl className="mt-2 flex flex-col gap-1">
                {result.lines
                  .filter((l) => !l.output)
                  .map((line) => (
                    <div key={line.key} className="flex items-baseline justify-between gap-3">
                      <dt className="text-xs text-text-muted">{line.label}</dt>
                      <dd className="font-mono text-xs tabular-nums text-text-secondary">
                        {formatValue(line.value, line.kind)}
                      </dd>
                    </div>
                  ))}
              </dl>
            </details>
          )}
        </section>
      </motion.div>

      <motion.div variants={staggerItem}>
        <MonthlyPanel />
      </motion.div>
    </motion.section>
  );
}

/* ------------------------------ Synthèse du mois --------------------------- */

/**
 * Le mois : ce qui est entré, ce qui est sorti, et pour qui.
 *
 * Rien n'est stocké ici. Les factures viennent de Facturation, les dépenses de
 * Dépenses, le temps du module Temps — et les associés sont les personnes qui
 * ont réellement écrit dans l'espace de travail, lues sur l'empreinte d'auteur
 * que porte chaque enregistrement synchronisé.
 */
function MonthlyPanel() {
  const { invoices } = useInvoices();
  const { expenses } = useExpenses();
  const { entries } = useTimeTracking();
  const timeRecords = useCollection<Record<string, unknown>>('timeEntries');

  const months = useMemo(() => recentMonths(12), []);
  const [month, setMonth] = useState(months[0]);
  const [mode, setMode] = useState<SplitMode>('equal');

  /*
    Qui a travaillé, d'après l'empreinte d'auteur des enregistrements de temps.

    `useCollection` masque cette empreinte (elle vit hors du type métier), d'où
    la seconde lecture brute : c'est ce qui permet de pondérer sans avoir eu à
    ajouter un champ « qui » au module Temps.
  */
  const work = useMemo(() => {
    const byId = new Map(timeRecords.map((r) => [r.id as string, r]));
    return entries.map((entry) => {
      const raw = byId.get(entry.id);
      return {
        who: (raw && recordWriter(raw)) || 'Non attribué',
        day: String(entry.startedAt).slice(0, 10),
        durationMs: durationMs(entry),
      };
    });
  }, [entries, timeRecords]);

  const partners = useMemo(() => {
    const found = new Set<string>();
    for (const entry of work) if (entry.who !== 'Non attribué') found.add(entry.who);
    return [...found].sort();
  }, [work]);

  const summary = useMemo(
    () =>
      monthlySummary({
        month,
        partners,
        /*
          `invoiceTotals`, et surtout pas un produit recalculé ici. La règle
          d'arrondi de la facturation arrondit le net PUIS la TVA ; multiplier
          d'un coup par 1 + taux donne un centime d'écart sur certaines lignes,
          et la synthèse du mois cesse alors de correspondre à l'écran
          Facturation — sur un total, sans que rien ne dise lequel croire.
        */
        invoices: invoices.map((i) => ({
          paidAt: i.paidAt,
          status: i.status,
          grossCents: invoiceTotals(i).grossCents,
        })),
        expenses: expenses.map((e) => ({ spentAt: e.spentAt, amountCents: e.amountCents })),
        work,
        mode,
      }),
    [month, partners, invoices, expenses, work, mode],
  );

  const positive = summary.profitCents >= 0;

  return (
    <section className="border border-border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
          <Scale size={13} strokeWidth={1.75} />
          Le mois, et sa répartition
        </h2>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          aria-label="Mois"
          className="input-focus min-h-11 border border-border bg-bg px-2 text-xs text-text-primary outline-none md:min-h-9"
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </div>

      <dl className="grid grid-cols-3 gap-px border border-border bg-border">
        <Cell icon={TrendingUp} label="Encaissé" value={formatCents(summary.revenueCents)} />
        <Cell icon={TrendingDown} label="Dépensé" value={formatCents(summary.expensesCents)} />
        <Cell
          icon={Scale}
          label={positive ? 'Bénéfice' : 'Perte'}
          value={formatCents(summary.profitCents)}
          tone={positive ? 'text-text-primary' : 'text-danger'}
        />
      </dl>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(['equal', 'weighted'] as SplitMode[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            aria-pressed={mode === value}
            className={`flex min-h-11 items-center border px-3 font-mono text-[10px] uppercase tracking-widest transition-colors md:min-h-0 md:py-2 ${
              mode === value
                ? 'border-border-strong bg-accent-muted text-text-primary'
                : 'border-border text-text-muted hover:text-text-secondary'
            }`}
          >
            {value === 'equal' ? 'Équitable' : 'Pondérée par le travail'}
          </button>
        ))}
      </div>

      {/*
        Le repli est DIT. Une répartition annoncée « pondérée » qui est en fait
        équitable, sans le signaler, se découvre au moment du virement — quand
        quelqu'un qui a travaillé trois fois plus touche la même chose.
      */}
      {summary.fellBackToEqual && (
        <p className="mt-2 border border-warning/40 bg-warning-muted px-3 py-2 text-xs leading-relaxed text-text-primary">
          Aucun temps enregistré sur ce mois : la répartition affichée est <strong>équitable</strong>,
          pas pondérée. Chronométrez le travail pour que la pondération ait une base.
        </p>
      )}

      {partners.length === 0 ? (
        <p className="mt-3 border border-border bg-bg px-3 py-3 text-xs leading-relaxed text-text-muted">
          Personne n’a encore enregistré de temps dans cet espace. Les associés apparaissent ici dès
          qu’un chronomètre a tourné — la répartition se base sur ce qui est réellement enregistré,
          pas sur une liste à tenir à jour.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-px bg-border">
          {summary.shares.map((share) => (
            <li key={share.who} className="flex items-center gap-3 bg-surface px-3 py-2.5">
              <Users size={14} strokeWidth={1.75} className="flex-shrink-0 text-text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-text-primary">{share.who}</span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  {formatWorked(share.workedMs)} · {(share.weight * 100).toFixed(0)} %
                </span>
              </span>
              <span className="flex-shrink-0 font-mono text-sm tabular-nums text-text-primary">
                {formatCents(share.amountCents)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Cell({
  icon: Icon,
  label,
  value,
  tone = 'text-text-primary',
}: {
  icon: typeof Scale;
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="bg-surface px-3 py-2.5">
      <dt className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
        <Icon size={11} strokeWidth={2} />
        {label}
      </dt>
      <dd className={`mt-0.5 font-mono text-sm tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}
