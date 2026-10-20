import { chercher, type Cherchable } from './recherche';
import { tn } from './i18n';

/**
 * Ce que la palette de commandes (⌘K) emprunte à la navigation : chercher les
 * modules par intention, et l'invite du champ. Hors React, la palette
 * l'appelle dans son `useMemo`.
 *
 * `null` quand rien n'est tapé : la palette garde alors sa liste complète,
 * dans l'ordre du catalogue.
 */
export function chercherModules<T extends Cherchable>(
  requete: string,
  items: readonly T[],
): { item: T; raison?: string }[] | null {
  if (!requete.trim()) return null;
  return chercher(requete, items).map(({ item, raison }) => ({ item, raison }));
}

export function placeholderRecherche(): string {
  return tn('palette.placeholder');
}
