import { HomeSoloScreen } from '../business/HomeSoloScreen';
import type { AccueilDef } from '../accueils/types';
import { ProchaineHeure } from '../accueils/client/ProchaineHeure';
import { LaUne } from '../accueils/client/LaUne';
import { MainCourante } from '../accueils/client/MainCourante';

/**
 * LES ONZE ACCUEILS DE L'ÉDITION CLIENTE — 2a et les dix variantes du cahier 9
 * (`40a` → `40j`, ACCUEILS.md). Aucune variante interne n'est importée ici :
 * le paquet client ne les contient pas.
 */
export const ACCUEILS: AccueilDef[] = [
  {
    code: '2a',
    nom: 'Le poste habité',
    phrase: 'La journée sur son axe, ce qui appelle, et la semaine.',
    vignette: [[6, 8, 88, 16, 'moyen'], [6, 12, 30, 8, 'ambre'], [6, 30, 55, 24, 'sombre'], [65, 30, 29, 24, 'sombre']],
    composant: HomeSoloScreen,
  },
  {
    code: '40a',
    nom: 'La prochaine heure',
    phrase: 'Le compte à rebours jusqu’au prochain rendez-vous qui demande une décision.',
    vignette: [[6, 8, 50, 34, 'ambre'], [62, 12, 32, 6, 'clair'], [62, 22, 26, 4, 'moyen'], [6, 48, 88, 6, 'sombre']],
    composant: ProchaineHeure,
  },
  {
    code: '40b',
    nom: 'La une',
    phrase: 'La journée racontée comme une première page, titre et brèves.',
    vignette: [[6, 6, 88, 3, 'clair'], [6, 13, 18, 5, 'ambre'], [6, 21, 60, 9, 'clair'], [6, 34, 70, 4, 'moyen'], [6, 44, 26, 12, 'sombre'], [37, 44, 26, 12, 'sombre'], [68, 44, 26, 12, 'sombre']],
    composant: LaUne,
  },
  {
    code: '40c',
    nom: 'La main courante',
    phrase: 'La journée en registre, le passé éteint au-dessus du trait « maintenant ».',
    vignette: [[6, 6, 88, 3, 'moyen'], [6, 12, 70, 3, 'moyen'], [6, 18, 60, 3, 'moyen'], [6, 26, 88, 3, 'ambre'], [6, 34, 80, 3, 'clair'], [6, 40, 64, 3, 'clair'], [6, 46, 72, 3, 'clair']],
    composant: MainCourante,
  },
];
