/**
 * H17 · VISUELS ET MARQUE — logique pure (chapitres, parts de couleur, zone de
 * protection, contrôle à l'export).
 *
 * La marque affichée est celle de l'ORGANISATION (logos, palette nommée, police,
 * modèles, règles). On ne lit jamais la palette dans les jetons CSS de l'application.
 * Les parts d'usage, les rôles de couleur et les règles « à éviter » n'existent pas
 * dans les jeux fictifs : champs facultatifs, listés dans `STATUT.md`.
 */

import { borner, type Jour } from './commun';

export interface CouleurMarque {
  nom: string;
  hex: string;
  role?: string;
  /** Part d'usage, en %. Saisie ou mesurée sur les modèles ; normalisée à 100 pour la barre. */
  part?: number;
}

export interface MarqueEntree {
  logos: readonly { variante: string; format: string }[];
  palette: readonly CouleurMarque[];
  typographie: { famille: string; graisses: readonly number[] } | null;
  modelesVisuels: readonly { nom: string; format: string; largeur?: number; hauteur?: number }[];
  reglesAEviter?: readonly string[];
  modifieeLe?: Jour;
  modifieePar?: string;
}

export type ChapitreId = 'logo' | 'couleurs' | 'typographie' | 'modeles' | 'a-eviter';
export const CHAPITRES: readonly ChapitreId[] = ['logo', 'couleurs', 'typographie', 'modeles', 'a-eviter'];

export interface EtatChapitre {
  id: ChapitreId;
  complet: boolean;
  /** Ce qui manque, pour le point ambre et la phrase « Ajoutez une variante fond clair ». */
  manque: 'logo' | 'variante' | 'couleurs' | 'police' | 'modele' | 'regle' | null;
}

/** Contenu minimal d'un chapitre : logo + 1 variante ; 3 couleurs ; 1 police ; 1 modèle ; 1 règle à éviter. */
export function etatDesChapitres(m: MarqueEntree): EtatChapitre[] {
  const logo = m.logos.length >= 1;
  const variantes = new Set(m.logos.map((l) => l.variante)).size;
  return [
    { id: 'logo', complet: logo && variantes >= 1, manque: logo ? null : 'logo' },
    { id: 'couleurs', complet: m.palette.length >= 3, manque: m.palette.length >= 3 ? null : 'couleurs' },
    { id: 'typographie', complet: !!m.typographie?.famille, manque: m.typographie?.famille ? null : 'police' },
    { id: 'modeles', complet: m.modelesVisuels.length >= 1, manque: m.modelesVisuels.length >= 1 ? null : 'modele' },
    { id: 'a-eviter', complet: (m.reglesAEviter?.length ?? 0) >= 1, manque: (m.reglesAEviter?.length ?? 0) >= 1 ? null : 'regle' },
  ];
}

/** « 5 chapitres sur 5 · à jour » : nombre de chapitres complets. */
export const chapitresComplets = (m: MarqueEntree): number => etatDesChapitres(m).filter((c) => c.complet).length;

/** « Exporter le kit complet » est désactivé tant qu'il n'y a aucun logo. */
export const kitExportable = (m: MarqueEntree): boolean => m.logos.length >= 1;

/* -------- Couleurs -------- */

const HEX = /^#?([0-9a-fA-F]{6})$/;

/** `#8fbf7a` → `#8FBF7A` (majuscules, zéro conservé : `#0C0C0D`). `null` si le code n'est pas valide. */
export function hexNormalise(code: string): string | null {
  const m = HEX.exec(code.trim());
  return m ? `#${m[1].toUpperCase()}` : null;
}

export interface PartDeCouleur {
  nom: string;
  hex: string;
  /** Part entière, la somme des parts vaut toujours 100. */
  part: number;
  /** Étiquette visible : pas en dessous de 9 % (lecture au survol). */
  etiquette: boolean;
}

/** Plus petit segment qui porte son étiquette. */
export const PART_MIN_ETIQUETTE = 9;

/**
 * Barre de proportions : parts ramenées à 100 % (méthode du plus fort reste, donc
 * la somme est exacte). Sans aucune part saisie, les couleurs pèsent pareil.
 */
export function partsDeCouleurs(palette: readonly CouleurMarque[]): PartDeCouleur[] {
  if (palette.length === 0) return [];
  const brutes = palette.map((c) => Math.max(0, c.part ?? 0));
  const total = brutes.reduce((s, p) => s + p, 0);
  const poids = total > 0 ? brutes : palette.map(() => 1);
  const somme = poids.reduce((s, p) => s + p, 0);
  const exactes = poids.map((p) => (p / somme) * 100);
  const bases = exactes.map(Math.floor);
  let reste = 100 - bases.reduce((s, p) => s + p, 0);
  const ordre = exactes.map((e, i) => ({ i, f: e - Math.floor(e) })).sort((a, b) => b.f - a.f || a.i - b.i);
  for (const { i } of ordre) {
    if (reste <= 0) break;
    bases[i] += 1;
    reste -= 1;
  }
  return palette.map((c, i) => ({ nom: c.nom, hex: hexNormalise(c.hex) ?? c.hex, part: bases[i], etiquette: bases[i] >= PART_MIN_ETIQUETTE }));
}

/** Plus de 6 couleurs : la grille passe à 4 colonnes. */
export const colonnesDePalette = (n: number): 3 | 4 => (n > 6 ? 4 : 3);

/* -------- Logo -------- */

/** Zone de protection : x = la moitié de la hauteur du symbole (Proposition de la fiche). */
export const zoneDeProtection = (hauteurSymbole: number): number => hauteurSymbole / 2;

export const TAILLE_MIN_ECRAN_PX = 24;
export const TAILLE_MIN_IMPRESSION_MM = 16;

/* -------- Contrôle à l'export -------- */

export interface VisuelExporte {
  /** Largeur et hauteur du logo posé, et de son original. */
  logo?: { largeur: number; hauteur: number; largeurOrigine: number; hauteurOrigine: number; rotationDeg: number; effets: readonly string[]; margePx: number; hauteurSymbolePx: number };
  /** Couleurs de fond et d'aplat utilisées dans le visuel. */
  couleurs: readonly string[];
}
export type Avertissement = 'logo-deforme' | 'logo-pivote' | 'logo-effet' | 'marge-non-respectee' | 'couleur-hors-palette' | 'logo-trop-petit';

/**
 * Chaque visuel exporté est comparé aux règles. Un écart affiche un avertissement
 * avant l'export, JAMAIS un blocage (`bloquant` est toujours faux).
 */
export function controleExport(v: VisuelExporte, m: Pick<MarqueEntree, 'palette'>): { bloquant: false; avertissements: Avertissement[] } {
  const w: Avertissement[] = [];
  if (v.logo) {
    const l = v.logo;
    const ratioPose = l.largeur / l.hauteur;
    const ratioOrigine = l.largeurOrigine / l.hauteurOrigine;
    if (Math.abs(ratioPose / ratioOrigine - 1) > 0.02) w.push('logo-deforme');
    if (Math.abs(l.rotationDeg % 360) > 0.5) w.push('logo-pivote');
    if (l.effets.length > 0) w.push('logo-effet');
    if (l.margePx < zoneDeProtection(l.hauteurSymbolePx)) w.push('marge-non-respectee');
    if (l.hauteur < TAILLE_MIN_ECRAN_PX) w.push('logo-trop-petit');
  }
  const autorisees = new Set(m.palette.map((c) => hexNormalise(c.hex)).filter((h): h is string => h !== null));
  if (v.couleurs.some((c) => { const h = hexNormalise(c); return h !== null && !autorisees.has(h); })) w.push('couleur-hors-palette');
  return { bloquant: false, avertissements: w };
}

/** Pourcentage de progression des chapitres, pour l'anneau du sommaire. */
export const progressionDuLivre = (m: MarqueEntree): number => borner(Math.round((chapitresComplets(m) / CHAPITRES.length) * 100), 0, 100);
