import { useEffect, useState } from 'react';
import { toutesLesSections } from '../data/spaces';

/**
 * LES TEINTES DE FAMILLES — « où je suis », jamais « ce qui attend ».
 *
 * Une couleur par famille du rail (par CODE, stable dans les deux éditions),
 * définie en jeton CSS (`--famille-XX`, voir index.css). Ce module ne connaît
 * aucune valeur : il rend `var(--famille-XX)` et laisse la feuille décider.
 * Un choix du poste (`amn.teintes`, allumé par défaut) l'éteint d'un geste
 * dans Paramètres › Extensions ; les composants relisent par l'événement.
 */
export const CLE_TEINTES = 'amn.teintes';
export const EVENEMENT_TEINTES = 'amn:teintes';

export function teintesActives(): boolean {
  try {
    return window.localStorage.getItem(CLE_TEINTES) !== 'non';
  } catch {
    return true;
  }
}

export function ecrireTeintes(oui: boolean): void {
  try {
    window.localStorage.setItem(CLE_TEINTES, oui ? 'oui' : 'non');
  } catch {
    /* stockage refusé */
  }
  window.dispatchEvent(new Event(EVENEMENT_TEINTES));
}

export function useTeintes(): boolean {
  const [actives, setActives] = useState(teintesActives);
  useEffect(() => {
    const relire = () => setActives(teintesActives());
    window.addEventListener(EVENEMENT_TEINTES, relire);
    return () => window.removeEventListener(EVENEMENT_TEINTES, relire);
  }, []);
  return actives;
}

/** La couleur CSS d'un code de famille — `undefined` si les teintes sont éteintes ou le code inconnu. */
export function teinteFamille(code: string | null | undefined, actives = teintesActives()): string | undefined {
  if (!actives || !code || !/^[A-Z]{2}$/.test(code)) return undefined;
  return `var(--famille-${code})`;
}

/** La famille (code + nom) du chemin courant, par le catalogue — la plus précise quand deux chemins se recouvrent. */
export function familleDuChemin(pathname: string): { code: string; label: string } | null {
  let meilleure: { code: string; label: string; longueur: number } | null = null;
  for (const section of toutesLesSections()) {
    for (const item of section.items) {
      if (item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(`${item.to}/`)) {
        if (!meilleure || item.to.length > meilleure.longueur) meilleure = { code: section.code, label: section.label, longueur: item.to.length };
      }
    }
  }
  return meilleure ? { code: meilleure.code, label: meilleure.label } : null;
}
