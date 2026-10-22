import type React from 'react';

/**
 * LE SOCLE DE LA REFONTE, CÔTÉ CLIENTE — rien, délibérément.
 *
 * La refonte s'essaie d'abord dans l'édition interne. Ici la racine rend ses
 * enfants telle quelle (le `MotionConfig reducedMotion="user"` de
 * `src/renderer.tsx` reste seul en vigueur, comme avant), et la section de
 * réglages n'existe pas. Le paquet client ne contient ni le réglage
 * Mouvement, ni le bus de moments, ni ses mots.
 */
export function RacineSocle({ children }: { children: React.ReactNode }) {
  return children;
}

export function MouvementSection(): null {
  return null;
}

/** Le bus de moments n'existe pas côté cliente : un `emit` partagé y est inerte (ajout S2). */
export const emettreMoment: (type: string, charge: unknown) => void = () => undefined;
