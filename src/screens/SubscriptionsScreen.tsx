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
            LE CHIFFRE UNIQUE — l'objet dominant de l'écran Abonnements.

            Le revenu récurrent mensuel était une statistique d'en-tête, à
            quatorze pixels, entre « actifs » et « à facturer ». C'est pourtant
            la seule chose qu'on vient vérifier ici, et c'est un chiffre qui se
            construit : il faut dire comment, sinon il a l'air sorti de nulle
            part. La phrase l'explique, et la ventilation par périodicité montre
            d'où vient chaque part.
          */}
          <motion.section variants={staggerItem} className="flex flex-col gap-8 lg:flex-row lg:items-start">
            <div className="min-w-0 flex-1">
              <p className="eyebrow mb-4">{t('abonnements.revenuRecurrent')}</p>
              <p className="tnum font-mono text-[46px] font-bold leading-[0.92] tracking-[-0.04em] text-text-primary sm:text-[64px]">
                {formatCents(mrr)}
              </p>
              <p className="mt-5 max-w-[52ch] text-[14.5px] leading-[1.7] text-text-secondary [text-wrap:pretty]">
                {t('abonnements.chaqueForfaitRamene')}
              </p>
            </div>

            {/* La ventilation : trois lignes, une barre proportionnelle chacune. */}
            <div className="flex w-full flex-shrink-0 flex-col gap-2.5 lg:w-[320px]">
              {(['monthly', 'quarterly', 'yearly'] as Period[]).map((p) => {
                const part = actifs
                  .filter((s) => s.period === p)
                  .reduce((n, s) => n + Math.round(s.amountCents / MOIS[s.period]), 0);
                return (
                  <div key={p} className="flex items-center gap-3">
                    <span className="eyebrow w-[86px] flex-shrink-0">{periodeCourte(p)}</span>
                    <span className="h-[5px] min-w-0 flex-1 bg-[#1a1a1a]" aria-hidden>
                      <span
                        className="block h-full bg-[#4a4a48]"
                        style={{ width: `${mrr > 0 ? (part / mrr) * 100 : 0}%` }}
                      />
                    </span>
                    <span className="tnum w-[92px] flex-shrink-0 text-right font-mono text-[12.5px] text-text-secondary">
                      {formatCents(part)}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.section>

          {/*
            LA FILE — ce qui a dépassé son échéance et attend un geste.

            L'AMBRE DE L'ÉCRAN est là, et nulle part ailleurs : la plaque
            « 2 à facturer », en encre de signal comme l'exige la règle 2. Rien
            à facturer, pas de file, pas d'ambre — l'écran redevient un chiffre
            et un registre, ce qui est exactement ce qu'il faut lire.
          */}
          {aFacturer.length > 0 && (
            <motion.section variants={staggerItem} className="panel-raised">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border-raised px-5 py-3.5">
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
