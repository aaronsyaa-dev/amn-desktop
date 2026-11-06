/**
 * H15 · STOCK — logique pure (jauges, ruptures à venir, mouvements, commande groupée).
 *
 * Règles de la fiche H15, rubrique 6. Les entrées sont des formes minimales : les
 * jeux fictifs (`ArticleStock`) et, plus tard, les articles du module « Stock »
 * existant les satisfont une fois adaptés. Les champs absents des jeux fictifs
 * sont facultatifs et listés dans `STATUT.md` (niveau cible, emplacement d'un
 * mouvement, commandes fournisseur, conditions de port).
 */

import { ajouterJours, ecartJours, type Jour } from './commun';

export interface MouvementEntree {
  le: Jour;
  /** Signé : positif = entrée, négatif = sortie. */
  delta: number;
  motif: string;
  /** Emplacement du mouvement ; par défaut celui de l'article. */
  emplacement?: string;
}

export interface ArticleEntree {
  id: string;
  nom: string;
  seuilAlerte: number;
  prixAchatCents: number;
  emplacement: string;
  mouvements: readonly MouvementEntree[];
  /** Haut du tube. Par défaut 2 × le seuil (Proposition de la fiche). */
  niveauCible?: number | null;
  fournisseurId?: string | null;
}

/** Commande fournisseur passée et pas encore reçue. */
export interface LivraisonPrevue {
  articleId: string;
  quantite: number;
  /** Arrivée prévue. */
  le: Jour;
  emplacement?: string;
}

/* -------- Quantité, cible, remplissage -------- */

/** Motifs de mouvement qui ne sont pas une consommation. */
const MOTIFS_NON_CONSOMMES = new Set(['Inventaire', 'Transfert']);

const dansEmplacement = (m: MouvementEntree, a: ArticleEntree, emplacement?: string): boolean =>
  emplacement === undefined || (m.emplacement ?? a.emplacement) === emplacement;

/** La quantité est la SOMME des mouvements : elle ne s'édite jamais directement. */
export function quantiteEnStock(a: ArticleEntree, emplacement?: string): number {
  return a.mouvements.filter((m) => dansEmplacement(m, a, emplacement)).reduce((s, m) => s + m.delta, 0);
}

/** Haut du tube : la valeur saisie, sinon 2 × seuil ; jamais moins de 1 (pas de division par zéro). */
export function niveauCible(a: Pick<ArticleEntree, 'seuilAlerte' | 'niveauCible'>): number {
  return Math.max(1, a.niveauCible ?? a.seuilAlerte * 2);
}

/** Remplissage du tube entre 0 et 1 : quantité ÷ niveau cible, plafonné à 100 %. */
export function remplissage(quantite: number, cible: number): number {
  return cible > 0 ? Math.min(1, Math.max(0, quantite / cible)) : 0;
}

/** Position du pointillé du seuil dans le tube, entre 0 et 1 (le seuil n'est PAS la cible). */
export function reperSeuil(a: Pick<ArticleEntree, 'seuilAlerte' | 'niveauCible'>): number {
  return remplissage(a.seuilAlerte, niveauCible(a));
}

export type EtatStock = 'rupture' | 'sous-seuil' | 'en-stock';
export type TonStock = 'rouge' | 'ambre' | 'neutre';

/**
 * Rupture : quantité ≤ 0 (tube vide, contour rouge). Sous le seuil : quantité ≤ seuil ;
 * rouge si ≤ 25 % du seuil, ambre sinon. En stock : au-dessus du seuil, neutre.
 */
export function etatDuStock(quantite: number, seuil: number): { etat: EtatStock; ton: TonStock } {
  if (quantite <= 0) return { etat: 'rupture', ton: 'rouge' };
  if (quantite <= seuil) return { etat: 'sous-seuil', ton: quantite <= seuil * 0.25 ? 'rouge' : 'ambre' };
  return { etat: 'en-stock', ton: 'neutre' };
}

/** Un article « à surveiller » : sous le seuil ou en rupture (même requête que la barre latérale et F50). */
export const estASurveiller = (a: ArticleEntree, emplacement?: string): boolean =>
  etatDuStock(quantiteEnStock(a, emplacement), a.seuilAlerte).etat !== 'en-stock';

export function articlesASurveiller<T extends ArticleEntree>(articles: readonly T[], emplacement?: string): T[] {
  return articles.filter((a) => estASurveiller(a, emplacement));
}

/** Σ quantité × prix d'achat, en centimes (valorisation : à confirmer, fiche H15). */
export function valorisationCents(articles: readonly ArticleEntree[]): number {
  return articles.reduce((s, a) => s + Math.max(0, quantiteEnStock(a)) * a.prixAchatCents, 0);
}

/** Emplacements connus, dans l'ordre d'apparition. */
export function emplacements(articles: readonly ArticleEntree[]): string[] {
  const vus = new Set<string>();
  for (const a of articles) {
    vus.add(a.emplacement);
    for (const m of a.mouvements) if (m.emplacement) vus.add(m.emplacement);
  }
  return [...vus];
}

/**
 * Ordre des jauges : les articles sous le seuil d'abord, le plus critique à gauche
 * (quantité ÷ seuil croissant), puis les autres par nom (Proposition de la fiche).
 */
export function ordreDesJauges<T extends ArticleEntree>(articles: readonly T[], emplacement?: string): T[] {
  const gravite = (a: T): number => {
    const q = quantiteEnStock(a, emplacement);
    return a.seuilAlerte > 0 ? q / a.seuilAlerte : q > 0 ? Number.POSITIVE_INFINITY : 0;
  };
  return [...articles].sort((a, b) => {
    const sa = estASurveiller(a, emplacement);
    const sb = estASurveiller(b, emplacement);
    if (sa !== sb) return sa ? -1 : 1;
    if (sa) return gravite(a) - gravite(b) || a.nom.localeCompare(b.nom, 'fr');
    return a.nom.localeCompare(b.nom, 'fr');
  });
}

/* -------- En route -------- */

/** Quantité attendue (commandes fournisseur non reçues) et date d'arrivée la plus proche. */
export function enRoute(a: ArticleEntree, livraisons: readonly LivraisonPrevue[], emplacement?: string): { quantite: number; le: Jour | null } {
  const miennes = livraisons.filter((l) => l.articleId === a.id && (emplacement === undefined || (l.emplacement ?? a.emplacement) === emplacement));
  const dates = miennes.map((l) => l.le).sort();
  return { quantite: miennes.reduce((s, l) => s + l.quantite, 0), le: dates[0] ?? null };
}

/** Les articles sous le seuil qui n'ont aucune livraison en route (cas de la suggestion de F50). */
export function sousSeuilSansCommande<T extends ArticleEntree>(articles: readonly T[], livraisons: readonly LivraisonPrevue[]): T[] {
  return articles.filter((a) => estASurveiller(a) && enRoute(a, livraisons).quantite === 0);
}

/** Ajmani ne propose la commande groupée qu'à partir de 3 articles (déclencheur de F50 rubrique 10). */
export const SEUIL_SUGGESTION_COMMANDE = 3;

/* -------- Projection des ruptures (14 jours) -------- */

export const HORIZON_PROJECTION_JOURS = 14;
export const FENETRE_CONSOMMATION_JOURS = 30;

/**
 * Consommation moyenne par jour sur les 30 derniers jours : les sorties,
 * hors inventaire et hors transferts. `null` s'il n'y a eu aucune sortie
 * (« Pas assez d'historique »).
 */
export function consommationJournaliere(a: ArticleEntree, aujourdhui: Jour, fenetre = FENETRE_CONSOMMATION_JOURS): number | null {
  const debut = ajouterJours(aujourdhui, -fenetre);
  const sorties = a.mouvements.filter((m) => m.delta < 0 && !MOTIFS_NON_CONSOMMES.has(m.motif) && m.le > debut && m.le <= aujourdhui);
  if (sorties.length === 0) return null;
  return sorties.reduce((s, m) => s - m.delta, 0) / fenetre;
}

export interface Projection {
  articleId: string;
  /** `sans-historique` : pas de couloir. `aucune` : aucune rupture dans l'horizon. */
  statut: 'sans-historique' | 'aucune' | 'evitee' | 'rupture';
  /** Jour de rupture (évitée ou non). */
  jourRupture: Jour | null;
  /** Nombre de jours d'ici la rupture. */
  dansJours: number | null;
  /** Jour de la livraison qui évite la rupture. */
  livraisonLe: Jour | null;
  consommation: number | null;
}

/** Premier jour (1…horizon) où la quantité projetée tombe à 0 ou moins ; les livraisons arrivent avant la consommation du jour. */
function premierJourDeRupture(quantite: number, conso: number, livraisons: readonly LivraisonPrevue[], aujourdhui: Jour, horizon: number): number | null {
  for (let d = 1; d <= horizon; d += 1) {
    const jour = ajouterJours(aujourdhui, d);
    const recu = livraisons.filter((l) => l.le <= jour).reduce((s, l) => s + l.quantite, 0);
    if (quantite + recu - conso * d <= 0) return d;
  }
  return null;
}

/**
 * Jour de rupture projeté au rythme des 30 derniers jours, livraisons prévues
 * ajoutées à leur date. « Évitée » : sans livraison l'article manquerait dans
 * l'horizon, et avec elles non. Sinon « rupture <jour> ».
 */
export function projeterRupture(
  a: ArticleEntree,
  livraisons: readonly LivraisonPrevue[],
  aujourdhui: Jour,
  horizon = HORIZON_PROJECTION_JOURS,
): Projection {
  const conso = consommationJournaliere(a, aujourdhui);
  const base = { articleId: a.id, consommation: conso };
  if (conso === null || conso <= 0) return { ...base, statut: 'sans-historique', jourRupture: null, dansJours: null, livraisonLe: null };
  const q = Math.max(0, quantiteEnStock(a));
  const miennes = livraisons.filter((l) => l.articleId === a.id && l.le > aujourdhui);
  const sans = premierJourDeRupture(q, conso, [], aujourdhui, horizon);
  const avec = premierJourDeRupture(q, conso, miennes, aujourdhui, horizon);
  if (avec !== null) return { ...base, statut: 'rupture', jourRupture: ajouterJours(aujourdhui, avec), dansJours: avec, livraisonLe: null };
  if (sans !== null) {
    const premiere = miennes.map((l) => l.le).sort()[0] ?? null;
    return { ...base, statut: 'evitee', jourRupture: ajouterJours(aujourdhui, sans), dansJours: sans, livraisonLe: premiere };
  }
  return { ...base, statut: 'aucune', jourRupture: null, dansJours: null, livraisonLe: null };
}

export interface RupturesAVenir {
  /** Couloirs visibles : ruptures non évitées d'abord, la plus proche en premier. */
  visibles: Projection[];
  /** « Voir les N autres ». */
  restants: number;
  /** « Commander les 2 » : ruptures non évitées. */
  aCommander: Projection[];
  /** Aucune rupture prévue sur 14 jours (coche verte). */
  aucune: boolean;
}

export const COULOIRS_VISIBLES = 3;

export function rupturesAVenir(
  articles: readonly ArticleEntree[],
  livraisons: readonly LivraisonPrevue[],
  aujourdhui: Jour,
  visibles = COULOIRS_VISIBLES,
): RupturesAVenir {
  const toutes = articles
    .map((a) => projeterRupture(a, livraisons, aujourdhui))
    .filter((p) => p.statut === 'rupture' || p.statut === 'evitee')
    .sort((a, b) => (a.statut === b.statut ? (a.dansJours ?? 0) - (b.dansJours ?? 0) : a.statut === 'rupture' ? -1 : 1));
  return {
    visibles: toutes.slice(0, visibles),
    restants: Math.max(0, toutes.length - visibles),
    aCommander: toutes.filter((p) => p.statut === 'rupture'),
    aucune: toutes.length === 0,
  };
}

/* -------- Mouvements -------- */

export type VerdictSortie = { ok: true } | { ok: false; raison: 'stock-negatif'; disponible: number };

/** Le stock négatif est refusé par défaut : « Il n'en reste que 4. Corrigez la quantité ou faites un inventaire. » */
export function verifierMouvement(a: ArticleEntree, delta: number, emplacement?: string): VerdictSortie {
  const dispo = quantiteEnStock(a, emplacement);
  return dispo + delta < 0 ? { ok: false, raison: 'stock-negatif', disponible: Math.max(0, dispo) } : { ok: true };
}

/** Une correction n'efface rien : elle ajoute le mouvement inverse. */
export function mouvementInverse(m: MouvementEntree, le: Jour): MouvementEntree {
  return { le, delta: -m.delta, motif: 'Inventaire', ...(m.emplacement ? { emplacement: m.emplacement } : {}) };
}

/** Franchir le seuil (de « au-dessus » à « au niveau ou en dessous ») crée UNE alerte ; rester dessous n'en crée pas d'autre. */
export function franchitLeSeuil(avant: number, apres: number, seuil: number): boolean {
  return avant > seuil && apres <= seuil;
}

/** Journal : les mouvements du plus récent au plus ancien. */
export function journalDesMouvements<T extends { le: Jour }>(mouvements: readonly T[], limite = 50): T[] {
  return [...mouvements].sort((a, b) => b.le.localeCompare(a.le)).slice(0, limite);
}

/* -------- Commande groupée (suggestion d'Ajmani) -------- */

export interface FournisseurEntree {
  id: string;
  nom: string;
  /** Seuil de franco de port, en centimes (conditions de H45 : à confirmer dans le code). */
  francoCents?: number | null;
  fraisPortCents?: number | null;
}

export interface LigneCommande {
  articleId: string;
  quantite: number;
  totalCents: number;
}
export interface CommandeGroupee {
  fournisseurId: string;
  lignes: LigneCommande[];
  totalCents: number;
  /** Frais de port évités en ajoutant un article proche du seuil ; 0 si aucun. */
  economieCents: number;
  /** Article ajouté pour atteindre le franco (dominos dans l'exemple de la fiche). */
  articleAjoute: string | null;
}

/** Quantité à commander : de quoi atteindre le niveau cible, déduction faite de ce qui est en route. */
export function quantiteACommander(a: ArticleEntree, livraisons: readonly LivraisonPrevue[]): number {
  return Math.max(1, Math.ceil(niveauCible(a) - quantiteEnStock(a) - enRoute(a, livraisons).quantite));
}

/**
 * Regroupe par fournisseur les articles sous le seuil et ceux qui le passeront dans
 * 14 jours. Si le total reste sous le franco, ajoute l'article le moins cher
 * « proche du seuil » (≤ 1,5 × seuil) qui permet de l'atteindre et d'éviter les frais de port.
 */
export function commandeGroupee(
  articles: readonly ArticleEntree[],
  fournisseurs: readonly FournisseurEntree[],
  livraisons: readonly LivraisonPrevue[],
  aujourdhui: Jour,
): CommandeGroupee[] {
  const aCommander = new Set<string>([
    ...sousSeuilSansCommande(articles, livraisons).map((a) => a.id),
    ...rupturesAVenir(articles, livraisons, aujourdhui, Infinity).aCommander.map((p) => p.articleId),
  ]);
  const sorties: CommandeGroupee[] = [];
  for (const f of fournisseurs) {
    const siens = articles.filter((a) => a.fournisseurId === f.id);
    const lignes: LigneCommande[] = siens
      .filter((a) => aCommander.has(a.id))
      .map((a) => {
        const quantite = quantiteACommander(a, livraisons);
        return { articleId: a.id, quantite, totalCents: quantite * a.prixAchatCents };
      });
    if (lignes.length === 0) continue;
    let total = lignes.reduce((s, l) => s + l.totalCents, 0);
    let economie = 0;
    let ajoute: string | null = null;
    if (f.francoCents && total < f.francoCents && (f.fraisPortCents ?? 0) > 0) {
      const candidats = siens
        .filter((a) => !aCommander.has(a.id) && quantiteEnStock(a) <= a.seuilAlerte * 1.5)
        .map((a) => {
          const quantite = quantiteACommander(a, livraisons);
          return { a, quantite, totalCents: quantite * a.prixAchatCents };
        })
        .filter((c) => total + c.totalCents >= (f.francoCents as number))
        .sort((x, y) => x.totalCents - y.totalCents);
      const meilleur = candidats[0];
      if (meilleur) {
        lignes.push({ articleId: meilleur.a.id, quantite: meilleur.quantite, totalCents: meilleur.totalCents });
        total += meilleur.totalCents;
        economie = f.fraisPortCents ?? 0;
        ajoute = meilleur.a.id;
      }
    }
    sorties.push({ fournisseurId: f.id, lignes, totalCents: total, economieCents: economie, articleAjoute: ajoute });
  }
  return sorties.sort((x, y) => y.totalCents - x.totalCents);
}

/** Jours entre aujourd'hui et une livraison (pour « +24 mar. 3 »). */
export const joursAvant = (aujourdhui: Jour, le: Jour): number => ecartJours(aujourdhui, le);
