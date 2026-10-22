import type { NiveauMouvement } from '../../socle/mouvement';

/**
 * La durée du lancement (ms, avant le fondu de sortie) — pure, pour les contrôles.
 *
 *   · environ 1 s au premier lancement sur ce poste, plus court ensuite ;
 *   · plus court sur un appareil modeste ;
 *   · « réduit » : des fondus seulement ; « aucun » : à peine le temps de le voir.
 */
export function dureeLancement(premier: boolean, modeste: boolean, niveau: NiveauMouvement): number {
  if (niveau === 'aucun') return 300;
  if (niveau === 'reduit') return premier ? 800 : 500;
  if (modeste) return premier ? 800 : 500;
  return premier ? 1000 : 650;
}

/** Un appareil modeste : peu de cœurs, peu de mémoire, ou économie de données demandée. */
export function appareilModeste(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4 || Boolean(nav.connection?.saveData);
}
