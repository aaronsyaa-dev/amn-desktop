import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { ModuleRoute } from '../components/ModuleRoute';
import { BusinessLayout } from '../business/BusinessLayout';
import { LoginScreen } from '../screens/LoginScreen';
import { InvitationScreen } from '../screens/InvitationScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { GuestCallScreen } from '../screens/GuestCallScreen';
import { PublicBookingScreen } from '../screens/PublicBookingScreen';
import { HomeSoloScreen } from '../business/HomeSoloScreen';
import { AgendaScreen } from '../business/AgendaScreen';
import { MediaSoloScreen } from '../business/MediaSoloScreen';
import { ClientsScreen } from '../screens/ClientsScreen';
import { InvoicesScreen } from '../screens/InvoicesScreen';
import { ProjectsScreen } from '../screens/ProjectsScreen';
import { ExpensesScreen } from '../screens/ExpensesScreen';
import { TimeScreen } from '../screens/TimeScreen';
import { CalculatorsScreen } from '../screens/CalculatorsScreen';
import { OrdersScreen } from '../screens/OrdersScreen';
import { EventsScreen } from '../screens/EventsScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { NotesScreen } from '../screens/NotesScreen';
import { PagesScreen } from '../screens/PagesScreen';
import { PersonalBudgetScreen } from '../screens/PersonalBudgetScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { MembersScreen } from '../screens/MembersScreen';
import { AssistanceScreen } from '../screens/AssistanceScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { BookingScreen } from '../screens/BookingScreen';
import { ReferralsScreen } from '../screens/ReferralsScreen';
import { LoyaltyScreen } from '../screens/LoyaltyScreen';
import { ReviewsScreen } from '../screens/ReviewsScreen';
import { ContractsScreen } from '../screens/ContractsScreen';
import { SubscriptionsScreen } from '../screens/SubscriptionsScreen';
import { RemindersScreen } from '../screens/RemindersScreen';
import { PipelineScreen } from '../screens/PipelineScreen';
import { CallsScreen } from '../screens/CallsScreen';
import { DirectoryScreen } from '../screens/DirectoryScreen';
import { LeavesScreen } from '../screens/LeavesScreen';
import { PollsScreen } from '../screens/PollsScreen';
import { AnnouncementsScreen } from '../screens/AnnouncementsScreen';
import { GroupsScreen } from '../screens/GroupsScreen';
import { DirectMessagesScreen } from '../screens/DirectMessagesScreen';
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
      {/* Le lien de bienvenue (Bloc 2) : publique, comme l'activation — la
          personne n'a pas encore ouvert de session, c'est cette page qui lui
          remet ses accès. */}
      <Route path="/bienvenue" element={<WelcomeScreen />} />
      {/* Page d'appel d'un visiteur SANS COMPTE (BLOC B.2). Publique pour la
          même raison que l'activation, et plus encore : le visiteur n'aura
          jamais de compte. Elle n'affiche aucune marque et ne connaît aucune
          route de données — voir GuestCallScreen. */}
      <Route path="/appel" element={<GuestCallScreen />} />
      {/* Prise de rendez-vous publique : un visiteur sans compte, une organisation
          désignée par l'adresse — voir PublicBookingScreen. */}
      <Route path="/rdv" element={<PublicBookingScreen />} />
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
          path="/evenements"
          element={
            <ModuleRoute module="evenements">
              <EventsScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/evenements/documents"
          element={
            <ModuleRoute module="evenements">
              <PagesScreen
                scope="evenement"
                title="Documents d’événement"
                description="Les fiches, conduites et check-lists de vos dates. Écrites à plusieurs, relues sur place — souvent depuis un téléphone, en régie."
              />
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
        {/* PERSONNEL (BLOC 2) — sans <ModuleRoute>, et c'est délibéré : ces
            écrans n'ont aucune clé serveur, donc rien à consulter pour savoir
            s'ils sont ouverts. Un bonus inclus n'a pas d'interrupteur. */}
        <Route path="/personnel/budget" element={<PersonalBudgetScreen />} />
        <Route
          path="/personnel/courses"
          element={
            <PagesScreen
              scope="personnel"
              title="Personnel"
              description="Vos listes et vos pages à vous. Elles se synchronisent entre vos appareils — pratique pour écrire la liste ici et la relire dans le magasin."
            />
          }
        />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/membres" element={<MembersScreen />} />
        <Route path="/assistance" element={<AssistanceScreen />} />
        <Route
          path="/messages-prives"
          element={
            <ModuleRoute module="dm">
              <DirectMessagesScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/groupes"
          element={
            <ModuleRoute module="groups">
              <GroupsScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/annonces"
          element={
            <ModuleRoute module="announcements">
              <AnnouncementsScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/sondages"
          element={
            <ModuleRoute module="polls">
              <PollsScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/absences"
          element={
            <ModuleRoute module="leaves">
              <LeavesScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/trombinoscope"
          element={
            <ModuleRoute module="directory">
              <DirectoryScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/appels"
          element={
            <ModuleRoute module="calls">
              <CallsScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/pipeline"
          element={
            <ModuleRoute module="pipeline">
              <PipelineScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/relances"
          element={
            <ModuleRoute module="reminders">
              <RemindersScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/abonnements"
          element={
            <ModuleRoute module="subscriptions">
              <SubscriptionsScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/contrats"
          element={
            <ModuleRoute module="contracts">
              <ContractsScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/avis"
          element={
            <ModuleRoute module="reviews">
              <ReviewsScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/fidelite"
          element={
            <ModuleRoute module="loyalty">
              <LoyaltyScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/parrainage"
          element={
            <ModuleRoute module="referrals">
              <ReferralsScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/rdv-en-ligne"
          element={
            <ModuleRoute module="booking">
              <BookingScreen />
            </ModuleRoute>
          }
        />
        <Route path="/decouvrir" element={<LibraryScreen />} />
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
