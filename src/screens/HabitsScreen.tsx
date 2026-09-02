import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Circle, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { usePersonalStore } from '../state/usePersonalStore';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface Habitude {
  id: string;
  label: string;
  ticks: string[];
  createdAt: string;
}
const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
 * LES HABITUDES — les vôtres, jour après jour.
 *
 * Pour qui : une personne, pas une équipe. Les Routines sont celles de
 * l'organisation, partagées ; une habitude (marcher, lire, appeler sa mère)
 * ne regarde que soi. Ce que ça règle : une case par jour, une série, et la
 * garantie que ça ne quitte pas ce poste — même rangement que le budget
 * avant la paie, dit tel quel à l'écran.
 */
export function HabitsScreen() {
  const { t } = useLangue();
  const [habitudes, setHabitudes, pret] = usePersonalStore<Habitude[]>('habitudes', []);
  const [ouvert, setOuvert] = useState(false);
  const [label, setLabel] = useState('');
  const aujourdhui = isoJour(new Date());
  const faites = habitudes.filter((h) => h.ticks.includes(aujourdhui)).length;
  const ratioDuJour = `${faites}/${habitudes.length}`;
  const meilleure = habitudes.reduce((n, h) => Math.max(n, serieDe(h.ticks)), 0);
  const quatorze = useMemo(() => Array.from({ length: 14 }, (_, i) => isoJour(new Date(Date.now() - (13 - i) * 86_400_000))), []);

  const ajouter = () => {
    if (!label.trim()) return;
    setHabitudes((h) => [...h, { id: `hab-${Date.now().toString(36)}`, label: label.trim(), ticks: [], createdAt: new Date().toISOString() }]);
    setLabel(''); setOuvert(false);
  };
  const basculer = (h: Habitude) => setHabitudes((liste) => liste.map((x) => (x.id === h.id ? { ...x, ticks: x.ticks.includes(aujourdhui) ? x.ticks.filter((d) => d !== aujourdhui) : [...x.ticks, aujourdhui].sort() } : x)));
  const retirer = (h: Habitude) => setHabitudes((liste) => liste.filter((x) => x.id !== h.id));

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('perso.surtitre', { module: t('habitudes.titre') })}
          title={t('habitudes.titre')}
          description={t('habitudes.description')}
          stats={[
            { label: t('habitudes.stat.aujourdhui'), value: ratioDuJour, emphasis: habitudes.length > 0 && faites === habitudes.length },
            { label: t('habitudes.stat.meilleureSerie'), value: meilleure },
            { label: t('habitudes.stat.habitudes'), value: habitudes.length },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('habitudes.ajouter')}
            </button>
          }
        />
      </motion.div>

      <motion.p variants={staggerItem} className="text-xs text-text-muted">{t('perso.local')}</motion.p>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); ajouter(); }} className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface p-4">
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('habitudes.champ')} aria-label={t('habitudes.champ')} autoFocus className="input-focus min-h-11 min-w-0 flex-1 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <button type="submit" disabled={!label.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('habitudes.enregistrer')}</button>
          <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
        </motion.form>
      )}

      {pret && habitudes.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('habitudes.vide.titre')} action={{ label: t('habitudes.vide.action'), onClick: () => setOuvert(true) }}>{t('habitudes.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.ul variants={staggerItem} className="flex flex-col gap-2">
          {habitudes.map((h) => {
            const faite = h.ticks.includes(aujourdhui);
            return (
              <li key={h.id} className={`group flex flex-wrap items-center gap-3 rounded-xl border bg-surface p-3 ${faite ? 'border-success/30' : 'border-border'}`}>
                <button type="button" onClick={() => basculer(h)} aria-pressed={faite} aria-label={faite ? t('habitudes.faite') : t('habitudes.aFaire')} className="flex min-h-11 min-w-11 items-center justify-center">
                  {faite ? <Check size={18} className="text-success" /> : <Circle size={18} className="text-text-muted" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${faite ? 'text-text-muted' : 'text-text-primary'}`}>{h.label}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('habitudes.serie', { n: serieDe(h.ticks) })}</p>
                </div>
                <div className="flex gap-1" aria-hidden="true">
                  {quatorze.map((d) => <span key={d} className={`h-2.5 w-2.5 rounded-sm ${h.ticks.includes(d) ? 'bg-success' : 'bg-border'}`} />)}
                </div>
                <button type="button" onClick={() => retirer(h)} aria-label={t('habitudes.supprimer')} title={t('habitudes.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
              </li>
            );
          })}
        </motion.ul>
      )}
    </motion.section>
  );
}
