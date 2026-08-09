import type Database from 'better-sqlite3';

/**
 * Amorçage de la base locale — édition BUSINESS.
 *
 * Volontairement vide. Une installation cliente démarre sur une base réellement
 * vierge :
 *   - pas de compte local, donc rien à deviner et rien à contourner. La seule
 *     authentification est son propre compte amn-api ;
 *   - pas de fiches de démonstration à supprimer avant de commencer ;
 *   - et aucune trace de nos adresses, de nos tarifs ni du nom de nos offres
 *     dans l'application qu'elle installe.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
export function seedDatabase(_database: Database.Database): void {
  /* intentionnellement vide — voir l'en-tête */
}
/* eslint-enable @typescript-eslint/no-unused-vars */
