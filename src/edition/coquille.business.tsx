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

/** Toujours faux : la coquille d'origine. */
export function useCoquilleActive(): boolean {
  return false;
}
