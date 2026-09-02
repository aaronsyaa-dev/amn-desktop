import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Circle, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { usePersonalStore } from '../state/usePersonalStore';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface Pas {
  id: string;
  label: string;
  doneAt: string | null;
}
interface Objectif {
  id: string;
  title: string;
  dueAt: string;
  steps: Pas[];
  createdAt: string;
}
const isoJour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * LES OBJECTIFS PERSO — ce que vous visez, et les pas pour y aller.
 *
 * Pour qui : une personne, à côté de son travail. Les Objectifs & résultats
 * sont ceux de l'organisation, chiffrés et partagés ; ici c'est privé, sans
 * chiffre imposé : une date, des pas, cochés. Rangé sur ce poste, comme les
 * habitudes et le budget.
 */
export function PersonalGoalsScreen() {
  const { t, langue } = useLangue();
  const locale = langue === 'en' ? 'en-GB' : 'fr-FR';
  const [objectifs, setObjectifs, pret] = usePersonalStore<Objectif[]>('objectifs', []);
  const [ouvert, setOuvert] = useState(false);
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [steps, setSteps] = useState('');
  const aujourdhui = isoJour(new Date());
  const fini = (o: Objectif) => o.steps.length > 0 && o.steps.every((s) => s.doneAt);
  const enCours = objectifs.filter((o) => !fini(o));
  const atteints = objectifs.filter(fini).length;
  const pasRestants = enCours.reduce((n, o) => n + o.steps.filter((s) => !s.doneAt).length, 0);

  const ajouter = () => {
    const lignes = steps.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!title.trim() || lignes.length === 0) return;
    const base = Date.now().toString(36);
    setObjectifs((o) => [{ id: `obj-${base}`, title: title.trim(), dueAt, steps: lignes.map((label, i) => ({ id: `pas-${base}-${i}`, label, doneAt: null })), createdAt: new Date().toISOString() }, ...o]);
    setTitle(''); setDueAt(''); setSteps(''); setOuvert(false);
  };
  const basculer = (o: Objectif, p: Pas) => setObjectifs((liste) => liste.map((x) => (x.id === o.id ? { ...x, steps: x.steps.map((s) => (s.id === p.id ? { ...s, doneAt: s.doneAt ? null : new Date().toISOString() } : s)) } : x)));
  const retirer = (o: Objectif) => setObjectifs((liste) => liste.filter((x) => x.id !== o.id));

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('perso.surtitre', { module: t('objectifsPerso.titre') })}
          title={t('objectifsPerso.titre')}
          description={t('objectifsPerso.description')}
          stats={[
            { label: t('objectifsPerso.stat.enCours'), value: enCours.length },
            { label: t('objectifsPerso.stat.atteints'), value: atteints, emphasis: atteints > 0 },
            { label: t('objectifsPerso.stat.pas'), value: pasRestants },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('objectifsPerso.ajouter')}
            </button>
          }
        />
      </motion.div>

      <motion.p variants={staggerItem} className="text-xs text-text-muted">{t('perso.local')}</motion.p>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); ajouter(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('objectifsPerso.champTitre')} aria-label={t('objectifsPerso.champTitre')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <label className="flex flex-col gap-1 text-xs text-text-muted">{t('objectifsPerso.champDate')}<input type="date" value={dueAt} min={aujourdhui} onChange={(e) => setDueAt(e.target.value)} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" /></label>
          <textarea value={steps} onChange={(e) => setSteps(e.target.value)} rows={4} placeholder={t('objectifsPerso.champPas')} aria-label={t('objectifsPerso.champPas')} className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none sm:col-span-2" />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={!title.trim() || !steps.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('objectifsPerso.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {pret && objectifs.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('objectifsPerso.vide.titre')} action={{ label: t('objectifsPerso.vide.action'), onClick: () => setOuvert(true) }}>{t('objectifsPerso.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.div variants={staggerItem} className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(18rem,1fr))]">
          {objectifs.map((o) => {
            const faits = o.steps.filter((s) => s.doneAt).length;
            const termine = fini(o);
            const retard = !termine && o.dueAt && o.dueAt < aujourdhui;
            return (
              <article key={o.id} className={`group flex flex-col gap-2 rounded-xl border bg-surface p-4 ${termine ? 'border-success/30' : 'border-border'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight text-text-primary">{o.title}</p>
                    <p className={`font-mono text-[10px] uppercase tracking-wider ${retard ? 'text-danger' : 'text-text-muted'}`}>
                      {termine ? t('objectifsPerso.atteint') : t('objectifsPerso.avancement', { fait: faits, total: o.steps.length })}
                      {o.dueAt ? ` · ${new Date(`${o.dueAt}T00:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                    </p>
                  </div>
                  <button type="button" onClick={() => retirer(o)} aria-label={t('objectifsPerso.supprimer')} title={t('objectifsPerso.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={o.steps.length} aria-valuenow={faits} aria-label={o.title}>
                  <div className={`h-full ${termine ? 'bg-success' : 'bg-accent'}`} style={{ width: `${o.steps.length ? Math.round((faits / o.steps.length) * 100) : 0}%` }} />
                </div>
                <ol className="flex flex-col">
                  {o.steps.map((s) => (
                    <li key={s.id}>
                      <button type="button" onClick={() => basculer(o, s)} aria-pressed={Boolean(s.doneAt)} className="flex min-h-11 w-full items-center gap-2 text-left text-sm hover:bg-surface-hover md:min-h-0 md:py-1">
                        {s.doneAt ? <Check size={14} className="shrink-0 text-success" /> : <Circle size={14} className="shrink-0 text-text-muted" />}
                        <span className={s.doneAt ? 'text-text-muted line-through' : 'text-text-primary'}>{s.label}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </article>
            );
          })}
        </motion.div>
      )}
    </motion.section>
  );
}
