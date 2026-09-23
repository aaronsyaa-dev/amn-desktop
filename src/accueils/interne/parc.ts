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
