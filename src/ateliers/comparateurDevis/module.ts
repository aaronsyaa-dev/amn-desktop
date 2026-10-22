import { manifeste } from '../_commun/manifeste';

export const MODULE = manifeste({
  id: 'comparateurDevis',
  route: '/comparer-des-devis',
  famille: 'argent',
  action: 'argent.depenser',
  verbes: ['comparer des devis', 'choisir un fournisseur', 'comparer des offres fournisseurs', 'repérer une offre trop basse'],
  motsCles: ['devis fournisseur', 'comparatif', 'appel d’offres', 'consultation', 'achat', 'offre', 'critères'],
  niveau: 'courant',
  nom: 'Comparateur de devis fournisseurs',
  pourQui: 'PME et artisans qui consultent plusieurs fournisseurs ou sous-traitants',
});
