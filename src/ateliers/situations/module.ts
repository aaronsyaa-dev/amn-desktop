import { manifeste } from '../_commun/manifeste';

export const MODULE = manifeste({
  id: 'situations',
  route: '/situations-de-travaux',
  famille: 'argent',
  action: 'argent.facturer',
  verbes: ['facturer une situation de travaux', 'facturer à l’avancement', 'calculer une retenue de garantie', 'déduire un acompte d’une situation'],
  motsCles: ['situation', 'avancement', 'retenue de garantie', 'chantier', 'lot', 'btp', 'marché de travaux', 'acompte'],
  niveau: 'expert',
  nom: 'Situations de travaux',
  pourQui: 'artisans et entreprises du bâtiment qui facturent un chantier à l’avancement',
});
