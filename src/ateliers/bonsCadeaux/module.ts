import { manifeste } from '../_commun/manifeste';

export const MODULE = manifeste({
  id: 'bonsCadeaux',
  route: '/bons-cadeaux',
  famille: 'argent',
  action: 'argent.vendre',
  verbes: ['vendre un bon cadeau', 'encaisser un bon cadeau', 'vérifier le solde d’un bon', 'voir les bons expirés'],
  motsCles: ['bon cadeau', 'carte cadeau', 'chèque cadeau', 'avoir client', 'code', 'solde', 'prépayé'],
  niveau: 'courant',
  nom: 'Bons cadeaux',
  pourQui: 'commerces, salons, restaurants et artisans qui vendent des bons prépayés',
});
