import { HomeSoloScreen } from '../business/HomeSoloScreen';
import type { AccueilDef } from '../accueils/types';

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
];
