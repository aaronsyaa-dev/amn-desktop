/**
 * LA NAVIGATION DE LA REFONTE (S1), CÔTÉ CLIENTE — rien, délibérément.
 *
 * L'édition cliente garde sa navigation telle quelle : pas de rail du moment,
 * pas de vue « Tous les modules », pas de raccourci, pas de recherche par
 * intention, et l'onglet mémorisé se rouvre comme avant. Ce fichier n'importe
 * rien de `src/refonte/**` : le paquet client n'en contient pas une ligne.
 */
export const NAVIGATION_REFONTE = false;

export const ROUTE_TOUS_LES_MODULES = '';

export const RailDuMoment: (props: Record<string, unknown>) => null = () => null;

export function TousLesModules(): null {
  return null;
}

export function RaccourciAccueil(): null {
  return null;
}

export const chercherModules: <T>(requete: string, items: readonly T[]) => { item: T; raison?: string }[] | null = () => null;

export function placeholderRecherche(): string | null {
  return null;
}

/** Toujours reprendre le dernier onglet : le comportement d'avant. */
export function restaurerDernierOnglet(): boolean {
  return true;
}
