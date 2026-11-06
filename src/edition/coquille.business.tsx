/**
 * LA COQUILLE DE LA REFONTE, CÔTÉ CLIENTE — rien, délibérément.
 *
 * L'édition cliente garde sa coquille telle quelle. Ce fichier n'importe rien
 * du socle ni de `src/refonte/**`.
 */
import type React from 'react';

export function CoquilleRefonte({ children }: { children?: React.ReactNode; largeur?: 'lecture' | 'pleine' }): React.ReactElement {
  return <>{children}</>;
}

export function CoquilleSection(): null {
  return null;
}

/** L'écran de veille v3 (G09) n'existe pas côté cliente : la vitrine du jour (`VeilleCliente`) reste la sienne. */
export function EcranDeVeille(): null {
  return null;
}

/** « Aujourd'hui » n'existe pas côté cliente : le fournisseur rend ses enfants, sans rien. */
export function FournisseurAujourdhui({ children }: { children?: React.ReactNode }): React.ReactElement {
  return <>{children}</>;
}

/** Toujours faux : la coquille d'origine. */
export function useCoquilleActive(): boolean {
  return false;
}
