import type { Puissance, Trajet } from './logique';

/** Bac à sable : le journal fictif d'une plombière indépendante, autour de Lyon, en 2026. */
export const ANNEE_EXEMPLE = 2026;
export const PUISSANCE_EXEMPLE: Puissance = '5';

export const TRAJETS: Trajet[] = [
  { id: 't1', date: '2026-01-12', motif: 'Dépannage chauffe-eau, client fictif A', depart: 'Lyon 7e', arrivee: 'Vénissieux', km: 9.4, allerRetour: true },
  { id: 't2', date: '2026-01-27', motif: 'Fournitures chez le grossiste', depart: 'Lyon 7e', arrivee: 'Saint-Priest', km: 14.2, allerRetour: true },
  { id: 't3', date: '2026-02-09', motif: 'Salle de bains, chantier fictif B', depart: 'Lyon 7e', arrivee: 'Villefranche-sur-Saône', km: 36.5, allerRetour: true },
  { id: 't4', date: '2026-02-10', motif: 'Salle de bains, chantier fictif B', depart: 'Lyon 7e', arrivee: 'Villefranche-sur-Saône', km: 36.5, allerRetour: true },
  { id: 't5', date: '2026-03-16', motif: 'Formation gaz', depart: 'Lyon 7e', arrivee: 'Grenoble', km: 112, allerRetour: true },
  { id: 't6', date: '2026-04-03', motif: 'Devis, client fictif C', depart: 'Lyon 7e', arrivee: 'Bron', km: 8.1, allerRetour: true },
  { id: 't7', date: '2026-05-21', motif: 'Chantier cuisine, client fictif D', depart: 'Lyon 7e', arrivee: 'Vienne', km: 33.8, allerRetour: true },
  { id: 't8', date: '2026-06-08', motif: 'Salon professionnel', depart: 'Lyon 7e', arrivee: 'Clermont-Ferrand', km: 168, allerRetour: true },
  { id: 't9', date: '2026-07-02', motif: 'Dépannage fuite, client fictif E', depart: 'Lyon 7e', arrivee: 'Caluire-et-Cuire', km: 7.6, allerRetour: true },
  { id: 't10', date: '2026-09-14', motif: 'Rénovation, chantier fictif F', depart: 'Lyon 7e', arrivee: 'Bourg-en-Bresse', km: 78.3, allerRetour: true },
  { id: 't11', date: '2026-09-15', motif: 'Rénovation, chantier fictif F', depart: 'Lyon 7e', arrivee: 'Bourg-en-Bresse', km: 78.3, allerRetour: true },
  { id: 't12', date: '2026-10-05', motif: 'Livraison de pièces chez un confrère', depart: 'Lyon 7e', arrivee: 'Saint-Étienne', km: 61.7, allerRetour: false },
];
