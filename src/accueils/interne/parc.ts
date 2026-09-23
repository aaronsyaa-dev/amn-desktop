import type { AdminOrganization } from '../../shared/api';
import type { GardeDossier, GardeGravite } from '../../shared/garde';

/**
 * L'ÉTAT D'UNE ORGANISATION DU PARC, en trois paliers — ce que partagent la
 * carte des neuf (`42b`) et le radar (`42d`). Pur : éprouvé par
 * `check:cinquante`.
 */
export type Palier = 'calme' | 'suivre' | 'critique';

const RANG: Record<GardeGravite, number> = { critique: 0, haute: 1, normale: 2 };

/** « L'ordre des cases est fixé une fois (par ancienneté) et ne se retrie jamais selon l'état. » */
export function ordreFixe<T extends Pick<AdminOrganization, 'id' | 'createdAt'>>(orgs: T[]): T[] {
  return [...orgs].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

/** « Au-delà de neuf, quatre colonnes ; au-delà de seize, la variante est retirée du choix. » */
export const colonnesCarte = (n: number): 3 | 4 | null => (n <= 9 ? 3 : n <= 16 ? 4 : null);

export function palierDe(dossiers: Pick<GardeDossier, 'gravite'>[]): Palier {
  if (dossiers.some((d) => d.gravite === 'critique')) return 'critique';
  return dossiers.length ? 'suivre' : 'calme';
}

/** Le dossier qui parle pour l'organisation : le plus grave, puis le plus ancien. */
export function dossierEnTete<T extends Pick<GardeDossier, 'gravite' | 'depuis'>>(dossiers: T[]): T | null {
  return [...dossiers].sort((a, b) => RANG[a.gravite] - RANG[b.gravite] || a.depuis.localeCompare(b.depuis))[0] ?? null;
}

/* ═══ I4 · le radar (`42d`) ═══════════════════════════════════════════ */

export const RADAR = { c: 210, marge: 30, rCritique: 70, rHaute: 140, rBord: 190, rNoms: 210 } as const;
const JOUR = 86_400_000;

/** « Un point vaut UN JOUR de dossier ouvert, pas une remontée » — un dossier d'un jour a un point. */
export function pointsDuDossier(depuisIso: string, maintenant: number): number {
  return Math.max(1, Math.floor((maintenant - Date.parse(depuisIso)) / JOUR));
}

/** La bande de distance d'une gravité : plus près du centre, plus grave. */
export function bandeRadar(g: GardeGravite): [number, number] {
  return g === 'critique' ? [18, RADAR.rCritique - 8] : g === 'haute' ? [RADAR.rCritique + 12, RADAR.rHaute - 10] : [RADAR.rHaute + 10, RADAR.rBord - 6];
}

/** L'angle (degrés, 0 en haut, sens horaire) du début du secteur `i` sur `n`. */
export const angleSecteur = (i: number, n: number) => (360 / n) * i;

export function surRadar(angleDeg: number, r: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [RADAR.c + Math.sin(a) * r, RADAR.c - Math.cos(a) * r];
}

/** Le secteur `i` sur `n`, en chemin SVG fermé (centre → arc du bord). */
export function cheminSecteur(i: number, n: number): string {
  const [x1, y1] = surRadar(angleSecteur(i, n), RADAR.rBord);
  const [x2, y2] = surRadar(angleSecteur(i + 1, n), RADAR.rBord);
  const f = (v: number) => v.toFixed(1);
  return `M${RADAR.c} ${RADAR.c} L${f(x1)} ${f(y1)} A${RADAR.rBord} ${RADAR.rBord} 0 ${360 / n > 180 ? 1 : 0} 1 ${f(x2)} ${f(y2)} Z`;
}

/**
 * Les points d'un secteur : chaque dossier y a sa droite (réparties dans le
 * secteur), et ses `k` points s'étagent dans la bande de sa gravité.
 */
export function pointsDuSecteur(
  i: number,
  n: number,
  dossiers: { gravite: GardeGravite; points: number }[],
): { x: number; y: number; gravite: GardeGravite }[] {
  const largeur = 360 / n;
  const r: { x: number; y: number; gravite: GardeGravite }[] = [];
  dossiers.forEach((d, j) => {
    const angle = angleSecteur(i, n) + (largeur * (j + 1)) / (dossiers.length + 1);
    const [a, b] = bandeRadar(d.gravite);
    for (let k = 0; k < d.points; k++) {
      const [x, y] = surRadar(angle, a + ((k + 0.5) / d.points) * (b - a));
      r.push({ x, y, gravite: d.gravite });
    }
  });
  return r;
}

/* ═══ I5 · le compteur de nuit (`42e`) ═════════════════════════════════ */

/** « Autant de palettes que de chiffres, jamais de séparateur de milliers. » */
export const palettes = (n: number) => String(Math.max(0, Math.round(n))).split('');

/* ═══ I7 · la météo des sites (`42g`) ══════════════════════════════════ */

export const METEO = { cases: 24, maxSites: 12, paliers: 4 } as const;

/** Le 95ᵉ centile (rang le plus proche) d'un ensemble de mesures. */
export function centile95(valeurs: number[]): number | null {
  if (!valeurs.length) return null;
  const v = [...valeurs].sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.ceil(0.95 * v.length) - 1)];
}

/**
 * « Quatre paliers de clarté, bornés au 95ᵉ centile du parc » : 0 (sombre)
 * → 3 (clair). Tout ce qui atteint le centile est au palier le plus clair ;
 * en dessous, quatre parts égales.
 */
export function palierMeteo(latenceMs: number, p95: number): 0 | 1 | 2 | 3 {
  if (p95 <= 0 || latenceMs >= p95) return 3;
  return Math.min(3, Math.max(0, Math.floor((latenceMs / p95) * METEO.paliers))) as 0 | 1 | 2 | 3;
}

/** La case (0 → 23) d'une mesure : la dernière case est l'heure en cours. Hors fenêtre : null. */
export function caseHoraire(atMs: number, maintenant: number): number | null {
  const heureCourante = Math.floor(maintenant / 3_600_000);
  const i = METEO.cases - 1 - (heureCourante - Math.floor(atMs / 3_600_000));
  return i >= 0 && i < METEO.cases ? i : null;
}

/** L'ordre d'affichage : les sites en incident d'abord, puis les plus lents ; douze au plus. */
export function sitesAMontrer<T extends { incident: boolean; lenteur: number }>(sites: T[]): { montres: T[]; autres: number } {
  const tri = [...sites].sort((a, b) => Number(b.incident) - Number(a.incident) || b.lenteur - a.lenteur);
  return { montres: tri.slice(0, METEO.maxSites), autres: Math.max(0, tri.length - METEO.maxSites) };
}

/* ═══ I8 · l'horizon des expirations (`42h`) ═══════════════════════════ */

export const HORIZON = { jours: 30, procheJ: 7, minPile: 2, hauteurMarque: 12 } as const;

/** Le jour (0 = aujourd'hui) d'une échéance dans l'horizon ; hors horizon : null. */
export function jourDHorizon(echeanceMs: number, maintenant: Date): number | null {
  const debut = new Date(maintenant);
  debut.setHours(0, 0, 0, 0);
  const j = Math.floor((echeanceMs - debut.getTime()) / 86_400_000);
  return j >= 0 && j < HORIZON.jours ? j : null;
}

/**
 * « Seule une pile d'au moins deux échéances à moins de sept jours peut porter
 * l'ambre » : la plus chargée d'entre elles ; à égalité, la plus proche.
 */
export function pileEnAmbre(piles: number[]): number | null {
  let m: number | null = null;
  for (let j = 0; j < Math.min(HORIZON.procheJ, piles.length); j++) if (piles[j] >= HORIZON.minPile && (m === null || piles[j] > piles[m])) m = j;
  return m;
}
