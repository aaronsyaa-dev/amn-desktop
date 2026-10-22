import { manifeste } from '../_commun/manifeste';

export const MODULE = manifeste({
  id: 'amortissements',
  route: '/amortissements',
  famille: 'argent',
  action: 'argent.comptabilite',
  verbes: ['amortir un achat', 'calculer une dotation aux amortissements', 'voir la valeur nette d’un équipement', 'préparer la clôture de l’exercice'],
  motsCles: ['amortissement', 'immobilisation', 'dotation', 'prorata temporis', 'valeur nette comptable', 'vnc', 'linéaire', 'bilan'],
  niveau: 'avance',
  nom: 'Tableau d’amortissement',
  pourQui: 'indépendants et sociétés au régime réel qui achètent du matériel',
});
