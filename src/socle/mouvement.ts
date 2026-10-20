import { useEffect, useState } from 'react';

/**
 * LE RÉGLAGE MOUVEMENT — complet, réduit, aucun.
 * ══════════════════════════════════════════════
 *
 * Un choix du POSTE, rangé comme les autres (`amn.teintes`, `amn.rail.index`) :
 * une clé `localStorage`, un événement de fenêtre pour prévenir les abonnés,
 * un hook. Rien ne part en synchronisation.
 *
 * ## Le défaut, quand rien n'est choisi
 *
 * Le système d'exploitation décide : s'il demande moins de mouvement
 * (`prefers-reduced-motion: reduce`), on part sur « réduit », sinon sur
 * « complet ». Un choix écrit l'emporte ensuite, dans les deux sens — y
 * compris « complet » sur un système qui demande moins, parce que c'est la
 * personne devant l'écran qui le dit.
 *
 * ## Ce que chaque niveau fait
 *
 *   complet — tout bouge comme prévu ;
 *   reduit  — framer-motion coupe position et échelle (les fondus restent :
 *             on voit encore qu'un panneau arrive), le CSS coupe les boucles ;
 *   aucun   — plus rien ne bouge : framer-motion saute chaque animation
 *             (`skipAnimations`), le CSS aussi.
 *
 * Le branchement (MotionConfig, attribut `data-mouvement` sur <html>) vit dans
 * `src/edition/socle.internal.tsx` : l'édition cliente ne lit pas ce réglage.
 */
export type NiveauMouvement = 'complet' | 'reduit' | 'aucun';
export const NIVEAUX_MOUVEMENT: readonly NiveauMouvement[] = ['complet', 'reduit', 'aucun'];

export const CLE_MOUVEMENT = 'amn.mouvement';
export const EVENEMENT_MOUVEMENT = 'amn:mouvement';

const REQUETE_SYSTEME = '(prefers-reduced-motion: reduce)';

function estNiveau(brut: unknown): brut is NiveauMouvement {
  return brut === 'complet' || brut === 'reduit' || brut === 'aucun';
}

/** Ce que le système demande, sans choix de la personne. */
export function systemeDemandeMoins(): boolean {
  try {
    return Boolean(window.matchMedia?.(REQUETE_SYSTEME).matches);
  } catch {
    return false;
  }
}

export function niveauParDefaut(systemeReduit = systemeDemandeMoins()): NiveauMouvement {
  return systemeReduit ? 'reduit' : 'complet';
}

/** Le choix écrit sur ce poste, ou `null` s'il n'y en a pas. */
export function choixMouvement(): NiveauMouvement | null {
  try {
    const brut = window.localStorage.getItem(CLE_MOUVEMENT);
    return estNiveau(brut) ? brut : null;
  } catch {
    return null;
  }
}

/** Le niveau en vigueur : le choix écrit, sinon celui du système. */
export function lireMouvement(): NiveauMouvement {
  return choixMouvement() ?? niveauParDefaut();
}

/** Écrit le choix (`null` = revenir au système) et prévient les abonnés. */
export function ecrireMouvement(niveau: NiveauMouvement | null): void {
  try {
    if (niveau) window.localStorage.setItem(CLE_MOUVEMENT, niveau);
    else window.localStorage.removeItem(CLE_MOUVEMENT);
  } catch {
    /* stockage refusé : le choix ne vaut que pour cette session */
  }
  window.dispatchEvent(new Event(EVENEMENT_MOUVEMENT));
}

/**
 * Le niveau en vigueur, relu à chaque changement — du réglage, mais aussi du
 * système quand la personne n'a rien choisi (la case cochée pendant que
 * l'application est ouverte doit prendre effet sans redémarrer).
 */
export function useMouvement(): NiveauMouvement {
  const [niveau, setNiveau] = useState(lireMouvement);
  useEffect(() => {
    const relire = () => setNiveau(lireMouvement());
    window.addEventListener(EVENEMENT_MOUVEMENT, relire);
    window.addEventListener('storage', relire);
    let requete: MediaQueryList | null = null;
    try {
      requete = window.matchMedia?.(REQUETE_SYSTEME) ?? null;
    } catch {
      requete = null;
    }
    requete?.addEventListener?.('change', relire);
    return () => {
      window.removeEventListener(EVENEMENT_MOUVEMENT, relire);
      window.removeEventListener('storage', relire);
      requete?.removeEventListener?.('change', relire);
    };
  }, []);
  return niveau;
}

/** Les réglages framer-motion d'un niveau — ce que reçoit le `MotionConfig` de la racine. */
export function configMotion(niveau: NiveauMouvement): { reducedMotion: 'never' | 'always'; skipAnimations: boolean } {
  if (niveau === 'complet') return { reducedMotion: 'never', skipAnimations: false };
  if (niveau === 'reduit') return { reducedMotion: 'always', skipAnimations: false };
  return { reducedMotion: 'always', skipAnimations: true };
}
