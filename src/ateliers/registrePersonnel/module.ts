import { manifeste } from '../_commun/manifeste';

export const MODULE = manifeste({
  id: 'registrePersonnel',
  route: '/registre-du-personnel',
  famille: 'outils',
  action: 'outils.conformite',
  verbes: ['tenir le registre du personnel', 'inscrire une embauche', 'noter une sortie de salarié', 'vérifier un titre de travail'],
  motsCles: ['registre unique du personnel', 'rup', 'embauche', 'entrée', 'sortie', 'salarié', 'stagiaire', 'titre de séjour', 'inspection du travail'],
  niveau: 'courant',
  nom: 'Registre unique du personnel',
  pourQui: 'tout employeur, dès le premier salarié',
});
