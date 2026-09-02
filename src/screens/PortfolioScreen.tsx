import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface PortfolioItemData {
  title: string;
  description: string;
  category: string;
  link: string;
  visible: boolean;
  createdAt: string;
}

/**
 * LE PORTFOLIO — vos réalisations, montrées sur la mini-page.
 *
 * Pour qui : un artisan, une créatrice, un atelier dont le meilleur travail
 * dort dans un téléphone. Ce que ça règle : une fiche par réalisation, un
 * lien vers les photos où elles sont déjà, et la mini-page publique les
 * reprend telles quelles. Pas d'hébergement d'images ici : la Médiathèque
 * existe pour ça côté interne, et un lien suffit à montrer.
 */
export function PortfolioScreen() {
  const { t } = useLangue();
  const { upsert, remove } = useSync();
  const brutes = useCollection<PortfolioItemData>('portfolioItems');
  const [ouvert, setOuvert] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');

  const fiches = useMemo(() => [...brutes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [brutes]);
  const visibles = fiches.filter((f) => f.visible).length;
  const categories = new Set(fiches.map((f) => f.category).filter(Boolean)).size;
  const lienValide = link.trim() === '' || /^https?:\/\/\S+$/.test(link.trim());

  const ajouter = async () => {
    if (!title.trim() || !lienValide) return;
    await upsert('portfolioItems', uid('pfl'), { title: title.trim(), description: description.trim(), category: category.trim(), link: link.trim(), visible: true, createdAt: new Date().toISOString() });
    setTitle(''); setCategory(''); setDescription(''); setLink(''); setOuvert(false);
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('pilotage.surtitre', { module: t('portfolio.titre') })}
          title={t('portfolio.titre')}
          description={t('portfolio.description')}
          stats={[
            { label: t('portfolio.stat.realisations'), value: fiches.length },
            { label: t('portfolio.stat.visibles'), value: visibles },
            { label: t('portfolio.stat.categories'), value: categories },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('portfolio.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void ajouter(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('portfolio.champTitre')} aria-label={t('portfolio.champTitre')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={t('portfolio.champCategorie')} aria-label={t('portfolio.champCategorie')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder={t('portfolio.champDescription')} aria-label={t('portfolio.champDescription')} className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none sm:col-span-2" />
          <input value={link} onChange={(e) => setLink(e.target.value)} type="url" placeholder={t('portfolio.champLien')} aria-label={t('portfolio.champLien')} aria-invalid={!lienValide} className={`input-focus min-h-11 border bg-bg px-3 text-sm text-text-primary outline-none sm:col-span-2 ${lienValide ? 'border-border' : 'border-danger'}`} />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={!title.trim() || !lienValide} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('portfolio.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {fiches.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('portfolio.vide.titre')} action={{ label: t('portfolio.vide.action'), onClick: () => setOuvert(true) }}>{t('portfolio.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <>
          <motion.p variants={staggerItem} className="text-xs text-text-muted">{t('portfolio.miniPage')}</motion.p>
          <motion.ul variants={staggerItem} className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(16rem,1fr))]">
            {fiches.map((f) => (
              <li key={f.id} className={`group flex flex-col gap-2 rounded-xl border bg-surface p-4 ${f.visible ? 'border-border' : 'border-dashed border-border opacity-70'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-tight text-text-primary">{f.title}</p>
                    {f.category && <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{f.category}</p>}
                  </div>
                  <button type="button" onClick={() => void remove('portfolioItems', f.id)} aria-label={t('portfolio.supprimer')} title={t('portfolio.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
                </div>
                {f.description && <p className="text-xs leading-relaxed text-text-secondary">{f.description}</p>}
                <div className="mt-auto flex flex-wrap gap-1 pt-1">
                  <button type="button" onClick={() => void upsert('portfolioItems', f.id, { ...f, visible: !f.visible })} aria-pressed={f.visible} className="flex min-h-11 items-center gap-1 border border-border px-2 text-[11px] text-text-secondary hover:text-text-primary md:min-h-0 md:py-1">
                    {f.visible ? <Eye size={11} /> : <EyeOff size={11} />} {f.visible ? t('portfolio.visible') : t('portfolio.masquee')}
                  </button>
                  {f.link && (
                    <a href={f.link} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-1 border border-border px-2 text-[11px] text-text-secondary hover:text-text-primary md:min-h-0 md:py-1"><ExternalLink size={11} /> {t('portfolio.voirLien')}</a>
                  )}
                </div>
              </li>
            ))}
          </motion.ul>
        </>
      )}
    </motion.section>
  );
}
