import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, Plus, Star, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface ReviewData {
  author: string;
  text: string;
  rating: number;
  source: string;
  publishable: boolean;
  receivedAt: string;
}

/**
 * LES AVIS ET TÉMOIGNAGES — ce que les clientes disent, gardé au même endroit.
 *
 * Pour qui : une boutique ou une prestataire dont les avis vivent dans
 * Google, Instagram, un SMS, une carte manuscrite — partout sauf ensemble.
 * Ce que ça règle : les recueillir, les noter sur cinq, marquer ceux qu'on
 * peut publier, et copier un témoignage prêt pour le site. La note moyenne
 * se lit en haut ; aucun avis n'est inventé, ni importé de nulle part.
 */
export function ReviewsScreen() {
  const { t } = useLangue();
  const { upsert, remove } = useSync();
  const brutes = useCollection<ReviewData>('reviews');
  const [ouvert, setOuvert] = useState(false);
  const [author, setAuthor] = useState('');
  const [text, setText] = useState('');
  const [rating, setRating] = useState(5);
  const [source, setSource] = useState('');
  const [copie, setCopie] = useState<string | null>(null);

  const avis = useMemo(() => [...brutes].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)), [brutes]);
  const moyenne = avis.length ? Math.round((avis.reduce((n, a) => n + a.rating, 0) / avis.length) * 10) / 10 : 0;
  const publiables = avis.filter((a) => a.publishable).length;

  const ajouter = async () => {
    if (!text.trim()) return;
    await upsert('reviews', uid('avis'), { author: author.trim() || t('avis.anonyme'), text: text.trim(), rating, source: source.trim(), publishable: false, receivedAt: new Date().toISOString() });
    setAuthor(''); setText(''); setRating(5); setSource(''); setOuvert(false);
  };
  const copier = async (a: ReviewData & { id: string }) => {
    try {
      await navigator.clipboard.writeText(`« ${a.text} » — ${a.author}`);
      setCopie(a.id);
      window.setTimeout(() => setCopie(null), 2000);
    } catch {
      /* presse-papiers refusé : le texte reste sélectionnable */
    }
  };

  const Etoiles = ({ n, onPick }: { n: number; onPick?: (v: number) => void }) => (
    <span className="flex items-center gap-0.5" aria-label={t('avis.note', { n })}>
      {[1, 2, 3, 4, 5].map((v) =>
        onPick ? (
          <button key={v} type="button" onClick={() => onPick(v)} aria-label={t('avis.note', { n: v })} className="flex h-8 w-8 items-center justify-center">
            <Star size={16} className={v <= n ? 'fill-current text-warning' : 'text-text-muted'} />
          </button>
        ) : (
          <Star key={v} size={13} className={v <= n ? 'fill-current text-warning' : 'text-text-muted'} />
        ),
      )}
    </span>
  );

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('commerce.surtitre', { module: t('avis.titre') })}
          title={t('avis.titre')}
          description={t('avis.description')}
          stats={[
            { label: t('avis.stat.avis'), value: avis.length },
            { label: t('avis.stat.moyenne'), value: moyenne, format: (n) => (n ? `${n.toLocaleString('fr-FR')} / 5` : '—') },
            { label: t('avis.stat.publiables'), value: publiables },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('avis.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void ajouter(); }} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder={t('avis.champAuteur')} aria-label={t('avis.champAuteur')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
            <input value={source} onChange={(e) => setSource(e.target.value)} placeholder={t('avis.champSource')} aria-label={t('avis.champSource')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          </div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t('avis.champTexte')} aria-label={t('avis.champTexte')} rows={3} className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none" />
          <Etoiles n={rating} onPick={setRating} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={!text.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('avis.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {avis.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('avis.vide.titre')} action={{ label: t('avis.vide.action'), onClick: () => setOuvert(true) }}>{t('avis.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <motion.ul variants={staggerItem} className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(18rem,1fr))]">
          {avis.map((a) => (
            <li key={a.id} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <Etoiles n={a.rating} />
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{a.source || t('avis.sansSource')} · {relativeTime(a.receivedAt)}</span>
              </div>
              <p className="text-sm leading-relaxed text-text-primary [overflow-wrap:anywhere]">« {a.text} »</p>
              <p className="text-xs text-text-secondary">— {a.author}</p>
              <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                <button type="button" onClick={() => void upsert('reviews', a.id, { ...a, publishable: !a.publishable })} aria-pressed={a.publishable} className={`min-h-11 border px-3 text-xs md:min-h-0 md:py-1.5 ${a.publishable ? 'border-success/40 text-success' : 'border-border text-text-secondary hover:text-text-primary'}`}>
                  {a.publishable ? t('avis.publiable') : t('avis.marquerPubliable')}
                </button>
                <button type="button" onClick={() => void copier(a)} className="flex min-h-11 items-center gap-1.5 border border-border px-3 text-xs text-text-secondary hover:text-text-primary md:min-h-0 md:py-1.5">
                  {copie === a.id ? <Check size={12} /> : <Copy size={12} />} {copie === a.id ? t('relances.copie') : t('avis.copier')}
                </button>
                <button type="button" onClick={() => void remove('reviews', a.id)} aria-label={t('avis.supprimer')} title={t('avis.supprimer')} className="ml-auto flex min-h-11 items-center px-2 text-text-muted hover:text-danger md:min-h-0"><Trash2 size={12} /></button>
              </div>
            </li>
          ))}
        </motion.ul>
      )}
    </motion.section>
  );
}
