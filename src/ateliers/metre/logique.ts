import type { Centimes } from '../_commun/nombres';

/**
 * MÉTRÉ ET QUANTITATIF — des pièces aux quantités à commander.
 *
 * Toutes les longueurs sont en CENTIMÈTRES entiers, les surfaces en cm²
 * entiers : 4,25 m × 3,10 m ne doit pas devenir 13,174999999 m². Les mètres
 * tapés par la personne passent par `versCm` (arrondi au centimètre) ; on ne
 * revient en m² qu'à l'affichage.
 *
 *   sol = plafond = longueur × largeur
 *   murs = 2 × (longueur + largeur) × hauteur − Σ ouvertures (largeur × hauteur × nombre)
 *
 * Les quantités se calculent sur la surface TOTALE d'un ouvrage (toutes pièces
 * confondues) : on commande pour le chantier, pas pièce par pièce.
 *
 *   besoin = surface × couches × (1 + chute) / rendement   → arrondi à l'unité SUPÉRIEURE
 *
 * Le calcul reste en entiers jusqu'à la division finale.
 */
export type Ouvrage = 'sol' | 'murs' | 'plafond';
export const OUVRAGES: readonly Ouvrage[] = ['sol', 'murs', 'plafond'];

export interface Ouverture {
  nom: string;
  /** cm */
  largeur: number;
  /** cm */
  hauteur: number;
  nombre: number;
}

export interface Piece {
  id: string;
  nom: string;
  /** cm */
  longueur: number;
  /** cm */
  largeur: number;
  /** cm, sous plafond */
  hauteur: number;
  ouvertures: Ouverture[];
}

export interface Materiau {
  libelle: string;
  /** « carton », « litre », « plaque »… */
  unite: string;
  /** m² couverts par une unité, pour une couche (2 décimales retenues). */
  rendementM2: number;
  /** 1 pour un sol ou une plaque ; 2 pour une peinture en deux couches. */
  couches: number;
  /** En % ajouté au besoin (coupes, casse). */
  chute: number;
  prixUnitaire: Centimes;
}

export interface LigneQuantitatif {
  ouvrage: Ouvrage;
  surfaceCm2: number;
  materiau: Materiau;
  quantite: number;
  cout: Centimes;
}

export type ErreurPiece = 'nom' | 'dimensions' | 'ouverture' | 'ouverturesTropGrandes';
export type ErreurMateriau = 'rendement' | 'couches' | 'chute' | 'prix';

/** « 4,25 » (m) → 425 (cm). `NaN` pour une saisie illisible. */
export function versCm(metres: number | string): number {
  const n = typeof metres === 'number' ? metres : Number(String(metres).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) : Number.NaN;
}

/** cm² → m², 2 décimales. */
export function enM2(cm2: number): number {
  return Math.round(cm2 / 100) / 100;
}

const entierPositif = (x: number) => Number.isInteger(x) && x > 0;

export function verifierPiece(p: Piece): ErreurPiece[] {
  const fautes: ErreurPiece[] = [];
  if (!p.nom.trim()) fautes.push('nom');
  if (![p.longueur, p.largeur, p.hauteur].every(entierPositif) || p.longueur > 10_000 || p.largeur > 10_000 || p.hauteur > 2_000) fautes.push('dimensions');
  const murLePlusLong = Math.max(p.longueur, p.largeur);
  if (p.ouvertures.some((o) => !entierPositif(o.largeur) || !entierPositif(o.hauteur) || !entierPositif(o.nombre) || o.largeur > murLePlusLong || o.hauteur > p.hauteur))
    fautes.push('ouverture');
  else if (!fautes.includes('dimensions') && surfaceOuvertures(p) >= surfaceMursBrute(p)) fautes.push('ouverturesTropGrandes');
  return fautes;
}

export function verifierMateriau(m: Materiau): ErreurMateriau[] {
  const fautes: ErreurMateriau[] = [];
  if (!(m.rendementM2 >= 0.01 && m.rendementM2 <= 1000)) fautes.push('rendement');
  if (!(Number.isInteger(m.couches) && m.couches >= 1 && m.couches <= 10)) fautes.push('couches');
  if (!(m.chute >= 0 && m.chute <= 100)) fautes.push('chute');
  if (!(Number.isInteger(m.prixUnitaire) && m.prixUnitaire >= 0)) fautes.push('prix');
  return fautes;
}

function surfaceMursBrute(p: Piece): number {
  return 2 * (p.longueur + p.largeur) * p.hauteur;
}

function surfaceOuvertures(p: Piece): number {
  return p.ouvertures.reduce((s, o) => s + o.largeur * o.hauteur * o.nombre, 0);
}

/** Surface nette d'un ouvrage pour une pièce, en cm² entiers. */
export function surfacePiece(p: Piece, ouvrage: Ouvrage): number {
  if (ouvrage === 'murs') return surfaceMursBrute(p) - surfaceOuvertures(p);
  return p.longueur * p.largeur;
}

/** Nombre d'unités à commander : toujours l'unité supérieure. */
export function quantiteACommander(surfaceCm2: number, m: Materiau): number {
  if (surfaceCm2 <= 0) return 0;
  const chuteCentiemes = Math.round(m.chute * 100); // en centièmes de % : 12,5 % → 1250
  const rendementCm2 = Math.round(m.rendementM2 * 100) * 100; // 2 décimales de m², en cm²
  const numerateur = surfaceCm2 * m.couches * (10_000 + chuteCentiemes);
  const denominateur = rendementCm2 * 10_000;
  return Math.ceil(numerateur / denominateur);
}

export function quantitatif(pieces: readonly Piece[], materiaux: Partial<Record<Ouvrage, Materiau>>): LigneQuantitatif[] | null {
  if (pieces.length === 0 || pieces.some((p) => verifierPiece(p).length > 0)) return null;
  const lignes: LigneQuantitatif[] = [];
  for (const ouvrage of OUVRAGES) {
    const materiau = materiaux[ouvrage];
    if (!materiau) continue;
    if (verifierMateriau(materiau).length > 0) return null;
    const surfaceCm2 = pieces.reduce((s, p) => s + surfacePiece(p, ouvrage), 0);
    const quantite = quantiteACommander(surfaceCm2, materiau);
    lignes.push({ ouvrage, surfaceCm2, materiau, quantite, cout: quantite * materiau.prixUnitaire });
  }
  return lignes;
}

export function coutTotal(lignes: readonly LigneQuantitatif[]): Centimes {
  return lignes.reduce((s, l) => s + l.cout, 0);
}
