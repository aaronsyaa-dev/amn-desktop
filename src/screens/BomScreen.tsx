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

/**
 * LES NOMENCLATURES — ce qui compose un produit, et ce qu'il coûte.
 *
 * Pour qui : une pâtisserie, un atelier, une créatrice qui calcule son prix
 * de revient une fois sur un coin de table, puis voit les prix des
 * composants bouger sans rien recalculer. Ce que ça règle : la liste des
 * composants avec quantité et coût unitaire ; le prix de revient et la marge
 * se recalculent seuls, et « marge » n'apparaît que si le prix de vente est
 * connu — jamais un chiffre par défaut.
 */
export function BomScreen() {
  const { t } = useLangue();
  const { upsert, remove } = useSync();
  const brutes = useCollection<BomData>('boms');
  const [ouvert, setOuvert] = useState(false);
  const [product, setProduct] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [lignes, setLignes] = useState('');

  const produits = useMemo(() => [...brutes].sort((a, b) => a.product.localeCompare(b.product)), [brutes]);
  const composants = produits.reduce((n, b) => n + b.components.length, 0);
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
        <motion.div variants={staggerItem} className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(18rem,1fr))]">
          {produits.map((b) => {
            const revient = cout(b);
            const marge = b.sellPriceCents && b.sellPriceCents > 0 ? b.sellPriceCents - revient : null;
            return (
              <article key={b.id} className="group flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">{b.product}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t('nomenclatures.composant', { n: b.components.length })}</p>
                  </div>
                  <button type="button" onClick={() => void remove('boms', b.id)} aria-label={t('nomenclatures.supprimer')} title={t('nomenclatures.supprimer')} className="min-h-11 px-1 text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100 md:min-h-0"><Trash2 size={13} /></button>
                </div>
                <ul className="flex flex-col divide-y divide-border text-xs">
                  {b.components.map((c, i) => (
                    <li key={`${c.label}-${i}`} className="flex items-center justify-between gap-2 py-1">
                      <span className="min-w-0 truncate text-text-secondary">{c.label} <span className="tnum text-text-muted">× {c.quantity}{c.unit ? ` ${c.unit}` : ''}</span></span>
                      <span className="tnum text-text-primary">{formatCents(Math.round(c.quantity * c.unitCostCents))}</span>
                    </li>
                  ))}
                </ul>
                <dl className="mt-1 grid grid-cols-3 gap-2 border-t border-border pt-2 text-xs">
                  <div><dt className="eyebrow">{t('nomenclatures.coutRevient')}</dt><dd className="tnum text-sm font-medium text-text-primary">{formatCents(revient)}</dd></div>
                  <div><dt className="eyebrow">{t('nomenclatures.prixVente')}</dt><dd className="tnum text-sm font-medium text-text-primary">{b.sellPriceCents ? formatCents(b.sellPriceCents) : '—'}</dd></div>
                  <div><dt className="eyebrow">{t('nomenclatures.marge')}</dt><dd className={`tnum text-sm font-medium ${marge === null ? 'text-text-muted' : marge < 0 ? 'text-danger' : 'text-success'}`}>{marge === null ? '—' : formatCents(marge)}</dd></div>
                </dl>
                {marge === null && <p className="text-[11px] text-text-muted">{t('nomenclatures.sansPrix')}</p>}
              </article>
            );
          })}
        </motion.div>
      )}
    </motion.section>
  );
}
