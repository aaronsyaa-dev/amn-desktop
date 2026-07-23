import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { mockSites } from '../data/mockSites';

export function HomeScreen() {
  const { user } = useAuth();
  const offlineCount = mockSites.filter((s) => s.status === 'offline').length;

  return (
    <section>
      <h1>Bienvenue, {user?.email}</h1>
      <p>
        Vous supervisez actuellement {mockSites.length} site(s), dont{' '}
        {offlineCount} hors ligne.
      </p>
      <p>
        <Link to="/sites">Voir le dashboard des sites →</Link>
      </p>
    </section>
  );
}
