import type { NavigateFunction } from 'react-router-dom';

/**
 * LA MÉMOIRE D'ONGLET, ET CE QU'ELLE NE DOIT JAMAIS RETENIR.
 *
 * Le poste rouvre là où l'on s'était arrêté (`amn.lastTab`). Mesuré sur
 * l'application empaquetée (scripts/sondes/veille-electron.mjs) : si l'on
 * ferme l'application pendant que la Salle de contrôle est affichée, elle se
 * rouvre SUR la Salle — restaurée par `navigate(last, { replace: true })`,
 * donc sans aucune page derrière elle. Or la Salle ne sort que par
 * `navigate(-1)` : Échap et « Quitter » ne mènent nulle part, la souris est
 * ignorée par conception, et fermer le processus rouvre au même endroit. Une
 * veille dont on ne sort plus.
 *
 * Deux règles, tenues ici et vérifiées par `check:veille` :
 *   1. un écran plein écran n'est jamais mémorisé comme « dernier onglet » ;
 *   2. en sortir ne suppose jamais qu'il y a une page derrière.
 */
export const ROUTES_SANS_MEMOIRE = ['/salle'] as const;

/** Vrai pour un écran qu'on peut retrouver au démarrage ; faux pour la Salle. */
export function routeMemorisable(pathname: string): boolean {
  return !ROUTES_SANS_MEMOIRE.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

/** Ce qu'on relit du stockage : rien pour la racine, rien pour un plein écran, même s'il y a été écrit par une version précédente. */
export function ongletMemorise(brut: string | null): string | null {
  if (!brut || brut === '/' || !routeMemorisable(brut)) return null;
  return brut;
}

/**
 * Sortir d'un plein écran : la page d'avant s'il y en a une, le poste sinon.
 * React Router numérote les entrées d'historique (`history.state.idx`) ; à 0,
 * il n'y a rien derrière — reculer serait un geste dans le vide.
 */
export function sortirDuPleinEcran(navigate: NavigateFunction): void {
  const etat = window.history.state as { idx?: number } | null;
  const idx = etat && typeof etat.idx === 'number' ? etat.idx : 0;
  if (idx > 0 && window.history.length > 1) navigate(-1);
  else navigate('/', { replace: true });
}
