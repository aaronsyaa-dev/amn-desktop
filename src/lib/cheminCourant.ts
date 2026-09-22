import type { NavItem } from '../data/navigation';

/**
 * LE CHEMIN COURANT, AU PRÉFIXE LE PLUS LONG.
 *
 * Vu sur `#/tour/organisations` : « Vue d'ensemble » (`/tour`) ET
 * « Organisations » (`/tour/organisations`) s'allumaient toutes les deux, parce
 * que la première est un préfixe de la seconde. La colonne portait alors deux
 * « vous êtes ici », donc aucun.
 *
 * La règle vivait en trois exemplaires, un par barre latérale — et les trois
 * n'étaient pas d'accord : l'édition cliente se contentait de
 * `pathname.startsWith(to)`, qui allume les deux. Elle est ici, une fois, pour
 * les trois appelants du rail.
 *
 * La racine `/` est traitée à part : tout chemin commence par elle, donc elle
 * ne peut coller qu'à l'identique.
 */
export function cheminLePlusPrecis(pathname: string, items: NavItem[]): string {
  if (pathname === '/') return items.some((i) => i.to === '/') ? '/' : '';
  let meilleur = '';
  for (const item of items) {
    if (item.to === '/') continue;
    const colle = pathname === item.to || pathname.startsWith(`${item.to}/`);
    if (colle && item.to.length > meilleur.length) meilleur = item.to;
  }
  return meilleur;
}
