import { HomeScreen } from '../screens/HomeScreen';
import type { AccueilDef } from '../accueils/types';

/**
 * LES ONZE ACCUEILS DE L'ÉDITION INTERNE — 2a et les dix variantes du cahier 10
 * (`42a` → `42j`, ACCUEILS.md). Aucune variante cliente n'est importée ici.
 */
export const ACCUEILS: AccueilDef[] = [
  {
    code: '2a',
    nom: 'Le poste habité',
    phrase: 'Le QG du jour : le relevé, la file, le parc.',
    vignette: [[6, 8, 88, 14, 'moyen'], [6, 26, 55, 28, 'sombre'], [65, 26, 29, 28, 'sombre'], [6, 12, 20, 6, 'ambre']],
    composant: HomeScreen,
  },
];
