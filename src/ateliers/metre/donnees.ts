import type { Materiau, Ouvrage, Piece } from './logique';

/** Bac à sable : un appartement fictif, deux pièces à carreler et repeindre. */
export const PIECES: Piece[] = [
  {
    id: 'sejour',
    nom: 'Séjour',
    longueur: 520,
    largeur: 410,
    hauteur: 250,
    ouvertures: [
      { nom: 'Porte', largeur: 90, hauteur: 204, nombre: 1 },
      { nom: 'Fenêtre', largeur: 120, hauteur: 135, nombre: 2 },
    ],
  },
  {
    id: 'chambre',
    nom: 'Chambre',
    longueur: 380,
    largeur: 320,
    hauteur: 250,
    ouvertures: [
      { nom: 'Porte', largeur: 83, hauteur: 204, nombre: 1 },
      { nom: 'Fenêtre', largeur: 100, hauteur: 125, nombre: 1 },
    ],
  },
];

export const MATERIAUX: Record<Ouvrage, Materiau> = {
  sol: { libelle: 'Carrelage 60 × 60', unite: 'carton', rendementM2: 1.44, couches: 1, chute: 10, prixUnitaire: 3_290 },
  murs: { libelle: 'Peinture murs, velours', unite: 'litre', rendementM2: 10, couches: 2, chute: 5, prixUnitaire: 1_250 },
  plafond: { libelle: 'Peinture plafond, mat', unite: 'litre', rendementM2: 12, couches: 2, chute: 5, prixUnitaire: 990 },
};
