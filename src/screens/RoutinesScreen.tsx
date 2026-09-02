import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Circle, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface RoutineData {
  label: string;
  /** Jours ISO (AAAA-MM-JJ) où la routine a été cochée. */
  ticks: string[];
  createdAt: string;
}
const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Jours consécutifs cochés en remontant depuis aujourd'hui (ou hier, si aujourd'hui n'est pas encore fait). */
function serieDe(ticks: string[]): number {
  const set = new Set(ticks);
  let k = set.has(isoJour(new Date())) ? 0 : 1;
  let n = 0;
  for (; k < 400; k += 1) {
    if (!set.has(isoJour(new Date(Date.now() - k * 86_400_000)))) break;
    n += 1;
  }
  return n;
}

/**
 * LES ROUTINES — ce qui revient, coché chaque jour.
 *
 * Pour qui : une équipe dont les gestes récurrents (relever la caisse,
 * sortir les poubelles, vérifier le frigo) se font quand on y pense. Ce que
 * ça règle : une case par jour et une série de jours tenus — ce qui tient se
 * voit, ce qui glisse aussi. Les Contrôles qualité gardent une trace signée
 * point par point ; une routine, c'est juste fait ou pas fait.
 */
export function RoutinesScreen() {
  const { t } = useLangue();
  const { upsert, remove } = useSync();
  const brutes = useCollection<RoutineData>('routines');
  const [ouvert, setOuvert] = useState(false);
  const [label, setLabel] = useState('');
  const aujourdhui = isoJour(new Date());

  const routines = useMemo(() => [...brutes].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [brutes]);
  const faites = routines.filter((r) => r.ticks.includes(aujourdhui)).length;
  const ratioDuJour = `${faites}/${routines.length}`;
  const meilleure = routines.reduce((n, r) => Math.max(n, serieDe(r.ticks)), 0);
  const septJours = useMemo(() => Array.from({ length: 7 }, (_, i) => isoJour(new Date(Date.now() - (6 - i) * 86_400_000))), []);

  const ajouter = async () => {
    if (!label.trim()) return;
    await upsert('routines', uid('rtn'), { label: label.trim(), ticks: [], createdAt: new Date().toISOString() });
    setLabel(''); setOuvert(false);
  };
  const basculer = (r: RoutineData & { id: string }) =>
    upsert('routines', r.id, { ...r, ticks: r.ticks.includes(aujourdhui) ? r.ticks.filter((d) => d !== aujourdhui) : [...r.ticks, aujourdhui].sort() });

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('pilotage.surtitre', { module: t('routines.titre') })}
          title={t('routines.titre')}
          description={t('routines.description')}
          stats={[
            { label: t('routines.stat.aujourdhui'), value: ratioDuJour, emphasis: routines.length > 0 && faites === routines.length },
            { label: t('routines.stat.meilleureSerie'), value: meilleure },
            { label: t('routines.stat.routines'), value: routines.length },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('routines.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void ajouter(); }} className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-4">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('routines.champ')} aria-label={t('routines.champ')} autoFocus className="input-focus min-h-11 min-w-0 flex-1 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <button type="submit" disabled={!label.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('routines.enregistrer')}</button>
          <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
        </motion.form>
      )}

      {routines.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('routines.vide.titre')} action={{ label: t('routines.vide.action'), onClick: () => setOuvert(true) }}>{t('routines.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.ul variants={staggerItem} className="flex flex-col gap-2">
          {routines.map((r) => {
            const faite = r.ticks.includes(aujourdhui);
            const serie = serieDe(r.ticks);
            return (
              <li key={r.id} className={`group flex flex-wrap items-center gap-3 rounded-xl border bg-surface p-3 ${faite ? 'border-success/30' : 'border-border'}`}>
                <button type="button" onClick={() => void basculer(r)} aria-pressed={faite} aria-label={faite ? t('routines.faite') : t('routines.aFaire')} className="flex min-h-11 min-w-11 items-center justify-center">
                  {faite ? <Check size={18} className="text-success" /> : <Circle size={18} className="text-text-muted" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${faite ? 'text-text-muted' : 'text-text-primary'}`}>{r.label}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('routines.serie', { n: serie })}</p>
                </div>
                <div className="flex gap-1" aria-hidden="true">
                  {septJours.map((d) => <span key={d} className={`h-2.5 w-2.5 rounded-sm ${r.ticks.includes(d) ? 'bg-success' : 'bg-border'}`} />)}
                </div>
                <button type="button" onClick={() => void remove('routines', r.id)} aria-label={t('routines.supprimer')} title={t('routines.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
              </li>
            );
          })}
        </motion.ul>
      )}
    </motion.section>
  );
}
