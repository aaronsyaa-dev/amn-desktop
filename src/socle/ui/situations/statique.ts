import type React from 'react';

/**
 * Les boutons d'un aperçu statique (page de démonstration H43, tests de rendu).
 *
 * `aria-disabled` plutôt que `disabled` : le bouton reste un arrêt de tabulation (on voit son anneau de focus,
 * on vérifie qu'il est atteignable) et garde son aspect de repos — un `disabled` le grisserait, et la page de
 * démonstration montre les boutons tels qu'ils sont dans l'application. Le clic, lui, ne fait rien.
 */
export const SANS_ACTION = (): void => undefined;

export function propsBouton(statique: boolean | undefined, onClick?: () => void): { 'aria-disabled'?: true; onClick?: React.MouseEventHandler<HTMLButtonElement> } {
  if (statique) return { 'aria-disabled': true, onClick: (e) => e.preventDefault() };
  return { onClick };
}
