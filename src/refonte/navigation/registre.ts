import type { Famille } from '../../socle/familles';
import type { VueRegistre } from '../modules/assembler';
import { REGISTRE_MODULES, vueDuRegistre } from '../modules/registre';

/**
 * LE REGISTRE, VU DE LA NAVIGATION — une porte sur `src/refonte/modules/`.
 *
 * S1 tenait ici une ligne par module. Depuis S5, le registre est déclaratif :
 * une famille par fichier dans `src/refonte/modules/declarations/`, des
 * entrées qui regroupent plusieurs vues, trois niveaux. La navigation (rail,
 * ⌘K, « Tous les modules ») ne lit que les trois accès ci-dessous.
 */

/** Toutes les vues rangées, à plat, dans l'ordre des familles. */
export const REGISTRE: readonly VueRegistre[] = REGISTRE_MODULES.vues;

/** La vue d'une clé du catalogue : sa famille, son entrée, ses verbes et mots-clés. */
export function entreeDuRegistre(id: string): VueRegistre | undefined {
  return vueDuRegistre(id);
}

/**
 * La TEINTE d'un module (une des sept du socle), pour `data-famille`. Ce
 * n'est pas toujours l'identifiant de sa famille : la Garde prend la teinte
 * des Outils. `outils` pour un module inconnu du registre (le contrôle
 * l'interdit, l'écran ne plante pas).
 */
export function familleDe(id: string): Famille {
  return vueDuRegistre(id)?.teinte ?? 'outils';
}
