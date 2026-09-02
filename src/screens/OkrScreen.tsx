import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface KeyResult {
  id: string;
  label: string;
  target: number;
  current: number;
  unit: string;
}
interface OkrData {
  objective: string;
  season: string;
  keyResults: KeyResult[];
  createdAt: string;
}
const nombre = (s: string) => Number(String(s ?? '').trim().replace(',', '.')) || 0;
const avancement = (kr: KeyResult) => (kr.target > 0 ? Math.min(1, kr.current / kr.target) : 0);
const avancementObjectif = (o: OkrData) => (o.keyResults.length ? o.keyResults.reduce((n, kr) => n + avancement(kr), 0) / o.keyResults.length : 0);

/**
 * LES OBJECTIFS & RÉSULTATS — trois objectifs par saison, mesurés.
 *
 * Pour qui : une petite structure qui a des envies et pas de chiffres. Ce
 * que ça règle : chaque objectif porte deux ou trois résultats clés chiffrés
 * (une cible, une unité), et l'avancement vient des valeurs saisies — jamais
 * d'un curseur qu'on déplace à la main. Pas de cascade, pas de pondération :
 * c'est un mur d'atelier, pas un tableau de direction.
 */
export function OkrScreen() {
  const { t } = useLangue();
  const { upsert, remove } = useSync();
  const brutes = useCollection<OkrData>('okrs');
  const [ouvert, setOuvert] = useState(false);
  const [objective, setObjective] = useState('');
  const [season, setSeason] = useState('');
  const [lignes, setLignes] = useState('');

  const objectifs = useMemo(() => [...brutes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [brutes]);
  const moyenne = objectifs.length ? Math.round((objectifs.reduce((n, o) => n + avancementObjectif(o), 0) / objectifs.length) * 100) : null;
  const atteints = objectifs.reduce((n, o) => n + o.keyResults.filter((kr) => avancement(kr) >= 1).length, 0);

  const ajouter = async () => {
    const krs = lignes.split('\n').map((l) => l.split(',').map((p) => p.trim())).filter(([label]) => label).map(([label, target, unit]) => ({ id: uid('kr'), label, target: nombre(target ?? '0'), current: 0, unit: unit ?? '' }));
    if (!objective.trim() || krs.length === 0) return;
    await upsert('okrs', uid('okr'), { objective: objective.trim(), season: season.trim(), keyResults: krs, createdAt: new Date().toISOString() });
    setObjective(''); setSeason(''); setLignes(''); setOuvert(false);
  };
  const saisir = (o: OkrData & { id: string }, kr: KeyResult, valeur: string) =>
    upsert('okrs', o.id, { ...o, keyResults: o.keyResults.map((k) => (k.id === kr.id ? { ...k, current: nombre(valeur) } : k)) });

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('pilotage.surtitre', { module: t('okr.titre') })}
          title={t('okr.titre')}
          description={t('okr.description')}
          stats={[
            { label: t('okr.stat.objectifs'), value: objectifs.length },
            { label: t('okr.stat.avancement'), value: moyenne === null ? '—' : `${moyenne} %` },
            { label: t('okr.stat.atteints'), value: atteints, emphasis: atteints > 0 },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('okr.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void ajouter(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
          <input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder={t('okr.champObjectif')} aria-label={t('okr.champObjectif')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={season} onChange={(e) => setSeason(e.target.value)} placeholder={t('okr.champSaison')} aria-label={t('okr.champSaison')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <textarea value={lignes} onChange={(e) => setLignes(e.target.value)} rows={3} placeholder={t('okr.champResultats')} aria-label={t('okr.champResultats')} className="input-focus border border-border bg-bg px-3 py-2 font-mono text-sm text-text-primary outline-none sm:col-span-2" />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={!objective.trim() || !lignes.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('okr.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {objectifs.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('okr.vide.titre')} action={{ label: t('okr.vide.action'), onClick: () => setOuvert(true) }}>{t('okr.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.div variants={staggerItem} className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(20rem,1fr))]">
          {objectifs.map((o) => {
            const pct = Math.round(avancementObjectif(o) * 100);
            return (
              <article key={o.id} className={`group flex flex-col gap-3 rounded-xl border bg-surface p-4 ${pct >= 100 ? 'border-success/30' : 'border-border'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight text-text-primary">{o.objective}</p>
                    {o.season && <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{o.season}</p>}
                  </div>
                  <span className={`tnum shrink-0 text-lg font-medium ${pct >= 100 ? 'text-success' : 'text-text-primary'}`}>{pct} %</span>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={o.objective}>
                  <div className={`h-full ${pct >= 100 ? 'bg-success' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
                </div>
                <ul className="flex flex-col gap-2">
                  {o.keyResults.map((kr) => {
                    const fait = avancement(kr) >= 1;
                    return (
                      <li key={kr.id} className="flex flex-wrap items-center gap-2 text-sm">
                        {fait ? <Check size={14} className="shrink-0 text-success" /> : <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-border" aria-hidden="true" />}
                        <span className="min-w-0 flex-1 text-text-primary">{kr.label}</span>
                        <label className="flex items-center gap-1 text-xs text-text-muted">
                          <span className="sr-only">{t('okr.champActuel', { label: kr.label })}</span>
                          <input defaultValue={kr.current || ''} onBlur={(e) => void saisir(o, kr, e.target.value)} inputMode="decimal" placeholder="0" className="input-focus tnum min-h-11 w-16 border border-border bg-bg px-2 text-right text-sm text-text-primary outline-none md:min-h-0 md:py-1" />
                          <span className="tnum">/ {kr.target}{kr.unit ? ` ${kr.unit}` : ''}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <button type="button" onClick={() => void remove('okrs', o.id)} aria-label={t('okr.supprimer')} title={t('okr.supprimer')} className="self-end min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
              </article>
            );
          })}
        </motion.div>
      )}
    </motion.section>
  );
}
