import { manifeste } from '../_commun/manifeste';

export const MODULE = manifeste({
  id: 'tauxHoraire',
  route: '/taux-horaire',
  famille: 'argent',
  action: 'argent.prevoir',
  verbes: ['calculer mon taux horaire', 'fixer mon prix de journée', 'savoir combien facturer de l’heure', 'vérifier si mon tarif couvre mes charges'],
  motsCles: ['taux horaire', 'tjm', 'prix de journée', 'tarif', 'coût de revient', 'heure facturable', 'seuil'],
  niveau: 'essentiel',
  nom: 'Taux horaire de revient',
  pourQui: 'indépendants, artisans et petites équipes qui vendent du temps',
});
