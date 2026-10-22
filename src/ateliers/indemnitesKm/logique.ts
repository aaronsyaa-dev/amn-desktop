import { arrondiCentime, estDateIso, type Centimes } from '../_commun/nombres';

/**
 * INDEMNITÉS KILOMÉTRIQUES — le barème fiscal des voitures, appliqué au total de l'année.
 *
 * Le barème est PAR TRANCHE DE DISTANCE ANNUELLE : on additionne d'abord tous
 * les kilomètres professionnels de l'année, on applique la formule de la
 * tranche, puis on répartit le montant entre les trajets au prorata de leurs
 * kilomètres (plus forts restes : la somme tombe juste au centime). Appliquer
 * le barème trajet par trajet serait faux dès qu'on passe 5 000 km.
 *
 *   d ≤ 5 000 km           : d × a
 *   5 000 < d ≤ 20 000 km  : d × b + c
 *   d > 20 000 km          : d × e
 *   véhicule électrique    : montant majoré de 20 %
 *
 * Les taux sont en MILLIÈMES D'EURO par km (0,529 €/km → 529), la part fixe en
 * centimes : aucun flottant dans le barème lui-même.
 */

export const PUISSANCES = ['3', '4', '5', '6', '7'] as const;
export type Puissance = (typeof PUISSANCES)[number];

export interface Tranches {
  /** ≤ 5 000 km, millièmes d'euro par km. */
  a: number;
  /** 5 001 à 20 000 km, millièmes d'euro par km… */
  b: number;
  /** … plus une part fixe, en centimes. */
  c: Centimes;
  /** > 20 000 km, millièmes d'euro par km. */
  e: number;
}

export interface Bareme {
  /** L'année de publication (il s'applique aux revenus de l'année précédente). */
  annee: number;
  /** Ce qu'on sait de sa validité, affiché à l'écran. */
  statut: string;
  majorationElectrique: number;
  tranches: Record<Puissance, Tranches>;
}

/**
 * Barème des voitures publié en 2024 (revenus 2023), reconduit sans changement
 * en 2025 (revenus 2024). Source : impots.gouv.fr, « barème kilométrique » ;
 * BOFiP BOI-BAREME-000001. À VÉRIFIER pour l'année 2026 (revenus 2025) avant
 * toute intégration : ces valeurs changent par arrêté.
 */
export const BAREME_2025: Bareme = {
  annee: 2025,
  statut: 'barème 2024 reconduit en 2025, à vérifier pour 2026 (publication 2026, revenus 2025)',
  majorationElectrique: 20,
  tranches: {
    '3': { a: 529, b: 316, c: 106_500, e: 370 },
    '4': { a: 606, b: 340, c: 133_000, e: 407 },
    '5': { a: 636, b: 357, c: 139_500, e: 427 },
    '6': { a: 665, b: 374, c: 145_700, e: 447 },
    '7': { a: 697, b: 394, c: 151_500, e: 470 },
  },
};

export const SEUIL_1 = 5_000;
export const SEUIL_2 = 20_000;

export interface Trajet {
  id: string;
  date: string;
  motif: string;
  depart: string;
  arrivee: string;
  /** Distance d'un aller, en km (une décimale permise). */
  km: number;
  allerRetour: boolean;
}

export type ErreurTrajet = 'date' | 'motif' | 'lieux' | 'km';

export function verifierTrajet(t: Omit<Trajet, 'id'>): ErreurTrajet[] {
  const fautes: ErreurTrajet[] = [];
  if (!estDateIso(t.date)) fautes.push('date');
  if (!t.motif.trim()) fautes.push('motif');
  if (!t.depart.trim() || !t.arrivee.trim()) fautes.push('lieux');
  if (!Number.isFinite(t.km) || t.km <= 0 || t.km > 2_000) fautes.push('km');
  return fautes;
}

export const kmDuTrajet = (t: Pick<Trajet, 'km' | 'allerRetour'>): number => Math.round(t.km * (t.allerRetour ? 2 : 1) * 10) / 10;

export function tranche(km: number): 1 | 2 | 3 {
  return km <= SEUIL_1 ? 1 : km <= SEUIL_2 ? 2 : 3;
}

/** L'indemnité annuelle pour `km` kilomètres au total. */
export function indemniteAnnuelle(km: number, puissance: Puissance, electrique: boolean, bareme: Bareme = BAREME_2025): Centimes {
  if (!Number.isFinite(km) || km <= 0) return 0;
  const t = bareme.tranches[puissance];
  const n = tranche(km);
  // millièmes d'euro × km / 10 = centimes
  const brut = n === 1 ? (km * t.a) / 10 : n === 2 ? (km * t.b) / 10 + t.c : (km * t.e) / 10;
  return arrondiCentime(electrique ? (brut * (100 + bareme.majorationElectrique)) / 100 : brut);
}

/** La formule appliquée, lisible : « d × 0,357 + 1 395 € ». */
export function formule(km: number, puissance: Puissance, bareme: Bareme = BAREME_2025): { taux: number; fixe: Centimes } {
  const t = bareme.tranches[puissance];
  const n = tranche(km);
  return n === 1 ? { taux: t.a / 1000, fixe: 0 } : n === 2 ? { taux: t.b / 1000, fixe: t.c } : { taux: t.e / 1000, fixe: 0 };
}

/**
 * Répartit `total` au prorata de `poids` par la méthode des plus forts restes :
 * chaque part est arrondie vers le bas, puis les centimes manquants vont aux
 * plus grands restes (à égalité, au premier). La somme vaut exactement `total`.
 */
export function repartirAuProrata(total: Centimes, poids: readonly number[]): Centimes[] {
  const somme = poids.reduce((s, p) => s + p, 0);
  if (somme <= 0 || total === 0) return poids.map(() => 0);
  const exactes = poids.map((p) => (total * p) / somme);
  const parts = exactes.map((x) => Math.floor(x));
  let reste = total - parts.reduce((s, p) => s + p, 0);
  const ordre = exactes.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((u, v) => v.r - u.r || u.i - v.i);
  for (let k = 0; reste > 0; k = (k + 1) % ordre.length, reste -= 1) parts[ordre[k].i] += 1;
  return parts;
}

export interface Bilan {
  annee: number;
  kmTotal: number;
  indemnite: Centimes;
  tranche: 1 | 2 | 3;
  parTrajet: { trajet: Trajet; km: number; montant: Centimes }[];
  /** `AAAA-MM` → kilomètres et montant, dans l'ordre des mois. */
  parMois: { mois: string; km: number; montant: Centimes }[];
}

export function bilan(trajets: readonly Trajet[], annee: number, puissance: Puissance, electrique: boolean, bareme: Bareme = BAREME_2025): Bilan {
  const retenus = trajets.filter((t) => t.date.startsWith(`${annee}-`) && verifierTrajet(t).length === 0).sort((a, b) => a.date.localeCompare(b.date));
  const kms = retenus.map(kmDuTrajet);
  const kmTotal = Math.round(kms.reduce((s, k) => s + k, 0) * 10) / 10;
  const indemnite = indemniteAnnuelle(kmTotal, puissance, electrique, bareme);
  const parts = repartirAuProrata(indemnite, kms);
  const parTrajet = retenus.map((trajet, i) => ({ trajet, km: kms[i], montant: parts[i] }));
  const mois = new Map<string, { km: number; montant: Centimes }>();
  for (const p of parTrajet) {
    const m = p.trajet.date.slice(0, 7);
    const v = mois.get(m) ?? { km: 0, montant: 0 };
    mois.set(m, { km: Math.round((v.km + p.km) * 10) / 10, montant: v.montant + p.montant });
  }
  return {
    annee,
    kmTotal,
    indemnite,
    tranche: tranche(kmTotal),
    parTrajet,
    parMois: [...mois.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([m, v]) => ({ mois: m, ...v })),
  };
}
