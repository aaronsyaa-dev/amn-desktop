import type { NiveauMouvement } from '../../socle/mouvement';

/**
 * La durée du lancement (ms, avant le fondu de sortie) — pure, pour les contrôles.
 *
 *   · environ 2 s au premier lancement sur ce poste, moins d'1 s ensuite ;
 *   · plus court sur un appareil modeste ;
 *   · « réduit » : des fondus seulement ; « aucun » : à peine le temps de le voir.
 */
export function dureeLancement(premier: boolean, modeste: boolean, niveau: NiveauMouvement): number {
  if (niveau === 'aucun') return 450;
  if (niveau === 'reduit') return premier ? 1000 : 600;
  if (modeste) return premier ? 1300 : 700;
  return premier ? 2000 : 950;
}
