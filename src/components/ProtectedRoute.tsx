import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { GuestQuotaGate } from '../auth/GuestQuotaGate';
import { useGuestQuotaBlock } from '../state/guestQuotaStore';

export function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { isAuthenticated, bootstrapping } = useAuth();
  const quotaBlock = useGuestQuotaBlock();

  // Une session stockée est revalidée auprès d'amn-api au démarrage. Rediriger
  // pendant ce laps de temps renverrait à l'écran de connexion quelqu'un qui
  // est déjà connecté — et lui ferait perdre l'onglet où il était.
  if (bootstrapping) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  /*
    Quota d'invité épuisé : l'écran de blocage REMPLACE l'application, il ne se
    superpose pas.

    Placé ici plutôt que dans chaque coquille, parce que c'est le seul point de
    passage commun aux trois — Business, interne, contexte client — et parce
    qu'au-dessus des fournisseurs de synchronisation on ne monterait pas les
    contextes dont l'écran de blocage n'a de toute façon pas besoin.
  */
  if (quotaBlock) return <GuestQuotaGate quota={quotaBlock} />;

  return children;
}
