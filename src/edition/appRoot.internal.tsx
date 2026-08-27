import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { ModuleRoute } from '../components/ModuleRoute';
import { AppLayout } from '../components/AppLayout';
import { LoginScreen } from '../screens/LoginScreen';
import { InvitationScreen } from '../screens/InvitationScreen';
import { GuestCallScreen } from '../screens/GuestCallScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { SitesDashboardScreen } from '../screens/SitesDashboardScreen';
import { TeamScreen } from '../screens/TeamScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { ClientsScreen } from '../screens/ClientsScreen';
import { InvoicesScreen } from '../screens/InvoicesScreen';
import { ProjectsScreen } from '../screens/ProjectsScreen';
import { ExpensesScreen } from '../screens/ExpensesScreen';
import { TimeScreen } from '../screens/TimeScreen';
import { CalculatorsScreen } from '../screens/CalculatorsScreen';
import { OrdersScreen } from '../screens/OrdersScreen';
import { ComplyScreen } from '../screens/ComplyScreen';
import { ScannerScreen } from '../screens/ScannerScreen';
import { TrackerScreen } from '../screens/TrackerScreen';
import { SiteControlScreen } from '../screens/SiteControlScreen';
import { SslScreen } from '../screens/SslScreen';
import { DecisionsScreen } from '../screens/DecisionsScreen';
import { KnowledgeScreen } from '../screens/KnowledgeScreen';
import { NotesScreen } from '../screens/NotesScreen';
import { PagesScreen } from '../screens/PagesScreen';
import { MediaLibraryScreen } from '../screens/MediaLibraryScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { VaultScreen } from '../screens/VaultScreen';
import { ControlTowerScreen } from '../screens/ControlTowerScreen';
import { OrganizationsScreen } from '../screens/OrganizationsScreen';
import { AccessLogScreen } from '../screens/AccessLogScreen';
import { GeneratorScreen } from '../screens/GeneratorScreen';
import { AgendaScreen } from '../business/AgendaScreen';
import { HomeSoloScreen } from '../business/HomeSoloScreen';
import { MediaSoloScreen } from '../business/MediaSoloScreen';
import { ClientContextLayout } from '../client-context/ClientContextLayout';
import { ClientAdminScreen } from '../client-context/ClientAdminScreen';
import { ContextBoot } from '../client-context/ContextBoot';
import { OrgContextProvider, useOrgContext } from '../state/OrgContextContext';
import { ContextVeil } from '../components/org-rail/ContextVeil';
import { ContextError } from '../components/org-rail/ContextError';

/**
 * La racine de l'édition interne — AMN Desktop, tel qu'Aaron et Mohamed
 * l'utilisent.
 *
 * Depuis la refonte multi-organisations, il n'y a plus UNE table de routes mais
 * deux, et le contexte actif décide laquelle est montée :
 *
 *   - le contexte AMN DevSec, avec ses deux espaces (Poste de travail et Tour
 *     de contrôle) ;
 *   - le contexte d'une organisation cliente, qui monte exactement la table de
 *     l'édition Business, parce que l'intérêt est de voir SON application.
 *
 * Deux tables plutôt qu'un préfixe d'URL (`/org/<id>/…`), et c'est un choix,
 * pas un raccourci : les écrans partagés naviguent avec des chemins absolus
 * (`/clients`, `/agenda`). Un préfixe aurait obligé à réécrire chaque lien de
 * chaque écran partagé — et un seul oubli aurait éjecté l'opérateur du contexte
 * client au milieu d'une session de support. Ici, `/clients` désigne toujours
 * « les clients de l'organisation courante », ce qui est exactement ce qu'on
 * veut dire. Le contexte, lui, ne vit pas dans l'URL : il vit dans le jeton de
 * support côté serveur, et il est annoncé par un bandeau qu'on ne peut pas
 * masquer.
 */
export function AppRoot() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      {/* Publique, et volontairement AVANT le garde d'authentification :
          l'invitée n'a par définition pas encore de compte, donc l'écran
          d'activation ne peut pas vivre derrière une exigence de session. */}
      <Route path="/invitation" element={<InvitationScreen />} />
      {/* Page d'appel d'un visiteur SANS COMPTE (BLOC B.2). Publique pour la
          même raison que l'activation, et plus encore : le visiteur n'aura
          jamais de compte. Elle n'affiche aucune marque et ne connaît aucune
          route de données — voir GuestCallScreen. */}
      <Route path="/appel" element={<GuestCallScreen />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <OrgContextProvider>
              <ContextRouter />
              {/* Hors des deux tables : le voile doit survivre au démontage de
                  l'une et au montage de l'autre — c'est précisément l'instant
                  qu'il sert à couvrir. */}
              <ContextVeil />
              <ContextError />
            </OrgContextProvider>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function ContextRouter() {
  const { support, restoring, transition } = useOrgContext();

  // Tant que le jeton conservé n'a pas été revalidé, on ne monte NI l'une NI
  // l'autre : monter l'arborescence AMN DevSec « en attendant » ferait clignoter
  // notre espace de travail avant de basculer chez la cliente, et monter celle
  // de la cliente afficherait ses écrans remplis de nos données.
  if (restoring) return <ContextBoot />;

  // Pendant une bascule, AUCUNE des deux n'est montée. Ce n'est pas un détail
  // d'animation : un fournisseur de synchronisation encore vivant pendant que
  // le justificatif change reçoit les enregistrements de l'AUTRE organisation
  // et les écrit dans son propre miroir. Le voile occupe l'écran pendant ce
  // temps-là (voir ContextVeil).
  if (transition) return null;

  return support ? <ClientContextRoutes /> : <AmnRoutes />;
}

/** Le contexte AMN DevSec : Poste de travail + Tour de contrôle. */
function AmnRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Poste de travail */}
        <Route path="/" element={<HomeScreen />} />
        <Route path="/tasks" element={<TasksScreen />} />
        <Route path="/notes" element={<NotesScreen />} />
        <Route path="/pages" element={<PagesScreen />} />
        <Route path="/clients" element={<ClientsScreen />} />
        <Route path="/facturation" element={<InvoicesScreen />} />
        <Route path="/projets" element={<ProjectsScreen />} />
        <Route path="/depenses" element={<ExpensesScreen />} />
        <Route path="/temps" element={<TimeScreen />} />
        <Route path="/calculateurs" element={<CalculatorsScreen />} />
        <Route path="/commandes" element={<OrdersScreen />} />
        <Route path="/sites" element={<SitesDashboardScreen />} />
        <Route path="/team" element={<TeamScreen />} />
        <Route path="/reports" element={<ReportsScreen />} />
        <Route path="/media" element={<MediaLibraryScreen />} />
        {/* Le calendrier construit pour les clientes, monté ici aussi : même
            écran, même collection `appointments`, portée par l'organisation. */}
        <Route path="/agenda" element={<AgendaScreen />} />
        <Route path="/decisions" element={<DecisionsScreen />} />
        <Route path="/knowledge" element={<KnowledgeScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/vault" element={<VaultScreen />} />

        {/* Tour de contrôle */}
        <Route path="/tour" element={<ControlTowerScreen />} />
        <Route path="/tour/organisations" element={<OrganizationsScreen />} />
        <Route path="/tour/journal" element={<AccessLogScreen />} />
        {/* L'atelier (BLOC C). Un ÉCRAN, plus une boîte de dialogue : on ne
            referme pas un acte de création, on en sort avec quelque chose. */}
        <Route path="/tour/generateur" element={<GeneratorScreen />} />
        <Route path="/tracker" element={<TrackerScreen />} />
        <Route path="/tracker/site/:siteId" element={<SiteControlScreen />} />
        <Route path="/scanner" element={<ScannerScreen />} />
        <Route path="/comply" element={<ComplyScreen />} />
        <Route path="/ssl" element={<SslScreen />} />

        {/* Un chemin inconnu (onglet mémorisé d'une version antérieure, lien
            collé) atterrit sur l'accueil plutôt que sur une page blanche. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

/**
 * Le contexte d'une organisation cliente : la table de routes de l'édition
 * Business, exactement — plus le panneau d'administration, qui est le seul
 * écran d'AMN DevSec de cet espace et vit donc à part.
 */
function ClientContextRoutes() {
  return (
    <Routes>
      <Route element={<ClientContextLayout />}>
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
          path="/calculateurs"
          element={
            <ModuleRoute module="calculators">
              <CalculatorsScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/commandes"
          element={
            <ModuleRoute module="orders">
              <OrdersScreen />
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
          path="/pages"
          element={
            <ModuleRoute module="pages">
              <PagesScreen />
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
        <Route path="/administration" element={<ClientAdminScreen />} />
        {/* Un écran qui n'existe pas chez elle (un `/tracker` mémorisé, par
            exemple) ramène à son accueil — jamais à un écran d'AMN DevSec. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
