import type React from 'react';

/**
 * SUBSTITUER UN ÉCRAN — édition interne, refonte (STATUT § 1.3).
 * ═══════════════════════════════════════════════════════════════
 *
 * Les écrans à refondre vivent dans `src/screens/**`, partagés avec l'édition
 * cliente, et sont montés un par un dans `appRoot.internal.tsx`. Un lot ne
 * touche ni à l'un ni à l'autre : il écrit son écran refondu dans
 * `src/refonte/<lot>/`, puis le déclare ici, dans
 * `src/refonte/substitutions/declarations/<lot>.tsx` — un fichier par lot,
 * ramassé seul (`registre.ts`), sans liste à tenir ailleurs.
 *
 * La coque interne (`AppLayout`, `ClientContextLayout`) a un seul point de
 * substitution par `<Outlet />` (`SubstitutionDEcran`) : quand le chemin
 * courant est déclaré, c'est le substitut qui est rendu à la place de la
 * route d'origine ; sinon, l'écran d'origine, à l'identique. Les 164 routes
 * ne bougent pas, et l'édition cliente ne reçoit rien (jumeau
 * `substitutions.business.tsx` inerte).
 *
 *   export default declarerSubstitutions('jour', [
 *     { route: '/tasks', composant: lazy(() => import('../../jour/PageTaches')) },
 *   ]);
 *
 * `npm run check:substitutions` refuse une route absente de
 * `appRoot.internal.tsx`, une route déclarée deux fois, un substitut hors de
 * `src/refonte/<lot>/` ou qui importe `src/screens/**`.
 */
export interface Substitution {
  /** Le chemin EXACT de la route d'origine dans `appRoot.internal.tsx` (`'/tasks'`, `'/garde/bureaux/:equipe'`). */
  route: string;
  /**
   * La garde `ModuleRoute` de la route d'origine (même clé de module), quand elle en a une : un module fermé à
   * l'organisation renvoie à l'Accueil, substitut ou non.
   */
  module?: string;
  /** L'écran refondu, de `src/refonte/<lot>/` ; de préférence paresseux (`lazy`). */
  composant: React.ComponentType | React.LazyExoticComponent<React.ComponentType>;
  /**
   * En session de support cliente (`ClientContextLayout`) : `'identique'` rend le même substitut, `'aucune'`
   * (le défaut) laisse l'écran d'origine, celui que la cliente a sous les yeux.
   */
  support?: 'identique' | 'aucune';
  /** Vrai : le substitut est rendu même coquille éteinte. Faux (le défaut) : seulement quand la nouvelle coquille est allumée. */
  toujours?: boolean;
}

/** Ce qu'un fichier de `declarations/` exporte par défaut. */
export interface DeclarationSubstitutions {
  /** Le lot : le nom du dossier `src/refonte/<lot>/` où vivent les substituts. */
  lot: string;
  substitutions: readonly Substitution[];
}

export function declarerSubstitutions(lot: string, substitutions: readonly Substitution[]): DeclarationSubstitutions {
  return { lot, substitutions };
}
