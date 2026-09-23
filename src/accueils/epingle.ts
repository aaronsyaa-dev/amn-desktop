import type { NavItem } from '../data/navigation';

/**
 * L'ACCUEIL CHOISI EST ÉPINGLÉ EN TÊTE — dans les deux éditions (ACCUEILS.md :
 * « l'Accueil est désormais épinglé en tête de l'édition interne »).
 *
 * Il ne dépend pas des favoris : il ne se désépingle pas, et il vient toujours
 * en premier. Son infobulle nomme l'Accueil retenu dans les Paramètres.
 */
export function avecAccueilEnTete<T extends Pick<NavItem, 'key' | 'hint'>>(epingles: T[], accueil: T | undefined, nomAccueil: string): T[] {
  if (!accueil) return epingles;
  return [{ ...accueil, hint: `Accueil · ${nomAccueil}` }, ...epingles.filter((e) => e.key !== accueil.key)];
}
