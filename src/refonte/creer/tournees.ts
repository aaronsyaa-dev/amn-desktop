/**
 * MR03 · TOURNÉES — logique pure (heures d'arrivée, retard, résumé, position du véhicule).
 *
 * Règles de la fiche MR03, rubrique 6. Aucun service de plan ici : les temps de trajet
 * arrivent déjà calculés (service côté serveur, clés jamais dans l'application). Aucun
 * suivi de position : la position du véhicule est INTERPOLÉE à partir de l'heure de
 * départ et du temps prévu.
 */

import { borner, hhmmDe, minutesDe, somme } from './commun';

export type EtatEtape = 'À venir' | 'En route' | 'Sur place' | 'Terminé';

/** Les jeux fictifs et le module actuel disent « À faire », « Fait »… */
export function etatNormalise(brut: string): EtatEtape {
  switch (brut) {
    case 'En route': return 'En route';
    case 'Sur place': return 'Sur place';
    case 'Terminé': case 'Fait': return 'Terminé';
    default: return 'À venir'; // « À faire », « Reportée », inconnu
  }
}

export interface EtapeEntree {
  id: string;
  lieu: string;
  /** Minutes de trajet depuis l'étape précédente (ou depuis le départ pour la première). */
  trajetMin: number;
  trajetKm?: number;
  dureeMin: number;
  /** Heure fixée (rendez-vous) : « 10:30 », sinon libre. */
  heureFixee?: string | null;
  etat: string;
  /** Adresse introuvable : l'étape sort du plan et du calcul. */
  adresseAVerifier?: boolean;
  /** Heure d'arrivée réelle enregistrée. */
  arriveeReelle?: string | null;
}

export interface EtapeCalculee extends EtapeEntree {
  etatNorm: EtatEtape;
  /** Arrivée estimée, « 09:20 ». */
  arriveeEstimee: string;
  /** Attente avant une heure fixée. */
  attenteMin: number;
  /** Retard par rapport à l'heure fixée (0 si libre). */
  retardMin: number;
  departEstime: string;
}

/**
 * Heure d'arrivée = départ + trajets + durées des étapes précédentes. Une étape à heure
 * fixée garde son heure (avec attente éventuelle avant) ; si on arrive après, c'est un retard.
 * Les étapes à adresse introuvable sont écartées du calcul.
 */
export function calculerHeures(departHhmm: string, etapes: readonly EtapeEntree[]): EtapeCalculee[] {
  let courant = minutesDe(departHhmm);
  const sorties: EtapeCalculee[] = [];
  for (const e of etapes) {
    if (e.adresseAVerifier) continue;
    const brute = courant + e.trajetMin;
    const fixe = e.heureFixee ? minutesDe(e.heureFixee) : null;
    const arrivee = fixe !== null ? Math.max(brute, fixe) : brute;
    const attente = fixe !== null ? Math.max(0, fixe - brute) : 0;
    const retard = fixe !== null ? Math.max(0, brute - fixe) : 0;
    sorties.push({ ...e, etatNorm: etatNormalise(e.etat), arriveeEstimee: hhmmDe(arrivee), attenteMin: attente, retardMin: retard, departEstime: hhmmDe(arrivee + e.dureeMin) });
    courant = arrivee + e.dureeMin;
  }
  return sorties;
}

export type TonRetard = 'vert' | 'orange' | 'rouge';
/** Vert à 0, orange de 1 à 15 min, rouge au-delà (Proposition). */
export const tonDuRetard = (min: number): TonRetard => (min <= 0 ? 'vert' : min <= 15 ? 'orange' : 'rouge');

export interface Resume {
  distanceKm: number;
  routeMin: number;
  surPlaceMin: number;
  /** Max(0, arrivée estimée − arrivée prévue) sur les étapes restantes. */
  retardMin: number;
  ton: TonRetard;
}

/** Résumé calculé, jamais saisi. `retour` : trajet de retour au point de départ (si le réglage est actif). */
export function resumerTournee(etapes: readonly EtapeCalculee[], arriveesPrevues: Readonly<Record<string, string>>, retour?: { km: number; min: number }): Resume {
  const km = somme(etapes.map((e) => e.trajetKm ?? 0)) + (retour?.km ?? 0);
  const route = somme(etapes.map((e) => e.trajetMin)) + (retour?.min ?? 0);
  const surPlace = somme(etapes.map((e) => e.dureeMin));
  const restantes = etapes.filter((e) => e.etatNorm !== 'Terminé');
  const retard = restantes.reduce((m, e) => {
    const prevue = arriveesPrevues[e.id];
    return prevue ? Math.max(m, minutesDe(e.arriveeEstimee) - minutesDe(prevue)) : m;
  }, 0);
  return { distanceKm: Math.round(km * 10) / 10, routeMin: route, surPlaceMin: surPlace, retardMin: Math.max(0, retard), ton: tonDuRetard(retard) };
}

/** « 12 km et 25 min gagnés » : différence avec l'ordre d'origine ; `null` si rien n'a été gagné. */
export function gainDeLOptimisation(avant: { km: number; min: number }, apres: { km: number; min: number }): { km: number; min: number } | null {
  const km = Math.round((avant.km - apres.km) * 10) / 10;
  const min = Math.round(avant.min - apres.min);
  return km > 0 || min > 0 ? { km: Math.max(0, km), min: Math.max(0, min) } : null;
}

/** « arrivée dans 18 min » = arrivée estimée − heure actuelle (jamais négatif). */
export function minutesAvantArrivee(arriveeEstimee: string, maintenantHhmm: string): number {
  return Math.max(0, minutesDe(arriveeEstimee) - minutesDe(maintenantHhmm));
}

/** Prévenir le client 30 min avant l'arrivée estimée. */
export const DELAI_PREVENIR_MIN = 30;
export const momentDePrevenir = (arriveeEstimee: string): string => hhmmDe(minutesDe(arriveeEstimee) - DELAI_PREVENIR_MIN);

/* -------- Transitions d'état -------- */

export type Action = 'partir' | 'arriver' | 'terminer';

/**
 * États d'une étape : À venir → En route (« Partir ») → Sur place (« Je suis arrivé ») →
 * Terminé. Une seule étape « En route » à la fois : en partir pour une autre est refusé
 * tant que la précédente n'est pas arrivée.
 */
export function appliquerAction(etapes: readonly EtapeEntree[], id: string, action: Action): { ok: true; etapes: EtapeEntree[] } | { ok: false; raison: 'inconnue' | 'deja-en-route' | 'ordre' } {
  const cible = etapes.find((e) => e.id === id);
  if (!cible) return { ok: false, raison: 'inconnue' };
  const etat = etatNormalise(cible.etat);
  if (action === 'partir') {
    if (etat !== 'À venir') return { ok: false, raison: 'ordre' };
    if (etapes.some((e) => e.id !== id && etatNormalise(e.etat) === 'En route')) return { ok: false, raison: 'deja-en-route' };
    return { ok: true, etapes: etapes.map((e) => (e.id === id ? { ...e, etat: 'En route' } : e)) };
  }
  if (action === 'arriver') {
    if (etat !== 'En route') return { ok: false, raison: 'ordre' };
    return { ok: true, etapes: etapes.map((e) => (e.id === id ? { ...e, etat: 'Sur place' } : e)) };
  }
  if (etat !== 'Sur place') return { ok: false, raison: 'ordre' };
  return { ok: true, etapes: etapes.map((e) => (e.id === id ? { ...e, etat: 'Terminé' } : e)) };
}

export type EtatTournee = 'vide' | 'pas-commencee' | 'en-cours' | 'bouclee';
export function etatDeLaTournee(etapes: readonly EtapeEntree[]): EtatTournee {
  const e = etapes.map((x) => etatNormalise(x.etat));
  if (e.length === 0) return 'vide';
  if (e.every((x) => x === 'Terminé')) return 'bouclee';
  if (e.every((x) => x === 'À venir')) return 'pas-commencee';
  return 'en-cours';
}

/* -------- Plan stylisé -------- */

export interface Point { x: number; y: number }
export type SegmentTrait = 'fait' | 'en-route' | 'a-venir' | 'retour';
export interface Segment { de: Point; vers: Point; trait: SegmentTrait }

/**
 * Segments du trajet : fait (jusqu'à la position actuelle), en route (de la position à l'étape
 * suivante), à venir (étapes restantes), retour (dernière étape → départ, si réglé).
 * `points[0]` est le départ, puis une entrée par étape dans l'ordre.
 */
export function segmentsDuTrajet(points: readonly Point[], etats: readonly EtatEtape[], avecRetour: boolean): Segment[] {
  const segs: Segment[] = [];
  for (let i = 1; i < points.length; i += 1) {
    const etatArrivee = etats[i - 1];
    const trait: SegmentTrait = etatArrivee === 'Terminé' || etatArrivee === 'Sur place' ? 'fait' : etatArrivee === 'En route' ? 'en-route' : 'a-venir';
    segs.push({ de: points[i - 1], vers: points[i], trait });
  }
  if (avecRetour && points.length > 1) segs.push({ de: points[points.length - 1], vers: points[0], trait: 'retour' });
  return segs;
}

/** Position du véhicule sur le segment en cours : interpolation entre départ et arrivée selon le temps écoulé (pas de GPS). */
export function positionDuVehicule(de: Point, vers: Point, departMin: number, dureePrevueMin: number, maintenantMin: number): Point {
  const t = dureePrevueMin > 0 ? borner((maintenantMin - departMin) / dureePrevueMin, 0, 1) : 1;
  return { x: de.x + (vers.x - de.x) * t, y: de.y + (vers.y - de.y) * t };
}

/** « Avant de partir » (Proposition) : trois contrôles écrits dans Tâches. */
export function controlesAvantDepart(a: { materielPrevu: boolean; prochainClient: string | null }): { id: string; motif: 'charger-materiel' | 'prevenir-client' | 'verifier-itineraire' }[] {
  const liste: { id: string; motif: 'charger-materiel' | 'prevenir-client' | 'verifier-itineraire' }[] = [];
  if (a.materielPrevu) liste.push({ id: 'materiel', motif: 'charger-materiel' });
  if (a.prochainClient) liste.push({ id: 'client', motif: 'prevenir-client' });
  liste.push({ id: 'itineraire', motif: 'verifier-itineraire' });
  return liste;
}
