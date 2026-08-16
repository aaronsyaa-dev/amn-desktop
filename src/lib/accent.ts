/**
 * La couleur d'accent d'une organisation (BLOC C).
 *
 * ## Une palette, pas un sélecteur libre
 *
 * Le choix est délibéré et c'est le point important du bloc. Un sélecteur RVB
 * laisse choisir un gris sur fond noir, ou un jaune sur lequel le texte du
 * bouton principal disparaît — et personne ne s'en rend compte avant de
 * l'avoir livré. Une palette restreinte est vérifiée UNE fois, ici, et ne peut
 * plus produire d'écran illisible ensuite.
 *
 * Le contraste est calculé, pas supposé : chaque entrée est validée contre le
 * fond sombre de l'application (#0a0a0a) et contre la couleur de texte que le
 * bouton principal pose PAR-DESSUS l'accent. Le contrôle est exécutable
 * (`npm run check:accent`), donc ajouter une couleur sans la vérifier fait
 * échouer la CI plutôt que d'atterrir chez une cliente.
 *
 * ## Ce qui n'est PAS ouvert
 *
 * Ni le fond, ni les polices, ni la disposition. La structure noir/blanc/mono
 * est l'identité du produit ; un seul paramètre bouge.
 */

export interface AccentOption {
  id: string;
  label: string;
  /** La couleur elle-même — fond des boutons principaux, traits actifs. */
  value: string;
  /** Le survol : une version plus claire, jamais plus sombre. */
  hover: string;
  /**
   * Ce que le bouton principal écrit PAR-DESSUS l'accent. Noir sur une
   * couleur claire, blanc sur une couleur soutenue — décidé ici plutôt que
   * calculé à l'exécution, pour que ce soit vérifiable.
   */
  on: string;
}

/** Le fond de l'application, contre lequel tout accent doit se détacher. */
export const APP_BACKGROUND = '#060707';

/**
 * La palette. « Blanc » reste le défaut : c'est l'identité actuelle, et une
 * organisation qui ne choisit rien ne doit pas voir son application changer.
 */
export const ACCENTS: AccentOption[] = [
  { id: 'blanc', label: 'Blanc', value: '#ededed', hover: '#ffffff', on: '#0a0a0a' },
  { id: 'ambre', label: 'Ambre', value: '#e0a340', hover: '#f0b855', on: '#0a0a0a' },
  { id: 'emeraude', label: 'Émeraude', value: '#4bbf87', hover: '#5fd39b', on: '#0a0a0a' },
  { id: 'azur', label: 'Azur', value: '#5aa9e6', hover: '#74bdf5', on: '#0a0a0a' },
  { id: 'lilas', label: 'Lilas', value: '#a98ae0', hover: '#bda1ef', on: '#0a0a0a' },
  { id: 'corail', label: 'Corail', value: '#e88b6a', hover: '#f5a184', on: '#0a0a0a' },
  { id: 'sable', label: 'Sable', value: '#cfc3a8', hover: '#e2d8c1', on: '#0a0a0a' },
];

export const DEFAULT_ACCENT_ID = 'blanc';

export function accentById(id: string | null | undefined): AccentOption {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];
}

/* ------------------------------- Le contraste ------------------------------ */

function channel(component: number): number {
  const c = component / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminance relative WCAG d'un `#rrggbb`. */
export function luminance(hex: string): number {
  const clean = hex.replace('#', '');
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Rapport de contraste WCAG entre deux couleurs, de 1 à 21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Les deux seuils qu'une couleur d'accent doit tenir.
 *
 * 4,5:1 est le seuil WCAG AA pour du texte normal. On l'exige des deux côtés :
 *   - l'accent doit se détacher du FOND (sinon un bouton disparaît) ;
 *   - le texte du bouton doit se détacher de l'ACCENT (sinon c'est son
 *     libellé qui disparaît). C'est l'oubli classique — on vérifie la couleur
 *     contre le fond, et on livre un bouton jaune au texte blanc.
 */
export const MIN_CONTRAST = 4.5;

export interface AccentAudit {
  id: string;
  onBackground: number;
  labelOnAccent: number;
  ok: boolean;
}

export function auditAccent(accent: AccentOption): AccentAudit {
  const onBackground = contrastRatio(accent.value, APP_BACKGROUND);
  const labelOnAccent = contrastRatio(accent.on, accent.value);
  return {
    id: accent.id,
    onBackground,
    labelOnAccent,
    ok: onBackground >= MIN_CONTRAST && labelOnAccent >= MIN_CONTRAST,
  };
}

/**
 * Applique l'accent au document.
 *
 * Écrit les variables CSS que tout le reste consomme déjà : aucun composant
 * n'a à savoir qu'une couleur est configurable, ce qui évite d'avoir à
 * retoucher chaque écran — et évite surtout d'en oublier un.
 */
export function applyAccent(id: string | null | undefined): void {
  const accent = accentById(id);
  const root = document.documentElement;
  root.style.setProperty('--color-accent', accent.value);
  root.style.setProperty('--color-accent-hover', accent.hover);
  // Le fond discret des états actifs : dérivé de l'accent, à faible opacité,
  // pour qu'un onglet sélectionné reste teinté sans devenir un aplat.
  root.style.setProperty('--color-accent-muted', hexToRgba(accent.value, 0.14));
  root.style.setProperty('--color-on-accent', accent.on);
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
