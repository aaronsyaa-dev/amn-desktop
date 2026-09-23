import type React from 'react';

/**
 * LES ACCUEILS — ce qui est commun aux deux éditions (ACCUEILS.md).
 *
 * « Les variantes sont faites pour être CHOISIES, pas tirées au hasard » : un
 * réglage liste les onze Accueils de l'édition avec une vignette, et le choix
 * est par compte. Chaque édition déclare SA liste dans `@edition/accueils` ;
 * aucune variante d'une édition n'entre dans le paquet de l'autre.
 */

/** Un rectangle de vignette, dans une boîte de 100 × 60 : x, y, largeur, hauteur, teinte. */
export type Pave = [number, number, number, number, 'clair' | 'moyen' | 'sombre' | 'ambre'];

export interface AccueilDef {
  /** Le code du cahier : `2a` (l'Accueil par défaut), `40a`… `40j`, `42a`… `42j`. */
  code: string;
  nom: string;
  /** Ce qu'on vient y chercher, en une phrase. */
  phrase: string;
  vignette: Pave[];
  composant: React.ComponentType;
}

/** L'Accueil par défaut des deux éditions : « 2a, le poste habité ». */
export const ACCUEIL_DEFAUT = '2a';
