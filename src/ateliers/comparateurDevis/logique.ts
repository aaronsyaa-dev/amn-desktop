import { arrondiCentime, type Centimes } from '../_commun/nombres';

/**
 * COMPARER DES DEVIS FOURNISSEURS — une note sur 100 par offre, des critères pondérés.
 *
 * Chaque critère donne une note de 0 à 100, relative aux autres offres :
 *
 *   prix      : le moins cher a 100, les autres  prix mini / prix × 100
 *   délai     : le plus court a 100, les autres  (délai mini + 1) / (délai + 1) × 100
 *               (le + 1 évite la division par zéro d'un délai « immédiat »)
 *   garantie  : la plus longue a 100, les autres garantie / garantie maxi × 100
 *               (toutes à 0 : 100 pour tout le monde, le critère ne départage pas)
 *   qualité   : la note donnée par la personne, de 1 à 5, × 20
 *   acompte   : 100 − acompte demandé en %  (payer moins d'avance, c'est moins de risque)
 *
 * Note finale = Σ poids × note / Σ poids, arrondie au dixième. Les poids sont
 * libres (pas besoin qu'ils fassent 100). Égalité : le moins cher d'abord,
 * puis l'ordre alphabétique.
 *
 * OFFRE ANORMALEMENT BASSE : un prix inférieur de plus de `seuilAnormal` %
 * (30 par défaut) à la moyenne des AUTRES offres. Ce n'est qu'un signal à
 * vérifier (oubli de poste, mauvaise compréhension du besoin), pas un rejet.
 */
export const CRITERES = ['prix', 'delai', 'garantie', 'qualite', 'acompte'] as const;
export type Critere = (typeof CRITERES)[number];
export type Poids = Record<Critere, number>;

export const POIDS_PAR_DEFAUT: Poids = { prix: 40, delai: 20, garantie: 15, qualite: 15, acompte: 10 };

export interface Offre {
  id: string;
  fournisseur: string;
  prixHT: Centimes;
  /** En jours calendaires, à partir de la commande. */
  delaiJours: number;
  /** En mois. */
  garantieMois: number;
  /** De 1 à 5 : l'avis de la personne (références, échanges, visite). */
  qualite: number;
  /** En % du prix, demandé à la commande. */
  acomptePct: number;
}

export interface OffreNotee {
  offre: Offre;
  notes: Record<Critere, number>;
  total: number;
  rang: number;
  ecartAuMoinsCher: Centimes;
  anormalementBasse: boolean;
  /** De combien, en %, le prix est sous la moyenne des autres offres (négatif s'il est au-dessus). */
  sousLaMoyennePct: number;
}

export type ErreurOffre = 'prix' | 'delai' | 'garantie' | 'qualite' | 'acompte' | 'fournisseur';
export type ErreurComparaison = 'nombre' | 'poids' | { offre: string; fautes: ErreurOffre[] };

export const MIN_OFFRES = 2;
export const MAX_OFFRES = 5;

export function verifierOffre(o: Offre): ErreurOffre[] {
  const f: ErreurOffre[] = [];
  if (!o.fournisseur.trim()) f.push('fournisseur');
  if (!(Number.isFinite(o.prixHT) && o.prixHT > 0)) f.push('prix');
  if (!(Number.isFinite(o.delaiJours) && o.delaiJours >= 0)) f.push('delai');
  if (!(Number.isFinite(o.garantieMois) && o.garantieMois >= 0)) f.push('garantie');
  if (!(Number.isInteger(o.qualite) && o.qualite >= 1 && o.qualite <= 5)) f.push('qualite');
  if (!(Number.isFinite(o.acomptePct) && o.acomptePct >= 0 && o.acomptePct <= 100)) f.push('acompte');
  return f;
}

export function verifier(offres: readonly Offre[], poids: Poids): ErreurComparaison[] {
  const e: ErreurComparaison[] = [];
  if (offres.length < MIN_OFFRES || offres.length > MAX_OFFRES) e.push('nombre');
  const ps = CRITERES.map((c) => poids[c]);
  if (ps.some((p) => !(Number.isFinite(p) && p >= 0)) || ps.reduce((a, b) => a + b, 0) <= 0) e.push('poids');
  for (const o of offres) {
    const fautes = verifierOffre(o);
    if (fautes.length) e.push({ offre: o.id, fautes });
  }
  return e;
}

const dixieme = (x: number) => Math.round(x * 10) / 10;

export function comparer(offres: readonly Offre[], poids: Poids, seuilAnormal = 30): OffreNotee[] | null {
  if (verifier(offres, poids).length > 0) return null;
  const prixMini = Math.min(...offres.map((o) => o.prixHT));
  const delaiMini = Math.min(...offres.map((o) => o.delaiJours));
  const garantieMaxi = Math.max(...offres.map((o) => o.garantieMois));
  const sommePoids = CRITERES.reduce((s, c) => s + poids[c], 0);

  const notees = offres.map((o) => {
    const notes: Record<Critere, number> = {
      prix: (prixMini / o.prixHT) * 100,
      delai: ((delaiMini + 1) / (o.delaiJours + 1)) * 100,
      garantie: garantieMaxi === 0 ? 100 : (o.garantieMois / garantieMaxi) * 100,
      qualite: o.qualite * 20,
      acompte: 100 - o.acomptePct,
    };
    const total = CRITERES.reduce((s, c) => s + poids[c] * notes[c], 0) / sommePoids;
    const autres = offres.filter((x) => x.id !== o.id);
    const moyenneAutres = autres.reduce((s, x) => s + x.prixHT, 0) / autres.length;
    return {
      offre: o,
      notes: Object.fromEntries(CRITERES.map((c) => [c, dixieme(notes[c])])) as Record<Critere, number>,
      total: dixieme(total),
      rang: 0,
      ecartAuMoinsCher: arrondiCentime(o.prixHT - prixMini),
      anormalementBasse: o.prixHT < moyenneAutres * (1 - seuilAnormal / 100),
      sousLaMoyennePct: Math.round((1 - o.prixHT / moyenneAutres) * 100),
    };
  });

  notees.sort((a, b) => b.total - a.total || a.offre.prixHT - b.offre.prixHT || a.offre.fournisseur.localeCompare(b.offre.fournisseur, 'fr'));
  notees.forEach((n, i) => (n.rang = i + 1));
  return notees;
}
