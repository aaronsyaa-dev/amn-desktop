/**
 * MR04 · MATÉRIEL — logique pure (statut, état et jauge, entretien, résumé du parc).
 *
 * Règles de la fiche MR04, rubrique 6. Statut (où est l'objet) et état (comment va-t-il)
 * sont deux informations différentes : un objet peut être « Disponible » et « À vérifier ».
 */

import { ajouterMois, ecartJours, MOIS_COURTS, capitale, INSECABLE, type Jour, type Langue } from './commun';

export type StatutMateriel = 'En prêt' | 'Disponible' | 'Hors service';
export type EtatMateriel = 'Neuf' | 'Bon' | 'À vérifier' | 'À réviser';

export interface EquipementEntree {
  id: string;
  nom: string;
  /** Affectation courante : une personne (prêt) ou un lieu. */
  affectation: { type: 'personne' | 'lieu'; libelle: string; depuisLe?: Jour; retourPrevuLe?: Jour | null };
  /** « Neuf », « Bon », « À vérifier », « À réviser » ; les jeux fictifs disent aussi « En panne ». */
  etat: string;
  horsService?: boolean;
  reforme?: boolean;
  dernierControleLe?: Jour | null;
  dernierEntretienLe?: Jour | null;
  prochainEntretienLe?: Jour | null;
  periodiciteMois?: number | null;
  modifieLe?: Jour;
}

/** Hors service = signalé inutilisable (ou « En panne »), prioritaire ; En prêt = affecté à une personne ; sinon Disponible. */
export function statutDeLEquipement(e: EquipementEntree): StatutMateriel {
  if (e.horsService || e.etat === 'En panne') return 'Hors service';
  return e.affectation.type === 'personne' ? 'En prêt' : 'Disponible';
}

/** Un équipement hors service ne peut pas être prêté. */
export const peutEtrePrete = (e: EquipementEntree): boolean => statutDeLEquipement(e) === 'Disponible';

export function etatNormalise(brut: string): EtatMateriel {
  if (brut === 'Neuf' || brut === 'Bon' || brut === 'À vérifier' || brut === 'À réviser') return brut;
  return brut === 'En panne' ? 'À réviser' : 'Bon';
}

export type TonJauge = 'vert' | 'orange' | 'rouge';

/**
 * Jauge à 5 segments (Proposition) : Neuf 5 ; Bon 4 (5 si contrôlé il y a moins de 30 jours) ;
 * À vérifier 2 (orange) ; À réviser 1 (rouge). Le libellé accompagne toujours la couleur.
 */
export function jaugeDEtat(e: Pick<EquipementEntree, 'etat' | 'dernierControleLe'>, aujourdhui: Jour): { segments: 1 | 2 | 4 | 5; ton: TonJauge } {
  switch (etatNormalise(e.etat)) {
    case 'Neuf': return { segments: 5, ton: 'vert' };
    case 'Bon': return { segments: e.dernierControleLe && ecartJours(e.dernierControleLe, aujourdhui) < 30 ? 5 : 4, ton: 'vert' };
    case 'À vérifier': return { segments: 2, ton: 'orange' };
    case 'À réviser': return { segments: 1, ton: 'rouge' };
  }
}

/* -------- Entretien -------- */

/** Prochaine échéance : celle qui est saisie, sinon dernier entretien + périodicité. */
export function echeanceEntretien(e: Pick<EquipementEntree, 'prochainEntretienLe' | 'dernierEntretienLe' | 'periodiciteMois'>): Jour | null {
  if (e.prochainEntretienLe) return e.prochainEntretienLe;
  return e.dernierEntretienLe && e.periodiciteMois ? ajouterMois(e.dernierEntretienLe, e.periodiciteMois) : null;
}

export type LibelleEntretien =
  | { type: 'retard'; jours: number }
  | { type: 'dans'; jours: number }
  | { type: 'mois'; mois: string; annee: number }
  | { type: 'aucun' };

/** « En retard de n j » ; « Dans n jours » jusqu'à 30 jours ; mois abrégé + année au-delà (« Janv. 2027 »). */
export function libelleEntretien(echeance: Jour | null, aujourdhui: Jour, langue: Langue = 'fr'): LibelleEntretien {
  if (!echeance) return { type: 'aucun' };
  const d = ecartJours(aujourdhui, echeance);
  if (d < 0) return { type: 'retard', jours: -d };
  if (d <= 30) return { type: 'dans', jours: d };
  return { type: 'mois', mois: capitale(MOIS_COURTS[langue][Number(echeance.slice(5, 7)) - 1]), annee: Number(echeance.slice(0, 4)) };
}

/** Entretien dû : échéance atteinte ou dépassée. */
export const entretienDu = (e: EquipementEntree, aujourdhui: Jour): boolean => {
  const ech = echeanceEntretien(e);
  return ech !== null && ech <= aujourdhui;
};

/** Cocher un entretien du mois : enregistre la date et recalcule l'échéance (dernier entretien + périodicité). */
export function enregistrerEntretien(e: EquipementEntree, le: Jour): EquipementEntree {
  return {
    ...e,
    dernierEntretienLe: le,
    prochainEntretienLe: e.periodiciteMois ? ajouterMois(le, e.periodiciteMois) : null,
    modifieLe: le,
  };
}

/** Une ligne par entretien dû dans le mois (3 au plus, « + n autres » au-delà), les plus en retard d'abord. */
export function entretiensDuMois(equipements: readonly EquipementEntree[], aujourdhui: Jour, max = 3): { visibles: EquipementEntree[]; autres: number } {
  const finDuMois = ajouterMois(`${aujourdhui.slice(0, 7)}-01`, 1);
  const dus = equipements
    .filter((e) => !e.reforme)
    .filter((e) => { const ech = echeanceEntretien(e); return ech !== null && ech < finDuMois; })
    .sort((a, b) => (echeanceEntretien(a) as string).localeCompare(echeanceEntretien(b) as string));
  return { visibles: dus.slice(0, max), autres: Math.max(0, dus.length - max) };
}

/* -------- Parc, puces, ordre -------- */

export interface ResumeParc {
  /** Parc hors réformés. */
  total: number;
  enPret: number;
  aEntretenir: number;
  reformes: number;
  /** Barre segmentée : un équipement compte dans un seul segment, par priorité. */
  segments: { bonEtat: number; aVerifier: number; horsService: number };
}

export function resumerLeParc(equipements: readonly EquipementEntree[], aujourdhui: Jour): ResumeParc {
  const parc = equipements.filter((e) => !e.reforme);
  const segments = { bonEtat: 0, aVerifier: 0, horsService: 0 };
  for (const e of parc) {
    if (statutDeLEquipement(e) === 'Hors service') segments.horsService += 1;
    else if (etatNormalise(e.etat) === 'À vérifier' || etatNormalise(e.etat) === 'À réviser') segments.aVerifier += 1;
    else segments.bonEtat += 1;
  }
  return {
    total: parc.length,
    enPret: parc.filter((e) => statutDeLEquipement(e) === 'En prêt').length,
    aEntretenir: parc.filter((e) => entretienDu(e, aujourdhui)).length,
    reformes: equipements.length - parc.length,
    segments,
  };
}

export type Puce = 'tous' | 'en-pret' | 'a-entretenir' | 'reformes';
export function filtrerParPuce<T extends EquipementEntree>(equipements: readonly T[], puce: Puce, aujourdhui: Jour): T[] {
  switch (puce) {
    case 'reformes': return equipements.filter((e) => e.reforme);
    case 'en-pret': return equipements.filter((e) => !e.reforme && statutDeLEquipement(e) === 'En prêt');
    case 'a-entretenir': return equipements.filter((e) => !e.reforme && entretienDu(e, aujourdhui));
    default: return equipements.filter((e) => !e.reforme);
  }
}

/** Ordre des fiches (Proposition) : hors service et retards d'abord, puis dernière modification. */
export function ordreDesFiches<T extends EquipementEntree>(equipements: readonly T[], aujourdhui: Jour): T[] {
  const rang = (e: T): number => (statutDeLEquipement(e) === 'Hors service' ? 0 : entretienDu(e, aujourdhui) ? 1 : 2);
  return [...equipements].sort((a, b) => rang(a) - rang(b) || (b.modifieLe ?? '').localeCompare(a.modifieLe ?? ''));
}

export type Talon = { type: 'personne'; nom: string; vous: boolean; depuis: Jour | null; retour: Jour | null } | { type: 'lieu'; nom: string };

/** Talon détachable : la personne (« Aaron (vous) » pour soi) ou le lieu. */
export function talonDe(e: EquipementEntree, nomUtilisateur: string): Talon {
  if (e.affectation.type === 'lieu') return { type: 'lieu', nom: e.affectation.libelle };
  const vous = e.affectation.libelle.trim().toLowerCase() === nomUtilisateur.trim().toLowerCase();
  return { type: 'personne', nom: e.affectation.libelle, vous, depuis: e.affectation.depuisLe ?? null, retour: e.affectation.retourPrevuLe ?? null };
}

/** Mouvements du jour (prêts, retours, contrôles, entretiens, rappels) : le plus ancien en haut, 5 visibles. */
export function mouvementsDuJour<T extends { heure: string }>(journal: readonly T[], visibles = 5): { visibles: T[]; defilement: boolean } {
  const tries = [...journal].sort((a, b) => a.heure.localeCompare(b.heure));
  return { visibles: tries.slice(0, visibles), defilement: tries.length > visibles };
}

/** Espace insécable exposé pour les libellés de talon (« depuis hier · retour ven. »). */
export const SEPARATEUR_TALON = `${INSECABLE}·${INSECABLE}`;
