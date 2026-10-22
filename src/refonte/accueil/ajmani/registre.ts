import { useEffect, useState } from 'react';

/**
 * LE REGISTRE D'AJMANI — Sérieux, Chill, Taquin.
 * ══════════════════════════════════════════════
 *
 * Un choix du POSTE, rangé comme le réglage Mouvement du socle : une clé
 * `localStorage`, un événement de fenêtre, un hook. Rien ne part en
 * synchronisation.
 *
 * Le registre est un PLAFOND, pas une obligation : en « Taquin », Ajmani peut
 * être taquin, chill ou sérieux ; en « Sérieux », il ne l'est jamais plus.
 * Et quoi qu'on ait choisi, il est sérieux face à une alerte, une facture très
 * en retard ou un problème de sécurité (voir `phrases.ts`).
 */
export type Registre = 'serieux' | 'chill' | 'taquin';
export const REGISTRES: readonly Registre[] = ['serieux', 'chill', 'taquin'];
export const REGISTRE_DEFAUT: Registre = 'chill';

export const CLE_REGISTRE = 'amn.ajmani.registre';
export const EVENEMENT_REGISTRE = 'amn:ajmani-registre';

export function estRegistre(brut: unknown): brut is Registre {
  return brut === 'serieux' || brut === 'chill' || brut === 'taquin';
}

export function lireRegistre(): Registre {
  try {
    const brut = window.localStorage.getItem(CLE_REGISTRE);
    return estRegistre(brut) ? brut : REGISTRE_DEFAUT;
  } catch {
    return REGISTRE_DEFAUT;
  }
}

export function ecrireRegistre(registre: Registre): void {
  try {
    window.localStorage.setItem(CLE_REGISTRE, registre);
  } catch {
    /* stockage refusé : le choix ne vaut que pour cette session */
  }
  window.dispatchEvent(new Event(EVENEMENT_REGISTRE));
}

export function useRegistre(): Registre {
  const [registre, setRegistre] = useState(lireRegistre);
  useEffect(() => {
    const relire = () => setRegistre(lireRegistre());
    window.addEventListener(EVENEMENT_REGISTRE, relire);
    window.addEventListener('storage', relire);
    return () => {
      window.removeEventListener(EVENEMENT_REGISTRE, relire);
      window.removeEventListener('storage', relire);
    };
  }, []);
  return registre;
}
