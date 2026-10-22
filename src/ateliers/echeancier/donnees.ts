import type { Echeancier } from './logique';

/** Bac à sable : trois échéanciers fictifs d'une menuiserie. */
export const ECHEANCIERS: Echeancier[] = [
  {
    id: 'e1',
    client: 'Client fictif Arnaud',
    reference: 'F-2026-041',
    objet: 'Cuisine sur mesure',
    montantTTC: 480_000,
    acompte: 144_000,
    nombre: 4,
    premiereDate: '2026-08-31',
    payees: [0, 1],
  },
  {
    id: 'e2',
    client: 'Client fictif Benali',
    reference: 'F-2026-052',
    objet: 'Dressing et portes de placard',
    montantTTC: 735_125,
    acompte: 0,
    nombre: 3,
    premiereDate: '2026-09-15',
    payees: [0],
  },
  {
    id: 'e3',
    client: 'Client fictif Castel',
    reference: 'F-2026-063',
    objet: 'Bibliothèque murale',
    montantTTC: 100_000,
    acompte: 0,
    nombre: 12,
    premiereDate: '2026-11-05',
    payees: [],
  },
];
