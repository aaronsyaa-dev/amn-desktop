/**
 * MR05 · CATALOGUE PRODUITS — logique pure (prix, stock, vedette, complétude, marge).
 *
 * Le dépôt n'a aujourd'hui AUCUN module « Catalogue produits » (relevé du 6 nov. : seulement
 * des nomenclatures, des lignes de commande et un catalogue de prix tirés des devis). Le
 * produit ci-dessous est donc le modèle à créer, aligné sur `Produit` des jeux fictifs ;
 * photos, TVA et prix d'achat sont facultatifs (listés dans `STATUT.md`).
 */

import { ajouterJours, lundiDe, pourcentDe, type Jour } from './commun';

export type TypeProduit = 'produit en stock' | 'service' | 'abonnement';

export interface ProduitEntree {
  id: string;
  nom: string;
  /** Nom court de la tuile (« Pack caméras ») ; le nom complet est dans la fiche. */
  nomCourt?: string;
  description?: string;
  /** Prix HT en centimes. */
  prixHtCents: number;
  tvaPct?: number;
  type: TypeProduit;
  quantite?: number | null;
  niveauConseille?: number | null;
  seuilAlerte?: number | null;
  prixAchatHtCents?: number | null;
  photos?: number;
  etat: 'actif' | 'archivé';
}

export const TVA_PAR_DEFAUT = 20;

/** TTC = HT × (1 + TVA), 20 % par défaut ; arrondi au centime (890 € HT → 1 068 € TTC). */
export const prixTtcCents = (htCents: number, tvaPct: number = TVA_PAR_DEFAUT): number => Math.round(htCents * (1 + tvaPct / 100));

export type TonStock = 'rouge' | 'orange' | 'vert' | 'bleu';

/**
 * Couleur du stock (Proposition) : rouge si quantité ≤ seuil ou < 30 % du conseillé ;
 * orange de 30 à 69 % ; vert au-delà. Services et abonnements : « Service », bleu.
 * Même règle partout (tuile, pastille « Stock bas », fiche).
 */
export function tonDuStock(p: Pick<ProduitEntree, 'type' | 'quantite' | 'niveauConseille' | 'seuilAlerte'>): TonStock {
  if (p.type !== 'produit en stock') return 'bleu';
  const q = p.quantite ?? 0;
  const conseille = p.niveauConseille ?? 0;
  const part = conseille > 0 ? q / conseille : 1;
  if ((p.seuilAlerte !== null && p.seuilAlerte !== undefined && q <= p.seuilAlerte) || part < 0.3) return 'rouge';
  return part < 0.7 ? 'orange' : 'vert';
}

/** Jauge de la fiche : remplissage = quantité / conseillé, repère = seuil / conseillé (0–1). */
export function jaugeDuStock(p: Pick<ProduitEntree, 'quantite' | 'niveauConseille' | 'seuilAlerte'>): { remplissage: number; repere: number | null } {
  const c = p.niveauConseille ?? 0;
  if (c <= 0) return { remplissage: 0, repere: null };
  return { remplissage: Math.min(1, Math.max(0, (p.quantite ?? 0) / c)), repere: p.seuilAlerte != null ? Math.min(1, p.seuilAlerte / c) : null };
}

export const estStockBas = (p: ProduitEntree): boolean => tonDuStock(p) === 'rouge' && p.type === 'produit en stock';

/** Marge par pack = HT − achat HT ; pourcentage = marge / HT (302 / 890 = 34 %). `null` sans prix d'achat. Visible avec le droit de voir les prix d'achat. */
export function margeDuProduit(p: Pick<ProduitEntree, 'prixHtCents' | 'prixAchatHtCents'>): { cents: number; pourcent: number } | null {
  if (p.prixAchatHtCents == null || p.prixHtCents <= 0) return null;
  const cents = p.prixHtCents - p.prixAchatHtCents;
  return { cents, pourcent: pourcentDe(cents, p.prixHtCents) };
}

/** Fiche complète : photo, prix, description et stock renseignés (le stock ne s'applique pas à un service). */
export function ficheComplete(p: ProduitEntree): boolean {
  const stockOk = p.type !== 'produit en stock' || (p.quantite !== null && p.quantite !== undefined);
  return (p.photos ?? 0) > 0 && p.prixHtCents > 0 && !!p.description?.trim() && stockOk;
}

/** « Fiches complètes 7 sur 8 » : produits actifs complets sur produits actifs. */
export function fichesCompletes(produits: readonly ProduitEntree[]): { completes: number; total: number } {
  const actifs = produits.filter((p) => p.etat === 'actif');
  return { completes: actifs.filter(ficheComplete).length, total: actifs.length };
}

export interface LigneVendue { produitId: string; quantite: number; prixHtCents: number; le: Jour }

/** Vedette : produit le plus vendu de la semaine civile ; à égalité, le chiffre d'affaires le plus haut. */
export function produitVedette(produits: readonly ProduitEntree[], ventes: readonly LigneVendue[], aujourdhui: Jour): { produitId: string; vendus: number } | null {
  const debut = lundiDe(aujourdhui);
  const fin = ajouterJours(debut, 6);
  const cumul = new Map<string, { q: number; ca: number }>();
  for (const v of ventes) {
    if (v.le < debut || v.le > fin || !produits.some((p) => p.id === v.produitId && p.etat === 'actif')) continue;
    const c = cumul.get(v.produitId) ?? { q: 0, ca: 0 };
    c.q += v.quantite;
    c.ca += v.quantite * v.prixHtCents;
    cumul.set(v.produitId, c);
  }
  const meilleur = [...cumul.entries()].sort((a, b) => b[1].q - a[1].q || b[1].ca - a[1].ca)[0];
  return meilleur ? { produitId: meilleur[0], vendus: meilleur[1].q } : null;
}

/** Quantités vendues par semaine civile sur les 6 dernières (la plus récente à la fin). */
export function ventesSurSixSemaines(produitId: string, ventes: readonly LigneVendue[], aujourdhui: Jour, n = 6): { debut: Jour; vendus: number }[] {
  const lundi = lundiDe(aujourdhui);
  return Array.from({ length: n }, (_, i) => {
    const debut = ajouterJours(lundi, -7 * (n - 1 - i));
    const fin = ajouterJours(debut, 6);
    return { debut, vendus: ventes.filter((v) => v.produitId === produitId && v.le >= debut && v.le <= fin).reduce((s, v) => s + v.quantite, 0) };
  });
}

/** Ordre de la mosaïque (Proposition) : vedette, puis stock bas, puis ordre manuel ; la tuile d'ajout est toujours la dernière (hors de cette liste). */
export function ordreDeLaMosaique<T extends ProduitEntree>(produits: readonly T[], vedetteId: string | null): T[] {
  const actifs = produits.filter((p) => p.etat === 'actif');
  const rang = (p: T): number => (p.id === vedetteId ? 0 : estStockBas(p) ? 1 : 2);
  return actifs.map((p, i) => ({ p, i })).sort((a, b) => rang(a.p) - rang(b.p) || a.i - b.i).map((x) => x.p);
}

/** Prix affiché : « 620 € HT » ; abonnement : « 240 € / an » (la périodicité vient du produit). */
export function prixAffiche(p: Pick<ProduitEntree, 'prixHtCents' | 'type'>, periode?: 'an' | 'mois'): { euros: number; suffixe: 'HT' | 'par-an' | 'par-mois' } {
  const euros = p.prixHtCents / 100;
  if (p.type === 'abonnement') return { euros, suffixe: periode === 'mois' ? 'par-mois' : 'par-an' };
  return { euros, suffixe: 'HT' };
}
