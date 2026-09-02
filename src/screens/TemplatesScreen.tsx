import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface TemplateData {
  title: string;
  body: string;
  createdAt: string;
}
/** Les trous d'un modèle : « {prénom} », « {date} »… dans l'ordre d'apparition, sans doublon. */
export function trousDe(body: string): string[] {
  const vus = new Set<string>();
  for (const m of body.matchAll(/\{([^{}]{1,40})\}/g)) vus.add(m[1].trim());
  return [...vus];
}
export function remplir(body: string, valeurs: Record<string, string>): string {
  return body.replace(/\{([^{}]{1,40})\}/g, (tout, cle: string) => valeurs[cle.trim()] || tout);
}

/**
 * LES MODÈLES — des textes prêts, à trous.
 *
 * Pour qui : quelqu'un qui réécrit le même message dix fois par semaine — la
 * confirmation de commande, la réponse au devis, le rappel de rendez-vous.
 * Ce que ça règle : un texte avec des trous nommés entre accolades, remplis
 * en un geste, copié. Les Relances et la Lettre ont leur texte propre ; les
 * modèles servent à tout le reste.
 */
export function TemplatesScreen() {
  const { t } = useLangue();
  const { upsert, remove } = useSync();
  const brutes = useCollection<TemplateData>('templates');
  const [ouvert, setOuvert] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [actif, setActif] = useState<string | null>(null);
  const [valeurs, setValeurs] = useState<Record<string, string>>({});
  const [copie, setCopie] = useState(false);

  const modeles = useMemo(() => [...brutes].sort((a, b) => a.title.localeCompare(b.title)), [brutes]);
  const courant = modeles.find((m) => m.id === actif) ?? null;
  const trous = courant ? trousDe(courant.body) : [];
  const resultat = courant ? remplir(courant.body, valeurs) : '';
  const trousTotal = modeles.reduce((n, m) => n + trousDe(m.body).length, 0);

  const creer = async () => {
    if (!title.trim() || !body.trim()) return;
    await upsert('templates', uid('tpl'), { title: title.trim(), body: body.trim(), createdAt: new Date().toISOString() });
    setTitle(''); setBody(''); setOuvert(false);
  };
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(resultat);
      setCopie(true);
      window.setTimeout(() => setCopie(false), 2000);
    } catch {
      /* presse-papiers refusé : le texte reste sélectionnable */
    }
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('outils.surtitre', { module: t('modeles.titre') })}
          title={t('modeles.titre')}
          description={t('modeles.description')}
          stats={[
            { label: t('modeles.stat.modeles'), value: modeles.length },
            { label: t('modeles.stat.trous'), value: trousTotal },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('modeles.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void creer(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('modeles.champTitre')} aria-label={t('modeles.champTitre')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder={t('modeles.champTexte')} aria-label={t('modeles.champTexte')} className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none" />
          <p className="text-xs text-text-muted">{t('modeles.aide')}</p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={!title.trim() || !body.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('modeles.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {modeles.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('modeles.vide.titre')} action={{ label: t('modeles.vide.action'), onClick: () => setOuvert(true) }}>{t('modeles.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.div variants={staggerItem} className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <ul className="flex flex-col gap-1">
            {modeles.map((m) => (
              <li key={m.id} className="group flex items-center gap-1">
                <button type="button" onClick={() => { setActif(m.id); setValeurs({}); }} aria-pressed={m.id === actif} className={`min-h-11 min-w-0 flex-1 truncate border px-3 text-left text-sm ${m.id === actif ? 'border-border-strong bg-surface-hover text-text-primary' : 'border-border text-text-secondary hover:text-text-primary'}`}>
                  {m.title} <span className="tnum text-[10px] text-text-muted">· {t('modeles.trous', { n: trousDe(m.body).length })}</span>
                </button>
                <button type="button" onClick={() => void remove('templates', m.id)} aria-label={t('modeles.supprimer')} title={t('modeles.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
          {courant ? (
            <section aria-label={courant.title} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
              <p className="text-sm font-semibold text-text-primary">{courant.title}</p>
              {trous.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {trous.map((trou) => (
                    <input key={trou} value={valeurs[trou] ?? ''} onChange={(e) => setValeurs((v) => ({ ...v, [trou]: e.target.value }))} placeholder={trou} aria-label={trou} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
                  ))}
                </div>
              )}
              <pre className="whitespace-pre-wrap rounded-lg border border-border bg-bg p-3 font-sans text-sm leading-relaxed text-text-primary">{resultat}</pre>
              <button type="button" onClick={() => void copier()} className="flex min-h-11 w-fit items-center gap-2 bg-accent px-4 text-sm font-semibold text-bg md:min-h-0 md:py-2">{copie ? <Check size={14} /> : <Copy size={14} />} {copie ? t('modeles.copie') : t('modeles.copier')}</button>
            </section>
          ) : (
            <p className="self-start text-sm text-text-muted">{t('modeles.choisir')}</p>
          )}
        </motion.div>
      )}
    </motion.section>
  );
}
