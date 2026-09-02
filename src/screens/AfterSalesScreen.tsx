import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Plus, RotateCcw, Trash2, UserCheck } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useAuth } from '../auth/AuthContext';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

type Etat = 'ouvert' | 'enCours' | 'resolu';
interface TicketData {
  client: string;
  subject: string;
  note: string;
  status: Etat;
  openedAt: string;
  takenBy: string;
  resolvedAt: string | null;
}
const ETATS: Etat[] = ['ouvert', 'enCours', 'resolu'];
const jours = (depuis: string, jusqua: string | null) => Math.max(0, Math.round((Date.parse(jusqua ?? new Date().toISOString()) - Date.parse(depuis)) / 86_400_000));

/**
 * LE SAV — les demandes après vente, de l'ouverture à la résolution.
 *
 * Pour qui : un artisan, un installateur, une boutique dont un client rappelle
 * et personne ne sait qui avait promis quoi. Ce que ça règle : chaque
 * demande a un client, un état, et surtout un âge — ce qui traîne se voit.
 * Trois états seulement : ouverte, en cours, résolue. Un vrai ticketing a des
 * priorités, des files, des SLA ; ici on veut juste ne rien oublier.
 */
export function AfterSalesScreen() {
  const { t } = useLangue();
  const { user } = useAuth();
  const { upsert, remove } = useSync();
  const brutes = useCollection<TicketData>('tickets');
  const [ouvert, setOuvert] = useState(false);
  const [client, setClient] = useState('');
  const [subject, setSubject] = useState('');
  const [note, setNote] = useState('');

  const parEtat = useMemo(() => {
    const m: Record<Etat, (TicketData & { id: string })[]> = { ouvert: [], enCours: [], resolu: [] };
    for (const tk of brutes) (m[tk.status] ?? m.ouvert).push(tk);
    m.ouvert.sort((a, b) => a.openedAt.localeCompare(b.openedAt));
    m.enCours.sort((a, b) => a.openedAt.localeCompare(b.openedAt));
    m.resolu.sort((a, b) => (b.resolvedAt ?? '').localeCompare(a.resolvedAt ?? ''));
    return m;
  }, [brutes]);
  const debutMois = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const resoluesMois = parEtat.resolu.filter((tk) => (tk.resolvedAt ?? '') >= debutMois).length;

  const ajouter = async () => {
    if (!subject.trim()) return;
    await upsert('tickets', uid('sav'), { client: client.trim(), subject: subject.trim(), note: note.trim(), status: 'ouvert', openedAt: new Date().toISOString(), takenBy: '', resolvedAt: null });
    setClient(''); setSubject(''); setNote(''); setOuvert(false);
  };
  const passer = (tk: TicketData & { id: string }, status: Etat) =>
    upsert('tickets', tk.id, {
      ...tk,
      status,
      takenBy: status === 'enCours' ? user?.email ?? tk.takenBy : tk.takenBy,
      resolvedAt: status === 'resolu' ? new Date().toISOString() : null,
    });
  const etat = (s: Etat) => t(`sav.etat.${s}` as Parameters<typeof t>[0]);

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('production.surtitre', { module: t('sav.titre') })}
          title={t('sav.titre')}
          description={t('sav.description')}
          stats={[
            { label: t('sav.stat.ouvertes'), value: parEtat.ouvert.length, emphasis: parEtat.ouvert.length > 0 },
            { label: t('sav.stat.enCours'), value: parEtat.enCours.length },
            { label: t('sav.stat.resoluesMois'), value: resoluesMois },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('sav.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void ajouter(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
          <input value={client} onChange={(e) => setClient(e.target.value)} placeholder={t('sav.champClient')} aria-label={t('sav.champClient')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('sav.champSujet')} aria-label={t('sav.champSujet')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('sav.champNote')} aria-label={t('sav.champNote')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none sm:col-span-2" />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={!subject.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('sav.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {brutes.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('sav.vide.titre')} action={{ label: t('sav.vide.action'), onClick: () => setOuvert(true) }}>{t('sav.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.div variants={staggerItem} className="grid gap-3 md:grid-cols-3">
          {ETATS.map((s) => (
            <section key={s} aria-label={etat(s)} className={`flex min-h-[8rem] flex-col gap-2 rounded-xl border bg-surface p-3 ${s === 'resolu' ? 'border-success/30' : s === 'ouvert' ? 'border-warning/30' : 'border-border'}`}>
              <p className="eyebrow flex items-center justify-between">
                <span>{etat(s)}</span>
                <span className="tnum">{parEtat[s].length}</span>
              </p>
              {parEtat[s].map((tk) => {
                const age = jours(tk.openedAt, tk.resolvedAt);
                return (
                  <article key={tk.id} className="group flex flex-col gap-1 rounded-lg border border-border bg-bg p-2.5">
                    <p className="text-sm font-medium leading-tight text-text-primary">{tk.subject}</p>
                    <p className="flex flex-wrap items-center justify-between gap-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      <span className="truncate">{tk.client || '—'}</span>
                      <span className={`tnum ${s !== 'resolu' && age >= 7 ? 'text-warning' : ''}`}>
                        {s === 'resolu' ? t('sav.resolueEn', { n: age }) : t('sav.depuis', { n: age })}
                      </span>
                    </p>
                    {tk.note && <p className="text-xs leading-snug text-text-muted">{tk.note}</p>}
                    {tk.takenBy && s !== 'ouvert' && <p className="truncate text-[11px] text-text-secondary">{tk.takenBy}</p>}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s === 'ouvert' && (
                        <button type="button" onClick={() => void passer(tk, 'enCours')} className="flex min-h-11 items-center gap-1 border border-border-strong px-2 text-[11px] text-text-primary hover:bg-surface-hover md:min-h-0 md:py-1"><UserCheck size={11} /> {t('sav.prendre')}</button>
                      )}
                      {s !== 'resolu' && (
                        <button type="button" onClick={() => void passer(tk, 'resolu')} className="flex min-h-11 items-center gap-1 border border-border px-2 text-[11px] text-text-secondary hover:text-text-primary md:min-h-0 md:py-1"><Check size={11} /> {t('sav.resoudre')}</button>
                      )}
                      {s === 'resolu' && (
                        <button type="button" onClick={() => void passer(tk, 'ouvert')} className="flex min-h-11 items-center gap-1 border border-border px-2 text-[11px] text-text-muted hover:text-text-primary md:min-h-0 md:py-1"><RotateCcw size={11} /> {t('sav.rouvrir')}</button>
                      )}
                      <button type="button" onClick={() => void remove('tickets', tk.id)} aria-label={t('sav.supprimer')} title={t('sav.supprimer')} className="ml-auto min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={12} /></button>
                    </div>
                  </article>
                );
              })}
            </section>
          ))}
        </motion.div>
      )}
    </motion.section>
  );
}
