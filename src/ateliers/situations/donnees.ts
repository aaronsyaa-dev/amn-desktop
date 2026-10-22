import type { Avancements, Marche } from './logique';

/**
 * Bac à sable : la rénovation fictive d'une maison, six lots, 37 000 € HT.
 * Deux situations déjà facturées ; la troisième est en cours de saisie.
 */
export const MARCHE: Marche = {
  lots: [
    { id: 'demol', libelle: 'Démolition et évacuation', montantHT: 320_000, tauxTva: 10 },
    { id: 'platre', libelle: 'Plâtrerie et cloisons', montantHT: 960_000, tauxTva: 10 },
    { id: 'elec', libelle: 'Électricité', montantHT: 740_000, tauxTva: 10 },
    { id: 'isol', libelle: 'Isolation des combles', montantHT: 560_000, tauxTva: 5.5 },
    { id: 'peint', libelle: 'Peinture', montantHT: 430_000, tauxTva: 10 },
    { id: 'cuisine', libelle: 'Cuisine équipée, fourniture et pose', montantHT: 690_000, tauxTva: 20 },
  ],
  acompteTTC: 500_000,
  tauxRetenue: 5,
};

export const HISTORIQUE: readonly Avancements[] = [
  { demol: 100, platre: 30 },
  { demol: 100, platre: 70, elec: 40, isol: 100 },
];

export const COURANT: Avancements = { demol: 100, platre: 100, elec: 80, isol: 100, peint: 20, cuisine: 0 };

export const CHANTIER = 'Rénovation d’une maison, chantier fictif n° 0427';
