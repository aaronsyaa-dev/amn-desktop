import { HomeSoloScreen } from '../business/HomeSoloScreen';
import type { AccueilDef } from '../accueils/types';
import { ProchaineHeure } from '../accueils/client/ProchaineHeure';
import { LaUne } from '../accueils/client/LaUne';
import { MainCourante } from '../accueils/client/MainCourante';
import { FileUnique } from '../accueils/client/FileUnique';
import { SemaineDepliee } from '../accueils/client/SemaineDepliee';
import { Cadran } from '../accueils/client/Cadran';
import { Lettre } from '../accueils/client/Lettre';
import { Ecarts } from '../accueils/client/Ecarts';
import { Tiroirs } from '../accueils/client/Tiroirs';
import { Seuil } from '../accueils/client/Seuil';

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
  {
    code: '40d',
    nom: 'La file unique',
    phrase: 'Une seule liste des actions du jour, la taille suit le rang.',
    vignette: [[6, 6, 14, 14, 'ambre'], [24, 8, 60, 6, 'clair'], [6, 26, 70, 4, 'clair'], [6, 34, 62, 3.5, 'moyen'], [6, 41, 54, 3, 'moyen'], [6, 47, 46, 2.5, 'moyen'], [6, 53, 40, 2, 'moyen']],
    composant: FileUnique,
  },
  {
    code: '40e',
    nom: 'La semaine dépliée',
    phrase: 'Aujourd’hui en détail, les autres jours en jauge de charge.',
    vignette: [[6, 10, 10, 44, 'sombre'], [19, 10, 10, 44, 'sombre'], [32, 8, 36, 48, 'moyen'], [36, 26, 28, 6, 'ambre'], [71, 10, 10, 44, 'sombre'], [84, 10, 10, 44, 'sombre']],
    composant: SemaineDepliee,
  },
  {
    code: '40f',
    nom: 'Le cadran',
    phrase: 'La journée comme une montre : un arc par rendez-vous.',
    vignette: [[8, 10, 44, 44, 'moyen'], [22, 24, 16, 16, 'sombre'], [44, 8, 10, 6, 'ambre'], [62, 12, 32, 4, 'clair'], [62, 22, 32, 4, 'sombre'], [62, 32, 32, 4, 'sombre']],
    composant: Cadran,
  },
  {
    code: '40g',
    nom: 'La lettre',
    phrase: 'Trois paragraphes : ce qui s’est passé, ce qui presse, ce qui peut attendre.',
    vignette: [[10, 8, 60, 5, 'clair'], [10, 16, 56, 5, 'clair'], [10, 26, 30, 5, 'ambre'], [42, 26, 20, 5, 'clair'], [10, 36, 58, 5, 'moyen'], [10, 44, 40, 5, 'moyen'], [10, 52, 20, 3, 'sombre']],
    composant: Lettre,
  },
  {
    code: '40h',
    nom: 'Les écarts',
    phrase: 'Seulement ce qui s’écarte d’une journée ordinaire.',
    vignette: [[49, 6, 1, 50, 'moyen'], [50, 12, 38, 6, 'ambre'], [50, 24, 14, 6, 'moyen'], [36, 36, 14, 6, 'sombre'], [50, 48, 8, 6, 'moyen']],
    composant: Ecarts,
  },
  {
    code: '40i',
    nom: 'Les tiroirs',
    phrase: 'Les familles en façades ; seul s’ouvre le tiroir qui demande quelque chose.',
    vignette: [[6, 8, 36, 46, 'moyen'], [18, 11, 12, 3, 'ambre'], [46, 8, 22, 21, 'sombre'], [72, 8, 22, 21, 'sombre'], [46, 33, 22, 21, 'sombre'], [72, 33, 22, 21, 'sombre']],
    composant: Tiroirs,
  },
  {
    code: '40j',
    nom: 'Le seuil',
    phrase: 'Une phrase : jusqu’à quand on peut ne rien faire.',
    vignette: [[6, 6, 88, 48, 'sombre'], [20, 22, 42, 7, 'clair'], [64, 22, 14, 7, 'ambre'], [32, 33, 36, 3, 'moyen'], [24, 44, 52, 2, 'moyen']],
    composant: Seuil,
  },
];

/** Les Accueils proposés au choix : les onze, toujours. */
export function useAccueilsDisponibles(): AccueilDef[] {
  return ACCUEILS;
}
