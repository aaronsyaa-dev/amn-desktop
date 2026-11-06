/**
 * LA SUBSTITUTION D'ÉCRANS (refonte, STATUT § 1.3), CÔTÉ INTERNE — ce que l'édition interne branche.
 *
 * Le code vit dans `src/refonte/substitutions/` (le registre ramassé dans
 * `declarations/`, et le point unique `SubstitutionDEcran`). `AppLayout` et
 * `ClientContextLayout` passent par l'alias `@edition/substitutions` :
 * l'édition cliente reçoit `substitutions.business.tsx`, qui rend l'`Outlet`
 * et n'importe rien — le paquet client ne contient pas une ligne de la
 * refonte.
 */
export { SubstitutionDEcran } from '../refonte/substitutions/SubstitutionDEcran';
export { REGISTRE_SUBSTITUTIONS } from '../refonte/substitutions/registre';
