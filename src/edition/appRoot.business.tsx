import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { ModuleRoute } from '../components/ModuleRoute';
import { BusinessLayout } from '../business/BusinessLayout';
import { LoginScreen } from '../screens/LoginScreen';
import { InvitationScreen } from '../screens/InvitationScreen';
import { HomeSoloScreen } from '../business/HomeSoloScreen';
import { AgendaScreen } from '../business/AgendaScreen';
import { MediaSoloScreen } from '../business/MediaSoloScreen';
import { ClientsScreen } from '../screens/ClientsScreen';
import { InvoicesScreen } from '../screens/InvoicesScreen';
import { ProjectsScreen } from '../screens/ProjectsScreen';
import { ExpensesScreen } from '../screens/ExpensesScreen';
import { TimeScreen } from '../screens/TimeScreen';
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
      {/* Publique, et volontairement AVANT le garde d'authentification :
          l'invitée n'a par définition pas encore de compte, donc l'écran
          d'activation ne peut pas vivre derrière une exigence de session. */}
      <Route path="/invitation" element={<InvitationScreen />} />
      <Route
        element={
          <ProtectedRoute>
            <BusinessLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<HomeSoloScreen />} />
        <Route
          path="/agenda"
          element={
            <ModuleRoute module="agenda">
              <AgendaScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/clients"
          element={
            <ModuleRoute module="clients">
              <ClientsScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/facturation"
          element={
            <ModuleRoute module="invoices">
              <InvoicesScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/projets"
          element={
            <ModuleRoute module="projects">
              <ProjectsScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <ModuleRoute module="tasks">
              <TasksScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/depenses"
          element={
            <ModuleRoute module="expenses">
              <ExpensesScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/temps"
          element={
            <ModuleRoute module="time">
              <TimeScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/notes"
          element={
            <ModuleRoute module="notes">
              <NotesScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/media"
          element={
            <ModuleRoute module="media">
              <MediaSoloScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ModuleRoute module="reports">
              <ReportsScreen />
            </ModuleRoute>
          }
        />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route
          path="/vault"
          element={
            <ModuleRoute module="vault">
              <VaultScreen />
            </ModuleRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
