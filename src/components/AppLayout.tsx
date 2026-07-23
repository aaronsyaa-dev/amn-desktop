import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import './AppLayout.css';

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-layout">
      <header className="app-header">
        <span className="app-brand">AMN Desktop</span>
        <nav className="app-nav">
          <NavLink to="/" end>
            Accueil
          </NavLink>
          <NavLink to="/sites">Sites</NavLink>
        </nav>
        <div className="app-user">
          <span>{user?.email}</span>
          <button type="button" onClick={logout}>
            Déconnexion
          </button>
        </div>
      </header>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
