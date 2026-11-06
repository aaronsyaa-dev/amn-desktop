/**
 * MR09 · FLOTTE DE VÉHICULES — logique pure (jauge, autonomie, compteur, échéances, frise).
 *
 * Règles de la fiche MR09, rubrique 6. Aucun suivi de position du conducteur : le niveau de
 * carburant ou de charge vient d'une saisie (plein, carnet de bord). Les papiers (cartes grises,
 * attestations) restent dans le coffre-fort H24 et ne passent jamais ici.
 */

import { ajouterJours, borner, ecartJours, type Jour } from './commun';

export type Energie = 'thermique' | 'electrique';
export type EtatVehicule = 'Disponible' | 'En tournée' | 'Au garage' | 'Hors service';

/** Les jeux fictifs disent « À l'atelier ». */
export function etatNormalise(brut: string): EtatVehicule {
  if (brut === 'En tournée' || brut === 'Hors service') return brut;
  return brut === 'Au garage' || brut === 'À l’atelier' || brut === 'À l\'atelier' ? 'Au garage' : 'Disponible';
}

/** En tournée : une tournée (MR03) ou une réservation (MR06) est en cours ; sinon l'état saisi. */
export function etatDuVehicule(saisi: string, tourneeOuReservationEnCours: boolean): EtatVehicule {
  const e = etatNormalise(saisi);
  return e === 'Au garage' || e === 'Hors service' ? e : tourneeOuReservationEnCours ? 'En tournée' : 'Disponible';
}

export type TonJauge = 'vert' | 'orange' | 'rouge' | 'bleu';

/** Vert ≥ 50 %, orange de 25 à 49 %, rouge en dessous ; charge en cours : bleu (et scintillement pendant la charge seulement). */
export function tonDeLaJauge(pct: number, enCharge = false): TonJauge {
  if (enCharge) return 'bleu';
  return pct >= 50 ? 'vert' : pct >= 25 ? 'orange' : 'rouge';
}

/** Autonomie « ≈ 410 km » = niveau × autonomie pleine, arrondie à 10 km. */
export const autonomieKm = (niveauPct: number, autonomiePleineKm: number): number => Math.round((borner(niveauPct, 0, 100) / 100) * autonomiePleineKm / 10) * 10;

/** Compteur à 6 chiffres. */
export function chiffresDuCompteur(km: number, n = 6): number[] {
  const s = String(Math.max(0, Math.round(km))).padStart(n, '0').slice(-n);
  return [...s].map(Number);
}

export interface EcheanceEntree {
  nom: string;
  nature: 'km' | 'jours';
  /** Intervalle en km ou en jours. */
  intervalle: number;
  dernierKm?: number | null;
  dernierLe?: Jour | null;
  /** Échéance au jour près (contrôle technique, assurance). */
  le?: Jour | null;
  /** Échéance au kilomètre. */
  aKm?: number | null;
}

export interface EcheanceCalculee {
  nom: string;
  /** Date effective ou estimée. */
  le: Jour;
  /** Une échéance au kilomètre est placée à sa date estimée (« ≈ »). */
  estimee: boolean;
  /** Kilomètres restants (échéance au km). */
  kmRestants: number | null;
  joursRestants: number;
  /** Part écoulée de l'intervalle, 0–100 (800 km restants sur 5 000 → 84 %). */
  partEcoulee: number;
  ton: 'rouge' | 'orange' | 'vert';
}

/** Kilomètres par jour sur les 30 derniers jours (rythme servant à dater une échéance au km). */
export const kmParJour = (kmSur30Jours: number): number => Math.max(0, kmSur30Jours / 30);

/**
 * Échéance calculée : rouge si dépassée ou à moins de 30 jours, orange si moins de 1 000 km
 * ou moins de 45 jours, vert sinon. Au kilomètre, la date est ESTIMÉE au rythme des 30 derniers jours.
 */
export function calculerEcheance(e: EcheanceEntree, kmActuel: number, rythmeKmJour: number, aujourdhui: Jour): EcheanceCalculee | null {
  if (e.nature === 'km') {
    const cible = e.aKm ?? (e.dernierKm != null ? e.dernierKm + e.intervalle : null);
    if (cible === null) return null;
    const restants = cible - kmActuel;
    const jours = rythmeKmJour > 0 ? Math.ceil(Math.max(0, restants) / rythmeKmJour) : 365;
    const part = e.intervalle > 0 ? borner(Math.round((1 - restants / e.intervalle) * 100), 0, 100) : 100;
    const ton = restants <= 0 || jours < 30 ? 'rouge' : restants < 1000 || jours < 45 ? 'orange' : 'vert';
    return { nom: e.nom, le: ajouterJours(aujourdhui, jours), estimee: true, kmRestants: restants, joursRestants: restants <= 0 ? 0 : jours, partEcoulee: part, ton };
  }
  const le = e.le ?? (e.dernierLe ? ajouterJours(e.dernierLe, e.intervalle) : null);
  if (le === null) return null;
  const jours = ecartJours(aujourdhui, le);
  const part = e.intervalle > 0 ? borner(Math.round((1 - jours / e.intervalle) * 100), 0, 100) : 100;
  return { nom: e.nom, le, estimee: false, kmRestants: null, joursRestants: jours, partEcoulee: part, ton: jours < 30 ? 'rouge' : jours < 45 ? 'orange' : 'vert' };
}

/** Échéance de la carte : la plus proche dans le temps. */
export function echeanceProche(echeances: readonly EcheanceEntree[], kmActuel: number, rythmeKmJour: number, aujourdhui: Jour): EcheanceCalculee | null {
  return echeances
    .map((e) => calculerEcheance(e, kmActuel, rythmeKmJour, aujourdhui))
    .filter((x): x is EcheanceCalculee => x !== null)
    .sort((a, b) => a.le.localeCompare(b.le))[0] ?? null;
}

export interface VehiculeFrise { id: string; nom: string; kmActuel: number; kmSur30Jours: number; echeances: readonly EcheanceEntree[] }
export interface PointDeFrise { vehiculeId: string; nom: string; le: Jour; estimee: boolean; ton: EcheanceCalculee['ton'] }

/** Frise d'entretien : échéances des 6 prochains mois, une ligne par véhicule plus une ligne « flotte » (toutes), dans l'ordre du temps. */
export function friseDEntretien(vehicules: readonly VehiculeFrise[], aujourdhui: Jour, mois = 6): { parVehicule: Map<string, PointDeFrise[]>; flotte: PointDeFrise[] } {
  const horizon = ajouterJours(aujourdhui, Math.round(mois * 30.44));
  const parVehicule = new Map<string, PointDeFrise[]>();
  for (const v of vehicules) {
    const rythme = kmParJour(v.kmSur30Jours);
    const points = v.echeances
      .map((e) => calculerEcheance(e, v.kmActuel, rythme, aujourdhui))
      .filter((x): x is EcheanceCalculee => x !== null && x.le <= horizon)
      .map((x) => ({ vehiculeId: v.id, nom: x.nom, le: x.le < aujourdhui ? aujourdhui : x.le, estimee: x.estimee, ton: x.ton }))
      .sort((a, b) => a.le.localeCompare(b.le));
    parVehicule.set(v.id, points);
  }
  return { parVehicule, flotte: [...parVehicule.values()].flat().sort((a, b) => a.le.localeCompare(b.le)) };
}

/** Sous-titre : kilomètres du mois et variation du carburant par rapport au mois précédent au même nombre de jours. */
export function bilanDuMois(parJour: readonly { jour: Jour; km: number; carburantCents: number }[], aujourdhui: Jour): { kmDuMois: number; variationCarburantPct: number | null } {
  const debut = `${aujourdhui.slice(0, 7)}-01`;
  const n = Number(aujourdhui.slice(8, 10));
  const debutPrec = ajouterJours(debut, -1).slice(0, 7) + '-01';
  const finPrec = ajouterJours(debutPrec, n - 1);
  const mois = parJour.filter((x) => x.jour >= debut && x.jour <= aujourdhui);
  const prec = parJour.filter((x) => x.jour >= debutPrec && x.jour <= finPrec);
  const carb = mois.reduce((s, x) => s + x.carburantCents, 0);
  const carbPrec = prec.reduce((s, x) => s + x.carburantCents, 0);
  return { kmDuMois: mois.reduce((s, x) => s + x.km, 0), variationCarburantPct: carbPrec > 0 ? Math.round(((carb - carbPrec) / carbPrec) * 100) : null };
}

/** « Avant le prochain trajet » : trois contrôles du véhicule du prochain trajet réservé, écrits dans Tâches. */
export function controlesAvantTrajet(energie: Energie): { id: string; motif: 'carburant' | 'charge' | 'pneus' | 'papiers' }[] {
  return [
    { id: 'niveau', motif: energie === 'electrique' ? 'charge' : 'carburant' },
    { id: 'pneus', motif: 'pneus' },
    { id: 'papiers', motif: 'papiers' },
  ];
}
