import { manifeste } from '../_commun/manifeste';

export const MODULE = manifeste({
  id: 'indemnitesKm',
  route: '/indemnites-kilometriques',
  famille: 'argent',
  action: 'argent.depenser',
  verbes: ['calculer mes indemnités kilométriques', 'noter un trajet professionnel', 'appliquer le barème kilométrique', 'déduire mes frais de voiture'],
  motsCles: ['ik', 'indemnités kilométriques', 'barème kilométrique', 'kilomètres', 'trajet', 'frais réels', 'voiture', 'cv'],
  niveau: 'essentiel',
  nom: 'Indemnités kilométriques',
  pourQui: 'indépendants et salariés qui roulent avec leur voiture personnelle',
});
