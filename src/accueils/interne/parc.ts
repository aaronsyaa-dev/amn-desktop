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
