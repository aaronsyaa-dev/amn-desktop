/**
 * LA TENDANCE, QUAND ELLE A UN SENS — ET LE SILENCE QUAND ELLE N'EN A PAS
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Aaron demandait « une tendance d'activité ». Le piège d'une tendance, c'est
 * qu'elle a toujours l'air de vouloir dire quelque chose : « +100 % » se lit
 * comme une réussite, même quand il s'agit de deux enregistrements contre un.
 * Et une division par une période vide rend `Infinity`, qui s'affiche
 * fièrement à l'écran.
 *
 * Ce module tranche quatre cas plutôt qu'un :
 *
 *   · les deux périodes vides — il n'y a rien à comparer, on ne dit rien ;
 *   · la période précédente vide — c'est un DÉBUT, pas une hausse de x % ;
 *     aucun pourcentage n'existe, et en inventer un serait une division par
 *     zéro déguisée ;
 *   · l'écart sous le seuil — c'est du bruit ; annoncer « +3 % » toutes les
 *     semaines apprend surtout à ne plus lire le chiffre ;
 *   · au-delà — là, et là seulement, la variation est dite.
 *
 * Rien n'est arrondi vers le haut par gentillesse : une baisse se dit baisse.
 * Un tableau de supervision qui enjolive ne sert à rien, parce qu'on ne le
 * consulte que les jours où ça va mal.
 */

/**
 * En deçà, l'écart n'est pas une tendance.
 *
 * Cinq pour cent, c'est un enregistrement de plus sur vingt : la variation
 * normale d'une semaine ordinaire, pas un mouvement.
 */
export const SEUIL_BRUIT = 5;

export type TrendDirection =
  /** Hausse au-delà du seuil. */
  | 'up'
  /** Baisse au-delà du seuil. */
  | 'down'
  /** Un écart existe, mais il tient dans le bruit. */
  | 'flat'
  /** Rien avant, quelque chose maintenant : un début, pas un pourcentage. */
  | 'new'
  /** Les deux périodes sont vides : il n'y a pas de tendance. */
  | 'none';

export interface Trend {
  direction: TrendDirection;
  /** Variation en pourcentage, arrondie. `null` quand elle n'a pas de sens. */
  percent: number | null;
  /** Phrase complète, prête à poser en infobulle. */
  sentence: string;
}

/** Les entrées viennent du réseau : une valeur absurde ne doit pas ressortir en face. */
function sain(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function computeTrend(current: number, previous: number): Trend {
  const maintenant = sain(current);
  const avant = sain(previous);

  if (maintenant === 0 && avant === 0) {
    return { direction: 'none', percent: null, sentence: 'Aucune activité sur les deux périodes' };
  }

  if (avant === 0) {
    return {
      direction: 'new',
      percent: null,
      sentence: 'Première activité — rien sur la période précédente',
    };
  }

  const pourcent = Math.round(((maintenant - avant) / avant) * 100);

  if (Math.abs(pourcent) < SEUIL_BRUIT) {
    return { direction: 'flat', percent: pourcent, sentence: `Stable (${maintenant} contre ${avant})` };
  }

  return {
    direction: pourcent > 0 ? 'up' : 'down',
    percent: pourcent,
    sentence: `${pourcent > 0 ? '+' : ''}${pourcent} % (${maintenant} contre ${avant})`,
  };
}

/**
 * Le signe à poser à côté du chiffre.
 *
 * Une chaîne vide pour `flat` et `none` : un symbole « stable » ajouterait du
 * bruit visuel à l'endroit précis où il n'y a rien à signaler. `new` reçoit un
 * point, pas une flèche — une flèche vers le haut sur une première semaine
 * ferait croire à une progression mesurée.
 */
export function trendSymbol(direction: TrendDirection): string {
  if (direction === 'up') return '↑';
  if (direction === 'down') return '↓';
  if (direction === 'new') return '·';
  return '';
}
