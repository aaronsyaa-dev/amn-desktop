/**
 * LES CALCULS DES GRAPHIQUES — purs, sans React, testés par `check:socle-graphiques`.
 *
 * Rien ici ne connaît une donnée d'exemple : l'échelle, les positions, les
 * parts et les arcs se calculent toujours à partir de ce qu'on leur donne, et
 * chaque cas limite (vide, un seul point, tous égaux, négatifs) a sa réponse.
 */

/** La taille du plus petit texte d'un graphique (axes, étiquettes) : le plancher de la spec, 10,5 px. */
export const TAILLE_AXE = 10.5;

/** Une valeur utilisable : un nombre fini. Le reste (NaN, Infinity, texte) est écarté. */
export const estFini = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Arrondit un flottant à 10 chiffres significatifs (0,1 + 0,2 s'écrit 0,3, pas 0,30000000000000004). */
const propre = (v: number): number => Number(v.toPrecision(10));

/* ── L'échelle ─────────────────────────────────────────────────────────── */

export interface Echelle {
  min: number;
  max: number;
  /** Écart entre deux graduations. */
  pas: number;
  /** De `min` à `max`, `pas` par `pas`. */
  graduations: number[];
}

export interface OptionsEchelle {
  /** Nombre de graduations visé (défaut 4, au moins 2). L'échelle en rend « à peu près » ce nombre. */
  graduations?: number;
  /** Force le zéro dans l'échelle (barres : toujours ; courbes : au choix). */
  inclureZero?: boolean;
}

/** Un pas « lisible » : 1, 2, 2,5, 5 ou 10 fois une puissance de dix (2,5 écarté pour des entiers). */
function pasLisible(brut: number, entiers: boolean): number {
  const exposant = Math.floor(Math.log10(brut));
  const base = 10 ** exposant;
  const f = brut / base;
  const choix = entiers ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10];
  const mantisse = choix.find((c) => f <= c + 1e-9) ?? 10;
  const pas = mantisse * base;
  return entiers ? Math.max(1, pas) : pas;
}

/**
 * L'échelle d'un jeu de valeurs : bornes arrondies à un pas lisible, graduations
 * régulières. `null` quand il n'y a aucune valeur finie.
 *
 *   · vide             → null ;
 *   · une seule valeur, ou toutes égales → on ouvre autour (± 10 %, ou 0–1 pour zéro) ;
 *   · négatifs         → l'échelle descend sous zéro, le zéro reste une graduation s'il est dans la plage ;
 *   · valeurs entières → pas entier : jamais « 2,5 clients ».
 */
export function calculerEchelle(valeurs: readonly number[], options: OptionsEchelle = {}): Echelle | null {
  const vues = valeurs.filter(estFini);
  if (vues.length === 0) return null;
  const visees = Math.max(2, Math.trunc(options.graduations ?? 4));
  let bas = Math.min(...vues);
  let haut = Math.max(...vues);
  if (options.inclureZero) {
    bas = Math.min(bas, 0);
    haut = Math.max(haut, 0);
  }
  if (bas === haut) {
    if (bas === 0) {
      haut = 1;
    } else {
      const marge = Math.abs(bas) * 0.1;
      bas -= marge;
      haut += marge;
    }
  }
  const entiers = vues.every(Number.isInteger);
  const pas = propre(pasLisible((haut - bas) / (visees - 1), entiers));
  const min = propre(Math.floor(propre(bas / pas)) * pas);
  const max = propre(Math.ceil(propre(haut / pas)) * pas);
  const graduations: number[] = [];
  const intervalles = Math.min(100, Math.round((max - min) / pas));
  for (let i = 0; i <= intervalles; i += 1) graduations.push(propre(min + pas * i));
  return { min, max, pas, graduations };
}

/** La position (en pixels) d'une valeur : `min` tombe sur `bas`, `max` sur `haut` (le haut a l'ordonnée la plus petite). */
export function positionner(valeur: number, echelle: Pick<Echelle, 'min' | 'max'>, haut: number, bas: number): number {
  const etendue = echelle.max - echelle.min || 1;
  return bas - ((valeur - echelle.min) / etendue) * (bas - haut);
}

/* ── Résumé d'une série ─────────────────────────────────────────────────── */

export interface Resume {
  n: number;
  min: number;
  max: number;
  premier: number;
  dernier: number;
}

export function resumer(valeurs: readonly number[]): Resume | null {
  const vues = valeurs.filter(estFini);
  if (vues.length === 0) return null;
  return { n: vues.length, min: Math.min(...vues), max: Math.max(...vues), premier: vues[0], dernier: vues[vues.length - 1] };
}

/* ── Positions et tracés ────────────────────────────────────────────────── */

/** Les abscisses de `n` points répartis de `gauche` à `gauche + largeur` ; un point seul est centré. */
export function abscisses(n: number, gauche: number, largeur: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [gauche + largeur / 2];
  return Array.from({ length: n }, (_, i) => gauche + (i * largeur) / (n - 1));
}

export type Point = readonly [number, number];

const c = (v: number): string => String(Math.round(v * 100) / 100);

/** Un trait « M x,y L x,y… » ; un `null` ouvre un trou (valeur manquante) et le trait repart au point suivant. */
export function cheminLigne(points: ReadonlyArray<Point | null>): string {
  let d = '';
  let enCours = false;
  for (const p of points) {
    if (!p) {
      enCours = false;
      continue;
    }
    d += `${enCours ? 'L' : 'M'}${c(p[0])},${c(p[1])}`;
    enCours = true;
  }
  return d;
}

/** L'aire sous une ligne continue, fermée sur `yBas`. Vide s'il y a moins de deux points. */
export function cheminAire(points: readonly Point[], yBas: number): string {
  if (points.length < 2) return '';
  const premier = points[0];
  const dernier = points[points.length - 1];
  return `${cheminLigne(points)}L${c(dernier[0])},${c(yBas)}L${c(premier[0])},${c(yBas)}Z`;
}

/** Largeur approchée d'un texte (Inter, chiffres tabulaires) : assez juste pour éviter les chevauchements. */
export function mesurerTexte(texte: string, taille: number = TAILLE_AXE): number {
  return Math.ceil([...texte].length * taille * 0.6);
}

/**
 * D'étiquette en étiquette, combien en sauter pour qu'elles ne se touchent pas :
 * 1 = toutes, 2 = une sur deux… `place` est la largeur d'un intervalle entre deux points voisins.
 */
export function pasEtiquettes(n: number, placeParPoint: number, largeurEtiquette: number): number {
  if (n <= 1) return 1;
  // Le premier texte s'aligne à gauche, le dernier à droite, les autres sont centrés : 1,5 largeur les sépare sans les toucher.
  const besoin = largeurEtiquette * 1.5 + 8;
  return Math.max(1, Math.ceil(besoin / Math.max(placeParPoint, 1)));
}

/** Les indices à étiqueter, en comptant depuis le DERNIER point (le plus récent est toujours nommé). */
export function indicesEtiquetes(n: number, pas: number): number[] {
  const sortie: number[] = [];
  for (let i = n - 1; i >= 0; i -= pas) sortie.unshift(i);
  return sortie;
}

/* ── Parts et donut ─────────────────────────────────────────────────────── */

/** Les valeurs d'une répartition : seules les valeurs finies et positives comptent. */
const compte = (v: number): number => (estFini(v) && v > 0 ? v : 0);

/** La somme des valeurs qui comptent (finies et positives) : le total d'un donut. */
export const sommePositive = (valeurs: readonly number[]): number => valeurs.reduce((a, v) => a + compte(v), 0);

/**
 * Les parts en POUR CENT ENTIERS, dont la somme fait exactement 100 (plus fort reste).
 * Total nul → que des zéros.
 */
export function repartirPourcents(valeurs: readonly number[]): number[] {
  const comptees = valeurs.map(compte);
  const total = comptees.reduce((a, b) => a + b, 0);
  if (total <= 0) return comptees.map(() => 0);
  const brut = comptees.map((v) => (v / total) * 100);
  const bases = brut.map(Math.floor);
  let reste = 100 - bases.reduce((a, b) => a + b, 0);
  const ordre = brut
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .filter((x) => comptees[x.i] > 0)
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; reste > 0 && ordre.length > 0; k = (k + 1) % ordre.length, reste -= 1) bases[ordre[k].i] += 1;
  return bases;
}

export interface ArcDonut {
  /** Le début de l'arc, le long de la circonférence (0 = midi). */
  debut: number;
  /** La part de circonférence qui revient au segment, écart compris. */
  longueur: number;
  /** Ce qui se dessine : `longueur` moins l'écart avec le voisin. */
  visible: number;
  /** L'écart laissé entre ce segment et le suivant (0 s'il est seul). */
  ecart: number;
  /** La part du total, de 0 à 1. */
  part: number;
}

/**
 * Les arcs d'un donut : un par valeur, dans l'ordre. Les segments se touchent
 * bout à bout ; chacun cède `ecart` pixels (2 par défaut) de sa longueur pour
 * séparer le suivant, de sorte que `visible + ecart = longueur` et que les
 * longueurs somment la circonférence. Un segment seul fait le tour complet.
 * Une valeur nulle, négative ou non finie ne dessine rien.
 */
export function arcsDonut(valeurs: readonly number[], circonference: number, ecart = 2): ArcDonut[] {
  const comptees = valeurs.map(compte);
  const total = comptees.reduce((a, b) => a + b, 0);
  const presents = comptees.filter((v) => v > 0).length;
  let debut = 0;
  return comptees.map((v) => {
    if (total <= 0 || v <= 0) return { debut, longueur: 0, visible: 0, ecart: 0, part: 0 };
    const part = v / total;
    const longueur = part * circonference;
    const e = presents > 1 ? Math.min(ecart, longueur) : 0;
    // Un segment minuscule reste visible (au moins 1 px, quitte à mordre sur l'écart voisin) plutôt que de disparaître de l'anneau.
    const visible = presents > 1 ? Math.max(longueur - e, 1) : longueur;
    const arc = { debut, longueur, visible, ecart: e, part };
    debut += longueur;
    return arc;
  });
}
