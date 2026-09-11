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

  return (
    <motion.section variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-5">
      <motion.div variants={staggerItem}>
        <ScreenHeader
          eyebrow={t('production.surtitre', { module: t('stock.titre') })}
          /*
            LE TITRE COMPTE (6b). « Stock » est déjà dans la barre latérale et
            dans le surtitre ; ce que l'écran doit dire en 32 px, c'est combien
            d'articles demandent une commande aujourd'hui. Quand rien ne manque,
            il le dit aussi — c'est une bonne nouvelle, elle vaut d'être lue.
          */
          title={
            sousSeuil.length === 0
              ? t('stock.titreRienACommander')
              : sousSeuil.length === 1
                ? t('stock.titreACommanderUn')
                : t('stock.titreACommander', { n: sousSeuil.length })
          }
          description={sousSeuil.length > 0 ? t('stock.sousLeurSeuil') : t('stock.description')}
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
          {/*
            LE BON DE COMMANDE — l'objet dominant de cet écran (6b).

            Ce qui manque ne se cherche pas dans une liste : ça se lit en haut,
            nommé et chiffré, prêt à être recopié chez le fournisseur. La liste
            entière reste dessous pour le reste du travail. La plaque ambre est
            le seul ambre de l'écran, et elle ne s'allume que s'il y a vraiment
            quelque chose à commander — c'est une décision, pas un état.
          */}
          {sousSeuil.length > 0 && (
            <motion.section variants={staggerItem} aria-label={t('stock.aCommanderTitre')} className="panel-raised panel-raised-wide">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-raised px-5 py-3.5">
                <span className="signal-plate px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em]">
                  {t('stock.aCommanderPlaque', { n: sousSeuil.length })}
                </span>
                <p className="eyebrow text-text-muted">{t('stock.listeAutomatique')}</p>
              </header>
              <div className="grid gap-px bg-border-raised sm:grid-cols-2 lg:grid-cols-3">
                {sousSeuil.map((a) => {
                  const manque = Math.max(0, (a.minQuantity ?? 0) - a.quantity);
                  return (
                    <div key={a.id} className="flex flex-col gap-2 bg-elevated p-5">
                      <p className="truncate text-[16px] font-semibold text-text-primary">{a.name}</p>
                      <p className="flex items-baseline gap-2">
                        <span className="tnum font-mono text-[27px] font-bold leading-none tracking-[-0.03em] text-text-primary">
                          {a.quantity}
                        </span>
                        {a.unit && <span className="text-[13px] text-text-secondary">{a.unit}</span>}
                      </p>
                      <p className="eyebrow text-text-muted">
                        {a.quantity === 0
                          ? t('stock.rupture', { seuil: a.minQuantity ?? 0 })
                          : t('stock.ilManque', { seuil: a.minQuantity ?? 0, n: manque })}
                      </p>
                    </div>
                  );
                })}
              </div>
            </motion.section>
          )}

          {/* ── Le registre : une jauge par article, le seuil marqué ───────── */}
          <motion.div variants={staggerItem}>
            <div className="mb-1 hidden grid-cols-[minmax(0,1fr)_minmax(0,260px)_minmax(0,140px)_auto] gap-4 border-b border-border-section pb-2 md:grid">
              <p className="eyebrow">{t('stock.colArticle')}</p>
              <p className="eyebrow">{t('stock.colJauge')}</p>
              <p className="eyebrow">{t('stock.colMouvement')}</p>
              <p className="eyebrow text-right">{t('stock.colGeste')}</p>
            </div>
            <ul className="flex flex-col">
              {articles.map((a) => {
                const bas = a.minQuantity !== null && a.quantity <= a.minQuantity;
                /*
                  LA JAUGE — remplie sur DEUX FOIS le seuil, pour que le seuil
                  tombe au milieu et se lise comme un repère, pas comme une fin
                  de course. Sans seuil, pas de jauge : un article qu'on ne
                  surveille pas n'a pas d'échelle, et en inventer une ferait
                  croire à une alerte qui ne viendra jamais.
                */
                const seuil = a.minQuantity;
                const echelle = seuil !== null && seuil > 0 ? seuil * 2 : null;
                const part = echelle ? Math.min(100, (a.quantity / echelle) * 100) : null;
                return (
                  <li
                    key={a.id}
                    className="group grid grid-cols-1 items-center gap-3 border-b border-[#161616] py-3.5 md:grid-cols-[minmax(0,1fr)_minmax(0,260px)_minmax(0,140px)_auto] md:gap-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-text-primary">{a.name}</p>
                      <p className="tnum font-mono text-[10.5px] uppercase tracking-[0.12em] text-text-muted">
                        {a.quantity}
                        {a.unit ? ` ${a.unit}` : ''} ·{' '}
                        {seuil !== null ? t('stock.seuil', { n: seuil }) : t('stock.sansSeuilLigne')}
                      </p>
                    </div>
                    <div className="relative h-2.5 w-full bg-[#161616]" aria-hidden>
                      {part !== null ? (
                        <>
                          <span
                            className={`absolute inset-y-0 left-0 ${bas ? 'bg-[#4a4a48]' : 'bg-[#3a3a3a]'}`}
                            style={{ width: `${part}%` }}
                          />
                          {/* Le trait clair marque le seuil. */}
                          <span className="absolute inset-y-[-3px] w-px bg-text-secondary" style={{ left: '50%' }} />
                        </>
                      ) : (
                        <span className="absolute inset-0 border border-dashed border-[#2b2b2b]" />
                      )}
                    </div>
                    <p className="font-mono text-[11.5px] text-text-muted">{relativeTime(a.movedAt)}</p>
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => void bouger(a, -1)} aria-label={t('stock.moins')} title={t('stock.moins')} className="flex min-h-11 min-w-11 items-center justify-center border border-border text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"><Minus size={14} strokeWidth={2.1} /></button>
                      <button type="button" onClick={() => void bouger(a, 1)} aria-label={t('stock.plus')} title={t('stock.plus')} className="flex min-h-11 min-w-11 items-center justify-center border border-border-strong text-text-primary transition-colors hover:bg-surface-hover"><Plus size={14} strokeWidth={2.1} /></button>
                      <button type="button" onClick={() => void remove('stockItems', a.id)} aria-label={t('stock.supprimer')} title={t('stock.supprimer')} className="flex min-h-11 min-w-11 items-center justify-center text-text-muted opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100"><Trash2 size={13} strokeWidth={1.9} /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="eyebrow mt-3 leading-[1.7] text-text-muted">{t('stock.legendeJauge')}</p>
          </motion.div>
        </>
      )}
    </motion.section>
  );
}
