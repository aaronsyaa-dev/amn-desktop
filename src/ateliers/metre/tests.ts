import { doit, egal, vrai, type Test } from '../_commun/test';
import { MATERIAUX, PIECES } from './donnees';
import { coutTotal, enM2, quantitatif, quantiteACommander, surfacePiece, verifierMateriau, verifierPiece, versCm, type Piece } from './logique';

const sejour = PIECES[0];

export const TESTS: Test[] = [
  {
    nom: 'surfaces du séjour : sol 21,32 m², murs 41,42 m² (porte et deux fenêtres déduites)',
    f: () => {
      egal(surfacePiece(sejour, 'sol'), 213_200);
      egal(surfacePiece(sejour, 'plafond'), 213_200);
      egal(surfacePiece(sejour, 'murs'), 465_000 - 18_360 - 32_400);
      egal(enM2(surfacePiece(sejour, 'murs')), 41.42);
    },
  },
  {
    nom: 'quantitatif de l’exemple : 26 cartons, 16 L murs, 6 L plafond, 1 114,80 € HT',
    f: () => {
      const l = doit(quantitatif(PIECES, MATERIAUX));
      egal(
        l.map((x) => [x.ouvrage, x.surfaceCm2, x.quantite, x.cout]),
        [
          ['sol', 334_800, 26, 85_540],
          ['murs', 734_808, 16, 20_000],
          ['plafond', 334_800, 6, 5_940],
        ],
      );
      egal(coutTotal(l), 111_480);
    },
  },
  {
    nom: 'une division juste ne rajoute pas d’unité ; un cm² de plus en rajoute une',
    f: () => {
      const m = { ...MATERIAUX.sol, chute: 0 };
      egal(quantiteACommander(14_400, m), 1);
      egal(quantiteACommander(14_401, m), 2);
      egal(quantiteACommander(0, m), 0);
    },
  },
  {
    nom: 'les mètres tapés deviennent des centimètres entiers, sans erreur de virgule',
    f: () => {
      egal(versCm('4,25'), 425);
      egal(versCm('3.10'), 310);
      egal(versCm(0.1 + 0.2), 30);
      vrai(Number.isNaN(versCm('trois')), 'saisie illisible → NaN');
      egal(enM2(425 * 310), 13.18);
    },
  },
  {
    nom: 'une ouverture plus grande que le mur est refusée',
    f: () => {
      const p: Piece = { ...sejour, ouvertures: [{ nom: 'Baie', largeur: 600, hauteur: 200, nombre: 1 }] };
      egal(verifierPiece(p), ['ouverture']);
      egal(verifierPiece({ ...sejour, ouvertures: [{ nom: 'Porte', largeur: 90, hauteur: 260, nombre: 1 }] }), ['ouverture']);
      egal(quantitatif([p], MATERIAUX), null);
    },
  },
  {
    nom: 'des ouvertures qui mangent tous les murs sont refusées',
    f: () => {
      const p: Piece = { ...sejour, ouvertures: [{ nom: 'Vitrage', largeur: 500, hauteur: 250, nombre: 4 }] };
      egal(verifierPiece(p), ['ouverturesTropGrandes']);
    },
  },
  {
    nom: 'saisies impossibles refusées : nom vide, dimension nulle, rendement, couches, chute, prix',
    f: () => {
      egal(verifierPiece({ ...sejour, nom: ' ', longueur: 0 }), ['nom', 'dimensions']);
      egal(verifierPiece({ ...sejour, hauteur: Number.NaN }), ['dimensions']);
      egal(verifierMateriau({ ...MATERIAUX.murs, rendementM2: 0, couches: 0, chute: -1, prixUnitaire: Number.NaN }), ['rendement', 'couches', 'chute', 'prix']);
      egal(quantitatif([], MATERIAUX), null);
      egal(quantitatif(PIECES, { sol: { ...MATERIAUX.sol, rendementM2: 0 } }), null);
    },
  },
  {
    nom: 'un ouvrage sans matériau n’est pas compté',
    f: () => {
      const l = doit(quantitatif(PIECES, { sol: MATERIAUX.sol }));
      egal(l.map((x) => x.ouvrage), ['sol']);
    },
  },
];
