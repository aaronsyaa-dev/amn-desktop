/**
 * MR06 · RÉSERVATIONS — logique pure (aucun doublon, conflits, créneaux libres, occupation).
 *
 * Règles de la fiche MR06, rubrique 6. La vérification « aucun doublon » est faite par le
 * SERVEUR à l'enregistrement : `verifierSansDoublon` en est la référence exécutable, utilisée
 * pour l'affichage et les tests. Les créneaux libres sont calculés, jamais enregistrés ;
 * un conflit n'est jamais résolu automatiquement.
 */

import { ajouterJours, jourDeSemaine, jourParis, minutesDe, minutesParis, pourcentDe, type Jour } from './commun';

export interface RessourceEntree {
  id: string;
  nom: string;
  type: 'salle' | 'matériel' | 'véhicule';
  groupe?: string;
  /** Jours réservables (convention ISO : 1 = lundi … 7 = dimanche, comme les jeux fictifs) et plage « 08:00 »–« 18:00 ». */
  ouverture: { jours: readonly number[]; debut: string; fin: string };
  /** Hors service ou au garage (MR04, MR09) : aucune réservation possible. */
  indisponible?: boolean;
  regles?: { dureeMaxMin?: number };
}

export interface ReservationEntree {
  id: string;
  ressourceId: string;
  /** Instants ISO. */
  debutAt: string;
  finAt: string;
  statut: 'confirmée' | 'en attente' | 'annulée';
}

/** Deux intervalles se chevauchent s'ils partagent un instant ; ils sont OUVERTS à la fin (9:00–11:00 et 11:00–12:00 sont compatibles). */
export const seChevauchent = (a: { debut: number; fin: number }, b: { debut: number; fin: number }): boolean => a.debut < b.fin && b.debut < a.fin;

const intervalle = (r: ReservationEntree): { debut: number; fin: number } => ({ debut: Date.parse(r.debutAt), fin: Date.parse(r.finAt) });

/** Réservations confirmées de la même ressource qui chevauchent la demande. */
export function verifierSansDoublon(demande: Pick<ReservationEntree, 'ressourceId' | 'debutAt' | 'finAt' | 'id'>, existantes: readonly ReservationEntree[]): ReservationEntree[] {
  const d = intervalle(demande as ReservationEntree);
  return existantes.filter((r) => r.statut === 'confirmée' && r.ressourceId === demande.ressourceId && r.id !== demande.id && seChevauchent(d, intervalle(r)));
}

export interface Conflit { demande: ReservationEntree; avec: ReservationEntree[] }

/** Conflits affichés : des demandes (non confirmées) qui chevauchent une réservation confirmée. Elles restent en attente jusqu'à décision. */
export function conflitsEnAttente(reservations: readonly ReservationEntree[]): Conflit[] {
  const confirmees = reservations.filter((r) => r.statut === 'confirmée');
  return reservations
    .filter((r) => r.statut === 'en attente')
    .map((demande) => ({ demande, avec: verifierSansDoublon(demande, confirmees) }))
    .filter((c) => c.avec.length > 0);
}

/** Plage réservable d'une ressource un jour donné, en minutes depuis minuit ; `null` si fermée ce jour ou indisponible. */
export function plageDuJour(r: RessourceEntree, jour: Jour): { debut: number; fin: number } | null {
  if (r.indisponible || !r.ouverture.jours.includes(jourDeSemaine(jour) + 1)) return null;
  return { debut: minutesDe(r.ouverture.debut), fin: minutesDe(r.ouverture.fin) };
}

/** Réservations confirmées d'une ressource ce jour-là, en minutes locales (Paris), coupées à la plage. */
function occupeesDuJour(r: RessourceEntree, reservations: readonly ReservationEntree[], jour: Jour): { debut: number; fin: number }[] {
  const plage = plageDuJour(r, jour);
  if (!plage) return [];
  return reservations
    .filter((x) => x.ressourceId === r.id && x.statut === 'confirmée' && jourParis(x.debutAt) === jour)
    .map((x) => ({ debut: Math.max(plage.debut, minutesParis(x.debutAt)), fin: Math.min(plage.fin, minutesParis(x.finAt)) }))
    .filter((x) => x.fin > x.debut)
    .sort((a, b) => a.debut - b.debut);
}

export interface CreneauLibre { ressourceId: string; debut: number; fin: number; dureeMin: number }

/** Créneaux libres d'au moins `minMin` (1 h par défaut) dans les plages réservables. */
export function creneauxLibres(r: RessourceEntree, reservations: readonly ReservationEntree[], jour: Jour, minMin = 60): CreneauLibre[] {
  const plage = plageDuJour(r, jour);
  if (!plage) return [];
  const libres: CreneauLibre[] = [];
  let curseur = plage.debut;
  for (const o of occupeesDuJour(r, reservations, jour)) {
    if (o.debut - curseur >= minMin) libres.push({ ressourceId: r.id, debut: curseur, fin: o.debut, dureeMin: o.debut - curseur });
    curseur = Math.max(curseur, o.fin);
  }
  if (plage.fin - curseur >= minMin) libres.push({ ressourceId: r.id, debut: curseur, fin: plage.fin, dureeMin: plage.fin - curseur });
  return libres;
}

/** « 6 créneaux libres » = créneaux de 2 h et plus (Proposition) ; « le plus long » toutes ressources confondues. */
export function resumeDesCreneaux(ressources: readonly RessourceEntree[], reservations: readonly ReservationEntree[], jour: Jour): { nombre: number; plusLong: CreneauLibre | null } {
  const tous = ressources.flatMap((r) => creneauxLibres(r, reservations, jour, 60));
  const longs = tous.filter((c) => c.dureeMin >= 120);
  return { nombre: longs.length, plusLong: [...tous].sort((a, b) => b.dureeMin - a.dureeMin)[0] ?? null };
}

/* -------- Occupation -------- */

const minutesReservees = (r: RessourceEntree, reservations: readonly ReservationEntree[], jour: Jour, de?: number, a?: number): number =>
  occupeesDuJour(r, reservations, jour).reduce((s, o) => s + Math.max(0, Math.min(o.fin, a ?? o.fin) - Math.max(o.debut, de ?? o.debut)), 0);

const minutesReservables = (r: RessourceEntree, jour: Jour, de?: number, a?: number): number => {
  const p = plageDuJour(r, jour);
  return p ? Math.max(0, Math.min(p.fin, a ?? p.fin) - Math.max(p.debut, de ?? p.debut)) : 0;
};

/** Occupation d'un jour = heures réservées ÷ heures réservables, toutes ressources, arrondie. `null` si rien n'est réservable. */
export function occupationDuJour(ressources: readonly RessourceEntree[], reservations: readonly ReservationEntree[], jour: Jour): number | null {
  const dispo = ressources.reduce((s, r) => s + minutesReservables(r, jour), 0);
  if (dispo === 0) return null;
  return pourcentDe(ressources.reduce((s, r) => s + minutesReservees(r, reservations, jour), 0), dispo);
}

/** Occupation de la semaine (5 jours à partir du lundi donné), même calcul sur l'ensemble des jours. */
export function occupationDeLaSemaine(ressources: readonly RessourceEntree[], reservations: readonly ReservationEntree[], lundi: Jour): { parJour: { jour: Jour; pct: number | null }[]; semaine: number | null } {
  const jours = Array.from({ length: 5 }, (_, i) => ajouterJours(lundi, i));
  let dispo = 0;
  let prises = 0;
  for (const j of jours) for (const r of ressources) { dispo += minutesReservables(r, j); prises += minutesReservees(r, reservations, j); }
  return { parJour: jours.map((jour) => ({ jour, pct: occupationDuJour(ressources, reservations, jour) })), semaine: dispo > 0 ? pourcentDe(prises, dispo) : null };
}

/** Demi-journées les moins occupées (< 40 %), matin avant 13 h, après-midi ensuite. */
export function demiJourneesCreuses(ressources: readonly RessourceEntree[], reservations: readonly ReservationEntree[], lundi: Jour, seuilPct = 40): { jour: Jour; moment: 'matin' | 'apres-midi'; pct: number }[] {
  const coupure = 13 * 60;
  const sortie: { jour: Jour; moment: 'matin' | 'apres-midi'; pct: number }[] = [];
  for (let i = 0; i < 5; i += 1) {
    const jour = ajouterJours(lundi, i);
    for (const [moment, de, a] of [['matin', 0, coupure], ['apres-midi', coupure, 24 * 60]] as const) {
      const dispo = ressources.reduce((s, r) => s + minutesReservables(r, jour, de, a), 0);
      if (dispo === 0) continue;
      const pct = pourcentDe(ressources.reduce((s, r) => s + minutesReservees(r, reservations, jour, de, a), 0), dispo);
      if (pct < seuilPct) sortie.push({ jour, moment, pct });
    }
  }
  return sortie.sort((a, b) => a.pct - b.pct);
}

/** « Aucun doublon depuis 42 jours » = jours depuis le dernier conflit enregistré (accepté ou refusé) ; `null` s'il n'y en a jamais eu. */
export function joursSansDoublon(conflitsLe: readonly Jour[], aujourdhui: Jour): number | null {
  const dernier = [...conflitsLe].sort().pop();
  return dernier ? Math.max(0, Math.round((Date.parse(aujourdhui) - Date.parse(dernier)) / 86_400_000)) : null;
}

/** Position de la ligne « maintenant » sur l'axe 08:00–18:00, entre 0 et 1 (`null` hors axe). */
export function positionMaintenant(maintenantMin: number, axeDebut = 8 * 60, axeFin = 18 * 60): number | null {
  return maintenantMin < axeDebut || maintenantMin > axeFin ? null : (maintenantMin - axeDebut) / (axeFin - axeDebut);
}

export type FiltreRessource = 'tout' | 'salles' | 'vehicules' | 'materiel';
export function filtrerRessources<T extends RessourceEntree>(ressources: readonly T[], filtre: FiltreRessource): T[] {
  const type = { salles: 'salle', vehicules: 'véhicule', materiel: 'matériel' } as const;
  return filtre === 'tout' ? [...ressources] : ressources.filter((r) => r.type === type[filtre]);
}
