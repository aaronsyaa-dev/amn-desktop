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

export interface NavSection {
  key: string;
  label: string;
  items: NavItem[];
}

export { NAV_SECTIONS };

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export function navItemByKey(key: string): NavItem | undefined {
  return NAV_ITEMS.find((i) => i.key === key);
}
