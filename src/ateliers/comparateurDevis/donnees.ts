import { POIDS_PAR_DEFAUT, type Offre, type Poids } from './logique';

/** Bac à sable : la réfection d'une toiture d'entrepôt, quatre couvreurs fictifs. */
export const BESOIN = 'Réfection de la toiture de l’entrepôt (420 m²)';

export const OFFRES: Offre[] = [
  { id: 'a', fournisseur: 'Couvertures du Plateau', prixHT: 3_840_000, delaiJours: 45, garantieMois: 120, qualite: 4, acomptePct: 30 },
  { id: 'b', fournisseur: 'Toits Martin & Fils', prixHT: 3_520_000, delaiJours: 60, garantieMois: 120, qualite: 3, acomptePct: 30 },
  { id: 'c', fournisseur: 'Atelier Zinc Lumière', prixHT: 4_210_000, delaiJours: 21, garantieMois: 120, qualite: 5, acomptePct: 20 },
  { id: 'd', fournisseur: 'Express Toiture Services', prixHT: 2_480_000, delaiJours: 14, garantieMois: 24, qualite: 2, acomptePct: 50 },
];

export const POIDS: Poids = { ...POIDS_PAR_DEFAUT };
