import { estDateIso, joursEntre } from '../_commun/nombres';

/**
 * DOCUMENT UNIQUE D'ÉVALUATION DES RISQUES — l'inventaire des risques par unité
 * de travail, leur cotation et le plan d'action qui en découle.
 *
 * La cotation, sans formule cachée :
 *
 *   criticité = gravité (1 à 4) × probabilité (1 à 4), donc de 1 à 16 ;
 *   niveau    : 1 à 3 faible · 4 à 6 moyen · 8 et 9 élevé · 12 à 16 critique
 *               (les seuls produits possibles sont 1, 2, 3, 4, 6, 8, 9, 12, 16).
 *
 * Cette grille est une pratique courante (INRS, CARSAT), pas une obligation :
 * le Code du travail impose l'évaluation, pas une méthode de cotation.
 *
 * LA MISE À JOUR. Art. R4121-2 du Code du travail : au moins chaque année dans
 * les entreprises d'au moins onze salariés, et dans toutes lors d'une décision
 * d'aménagement important des conditions de travail ou d'une information
 * nouvelle sur un risque. Le module ne surveille que l'échéance annuelle ;
 * sous onze salariés, il conseille sans parler de retard.
 */
export const CATEGORIES = [
  'chute',
  'hauteur',
  'manutention',
  'bruit',
  'chimique',
  'electrique',
  'machines',
  'routier',
  'incendie',
  'psychosocial',
  'ecran',
  'autre',
] as const;
export type Categorie = (typeof CATEGORIES)[number];

export type Niveau = 'faible' | 'moyen' | 'eleve' | 'critique';

export interface Unite {
  id: string;
  nom: string;
}

export interface Risque {
  id: string;
  uniteId: string;
  categorie: Categorie;
  /** Le danger en une phrase : « Montée sur escabeau pour poser les plinthes hautes ». */
  danger: string;
  gravite: number;
  probabilite: number;
  mesuresExistantes: string;
  actionPrevue: string;
  responsable: string;
  /** AAAA-MM-JJ, ou vide si aucune action n'est prévue. */
  echeance: string;
  faite: boolean;
}

export type ErreurRisque = 'unite' | 'danger' | 'gravite' | 'probabilite' | 'echeance' | 'actionSansEcheance';

const cote = (n: number) => Number.isInteger(n) && n >= 1 && n <= 4;

export function verifierRisque(r: Risque, unites: readonly Unite[]): ErreurRisque[] {
  const fautes: ErreurRisque[] = [];
  if (!unites.some((u) => u.id === r.uniteId)) fautes.push('unite');
  if (r.danger.trim().length < 3) fautes.push('danger');
  if (!cote(r.gravite)) fautes.push('gravite');
  if (!cote(r.probabilite)) fautes.push('probabilite');
  if (r.echeance !== '' && !estDateIso(r.echeance)) fautes.push('echeance');
  if (r.actionPrevue.trim() !== '' && r.echeance === '') fautes.push('actionSansEcheance');
  return fautes;
}

export function criticite(r: Pick<Risque, 'gravite' | 'probabilite'>): number {
  return r.gravite * r.probabilite;
}

export function niveau(c: number): Niveau {
  if (c >= 12) return 'critique';
  if (c >= 8) return 'eleve';
  if (c >= 4) return 'moyen';
  return 'faible';
}

/** Par criticité décroissante ; à criticité égale, l'échéance la plus proche d'abord (sans échéance en dernier). */
export function trier(risques: readonly Risque[]): Risque[] {
  return [...risques].sort((a, b) => {
    const d = criticite(b) - criticite(a);
    if (d !== 0) return d;
    if (a.echeance === b.echeance) return a.id.localeCompare(b.id);
    if (a.echeance === '') return 1;
    if (b.echeance === '') return -1;
    return a.echeance.localeCompare(b.echeance);
  });
}

export function enRetard(r: Risque, aujourdhui: string): boolean {
  return !r.faite && r.actionPrevue.trim() !== '' && estDateIso(r.echeance) && joursEntre(r.echeance, aujourdhui) > 0;
}

export type EtatMiseAJour = 'aJour' | 'enRetard' | 'conseillee';

export interface MiseAJour {
  etat: EtatMiseAJour;
  joursDepuis: number;
  /** Vrai si l'entreprise compte au moins onze salariés (mise à jour annuelle obligatoire). */
  obligatoire: boolean;
}

/** Plus de 365 jours depuis la dernière mise à jour : en retard (≥ 11 salariés) ou conseillée (moins). */
export function miseAJour(derniere: string, effectif: number, aujourdhui: string): MiseAJour {
  const joursDepuis = joursEntre(derniere, aujourdhui);
  const obligatoire = effectif >= 11;
  const depassee = joursDepuis > 365;
  return { etat: !depassee ? 'aJour' : obligatoire ? 'enRetard' : 'conseillee', joursDepuis, obligatoire };
}

export interface Synthese {
  total: number;
  parNiveau: Record<Niveau, number>;
  actionsOuvertes: number;
  actionsEnRetard: number;
  /** Risques élevés ou critiques sans aucune action prévue : le trou du plan. */
  sansAction: number;
}

export function synthese(risques: readonly Risque[], aujourdhui: string): Synthese {
  const parNiveau: Record<Niveau, number> = { faible: 0, moyen: 0, eleve: 0, critique: 0 };
  let actionsOuvertes = 0;
  let actionsEnRetard = 0;
  let sansAction = 0;
  for (const r of risques) {
    const n = niveau(criticite(r));
    parNiveau[n] += 1;
    const action = r.actionPrevue.trim() !== '';
    if (action && !r.faite) actionsOuvertes += 1;
    if (enRetard(r, aujourdhui)) actionsEnRetard += 1;
    if (!action && (n === 'eleve' || n === 'critique')) sansAction += 1;
  }
  return { total: risques.length, parNiveau, actionsOuvertes, actionsEnRetard, sansAction };
}

export interface LignePlan {
  risque: Risque;
  unite: string;
  criticite: number;
  niveau: Niveau;
  retard: boolean;
}

/** Le plan d'action : les actions prévues et non faites, triées comme la liste. */
export function planDAction(risques: readonly Risque[], unites: readonly Unite[], aujourdhui: string): LignePlan[] {
  const nom = new Map(unites.map((u) => [u.id, u.nom]));
  return trier(risques)
    .filter((r) => !r.faite && r.actionPrevue.trim() !== '')
    .map((r) => ({ risque: r, unite: nom.get(r.uniteId) ?? '?', criticite: criticite(r), niveau: niveau(criticite(r)), retard: enRetard(r, aujourdhui) }));
}
