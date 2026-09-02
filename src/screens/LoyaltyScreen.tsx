import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Gift, Plus, Search, Stamp } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface LoyaltyCardData {
  customerName: string;
  stamps: number;
  rewards: number;
  lastStampAt: string;
  createdAt: string;
}
const SEUIL = 10;

/**
 * LA FIDÉLITÉ — la carte à tampons, sans le carton.
 *
 * Pour qui : une boutique, un salon, un traiteur — dix passages, le onzième
 * offert. Ce que ça règle : la carte perdue, le tampon oublié, le compte
 * qu'on refait de tête. Une carte par personne, un tampon par passage, une
 * récompense quand la ligne est pleine. Dix par ligne, c'est le seuil des
 * cartes en carton ; assez simple pour ne pas devenir un programme.
 */
export function LoyaltyScreen() {
  const { t } = useLangue();
  const { upsert, remove } = useSync();
  const brutes = useCollection<LoyaltyCardData>('loyaltyCards');
  const [recherche, setRecherche] = useState('');
  const [nouveau, setNouveau] = useState('');

  const cartes = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return [...brutes].filter((c) => !q || c.customerName.toLowerCase().includes(q)).sort((a, b) => (b.lastStampAt || '').localeCompare(a.lastStampAt || ''));
  }, [brutes, recherche]);
  const pleines = brutes.filter((c) => c.stamps >= SEUIL).length;
  const tampons = brutes.reduce((n, c) => n + c.stamps + c.rewards * SEUIL, 0);

  const creer = async () => {
    if (!nouveau.trim()) return;
    await upsert('loyaltyCards', uid('fid'), { customerName: nouveau.trim(), stamps: 0, rewards: 0, lastStampAt: '', createdAt: new Date().toISOString() });
    setNouveau('');
  };
  const tamponner = (c: LoyaltyCardData & { id: string }) => upsert('loyaltyCards', c.id, { ...c, stamps: Math.min(SEUIL, c.stamps + 1), lastStampAt: new Date().toISOString() });
  const offrir = (c: LoyaltyCardData & { id: string }) => upsert('loyaltyCards', c.id, { ...c, stamps: 0, rewards: c.rewards + 1, lastStampAt: new Date().toISOString() });

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('commerce.surtitre', { module: t('fidelite.titre') })}
          title={t('fidelite.titre')}
          description={t('fidelite.description', { seuil: SEUIL })}
          stats={[
            { label: t('fidelite.stat.cartes'), value: brutes.length },
            { label: t('fidelite.stat.pleines'), value: pleines, emphasis: pleines > 0 },
            { label: t('fidelite.stat.tampons'), value: tampons },
          ]}
        />
      </motion.div>

      <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void creer(); }} className="flex flex-wrap gap-2">
        <input value={nouveau} onChange={(e) => setNouveau(e.target.value)} placeholder={t('fidelite.champNom')} aria-label={t('fidelite.champNom')} className="input-focus min-h-11 min-w-[14rem] flex-1 border border-border bg-surface px-3 text-sm text-text-primary outline-none sm:max-w-sm" />
        <button type="submit" disabled={!nouveau.trim()} className="flex min-h-11 items-center gap-2 bg-accent px-4 text-sm font-semibold text-bg disabled:opacity-40"><Plus size={15} /> {t('fidelite.nouvelleCarte')}</button>
        {brutes.length > 3 && (
          <label className="input-focus flex min-h-11 items-center gap-2 border border-border bg-surface px-3">
            <Search size={14} className="text-text-muted" />
            <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder={t('fidelite.rechercher')} aria-label={t('fidelite.rechercher')} className="min-w-0 bg-transparent text-sm text-text-primary outline-none" />
          </label>
        )}
      </motion.form>

      {brutes.length === 0 ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('fidelite.vide.titre')}>{t('fidelite.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.ul variants={staggerItem} className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(16rem,1fr))]">
          {cartes.map((c) => {
            const pleine = c.stamps >= SEUIL;
            return (
              <li key={c.id} className={`flex flex-col gap-3 rounded-xl border bg-surface p-4 ${pleine ? 'border-accent' : 'border-border'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{c.customerName}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {c.rewards > 0 && `${t('fidelite.recompenses', { n: c.rewards })} · `}
                      {c.lastStampAt ? relativeTime(c.lastStampAt) : t('fidelite.jamais')}
                    </p>
                  </div>
                  <button type="button" onClick={() => void remove('loyaltyCards', c.id)} aria-label={t('fidelite.supprimer')} title={t('fidelite.supprimer')} className="text-[10px] uppercase tracking-wider text-text-muted hover:text-danger">{t('fidelite.supprimerCourt')}</button>
                </div>
                <div className="grid grid-cols-5 gap-1.5" aria-label={t('fidelite.progression', { n: c.stamps, seuil: SEUIL })}>
                  {Array.from({ length: SEUIL }, (_, i) => (
                    <span key={i} className={`flex h-8 items-center justify-center rounded-md border ${i < c.stamps ? 'border-accent bg-accent-muted text-accent' : 'border-border text-transparent'}`}>
                      <Stamp size={12} />
                    </span>
                  ))}
                </div>
                {pleine ? (
                  <button type="button" onClick={() => void offrir(c)} className="flex min-h-11 items-center justify-center gap-2 bg-accent px-3 text-sm font-semibold text-bg"><Gift size={15} /> {t('fidelite.offrir')}</button>
                ) : (
                  <button type="button" onClick={() => void tamponner(c)} className="flex min-h-11 items-center justify-center gap-2 border border-border-strong px-3 text-sm text-text-primary hover:bg-surface-hover"><Stamp size={15} /> {t('fidelite.tamponner')}</button>
                )}
              </li>
            );
          })}
        </motion.ul>
      )}
    </motion.section>
  );
}
