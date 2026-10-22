import type { Calendrier, Etape } from './logique';

/** Bac à sable : l'agencement d'une boutique fictive, promis pour le vendredi 18 décembre 2026. */
export const PROJET = 'Agencement de la boutique « Le Comptoir des Thés »';
export const LIVRAISON = '2026-12-18';
export const TAMPON = 3;
export const CALENDRIER: Calendrier = { samediOuvre: false, feries: true };

export const ETAPES: Etape[] = [
  { id: 'releve', nom: 'Relevé sur place et plans', duree: 3, unite: 'ouvres' },
  { id: 'validation', nom: 'Validation par le client', duree: 5, unite: 'ouvres' },
  { id: 'commande', nom: 'Commande des matériaux', duree: 2, unite: 'ouvres' },
  { id: 'fournisseur', nom: 'Délai du fournisseur', duree: 15, unite: 'calendaires' },
  { id: 'fabrication', nom: 'Fabrication en atelier', duree: 10, unite: 'ouvres' },
  { id: 'pose', nom: 'Pose sur site', duree: 4, unite: 'ouvres' },
  { id: 'reception', nom: 'Réception et levée des réserves', duree: 1, unite: 'ouvres' },
];
