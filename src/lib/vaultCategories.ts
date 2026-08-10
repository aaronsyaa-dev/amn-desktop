import { VAULT_PRODUCT_CATEGORIES } from '@edition/exclusive';
import type { VaultCategory } from '../shared/api';

/**
 * Les rubriques du coffre-fort, dans l'ordre où elles s'affichent.
 *
 * Sorties de `VaultScreen` parce qu'elles ne lui appartiennent plus : le bouton
 * générique « Transférer dans le coffre-fort » doit pouvoir nommer la rubrique
 * où il vient de ranger un secret, et il vit ailleurs. Une seule liste, sinon
 * l'écran et le bouton finissent par ne plus dire la même chose.
 *
 * Les rubriques qui n'ont de sens que chez nous (Trackers installés,
 * Organisations clientes) viennent de `@edition/exclusive` : dans l'édition
 * Business elles ne sont pas masquées, elles ne sont pas là.
 */
export const VAULT_CATEGORIES: { value: VaultCategory; label: string }[] = [
  { value: 'api', label: 'API Keys' },
  { value: 'accounts', label: 'Comptes' },
  { value: 'servers', label: 'Serveurs' },
  ...VAULT_PRODUCT_CATEGORIES,
  { value: 'other', label: 'Autres' },
];

export function vaultCategoryLabel(category: VaultCategory): string {
  return VAULT_CATEGORIES.find((c) => c.value === category)?.label ?? 'Autres';
}
