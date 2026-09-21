import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { FirstRun } from '../components/EmptyState';
import { useSync, useCollection, uid } from '../state/SyncContext';
import { formatCents } from '../lib/money';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useLangue } from '../i18n';
import { useHaloSignal } from '../components/EtatEcran';

interface Composant {
  label: string;
  quantity: number;
  unit: string;
  unitCostCents: number;
  /*
    LE CONTENU D'UN SOUS-ENSEMBLE — un champ AJOUTÉ au modèle.

    `MODULES.md` (`25b`) demande des BOÎTES GIGOGNES sur trois niveaux, et la
    règle qui va avec : la quantité d'une boîte MULTIPLIE celle de son
    contenu. Le modèle du produit était plat — une liste de composants, un
    seul niveau — et une liste plate ne peut pas porter cette règle : elle
    n'a rien à multiplier.

    Un composant peut donc contenir d'autres composants. Le champ est
    facultatif : une nomenclature à plat reste une nomenclature valide, elle
    n'a simplement qu'un niveau de boîte. Rien de ce qui existait ne casse.
  */
  components?: Composant[];
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
/*
  L'ARBRE SE SAISIT PAR L'INDENTATION.

  « Bouquet, 1, pièce, 0 » puis, décalées de deux espaces, les lignes qu'il
  contient. Deux espaces par niveau, trois niveaux au plus — au-delà, la ligne
  rejoint le dernier niveau ouvert plutôt que d'être perdue. C'est le geste
  qu'on fait naturellement dans un bloc-notes ; lui demander une syntaxe
  serait lui demander d'apprendre quelque chose pour décrire ce qu'elle sait
  déjà.
*/
const NIVEAUX_MAX = 3;

function lireArbre(texte: string): Composant[] {
  const racine: Composant[] = [];
  /* Les parents ouverts, du niveau 0 vers le plus profond. */
  const pile: Composant[] = [];
  for (const brute of texte.split('\n')) {
    if (!brute.trim()) continue;
    const creux = brute.length - brute.trimStart().length;
    const niveau = Math.min(NIVEAUX_MAX - 1, Math.floor(creux / 2));
    const composant = lireComposant(brute);
    if (!composant) continue;
    const parent = niveau > 0 ? pile[Math.min(niveau, pile.length) - 1] : undefined;
    if (parent) {
      parent.components = [...(parent.components ?? []), composant];
    } else {
      racine.push(composant);
    }
    pile.length = niveau;
    pile.push(composant);
  }
  return racine;
}

/* ─── LES BOÎTES GIGOGNES — l'objet dominant (`25b`) ──────────────────────── */

/*
  UNE NOMENCLATURE N'EST PAS UN ARBRE À BRANCHES, C'EST UN EMBOÎTEMENT.

  Des boîtes dans des boîtes, sur trois niveaux, chacune portant sa quantité.
  L'imbrication rend visible ce qu'un tableau indenté laisse abstrait : SORTIR
  LA BOÎTE DU DESSUS SORT TOUT CE QU'ELLE CONTIENT. Les niveaux se
  distinguent par la clarté du fond, et par rien d'autre — pas de trait, pas
  de puce : c'est la matière qui dit la profondeur.
*/
const FONDS_DE_NIVEAU = ['#151515', '#191919', '#1e1e1e'];

/*
  LE COÛT D'UNE BOÎTE — et la règle qui fait tout le module.

  La quantité d'une boîte MULTIPLIE celle de son contenu. Une jardinière qui
  contient trois bouquets de cinq tiges contient quinze tiges, pas cinq. Le
  calcul est donc récursif, et il descend la quantité au lieu de sommer des
  lignes à plat.
*/
function coutDuComposant(c: Composant): number {
  const propre = Math.round(c.quantity * c.unitCostCents);
  const dedans = (c.components ?? []).reduce((n, enfant) => n + coutDuComposant(enfant), 0);
  return propre + Math.round(c.quantity * dedans);
}

const cout = (b: BomData) => b.components.reduce((n, c) => n + coutDuComposant(c), 0);

/** Le nombre de références, toutes profondeurs confondues. */
function compterReferences(liste: Composant[]): number {
  return liste.reduce((n, c) => n + 1 + compterReferences(c.components ?? []), 0);
}

interface ArticleDeStock {
  name: string;
  quantity: number;
}

/** Un composant est en rupture quand un article suivi du même nom est à zéro. */
function enRupture(c: Composant, articles: (ArticleDeStock & { id: string })[]): boolean {
  const article = articles.find((a) => a.name.trim().toLowerCase() === c.label.trim().toLowerCase());
  return Boolean(article) && (article as ArticleDeStock).quantity <= 0;
}

/** La première boîte (à n'importe quelle profondeur) dont un contenu manque. */
function boiteBloquee(
  liste: Composant[],
  articles: (ArticleDeStock & { id: string })[],
): Composant | null {
  for (const c of liste) {
    const dedans = c.components ?? [];
    if (dedans.some((enfant) => enRupture(enfant, articles))) return c;
    const plusBas = boiteBloquee(dedans, articles);
    if (plusBas) return plusBas;
  }
  return null;
}

/** Toutes les ruptures d'une nomenclature, à plat, pour la phrase qui les nomme. */
function rupturesDe(
  liste: Composant[],
  articles: (ArticleDeStock & { id: string })[],
): Composant[] {
  return liste.flatMap((c) => [
    ...(enRupture(c, articles) ? [c] : []),
    ...rupturesDe(c.components ?? [], articles),
  ]);
}
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
  const articles = useCollection<ArticleDeStock>('stockItems');
  const [ouvert, setOuvert] = useState(false);
  const [product, setProduct] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [lignes, setLignes] = useState('');

  const [recherche, setRecherche] = useState('');
  const [deplie, setDeplie] = useState<string | null>(null);
  const [ouvertKit, setOuvertKit] = useState<string | null>(null);

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
  const composants = produits.reduce((n, b) => n + compterReferences(b.components), 0);

  /*
    LE KIT OUVERT — celui dont une boîte est bloquée par une rupture s'il en
    existe un, sinon le premier du registre. L'objet dominant n'existe que
    pour montrer l'emboîtement et son point de rupture : l'ouvrir sur un kit
    qui n'en a pas reviendrait à ouvrir sur la démonstration la moins parlante.
  */
  const bloques = useMemo(
    () => produits.filter((b) => rupturesDe(b.components, articles).length > 0),
    [produits, articles],
  );
  const kit = produits.find((b) => b.id === ouvertKit) ?? bloques[0] ?? produits[0] ?? null;
  const boiteAmbre = useMemo(
    () => (kit ? boiteBloquee(kit.components, articles) : null),
    [kit, articles],
  );
  const ruptures = useMemo(
    () => (kit ? rupturesDe(kit.components, articles) : []),
    [kit, articles],
  );
  const halo = useHaloSignal(boiteAmbre !== null);
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
    const comps = lireArbre(lignes);
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
          {/* ── LES BOÎTES GIGOGNES — l'objet dominant (`25b`) ───────────── */}
          {kit && (
            <motion.section variants={staggerItem} className="panel-raised panel-raised-wide p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
                <div className="min-w-0">
                  <p className="eyebrow">
                    {compterReferences(kit.components)} références · {formatCents(cout(kit))} de revient
                  </p>
                  <p className="mt-1 text-[21px] font-semibold leading-tight text-text-primary sm:text-[25px]">
                    {kit.product}
                  </p>
                </div>
                <p className="max-w-xs font-mono text-[9.5px] uppercase leading-[1.7] tracking-[0.18em] text-text-muted">
                  sortir la boîte du dessus sort tout ce qu’elle contient
                </p>
              </div>

              <div className="mt-5 flex flex-col gap-2">
                {kit.components.map((c, i) => (
                  <Boite
                    key={`${c.label}-${i}`}
                    composant={c}
                    niveau={0}
                    articles={articles}
                    boiteAmbre={boiteAmbre}
                    halo={halo}
                  />
                ))}
              </div>

              {/*
                LA PHRASE QUI DIT L'INDISPONIBILITÉ — explicitement, comme le
                module l'exige. Un kit dont un seul article manque ne se
                fabrique pas : le dire à moitié (« attention, une rupture »)
                laisse croire qu'on peut quand même essayer.
              */}
              <p className="mt-5 border-t border-border-row pt-3 text-[12.5px] leading-relaxed text-text-secondary">
                {ruptures.length === 0 ? (
                  <>Tous les articles suivis de ce kit sont en stock : il se fabrique.</>
                ) : (
                  <>
                    <span className="font-semibold text-danger">
                      {ruptures.map((r) => r.label).join(', ')}
                    </span>{' '}
                    {ruptures.length === 1 ? 'est en rupture' : 'sont en rupture'} : le kit entier
                    est indisponible tant que ce n’est pas réapprovisionné. Ce n’est pas une
                    alerte, c’est un fait — aucun exemplaire ne peut sortir.
                  </>
                )}
              </p>
            </motion.section>
          )}

          {/* AUTOUR — à gauche les kits, à droite ce que celui-ci coûte. */}
          <motion.div variants={staggerItem} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
            <section className="panel p-4 sm:p-5">
              <p className="eyebrow">Les kits</p>
              <ul className="mt-3 flex flex-col gap-2">
                {produits.slice(0, 6).map((b) => {
                  const casse = rupturesDe(b.components, articles).length > 0;
                  return (
                    <li key={b.id}>
                      <button
                        type="button"
                        onClick={() => setOuvertKit(b.id)}
                        aria-pressed={b.id === kit?.id}
                        className={`flex w-full flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border px-3 py-2.5 text-left transition-colors ${
                          b.id === kit?.id
                            ? 'border-border-strong bg-surface-hover'
                            : 'border-border hover:bg-surface-hover'
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate text-[13.5px] text-text-primary">
                          {b.product}
                        </span>
                        <span className="tnum font-mono text-[10px] uppercase tracking-wider text-text-muted">
                          {compterReferences(b.components)} réf.
                          {casse && <span className="text-danger"> · rupture</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {/*
                CE QUE LA MAQUETTE DEMANDE ET QUE LE PRODUIT NE PORTE PAS : les
                « sorties du mois » par kit. Rien n'enregistre une sortie de
                kit — ni le Stock, qui suit des articles, ni les Commandes, qui
                suivent des lignes de vente. Un chiffre inventé ici serait pris
                pour une mesure.
              */}
              <p className="mt-3 border-t border-border-row pt-3 text-[12.5px] leading-relaxed text-text-muted">
                Les sorties de kit ne sont pas enregistrées par le produit : le Stock suit des
                articles, pas des assemblages. Le nombre de références, lui, est compté sur les
                boîtes réelles, toutes profondeurs confondues.
              </p>
            </section>

            <section className="panel p-4 sm:p-5">
              <p className="eyebrow">Le coût du kit</p>
              <p className="tnum mt-2 text-[27px] font-semibold leading-none text-text-primary">
                {kit ? formatCents(cout(kit)) : '—'}
              </p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                prix de revient
              </p>
              {kit && kit.sellPriceCents && kit.sellPriceCents > 0 && (
                <dl className="mt-4 flex flex-col gap-2 border-t border-border-row pt-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      prix de vente
                    </dt>
                    <dd className="tnum font-mono text-[12px] text-text-primary">
                      {formatCents(kit.sellPriceCents)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      marge
                    </dt>
                    <dd
                      className={`tnum font-mono text-[12px] ${(margeDe(kit) ?? 0) < 0 ? 'text-danger' : 'text-text-secondary'}`}
                    >
                      {formatCents(margeDe(kit) ?? 0)}
                    </dd>
                  </div>
                </dl>
              )}
              {/*
                L'OUTILLAGE. La maquette veut qu'on précise qu'il n'est pas
                compté « puisqu'il revient ». Le produit ne distingue pas un
                consommable d'un outil : écrire « outillage non compté »
                laisserait croire à un tri que personne ne fait. On dit donc la
                vérité — tout ce qui est listé est compté — et la conséquence
                pratique, qui est la même précaution.
              */}
              <p className="mt-3 border-t border-border-row pt-3 text-[12.5px] leading-relaxed text-text-muted">
                Tout ce qui est listé est compté, les quantités des boîtes se multipliant. Le
                produit ne distingue pas l’outillage qui revient d’un consommable : un outil ne
                doit donc pas figurer dans la nomenclature.
              </p>
            </section>
          </motion.div>

          {/* CE QUI SE VEND À PERTE — descendu au rang de matière : la carte
              dominante est maintenant l'emboîtement du kit. */}
          <motion.section
            variants={staggerItem}
            className="panel p-4 sm:p-5"
            data-signal-groupe={aPerte.length > 0 && boiteAmbre === null ? 'a-perte' : undefined}
          >
            {aPerte.length > 0 ? (
              <>
                {/* L'ambre ne revient ici que si aucune boîte n'est bloquée :
                    un écran, une région. */}
                {boiteAmbre === null ? (
                  <p className="signal-plate mb-3 inline-flex px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider">{t('nomenclatures.perte')}</p>
                ) : (
                  <p className="eyebrow mb-3">{t('nomenclatures.perte')}</p>
                )}
                <p className="text-[17px] font-semibold leading-tight text-text-primary sm:text-[21px]">
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
                <p className="text-[17px] font-semibold leading-tight text-text-primary sm:text-[21px]">{t('nomenclatures.toutesPositives')}</p>
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
                          {ditLesComposants(compterReferences(b.components))}
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

/**
 * UNE BOÎTE — et ce qu'elle contient, dans elle.
 *
 * Le fond s'éclaircit d'un niveau à chaque emboîtement (`FONDS_DE_NIVEAU`) :
 * c'est la matière qui dit la profondeur, pas un trait ni une puce. Une boîte
 * qui contient une rupture porte un cadre ambre sombre, son titre et sa
 * quantité — trois nœuds, une région. L'article en rupture, lui, porte la
 * mention ROUGE : c'est lui le manque, la boîte n'est que l'endroit où il se
 * voit.
 */
function Boite({
  composant,
  niveau,
  articles,
  boiteAmbre,
  halo,
}: {
  composant: Composant;
  niveau: number;
  articles: (ArticleDeStock & { id: string })[];
  boiteAmbre: Composant | null;
  halo: string;
}) {
  const dedans = composant.components ?? [];
  const signal = boiteAmbre === composant;
  const rupture = enRupture(composant, articles);
  const fond = FONDS_DE_NIVEAU[Math.min(niveau, FONDS_DE_NIVEAU.length - 1)];

  return (
    <div
      className={`border p-2.5 ${signal ? `border-signal-line ${halo}` : 'border-border'}`}
      style={{ background: fond }}
      data-signal-groupe={signal ? 'boite-bloquee' : undefined}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span
          className={`min-w-0 flex-1 truncate text-[13.5px] ${signal ? 'font-semibold text-signal' : 'text-text-primary'}`}
          data-signal-groupe={signal ? 'boite-bloquee' : undefined}
        >
          {composant.label}
          {rupture && (
            <span className="ml-2 font-mono text-[10px] uppercase tracking-wider text-danger">
              en rupture
            </span>
          )}
        </span>
        <span
          className={`tnum flex-shrink-0 font-mono text-[11px] uppercase tracking-wider ${signal ? 'text-signal' : 'text-text-muted'}`}
          data-signal-groupe={signal ? 'boite-bloquee' : undefined}
        >
          × {composant.quantity}
          {composant.unit ? ` ${composant.unit}` : ''}
        </span>
      </div>

      {dedans.length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          {dedans.map((enfant, i) => (
            <Boite
              key={`${enfant.label}-${i}`}
              composant={enfant}
              niveau={niveau + 1}
              articles={articles}
              boiteAmbre={boiteAmbre}
              halo={halo}
            />
          ))}
        </div>
      )}
    </div>
  );
}
