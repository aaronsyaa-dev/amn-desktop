import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { formatCents } from '../lib/money';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface Composant {
  label: string;
  quantity: number;
  unit: string;
  unitCostCents: number;
}
interface BomData {
  product: string;
  components: Composant[];
  sellPriceCents: number | null;
  createdAt: string;
}

const nombre = (s: string) => Number(String(s ?? '').trim().replace(',', '.')) || 0;
/**
 * « Pommes, 1, kg, 2,50 » → un composant. Le point-virgule sépare aussi, et
 * la virgule décimale française est comprise : si le coût final arrive en
 * deux morceaux (« 2 » et « 50 »), on le recolle.
 */
function lireComposant(ligne: string): Composant | null {
  const morceaux = (ligne.includes(';') ? ligne.split(';') : ligne.split(',')).map((p) => p.trim()).filter(Boolean);
  if (morceaux.length === 5 && /^\d+$/.test(morceaux[3]) && /^\d+$/.test(morceaux[4])) {
    morceaux.splice(3, 2, `${morceaux[3]}.${morceaux[4]}`);
  }
  const [label, quantity, unit, cost] = morceaux;
  if (!label) return null;
  return { label, quantity: nombre(quantity ?? '1') || 1, unit: unit ?? '', unitCostCents: Math.round(nombre(cost ?? '0') * 100) };
}
const cout = (b: BomData) => b.components.reduce((n, c) => n + Math.round(c.quantity * c.unitCostCents), 0);
/** La marge, ou `null` quand le prix de vente n'est pas connu — jamais zéro. */
const margeDe = (b: BomData) => (b.sellPriceCents && b.sellPriceCents > 0 ? b.sellPriceCents - cout(b) : null);
/** Vendu à perte : prix de vente connu ET inférieur au prix de revient. */
const perteDe = (b: BomData) => {
  const m = margeDe(b);
  return m !== null && m < 0;
};

/**
 * LES NOMENCLATURES — ce qui compose un produit, et ce qu'il coûte.
 *
 * Pour qui : une pâtisserie, un atelier, une créatrice qui calcule son prix
 * de revient une fois sur un coin de table, puis voit les prix des
 * composants bouger sans rien recalculer. Ce que ça règle : la liste des
 * composants avec quantité et coût unitaire ; le prix de revient et la marge
 * se recalculent seuls, et « marge » n'apparaît que si le prix de vente est
 * connu — jamais un chiffre par défaut.
 *
 * ## Ce qui domine : ce qui se vend à perte
 *
 * L'écran posait une carte par produit, chacune avec ses composants et un
 * tableau de trois chiffres en 12 px. Une marge NÉGATIVE — vendre à perte sans
 * le savoir, le seul vrai défaut qu'une nomenclature puisse porter — s'y
 * lisait dans un chiffre rouge de la même taille que les deux autres, au bas
 * d'une carte parmi d'autres.
 *
 * Elle passe en tête, nommée. Et les marges deviennent des BARRES : la barre
 * va du prix de revient au prix de vente, donc une marge mince se voit sans
 * lire un pourcentage. Les composants descendent dans un dépliant : on les
 * consulte quand on cherche quoi couper, pas à chaque ouverture.
 *
 * ## L'écart avec l'entonnoir des Prospects
 *
 * Les deux écrans ont des barres d'argent, et ce n'est pas la même barre.
 * L'entonnoir compare des ÉTAPES entre elles, sur une échelle commune. Ici
 * chaque barre est une seule affaire lue de bout en bout : un segment de
 * revient, un segment de marge, mis à l'échelle du produit le plus cher. On
 * n'y compare pas des colonnes, on y lit une soustraction.
 *
 * ## L'ambre
 *
 * Sur les produits à perte. Un produit sans prix de vente n'est pas un défaut
 * — c'est une location, un devis en cours, un travail au temps passé ; le
 * fichier disait déjà que « marge » ne doit jamais inventer un chiffre, et il
 * ne doit pas davantage inventer un reproche.
 */
export function BomScreen() {
  const { t } = useLangue();
  const { upsert, remove } = useSync();
  const brutes = useCollection<BomData>('boms');
  const [ouvert, setOuvert] = useState(false);
  const [product, setProduct] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [lignes, setLignes] = useState('');

  const [recherche, setRecherche] = useState('');
  const [deplie, setDeplie] = useState<string | null>(null);

  /* Les pertes d'abord, puis l'alphabet — comme les silencieux des
     Fournisseurs : dans un registre, le défaut remonte, le reste se parcourt. */
  const produits = useMemo(
    () =>
      [...brutes].sort((a, b) => {
        const pa = perteDe(a);
        const pb = perteDe(b);
        if (pa !== pb) return pa ? -1 : 1;
        return a.product.localeCompare(b.product, 'fr');
      }),
    [brutes],
  );
  const composants = produits.reduce((n, b) => n + b.components.length, 0);
  const aPerte = produits.filter(perteDe);
  /* « 4 composant(s) » ne se lit dans aucune des deux langues — même
     correction que « vote(s) » et « jour(s) » ailleurs dans ce chantier. */
  const ditLesComposants = (n: number) => (n === 1 ? t('nomenclatures.composantUn') : t('nomenclatures.composant', { n }));
  const q = recherche.trim().toLowerCase();
  const trouves = q ? produits.filter((b) => b.product.toLowerCase().includes(q)) : produits;
  /* Le plus cher donne l'échelle commune des barres. */
  const plafond = Math.max(1, ...produits.map((b) => Math.max(cout(b), b.sellPriceCents ?? 0)));
  const avecPrix = produits.filter((b) => b.sellPriceCents && b.sellPriceCents > 0);
  const margeMoyenne = avecPrix.length > 0
    ? Math.round(avecPrix.reduce((n, b) => n + ((b.sellPriceCents ?? 0) - cout(b)) / (b.sellPriceCents ?? 1), 0) / avecPrix.length * 100)
    : null;

  const ajouter = async () => {
    const comps = lignes.split('\n').map(lireComposant).filter((c): c is Composant => Boolean(c));
    if (!product.trim() || comps.length === 0) return;
    const prix = sellPrice.trim() === '' ? null : Math.round(nombre(sellPrice) * 100);
    await upsert('boms', uid('bom'), { product: product.trim(), components: comps, sellPriceCents: prix, createdAt: new Date().toISOString() });
    setProduct(''); setSellPrice(''); setLignes(''); setOuvert(false);
  };

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('production.surtitre', { module: t('nomenclatures.titre') })}
          title={t('nomenclatures.titre')}
          description={t('nomenclatures.description')}
          stats={[
            { label: t('nomenclatures.stat.produits'), value: produits.length },
            { label: t('nomenclatures.stat.composants'), value: composants },
            { label: t('nomenclatures.stat.margeMoyenne'), value: margeMoyenne === null ? '—' : `${margeMoyenne} %`, title: t('nomenclatures.stat.margeMoyenneTitre') },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('nomenclatures.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void ajouter(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
          <input value={product} onChange={(e) => setProduct(e.target.value)} placeholder={t('nomenclatures.champProduit')} aria-label={t('nomenclatures.champProduit')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} inputMode="decimal" placeholder={t('nomenclatures.champPrixVente')} aria-label={t('nomenclatures.champPrixVente')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <textarea value={lignes} onChange={(e) => setLignes(e.target.value)} rows={4} placeholder={t('nomenclatures.champComposants')} aria-label={t('nomenclatures.champComposants')} className="input-focus border border-border bg-bg px-3 py-2 font-mono text-sm text-text-primary outline-none sm:col-span-2" />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={!product.trim() || !lignes.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('nomenclatures.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {produits.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('nomenclatures.vide.titre')} action={{ label: t('nomenclatures.vide.action'), onClick: () => setOuvert(true) }}>{t('nomenclatures.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <>
          {/* CE QUI SE VEND À PERTE — l'objet dominant. */}
          <motion.section variants={staggerItem} className="panel-raised p-5 sm:p-6" data-signal-groupe="a-perte">
            {aPerte.length > 0 ? (
              <>
                <p className="signal-plate mb-3 inline-flex px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider">{t('nomenclatures.perte')}</p>
                <p className="text-[21px] font-semibold leading-tight text-text-primary sm:text-[27px]">
                  {aPerte.length === 1
                    ? t('nomenclatures.aPerteUn', { produit: aPerte[0].product })
                    : t('nomenclatures.aPerteN', { n: aPerte.length })}
                </p>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">{t('nomenclatures.aPerteAide')}</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {aPerte.map((b) => (
                    <li key={b.id} className="flex items-center gap-2 border border-border-strong px-3 py-2">
                      <span className="text-sm text-text-primary">{b.product}</span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-danger tabular-nums">{formatCents(margeDe(b) ?? 0)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <p className="eyebrow mb-3">{t('nomenclatures.marge')}</p>
                <p className="text-[21px] font-semibold leading-tight text-text-primary sm:text-[27px]">{t('nomenclatures.toutesPositives')}</p>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">{t('nomenclatures.toutesPositivesAide')}</p>
              </>
            )}
          </motion.section>

          {/* LES BARRES — du prix de revient au prix de vente. Voir l'en-tête
              du fichier pour l'écart avec l'entonnoir des Prospects. */}
          <motion.section variants={staggerItem} className="panel">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
              <p className="eyebrow">{t('nomenclatures.laMarge')}</p>
              <input
                type="search"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder={t('nomenclatures.champProduit')}
                aria-label={t('nomenclatures.champProduit')}
                className="input-focus min-h-11 w-full max-w-xs border border-border bg-bg px-3 text-sm text-text-primary outline-none md:min-h-0 md:py-2"
              />
            </div>
            <p className="px-4 pt-3 text-[11px] text-text-muted">{t('nomenclatures.laMargeAide')}</p>
            <ul className="flex flex-col gap-px bg-border">
              {trouves.map((b) => {
                const revient = cout(b);
                const marge = margeDe(b);
                const vente = b.sellPriceCents ?? 0;
                /* L'échelle est celle du produit le plus cher du registre : deux
                   barres ne se comparent que sur une même règle. */
                const partRevient = Math.min(100, Math.round((revient / plafond) * 100));
                const partMarge = marge !== null && marge > 0 ? Math.min(100 - partRevient, Math.round((marge / plafond) * 100)) : 0;
                return (
                  <li key={b.id} className="group bg-surface px-4 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="min-w-0 flex-1">
                        <span className="text-sm text-text-primary">{b.product}</span>
                        <button
                          type="button"
                          onClick={() => setDeplie(deplie === b.id ? null : b.id)}
                          className="ml-3 font-mono text-[10px] uppercase tracking-wider text-text-muted hover:text-text-primary"
                        >
                          {ditLesComposants(b.components.length)}
                        </button>
                      </span>
                      <span className="flex flex-shrink-0 items-baseline gap-4 text-sm tabular-nums">
                        <span className="text-text-secondary">{formatCents(revient)}</span>
                        <span className="text-text-primary">{vente ? formatCents(vente) : '—'}</span>
                        <span className={`w-24 text-right ${marge === null ? 'text-text-muted' : marge < 0 ? 'text-danger' : 'text-success'}`}>
                          {marge === null ? t('nomenclatures.sansPrixDeVente') : formatCents(marge)}
                        </span>
                      </span>
                      <button type="button" onClick={() => void remove('boms', b.id)} aria-label={t('nomenclatures.supprimer')} title={t('nomenclatures.supprimer')} className="min-h-11 flex-shrink-0 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
                    </div>

                    <div className="mt-2 flex h-2.5 w-full overflow-hidden border border-border" aria-hidden>
                      <span className="bg-border-strong" style={{ width: `${partRevient}%` }} />
                      {partMarge > 0 && <span className="bg-success/40" style={{ width: `${partMarge}%` }} />}
                    </div>

                    {deplie === b.id && (
                      <ul className="mt-3 flex flex-col divide-y divide-border border-t border-border text-xs">
                        {b.components.map((c, i) => (
                          <li key={`${c.label}-${i}`} className="flex items-center justify-between gap-2 py-1.5">
                            <span className="min-w-0 truncate text-text-secondary">
                              {c.label} <span className="tnum text-text-muted">× {c.quantity}{c.unit ? ` ${c.unit}` : ''}</span>
                            </span>
                            <span className="tnum text-text-primary">{formatCents(Math.round(c.quantity * c.unitCostCents))}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </motion.section>
        </>
      )}
    </motion.section>
  );
}
