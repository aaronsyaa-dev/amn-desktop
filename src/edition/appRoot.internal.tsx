import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AppLayout } from '../components/AppLayout';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { SitesDashboardScreen } from '../screens/SitesDashboardScreen';
import { TeamScreen } from '../screens/TeamScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { ClientsScreen } from '../screens/ClientsScreen';
import { ComplyScreen } from '../screens/ComplyScreen';
import { ScannerScreen } from '../screens/ScannerScreen';
import { TrackerScreen } from '../screens/TrackerScreen';
import { SiteControlScreen } from '../screens/SiteControlScreen';
import { SslScreen } from '../screens/SslScreen';
import { DecisionsScreen } from '../screens/DecisionsScreen';
import { KnowledgeScreen } from '../screens/KnowledgeScreen';
import { NotesScreen } from '../screens/NotesScreen';
import { MediaLibraryScreen } from '../screens/MediaLibraryScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { VaultScreen } from '../screens/VaultScreen';

/**
 * La racine de l'édition interne — AMN Desktop, tel qu'Aaron et Mohamed
 * l'utilisent. Rien n'a changé ici : cette table de routes est celle qui
 * vivait dans `App.tsx`, déplacée derrière `@edition/appRoot` pour que
 * l'édition Business ait la sienne sans que les deux se croisent jamais dans
 * un même bundle.
 */
export function AppRoot() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<HomeScreen />} />
        <Route path="/sites" element={<SitesDashboardScreen />} />
        <Route path="/team" element={<TeamScreen />} />
        <Route path="/tasks" element={<TasksScreen />} />
        <Route path="/clients" element={<ClientsScreen />} />
        <Route path="/tracker" element={<TrackerScreen />} />
        <Route path="/tracker/site/:siteId" element={<SiteControlScreen />} />
        <Route path="/scanner" element={<ScannerScreen />} />
        <Route path="/comply" element={<ComplyScreen />} />
        <Route path="/ssl" element={<SslScreen />} />
        <Route path="/decisions" element={<DecisionsScreen />} />
        <Route path="/knowledge" element={<KnowledgeScreen />} />
        <Route path="/notes" element={<NotesScreen />} />
        <Route path="/media" element={<MediaLibraryScreen />} />
        <Route path="/reports" element={<ReportsScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/vault" element={<VaultScreen />} />
      </Route>
    </Routes>
  );
}
