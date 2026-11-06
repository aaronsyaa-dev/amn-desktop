/**
 * LA COQUILLE DE LA REFONTE (session DS), CÔTÉ INTERNE — ce que l'édition
 * interne branche.
 *
 * Le code vit dans `src/socle/coquille/` (le dessin) et `src/refonte/coquille/`
 * (les données). `AppLayout` et les Réglages passent par l'alias
 * `@edition/coquille` : l'édition cliente reçoit `coquille.business.tsx`, qui
 * n'importe rien — le paquet client ne contient pas une ligne de la coquille.
 */
export { CoquilleRefonte } from '../refonte/coquille/CoquilleRefonte';
export { CoquilleSection } from '../refonte/coquille/CoquilleSection';
export { useCoquilleActive } from '../refonte/coquille/drapeau';
/** « Aujourd'hui » : un seul calcul pour la barre latérale et l'Accueil, monté une fois dans `AppLayout`. */
export { FournisseurAujourdhui } from '../refonte/coquille/aujourdhui';
/** L'écran de veille v3 (G09), monté par `IdleScreensaver` quand la nouvelle coquille est allumée. */
export { EcranDeVeille } from '../refonte/systeme/veille/EcranDeVeille';
