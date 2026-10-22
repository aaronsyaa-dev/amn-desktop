import type { Immobilisation } from './logique';

/** Bac à sable : l'atelier d'une menuiserie fictive, exercice clos au 31 décembre. */
export const IMMOS_EXEMPLE: Immobilisation[] = [
  { id: 'scie', designation: 'Scie à format', valeur: 1_200_000, miseEnService: '2026-04-01', dureeAnnees: 5 },
  { id: 'utilitaire', designation: 'Fourgon utilitaire', valeur: 2_850_000, miseEnService: '2025-09-15', dureeAnnees: 4 },
  { id: 'portable', designation: 'Ordinateur portable', valeur: 145_000, miseEnService: '2026-01-20', dureeAnnees: 3 },
  { id: 'aspirateur', designation: 'Aspirateur d’atelier', valeur: 42_000, miseEnService: '2026-05-10', dureeAnnees: 3 },
];

export const EXERCICE_EXEMPLE = 2026;
