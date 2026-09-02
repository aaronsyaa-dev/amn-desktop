import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Circle, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface Etape {
  id: string;
  label: string;
  doneAt: string | null;
}
interface AssemblyData {
  title: string;
  client: string;
  steps: Etape[];
  createdAt: string;
  updatedAt: string;
}

/**
 * LE SUIVI DE MONTAGE — chaque chantier, étape par étape.
 *
 * Pour qui : un poseur, un installateur, un atelier qui a trois chantiers en
 * parallèle et à qui le client demande « où en est-on ? ». Ce que ça règle :
 * un chantier, ses étapes écrites une fois, cochées au fur et à mesure.
 * L'avancement affiché est ce qui est fait — jamais un pourcentage estimé.
 */
export function AssemblyScreen() {
  const { t } = useLangue();
  const { upsert, remove } = useSync();
  const brutes = useCollection<AssemblyData>('assemblies');
  const [ouvert, setOuvert] = useState(false);
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [steps, setSteps] = useState('');

  const chantiers = useMemo(() => [...brutes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [brutes]);
  const fini = (c: AssemblyData) => c.steps.length > 0 && c.steps.every((s) => s.doneAt);
  const enCours = chantiers.filter((c) => !fini(c));
  const termines = chantiers.filter(fini);
  const restantes = enCours.reduce((n, c) => n + c.steps.filter((s) => !s.doneAt).length, 0);

  const ajouter = async () => {
    const lignes = steps.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!title.trim() || lignes.length === 0) return;
    const now = new Date().toISOString();
    await upsert('assemblies', uid('asm'), { title: title.trim(), client: client.trim(), steps: lignes.map((label) => ({ id: uid('stp'), label, doneAt: null })), createdAt: now, updatedAt: now });
    setTitle(''); setClient(''); setSteps(''); setOuvert(false);
  };
  const basculer = (c: AssemblyData & { id: string }, etape: Etape) =>
    upsert('assemblies', c.id, {
      ...c,
      steps: c.steps.map((s) => (s.id === etape.id ? { ...s, doneAt: s.doneAt ? null : new Date().toISOString() } : s)),
      updatedAt: new Date().toISOString(),
    });

  const Carte = ({ c }: { c: AssemblyData & { id: string } }) => {
    const faites = c.steps.filter((s) => s.doneAt).length;
    const termine = fini(c);
    return (
      <article className={`group flex flex-col gap-2 rounded-xl border bg-surface p-4 ${termine ? 'border-success/30' : 'border-border'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary">{c.title}</p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
              {c.client ? `${c.client} · ` : ''}{termine ? t('montage.termine') : t('montage.avancement', { fait: faites, total: c.steps.length })} · {relativeTime(c.updatedAt)}
            </p>
          </div>
          <button type="button" onClick={() => void remove('assemblies', c.id)} aria-label={t('montage.supprimer')} title={t('montage.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={c.steps.length} aria-valuenow={faites} aria-label={t('montage.avancement', { fait: faites, total: c.steps.length })}>
          <div className={`h-full ${termine ? 'bg-success' : 'bg-accent'}`} style={{ width: `${c.steps.length ? Math.round((faites / c.steps.length) * 100) : 0}%` }} />
        </div>
        <ol className="flex flex-col">
          {c.steps.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => void basculer(c, s)} aria-pressed={Boolean(s.doneAt)} className="flex min-h-11 w-full items-center gap-2 text-left text-sm hover:bg-surface-hover md:min-h-0 md:py-1">
                {s.doneAt ? <Check size={14} className="shrink-0 text-success" /> : <Circle size={14} className="shrink-0 text-text-muted" />}
                <span className={s.doneAt ? 'text-text-muted line-through' : 'text-text-primary'}>{s.label}</span>
                {s.doneAt && <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-text-muted">{relativeTime(s.doneAt)}</span>}
              </button>
            </li>
          ))}
        </ol>
      </article>
    );
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('production.surtitre', { module: t('montage.titre') })}
          title={t('montage.titre')}
          description={t('montage.description')}
          stats={[
            { label: t('montage.stat.enCours'), value: enCours.length },
            { label: t('montage.stat.termines'), value: termines.length },
            { label: t('montage.stat.etapesRestantes'), value: restantes, emphasis: restantes > 0 },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('montage.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void ajouter(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('montage.champTitre')} aria-label={t('montage.champTitre')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={client} onChange={(e) => setClient(e.target.value)} placeholder={t('montage.champClient')} aria-label={t('montage.champClient')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={4} placeholder={t('montage.champEtapes')} aria-label={t('montage.champEtapes')} className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none sm:col-span-2" />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={!title.trim() || !steps.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('montage.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {chantiers.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('montage.vide.titre')} action={{ label: t('montage.vide.action'), onClick: () => setOuvert(true) }}>{t('montage.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.div variants={staggerItem} className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(18rem,1fr))]">
          {enCours.map((c) => <Carte key={c.id} c={c} />)}
          {termines.map((c) => <Carte key={c.id} c={c} />)}
        </motion.div>
      )}
    </motion.section>
  );
}
