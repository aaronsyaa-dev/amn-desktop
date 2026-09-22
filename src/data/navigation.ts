import type React from 'react';
import { NAV_SECTIONS } from '@edition/modules';

/**
 * The application's modules, in one place (BLOC C).
 *
 * They used to be declared inside Sidebar.tsx, which meant every new product
 * made the sidebar one row taller — it had started to scroll. The same list now
 * feeds two surfaces: the short pinned strip in the sidebar, and the launcher's
 * grid, which is where growth actually goes.
 *
 * La liste elle-même vit dans `@edition/modules`, résolu à la compilation vers
 * l'édition construite (voir src/edition/edition.ts). Ce fichier ne garde que
 * la forme et les accesseurs, pour que la barre latérale, le lanceur et la
 * palette de commandes n'aient rien à savoir de l'édition.
 */

export interface NavItem {
  key: string;
  label: string;
  to: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  /** One line, shown in the launcher grid only. */
  hint: string;
}

/**
 * Les deux espaces de l'édition interne. L'édition Business n'en a qu'un et ne
 * renseigne donc jamais ce champ — voir `src/data/spaces.ts`, qui traite
 * l'absence comme « Poste de travail ».
 */
export type SpaceKey = 'workspace' | 'control' | 'garde';

export interface NavSection {
  key: string;
  label: string;
  /**
   * LE CODE DE RAIL — deux lettres, et le seul texte qui tienne dans 38 px.
   *
   * La tuile de rail montre le code et le nombre de modules ; le nom complet
   * vit dans son `title`. Le code est déclaré ICI, dans le catalogue, et non
   * dérivé du libellé : « Clients & revenus » et « Collectif » commencent tous
   * deux par C, et deux familles qui affichent la même chose dans la même
   * colonne sont exactement le défaut que le rail existe pour éviter.
   *
   * `scripts/check-coquille.mjs` refuse un code absent, mal formé ou employé
   * deux fois dans la même édition.
   */
  code: string;
  /** Espace auquel appartient la section. Absent = Poste de travail. */
  space?: SpaceKey;
  items: NavItem[];
}

export { NAV_SECTIONS };

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export function navItemByKey(key: string): NavItem | undefined {
  return NAV_ITEMS.find((i) => i.key === key);
}
