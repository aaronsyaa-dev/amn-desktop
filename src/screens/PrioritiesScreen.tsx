import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Circle, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useAuth } from '../auth/AuthContext';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface Priorite {
  id: string;
  label: string;
  doneAt: string | null;
}
interface DayData {
  email: string;
  day: string;
  items: Priorite[];
  updatedAt: string;
}
const MAX = 3;
const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const slug = (email: string) => email.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/**
 * LES PRIORITÉS DU JOUR — trois choses, pas dix.
 *
 * Pour qui : quelqu'un dont la liste de tâches ne se termine jamais. Ce que
 * ça règle : trois priorités le matin, cochées ou reportées le soir, et le
 * compte des journées tenues. Les Tâches gardent tout ; ici on ne garde que
 * ce qui compte aujourd'hui, et c'est personnel — chaque membre a les siennes.
 */
export function PrioritiesScreen() {
  const { t } = useLangue();
  const { user } = useAuth();
  const { upsert } = useSync();
  const brutes = useCollection<DayData>('dailyPriorities');
  const [label, setLabel] = useState('');
  const moi = user?.email ?? '';
  const aujourdhui = isoJour(new Date());
  const idDuJour = (day: string) => `prio-${slug(moi)}-${day}`;

  const miens = useMemo(() => brutes.filter((d) => d.email === moi), [brutes, moi]);
  const jour = miens.find((d) => d.day === aujourdhui) ?? null;
  const items = jour?.items ?? [];
  const faites = items.filter((i) => i.doneAt).length;
  const ratioDuJour = `${faites}/${items.length}`;
  const trenteJours = useMemo(() => {
    const depuis = isoJour(new Date(Date.now() - 30 * 86_400_000));
    return miens.filter((d) => d.day >= depuis && d.day <= aujourdhui && d.items.length > 0);
  }, [miens, aujourdhui]);
  const tenues = trenteJours.filter((d) => d.items.every((i) => i.doneAt)).length;
  const serie = useMemo(() => {
    let n = 0;
    for (let k = 1; k <= 60; k += 1) {
      const day = isoJour(new Date(Date.now() - k * 86_400_000));
      const d = miens.find((x) => x.day === day);
      if (!d || d.items.length === 0 || !d.items.every((i) => i.doneAt)) break;
      n += 1;
    }
    return n + (items.length > 0 && items.every((i) => i.doneAt) ? 1 : 0);
  }, [miens, items]);

  const enregistrer = (day: string, nouveaux: Priorite[]) =>
    upsert('dailyPriorities', idDuJour(day), { email: moi, day, items: nouveaux, updatedAt: new Date().toISOString() });
  const poser = async () => {
    if (!label.trim() || items.length >= MAX) return;
    await enregistrer(aujourdhui, [...items, { id: uid('pri'), label: label.trim(), doneAt: null }]);
    setLabel('');
  };
  const basculer = (p: Priorite) => enregistrer(aujourdhui, items.map((i) => (i.id === p.id ? { ...i, doneAt: i.doneAt ? null : new Date().toISOString() } : i)));
  const retirer = (p: Priorite) => enregistrer(aujourdhui, items.filter((i) => i.id !== p.id));
  const reporter = async (p: Priorite) => {
    const demain = isoJour(new Date(Date.now() + 86_400_000));
    const existants = miens.find((d) => d.day === demain)?.items ?? [];
    if (existants.length >= MAX) return;
    await enregistrer(demain, [...existants, { ...p, doneAt: null }]);
    await retirer(p);
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('pilotage.surtitre', { module: t('priorites.titre') })}
          title={t('priorites.titre')}
          description={t('priorites.description')}
          stats={[
            { label: t('priorites.stat.aujourdhui'), value: ratioDuJour, emphasis: items.length > 0 && faites === items.length },
            { label: t('priorites.stat.journeesTenues'), value: tenues },
            { label: t('priorites.stat.serie'), value: serie },
          ]}
        />
      </motion.div>

      <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void poser(); }} className="flex flex-wrap gap-2">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('priorites.champ')} aria-label={t('priorites.champ')} disabled={items.length >= MAX} className="input-focus min-h-11 min-w-0 flex-1 border border-border bg-surface px-3 text-sm text-text-primary outline-none disabled:opacity-50" />
        <button type="submit" disabled={!label.trim() || items.length >= MAX} className="flex min-h-11 items-center gap-2 bg-accent px-4 text-sm font-semibold text-bg disabled:opacity-40"><Plus size={14} /> {t('priorites.ajouter')}</button>
        {items.length >= MAX && <p className="basis-full text-xs text-text-muted">{t('priorites.pleine')}</p>}
      </motion.form>

      {items.length === 0 ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('priorites.vide.titre')}>{t('priorites.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.ol variants={staggerItem} className="flex flex-col gap-2">
          {items.map((p, i) => (
            <li key={p.id} className={`group flex items-center gap-3 rounded-xl border bg-surface p-3 ${p.doneAt ? 'border-success/30' : 'border-border'}`}>
              <button type="button" onClick={() => void basculer(p)} aria-pressed={Boolean(p.doneAt)} aria-label={t('priorites.cocher')} className="flex min-h-11 min-w-11 items-center justify-center">
                {p.doneAt ? <Check size={18} className="text-success" /> : <Circle size={18} className="text-text-muted" />}
              </button>
              <span className="tnum font-mono text-xs text-text-muted">{i + 1}</span>
              <span className={`min-w-0 flex-1 text-sm ${p.doneAt ? 'text-text-muted line-through' : 'text-text-primary'}`}>{p.label}</span>
              {!p.doneAt && (
                <button type="button" onClick={() => void reporter(p)} className="flex min-h-11 items-center gap-1 border border-border px-2 text-[11px] text-text-secondary hover:text-text-primary md:min-h-0 md:py-1">{t('priorites.reporter')} <ArrowRight size={11} /></button>
              )}
              <button type="button" onClick={() => void retirer(p)} aria-label={t('priorites.supprimer')} title={t('priorites.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
            </li>
          ))}
        </motion.ol>
      )}
    </motion.section>
  );
}
