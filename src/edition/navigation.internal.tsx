/**
 * LA NAVIGATION DE LA REFONTE (S1), CÔTÉ INTERNE — ce que l'édition interne branche.
 *
 * Le code vit dans `src/refonte/navigation/` ; ce fichier n'en est que la
 * porte. Le code partagé (`Sidebar`, `AppLayout`, la palette de commandes)
 * passe par l'alias `@edition/navigation`, qui pointe ici dans l'édition
 * interne et vers `navigation.business.tsx` (vide) dans l'édition cliente :
 * rien de la refonte n'entre dans le paquet client.
 */
export { RailDuMoment } from '../refonte/navigation/RailDuMoment';
export { TousLesModules } from '../refonte/navigation/TousLesModules';
export { RaccourciAccueil } from '../refonte/navigation/RaccourciAccueil';
export { chercherModules, placeholderRecherche } from '../refonte/navigation/palette';
export { restaurerDernierOnglet } from '../refonte/navigation/ouverture';
export { ROUTE_TOUS_LES_MODULES } from '../refonte/navigation/moment';

/** Vrai : l'édition interne montre le rail du moment à la place des tuiles à deux lettres. */
export const NAVIGATION_REFONTE = true;
