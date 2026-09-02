import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Signature, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { formatCents } from '../lib/money';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

type ContractStatus = 'draft' | 'active' | 'ended';
interface ContractData {
  title: string;
  party: string;
  startsAt: string;
  endsAt: string;
  amountCents: number;
  status: ContractStatus;
  autoRenew: boolean;
  note: string;
  createdAt: string;
}
const isoDay = () => new Date().toISOString().slice(0, 10);
const dansJours = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

/**
 * LES CONTRATS — ce qui est signé, jusqu'à quand, et pour combien.
 *
 * Pour qui : une prestataire qui a des engagements datés (maintenance,
 * abonnement, prestation annuelle) et qui découvre l'échéance quand le
 * client la rappelle. Ce que ça règle : les contrats qui se terminent dans
 * les trente jours en tête, ce qu'ils valent, et une note par contrat. Le
 * document lui-même vit dans Médias ; ici, c'est l'échéancier.
 */
export function ContractsScreen() {
  const { t, langue } = useLangue();
  const { upsert, remove } = useSync();
  const brutes = useCollection<ContractData>('contracts');
  const [ouvert, setOuvert] = useState(false);
  const [title, setTitle] = useState('');
  const [party, setParty] = useState('');
  const [startsAt, setStartsAt] = useState(isoDay());
  const [endsAt, setEndsAt] = useState(dansJours(365));
  const [amount, setAmount] = useState('');
  const [autoRenew, setAutoRenew] = useState(false);
  const jour = isoDay();
  const bientot = dansJours(30);
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const date = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });

  const contrats = useMemo(() => [...brutes].sort((a, b) => a.endsAt.localeCompare(b.endsAt)), [brutes]);
  const actifs = contrats.filter((c) => c.status === 'active');
  const echeants = actifs.filter((c) => c.endsAt >= jour && c.endsAt <= bientot);
  const valeur = actifs.reduce((n, c) => n + (c.amountCents || 0), 0);

  const ajouter = async () => {
    if (!title.trim()) return;
    await upsert('contracts', uid('ctr'), { title: title.trim(), party: party.trim(), startsAt, endsAt, amountCents: Math.round((Number(amount.replace(',', '.')) || 0) * 100), status: 'active', autoRenew, note: '', createdAt: new Date().toISOString() });
    setTitle(''); setParty(''); setAmount(''); setAutoRenew(false); setOuvert(false);
  };
  const statut = (s: ContractStatus) => t(`contrats.statut.${s}` as Parameters<typeof t>[0]);

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('commerce.surtitre', { module: t('contrats.titre') })}
          title={t('contrats.titre')}
          description={echeants.length > 0 ? t('contrats.echeants', { n: echeants.length }) : t('contrats.description')}
          stats={[
            { label: t('contrats.stat.actifs'), value: actifs.length },
            { label: t('contrats.stat.valeur'), value: formatCents(valeur) },
            { label: t('contrats.stat.echeants'), value: echeants.length, emphasis: echeants.length > 0 },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('contrats.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void ajouter(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('contrats.champTitre')} aria-label={t('contrats.champTitre')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={party} onChange={(e) => setParty(e.target.value)} placeholder={t('contrats.champPartie')} aria-label={t('contrats.champPartie')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <label className="flex flex-col gap-1 text-xs text-text-muted">{t('contrats.champDebut')}<input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" /></label>
          <label className="flex flex-col gap-1 text-xs text-text-muted">{t('contrats.champFin')}<input type="date" value={endsAt} min={startsAt} onChange={(e) => setEndsAt(e.target.value)} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" /></label>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={t('contrats.champMontant')} aria-label={t('contrats.champMontant')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} className="h-4 w-4" /> {t('contrats.reconduction')}</label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={!title.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('contrats.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {contrats.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('contrats.vide.titre')} action={{ label: t('contrats.vide.action'), onClick: () => setOuvert(true) }}>{t('contrats.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.ul variants={staggerItem} className="flex flex-col gap-px overflow-hidden rounded-xl border border-border bg-border">
          {contrats.map((c) => {
            const proche = c.status === 'active' && c.endsAt >= jour && c.endsAt <= bientot;
            const passe = c.endsAt < jour;
            return (
              <li key={c.id} className={`flex flex-wrap items-center justify-between gap-3 bg-surface px-4 py-3 ${c.status === 'ended' ? 'opacity-60' : ''}`}>
                <div className="flex min-w-0 items-center gap-3">
                  <Signature size={18} className={`flex-shrink-0 ${proche ? 'text-warning' : 'text-text-muted'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">{c.title}{c.party && <span className="text-text-muted"> · {c.party}</span>}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {date(c.startsAt)} → <span className={proche ? 'text-warning' : passe && c.status === 'active' ? 'text-danger' : ''}>{date(c.endsAt)}</span>
                      {c.amountCents > 0 && ` · ${formatCents(c.amountCents)}`}
                      {c.autoRenew && ` · ${t('contrats.reconductionCourt')}`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                  <span className={`rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${c.status === 'active' ? 'border-success/40 text-success' : 'border-border text-text-muted'}`}>{statut(c.status)}</span>
                  {c.status === 'active' && (
                    <button type="button" onClick={() => void upsert('contracts', c.id, { ...c, status: 'ended' })} className="min-h-11 border border-border px-3 text-xs text-text-secondary hover:text-text-primary md:min-h-0 md:py-1.5">{t('contrats.terminer')}</button>
                  )}
                  {c.status === 'active' && c.autoRenew && passe && (
                    <button type="button" onClick={() => void upsert('contracts', c.id, { ...c, startsAt: c.endsAt, endsAt: dansJours(365) })} className="min-h-11 border border-border-strong px-3 text-xs text-text-primary md:min-h-0 md:py-1.5">{t('contrats.reconduire')}</button>
                  )}
                  <button type="button" onClick={() => void remove('contracts', c.id)} aria-label={t('contrats.supprimer')} title={t('contrats.supprimer')} className="flex min-h-11 items-center border border-border px-2.5 text-text-muted hover:text-danger md:min-h-0 md:py-1.5"><Trash2 size={13} /></button>
                </div>
              </li>
            );
          })}
        </motion.ul>
      )}
    </motion.section>
  );
}
