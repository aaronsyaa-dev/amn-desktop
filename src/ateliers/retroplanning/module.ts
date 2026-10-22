import { manifeste } from '../_commun/manifeste';

export const MODULE = manifeste({
  id: 'retroplanning',
  route: '/retroplanning',
  famille: 'jour',
  action: 'jour.organiser',
  verbes: ['faire un rétroplanning', 'savoir quand commencer', 'tenir une date de livraison', 'planifier à rebours'],
  motsCles: ['rétroplanning', 'retroplanning', 'échéance', 'date butoir', 'deadline', 'livraison', 'planning', 'jours ouvrés'],
  niveau: 'essentiel',
  nom: 'Rétroplanning',
  pourQui: 'tous les métiers qui promettent une date : artisans, agences, ateliers',
});
