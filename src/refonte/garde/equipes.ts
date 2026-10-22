import type { EQUIPES_ORDRE } from '../../lib/garde';
import type { CSSProperties } from 'react';

/**
 * LES HUIT ACCENTS D'ÉQUIPE DE LA GARDE (S3).
 *
 * Le socle ne donne que les sept familles, qui disent « où je suis ». Une
 * équipe de la Garde dit autre chose : « qui travaille ». Elle a donc ses
 * propres accents, dérivés de la palette du socle :
 *
 *   · même clarté et même saturation douce que les familles (OKLCH ≈ 0,74–0,80
 *     de clarté, chroma ≤ 0,10) — elles se rangent à côté sans crier ;
 *   · teintes réparties hors de l'ambre (25–55°, réservé à LA décision) et hors
 *     du rouge (< 20° ou > 345°, réservé au critique) ;
 *   · `base` ≥ 3:1 et `texte` ≥ 4,5:1 sur les cinq surfaces graphite et sur le
 *     noir de la veille ; même règle en thème clair. `check:garde-refonte` le
 *     recalcule depuis ce fichier.
 *
 * Elles s'emploient par variables posées en `style` (`--equipe`,
 * `--equipe-texte`) : aucun nom de classe fabriqué à l'exécution.
 */
// Import de type seulement : `Record<CleEquipe, …>` refuse une équipe oubliée,
// et le fichier reste lisible hors application (check:garde-refonte).
export type CleEquipe = (typeof EQUIPES_ORDRE)[number];

export interface AccentEquipe {
  /** Point, filet, trait. */
  base: string;
  /** Encre lisible. */
  texte: string;
}

export const ACCENTS_EQUIPE: Record<CleEquipe, { sombre: AccentEquipe; clair: AccentEquipe }> = {
  sites: { sombre: { base: '#83b7e4', texte: '#a0cdf4' }, clair: { base: '#3e7aaa', texte: '#225c88' } },
  securite: { sombre: { base: '#aaa0e6', texte: '#c0b8f5' }, clair: { base: '#7467b3', texte: '#584b90' } },
  comptes: { sombre: { base: '#a5c883', texte: '#bfdda2' }, clair: { base: '#5e8133', texte: '#436416' } },
  registre: { sombre: { base: '#a6afbb', texte: '#bdc5cf' }, clair: { base: '#6c7582', texte: '#505964' } },
  clientes: { sombre: { base: '#6fcabf', texte: '#93dfd4' }, clair: { base: '#00887c', texte: '#00695f' } },
  produit: { sombre: { base: '#e297ba', texte: '#f3b1cf' }, clair: { base: '#a6567e', texte: '#843b61' } },
  taches: { sombre: { base: '#c69bda', texte: '#d9b4ea' }, clair: { base: '#8e5ea3', texte: '#6f4382' } },
  memoire: { sombre: { base: '#99cda3', texte: '#b5e1bd' }, clair: { base: '#4a8457', texte: '#2f663d' } },
};

/** Une équipe inconnue du poste (serveur plus récent) prend l'ardoise neutre. */
const NEUTRE = { sombre: { base: '#a2acbc', texte: '#bcc4d1' }, clair: { base: '#6e7a8d', texte: '#4c5667' } };

export function estCleEquipe(cle: string): cle is CleEquipe {
  return Object.prototype.hasOwnProperty.call(ACCENTS_EQUIPE, cle);
}

function themeClair(): boolean {
  return typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'clair';
}

export function accentEquipe(cle: string, clair = themeClair()): AccentEquipe {
  const a = estCleEquipe(cle) ? ACCENTS_EQUIPE[cle] : NEUTRE;
  return clair ? a.clair : a.sombre;
}

/** Les variables d'une équipe, à poser en `style` sur un bloc. */
export function styleEquipe(cle: string): CSSProperties {
  const a = accentEquipe(cle);
  return { ['--equipe' as string]: a.base, ['--equipe-texte' as string]: a.texte };
}
