/**
 * MR10 · PHOTOS DE CHANTIER — logique pure (phases, complétude, planche par jour, comparaison).
 *
 * Règles de la fiche MR10, rubrique 6. La date et le lieu sont ajoutés À LA PRISE (jamais
 * saisis à la main) ; les métadonnées de lieu ne sont visibles que de l'équipe et ne
 * suivent jamais un partage client. Le module actuel ne porte qu'une photo par phase, liée
 * à une intervention : voir `STATUT.md`.
 */

import { ajouterJours, ecartJours, grouper, type Jour } from './commun';

export type Phase = 'Avant' | 'Pendant' | 'Après';
export const PHASES: readonly Phase[] = ['Avant', 'Pendant', 'Après'];

export interface PhotoEntree {
  id: string;
  phase: Phase;
  le: Jour;
  lieu?: string;
  /** Orientation à la prise, en degrés (0–359) ; sert à l'appariement et au « même cadrage ». */
  orientationDeg?: number | null;
  auteurEmail?: string;
}

export interface DossierEntree {
  id: string;
  photos: readonly PhotoEntree[];
  /** Signature du client obtenue (3e élément attendu d'un dossier irréprochable). */
  signatureClient?: boolean;
  demarre?: boolean;
  debutPrevuLe?: Jour | null;
}

/** Puces : comptes par phase (7 + 21 + 8 = 36). */
export function comptesParPhase(photos: readonly PhotoEntree[]): Record<Phase, number> & { total: number } {
  const c = { Avant: 0, Pendant: 0, Après: 0 };
  for (const p of photos) c[p.phase] += 1;
  return { ...c, total: photos.length };
}

export type DetailLigne = { type: 'photos'; photos: number; jours: number } | { type: 'avant-seulement' } | { type: 'debut-prevu'; le: Jour | null };

/** « n photos · n jours » ; « avant seulement » si seule la phase avant existe ; sinon la date de début prévue. */
export function detailDeLigne(d: DossierEntree): DetailLigne {
  const n = d.photos.length;
  if (n === 0) return { type: 'debut-prevu', le: d.debutPrevuLe ?? null };
  if (d.photos.every((p) => p.phase === 'Avant')) return { type: 'avant-seulement' };
  return { type: 'photos', photos: n, jours: new Set(d.photos.map((p) => p.le)).size };
}

export type TonCompletude = 'vert' | 'bleu' | 'orange' | 'pointille';

/** Dossier complet = éléments attendus fournis (photo avant, photo après, signature du client) ÷ attendus, arrondi. */
export function completude(d: DossierEntree): { fournis: number; attendus: 3; pct: number; ton: TonCompletude; manque: ('avant' | 'apres' | 'signature')[] } {
  const manque: ('avant' | 'apres' | 'signature')[] = [];
  if (!d.photos.some((p) => p.phase === 'Avant')) manque.push('avant');
  if (!d.photos.some((p) => p.phase === 'Après')) manque.push('apres');
  if (!d.signatureClient) manque.push('signature');
  const fournis = 3 - manque.length;
  const pct = Math.round((fournis / 3) * 100);
  const ton: TonCompletude = d.photos.length === 0 ? 'pointille' : pct >= 85 ? 'vert' : pct >= 30 ? 'bleu' : 'orange';
  return { fournis, attendus: 3, pct, ton, manque };
}

/** Un dossier « irréprochable » : les trois éléments attendus. */
export const estIrreprochable = (d: DossierEntree): boolean => completude(d).fournis === 3;

export interface JourDePlanche {
  jour: Jour;
  /** Phase la plus fréquente du jour (égalité : la plus avancée). */
  phaseDominante: Phase;
  total: number;
  /** Au plus 8 vignettes. */
  vignettes: PhotoEntree[];
  /** Sur la 8e vignette : les photos restantes du jour, elle-même comprise (« +5 »). Nul si tout tient. */
  plus: number;
}

export const VIGNETTES_PAR_JOUR = 8;

/** Planche « Photos par jour » : jours avec au moins une photo, du plus récent au plus ancien. */
export function planchePhotosParJour(photos: readonly PhotoEntree[], max = VIGNETTES_PAR_JOUR): JourDePlanche[] {
  const rang: Record<Phase, number> = { Avant: 0, Pendant: 1, Après: 2 };
  return [...grouper(photos, (p) => p.le).entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([jour, liste]) => {
      const c = comptesParPhase(liste);
      const dominante = PHASES.reduce((m, p) => (c[p] > c[m] || (c[p] === c[m] && rang[p] > rang[m]) ? p : m), 'Avant' as Phase);
      const tient = liste.length <= max;
      return {
        jour,
        phaseDominante: dominante,
        total: liste.length,
        vignettes: tient ? [...liste] : liste.slice(0, max),
        plus: tient ? 0 : liste.length - (max - 1),
      };
    });
}

/* -------- Comparaison avant / après -------- */

/** Écart d'orientation en degrés, entre 0 et 180. */
export const ecartOrientation = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/** « Même angle, même cadrage » s'affiche seulement si l'écart d'orientation est faible (Proposition : 10°). */
export const ECART_ORIENTATION_MAX_DEG = 10;
export function memeCadrage(avant: PhotoEntree, apres: PhotoEntree): boolean {
  return avant.orientationDeg != null && apres.orientationDeg != null && ecartOrientation(avant.orientationDeg, apres.orientationDeg) <= ECART_ORIENTATION_MAX_DEG;
}

/**
 * Appariement « même endroit » : pour une photo avant, la photo après du même lieu dont l'orientation
 * est la plus proche. Sans lieu ni orientation exploitable : `null` (choix manuel des deux photos).
 */
export function apparier(avant: PhotoEntree, apres: readonly PhotoEntree[]): PhotoEntree | null {
  if (!avant.lieu) return null;
  const memeLieu = apres.filter((p) => p.phase === 'Après' && p.lieu === avant.lieu);
  if (memeLieu.length === 0) return null;
  if (avant.orientationDeg == null) return memeLieu.length === 1 ? memeLieu[0] : null;
  return [...memeLieu].sort((a, b) => ecartOrientation(avant.orientationDeg as number, a.orientationDeg ?? 999) - ecartOrientation(avant.orientationDeg as number, b.orientationDeg ?? 999))[0];
}

/** « 16 jours de travaux » = première photo « Pendant » → dernière photo « Après ». `null` s'il manque l'un des deux. */
export function joursDeTravaux(photos: readonly PhotoEntree[]): number | null {
  const pendant = photos.filter((p) => p.phase === 'Pendant').map((p) => p.le).sort();
  const apres = photos.filter((p) => p.phase === 'Après').map((p) => p.le).sort();
  if (pendant.length === 0 || apres.length === 0) return null;
  return Math.max(0, ecartJours(pendant[0], apres[apres.length - 1]));
}

/* -------- Partage client -------- */

export const CONSERVATION_PAR_DEFAUT_ANS = 10;
export const DUREE_LIEN_PAR_DEFAUT_JOURS = 14;

export interface PhotoPartagee { id: string; phase: Phase; le: Jour }

/** Le partage client passe par un lien protégé à durée limitée, SANS les métadonnées de lieu ni d'auteur. */
export function partagerAuClient(photos: readonly PhotoEntree[], aujourdhui: Jour, dureeJours = DUREE_LIEN_PAR_DEFAUT_JOURS): { photos: PhotoPartagee[]; expireLe: Jour } {
  return { photos: photos.map((p) => ({ id: p.id, phase: p.phase, le: p.le })), expireLe: ajouterJours(aujourdhui, dureeJours) };
}
