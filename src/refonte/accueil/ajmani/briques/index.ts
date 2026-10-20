/**
 * LES BRIQUES D'AJMANI — de quoi bâtir un robot de la même famille (S4).
 *
 * Un robot = un `<svg viewBox="0 0 200 220">` qui empile, dans cet ordre :
 *   DefsAjmani (avec useIdsAjmani), Ombre, Cable, Corps, Bras × 2,
 *   TeteTele (avec Antenne, Visage, et un `accessoire` à soi).
 * Les poses viennent de `../expressions` (POSES, ou les vôtres), les couleurs
 * d'un objet `Teintes` (TEINTES_AJMANI comme modèle). Le composant `Ajmani`
 * montre l'assemblage complet, gestes et réglage Mouvement compris.
 */
export { CADRE, CADRE_TETE, ATTACHES, TEINTES_AJMANI, pivot, type Teintes } from './commun';
export { DefsAjmani, useIdsAjmani, ECRAN, type IdsAjmani } from './Defs';
export { Corps, Bras } from './Corps';
export { TeteTele, Antenne, Cable, Ombre } from './TeteTele';
export { Visage, Glitch } from './Visage';
