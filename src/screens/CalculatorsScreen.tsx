import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { motion } from 'framer-motion';
import { Calculator, Plus, Scale, Trash2, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { useExpenses } from '../state/useExpenses';
import { useInvoices, invoiceTotals } from '../state/useInvoices';
import { useTimeTracking } from '../state/useTimeTracking';
import { useCollection, recordWriter } from '../state/SyncContext';
import {
  evaluateProfile,
  outputsOf,
  totalKey,
  type CalcRowBlock,
  type CalcRowResult,
  type CalcKind,
} from '../state/calcEngine';
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
import { useLangue, t as tr } from '../i18n';
import { useHaloSignal } from '../components/EtatEcran';

/**
 * Ce que l'abaque a besoin de savoir d'un devis : son montant, et s'il est
 * parti. Le modèle du produit stocke `priceEuro` — un montant en EUROS, pas
 * en centimes, à la différence des factures. Le confondre donnait un devis à
 * 0,00 €, ce qui est exactement le genre de comparaison qui décrédibilise un
 * écran entier.
 */
interface DevisAnnonce {
  title?: string;
  sentAt?: string;
  priceEuro?: number;
}

/** Le montant d'un devis, ramené en centimes comme tout le reste de l'écran. */
function totalDuDevis(d: DevisAnnonce): number {
  return Math.round((typeof d.priceEuro === 'number' ? d.priceEuro : 0) * 100);
}

/* ─── L'ABAQUE — l'objet dominant des Calculateurs (`25c`) ────────────────── */

/*
  LÀ OÙ UN CONVERTISSEUR ALIGNE DEUX RÈGLES, L'ABAQUE RÉSOUT UNE RELATION À
  TROIS TERMES D'UN SEUL TRAIT.

  Trois échelles verticales de 300 px et une droite qui les traverse. Ce n'est
  pas le trait qui informe : c'est SA PENTE. Une droite qui monte
  régulièrement dit que le prix suit la charge ; une droite cassée dit qu'il
  s'en écarte, et on voit de combien avant d'avoir lu un seul chiffre.

  TROIS EXIGENCES LIÉES, et c'est l'objet qui a coûté le plus cher du système.

  (1) LA POSITION D'UN CURSEUR SE DÉDUIT DE SA VALEUR : `pct = (max − val) /
      (max − min)`, comptée depuis le HAUT. Un chiffre imprimé ne doit jamais
      pouvoir contredire son curseur, donc il n'existe qu'une expression et
      les deux la partagent (`partDuCurseur`).

  (2) LES TROIS COLONNES SONT UNE GRILLE À GOUTTIÈRE NULLE. Les respirations
      sont en `padding` INTERNE. C'est ce qui garantit que leurs centres
      tombent exactement sur 1/6, 3/6 et 5/6 de la largeur, quelle qu'elle
      soit — avec une gouttière, ces centres dépendraient de la largeur de la
      fenêtre, et la droite pointerait à côté des curseurs.

  (3) LE `<svg>` DE LA DROITE est en `inset:0` sur la bande des échelles avec
      `viewBox="0 0 100 300"` : l'ordonnée de vue égale donc le pixel, et les
      sommets s'écrivent depuis LES MÊMES valeurs calculées que les curseurs.
*/
const ABAQUE_H = 300;
const ABAQUE_GRADUATIONS = 7;
const CURSEUR_D = 15;
/** Les centres des trois colonnes, en pourcentage — 1/6, 3/6, 5/6. */
const ABAQUE_CENTRES = [100 / 6, 300 / 6, 500 / 6];

/**
 * La part d'échelle d'une valeur, comptée DEPUIS LE HAUT.
 *
 * `(max − val) / (max − min)` : 0 quand la valeur touche le plafond, 1 quand
 * elle touche le plancher. C'est la seule expression de l'écran qui place un
 * curseur, et c'est elle aussi qui pose l'ordonnée de la droite.
 */
function partDuCurseur(valeur: number, min: number, max: number): number {
  const etendue = max - min;
  if (etendue <= 0) return 0.5;
  return Math.min(1, Math.max(0, (max - valeur) / etendue));
}

/**
 * Un plafond d'échelle LISIBLE au-dessus d'une valeur.
 *
 * Une échelle taillée exactement sur la valeur mettrait tous les curseurs au
 * même endroit, et la pente ne dirait plus rien. On monte donc d'un quart
 * au-dessus, puis on arrondit au 1, 2 ou 5 de la décade — les graduations
 * tombent alors sur des nombres qu'on lit sans effort.
 */
function plafondLisible(valeur: number): number {
  const cible = Math.max(Math.abs(valeur) * 1.25, 1);
  const decade = 10 ** Math.floor(Math.log10(cible));
  for (const pas of [1, 2, 5, 10]) {
    if (cible <= pas * decade) return pas * decade;
  }
  return 10 * decade;
}

interface EchelleDeLAbaque {
  cle: string;
  label: string;
  valeur: number;
  kind: CalcKind;
  min: number;
  max: number;
  part: number;
  /** L'ordonnée du curseur, en pixels comme en unités de vue. */
  y: number;
  cherche: boolean;
}

/**
 * Construit une échelle à partir d'un terme et de sa valeur.
 *
 * `plafondDeRepli` sert aux termes À ZÉRO. Une échelle taillée sur zéro a un
 * plafond d'un centime : ses sept graduations affichent alors « 0,01 € »
 * sept fois, ce qui n'est pas une échelle mais une colonne de bruit. On lui
 * prête donc le plafond du terme de même nature le plus grand — la colonne
 * reste lisible, son curseur est en bas, et c'est vrai : il n'y a rien
 * dessus.
 */
function echelleDe(
  cle: string,
  label: string,
  valeur: number,
  kind: CalcKind,
  cherche: boolean,
  plafondDeRepli: number,
): EchelleDeLAbaque {
  const max = valeur > 0 ? plafondLisible(valeur) : Math.max(plafondDeRepli, 1);
  const part = partDuCurseur(valeur, 0, max);
  return { cle, label, valeur, kind, min: 0, max, part, y: part * ABAQUE_H, cherche };
}

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
  /*
    L'ABONNEMENT À LA LANGUE, qui manquait.

    Les libellés de cet écran passent par `tr(...)`, qui lit la langue ACTIVE
    au moment de l'appel. Sans abonnement, rien ne provoque de nouveau rendu
    quand on change de langue : l'écran gardait celle du montage. C'est la
    même correction que celle déjà écrite en tête de `TimeScreen`.
  */
  useLangue();
  const [profileId, setProfileId] = useState(DEFAULT_CALC_PROFILE_ID);
  const devis = useCollection<DevisAnnonce>('quotes');
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

  /*
    Les LIGNES suivent la même règle que les champs simples : le texte saisi
    est conservé tel quel, et chaque profil garde le sien. Un panier commencé
    ne doit pas disparaître parce qu'on est allé regarder un autre
    calculateur.

    Le profil décide du nombre de lignes d'ouverture ; le tableau n'en a
    jamais zéro, sans quoi le premier geste demandé à l'utilisateur serait
    « ajouter une ligne » devant un tableau vide.
  */
  const [rowDrafts, setRowDrafts] = useState<Record<string, RowDraft[]>>({});
  const rows = useMemo(
    () => rowDrafts[profile.id] ?? emptyRows(profile.rows?.defaultRows ?? 1),
    [rowDrafts, profile.id, profile.rows],
  );
  const setRows = (next: RowDraft[]) =>
    setRowDrafts((prev) => ({ ...prev, [profile.id]: next.length ? next : emptyRows(1) }));

  const parsedRows = useMemo(() => {
    if (!profile.rows) return undefined;
    const colonnes = profile.rows.inputs;
    return rows.map((row) => {
      const out: Record<string, number> = {};
      for (const colonne of colonnes) {
        const raw = row.values[colonne.key];
        if (raw === undefined) continue;
        out[colonne.key] = parseValue(raw, colonne.kind);
      }
      return out;
    });
  }, [profile.rows, rows]);

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

  const result = useMemo(
    () => evaluateProfile(profile, parsed, parsedRows),
    [profile, parsed, parsedRows],
  );
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

  /*
    LES TROIS TERMES DE L'ABAQUE.

    Les deux premières entrées déclarées du profil, et la SORTIE DE TÊTE —
    celle que `headline` désigne, c'est-à-dire la réponse cherchée. L'écran ne
    choisit donc rien : il lit ce que le profil a nommé. Un profil qui
    porterait moins de deux entrées n'a pas de relation à trois termes, et
    l'abaque ne se dessine pas plutôt que de s'inventer un troisième axe.
  */
  const echelles = useMemo<EchelleDeLAbaque[] | null>(() => {
    const entrees = profile.inputs.slice(0, 2);
    const tete = outputs[0];
    if (entrees.length < 2 || !tete) return null;
    const termes = [
      ...entrees.map((input) => ({
        cle: input.key,
        label: input.label,
        valeur: parsed[input.key] ?? input.defaultValue ?? 0,
        kind: input.kind,
        cherche: false,
      })),
      { cle: tete.key, label: tete.label, valeur: tete.value, kind: tete.kind, cherche: true },
    ];
    /* Le plafond de repli d'un terme nul : celui du plus grand terme DE MÊME
       NATURE. Prêter une échelle en euros à un pourcentage n'aurait pas de
       sens, et l'inverse non plus. */
    const plafondParNature = new Map<CalcKind, number>();
    for (const t of termes) {
      if (t.valeur <= 0) continue;
      const p = plafondLisible(t.valeur);
      plafondParNature.set(t.kind, Math.max(plafondParNature.get(t.kind) ?? 0, p));
    }
    return termes.map((t) =>
      echelleDe(t.cle, t.label, t.valeur, t.kind, t.cherche, plafondParNature.get(t.kind) ?? 1),
    );
  }, [profile.inputs, outputs, parsed]);

  /*
    L'ÉCART DE PENTE — ce que la droite dit sans qu'on lise un chiffre.

    Si le terme cherché tombait exactement au milieu des deux autres sur son
    échelle, la droite serait droite : le prix suivrait la charge. L'écart
    est la distance, en points d'échelle, entre là où il est et là où une
    droite parfaite l'aurait mis.
  */
  const ecartDePente = useMemo(() => {
    if (!echelles) return null;
    const milieuDroit = (echelles[0].part + echelles[2].part) / 2;
    return Math.round((echelles[1].part - milieuDroit) * 100);
  }, [echelles]);

  const haloAbaque = useHaloSignal(echelles !== null);

  /*
    LE DEVIS ANNONCÉ — la comparaison que le module demande sous l'abaque.

    On prend le dernier devis ENVOYÉ : un brouillon n'a été annoncé à
    personne, et comparer un calcul à un chiffre qu'on n'a pas donné ne dit
    rien. Sans devis envoyé, l'écran le dit au lieu d'afficher un zéro.
  */
  const dernierDevis = useMemo(() => {
    const envoyes = devis
      .filter((d) => typeof d.sentAt === 'string' && d.sentAt)
      .sort((a, b) => (b.sentAt ?? '').localeCompare(a.sentAt ?? ''));
    return envoyes[0] ?? null;
  }, [devis]);

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
          eyebrow={tr('hist.surtitre', { module: tr('hist.calculators.titre') })}
          title={tr('hist.calculators.titre')}
          description={tr('hist.calculators.unSeulMoteurAucune')}
          stats={[
            { label: tr('hist.calculators.metiersCouverts'), value: CALC_PROFILES.length },
            { label: tr('hist.calculators.metierAffiche'), value: profile.label },
          ]}
        />
      </motion.div>

      {/* ── L'ABAQUE — l'objet dominant (`25c`) ─────────────────────────── */}
      {echelles && (
        <motion.section variants={staggerItem} className="panel-raised panel-raised-wide p-5 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <p className="eyebrow">{profile.label} · l’abaque</p>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-text-muted">
              la pente dit si le prix suit la charge
            </p>
          </div>

          {/*
            LA BANDE DES ÉCHELLES. Gouttière NULLE (`gap-0`) : les
            respirations sont en `px-*` interne, sinon les centres des
            colonnes ne tomberaient plus sur 1/6, 3/6 et 5/6 et la droite
            pointerait à côté des curseurs.
          */}
          <div className="relative mt-5 w-full" style={{ height: ABAQUE_H }}>
            <div className="grid h-full grid-cols-3 gap-0">
              {echelles.map((e) => (
                <div key={e.cle} className="relative h-full px-4">
                  {/* LA RÈGLE — un filet vertical au centre exact. */}
                  <span
                    aria-hidden
                    className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 ${e.cherche ? 'bg-signal-line' : 'bg-border'}`}
                  />
                  {/* SEPT GRADUATIONS, du plafond au plancher. */}
                  {Array.from({ length: ABAQUE_GRADUATIONS }, (_, i) => {
                    const part = i / (ABAQUE_GRADUATIONS - 1);
                    const valeur = e.max - part * (e.max - e.min);
                    return (
                      <span
                        key={i}
                        aria-hidden
                        className="absolute left-1/2 flex w-full -translate-x-1/2 -translate-y-1/2 items-center gap-2"
                        style={{ top: part * ABAQUE_H }}
                      >
                        <span className="h-px flex-1 bg-border" />
                        <span className="tnum flex-shrink-0 font-mono text-[9px] tabular-nums text-text-muted">
                          {formatValue(valeur, e.kind)}
                        </span>
                        <span className="h-px flex-1 bg-border" />
                      </span>
                    );
                  })}
                  {/* LE CURSEUR — sa position se DÉDUIT de sa valeur. */}
                  <span
                    className={`absolute left-1/2 rounded-full ${e.cherche ? `bg-signal ${haloAbaque}` : 'bg-text-secondary'}`}
                    style={{
                      top: e.y,
                      width: CURSEUR_D,
                      height: CURSEUR_D,
                      transform: 'translate(-50%, -50%)',
                    }}
                    data-signal-groupe={e.cherche ? 'terme-cherche' : undefined}
                    title={`${e.label} · ${formatValue(e.valeur, e.kind)}`}
                  />
                </div>
              ))}
            </div>

            {/* LA DROITE — `inset:0`, `viewBox="0 0 100 300"` : l'ordonnée de
                vue EST le pixel, et les sommets viennent des mêmes `e.y` que
                les curseurs. */}
            <svg
              aria-hidden
              className={`pointer-events-none absolute inset-0 h-full w-full ${haloAbaque}`}
              viewBox={`0 0 100 ${ABAQUE_H}`}
              preserveAspectRatio="none"
              data-signal-groupe="terme-cherche"
            >
              <polyline
                points={echelles.map((e, i) => `${ABAQUE_CENTRES[i]},${e.y}`).join(' ')}
                fill="none"
                stroke="var(--color-signal)"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>

          {/* LES VALEURS SOUS LES COLONNES — même grille, même gouttière nulle. */}
          <div className="mt-3 grid grid-cols-3 gap-0">
            {echelles.map((e) => (
              <div key={e.cle} className="min-w-0 px-4 text-center">
                <p
                  className={`truncate font-mono text-[10px] uppercase tracking-[0.12em] ${e.cherche ? 'text-signal' : 'text-text-muted'}`}
                  data-signal-groupe={e.cherche ? 'terme-cherche' : undefined}
                >
                  {e.label}
                </p>
                <p
                  className={`tnum mt-1 truncate font-mono text-[17px] font-semibold tabular-nums ${e.cherche ? 'text-signal' : 'text-text-primary'}`}
                  data-signal-groupe={e.cherche ? 'terme-cherche' : undefined}
                >
                  {formatValue(e.valeur, e.kind)}
                </p>
              </div>
            ))}
          </div>

          {/* SOUS L'ABAQUE — la comparaison avec le devis annoncé. */}
          <div className="mt-5 border-t border-border-row pt-3">
            {dernierDevis ? (
              (() => {
                const annonce = totalDuDevis(dernierDevis);
                const calcule = echelles[2].kind === 'money' ? Math.round(echelles[2].valeur) : null;
                if (calcule === null) {
                  return (
                    <p className="text-[12.5px] leading-relaxed text-text-muted">
                      Le terme cherché n’est pas un montant : il n’y a rien à comparer au devis
                      annoncé.
                    </p>
                  );
                }
                const ecart = annonce - calcule;
                return (
                  <p className="text-[12.5px] leading-relaxed text-text-secondary">
                    Le dernier devis envoyé
                    {dernierDevis.title ? ` — ${dernierDevis.title} — ` : ' '}
                    annonce{' '}
                    <span className="tnum font-semibold text-text-primary">
                      {formatCents(annonce)}
                    </span>
                    , soit{' '}
                    <span className="tnum font-semibold text-text-primary">
                      {ecart >= 0 ? '+' : '−'} {formatCents(Math.abs(ecart))}
                    </span>{' '}
                    par rapport à ce que l’abaque donne. Les deux ne portent pas forcément sur la
                    même prestation : c’est un repère, pas un verdict.
                  </p>
                );
              })()
            ) : (
              <p className="text-[12.5px] leading-relaxed text-text-muted">
                Aucun devis envoyé : il n’y a pas de prix annoncé à comparer. Un brouillon ne
                compte pas — il n’a été annoncé à personne.
              </p>
            )}
            {ecartDePente !== null && (
              <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted">
                {Math.abs(ecartDePente) <= 3
                  ? 'La droite est droite : le terme cherché suit la charge.'
                  : `La droite casse de ${Math.abs(ecartDePente)} points : le terme cherché ${ecartDePente > 0 ? 'reste en dessous de' : 'monte au-dessus de'} ce qu’une progression régulière donnerait.`}
              </p>
            )}
          </div>
        </motion.section>
      )}

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

      {/*
        UNE COLONNE dès qu'il y a des lignes, deux sinon.

        Un tableau de six colonnes chiffrées dans une demi-largeur d'écran ne
        se lit pas : on perd l'alignement des colonnes, qui est précisément ce
        qui rend un panier comparable. L'ordre de lecture devient alors celui
        du raisonnement — ce qu'on sait, les lignes, le résultat.
      */}
      <motion.div
        variants={staggerItem}
        className={`grid gap-4 ${profile.rows ? '' : 'lg:grid-cols-[1fr_1fr]'}`}
      >
        {/* ------------------------------ Entrées ------------------------------ */}
        <section className="border border-border bg-surface p-4">
          <h2 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            Ce que vous savez
          </h2>
          {/*
            En pleine largeur, une colonne d'entrées donne des champs d'un
            mètre de long pour y taper « 22 ». La grille n'apparaît donc que
            là où la place existe — c'est-à-dire quand un tableau de lignes a
            poussé la section sur toute la largeur.
          */}
          <div
            className={`grid gap-3 ${profile.rows ? 'sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}
          >
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

        {profile.rows && (
          <RowsSection
            bloc={profile.rows}
            rows={rows}
            results={result.rows}
            scope={result.scope}
            onChange={setRows}
          />
        )}

        {/* ------------------------------ Résultats ---------------------------- */}
        <section className="border border-border bg-surface p-4">
          <h2 className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            <Calculator size={13} strokeWidth={1.9} />{tr('hist.calculators.ceQueCaDonne')}</h2>

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
              {/*
                `-my-2 py-2` : la zone tactile passe de 15 à 31 px sans que la
                mise en page bouge d'un pixel — la marge négative rend ce que
                le rembourrage a pris. Un dépliant de 15 px se rate au doigt,
                et on le rate en tapant sur le chiffre juste au-dessus.
              */}
              <summary className="-my-2 cursor-pointer py-2 font-mono text-[10px] uppercase tracking-widest text-text-muted hover:text-text-secondary">{tr('hist.calculators.detailDuCalcul')}</summary>
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

/* ------------------------------ Les lignes -------------------------------- */

/** Ce qu'une ligne du panier retient : un libellé libre et ses colonnes. */
interface RowDraft {
  name: string;
  values: Record<string, string>;
}

function emptyRows(count: number): RowDraft[] {
  return Array.from({ length: Math.max(count, 1) }, () => ({ name: '', values: {} }));
}

/**
 * Le tableau des lignes — un panier, un devis.
 *
 * ## Pourquoi un tableau et pas des cartes empilées
 *
 * Les colonnes se comparent. Un devis dont une ligne coûte dix fois les autres
 * se repère d'un coup d'œil sur une colonne alignée, et pas du tout sur six
 * cartes qui se ressemblent. Les chiffres sont donc en `tabular-nums`, alignés
 * à droite, dans des colonnes de largeur stable.
 *
 * ## Ce que la ligne de totaux fait, et ce qu'elle refuse de faire
 *
 * Elle n'additionne que ce qui s'additionne. Une colonne en POURCENTAGE n'y
 * figure pas : 22 % et 45 % ne font pas 67 %, et un chiffre faux à cet endroit
 * aurait toute l'autorité d'un total. Le moteur ne l'expose pas non plus (voir
 * `calcEngine`), donc les deux refusent la même chose au même endroit.
 */
function RowsSection({
  bloc,
  rows,
  results,
  scope,
  onChange,
}: {
  bloc: CalcRowBlock;
  rows: RowDraft[];
  results: CalcRowResult[];
  scope: Record<string, number>;
  onChange: (next: RowDraft[]) => void;
}) {
  const sorties = bloc.steps.filter((step) => step.output);

  /*
    UNE erreur par ligne, la PREMIÈRE — pas les trois.

    Le moteur retire une étape en échec de la portée, ce qui fait échouer
    proprement celles qui en dépendent : c'est la bonne règle à l'intérieur,
    mais tout relayer donnait trois messages pour une seule faute de frappe,
    dont deux identiques (« Valeur inconnue : margeBruteLigne ») et aucun
    n'ajoutant rien au premier. La première erreur est la CAUSE ; les
    suivantes en sont les conséquences, et on ne demande pas à quelqu'un de
    corriger une conséquence.
  */
  const erreurs = results.flatMap((row) => row.errors.slice(0, 1));

  const setCell = (index: number, key: string, raw: string) =>
    onChange(
      rows.map((row, i) =>
        i === index ? { ...row, values: { ...row.values, [key]: raw } } : row,
      ),
    );

  const setName = (index: number, name: string) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, name } : row)));

  return (
    /*
      `min-w-0` N'EST PAS DÉCORATIF.

      Un enfant de grille vaut `min-width: auto` par défaut : il refuse de
      devenir plus étroit que son contenu. Le tableau, large de 40 rem,
      élargissait donc la colonne de grille, puis la page — sur téléphone, les
      bordures des sections et la fin des phrases d'aide sortaient de l'écran,
      et le `overflow-x-auto` juste en dessous n'avait rien à faire défiler
      puisqu'il avait la place. Avec `min-w-0`, la section se laisse serrer et
      c'est le tableau, lui seul, qui défile.
    */
    <section className="min-w-0 border border-border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
          {bloc.label}
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
          {rows.length} ligne{rows.length > 1 ? 's' : ''}
        </span>
      </div>
      {bloc.help && (
        <p className="mb-3 text-[11px] leading-relaxed text-text-muted">{bloc.help}</p>
      )}

      {/* Un tableau large ne doit jamais pousser la page : il défile chez lui. */}
      <div className="-mx-4 overflow-x-auto px-4">
        <table className="w-full min-w-[40rem] border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="w-8 pb-2 text-left font-mono text-[10px] uppercase tracking-widest text-text-muted">
                #
              </th>
              {bloc.nameLabel && (
                <th className="pb-2 pl-2 text-left font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  {bloc.nameLabel}
                </th>
              )}
              {bloc.inputs.map((input) => (
                <th
                  key={input.key}
                  title={input.help}
                  className="pb-2 pl-2 text-right font-mono text-[10px] uppercase tracking-widest text-text-muted"
                >
                  {input.label}
                  {input.kind === 'percent' && ' (%)'}
                </th>
              ))}
              {/* Un filet sépare ce qu'on TAPE de ce qui se CALCULE : sans lui,
                  neuf colonnes de chiffres se lisent comme un seul bloc et on
                  cherche du regard où s'arrête la saisie. */}
              {sorties.map((step, i) => (
                <th
                  key={step.key}
                  className={`pb-2 pl-2 text-right font-mono text-[10px] uppercase tracking-widest text-text-secondary ${
                    i === 0 ? 'border-l border-border' : ''
                  }`}
                >
                  {step.label}
                </th>
              ))}
              <th className="w-8 pb-2" aria-label="Retirer" />
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              const calcul = results[index];
              const enEchec = (calcul?.errors.length ?? 0) > 0;
              return (
                <tr key={index} className="border-b border-border/60">
                  <td className="py-1.5 font-mono text-[11px] tabular-nums text-text-muted">
                    {index + 1}
                  </td>
                  {bloc.nameLabel && (
                    <td className="py-1.5 pl-2">
                      <input
                        value={row.name}
                        onChange={(e) => setName(index, e.target.value)}
                        placeholder="—"
                        aria-label={`${bloc.nameLabel}, ligne ${index + 1}`}
                        className="input-focus min-h-9 w-full min-w-28 border border-border bg-bg px-2 text-xs text-text-primary outline-none"
                      />
                    </td>
                  )}
                  {bloc.inputs.map((input) => (
                    <td key={input.key} className="py-1.5 pl-2">
                      <input
                        inputMode="decimal"
                        value={row.values[input.key] ?? defaultText(input.defaultValue, input.kind)}
                        onChange={(e) => setCell(index, input.key, e.target.value)}
                        placeholder={defaultText(input.defaultValue, input.kind)}
                        aria-label={`${input.label}, ligne ${index + 1}`}
                        className="input-focus min-h-9 w-full min-w-20 border border-border bg-bg px-2 text-right font-mono text-xs tabular-nums text-text-primary outline-none"
                      />
                    </td>
                  ))}
                  {sorties.map((step, i) => {
                    const ligne = calcul?.lines.find((l) => l.key === step.key);
                    return (
                      <td
                        key={step.key}
                        className={`py-1.5 pl-2 text-right font-mono text-xs tabular-nums ${
                          ligne ? 'text-text-secondary' : 'text-text-muted'
                        } ${i === 0 ? 'border-l border-border' : ''}`}
                      >
                        {/* Un tiret, pas un zéro : une ligne en échec n'est pas
                            une ligne à zéro, et les deux se lisent autrement. */}
                        {ligne ? formatValue(ligne.value, ligne.kind) : '—'}
                      </td>
                    );
                  })}
                  <td className="py-1.5 pl-2 text-right">
                    <button
                      type="button"
                      onClick={() => onChange(rows.filter((_, i) => i !== index))}
                      disabled={rows.length <= 1}
                      title={rows.length <= 1 ? 'Il faut au moins une ligne' : 'Retirer cette ligne'}
                      aria-label={`Retirer la ligne ${index + 1}`}
                      /*
                        `h-6 w-6` : `p-1` autour d'une icône de 13 px donnait
                        21 × 21, sous le minimum de WCAG 2.5.8 — et c'est le
                        bouton qui SUPPRIME une ligne, celui qu'on préfère ne
                        pas atteindre par erreur. La cellule ne bouge pas : six
                        unités tiennent dans la hauteur de rangée existante.
                      */
                      className="ml-auto flex h-6 w-6 items-center justify-center rounded text-text-muted transition-colors hover:text-danger disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:text-text-muted"
                    >
                      <Trash2 size={13} strokeWidth={1.9} />
                    </button>
                  </td>
                  {enEchec && <td className="hidden" />}
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr>
              <td className="pt-2 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                Σ
              </td>
              {bloc.nameLabel && <td />}
              {bloc.inputs.map((input) => (
                <td
                  key={input.key}
                  className="pt-2 pl-2 text-right font-mono text-xs tabular-nums text-text-muted"
                >
                  {/*
                    Une case VIDE, pas un zéro ni un tiret : cette colonne ne
                    se totalise pas, et il n'y a donc rien à annoncer. Le
                    moteur décide (voir `colonnesTotalisables`), l'écran se
                    contente de lire — les deux ne peuvent pas diverger.
                  */}
                  {scope[totalKey(input.key)] === undefined
                    ? ''
                    : formatValue(scope[totalKey(input.key)], input.kind)}
                </td>
              ))}
              {sorties.map((step, i) => (
                <td
                  key={step.key}
                  className={`pt-2 pl-2 text-right font-mono text-xs tabular-nums text-text-primary ${
                    i === 0 ? 'border-l border-border' : ''
                  }`}
                >
                  {scope[totalKey(step.key)] === undefined
                    ? '—'
                    : formatValue(scope[totalKey(step.key)], step.kind)}
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {erreurs.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {erreurs.map((err, i) => (
            <li
              key={`${err.key}-${i}`}
              className="border border-warning/40 bg-warning-muted px-3 py-2 text-xs leading-relaxed text-text-primary"
            >
              {err.message}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => onChange([...rows, { name: '', values: {} }])}
        className="mt-3 flex min-h-11 items-center gap-2 border border-border px-3 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:min-h-0 md:py-2"
      >
        <Plus size={13} strokeWidth={1.9} />
        {bloc.addLabel}
      </button>
    </section>
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
          <Scale size={13} strokeWidth={1.9} />{tr('hist.calculators.leMoisEtSa')}</h2>
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
        <Cell icon={TrendingUp} label={tr('hist.calculators.encaisse')} value={formatCents(summary.revenueCents)} />
        <Cell icon={TrendingDown} label={tr('hist.calculators.depense')} value={formatCents(summary.expensesCents)} />
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
        <p className="mt-2 border border-warning/40 bg-warning-muted px-3 py-2 text-xs leading-relaxed text-text-primary">{tr('hist.calculators.aucunTempsEnregistreSur')}<strong>{tr('hist.calculators.equitable')}</strong>{tr('hist.calculators.pasPondereeChronometrezLe')}</p>
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
              <Users size={14} strokeWidth={1.9} className="flex-shrink-0 text-text-muted" />
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
