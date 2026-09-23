import { HomeScreen } from '../screens/HomeScreen';
import type { AccueilDef } from '../accueils/types';
import { Releve } from '../accueils/interne/Releve';

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
  {
    code: '42a',
    nom: 'La Relève',
    phrase: 'Le bulletin du matin : ce qui s’est passé pendant qu’on n’était pas là.',
    vignette: [[6, 6, 88, 3, 'clair'], [6, 13, 60, 8, 'clair'], [6, 25, 88, 6, 'moyen'], [6, 35, 88, 6, 'ambre'], [6, 44, 88, 5, 'sombre'], [6, 52, 88, 5, 'sombre']],
    composant: Releve,
  },
];
