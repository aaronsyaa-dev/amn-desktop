import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { formatCents } from '../lib/money';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

type Stage = 'contact' | 'qualifie' | 'proposition' | 'gagne' | 'perdu';
interface ProspectData {
  name: string;
  company: string;
  valueCents: number;
  stage: Stage;
  note: string;
  createdAt: string;
  movedAt: string;
}
const STAGES: Stage[] = ['contact', 'qualifie', 'proposition', 'gagne', 'perdu'];
const SUIVANT: Record<Stage, Stage | null> = { contact: 'qualifie', qualifie: 'proposition', proposition: 'gagne', gagne: null, perdu: null };

/**
 * LE PIPELINE COMMERCIAL — d'où viendra le prochain client.
 *
 * Pour qui : une indépendante ou une petite boutique qui a « des gens en
 * cours » dans sa tête et nulle part ailleurs. Ce que ça règle : cinq
 * colonnes, de « contact » à « gagné » ou « perdu », et le montant qu'on
 * espère par colonne. Un prospect gagné devient une fiche client en un geste
 * dans Clients ; ici on ne fait qu'avancer. Trello fait des colonnes pour
 * tout ; celles-ci ont un sens fixe et un total en euros, c'est ce qui rend
 * la lecture immédiate.
 */
export function PipelineScreen() {
  const { t } = useLangue();
  const { upsert, remove } = useSync();
  const brutes = useCollection<ProspectData>('prospects');
  const [ouvert, setOuvert] = useState(false);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');

  const parEtape = useMemo(() => {
    const m: Record<Stage, (ProspectData & { id: string })[]> = { contact: [], qualifie: [], proposition: [], gagne: [], perdu: [] };
    for (const p of brutes) (m[p.stage] ?? m.contact).push(p);
    for (const k of STAGES) m[k].sort((a, b) => b.movedAt.localeCompare(a.movedAt));
    return m;
  }, [brutes]);
  const enCours = STAGES.filter((s) => s !== 'gagne' && s !== 'perdu').flatMap((s) => parEtape[s]);
  const espere = enCours.reduce((n, p) => n + (p.valueCents || 0), 0);
  const gagne = parEtape.gagne.reduce((n, p) => n + (p.valueCents || 0), 0);

  const ajouter = async () => {
    if (!name.trim()) return;
    const now = new Date().toISOString();
    await upsert('prospects', uid('pro'), { name: name.trim(), company: company.trim(), valueCents: Math.round((Number(value.replace(',', '.')) || 0) * 100), stage: 'contact', note: note.trim(), createdAt: now, movedAt: now });
    setName(''); setCompany(''); setValue(''); setNote(''); setOuvert(false);
  };
  const deplacer = (p: ProspectData & { id: string }, stage: Stage) => upsert('prospects', p.id, { ...p, stage, movedAt: new Date().toISOString() });
  const etape = (s: Stage) => t(`pipeline.etape.${s}` as Parameters<typeof t>[0]);

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('commerce.surtitre', { module: t('pipeline.titre') })}
          title={t('pipeline.titre')}
          description={t('pipeline.description')}
          stats={[
            { label: t('pipeline.stat.enCours'), value: enCours.length },
            { label: t('pipeline.stat.espere'), value: formatCents(espere) },
            { label: t('pipeline.stat.gagne'), value: formatCents(gagne), emphasis: gagne > 0 },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('pipeline.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void ajouter(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('pipeline.champNom')} aria-label={t('pipeline.champNom')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder={t('pipeline.champSociete')} aria-label={t('pipeline.champSociete')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder={t('pipeline.champMontant')} aria-label={t('pipeline.champMontant')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('pipeline.champNote')} aria-label={t('pipeline.champNote')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={!name.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('pipeline.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {brutes.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('pipeline.vide.titre')} action={{ label: t('pipeline.vide.action'), onClick: () => setOuvert(true) }}>{t('pipeline.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.div variants={staggerItem} className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(13rem,1fr))]">
          {STAGES.map((s) => (
            <section key={s} aria-label={etape(s)} className={`flex min-h-[10rem] flex-col gap-2 rounded-xl border p-3 ${s === 'gagne' ? 'border-success/30' : s === 'perdu' ? 'border-border opacity-70' : 'border-border'} bg-surface`}>
              <p className="eyebrow flex items-center justify-between">
                <span>{etape(s)}</span>
                <span className="tnum">{parEtape[s].length}</span>
              </p>
              {parEtape[s].map((p) => (
                <article key={p.id} className="group flex flex-col gap-1 rounded-lg border border-border bg-bg p-2.5">
                  <p className="text-sm font-medium leading-tight text-text-primary">{p.name}</p>
                  {p.company && <p className="truncate text-xs text-text-secondary">{p.company}</p>}
                  <p className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    <span className="tnum">{p.valueCents ? formatCents(p.valueCents) : '—'}</span>
                    <span>{relativeTime(p.movedAt)}</span>
                  </p>
                  {p.note && <p className="text-xs leading-snug text-text-muted">{p.note}</p>}
                  <div className="mt-1 flex flex-wrap gap-1">
                    {SUIVANT[s] && (
                      <button type="button" onClick={() => void deplacer(p, SUIVANT[s] as Stage)} className="flex min-h-11 items-center gap-1 border border-border-strong px-2 text-[11px] text-text-primary hover:bg-surface-hover md:min-h-0 md:py-1">
                        {etape(SUIVANT[s] as Stage)} <ArrowRight size={11} />
                      </button>
                    )}
                    {s !== 'perdu' && s !== 'gagne' && (
                      <button type="button" onClick={() => void deplacer(p, 'perdu')} className="min-h-11 border border-border px-2 text-[11px] text-text-muted hover:text-text-primary md:min-h-0 md:py-1">{etape('perdu')}</button>
                    )}
                    <button type="button" onClick={() => void remove('prospects', p.id)} aria-label={t('pipeline.supprimer')} title={t('pipeline.supprimer')} className="ml-auto min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={12} /></button>
                  </div>
                </article>
              ))}
            </section>
          ))}
        </motion.div>
      )}
    </motion.section>
  );
}
