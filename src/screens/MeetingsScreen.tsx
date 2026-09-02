import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Circle, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useAuth } from '../auth/AuthContext';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface Suite {
  id: string;
  label: string;
  doneAt: string | null;
}
interface MeetingData {
  title: string;
  at: string;
  attendees: string;
  agenda: string;
  decisions: string[];
  actions: Suite[];
  byEmail: string;
  createdAt: string;
}
const localISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/**
 * LES RÉUNIONS — un ordre du jour, des décisions, des suites.
 *
 * Pour qui : une équipe qui se réunit et, trois semaines plus tard, ne sait
 * plus ce qui avait été dit. Ce que ça règle : chaque réunion garde son ordre
 * du jour, ses décisions et ses suites — cochées quand elles sont faites.
 * Pas de compte rendu rédigé : des lignes, pour être relues en dix secondes.
 */
export function MeetingsScreen() {
  const { t, langue } = useLangue();
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const { user } = useAuth();
  const { upsert, remove } = useSync();
  const brutes = useCollection<MeetingData>('meetings');
  const [ouvert, setOuvert] = useState(false);
  const [title, setTitle] = useState('');
  const [at, setAt] = useState(() => localISO(new Date()));
  const [attendees, setAttendees] = useState('');
  const [agenda, setAgenda] = useState('');
  const [brouillons, setBrouillons] = useState<Record<string, { decision: string; action: string }>>({});

  const reunions = useMemo(() => [...brutes].sort((a, b) => b.at.localeCompare(a.at)), [brutes]);
  const debutMois = localISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const ceMois = reunions.filter((r) => r.at >= debutMois).length;
  const decisions = reunions.reduce((n, r) => n + r.decisions.length, 0);
  const suitesOuvertes = reunions.reduce((n, r) => n + r.actions.filter((a) => !a.doneAt).length, 0);

  const ajouter = async () => {
    if (!title.trim()) return;
    await upsert('meetings', uid('mtg'), { title: title.trim(), at, attendees: attendees.trim(), agenda: agenda.trim(), decisions: [], actions: [], byEmail: user?.email ?? '', createdAt: new Date().toISOString() });
    setTitle(''); setAttendees(''); setAgenda(''); setOuvert(false);
  };
  const brouillon = (id: string) => brouillons[id] ?? { decision: '', action: '' };
  const noterDecision = async (r: MeetingData & { id: string }) => {
    const texte = brouillon(r.id).decision.trim();
    if (!texte) return;
    await upsert('meetings', r.id, { ...r, decisions: [...r.decisions, texte] });
    setBrouillons((b) => ({ ...b, [r.id]: { ...brouillon(r.id), decision: '' } }));
  };
  const noterAction = async (r: MeetingData & { id: string }) => {
    const texte = brouillon(r.id).action.trim();
    if (!texte) return;
    await upsert('meetings', r.id, { ...r, actions: [...r.actions, { id: uid('act'), label: texte, doneAt: null }] });
    setBrouillons((b) => ({ ...b, [r.id]: { ...brouillon(r.id), action: '' } }));
  };
  const basculer = (r: MeetingData & { id: string }, s: Suite) =>
    upsert('meetings', r.id, { ...r, actions: r.actions.map((a) => (a.id === s.id ? { ...a, doneAt: a.doneAt ? null : new Date().toISOString() } : a)) });
  const quand = (iso: string) => new Date(iso).toLocaleString(locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('pilotage.surtitre', { module: t('reunions.titre') })}
          title={t('reunions.titre')}
          description={t('reunions.description')}
          stats={[
            { label: t('reunions.stat.mois'), value: ceMois },
            { label: t('reunions.stat.decisions'), value: decisions },
            { label: t('reunions.stat.actionsOuvertes'), value: suitesOuvertes, emphasis: suitesOuvertes > 0 },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('reunions.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void ajouter(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('reunions.champTitre')} aria-label={t('reunions.champTitre')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <label className="flex flex-col gap-1 text-xs text-text-muted">{t('reunions.champQuand')}<input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" /></label>
          <input value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder={t('reunions.champPresents')} aria-label={t('reunions.champPresents')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={3} placeholder={t('reunions.champOrdre')} aria-label={t('reunions.champOrdre')} className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none sm:col-span-2" />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={!title.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('reunions.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {reunions.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('reunions.vide.titre')} action={{ label: t('reunions.vide.action'), onClick: () => setOuvert(true) }}>{t('reunions.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.div variants={staggerItem} className="flex flex-col gap-3">
          {reunions.map((r) => (
            <article key={r.id} className="group rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{r.title}</p>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{quand(r.at)}{r.attendees ? ` · ${r.attendees}` : ''}</p>
                </div>
                <button type="button" onClick={() => void remove('meetings', r.id)} aria-label={t('reunions.supprimer')} title={t('reunions.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
              </div>
              {r.agenda && <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">{r.agenda}</p>}
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <section aria-label={t('reunions.decisions')}>
                  <p className="eyebrow mb-1">{t('reunions.decisions')}</p>
                  <ul className="flex flex-col gap-1 text-sm text-text-primary">
                    {r.decisions.map((d, i) => <li key={`${d}-${i}`} className="border-l-2 border-accent pl-2">{d}</li>)}
                  </ul>
                  <form onSubmit={(e) => { e.preventDefault(); void noterDecision(r); }} className="mt-2 flex gap-1">
                    <input value={brouillon(r.id).decision} onChange={(e) => setBrouillons((b) => ({ ...b, [r.id]: { ...brouillon(r.id), decision: e.target.value } }))} placeholder={t('reunions.ajouterDecision')} aria-label={t('reunions.ajouterDecision')} className="input-focus min-h-11 min-w-0 flex-1 border border-border bg-bg px-2 text-xs text-text-primary outline-none md:min-h-0 md:py-1.5" />
                    <button type="submit" disabled={!brouillon(r.id).decision.trim()} className="min-h-11 border border-border-strong px-2 text-xs text-text-primary disabled:opacity-40 md:min-h-0">{t('reunions.noter')}</button>
                  </form>
                </section>
                <section aria-label={t('reunions.actions')}>
                  <p className="eyebrow mb-1">{t('reunions.actions')}</p>
                  <ul className="flex flex-col">
                    {r.actions.map((s) => (
                      <li key={s.id}>
                        <button type="button" onClick={() => void basculer(r, s)} aria-pressed={Boolean(s.doneAt)} className="flex min-h-11 w-full items-center gap-2 text-left text-sm md:min-h-0 md:py-1">
                          {s.doneAt ? <Check size={13} className="shrink-0 text-success" /> : <Circle size={13} className="shrink-0 text-text-muted" />}
                          <span className={s.doneAt ? 'text-text-muted line-through' : 'text-text-primary'}>{s.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <form onSubmit={(e) => { e.preventDefault(); void noterAction(r); }} className="mt-2 flex gap-1">
                    <input value={brouillon(r.id).action} onChange={(e) => setBrouillons((b) => ({ ...b, [r.id]: { ...brouillon(r.id), action: e.target.value } }))} placeholder={t('reunions.ajouterAction')} aria-label={t('reunions.ajouterAction')} className="input-focus min-h-11 min-w-0 flex-1 border border-border bg-bg px-2 text-xs text-text-primary outline-none md:min-h-0 md:py-1.5" />
                    <button type="submit" disabled={!brouillon(r.id).action.trim()} className="min-h-11 border border-border-strong px-2 text-xs text-text-primary disabled:opacity-40 md:min-h-0">{t('reunions.noter')}</button>
                  </form>
                </section>
              </div>
            </article>
          ))}
        </motion.div>
      )}
    </motion.section>
  );
}
