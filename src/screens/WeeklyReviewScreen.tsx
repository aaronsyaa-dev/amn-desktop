import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection } from '../state/SyncContext';
import { useAuth } from '../auth/AuthContext';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

type Question = 'avance' | 'bloque' | 'lache' | 'garde' | 'prochaine';
interface ReviewData {
  week: string;
  avance: string;
  bloque: string;
  lache: string;
  garde: string;
  prochaine: string;
  byEmail: string;
  updatedAt: string;
}
const QUESTIONS: Question[] = ['avance', 'bloque', 'lache', 'garde', 'prochaine'];
const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function lundiDe(d: Date): string {
  const j = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  j.setDate(j.getDate() - ((j.getDay() + 6) % 7));
  return isoJour(j);
}
const VIDE: Record<Question, string> = { avance: '', bloque: '', lache: '', garde: '', prochaine: '' };


/**
 * LE MIROIR — l'objet dominant de la Revue hebdo (système de design, `16e`)
 * ════════════════════════════════════════════════════════════════════════
 *
 * Six indicateurs, chacun une paire de barres autour d'un même axe
 * horizontal : la semaine en cours pointe vers le HAUT en encre claire, la
 * précédente vers le BAS en gris sourd. La comparaison ne demande aucun
 * calcul — la barre du haut est plus courte ou plus longue, c'est tout.
 *
 * ARBITRAGE ENTRE LE PAQUET ET LE MODÈLE, ET CELUI-CI SE RÉSOUT SANS AJOUTER
 * DE CHAMP. La revue hebdo du produit est un formulaire de cinq questions en
 * texte libre — il n'y a pas d'« indicateurs » à comparer dedans, et en
 * inventer un champ reviendrait à demander de saisir à la main des chiffres
 * que le produit connaît déjà. Les six indicateurs sont donc LUS dans les
 * autres modules : facturé, encaissé, rendez-vous, temps saisi, dépenses,
 * tâches closes. C'est exactement ce qu'on compare le vendredi, et ça ne
 * demande aucune saisie de plus. Le paquet a raison sur l'instrument ; le
 * modèle avait déjà les données, ailleurs.
 *
 * LA RÈGLE DE GÉOMÉTRIE : les deux barres d'une paire sont à la MÊME ÉCHELLE,
 * sinon le miroir ment. Chaque paire a sa propre échelle — comparer des euros
 * à des heures n'aurait aucun sens — mais à l'intérieur d'une paire, le
 * plafond est le maximum des deux semaines. C'est ce qui fait qu'une barre
 * plus courte SIGNIFIE moins.
 */

interface Indicateur {
  cle: string;
  label: string;
  /** La valeur de la semaine en cours. */
  courante: number;
  /** La valeur de la semaine précédente. */
  precedente: number;
  /** Comment l'écrire. */
  format: (n: number) => string;
  /**
   * LE PLANCHER — en dessous duquel une baisse ne veut rien dire.
   *
   * Sans lui, la chute relative désigne toujours le plus petit nombre :
   * passer d'UNE tâche close à zéro est une baisse de 100 %, et elle écrase
   * une perte de 134 € sur 630, qui est le vrai recul de la semaine. Un
   * indicateur dont la semaine précédente tient sous ce plancher n'a pas
   * assez de matière pour qu'une baisse signifie quoi que ce soit.
   *
   * La valeur dépend de l'unité, donc elle est portée par l'indicateur et
   * non par la fonction : deux tâches, cent euros, deux heures.
   */
  plancher: number;
}

const MIROIR_H = 72;

function Miroir({ indicateurs }: { indicateurs: Indicateur[] }) {
  /*
    LE SEUL RECUL — l'ambre, et il se calcule. Parmi les indicateurs qui
    BAISSENT, celui dont la chute relative est la plus forte. Si aucun ne
    recule, l'écran n'a pas d'ambre : une semaine qui monte partout n'a rien
    à signaler, et c'est le paquet qui l'écrit.

    La chute est relative et non absolue : perdre 200 € sur 8 000 n'est pas
    la même chose que perdre 200 € sur 400, et une comparaison en valeur
    absolue désignerait toujours l'indicateur qui porte les plus gros nombres.
  */
  const recul = React.useMemo(() => {
    let pire: { cle: string; chute: number } | null = null;
    for (const i of indicateurs) {
      if (i.precedente < i.plancher || i.courante >= i.precedente) continue;
      const chute = (i.precedente - i.courante) / i.precedente;
      if (pire === null || chute > pire.chute) pire = { cle: i.cle, chute };
    }
    return pire;
  }, [indicateurs]);

  return (
    <section className="panel-raised panel-raised-wide px-[30px] pb-[26px] pt-[30px]">
      <div className="mb-[26px] flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <span className="eyebrow text-text-secondary">Cette semaine, et celle d’avant</span>
        <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">
          {recul ? 'UN INDICATEUR RECULE' : 'RIEN NE RECULE'}
        </span>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${indicateurs.length}, minmax(0, 1fr))` }}>
        {indicateurs.map((i) => {
          const ambre = recul?.cle === i.cle;
          /* Le plafond de LA PAIRE : les deux barres partagent la même
             échelle, sinon le miroir ment. */
          const plafond = Math.max(i.courante, i.precedente, 1);
          const hautHaut = (i.courante / plafond) * MIROIR_H;
          const hautBas = (i.precedente / plafond) * MIROIR_H;
          return (
            <div key={i.cle} className="flex min-w-0 flex-col items-center">
              {/* La semaine en cours, vers le haut. */}
              <span className="flex w-full items-end justify-center" style={{ height: `${MIROIR_H}px` }}>
                <span
                  data-signal-groupe={ambre ? 'indicateur-en-recul' : undefined}
                  className={`w-full ${ambre ? 'bg-signal' : 'bg-text-body'}`}
                  style={{ height: `${Math.max(2, hautHaut)}px` }}
                />
              </span>
              {/* L'axe — c'est lui le miroir. */}
              <span
                data-signal-groupe={ambre ? 'indicateur-en-recul' : undefined}
                className={`h-px w-full ${ambre ? 'bg-signal' : 'bg-border-raised'}`}
              />
              {/* La semaine précédente, vers le bas, en gris sourd. */}
              <span className="flex w-full items-start justify-center" style={{ height: `${MIROIR_H}px` }}>
                <span className="w-full bg-[#2b2b2b]" style={{ height: `${Math.max(2, hautBas)}px` }} />
              </span>
            </div>
          );
        })}
      </div>

      {/* La rangée de valeurs, alignée COLONNE PAR COLONNE sur le miroir :
          même grille, même gouttière. Une rangée recalibrée à coups de marges
          se décalerait au premier changement de largeur. */}
      <div
        className="mt-5 grid gap-4 border-t border-border-raised pt-5"
        style={{ gridTemplateColumns: `repeat(${indicateurs.length}, minmax(0, 1fr))` }}
      >
        {indicateurs.map((i) => {
          const ambre = recul?.cle === i.cle;
          const delta = i.courante - i.precedente;
          return (
            <div key={i.cle} className="flex min-w-0 flex-col items-center text-center">
              <span
                data-signal-groupe={ambre ? 'indicateur-en-recul' : undefined}
                className={`block truncate font-mono text-[9.5px] uppercase tracking-[0.1em] ${
                  ambre ? 'text-signal' : 'text-text-muted'
                }`}
                title={i.label}
              >
                {i.label}
              </span>
              <span
                data-signal-groupe={ambre ? 'indicateur-en-recul' : undefined}
                className={`tnum mt-2 block font-mono text-[17px] font-semibold tracking-[-0.03em] ${
                  ambre ? 'text-signal' : 'text-text-primary'
                }`}
              >
                {i.format(i.courante)}
              </span>
              <span
                data-signal-groupe={ambre ? 'indicateur-en-recul' : undefined}
                className={`tnum mt-1 block font-mono text-[10.5px] ${
                  ambre ? 'text-signal' : delta > 0 ? 'text-text-secondary' : 'text-text-muted'
                }`}
              >
                {delta === 0 ? '=' : `${delta > 0 ? '+' : '−'}${i.format(Math.abs(delta))}`}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * LA REVUE HEBDO — cinq questions le vendredi.
 *
 * Pour qui : une petite équipe ou une indépendante qui enchaîne les semaines
 * sans jamais s'arrêter dessus. Ce que ça règle : une page par semaine, cinq
 * réponses courtes, gardées ensemble — la suivante commence plus nette. Une
 * seule revue par semaine et par organisation : c'est un rite d'équipe, pas
 * un journal intime (le Journal de bord et les Priorités sont là pour ça).
 */
export function WeeklyReviewScreen() {
  const { t, langue } = useLangue();
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const { user } = useAuth();
  const { upsert } = useSync();
  const brutes = useCollection<ReviewData>('weeklyReviews');
  const semaine = lundiDe(new Date());
  const courante = brutes.find((r) => r.week === semaine) ?? null;
  const [reponses, setReponses] = useState<Record<Question, string>>(VIDE);
  const [gardee, setGardee] = useState(false);

  useEffect(() => {
    if (courante) setReponses({ avance: courante.avance, bloque: courante.bloque, lache: courante.lache, garde: courante.garde, prochaine: courante.prochaine });
  }, [courante?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const passees = useMemo(() => brutes.filter((r) => r.week !== semaine).sort((a, b) => b.week.localeCompare(a.week)), [brutes, semaine]);
  const serie = useMemo(() => {
    let n = 0;
    const d = new Date();
    if (!courante) d.setDate(d.getDate() - 7);
    for (let k = 0; k < 104; k += 1) {
      if (!brutes.some((r) => r.week === lundiDe(d))) break;
      n += 1;
      d.setDate(d.getDate() - 7);
    }
    return n;
  }, [brutes, courante]);
  /*
    LES SIX INDICATEURS DU MIROIR — lus dans les autres modules, jamais saisis.

    Une semaine se compare sur ce qu'on a facturé, encaissé, vu, passé, sorti
    et terminé. Le produit tient déjà les six, chacun dans son module ; les
    redemander ici serait demander de recopier des chiffres qu'on a déjà.

    Les bornes : la semaine en cours va du lundi à maintenant, la précédente
    du lundi d'avant au dimanche d'avant. On compare donc une semaine
    INCOMPLÈTE à une semaine complète — c'est voulu, et c'est ce qu'on regarde
    un vendredi : « à ce stade, est-ce que je suis au-dessus ou en dessous ».
  */
  const factures = useCollection<{ status?: string; issuedAt?: string; paidAt?: string; lines?: { quantity?: number; unitPriceCents?: number }[] }>('invoices');
  const rendezVous = useCollection<{ startAt?: string }>('appointments');
  const saisies = useCollection<{ startedAt?: string; endedAt?: string }>('timeEntries');
  /*
    POURQUOI « NOUVEAUX CLIENTS » ET PAS « DÉPENSES ».

    Le paquet définit l'ambre du miroir géométriquement : « la seule barre plus
    courte que son reflet ». La règle ne tient que si les six indicateurs vont
    dans le MÊME SENS — plus, c'est mieux. Les dépenses vont dans l'autre :
    une semaine où l'on a moins dépensé verrait sa barre raccourcir, l'écran
    annoncerait « un indicateur recule », et il dirait le contraire de la
    bonne nouvelle.

    Deux issues : porter un sens par indicateur et poser l'ambre sur une barre
    PLUS LONGUE — ce qui casse la lecture géométrique du miroir, seule raison
    d'être de l'instrument ; ou ne mettre dans le miroir que des indicateurs
    qui montent quand ça va bien. C'est le second. Les dépenses gardent leur
    module, où la comparaison a son propre sens.

    (Le premier jet lisait `at` sur les dépenses, champ qui n'existe pas — il
    s'appelle `spentAt` — et la colonne restait à zéro sans avoir l'air cassée.
    Elle avait l'air d'une semaine calme. C'est le genre d'erreur qui ne se
    voit qu'en regardant de vraies données.)
  */
  const nouvellesFiches = useCollection<{ createdAt?: string }>('clients');
  const taches = useCollection<{ status?: string; createdAt?: string }>('tasks');

  const indicateurs = useMemo(() => {
    const lundiCourant = new Date(`${semaine}T00:00:00`);
    const lundiPrecedent = new Date(lundiCourant);
    lundiPrecedent.setDate(lundiPrecedent.getDate() - 7);
    const finPrecedente = new Date(lundiCourant);

    const dansSemaine = (iso: string | undefined, debut: Date, fin: Date) => {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      return t >= debut.getTime() && t < fin.getTime();
    };
    const maintenant = new Date();

    const totalFacture = (debut: Date, fin: Date) =>
      factures
        .filter((f) => f.status !== 'draft' && dansSemaine(f.issuedAt, debut, fin))
        .reduce(
          (n, f) =>
            n + (f.lines ?? []).reduce((m, l) => m + (l.quantity ?? 0) * (l.unitPriceCents ?? 0), 0),
          0,
        ) / 100;
    const totalEncaisse = (debut: Date, fin: Date) =>
      factures
        .filter((f) => dansSemaine(f.paidAt, debut, fin))
        .reduce(
          (n, f) =>
            n + (f.lines ?? []).reduce((m, l) => m + (l.quantity ?? 0) * (l.unitPriceCents ?? 0), 0),
          0,
        ) / 100;
    const nbRdv = (debut: Date, fin: Date) => rendezVous.filter((a) => dansSemaine(a.startAt, debut, fin)).length;
    const heures = (debut: Date, fin: Date) =>
      saisies
        .filter((e) => e.endedAt && dansSemaine(e.startedAt, debut, fin))
        .reduce((n, e) => n + (new Date(e.endedAt as string).getTime() - new Date(e.startedAt as string).getTime()), 0) /
      3_600_000;
    const nouveaux = (debut: Date, fin: Date) =>
      nouvellesFiches.filter((c) => dansSemaine(c.createdAt, debut, fin)).length;
    const closes = (debut: Date, fin: Date) =>
      taches.filter((t) => t.status === 'done' && dansSemaine(t.createdAt, debut, fin)).length;

    const euro = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;
    const entier = (n: number) => String(Math.round(n));
    const heure = (n: number) => `${n.toFixed(1).replace('.', ',')} h`;

    return [
      { cle: 'facture', label: 'Facturé', courante: totalFacture(lundiCourant, maintenant), precedente: totalFacture(lundiPrecedent, finPrecedente), format: euro, plancher: 100 },
      { cle: 'encaisse', label: 'Encaissé', courante: totalEncaisse(lundiCourant, maintenant), precedente: totalEncaisse(lundiPrecedent, finPrecedente), format: euro, plancher: 100 },
      { cle: 'rdv', label: 'Rendez-vous', courante: nbRdv(lundiCourant, maintenant), precedente: nbRdv(lundiPrecedent, finPrecedente), format: entier, plancher: 2 },
      { cle: 'temps', label: 'Temps saisi', courante: heures(lundiCourant, maintenant), precedente: heures(lundiPrecedent, finPrecedente), format: heure, plancher: 2 },
      { cle: 'clients', label: 'Nouveaux clients', courante: nouveaux(lundiCourant, maintenant), precedente: nouveaux(lundiPrecedent, finPrecedente), format: entier, plancher: 2 },
      { cle: 'taches', label: 'Tâches closes', courante: closes(lundiCourant, maintenant), precedente: closes(lundiPrecedent, finPrecedente), format: entier, plancher: 2 },
    ];
  }, [factures, rendezVous, saisies, nouvellesFiches, taches, semaine]);

  /*
    UNE PAIRE NULLE DES DEUX CÔTÉS N'EST PAS UN INDICATEUR — c'est une absence,
    et on ne dessine pas une absence. Deux barres à zéro de part et d'autre de
    l'axe laissent une colonne vide surmontée d'un « 0 € », c'est-à-dire trois
    façons de dire la même chose et aucune qui informe. La colonne disparaît,
    le miroir se resserre sur ce qui existe.
  */
  const indicateursVus = useMemo(
    () => indicateurs.filter((i) => i.courante > 0 || i.precedente > 0),
    [indicateurs],
  );
  /* Sous deux paires, ce n'est plus un miroir : c'est un chiffre à côté d'un
     autre, et deux barres ne valent pas une carte dominante. */
  const miroirLisible = indicateursVus.length >= 2;

  const remplie = QUESTIONS.some((q) => reponses[q].trim());
  const dateSemaine = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long' });

  const garder = async () => {
    if (!remplie) return;
    await upsert('weeklyReviews', `week-${semaine}`, { week: semaine, ...reponses, byEmail: user?.email ?? '', updatedAt: new Date().toISOString() });
    setGardee(true);
    window.setTimeout(() => setGardee(false), 2500);
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('pilotage.surtitre', { module: t('revueHebdo.titre') })}
          title={t('revueHebdo.titre')}
          description={t('revueHebdo.description')}
          stats={[
            { label: t('revueHebdo.stat.cetteSemaine'), value: courante ? t('revueHebdo.faite') : t('revueHebdo.aFaire'), emphasis: !courante },
            { label: t('revueHebdo.stat.revues'), value: brutes.length },
            { label: t('revueHebdo.stat.serie'), value: serie },
          ]}
        />
      </motion.div>

      {/* ── L'OBJET DOMINANT : le miroir ─────────────────────────────── */}
      {miroirLisible && (
        <motion.div variants={staggerItem}>
          <Miroir indicateurs={indicateursVus} />
        </motion.div>
      )}

      {brutes.length === 0 && (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('revueHebdo.vide.titre')}>{t('revueHebdo.vide.texte')}</FirstRun>
        </motion.div>
      )}

      <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void garder(); }} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <p className="eyebrow">{t('revueHebdo.semaineDu', { date: dateSemaine(semaine) })}</p>
        {QUESTIONS.map((q) => (
          <label key={q} className="flex flex-col gap-1 text-sm text-text-primary">
            {t(`revueHebdo.q.${q}` as Parameters<typeof t>[0])}
            <textarea value={reponses[q]} onChange={(e) => setReponses((r) => ({ ...r, [q]: e.target.value }))} rows={2} className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none" />
          </label>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={!remplie} className="flex min-h-11 items-center gap-2 bg-accent px-4 text-sm font-semibold text-bg disabled:opacity-40 md:min-h-0 md:py-2">
            {gardee ? <Check size={14} /> : null} {gardee ? t('revueHebdo.enregistree') : t('revueHebdo.enregistrer')}
          </button>
          {courante && <span className="text-xs text-text-muted">{courante.byEmail.split('@')[0]}</span>}
        </div>
      </motion.form>

      {passees.length > 0 && (
        <motion.section variants={staggerItem} aria-label={t('revueHebdo.precedentes')} className="flex flex-col gap-3">
          <p className="eyebrow">{t('revueHebdo.precedentes')}</p>
          {passees.map((r) => (
            <article key={r.week} className="rounded-xl border border-border bg-surface p-4">
              <p className="mb-2 text-sm font-semibold text-text-primary">{t('revueHebdo.semaineDu', { date: dateSemaine(r.week) })}</p>
              <dl className="grid gap-2 text-xs sm:grid-cols-2">
                {QUESTIONS.filter((q) => r[q].trim()).map((q) => (
                  <div key={q}>
                    <dt className="text-text-muted">{t(`revueHebdo.q.${q}` as Parameters<typeof t>[0])}</dt>
                    <dd className="whitespace-pre-wrap text-text-secondary">{r[q]}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </motion.section>
      )}
    </motion.section>
  );
}
