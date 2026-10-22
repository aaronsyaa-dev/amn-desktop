import { manifeste } from '../_commun/manifeste';

export const MODULE = manifeste({
  id: 'duerp',
  route: '/document-unique',
  famille: 'outils',
  action: 'outils.conformite',
  verbes: ['évaluer les risques professionnels', 'tenir mon document unique', 'préparer le plan d’action prévention', 'mettre à jour le DUERP'],
  motsCles: ['duerp', 'document unique', 'risques professionnels', 'prévention', 'sécurité', 'santé au travail', 'criticité'],
  niveau: 'courant',
  nom: 'Document unique des risques',
  pourQui: 'toute entreprise dès le premier salarié',
});
