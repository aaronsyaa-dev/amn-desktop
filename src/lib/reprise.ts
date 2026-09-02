import { useSyncExternalStore } from 'react';

/**
 * « RECONNEXION EN COURS » — un seul interrupteur pour tout le poste.
 *
 * Le transport (lib/bridge.ts) l'allume quand une lecture attend un serveur
 * qui redémarre, et l'éteint quand elle aboutit ou renonce. Le bandeau d'état
 * et la pastille de synchronisation le lisent. Plusieurs lectures peuvent
 * attendre en même temps : on compte, et l'écran ne s'éteint qu'à zéro.
 */
let attentes = 0;
const abonnes = new Set<() => void>();

export function signalerReprise(enCours: boolean): void {
  attentes = Math.max(0, attentes + (enCours ? 1 : -1));
  for (const f of abonnes) f();
}

function lire(): boolean {
  return attentes > 0;
}

function souscrire(f: () => void): () => void {
  abonnes.add(f);
  return () => abonnes.delete(f);
}

/** Vrai tant qu'au moins une lecture attend le retour du serveur. */
export function useReprise(): boolean {
  return useSyncExternalStore(souscrire, lire, () => false);
}
