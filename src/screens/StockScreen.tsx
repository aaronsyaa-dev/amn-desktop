import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';
import { useHaloSignal } from '../components/EtatEcran';

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

  /* ------------------------------------- la batterie d'anneaux (`11b`) -- */

  const anneaux = useMemo(() => anneauxDeStock(articles), [articles]);
  /* La cible d'un réapprovisionnement : deux fois le seuil. Écrite ici, une
     fois, plutôt que recalculée dans le rendu — voir la note sur le
     conditionnement absent du modèle. */
  const totalACommander = useMemo(
    () => sousSeuil.reduce((n, a) => n + Math.max(0, (a.minQuantity ?? 0) * 2 - a.quantity), 0),
    [sousSeuil],
  );
  const derniersMouvements = useMemo(
    () => [...articles].sort((a, b) => (b.movedAt ?? '').localeCompare(a.movedAt ?? '')).slice(0, 5),
    [articles],
  );
  const halo = useHaloSignal(sousSeuil.length > 0);

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
          {/* ── LA BATTERIE D'ANNEAUX — l'objet dominant (`11b`) ─────────── */}
          {/*
            LE BON DE COMMANDE ÉTAIT LA DOMINANTE, ET IL DESCEND D'UN CRAN.

            Il reste — il est même l'action de l'écran, et il garde l'unique
            ambre — mais ce n'est pas lui l'objet : c'est L'ÉTAT DU STOCK. Le
            bon découle des anneaux, il ne les remplace pas, et un écran qui
            n'affichait que le bon ne disait rien des articles qui vont bien.
          */}
          {anneaux.length > 0 && (
            <motion.section
              variants={staggerItem}
              className="panel-raised panel-raised-wide panel-ticks px-6 py-6"
            >
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <p className="eyebrow">
                  {anneaux.length} article{anneaux.length > 1 ? 's' : ''} surveillé
                  {anneaux.length > 1 ? 's' : ''}
                </p>
                <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-text-muted">
                  plus l’anneau est vif, plus l’article est en danger
                </p>
              </div>

              <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {anneaux.map((a) => (
                  <div key={a.article.id} className="flex items-center gap-4">
                    <AnneauStock a={a} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-semibold text-text-primary">
                        {a.article.name}
                      </p>
                      <p className="tnum font-mono text-[17px] font-semibold leading-tight tracking-[-0.02em] text-text-primary">
                        {a.article.quantity}
                        <span className="text-text-muted"> / {a.article.minQuantity}</span>
                        {a.article.unit && (
                          <span className="ml-1 text-[11px] font-normal text-text-muted">
                            {a.article.unit}
                          </span>
                        )}
                      </p>
                      <p
                        className={`font-mono text-[9.5px] uppercase tracking-[0.14em] ${
                          a.verdict === 'rupture' ? 'text-danger' : 'text-text-muted'
                        }`}
                      >
                        {VERDICT_MOT[a.verdict]}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {sansSeuil > 0 && (
                <p className="mt-6 border-t border-border-row pt-3 text-[12.5px] leading-relaxed text-text-muted">
                  {sansSeuil} article{sansSeuil > 1 ? 's' : ''} sans seuil n’
                  {sansSeuil > 1 ? 'ont' : 'a'} pas d’anneau : un anneau est un RATIO, et sans
                  seuil il n’y a rien à diviser. {sansSeuil > 1 ? 'Ils figurent' : 'Il figure'} dans
                  le registre plus bas.
                </p>
              )}
            </motion.section>
          )}

          {/* ── Le bon de commande, en feuille, et les derniers mouvements ── */}
          <motion.div variants={staggerItem} className="grid items-start gap-4 lg:grid-cols-[1fr_300px]">
            {sousSeuil.length > 0 ? (
              <section aria-label={t('stock.aCommanderTitre')} className="panel-sheet">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border-sheet px-5 py-3.5">
                  {/*
                    L'UNIQUE AMBRE DE L'ÉCRAN — la plaque et son total. Il ne va
                    PAS aux anneaux : ceux-là sont un état. Il va au bon qui en
                    découle, c'est-à-dire à l'action.
                  */}
                  <span
                    className={`signal-plate px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] ${halo}`}
                    data-signal-groupe="a-commander"
                  >
                    {t('stock.aCommanderPlaque', { n: sousSeuil.length })}
                  </span>
                  <span
                    className="tnum font-mono text-[13px] font-semibold text-signal"
                    data-signal-groupe="a-commander"
                  >
                    {totalACommander} unités
                  </span>
                </header>
                <div className="px-5 py-4">
                  <p className="text-[13px] leading-relaxed text-text-secondary">
                    Le bon se compose tout seul des articles passés sous leur seuil. Les quantités
                    remontent chacune à DEUX FOIS son seuil — la marge qui évite de recommander la
                    semaine suivante.
                  </p>
                  <div className="mt-4 flex flex-col divide-y divide-border-row">
                    {sousSeuil.map((a) => {
                      const cible = (a.minQuantity ?? 0) * 2;
                      return (
                        <div key={a.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5">
                          <span className="min-w-0 flex-1 truncate text-[13.5px] text-text-primary">
                            {a.name}
                          </span>
                          <span className="tnum w-[92px] flex-shrink-0 text-right font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
                            {a.quantity} en stock
                          </span>
                          <span className="tnum w-[92px] flex-shrink-0 text-right font-mono text-[13px] font-semibold text-text-primary">
                            + {Math.max(0, cible - a.quantity)}
                            {a.unit ? ` ${a.unit}` : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/*
                    ÉCART DIT. `MODULES.md` veut les quantités « arrondies au
                    conditionnement du fournisseur ». Le produit ne garde PAS
                    de conditionnement : un article a un nom, une unité, une
                    quantité et un seuil, rien de plus. Arrondir à un carton de
                    douze inventerait un carton. La cible est donc le double du
                    seuil, qui est une règle écrite et vérifiable.
                  */}
                  <p className="mt-4 border-t border-border-sheet pt-3 text-[12.5px] leading-relaxed text-text-muted">
                    Les quantités ne sont pas arrondies à un conditionnement : le produit n’en garde
                    aucun. Un article a un nom, une unité, une quantité et un seuil — arrondir à un
                    carton de douze inventerait le carton.
                  </p>
                </div>
              </section>
            ) : (
              <section className="panel px-5 py-4">
                <p className="eyebrow mb-2">Rien à commander</p>
                <p className="text-[13px] leading-relaxed text-text-secondary">
                  Tous les articles surveillés sont au-dessus de leur seuil.
                </p>
              </section>
            )}

            <section className="panel flex flex-col px-5 py-4">
              <p className="eyebrow mb-3">Derniers mouvements</p>
              <div className="flex flex-col divide-y divide-border-row">
                {derniersMouvements.map((a) => (
                  <div key={a.id} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-text-secondary">
                      {a.name}
                    </span>
                    <span className="tnum flex-shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
                      {relativeTime(a.movedAt)}
                    </span>
                  </div>
                ))}
              </div>
              {/*
                ÉCART DIT. `MODULES.md` veut « les derniers mouvements avec leur
                ORIGINE et leur SIGNE ». Le produit garde `movedAt` — la DATE du
                dernier mouvement — et rien d'autre : ni journal, ni sens, ni
                provenance. Afficher « − 3 · sortie atelier » serait inventer
                une écriture qui n'existe nulle part.
              */}
              <p className="mt-4 border-t border-border-row pt-3 text-[12.5px] leading-relaxed text-text-muted">
                Le produit garde la DATE du dernier mouvement, pas son sens ni son origine : il n’y
                a pas de journal de stock. Afficher « − 3 · sortie atelier » inventerait une
                écriture.
              </p>
            </section>
          </motion.div>

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

/* ------------------------------------------ la batterie d'anneaux (`11b`) -- */

/**
 * LES ANNEAUX — l'objet dominant de Stock (`11b`).
 *
 * Un anneau par article surveillé, REMPLI AU RATIO stock ÷ seuil. La lecture
 * est INVERSÉE par rapport à l'habitude : plus l'anneau est vif, plus
 * l'article est en danger. L'encre claire signale, le gris sourd rassure.
 * C'est contre-intuitif une seconde, et juste ensuite — sur un mur d'anneaux,
 * ce sont les vifs qu'on doit voir, et ils sont rares.
 *
 * LA RÈGLE DE L'ANNEAU VIDE : un article en rupture doit rester identifiable
 * COMME UN ANNEAU — son cercle de fond reste visible, cerclé de rouge sombre,
 * avec un point rouge au centre. Sans le cercle de fond, ce n'est plus un
 * anneau vide, c'est un trou dans la grille, et l'œil le saute.
 */
const ANNEAU = 64;
const ANNEAU_EP = 7;
const ANNEAU_R = (ANNEAU - ANNEAU_EP) / 2;
const ANNEAU_C = 2 * Math.PI * ANNEAU_R;

type VerdictStock = 'rupture' | 'critique' | 'sous-seuil' | 'au-dessus' | 'sans-seuil';

interface AnneauDeStock {
  article: StockItemData & { id: string };
  ratio: number | null;
  verdict: VerdictStock;
  /** La teinte du trait : vive en danger, sourde au calme. */
  teinte: string;
}

function anneauxDeStock(articles: (StockItemData & { id: string })[]): AnneauDeStock[] {
  return articles
    .filter((a) => a.minQuantity !== null && a.minQuantity > 0)
    .map((a) => {
      const seuil = a.minQuantity as number;
      const ratio = a.quantity / seuil;
      const verdict: VerdictStock =
        a.quantity === 0
          ? 'rupture'
          : ratio <= 0.5
            ? 'critique'
            : ratio <= 1
              ? 'sous-seuil'
              : 'au-dessus';
      return {
        article: a,
        ratio,
        verdict,
        /* Trois crans d'encre, du vif au sourd. Le rouge est réservé à la
           rupture — voir docs/ROUGE.md : c'est la seule situation du produit
           qui empêche de travailler. */
        teinte:
          verdict === 'critique'
            ? 'var(--color-text-primary)'
            : verdict === 'sous-seuil'
              ? 'var(--color-text-secondary)'
              : '#4a4a48',
      };
    })
    /* Le plus en danger d'abord : une batterie triée par nom demanderait de
       parcourir les six anneaux pour trouver le vif. */
    .sort((a, b) => (a.ratio ?? 99) - (b.ratio ?? 99));
}

function AnneauStock({ a }: { a: AnneauDeStock }) {
  const rupture = a.verdict === 'rupture';
  const part = Math.min(1, Math.max(0, a.ratio ?? 0));
  return (
    <svg viewBox={`0 0 ${ANNEAU} ${ANNEAU}`} style={{ width: ANNEAU, height: ANNEAU }} aria-hidden>
      {/* LE CERCLE DE FOND — toujours dessiné, y compris en rupture. */}
      <circle
        cx={ANNEAU / 2}
        cy={ANNEAU / 2}
        r={ANNEAU_R}
        fill="none"
        /* Le cercle de fond d'une rupture est cerclé de rouge SOMBRE : le rouge
           vif est réservé au point central, qui est le signal. Un anneau
           entier en rouge vif crierait plus fort que le point. */
        stroke={rupture ? 'var(--color-danger-muted)' : 'var(--color-border)'}
        strokeWidth={ANNEAU_EP}
      />
      {!rupture && (
        <circle
          cx={ANNEAU / 2}
          cy={ANNEAU / 2}
          r={ANNEAU_R}
          fill="none"
          stroke={a.teinte}
          strokeWidth={ANNEAU_EP}
          strokeDasharray={`${ANNEAU_C * part} ${ANNEAU_C * (1 - part)}`}
          /* Le trait part du haut : un anneau qui commence à trois heures se
             lit comme une horloge, pas comme une jauge. */
          transform={`rotate(-90 ${ANNEAU / 2} ${ANNEAU / 2})`}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {rupture && (
        <circle cx={ANNEAU / 2} cy={ANNEAU / 2} r={4.5} fill="var(--color-danger)" className="pouls-vivant" />
      )}
      {/* Le petit triangle de l'article AU-DESSUS de son seuil. */}
      {a.verdict === 'au-dessus' && (
        <path d={`M${ANNEAU / 2} ${ANNEAU / 2 - 6} L${ANNEAU / 2 + 5.5} ${ANNEAU / 2 + 4} L${ANNEAU / 2 - 5.5} ${ANNEAU / 2 + 4} Z`} fill="#4a4a48" />
      )}
    </svg>
  );
}

const VERDICT_MOT: Record<VerdictStock, string> = {
  rupture: 'en rupture',
  critique: 'presque épuisé',
  'sous-seuil': 'sous le seuil',
  'au-dessus': 'au-dessus du seuil',
  'sans-seuil': 'non surveillé',
};
