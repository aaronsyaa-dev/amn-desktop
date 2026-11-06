import React from 'react';
import { ContexteAujourdhui, useCalculAujourdhui } from './useAujourdhui';

/**
 * LE FOURNISSEUR D'« AUJOURD'HUI » — monté UNE fois dans la coque interne
 * (`AppLayout`, par `@edition/coquille`), pour que la barre latérale et
 * l'Accueil partagent le MÊME objet : un seul état, un seul calcul. Côté
 * cliente, le jumeau de `coquille.business.tsx` rend ses enfants, sans rien.
 */
export function FournisseurAujourdhui({ children }: { children?: React.ReactNode }): React.ReactElement {
  const aujourdhui = useCalculAujourdhui(true);
  return <ContexteAujourdhui.Provider value={aujourdhui}>{children}</ContexteAujourdhui.Provider>;
}
