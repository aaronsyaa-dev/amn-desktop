import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { BusinessLayout } from '../business/BusinessLayout';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeSoloScreen } from '../business/HomeSoloScreen';
import { AgendaScreen } from '../business/AgendaScreen';
import { MediaSoloScreen } from '../business/MediaSoloScreen';
import { ClientsScreen } from '../screens/ClientsScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { NotesScreen } from '../screens/NotesScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { VaultScreen } from '../screens/VaultScreen';

/**
 * La racine de l'édition Business — la table de routes livrée aux
 * organisations clientes.
 *
 * C'est la garantie centrale de tout le chantier : Rollup part d'ici, et il
 * n'existe aucun chemin d'import vers `TrackerScreen`, `ScannerScreen`,
 * `ComplyScreen`, `SslScreen`, `SitesDashboardScreen`, `SiteControlScreen`,
 * `TeamScreen`, `DecisionsScreen` ni `KnowledgeScreen`. Ces écrans ne sont pas
 * protégés par une condition — ils ne sont pas dans le bundle, donc leurs
 * routes n'existent pas non plus.
 *
 * La route attrape-tout renvoie à l'accueil : un lien profond hérité (un
 * `#/tracker` mémorisé par une ancienne installation, par exemple) atterrit
 * sur quelque chose d'utile au lieu d'une page blanche.
 */
export function AppRoot() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route
        element={
          <ProtectedRoute>
            <BusinessLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<HomeSoloScreen />} />
        <Route path="/agenda" element={<AgendaScreen />} />
        <Route path="/clients" element={<ClientsScreen />} />
        <Route path="/tasks" element={<TasksScreen />} />
        <Route path="/notes" element={<NotesScreen />} />
        <Route path="/media" element={<MediaSoloScreen />} />
        <Route path="/reports" element={<ReportsScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/vault" element={<VaultScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
