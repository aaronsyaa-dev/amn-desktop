import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, ClipboardCheck, Plus, Square, SquareCheckBig, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { useAuth } from '../auth/AuthContext';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface ChecklistData {
  title: string;
  items: string[];
  createdAt: string;
}
interface CheckRunData {
  checklistId: string;
  doneAt: string;
  byEmail: string;
  checked: boolean[];
  note: string;
}

/**
 * LES CONTRÔLES QUALITÉ — des listes à cocher, et la trace de chaque passage.
 *
 * Pour qui : un commerce, un atelier, un traiteur dont la liste d'ouverture
 * est dans la tête de la personne qui ouvre. Ce que ça règle : un modèle
 * écrit une fois, et chaque passage daté et signé — qui, quand, combien de
 * points conformes. La trace existe le jour où on la demande (hygiène,
 * sécurité, assurance) sans avoir été faite pour ça.
 */
export function ChecklistsScreen() {
  const { t } = useLangue();
  const { user } = useAuth();
  const { upsert, remove } = useSync();
  const modeles = useCollection<ChecklistData>('checklists');
  const passages = useCollection<CheckRunData>('checkRuns');
  const [ouvert, setOuvert] = useState(false);
  const [title, setTitle] = useState('');
  const [points, setPoints] = useState('');
  const [enCours, setEnCours] = useState<{ id: string; checked: boolean[] } | null>(null);

  const tries = useMemo(() => [...modeles].sort((a, b) => a.title.localeCompare(b.title)), [modeles]);
  const parModele = useMemo(() => {
    const m = new Map<string, (CheckRunData & { id: string })[]>();
    for (const p of passages) {
      const l = m.get(p.checklistId) ?? [];
      l.push(p);
      m.set(p.checklistId, l);
    }
    for (const l of m.values()) l.sort((a, b) => b.doneAt.localeCompare(a.doneAt));
    return m;
  }, [passages]);
  const ilYaSeptJours = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const passagesSemaine = passages.filter((p) => p.doneAt >= ilYaSeptJours).length;

  const creer = async () => {
    const items = points.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!title.trim() || items.length === 0) return;
    await upsert('checklists', uid('chk'), { title: title.trim(), items, createdAt: new Date().toISOString() });
    setTitle(''); setPoints(''); setOuvert(false);
  };
  const lancer = (m: ChecklistData & { id: string }) => setEnCours({ id: m.id, checked: m.items.map(() => false) });
  const cocher = (i: number) => setEnCours((c) => (c ? { ...c, checked: c.checked.map((v, j) => (j === i ? !v : v)) } : c));
  const valider = async () => {
    if (!enCours) return;
    await upsert('checkRuns', uid('run'), { checklistId: enCours.id, doneAt: new Date().toISOString(), byEmail: user?.email ?? '', checked: enCours.checked, note: '' });
    setEnCours(null);
  };
  const nombreConformes = (p: CheckRunData) => p.checked.filter(Boolean).length;

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('production.surtitre', { module: t('controles.titre') })}
          title={t('controles.titre')}
          description={t('controles.description')}
          stats={[
            { label: t('controles.stat.modeles'), value: tries.length },
            { label: t('controles.stat.passages'), value: passages.length },
            { label: t('controles.stat.passagesSemaine'), value: passagesSemaine },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('controles.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void creer(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('controles.champTitre')} aria-label={t('controles.champTitre')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <textarea value={points} onChange={(e) => setPoints(e.target.value)} rows={5} placeholder={t('controles.champPoints')} aria-label={t('controles.champPoints')} className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none" />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={!title.trim() || !points.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('controles.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {tries.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('controles.vide.titre')} action={{ label: t('controles.vide.action'), onClick: () => setOuvert(true) }}>{t('controles.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.div variants={staggerItem} className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(18rem,1fr))]">
          {tries.map((m) => {
            const historique = parModele.get(m.id) ?? [];
            const dernier = historique[0];
            const actif = enCours?.id === m.id ? enCours : null;
            return (
              <article key={m.id} className={`group flex flex-col gap-2 rounded-xl border bg-surface p-4 ${actif ? 'border-accent/60' : 'border-border'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">{m.title}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {t('controles.points', { n: m.items.length })} · {dernier ? t('controles.dernierPassage', { quand: relativeTime(dernier.doneAt), qui: dernier.byEmail.split('@')[0] }) : t('controles.aucunPassage')}
                    </p>
                  </div>
                  <button type="button" onClick={() => void remove('checklists', m.id)} aria-label={t('controles.supprimer')} title={t('controles.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
                </div>

                {actif ? (
                  <>
                    <ol className="flex flex-col">
                      {m.items.map((item, i) => (
                        <li key={`${item}-${i}`}>
                          <button type="button" onClick={() => cocher(i)} aria-pressed={actif.checked[i]} className="flex min-h-11 w-full items-center gap-2 text-left text-sm hover:bg-surface-hover">
                            {actif.checked[i] ? <SquareCheckBig size={15} className="shrink-0 text-success" /> : <Square size={15} className="shrink-0 text-text-muted" />}
                            <span className={actif.checked[i] ? 'text-text-primary' : 'text-text-secondary'}>{item}</span>
                          </button>
                        </li>
                      ))}
                    </ol>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void valider()} className="flex min-h-11 items-center gap-2 bg-accent px-3 text-xs font-semibold text-bg md:min-h-0 md:py-1.5"><Check size={13} /> {t('controles.valider')}</button>
                      <button type="button" onClick={() => setEnCours(null)} className="min-h-11 border border-border px-3 text-xs text-text-secondary hover:text-text-primary md:min-h-0 md:py-1.5">{t('chrome.fermer')}</button>
                    </div>
                  </>
                ) : (
                  <>
                    <ul className="text-xs text-text-secondary">
                      {m.items.slice(0, 4).map((item, i) => <li key={`${item}-${i}`} className="truncate">· {item}</li>)}
                      {m.items.length > 4 && <li className="text-text-muted">…</li>}
                    </ul>
                    <button type="button" onClick={() => lancer(m)} className="flex min-h-11 items-center justify-center gap-2 border border-border-strong px-3 text-xs text-text-primary hover:bg-surface-hover md:min-h-0 md:py-1.5"><ClipboardCheck size={13} /> {t('controles.lancer')}</button>
                  </>
                )}

                {historique.length > 0 && (
                  <ul className="mt-1 flex flex-col divide-y divide-border border-t border-border pt-1 text-[11px]">
                    {historique.slice(0, 3).map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2 py-1 text-text-muted">
                        <span className="truncate">{relativeTime(p.doneAt)} · {p.byEmail.split('@')[0]}</span>
                        <span className={`tnum ${nombreConformes(p) === p.checked.length ? 'text-success' : 'text-warning'}`}>{t('controles.conforme', { n: nombreConformes(p), total: p.checked.length })}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </motion.div>
      )}
    </motion.section>
  );
}
