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
/**
 * LE PESON — l'objet dominant des Avis (système de design, `23a`)
 * ══════════════════════════════════════════════════════════════
 *
 * La note moyenne est suspendue à un ressort, et l'aiguille se lit sur une
 * échelle verticale graduée de 5 en haut à 1 en bas.
 *
 * CE QUE L'INSTRUMENT MONTRE ET QU'UNE MOYENNE CACHE. Une moyenne de 4,6 sur
 * cinq avis et une moyenne de 4,6 sur deux cents avis s'écrivent pareil et ne
 * valent pas la même chose. Le peson le dit avec sa mécanique : quelques
 * mesures font un ressort nerveux, et l'écran chiffre la nervosité — combien
 * l'aiguille monterait si le seul avis à une étoile disparaissait, et combien
 * d'avis excellents il faudrait pour obtenir le même déplacement.
 *
 * LA RÈGLE DE GÉOMÉTRIE : la position de l'aiguille se DÉDUIT de la moyenne
 * réelle sur l'échelle 1–5, jamais posée. `pct = (5 − moyenne) / 4` donne sa
 * descente depuis le haut ; une aiguille placée à la main sur une moyenne
 * calculée est exactement le défaut que l'instrument existe pour interdire.
 */
const PESON_H = 260;
const PESON_HAUT = 5;
const PESON_BAS = 1;

/** La descente de l'aiguille, en pourcentage de l'échelle. */
function descenteAiguille(moyenne: number): number {
  const borne = Math.max(PESON_BAS, Math.min(PESON_HAUT, moyenne));
  return ((PESON_HAUT - borne) / (PESON_HAUT - PESON_BAS)) * 100;
}

/**
 * Le ressort : sept boucles entre le crochet du haut et l'aiguille.
 *
 * Tracé dans un `viewBox` de 40 × 100 étiré à la hauteur réelle du ressort,
 * avec `vector-effect="non-scaling-stroke"` pour que le fil garde son
 * épaisseur quelle que soit l'extension — un ressort dont le fil s'épaissit
 * en s'étirant ne ressemble à rien.
 */
function cheminRessort(boucles: number): string {
  const pas = 100 / boucles;
  let d = 'M20 0';
  for (let i = 0; i < boucles; i += 1) {
    const y = i * pas;
    d += ` C2 ${(y + pas * 0.25).toFixed(2)} 2 ${(y + pas * 0.75).toFixed(2)} 20 ${(y + pas).toFixed(2)}`;
    d += ` C38 ${(y + pas * 1.25).toFixed(2)} 38 ${(y + pas * 1.75).toFixed(2)} 20 ${(y + pas * 2).toFixed(2)}`;
    i += 1;
  }
  return d;
}

function Peson({
  moyenne,
  distribution,
  total,
}: {
  moyenne: number;
  distribution: number[];
  total: number;
}) {
  const descente = descenteAiguille(moyenne);
  /* La longueur du ressort suit l'aiguille : il s'étire quand la note baisse. */
  const ressortH = Math.max(28, (descente / 100) * (PESON_H - 46) + 24);

  /*
    LA NERVOSITÉ, CHIFFRÉE. Deux mesures, et elles se calculent toutes les deux
    sur les vrais avis — c'est ce qui distingue une remarque d'une démonstration.
  */
  const nbUneEtoile = distribution[0] ?? 0;
  const somme = distribution.reduce((n, c, i) => n + c * (i + 1), 0);
  const sansUneEtoile =
    total - nbUneEtoile > 0 ? (somme - nbUneEtoile * 1) / (total - nbUneEtoile) : null;
  /* Combien d'avis à cinq étoiles pour atteindre la même moyenne, en gardant
     l'avis à une étoile. On résout (somme + 5n) / (total + n) = cible. */
  const combienDeCinq =
    sansUneEtoile !== null && sansUneEtoile < 5
      ? Math.ceil((sansUneEtoile * total - somme) / (5 - sansUneEtoile))
      : null;

  return (
    <section className="panel-raised panel-raised-wide px-[30px] pb-[26px] pt-[30px]">
      <div className="mb-[26px] flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <span className="eyebrow text-text-secondary">Ce que la moyenne cache</span>
        <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">
          {total} AVIS RECUEILLI{total > 1 ? 'S' : ''}
        </span>
      </div>

      <div className="flex flex-wrap items-start gap-x-10 gap-y-7">
        {/* LE PESON. */}
        <div className="flex flex-none gap-5">
          {/* L'échelle, graduée de 5 en haut à 1 en bas. */}
          <div className="relative w-[34px]" style={{ height: `${PESON_H}px` }}>
            {[5, 4, 3, 2, 1].map((n) => (
              <span
                key={n}
                className="absolute right-0 flex items-center gap-2"
                style={{ top: `${descenteAiguille(n)}%`, transform: 'translateY(-50%)' }}
              >
                <span className="tnum font-mono text-[10px] text-text-muted">{n}</span>
                <span className="block h-px w-2.5 bg-border-section" />
              </span>
            ))}
          </div>

          <div className="relative w-[120px]" style={{ height: `${PESON_H}px` }}>
            {/* Le crochet de suspension. */}
            <span className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-border-strong" />

            {/* Le ressort, sept boucles. */}
            <svg
              viewBox="0 0 40 100"
              preserveAspectRatio="none"
              className="absolute left-1/2 top-3 w-[40px] -translate-x-1/2"
              style={{ height: `${ressortH}px` }}
              fill="none"
              aria-hidden
            >
              <path
                d={cheminRessort(7)}
                stroke="var(--color-border-strong)"
                strokeWidth={1.6}
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/* L'AIGUILLE — le seul ambre de l'écran : sa barre et sa plaque
                de valeur. Deux nœuds, une seule position. */}
            <span
              data-signal-groupe="aiguille"
              className="absolute left-0 h-[3px] w-full bg-signal"
              style={{ top: `${descente}%` }}
            />
            <span
              data-signal-groupe="aiguille"
              className="tnum absolute right-0 -translate-y-1/2 translate-x-[calc(100%+10px)] bg-signal px-2.5 py-1 font-mono text-[15px] font-bold text-signal-ink"
              style={{ top: `${descente}%` }}
            >
              {moyenne.toFixed(1).replace('.', ',')}
            </span>
          </div>
        </div>

        {/* LA DISTRIBUTION, et l'effet chiffré. */}
        <div className="min-w-[280px] flex-1">
          <span className="eyebrow block text-text-secondary">La distribution</span>
          <ul className="mt-4 flex flex-col gap-2">
            {[5, 4, 3, 2, 1].map((n) => {
              const compte = distribution[n - 1] ?? 0;
              const plafond = Math.max(1, ...distribution);
              return (
                <li key={n} className="grid grid-cols-[18px_1fr_28px] items-center gap-3">
                  <span className="tnum font-mono text-[11px] text-text-muted">{n}</span>
                  <span className="h-2.5 bg-[#191919]">
                    <span
                      className="block h-2.5 bg-border-strong"
                      style={{ width: `${(compte / plafond) * 100}%` }}
                    />
                  </span>
                  <span className="tnum text-right font-mono text-[12px] text-text-secondary">{compte}</span>
                </li>
              );
            })}
          </ul>

          {sansUneEtoile !== null && nbUneEtoile > 0 && (
            <p className="mt-5 border-t border-border-raised pt-5 text-[13.5px] leading-[1.6] text-text-secondary [text-wrap:pretty]">
              Sans {nbUneEtoile === 1 ? 'l’avis' : `les ${nbUneEtoile} avis`} à une étoile, la moyenne
              serait de <strong className="font-semibold text-text-primary">
                {sansUneEtoile.toFixed(1).replace('.', ',')}
              </strong>
              {combienDeCinq !== null && combienDeCinq > 0 && (
                <>
                  {' '}— il faudrait{' '}
                  <strong className="font-semibold text-text-primary">{combienDeCinq} avis excellents</strong>{' '}
                  pour obtenir le même déplacement. Une moyenne calculée sur peu d’avis bouge
                  beaucoup&nbsp;; c’est ce que le ressort montre et qu’un chiffre seul tait.
                </>
              )}
            </p>
          )}
          {nbUneEtoile === 0 && total > 0 && (
            <p className="mt-5 border-t border-border-raised pt-5 text-[13.5px] leading-[1.6] text-text-secondary [text-wrap:pretty]">
              Aucun avis sous deux étoiles. Le ressort est court&nbsp;: un seul avis sévère ferait
              descendre l’aiguille de{' '}
              <strong className="font-semibold text-text-primary">
                {(moyenne - (distribution.reduce((n, c, i) => n + c * (i + 1), 0) + 1) / (total + 1))
                  .toFixed(1)
                  .replace('.', ',')}
              </strong>{' '}
              point.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

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
  /* La distribution, index 0 = une étoile. C'est elle qui fait le ressort. */
  const distribution = useMemo(() => {
    const d = [0, 0, 0, 0, 0];
    for (const a of avis) {
      const n = Math.max(1, Math.min(5, Math.round(a.rating)));
      d[n - 1] += 1;
    }
    return d;
  }, [avis]);

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

      {/* ── L'OBJET DOMINANT : le peson ────────────────────────────────── */}
      {avis.length > 0 && (
        <motion.div variants={staggerItem}>
          <Peson moyenne={moyenne} distribution={distribution} total={avis.length} />
        </motion.div>
      )}

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
