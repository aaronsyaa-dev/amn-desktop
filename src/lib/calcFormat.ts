import type { CalcKind } from '../state/calcEngine';
import { centsToInput, formatCents, parsePositiveAmount } from './money';

/**
 * Saisie et affichage des valeurs du moteur de calcul.
 *
 * Extrait de `CalculatorsScreen` quand le module Personnel a eu besoin des
 * mêmes conversions (BLOC 2). Les recopier aurait donné deux écrans qui
 * lisent « 45,50 » différemment le jour où l'un des deux est corrigé — et
 * c'est le genre d'écart qu'on ne voit pas, puisque chacun est cohérent avec
 * lui-même.
 */

/** Ce que le champ montre tant que personne n'y a touché. */
export function defaultText(value: number, kind: CalcKind): string {
  if (kind === 'money') return centsToInput(value) || '0';
  return String(value);
}

/**
 * Le texte tapé → la valeur du moteur.
 *
 * L'argent est en centimes, le reste en unités. Un champ illisible vaut zéro
 * plutôt que `NaN` : un zéro se voit dans le résultat et s'explique, un `NaN`
 * se propage à toutes les étapes suivantes et ne dit rien de son origine.
 */
export function parseValue(raw: string, kind: CalcKind): number {
  if (kind === 'money') return parsePositiveAmount(raw);
  const value = Number.parseFloat(String(raw).replace(',', '.'));
  return Number.isFinite(value) ? value : 0;
}

export function formatValue(value: number, kind: CalcKind): string {
  if (kind === 'money') return formatCents(value);
  if (kind === 'percent') return `${value.toFixed(1).replace('.', ',')} %`;
  // Un « nombre » reste lisible : 89,89 entrées se lit mieux que 89,8876404494.
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',');
}
