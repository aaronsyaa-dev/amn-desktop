import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, HeartHandshake, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

type ReferralStatus = 'invite' | 'venu' | 'recompense';
interface ReferralData {
  referrer: string;
  referred: string;
  status: ReferralStatus;
  reward: string;
  createdAt: string;
  updatedAt: string;
}
const SUITE: Record<ReferralStatus, ReferralStatus | null> = { invite: 'venu', venu: 'recompense', recompense: null };

/**
 * LE PARRAINAGE — qui a amené qui, et ce qu'on lui doit.
 *
 * Pour qui : toute activité qui vit du bouche-à-oreille et qui promet
 * « une remise pour ton amie » sans jamais tenir le compte. Ce que ça règle :
 * trois états — invitée, venue, récompensée — et le nom de la récompense
 * promise. On sait qui parraine le plus, et à qui on doit encore quelque
 * chose. Pas de code promo, pas de site : un registre honnête.
 */
export function ReferralsScreen() {
  const { t } = useLangue();
  const { upsert, remove } = useSync();
  const brutes = useCollection<ReferralData>('referrals');
  const [ouvert, setOuvert] = useState(false);
  const [referrer, setReferrer] = useState('');
  const [referred, setReferred] = useState('');
  const [reward, setReward] = useState('');

  const lignes = useMemo(() => [...brutes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [brutes]);
  const dues = lignes.filter((r) => r.status === 'venu').length;
  const meilleurs = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of brutes) if (r.status !== 'invite') m.set(r.referrer, (m.get(r.referrer) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [brutes]);

  const ajouter = async () => {
    if (!referrer.trim() || !referred.trim()) return;
    const now = new Date().toISOString();
    await upsert('referrals', uid('par'), { referrer: referrer.trim(), referred: referred.trim(), status: 'invite', reward: reward.trim(), createdAt: now, updatedAt: now });
    setReferrer(''); setReferred(''); setReward(''); setOuvert(false);
  };
  const avancer = (r: ReferralData & { id: string }) => SUITE[r.status] && upsert('referrals', r.id, { ...r, status: SUITE[r.status] as ReferralStatus, updatedAt: new Date().toISOString() });
  const statut = (s: ReferralStatus) => t(`parrainage.statut.${s}` as Parameters<typeof t>[0]);

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('commerce.surtitre', { module: t('parrainage.titre') })}
          title={t('parrainage.titre')}
          description={dues > 0 ? t('parrainage.dues', { n: dues }) : t('parrainage.description')}
          stats={[
            { label: t('parrainage.stat.parrainages'), value: lignes.length },
            { label: t('parrainage.stat.venus'), value: lignes.filter((r) => r.status !== 'invite').length },
            { label: t('parrainage.stat.dues'), value: dues, emphasis: dues > 0 },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('parrainage.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void ajouter(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-3">
          <input value={referrer} onChange={(e) => setReferrer(e.target.value)} placeholder={t('parrainage.champParrain')} aria-label={t('parrainage.champParrain')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={referred} onChange={(e) => setReferred(e.target.value)} placeholder={t('parrainage.champFilleul')} aria-label={t('parrainage.champFilleul')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={reward} onChange={(e) => setReward(e.target.value)} placeholder={t('parrainage.champRecompense')} aria-label={t('parrainage.champRecompense')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <div className="flex flex-wrap gap-2 sm:col-span-3">
            <button type="submit" disabled={!referrer.trim() || !referred.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('parrainage.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {lignes.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('parrainage.vide.titre')} action={{ label: t('parrainage.vide.action'), onClick: () => setOuvert(true) }}>{t('parrainage.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.div variants={staggerItem} className="grid gap-4 lg:grid-cols-[1fr_16rem]">
          <ul className="flex flex-col gap-px overflow-hidden rounded-xl border border-border bg-border">
            {lignes.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 bg-surface px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <HeartHandshake size={18} className="flex-shrink-0 text-text-muted" />
                  <div className="min-w-0">
                    <p className="text-sm text-text-primary">{r.referrer} <span className="text-text-muted">→</span> {r.referred}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{r.reward || t('parrainage.sansRecompense')} · {relativeTime(r.updatedAt)}</p>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <span className={`rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${r.status === 'recompense' ? 'border-success/40 text-success' : r.status === 'venu' ? 'border-warning/40 text-warning' : 'border-border text-text-muted'}`}>{statut(r.status)}</span>
                  {SUITE[r.status] && (
                    <button type="button" onClick={() => void avancer(r)} className="flex min-h-11 items-center gap-1 border border-border-strong px-2.5 text-xs text-text-primary hover:bg-surface-hover md:min-h-0 md:py-1.5">
                      {statut(SUITE[r.status] as ReferralStatus)} <ArrowRight size={11} />
                    </button>
                  )}
                  <button type="button" onClick={() => void remove('referrals', r.id)} aria-label={t('parrainage.supprimer')} title={t('parrainage.supprimer')} className="flex min-h-11 items-center px-2 text-text-muted hover:text-danger md:min-h-0"><Trash2 size={12} /></button>
                </div>
              </li>
            ))}
          </ul>
          {meilleurs.length > 0 && (
            <aside className="rounded-xl border border-border bg-surface p-4">
              <p className="eyebrow mb-2">{t('parrainage.meilleurs')}</p>
              <ol className="flex flex-col gap-1.5">
                {meilleurs.map(([nom, n]) => (
                  <li key={nom} className="flex items-center justify-between text-sm"><span className="truncate text-text-primary">{nom}</span><span className="tnum font-mono text-xs text-text-muted">{n}</span></li>
                ))}
              </ol>
            </aside>
          )}
        </motion.div>
      )}
    </motion.section>
  );
}
