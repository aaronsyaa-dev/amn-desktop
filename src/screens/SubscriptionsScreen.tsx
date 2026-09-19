import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useInvoices } from '../state/useInvoices';
import { useToast } from '../state/ToastContext';
import { formatCents } from '../lib/money';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

type Period = 'monthly' | 'quarterly' | 'yearly';
interface SubscriptionData {
  label: string;
  customerName: string;
  customerEmail: string;
  amountCents: number;
  vatRate: number;
  period: Period;
  nextAt: string;
  active: boolean;
  createdAt: string;
}
const MOIS: Record<Period, number> = { monthly: 1, quarterly: 3, yearly: 12 };
const isoDay = () => new Date().toISOString().slice(0, 10);
const plusMois = (jour: string, n: number) => {
  const d = new Date(`${jour}T00:00:00`);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
};

/**
 * LES ABONNEMENTS RÉCURRENTS — ce qui revient chaque mois, facturé en un geste.
 *
 * Pour qui : un prestataire avec des forfaits (maintenance, supervision,
 * abonnement à la boutique). Ce que ça règle : la facture qu'on oublie
 * d'émettre le premier du mois. Chaque abonnement porte sa prochaine
 * échéance ; « Facturer » crée le brouillon dans Facturation (le moteur
 * existant, avec ses numéros et ses mentions) et avance l'échéance. Le
 * revenu récurrent mensuel se lit en haut, sans tableur.
 */
export function SubscriptionsScreen() {
  const { t, langue } = useLangue();
  const { upsert, remove } = useSync();
  const { createDraft } = useInvoices();
  const { notify } = useToast();
  const brutes = useCollection<SubscriptionData>('subscriptions');
  const [ouvert, setOuvert] = useState(false);
  const [label, setLabel] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<Period>('monthly');
  const jour = isoDay();
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';

  const abonnements = useMemo(() => [...brutes].sort((a, b) => Number(b.active) - Number(a.active) || a.nextAt.localeCompare(b.nextAt)), [brutes]);
  const actifs = abonnements.filter((s) => s.active);
  const mrr = actifs.reduce((n, s) => n + Math.round(s.amountCents / MOIS[s.period]), 0);
  const aFacturer = actifs.filter((s) => s.nextAt <= jour);

  /*
    LA COLONNE ET SON RUBAN. Le ruban est déduit des parts de la colonne, pas
    calculé en parallèle : c'est la seule façon de garantir qu'il porte
    exactement le même mélange de forfaits — la règle que `MODULES.md` pose
    sur ce module.
  */
  const auMois = (s: SubscriptionData) => Math.round(s.amountCents / MOIS[s.period]);
  const parts = useMemo(
    () => partsDeColonne(actifs, auMois, (n) => `${n} autres forfaits`),
    [actifs],
  );
  const crans = useMemo(() => ruban(actifs, parts, (p) => MOIS[p], jour), [actifs, parts, jour]);

  const ajouter = async () => {
    const cents = Math.round((Number(amount.replace(',', '.')) || 0) * 100);
    if (!label.trim() || cents <= 0) return;
    await upsert('subscriptions', uid('abo'), { label: label.trim(), customerName: customerName.trim(), customerEmail: '', amountCents: cents, vatRate: 20, period, nextAt: jour, active: true, createdAt: new Date().toISOString() });
    setLabel(''); setCustomerName(''); setAmount(''); setOuvert(false);
  };
  const facturer = async (s: SubscriptionData & { id: string }) => {
    const id = createDraft({
      clientId: 0,
      billTo: { name: s.customerName || s.label, company: '', email: s.customerEmail, address: '', vatNumber: '' },
      notes: t('abonnements.noteFacture', { libelle: s.label, echeance: new Date(`${s.nextAt}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) }),
      lines: [{ id: 'abo-1', label: s.label, quantity: 1, unitPriceCents: s.amountCents, vatRate: s.vatRate }],
    });
    await upsert('subscriptions', s.id, { ...s, nextAt: plusMois(s.nextAt, MOIS[s.period]) });
    notify({ title: t('abonnements.brouillonCree'), body: t('abonnements.brouillonCorps', { client: s.customerName || s.label }) });
    void id;
  };
  const periode = (p: Period) => t(`abonnements.periode.${p}` as Parameters<typeof t>[0]);
  /*
    « Mensuel » plutôt que « Chaque mois ».
    La forme longue est une phrase, et elle est juste dans le formulaire, où
    l'on choisit un rythme. En étiquette de colonne elle devient une étiquette
    de deux lignes qui pousse tout le reste : un adjectif dit la même chose en
    un mot, et c'est ce que la maquette écrit.
  */
  const periodeCourte = (p: Period) => t(`abonnements.periodeCourte.${p}` as Parameters<typeof t>[0]);
  /* « 15 sep. » — la date d'échéance se lit en un coup d'œil dans une ligne
     de registre ; l'année ne sert que si elle n'est pas la courante, et une
     échéance d'abonnement ne va jamais bien loin. */
  const dateCourte = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(locale, { day: '2-digit', month: 'short' });

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('commerce.surtitre', { module: t('abonnements.titre') })}
          title={t('abonnements.titre')}
          description={aFacturer.length > 0 ? t('abonnements.aFacturer', { n: aFacturer.length }) : t('abonnements.description')}
          /* Le revenu récurrent est le CHIFFRE UNIQUE de l'écran, juste
             dessous, à soixante-seize pixels. Le répéter ici en statistique de
             quatorze en ferait deux chiffres qui se disputent le même rôle. */
          stats={[
            { label: t('abonnements.stat.actifs'), value: actifs.length },
            { label: t('abonnements.stat.suspendus'), value: abonnements.length - actifs.length },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('abonnements.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void ajouter(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('abonnements.champLibelle')} aria-label={t('abonnements.champLibelle')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder={t('abonnements.champClient')} aria-label={t('abonnements.champClient')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={t('abonnements.champMontant')} aria-label={t('abonnements.champMontant')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label={t('abonnements.champPeriode')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none">
            {(['monthly', 'quarterly', 'yearly'] as Period[]).map((p) => <option key={p} value={p}>{periode(p)}</option>)}
          </select>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" className="bg-accent px-4 py-2 text-sm font-semibold text-bg">{t('abonnements.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {abonnements.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('abonnements.vide.titre')} action={{ label: t('abonnements.vide.action'), onClick: () => setOuvert(true) }}>{t('abonnements.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <>
          {/*
            LA COLONNE DE REVENU — l'objet dominant (`13b`).

            Le revenu récurrent était un chiffre de soixante-quatre pixels et
            une ventilation par périodicité. Le chiffre reste — il est juste à
            côté — mais ce n'est plus lui l'objet : c'est la PILE. Une hauteur
            par forfait, proportionnelle à ce qu'il rapporte par mois, et la
            question « d'où vient ce revenu » se répond sans lire un chiffre.

            L'AMBRE N'EST PAS ICI. Il va au bon à facturer, plus bas : la
            colonne est un état, pas une décision.
          */}
          <motion.section variants={staggerItem} className="panel-raised panel-raised-wide panel-ticks px-6 py-6">
            <p className="eyebrow mb-5">{t('abonnements.revenuRecurrent')}</p>
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
              <div className="flex-shrink-0" style={{ width: COLONNE_L }}>
                <div
                  className="flex w-full flex-col-reverse overflow-hidden bg-sunken"
                  style={{ height: COLONNE_H }}
                >
                  {/*
                    `flex-col-reverse` : la pile se construit par le BAS, comme
                    une pile. Posée par le haut, la part la plus lourde flotte
                    au-dessus des autres et l'objet cesse de ressembler à ce
                    qu'il est.
                  */}
                  {parts.map((part) => {
                    const hauteur = mrr > 0 ? (part.mensuelCents / mrr) * COLONNE_H : 0;
                    /* Un chiffre gravé sur une teinte sombre ou dans un
                       segment trop court ne se lit pas — la légende s'en
                       charge, c'est son travail. */
                    const gravable = hauteur >= GRAVURE_MIN_H && part.teinte === TEINTES[0];
                    return (
                      <div
                        key={part.cle}
                        className="flex w-full items-center justify-center"
                        style={{ height: hauteur, background: part.teinte }}
                        title={`${part.label} · ${formatCents(part.mensuelCents)} par mois`}
                      >
                        {gravable && (
                          <span className="tnum font-mono text-[11px] font-bold text-bg">
                            {formatCents(part.mensuelCents)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <p className="tnum font-mono text-[46px] font-bold leading-[0.92] tracking-[-0.04em] text-text-primary sm:text-[64px]">
                  {formatCents(mrr)}
                </p>
                <p className="mt-4 max-w-[52ch] text-[14.5px] leading-[1.7] text-text-secondary [text-wrap:pretty]">
                  {t('abonnements.chaqueForfaitRamene')}
                </p>

                <div className="mt-6 flex flex-col divide-y divide-border-row">
                  {parts.map((part) => (
                    <div key={part.cle} className="flex items-center gap-3 py-2">
                      <span
                        className="h-2.5 w-2.5 flex-shrink-0"
                        style={{ background: part.teinte }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-text-secondary">
                        {part.label}
                        <span className="text-text-muted">
                          {' · '}
                          {part.abonnes} {part.abonnes > 1 ? 'clients' : 'client'}
                        </span>
                      </span>
                      <span className="tnum w-[96px] flex-shrink-0 text-right font-mono text-[12.5px] text-text-primary">
                        {formatCents(part.mensuelCents)}
                      </span>
                      <span className="tnum w-[52px] flex-shrink-0 text-right font-mono text-[12.5px] text-text-muted">
                        {mrr > 0 ? Math.round((part.mensuelCents / mrr) * 100) : 0} %
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>

          {/*
            LE RUBAN DES ÉCHÉANCES — un cran par renouvellement des trente
            prochains jours, à la teinte de son forfait.

            Il porte donc EXACTEMENT le même mélange que la colonne, puisqu'il
            se déduit d'elle. Si la colonne dit trois fois le gros forfait et
            cinq fois le petit, le ruban a ces huit crans-là et pas d'autres.
          */}
          <motion.section variants={staggerItem} className="panel px-5 py-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <p className="eyebrow">Trente prochains jours</p>
              <p className="tnum font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
                {crans.length} renouvellement{crans.length > 1 ? 's' : ''}
              </p>
            </div>
            {crans.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-text-secondary">
                Aucun renouvellement d’ici trente jours. Le prochain tombe plus loin.
              </p>
            ) : (
              <>
                <div className="relative h-11 w-full bg-sunken">
                  {crans.map((c) => (
                    <span
                      key={c.cle}
                      className="absolute inset-y-0 w-[3px]"
                      style={{
                        left: `${(c.dansNJours / RUBAN_JOURS) * 100}%`,
                        background: c.teinte,
                      }}
                      title={`${c.label} · ${formatCents(c.montantCents)} · dans ${c.dansNJours} j`}
                    />
                  ))}
                </div>
                <div className="relative mt-2 h-4">
                  {[0, 10, 20, 30].map((j) => (
                    <span
                      key={j}
                      className="absolute top-0 font-mono text-[9.5px] uppercase tracking-[0.2em] text-text-muted"
                      style={{
                        left: j === RUBAN_JOURS ? undefined : `${(j / RUBAN_JOURS) * 100}%`,
                        right: j === RUBAN_JOURS ? 0 : undefined,
                      }}
                    >
                      {j} J
                    </span>
                  ))}
                </div>
              </>
            )}
          </motion.section>

          {/*
            LA FILE — ce qui a dépassé son échéance et attend un geste.

            L'AMBRE DE L'ÉCRAN est là, et nulle part ailleurs : la plaque
            « 2 à facturer », en encre de signal comme l'exige la règle 2. Rien
            à facturer, pas de file, pas d'ambre — l'écran redevient un chiffre
            et un registre, ce qui est exactement ce qu'il faut lire.
          */}
          {aFacturer.length > 0 && (
            <motion.section variants={staggerItem} className="panel">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-5 py-3.5">
                <span className="signal-plate flex items-center gap-2 px-2.5 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.2em]">
                  <span className="h-1.5 w-1.5 rounded-full bg-signal-ink" aria-hidden />
                  {t('abonnements.nAFacturer', { n: aFacturer.length })}
                </span>
                <span className="text-[13.5px] text-text-secondary">{t('abonnements.echeanceDepassee')}</span>
                <span className="eyebrow ml-auto">{t('abonnements.leBrouillonPartDans')}</span>
              </div>
              <ul className="flex flex-col">
                {aFacturer.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-[#1a1a1a] px-5 py-4 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[16px] font-semibold text-text-primary">{s.label}</p>
                      <p className="eyebrow mt-1.5">
                        {[s.customerName || null, periodeCourte(s.period), t('abonnements.echeanceLe', { date: dateCourte(s.nextAt) })]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <p className="tnum flex-shrink-0 font-mono text-[20px] font-semibold tracking-[-0.03em] text-text-primary">
                      {formatCents(s.amountCents)}
                    </p>
                    <div className="flex flex-shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => void facturer(s)}
                        className="min-h-11 bg-accent px-4 text-[12.5px] font-semibold text-bg shadow-[0_12px_26px_-12px_rgba(0,0,0,.9)] transition-colors hover:bg-accent-hover"
                      >
                        {t('abonnements.facturer')}
                      </button>
                      <button
                        type="button"
                        onClick={() => void upsert('subscriptions', s.id, { ...s, active: false })}
                        className="min-h-11 border border-border-strong px-4 text-[12.5px] font-semibold text-text-primary transition-colors hover:bg-surface-hover"
                      >
                        {t('abonnements.suspendre')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </motion.section>
          )}

          {/* LES FORFAITS — le registre, prochaine échéance d'abord. */}
          <motion.section variants={staggerItem}>
            <div className="mb-1 flex items-center gap-4">
              <p className="eyebrow flex-shrink-0">{t('abonnements.lesForfaits')}</p>
              <span className="h-px flex-1 bg-border-section" aria-hidden />
              <p className="eyebrow flex-shrink-0">{t('abonnements.prochaineEcheanceDAbord')}</p>
            </div>
            <ul className="flex flex-col">
              {abonnements.map((s) => (
                <li
                  key={s.id}
                  className={`flex flex-wrap items-baseline gap-x-5 gap-y-2 border-b border-[#161616] py-3.5 last:border-b-0 ${
                    s.active ? '' : 'text-text-muted'
                  }`}
                >
                  <p className="min-w-0 flex-1 truncate text-[14.5px]">
                    <span className={s.active ? 'font-semibold text-text-primary' : 'font-semibold'}>{s.label}</span>
                    {s.customerName && <span className="text-text-muted"> · {s.customerName}</span>}
                  </p>
                  <span className="eyebrow w-[92px] flex-shrink-0">{periodeCourte(s.period)}</span>
                  <span className="eyebrow w-[140px] flex-shrink-0">
                    {s.active
                      ? t('abonnements.prochaineCourt', { date: dateCourte(s.nextAt) })
                      : t('abonnements.suspendu')}
                  </span>
                  <span
                    className={`tnum w-[100px] flex-shrink-0 text-right font-mono text-[13.5px] font-semibold ${
                      s.active ? 'text-text-primary' : ''
                    }`}
                  >
                    {formatCents(s.amountCents)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void upsert('subscriptions', s.id, { ...s, active: !s.active })}
                    className="flex-shrink-0 font-mono text-[9.5px] font-bold uppercase tracking-[0.2em] text-text-muted underline-offset-4 transition-colors hover:text-text-primary hover:underline"
                  >
                    {s.active ? t('abonnements.suspendre') : t('abonnements.reprendre')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove('subscriptions', s.id)}
                    aria-label={t('abonnements.supprimer')}
                    title={t('abonnements.supprimer')}
                    className="flex-shrink-0 text-text-muted transition-colors hover:text-danger"
                  >
                    <Trash2 size={13} strokeWidth={1.9} />
                  </button>
                </li>
              ))}
            </ul>
          </motion.section>
        </>
      )}

    </motion.section>
  );
}
/* ------------------------------------------ la colonne de revenu (`13b`) -- */

/**
 * LA COLONNE EMPILÉE — l'objet dominant d'Abonnements (`13b`).
 *
 * Le revenu récurrent n'est plus un total à lire, c'est une PILE À VOIR :
 * chaque forfait occupe une hauteur proportionnelle à ce qu'il rapporte par
 * mois, et l'on voit d'un coup que deux forfaits sur quatre font les trois
 * quarts du revenu. Un total seul ne dit jamais ça — il faudrait quatre
 * divisions de tête.
 *
 * Un abonnement annuel y est ramené au mois, exactement comme le fait le
 * moteur (`amountCents / MOIS[period]`) : une colonne qui mélangerait des
 * montants annuels et mensuels comparerait des choses qui ne se comparent
 * pas, et le plus gros segment serait celui qu'on facture le moins souvent.
 */
const COLONNE_H = 300;
const COLONNE_L = 92;

/**
 * QUATRE TEINTES, QUATRE LIGNES DE LÉGENDE.
 *
 * Au-delà, les crans de gris deviennent indiscernables et la légende cesse de
 * servir à quelque chose. Les forfaits en trop sont regroupés sur la dernière
 * ligne — regroupés, pas cachés : leur hauteur reste dans la colonne, et le
 * total continue de sommer exactement.
 */
const TEINTES = ['#4a4a48', 'var(--color-border-strong)', '#2b2b2b', 'var(--color-border)'];
const LEGENDE_MAX = 4;
/** Sous cette hauteur, ou sur une teinte sombre, aucun chiffre n'est gravé. */
const GRAVURE_MIN_H = 34;

interface PartDeColonne {
  cle: string;
  label: string;
  mensuelCents: number;
  /** Combien de clients sont sur ce forfait. */
  abonnes: number;
  teinte: string;
  /** Les abonnements réunis sous cette part. */
  membres: string[];
}

/**
 * Découpe le revenu récurrent en au plus quatre parts, la plus lourde en tête.
 *
 * UNE PART EST UN FORFAIT, PAS UN ABONNEMENT. Trois clients sur le même
 * forfait de maintenance, c'est UNE part de trois fois le montant — et c'est
 * ce qui fait dire quelque chose à la colonne : « deux forfaits sur quatre
 * font les trois quarts » est une phrase sur l'offre, pas sur le carnet
 * d'adresses. Une part par abonnement redonnerait une liste de clients, ce
 * que le registre fait déjà en bas d'écran.
 */
function partsDeColonne(
  actifs: (SubscriptionData & { id: string })[],
  auMois: (s: SubscriptionData) => number,
  libelleAutres: (n: number) => string,
): PartDeColonne[] {
  const parForfait = new Map<string, { mensuelCents: number; membres: string[] }>();
  for (const s of actifs) {
    const cle = s.label.trim() || '—';
    const entree = parForfait.get(cle) ?? { mensuelCents: 0, membres: [] };
    entree.mensuelCents += auMois(s);
    entree.membres.push(s.id);
    parForfait.set(cle, entree);
  }
  const tries = [...parForfait.entries()]
    .map(([label, e]) => ({ label, ...e }))
    .sort((a, b) => b.mensuelCents - a.mensuelCents);

  if (tries.length <= LEGENDE_MAX) {
    return tries.map((f, i) => ({
      cle: f.label,
      label: f.label,
      mensuelCents: f.mensuelCents,
      abonnes: f.membres.length,
      teinte: TEINTES[i],
      membres: f.membres,
    }));
  }
  const tete = tries.slice(0, LEGENDE_MAX - 1).map((f, i) => ({
    cle: f.label,
    label: f.label,
    mensuelCents: f.mensuelCents,
    abonnes: f.membres.length,
    teinte: TEINTES[i],
    membres: f.membres,
  }));
  const reste = tries.slice(LEGENDE_MAX - 1);
  tete.push({
    cle: 'autres',
    label: libelleAutres(reste.length),
    mensuelCents: reste.reduce((n, f) => n + f.mensuelCents, 0),
    abonnes: reste.reduce((n, f) => n + f.membres.length, 0),
    teinte: TEINTES[LEGENDE_MAX - 1],
    membres: reste.flatMap((f) => f.membres),
  });
  return tete;
}

/**
 * LE RUBAN DES ÉCHÉANCES — un cran par renouvellement des trente prochains
 * jours, coloré selon son forfait.
 *
 * LA RÈGLE QUI LE TIENT : le ruban suit le MÊME MÉLANGE que la colonne. Il ne
 * se calcule donc pas à côté d'elle — il se calcule à partir d'elle, en
 * reprenant la part (et donc la teinte) de chaque abonnement. Deux calculs
 * parallèles finissent toujours par diverger, et le jour où ils divergent,
 * personne ne sait lequel croire.
 */
const RUBAN_JOURS = 30;

interface CranDEcheance {
  cle: string;
  jour: string;
  dansNJours: number;
  teinte: string;
  label: string;
  montantCents: number;
}

function ruban(
  actifs: (SubscriptionData & { id: string })[],
  parts: PartDeColonne[],
  moisDe: (p: Period) => number,
  aujourdHui: string,
): CranDEcheance[] {
  const teinteDe = new Map<string, string>();
  for (const part of parts) for (const id of part.membres) teinteDe.set(id, part.teinte);

  const fin = new Date(`${aujourdHui}T00:00:00`);
  fin.setDate(fin.getDate() + RUBAN_JOURS);
  const finIso = fin.toISOString().slice(0, 10);

  const crans: CranDEcheance[] = [];
  for (const s of actifs) {
    let jour = s.nextAt;
    let garde = 0;
    /* La garde n'est pas de la superstition : un abonnement mensuel oublié
       depuis deux ans ferait vingt-quatre tours, et un `nextAt` corrompu en
       ferait une infinité. */
    while (jour <= finIso && garde < 64) {
      if (jour >= aujourdHui) {
        crans.push({
          cle: `${s.id}-${jour}`,
          jour,
          dansNJours: Math.round(
            (new Date(`${jour}T00:00:00`).getTime() - new Date(`${aujourdHui}T00:00:00`).getTime()) / 86_400_000,
          ),
          teinte: teinteDe.get(s.id) ?? TEINTES[TEINTES.length - 1],
          label: s.label,
          montantCents: s.amountCents,
        });
      }
      const d = new Date(`${jour}T00:00:00`);
      d.setMonth(d.getMonth() + moisDe(s.period));
      jour = d.toISOString().slice(0, 10);
      garde += 1;
    }
  }
  return crans.sort((a, b) => a.jour.localeCompare(b.jour));
}
