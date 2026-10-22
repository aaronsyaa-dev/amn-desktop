import { arrondiCentime, estDateIso, type Centimes } from '../_commun/nombres';

/**
 * TABLEAU D'AMORTISSEMENT LINÉAIRE — dotation par exercice, cumul, valeur nette.
 *
 * LE PRORATA TEMPORIS se compte en jours, sur l'année commerciale de 360
 * jours où chaque mois compte 30 jours (usage comptable courant, celui des
 * logiciels et des exemples du Plan comptable). Un jour qui est le dernier de
 * son mois, ou un 31, compte comme un 30 : un bien mis en service le 1er avril
 * avec une clôture au 31 décembre compte 270 jours, quel que soit le mois de
 * février. La date de mise en service est comprise.
 *
 * LE CUMUL D'ABORD. Pour chaque exercice, on calcule le cumul théorique
 * arrondi au centime, valeur × jours écoulés / (360 × durée), plafonné à la
 * valeur ; la dotation est la différence avec le cumul précédent. Ainsi la
 * somme des dotations égale la valeur au centime près, et la dernière
 * annuité est exactement le reste — sans correction ajoutée à la main.
 *
 * L'EXERCICE se clôt le dernier jour d'un mois choisi (décembre par défaut)
 * et porte le nom de l'année où il se clôt. Pas de premier exercice long ou
 * court : chaque exercice fait douze mois.
 *
 * PETIT MATÉRIEL. L'administration admet que les biens de faible valeur
 * soient passés en charge plutôt qu'amortis. Seuil retenu ici : 500 € HT
 * (BOI-BIC-CHG-20-30-10, tolérance administrative ; valeur relevée le
 * 2026-10-22, à vérifier avant intégration). Le module le signale, il ne
 * décide pas.
 */
export const SEUIL_PETIT_MATERIEL: Centimes = 50_000;
export const JOURS_PAR_AN = 360;

export interface Immobilisation {
  id: string;
  designation: string;
  /** Valeur d'origine HT (base amortissable, sans valeur résiduelle). */
  valeur: Centimes;
  miseEnService: string;
  dureeAnnees: number;
}

export interface LignePlan {
  /** L'année où l'exercice se clôt. */
  exercice: number;
  /** AAAA-MM-JJ, dernier jour du mois de clôture. */
  cloture: string;
  jours: number;
  dotation: Centimes;
  cumul: Centimes;
  vnc: Centimes;
}

export type ErreurImmo = 'designation' | 'valeur' | 'date' | 'duree';

export function verifier(i: Omit<Immobilisation, 'id'>): ErreurImmo[] {
  const f: ErreurImmo[] = [];
  if (!i.designation.trim() || i.designation.trim().length > 80) f.push('designation');
  if (!Number.isInteger(i.valeur) || i.valeur <= 0 || i.valeur > 10_000_000_000) f.push('valeur');
  if (!estDateIso(i.miseEnService)) f.push('date');
  if (!Number.isInteger(i.dureeAnnees) || i.dureeAnnees < 1 || i.dureeAnnees > 50) f.push('duree');
  return f;
}

const dernierJour = (annee: number, mois: number) => new Date(Date.UTC(annee, mois, 0)).getUTCDate();
const pad = (n: number) => String(n).padStart(2, '0');

/** La date de clôture de l'exercice qui se clôt en `annee`, pour un mois de clôture 1 → 12. */
export function dateCloture(annee: number, moisCloture: number): string {
  return `${annee}-${pad(moisCloture)}-${pad(dernierJour(annee, moisCloture))}`;
}

/** L'exercice (année de clôture) qui contient la date `iso`. */
export function exerciceDe(iso: string, moisCloture: number): number {
  const annee = Number(iso.slice(0, 4));
  return iso <= dateCloture(annee, moisCloture) ? annee : annee + 1;
}

/** Le quantième en convention 30 / 360 : le dernier jour du mois et le 31 comptent 30. */
function jour30(iso: string): number {
  const a = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const j = Number(iso.slice(8, 10));
  return j >= 30 || j === dernierJour(a, m) ? 30 : j;
}

/** Jours de `debut` à `fin` inclus, en 30 / 360. */
export function jours360(debut: string, fin: string): number {
  const [a1, m1] = [Number(debut.slice(0, 4)), Number(debut.slice(5, 7))];
  const [a2, m2] = [Number(fin.slice(0, 4)), Number(fin.slice(5, 7))];
  return (a2 - a1) * 360 + (m2 - m1) * 30 + (jour30(fin) - jour30(debut)) + 1;
}

export function planAmortissement(i: Immobilisation, moisCloture = 12): LignePlan[] {
  if (verifier(i).length > 0 || !(moisCloture >= 1 && moisCloture <= 12)) return [];
  const totalJours = JOURS_PAR_AN * i.dureeAnnees;
  const premier = exerciceDe(i.miseEnService, moisCloture);
  const lignes: LignePlan[] = [];
  let cumul = 0;
  // On s'arrête sur les JOURS, pas sur le cumul : un bien de quelques centimes
  // atteint sa valeur arrondie avant la fin de sa durée.
  for (let ex = premier, fini = false; !fini; ex += 1) {
    const cloture = dateCloture(ex, moisCloture);
    const ecoules = jours360(i.miseEnService, cloture);
    const cumulTheorique = ecoules >= totalJours ? i.valeur : Math.min(i.valeur, arrondiCentime((i.valeur * ecoules) / totalJours));
    const precedents = lignes.reduce((s, l) => s + l.jours, 0);
    lignes.push({
      exercice: ex,
      cloture,
      jours: Math.min(ecoules, totalJours) - precedents,
      dotation: cumulTheorique - cumul,
      cumul: cumulTheorique,
      vnc: i.valeur - cumulTheorique,
    });
    cumul = cumulTheorique;
    fini = ecoules >= totalJours;
  }
  return lignes;
}

export interface LigneExercice {
  immo: Immobilisation;
  dotation: Centimes;
  vnc: Centimes;
  /** `true` si le bien n'est pas encore en service à la clôture. */
  pasEncore: boolean;
}

/** Les dotations de l'exercice `exercice` pour toutes les immobilisations, et leur total. */
export function dotationsExercice(immos: readonly Immobilisation[], exercice: number, moisCloture = 12): { lignes: LigneExercice[]; total: Centimes; vncTotale: Centimes } {
  const lignes = immos.map((immo) => {
    const plan = planAmortissement(immo, moisCloture);
    const l = plan.find((p) => p.exercice === exercice);
    const pasEncore = plan.length > 0 && exercice < plan[0].exercice;
    const finie = plan.length > 0 && exercice > plan[plan.length - 1].exercice;
    return { immo, dotation: l?.dotation ?? 0, vnc: l ? l.vnc : pasEncore ? immo.valeur : finie ? 0 : immo.valeur, pasEncore };
  });
  return { lignes, total: lignes.reduce((s, l) => s + l.dotation, 0), vncTotale: lignes.reduce((s, l) => s + (l.pasEncore ? 0 : l.vnc), 0) };
}

export function petitMateriel(i: Pick<Immobilisation, 'valeur'>): boolean {
  return i.valeur <= SEUIL_PETIT_MATERIEL;
}
