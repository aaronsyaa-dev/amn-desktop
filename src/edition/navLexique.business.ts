import {
  NAV_EN_COMMUN,
  SECTIONS_EN_COMMUN,
  type TraductionNav,
} from '../i18n/nav.en';

/**
 * Le lexique anglais de navigation — ÉDITION BUSINESS.
 *
 * Rien que le tronc commun : les modules que cette édition livre. Les entrées
 * internes (produits, Tour de contrôle, espaces) vivent dans
 * `navLexique.internal.ts` et ne sont jamais compilées ici — c'est le contrôle
 * de pureté du bundle qui tient la frontière.
 */

export const NAV_EN: Record<string, TraductionNav> = NAV_EN_COMMUN;

export const SECTIONS_EN: Record<string, string> = SECTIONS_EN_COMMUN;

/** Pas d'espaces dans cette édition — le sélecteur n'y existe pas. */
export const ESPACES_EN: Record<string, { label: string; hint: string }> = {};
