import { useSyncExternalStore } from 'react';

/**
 * LE DRAPEAU DE LA COQUILLE — nouvelle coquille ou ancienne, par poste.
 *
 * Deux coquilles cohabitent encore dans l'édition interne : l'ancienne
 * (`AppLayout` avec son rail, `Sidebar`, `TopBar`, `StatusRail`) et la
 * nouvelle (`CoquilleRefonte`, noir et gris, une seule navigation). Tant que
 * Harun et le CO n'ont pas tranché, la nouvelle est ÉTEINTE par défaut : rien
 * ne change pour personne. Elle s'allume dans Paramètres (« Nouvelle coquille »),
 * sur ce poste seulement, ou par `localStorage['amn.coquille'] = 'noir'`.
 *
 * Le jour du basculement : le défaut passe à « allumée » ici, et les gardes
 * qui mesurent l'ancienne colonne (`check:coquille`) évoluent — décidé par
 * Harun et le CO, jamais contourné.
 */
export const CLE_COQUILLE = 'amn.coquille';
const EVENEMENT = 'amn:coquille';

export function lireCoquille(): boolean {
  try {
    return window.localStorage.getItem(CLE_COQUILLE) === 'noir';
  } catch {
    return false;
  }
}

export function ecrireCoquille(actif: boolean): void {
  try {
    if (actif) window.localStorage.setItem(CLE_COQUILLE, 'noir');
    else window.localStorage.removeItem(CLE_COQUILLE);
  } catch {
    /* stockage refusé : le choix ne vaut que jusqu'au rechargement */
  }
  window.dispatchEvent(new Event(EVENEMENT));
}

const abonner = (rappel: () => void) => {
  window.addEventListener(EVENEMENT, rappel);
  window.addEventListener('storage', rappel);
  return () => {
    window.removeEventListener(EVENEMENT, rappel);
    window.removeEventListener('storage', rappel);
  };
};

/** Vrai quand ce poste a allumé la nouvelle coquille. */
export function useCoquilleActive(): boolean {
  return useSyncExternalStore(abonner, lireCoquille, () => false);
}
