import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useAuth } from '../auth/AuthContext';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

type Nature = 'note' | 'panne' | 'visite' | 'decision' | 'incident';
interface EntryData {
  text: string;
  kind: Nature;
  byEmail: string;
  at: string;
}
const NATURES: Nature[] = ['note', 'panne', 'visite', 'decision', 'incident'];

/**
 * LE JOURNAL DE BORD — ce qui s'est passé, daté, relisible.
 *
 * Pour qui : une organisation dont la mémoire est orale. La panne du frigo
 * de mars, la visite du contrôleur, la décision de fermer le lundi : tout
 * finit par se perdre. Ce que ça règle : une entrée par événement notable,
 * signée, avec une nature pour retrouver vite. Le Fil est la conversation ;
 * le journal est ce qu'on garde.
 */
export function LogbookScreen() {
  const { t, langue } = useLangue();
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const { user } = useAuth();
  const { upsert, remove } = useSync();
  const brutes = useCollection<EntryData>('logbook');
  const [text, setText] = useState('');
  const [kind, setKind] = useState<Nature>('note');
  const [filtre, setFiltre] = useState<Nature | 'tous'>('tous');

  const entrees = useMemo(() => [...brutes].sort((a, b) => b.at.localeCompare(a.at)), [brutes]);
  const visibles = filtre === 'tous' ? entrees : entrees.filter((e) => e.kind === filtre);
  const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const ceMois = entrees.filter((e) => e.at >= debutMois);
  const pannes = ceMois.filter((e) => e.kind === 'panne' || e.kind === 'incident').length;
  const parJour = useMemo(() => {
    const m = new Map<string, (EntryData & { id: string })[]>();
    for (const e of visibles) {
      const jour = e.at.slice(0, 10);
      m.set(jour, [...(m.get(jour) ?? []), e]);
    }
    return [...m.entries()];
  }, [visibles]);
  const nature = (k: Nature) => t(`journalBord.kind.${k}` as Parameters<typeof t>[0]);

  const consigner = async () => {
    if (!text.trim()) return;
    await upsert('logbook', uid('log'), { text: text.trim(), kind, byEmail: user?.email ?? '', at: new Date().toISOString() });
    setText('');
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('pilotage.surtitre', { module: t('journalBord.titre') })}
          title={t('journalBord.titre')}
          description={t('journalBord.description')}
          stats={[
            { label: t('journalBord.stat.mois'), value: ceMois.length },
            { label: t('journalBord.stat.pannes'), value: pannes, emphasis: pannes > 0 },
            { label: t('journalBord.stat.derniere'), value: entrees[0] ? relativeTime(entrees[0].at) : '—' },
          ]}
        />
      </motion.div>

      <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void consigner(); }} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder={t('journalBord.champ')} aria-label={t('journalBord.champ')} className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none" />
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" aria-label={t('journalBord.nature')} className="flex flex-wrap gap-1">
            {NATURES.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`min-h-11 border px-3 text-xs md:min-h-0 md:py-1.5 ${kind === k ? 'border-border-strong bg-surface-hover text-text-primary' : 'border-border text-text-secondary hover:text-text-primary'}`}>{nature(k)}</button>
            ))}
          </div>
          <button type="submit" disabled={!text.trim()} className="ml-auto flex min-h-11 items-center gap-2 bg-accent px-4 text-sm font-semibold text-bg disabled:opacity-40 md:min-h-0 md:py-2"><Plus size={14} /> {t('journalBord.ajouter')}</button>
        </div>
      </motion.form>

      {entrees.length === 0 ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('journalBord.vide.titre')}>{t('journalBord.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <>
          <motion.div variants={staggerItem} role="radiogroup" aria-label={t('journalBord.filtrer')} className="flex flex-wrap gap-1">
            {(['tous', ...NATURES] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={filtre === k} onClick={() => setFiltre(k)} className={`min-h-11 border px-3 text-xs md:min-h-0 md:py-1 ${filtre === k ? 'border-border-strong text-text-primary' : 'border-border text-text-muted hover:text-text-primary'}`}>
                {k === 'tous' ? t('journalBord.tous') : nature(k)}
              </button>
            ))}
          </motion.div>
          <motion.div variants={staggerItem} className="flex flex-col gap-4">
            {parJour.map(([jour, liste]) => (
              <section key={jour} aria-label={jour}>
                <p className="eyebrow mb-2">{new Date(`${jour}T00:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                <ul className="flex flex-col gap-2">
                  {liste.map((e) => (
                    <li key={e.id} className={`group flex gap-3 rounded-xl border bg-surface p-3 ${e.kind === 'panne' || e.kind === 'incident' ? 'border-warning/40' : e.kind === 'decision' ? 'border-accent/40' : 'border-border'}`}>
                      <span className="eyebrow mt-0.5 shrink-0">{nature(e.kind)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">{e.text}</p>
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">{e.byEmail.split('@')[0]} · {new Date(e.at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <button type="button" onClick={() => void remove('logbook', e.id)} aria-label={t('journalBord.supprimer')} title={t('journalBord.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </motion.div>
        </>
      )}
    </motion.section>
  );
}
