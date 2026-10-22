import type { SousTraitant } from './logique';

/** Bac à sable : une entreprise générale fictive et cinq sous-traitants inventés. Aucun SIREN. */
export const DONNEUR_D_ORDRE = 'Bâtisseurs du Val (fictive)';

export const SOUS_TRAITANTS: readonly SousTraitant[] = [
  {
    id: 's1',
    nom: 'Élec Durand (fictive)',
    metier: 'Électricité',
    contact: 'Paul Durand',
    montantContrat: 1_840_000,
    pieces: { urssaf: '2026-07-01', immatriculation: '2026-09-15', assurance: '2027-03-31' },
  },
  {
    id: 's2',
    nom: 'Plâtrerie Morel (fictive)',
    metier: 'Plâtrerie, isolation',
    contact: 'Inès Morel',
    montantContrat: 920_000,
    pieces: { urssaf: '2026-04-30', immatriculation: '2026-08-20', assurance: '2026-12-31' },
  },
  {
    id: 's3',
    nom: 'Carrelages Sud Atlantique (fictive)',
    metier: 'Carrelage',
    contact: 'Hugo Martin',
    montantContrat: 1_260_000,
    pieces: { urssaf: '2026-03-10', immatriculation: '2026-10-01' },
  },
  {
    id: 's4',
    nom: 'Toitures Lemaire (fictive)',
    metier: 'Couverture',
    contact: 'Sarah Lemaire',
    montantContrat: 2_700_000,
    pieces: { urssaf: '2026-09-01', assurance: '2026-10-15' },
  },
  {
    id: 's5',
    nom: 'Nettoyage Express (fictive)',
    metier: 'Nettoyage de fin de chantier',
    contact: 'Yanis Roux',
    montantContrat: 240_000,
    pieces: { assurance: '2027-06-30' },
  },
];
