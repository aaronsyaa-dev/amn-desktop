import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactElement }) {
  const { isAuthenticated, bootstrapping } = useAuth();

  // Une session stockée est revalidée auprès d'amn-api au démarrage. Rediriger
  // pendant ce laps de temps renverrait à l'écran de connexion quelqu'un qui
  // est déjà connecté — et lui ferait perdre l'onglet où il était.
  if (bootstrapping) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
