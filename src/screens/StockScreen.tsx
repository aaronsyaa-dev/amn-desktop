import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';

interface StockItemData {
  name: string;
  unit: string;
  quantity: number;
  minQuantity: number | null;
  createdAt: string;
  movedAt: string;
}

/**
 * LE STOCK — ce qu'il reste, et ce qui va manquer.
 *
 * Pour qui : une boutique, un atelier, un traiteur qui découvre la rupture le
 * jour où il en a besoin. Ce que ça règle : une quantité et un seuil par
 * article ; la liste « à commander » se fait toute seule dès qu'une quantité
 * passe sous son seuil. Pas de valorisation ni de lots : ce serait un
 * logiciel de gestion d'entrepôt, et personne ici n'en tient un.
 */
export function StockScreen() {
  const { t } = useLangue();
  const { upsert, remove } = useSync();
  const brutes = useCollection<StockItemData>('stockItems');
  const [ouvert, setOuvert] = useState(false);
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [quantity, setQuantity] = useState('');
  const [minQuantity, setMinQuantity] = useState('');

  const articles = useMemo(() => [...brutes].sort((a, b) => a.name.localeCompare(b.name)), [brutes]);
  const sousSeuil = articles.filter((a) => a.minQuantity !== null && a.quantity <= a.minQuantity);
  const sansSeuil = articles.filter((a) => a.minQuantity === null).length;
  const nombre = (s: string) => Number(s.replace(',', '.'));

  const ajouter = async () => {
    if (!name.trim()) return;
    const now = new Date().toISOString();
    const seuil = minQuantity.trim() === '' ? null : Math.max(0, nombre(minQuantity) || 0);
    await upsert('stockItems', uid('stk'), { name: name.trim(), unit: unit.trim(), quantity: Math.max(0, nombre(quantity) || 0), minQuantity: seuil, createdAt: now, movedAt: now });
    setName(''); setUnit(''); setQuantity(''); setMinQuantity(''); setOuvert(false);
  };
  const bouger = (a: StockItemData & { id: string }, delta: number) =>
    upsert('stockItems', a.id, { ...a, quantity: Math.max(0, a.quantity + delta), movedAt: new Date().toISOString() });
  const quantite = (a: StockItemData) => `${a.quantity}${a.unit ? ` ${a.unit}` : ''}`;

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('production.surtitre', { module: t('stock.titre') })}
          title={t('stock.titre')}
          description={t('stock.description')}
          stats={[
            { label: t('stock.stat.articles'), value: articles.length },
            { label: t('stock.stat.aCommander'), value: sousSeuil.length, emphasis: sousSeuil.length > 0 },
            { label: t('stock.stat.sansSeuil'), value: sansSeuil },
          ]}
          actions={
            <button type="button" onClick={() => setOuvert((v) => !v)} className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover">
              <Plus size={16} strokeWidth={2} /> {t('stock.ajouter')}
            </button>
          }
        />
      </motion.div>

      {ouvert && (
        <motion.form variants={staggerItem} onSubmit={(e) => { e.preventDefault(); void ajouter(); }} className="grid gap-3 rounded-xl border border-border bg-surface p-4 sm:grid-cols-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('stock.champNom')} aria-label={t('stock.champNom')} autoFocus className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={t('stock.champUnite')} aria-label={t('stock.champUnite')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" placeholder={t('stock.champQuantite')} aria-label={t('stock.champQuantite')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <input value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} inputMode="decimal" placeholder={t('stock.champSeuil')} aria-label={t('stock.champSeuil')} className="input-focus min-h-11 border border-border bg-bg px-3 text-sm text-text-primary outline-none" />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={!name.trim()} className="bg-accent px-4 py-2 text-sm font-semibold text-bg disabled:opacity-40">{t('stock.enregistrer')}</button>
            <button type="button" onClick={() => setOuvert(false)} className="border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">{t('chrome.fermer')}</button>
          </div>
        </motion.form>
      )}

      {articles.length === 0 && !ouvert ? (
        <motion.div variants={staggerItem}>
          <FirstRun title={t('stock.vide.titre')} action={{ label: t('stock.vide.action'), onClick: () => setOuvert(true) }}>{t('stock.vide.texte')}</FirstRun>
        </motion.div>
      ) : (
        <>
          <motion.section variants={staggerItem} aria-label={t('stock.aCommanderTitre')} className={`rounded-xl border p-4 ${sousSeuil.length > 0 ? 'border-warning/40 bg-warning/5' : 'border-border bg-surface'}`}>
            <p className="eyebrow mb-2">{t('stock.aCommanderTitre')}</p>
            {sousSeuil.length === 0 ? (
              <p className="text-sm text-text-secondary">{t('stock.rienACommander')}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {sousSeuil.map((a) => (
                  <li key={a.id} className="rounded-lg border border-warning/40 bg-bg px-3 py-1.5 text-sm text-text-primary">
                    {a.name} <span className="tnum text-text-muted">· {quantite(a)} · {t('stock.seuil', { n: a.minQuantity ?? 0 })}</span>
                  </li>
                ))}
              </ul>
            )}
          </motion.section>

          <motion.ul variants={staggerItem} className="flex flex-col gap-2">
            {articles.map((a) => {
              const bas = a.minQuantity !== null && a.quantity <= a.minQuantity;
              return (
                <li key={a.id} className={`group flex flex-wrap items-center gap-3 rounded-xl border bg-surface p-3 ${bas ? 'border-warning/40' : 'border-border'}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">{a.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {a.minQuantity !== null ? t('stock.seuil', { n: a.minQuantity }) : t('stock.sansSeuilLigne')} · {relativeTime(a.movedAt)}
                    </p>
                  </div>
                  <p className={`tnum text-lg font-medium ${bas ? 'text-warning' : 'text-text-primary'}`}>{quantite(a)}</p>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => void bouger(a, -1)} aria-label={t('stock.moins')} title={t('stock.moins')} className="flex min-h-11 min-w-11 items-center justify-center border border-border text-text-secondary hover:text-text-primary"><Minus size={14} /></button>
                    <button type="button" onClick={() => void bouger(a, 1)} aria-label={t('stock.plus')} title={t('stock.plus')} className="flex min-h-11 min-w-11 items-center justify-center border border-border-strong text-text-primary hover:bg-surface-hover"><Plus size={14} /></button>
                    <button type="button" onClick={() => void remove('stockItems', a.id)} aria-label={t('stock.supprimer')} title={t('stock.supprimer')} className="flex min-h-11 min-w-11 items-center justify-center text-text-muted opacity-0 hover:text-danger focus:opacity-100 group-hover:opacity-100"><Trash2 size={13} /></button>
                  </div>
                </li>
              );
            })}
          </motion.ul>
        </>
      )}
    </motion.section>
  );
}
