import { manifeste } from '../_commun/manifeste';

export const MODULE = manifeste({
  id: 'entretiens',
  route: '/visites-entretien',
  famille: 'outils',
  action: 'outils.terrain',
  verbes: ['planifier les visites d’entretien', 'voir les entretiens en retard', 'préparer la tournée d’entretien du mois', 'noter une visite faite'],
  motsCles: ['entretien', 'visite', 'maintenance', 'chaudière', 'climatisation', 'extincteur', 'vmc', 'contrat d’entretien', 'périodicité'],
  niveau: 'courant',
  nom: 'Visites d’entretien',
  pourQui: 'chauffagistes, frigoristes, techniciens de maintenance et de sécurité incendie',
  aValider: true,
  pourquoi: 'Aucune des sept familles ne dit « production / terrain » : rangé dans Outils, comme les autres modules de chantier.',
});
