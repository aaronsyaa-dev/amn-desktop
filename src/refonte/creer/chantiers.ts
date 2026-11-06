/**
 * H16 · CHANTIERS — logique pure (avancement pondéré, budget, rythme, interventions).
 *
 * Règles de la fiche H16, rubrique 6. Les poids et la part réalisée d'une étape,
 * et les interventions planifiées, n'existent pas dans les jeux fictifs : champs
 * facultatifs avec valeur par défaut (poids 1, part 0), listés dans `STATUT.md`.
 */

import { ajouterJours, borner, ecartJours, jourDeSemaine, lundiDe, semaineIso, semainesDepuis, type Jour } from './commun';

export interface EtapeEntree {
  nom: string;
  /** Semaine ISO prévue (numéro seul). */
  semaine: number;
  faite: boolean;
  /** Poids de l'étape dans l'avancement ; 1 par défaut. */
  poids?: number;
  /** Part réalisée de l'étape en cours, de 0 à 1. */
  partRealisee?: number;
  equipe?: readonly string[];
}

export type StatutSaisi = 'À venir' | 'En cours' | 'En retard' | 'Terminé';

export interface ChantierEntree {
  id: string;
  nom: string;
  debutLe: Jour;
  finPrevueLe: Jour;
  etapes: readonly EtapeEntree[];
  budgetCents: number;
  depenseCents: number;
  /** Pourcentage saisi quand le chantier n'a pas d'étapes. */
  avancementSaisi?: number;
  statut?: StatutSaisi;
}

export const poidsDe = (e: EtapeEntree): number => (e.poids !== undefined && e.poids > 0 ? e.poids : 1);

/** L'étape en cours : la première qui n'est pas faite. */
export function etapeEnCours(c: ChantierEntree): { etape: EtapeEntree; indice: number } | null {
  const indice = c.etapes.findIndex((e) => !e.faite);
  return indice === -1 ? null : { etape: c.etapes[indice], indice };
}

/**
 * Avancement (Proposition de la fiche) = Σ poids des étapes faites + poids de
 * l'étape en cours × sa part réalisée, sur Σ poids. Les étapes ne pèsent pas
 * pareil : « 2 étapes sur 5 » n'est pas « 40 % ». Sans étapes : le pourcentage saisi.
 */
export function avancement(c: ChantierEntree): number {
  if (c.etapes.length === 0) return Math.round(borner(c.avancementSaisi ?? 0, 0, 100));
  const total = c.etapes.reduce((s, e) => s + poidsDe(e), 0);
  const faites = c.etapes.filter((e) => e.faite).reduce((s, e) => s + poidsDe(e), 0);
  const cours = etapeEnCours(c);
  const part = cours ? poidsDe(cours.etape) * borner(cours.etape.partRealisee ?? 0, 0, 1) : 0;
  return Math.round(borner(((faites + part) / total) * 100, 0, 100));
}

/** Budget consommé en % (dépensé ÷ budget), `null` si le budget n'est pas renseigné. */
export function budgetConsomme(c: Pick<ChantierEntree, 'budgetCents' | 'depenseCents'>): number | null {
  return c.budgetCents > 0 ? Math.round((c.depenseCents / c.budgetCents) * 100) : null;
}

export type Rythme = 'en-phase' | 'a-surveiller' | 'a-demarrer' | 'sans-budget';

/** « en phase » si le budget consommé dépasse l'avancement de moins de 5 points ; « à démarrer » à 0 %. Jamais de rouge. */
export const ECART_BUDGET_TOLERE = 5;
export function rythme(c: ChantierEntree): Rythme {
  const av = avancement(c);
  if (av === 0) return 'a-demarrer';
  const conso = budgetConsomme(c);
  if (conso === null) return 'sans-budget';
  return conso - av < ECART_BUDGET_TOLERE ? 'en-phase' : 'a-surveiller';
}

/** La barre de budget passe en ambre au-delà de 90 % consommé. */
export const budgetEnAmbre = (c: Pick<ChantierEntree, 'budgetCents' | 'depenseCents'>): boolean => (budgetConsomme(c) ?? 0) > 90;

/**
 * Statut : Terminé (toutes les étapes faites, ou statut saisi), À démarrer (le chantier
 * n'a pas commencé), En retard (date de fin dépassée ou étape en cours au-delà de sa
 * semaine : Proposition), sinon En cours.
 */
export function statutDuChantier(c: ChantierEntree, aujourdhui: Jour): StatutSaisi {
  if (c.statut === 'Terminé' || (c.etapes.length > 0 && c.etapes.every((e) => e.faite))) return 'Terminé';
  if (c.finPrevueLe < aujourdhui) return 'En retard';
  const cours = etapeEnCours(c);
  if (cours && semainesDepuis(cours.etape.semaine, aujourdhui) > 0) return 'En retard';
  if (c.debutLe > aujourdhui || avancement(c) === 0) return 'À venir';
  return 'En cours';
}

/** Compteur de la barre latérale : chantiers « à surveiller » ou « En retard ». */
export function chantiersASurveiller<T extends ChantierEntree>(chantiers: readonly T[], aujourdhui: Jour): T[] {
  return chantiers.filter((c) => {
    const s = statutDuChantier(c, aujourdhui);
    return s !== 'Terminé' && (s === 'En retard' || rythme(c) === 'a-surveiller');
  });
}

export interface ResumeChantiers {
  enCours: number;
  aDemarrer: number;
  aSurveiller: number;
  termines: number;
}

/** « 4 chantiers en cours et 1 à démarrer » : les comptes qui nourrissent le sous-titre. */
export function resumeDesChantiers(chantiers: readonly ChantierEntree[], aujourdhui: Jour): ResumeChantiers {
  let enCours = 0;
  let aDemarrer = 0;
  let termines = 0;
  for (const c of chantiers) {
    const s = statutDuChantier(c, aujourdhui);
    if (s === 'Terminé') termines += 1;
    else if (s === 'À venir') aDemarrer += 1;
    else enCours += 1; // « En retard » est un chantier en cours
  }
  return { enCours, aDemarrer, termines, aSurveiller: chantiersASurveiller(chantiers, aujourdhui).length };
}

/** Le chantier ouvert par défaut : le premier à surveiller, sinon le premier en cours, sinon le premier. */
export function chantierParDefaut<T extends ChantierEntree>(chantiers: readonly T[], aujourdhui: Jour): T | null {
  return (
    chantiersASurveiller(chantiers, aujourdhui)[0] ??
    chantiers.find((c) => statutDuChantier(c, aujourdhui) === 'En cours') ??
    chantiers[0] ??
    null
  );
}

/** Dépensé d'un chantier = dépenses et notes de frais rattachées + sorties de stock « chantier » (quantité × prix d'achat) + heures. */
export function depenseDuChantier(parts: {
  depensesCents?: readonly number[];
  sortiesStock?: readonly { quantite: number; prixAchatCents: number }[];
  heuresCents?: number;
}): number {
  const dep = (parts.depensesCents ?? []).reduce((s, v) => s + v, 0);
  const stock = (parts.sortiesStock ?? []).reduce((s, l) => s + Math.abs(l.quantite) * l.prixAchatCents, 0);
  return dep + stock + (parts.heuresCents ?? 0);
}

/* -------- Étapes de la semaine, interventions -------- */

export interface Bilan {
  prevues: number;
  bouclees: number;
  /** Aucune étape n'a dépassé sa semaine : « toutes à l'heure ». */
  toutesALHeure: boolean;
}

/** « 2 étapes sur 4 bouclées » : étapes de la semaine ISO en cours, terminées sur prévues. */
export function bilanDeLaSemaine(chantiers: readonly ChantierEntree[], aujourdhui: Jour): Bilan {
  const semaine = semaineIso(aujourdhui).semaine;
  let prevues = 0;
  let bouclees = 0;
  let retard = false;
  for (const c of chantiers) {
    for (const e of c.etapes) {
      if (e.semaine === semaine) {
        prevues += 1;
        if (e.faite) bouclees += 1;
      }
      if (!e.faite && semainesDepuis(e.semaine, aujourdhui) > 0) retard = true;
    }
  }
  return { prevues, bouclees, toutesALHeure: !retard };
}

export interface InterventionEntree {
  id: string;
  chantierId: string;
  jour: Jour;
  /** « 08:00 » */
  debut: string;
  libelle: string;
  equipe?: readonly string[];
}
export interface LivraisonChantier {
  chantierId: string;
  jour: Jour;
  libelle: string;
  /** Étape qui attend cette livraison. */
  etape?: string;
}

/** Première intervention à venir (aujourd'hui compris) pour un chantier. */
export function prochaineIntervention(chantierId: string, interventions: readonly InterventionEntree[], aujourdhui: Jour): InterventionEntree | null {
  return (
    interventions
      .filter((i) => i.chantierId === chantierId && i.jour >= aujourdhui)
      .sort((a, b) => a.jour.localeCompare(b.jour) || a.debut.localeCompare(b.debut))[0] ?? null
  );
}

/** Signal ambre : une livraison attendue pour ce chantier tombe après le début de l'intervention. */
export function livraisonEnRetardSurIntervention(i: InterventionEntree, livraisons: readonly LivraisonChantier[]): LivraisonChantier | null {
  return livraisons.find((l) => l.chantierId === i.chantierId && l.jour > i.jour) ?? null;
}

export interface LigneAgenda {
  jour: Jour;
  type: 'intervention' | 'livraison';
  chantierId: string;
  libelle: string;
  heure: string | null;
}

/** Interventions et livraisons d'entrepôt des 7 prochains jours, tous chantiers, groupées par jour. */
export function agendaDeLaSemaine(
  interventions: readonly InterventionEntree[],
  livraisons: readonly LivraisonChantier[],
  aujourdhui: Jour,
): { jour: Jour; lignes: LigneAgenda[] }[] {
  const fin = ajouterJours(aujourdhui, 6);
  const lignes: LigneAgenda[] = [
    ...interventions.filter((i) => i.jour >= aujourdhui && i.jour <= fin).map((i) => ({ jour: i.jour, type: 'intervention' as const, chantierId: i.chantierId, libelle: i.libelle, heure: i.debut })),
    ...livraisons.filter((l) => l.jour >= aujourdhui && l.jour <= fin).map((l) => ({ jour: l.jour, type: 'livraison' as const, chantierId: l.chantierId, libelle: l.libelle, heure: null })),
  ].sort((a, b) => a.jour.localeCompare(b.jour) || (a.heure ?? '99').localeCompare(b.heure ?? '99'));
  const jours: { jour: Jour; lignes: LigneAgenda[] }[] = [];
  for (const l of lignes) {
    const dernier = jours[jours.length - 1];
    if (dernier && dernier.jour === l.jour) dernier.lignes.push(l);
    else jours.push({ jour: l.jour, lignes: [l] });
  }
  return jours;
}

/** Pour l'infobulle d'un libellé d'étape : abrégé au-delà de 14 caractères. */
export function libelleEtape(nom: string, max = 14): { court: string; tronque: boolean } {
  return nom.length <= max ? { court: nom, tronque: false } : { court: `${nom.slice(0, max - 1).trimEnd()}…`, tronque: true };
}

/** Lundi de la semaine ISO en cours : début de la fenêtre « cette semaine ». */
export const debutDeLaSemaine = (aujourdhui: Jour): Jour => lundiDe(aujourdhui);

/** Un jour de la semaine (0 = lundi) : exposé pour la grille « Prochaines interventions ». */
export const rangDansLaSemaine = (j: Jour): number => jourDeSemaine(j);

/** Jours restants avant la fin prévue (négatif si dépassée). */
export const joursAvantLaFin = (c: ChantierEntree, aujourdhui: Jour): number => ecartJours(aujourdhui, c.finPrevueLe);
