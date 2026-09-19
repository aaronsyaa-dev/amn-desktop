import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
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
  /**
   * LE CHOIX, EN TROIS ÉTATS — et pourquoi deux ne suffisaient pas.
   *
   * La planche contact de `22d` garde les TROIS états visibles en même temps :
   * retenue (ellipse ambre), écartée (croix grise), indécise (rien). C'est la
   * thèse du module — « choisir des images n'est pas cocher des cases, c'est
   * comparer, revenir, changer d'avis » — et un booléen `visible` ne sait pas
   * dire « je n'ai pas encore tranché ».
   *
   * `visible` reste la source de vérité pour la mini-page, qui n'a que faire
   * de l'indécision : elle montre ce qui est retenu. `choix` porte la nuance
   * que la planche a besoin de voir. Une fiche sans `choix` est indécise, ce
   * qui est exactement ce que dit un enregistrement écrit avant ce champ :
   * personne n'a encore tranché.
   */
  choix?: 'retenue' | 'ecartee';
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

  /* Une fiche écrite avant le champ `choix` est INDÉCISE : personne n'a
     tranché, et la lire comme écartée serait décider à la place de quelqu'un. */
  const etatDe = (f: PortfolioItemData): 'retenue' | 'ecartee' | 'indecise' =>
    f.choix ?? (f.visible ? 'retenue' : 'indecise');
  const retenues = fiches.filter((f) => etatDe(f) === 'retenue');
  const indecises = fiches.filter((f) => etatDe(f) === 'indecise');

  /*
    TRANCHER — un seul geste, à trois positions. Cliquer une vue la fait passer
    d'indécise à retenue, de retenue à écartée, d'écartée à indécise. Trois
    boutons par vignette rempliraient la planche de commandes et on ne verrait
    plus les images ; un cycle garde la planche lisible et le revirement
    possible, ce qui est le sujet du module.
  */
  const trancher = (f: PortfolioItemData & { id: string }) => {
    const suivant =
      etatDe(f) === 'indecise' ? 'retenue' : etatDe(f) === 'retenue' ? 'ecartee' : undefined;
    return upsert('portfolioItems', f.id, {
      ...f,
      choix: suivant,
      /* La mini-page ne montre que ce qui est retenu — l'indécis n'y est pas. */
      visible: suivant === 'retenue',
    });
  };
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
          {/*
            ── L'OBJET DOMINANT : LA PLANCHE CONTACT ────────────────────────

            Six colonnes, format 3/2, chaque vue numérotée. La sélection se
            fait AU CRAYON GRAS : une ellipse ambre par-dessus pour retenir,
            une croix grise pour écarter, rien pour les indécises.

            Pourquoi pas des cases à cocher. Choisir des images n'est pas
            cocher — c'est comparer, revenir, changer d'avis. Une case cochée
            efface la trace du choix ; une ellipse tracée par-dessus laisse
            l'image visible dessous, et la planche garde les trois états sous
            les yeux en même temps. C'est ce qui permet de revenir.

            L'AMBRE est l'ensemble des ellipses de sélection : la seule marque
            colorée de la planche, et elle porte l'unique décision du module.

            LES EMPLACEMENTS D'IMAGE sont nommés, pas illustrés — le modèle ne
            porte pas encore de vignette (une réalisation a un titre, une
            catégorie, un lien). En production ce sont les vraies images, et
            leur ajout est un chantier de téléversement, pas de composition.
          */}
          <motion.section variants={staggerItem} className="panel-raised panel-raised-wide px-[30px] pb-[26px] pt-[30px]">
            <div className="mb-[22px] flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <span className="eyebrow text-text-secondary">La planche</span>
              <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">
                {retenues.length} RETENUE{retenues.length > 1 ? 'S' : ''} ·{' '}
                {indecises.length} INDÉCISE{indecises.length > 1 ? 'S' : ''}
              </span>
            </div>

            <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(148px,1fr))]">
              {fiches.map((f, i) => {
                const etat = etatDe(f);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => void trancher(f)}
                    aria-label={`${f.title} — ${etat}`}
                    className="group relative block w-full border border-border bg-sunken text-left"
                    style={{ aspectRatio: '3 / 2' }}
                  >
                    <span className="absolute left-2 top-2 font-mono text-[9.5px] tracking-[0.1em] text-text-muted">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="absolute inset-x-2.5 bottom-2 block">
                      <span className="block truncate text-[12px] font-semibold text-text-secondary">{f.title}</span>
                      {f.category && (
                        <span className="mt-0.5 block truncate font-mono text-[9px] uppercase tracking-[0.12em] text-text-muted">
                          {f.category}
                        </span>
                      )}
                    </span>

                    {/*
                      LE CRAYON GRAS. Un `<svg viewBox>` en `width:100%` posé
                      par-dessus la vue : l'ellipse et la croix se déforment
                      avec la vignette au lieu d'être recalculées, et
                      `vector-effect="non-scaling-stroke"` garde le trait
                      d'épaisseur constante — un trait de crayon ne s'épaissit
                      pas parce que la photo est plus grande.
                    */}
                    {etat !== 'indecise' && (
                      <svg
                        viewBox="0 0 150 100"
                        preserveAspectRatio="none"
                        className="pointer-events-none absolute inset-0 h-full w-full"
                        fill="none"
                        aria-hidden
                      >
                        {etat === 'retenue' ? (
                          <ellipse
                            data-signal-groupe="planche-retenues"
                            cx="75"
                            cy="50"
                            rx="62"
                            ry="38"
                            stroke="var(--color-signal)"
                            strokeWidth={2.6}
                            strokeLinecap="round"
                            vectorEffect="non-scaling-stroke"
                          />
                        ) : (
                          <>
                            <path
                              d="M16 16 L134 84"
                              stroke="var(--color-border-strong)"
                              strokeWidth={2.2}
                              strokeLinecap="round"
                              vectorEffect="non-scaling-stroke"
                            />
                            <path
                              d="M134 16 L16 84"
                              stroke="var(--color-border-strong)"
                              strokeWidth={2.2}
                              strokeLinecap="round"
                              vectorEffect="non-scaling-stroke"
                            />
                          </>
                        )}
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="mt-5 border-t border-border-raised pt-[22px] text-[13px] leading-[1.6] text-text-muted [text-wrap:pretty]">
              Un clic fait tourner le choix : indécise, retenue, écartée. Les indécises restent sur
              la planche sans limite de temps — c'est en revenant qu'on choisit bien.
            </p>
          </motion.section>

          {/* ── AUTOUR : l'ordre public, et la planche en trois chiffres ── */}
          <motion.div variants={staggerItem} className="grid gap-[18px] lg:grid-cols-[1fr_340px]">
            <section className="panel min-w-0 px-[22px] pb-[18px] pt-5">
              <div className="mb-[18px] flex items-baseline justify-between gap-4">
                <span className="eyebrow text-text-secondary">Ce que la mini-page montre</span>
                <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">
                  {t('portfolio.miniPage')}
                </span>
              </div>
              {retenues.length > 0 ? (
                <ol className="flex flex-col">
                  {retenues.map((f, i) => (
                    <li
                      key={f.id}
                      className="group grid grid-cols-[28px_1fr_auto] items-center gap-3 border-b border-border-row py-2.5 last:border-b-0"
                    >
                      <span className="tnum font-mono text-[11px] text-text-muted">{String(i + 1).padStart(2, '0')}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] text-text-primary">{f.title}</span>
                        {f.description && (
                          <span className="mt-0.5 block truncate text-[12px] text-text-muted">{f.description}</span>
                        )}
                      </span>
                      <span className="flex items-center gap-2">
                        {f.link && (
                          <a
                            href={f.link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-text-muted transition-colors hover:text-text-primary"
                            aria-label={t('portfolio.voirLien')}
                          >
                            <ExternalLink size={13} strokeWidth={1.9} />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => void remove('portfolioItems', f.id)}
                          aria-label={t('portfolio.supprimer')}
                          title={t('portfolio.supprimer')}
                          className="text-text-muted opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100"
                        >
                          <Trash2 size={13} strokeWidth={1.9} />
                        </button>
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="py-3 text-[13.5px] leading-[1.7] text-text-secondary">
                  Rien n’est encore retenu. Entourez une vue sur la planche pour qu’elle paraisse.
                </p>
              )}
            </section>

            <section className="panel flex flex-col px-5 pb-[18px] pt-5">
              <span className="eyebrow mb-5 text-text-secondary">La planche</span>
              <dl className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[13px] text-text-secondary">Vues</dt>
                  <dd className="tnum font-mono text-[19px] font-semibold text-text-primary">{fiches.length}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-[13px] text-text-secondary">Retenues</dt>
                  <dd className="tnum font-mono text-[19px] font-semibold text-text-primary">{retenues.length}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-border pt-3">
                  <dt className="text-[13px] text-text-secondary">Indécises</dt>
                  <dd className="tnum font-mono text-[19px] font-semibold text-text-secondary">{indecises.length}</dd>
                </div>
              </dl>
              <p className="mt-4 text-[13px] leading-[1.6] text-text-muted [text-wrap:pretty]">
                Une indécise n’est pas un retard : c’est une vue qu’on n’a pas su classer, et qui
                mérite qu’on y revienne.
              </p>
            </section>
          </motion.div>
        </>
      )}
    </motion.section>
  );
}
