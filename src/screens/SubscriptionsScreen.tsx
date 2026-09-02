import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, ReceiptEuro, Trash2 } from 'lucide-react';
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

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('commerce.surtitre', { module: t('abonnements.titre') })}
          title={t('abonnements.titre')}
          description={aFacturer.length > 0 ? t('abonnements.aFacturer', { n: aFacturer.length }) : t('abonnements.description')}
          stats={[
            { label: t('abonnements.stat.actifs'), value: actifs.length },
            { label: t('abonnements.stat.mrr'), value: formatCents(mrr), title: t('abonnements.stat.mrrTitre') },
            { label: t('abonnements.stat.aFacturer'), value: aFacturer.length, emphasis: aFacturer.length > 0 },
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
        <motion.ul variants={staggerItem} className="flex flex-col gap-px overflow-hidden rounded-xl border border-border bg-border">
          {abonnements.map((s) => {
            const du = s.active && s.nextAt <= jour;
            return (
              <li key={s.id} className={`flex flex-wrap items-center justify-between gap-3 bg-surface px-4 py-3 ${s.active ? '' : 'opacity-60'}`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">{s.label}{s.customerName && <span className="text-text-muted"> · {s.customerName}</span>}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    {formatCents(s.amountCents)} · {periode(s.period)} · {s.active ? (du ? <span className="text-warning">{t('abonnements.echeanceDepassee')}</span> : t('abonnements.prochaine', { date: new Date(`${s.nextAt}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) })) : t('abonnements.suspendu')}
                  </p>
                </div>
                <div className="flex flex-shrink-0 flex-wrap gap-2">
                  {s.active && (
                    <button type="button" onClick={() => void facturer(s)} className={`flex min-h-11 items-center gap-1.5 border px-3 text-xs md:min-h-0 md:py-1.5 ${du ? 'border-accent text-text-primary' : 'border-border-strong text-text-primary hover:bg-surface-hover'}`}>
                      <ReceiptEuro size={13} /> {t('abonnements.facturer')}
                    </button>
                  )}
                  <button type="button" onClick={() => void upsert('subscriptions', s.id, { ...s, active: !s.active })} className="min-h-11 border border-border px-3 text-xs text-text-secondary hover:text-text-primary md:min-h-0 md:py-1.5">
                    {s.active ? t('abonnements.suspendre') : t('abonnements.reprendre')}
                  </button>
                  <button type="button" onClick={() => void remove('subscriptions', s.id)} aria-label={t('abonnements.supprimer')} title={t('abonnements.supprimer')} className="flex min-h-11 items-center border border-border px-2.5 text-text-muted hover:text-danger md:min-h-0 md:py-1.5"><Trash2 size={13} /></button>
                </div>
              </li>
            );
          })}
        </motion.ul>
      )}
    </motion.section>
  );
}
