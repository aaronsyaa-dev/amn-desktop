/**
 * Ce que les briques partagent : le repère, les couleurs, le pivot.
 *
 * Le dessin vit dans une boîte de 200 × 220 unités. Toutes les briques y
 * sont placées à l'avance : on les empile dans un même `<svg>` sans calcul.
 * Les robots à métiers (S4) gardent ce repère et changent les couleurs ou
 * ajoutent un accessoire par l'emplacement prévu dans `TeteTele`.
 */
export const CADRE = { largeur: 200, hauteur: 220 } as const;

/** Le cadrage « tête seule », pour la petite version (appels, réactions). */
export const CADRE_TETE = { x: 18, y: 0, largeur: 164, hauteur: 152 } as const;

/** Les points d'attache, pour que chaque brique se pose au même endroit. */
export const ATTACHES = {
  cou: { x: 100, y: 146 },
  epauleG: { x: 71, y: 164 },
  epauleD: { x: 129, y: 164 },
  antenne: { x: 114, y: 31 },
  sol: 212,
} as const;

export interface Teintes {
  /** La coque : blanc satiné. */
  coque: string;
  coqueOmbre: string;
  coqueReflet: string;
  /** L'écran éteint. */
  ecran: string;
  ecranBord: string;
  /** Le visage allumé. */
  visage: string;
  /**
   * Le visage en alerte : l'ambre du signal. Une valeur littérale, pas
   * `var(--color-signal)` : framer-motion pose les couleurs SVG en attributs,
   * où une variable CSS n'est pas lue. À tenir égale à `--color-signal`
   * (`src/index.css`) — `check:ajmani` le vérifie.
   */
  visageAlerte: string;
  cable: string;
}

export const TEINTES_AJMANI: Teintes = {
  coque: '#F7F4EF',
  coqueOmbre: '#DCD6CC',
  coqueReflet: '#FFFFFF',
  ecran: '#111317',
  ecranBord: '#C9C2B6',
  visage: '#FFF1D8',
  visageAlerte: '#d09a4a',
  cable: '#D3CCC1',
};

/**
 * Un pivot en coordonnées du dessin, pour framer-motion : par défaut il tourne
 * un élément SVG autour du centre de sa boîte ; ici on le fait tourner autour
 * d'un point d'attache (l'épaule, le cou, le pied de l'antenne).
 */
export function pivot(x: number, y: number) {
  return { transformBox: 'view-box' as const, originX: `${x}px`, originY: `${y}px` };
}

/** Un identifiant sûr pour `url(#…)`, à partir de `useId()` (qui contient des « : »). */
export function idSur(brut: string): string {
  return brut.replace(/[^a-zA-Z0-9_-]/g, '');
}
