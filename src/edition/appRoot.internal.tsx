import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { SalleScreen } from '../screens/SalleScreen';
import { ModuleRoute } from '../components/ModuleRoute';
import { AppLayout } from '../components/AppLayout';
import { LoginScreen } from '../screens/LoginScreen';
import { InvitationScreen } from '../screens/InvitationScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { GuestCallScreen } from '../screens/GuestCallScreen';
import { PublicBookingScreen } from '../screens/PublicBookingScreen';
import { PublicPageScreen } from '../screens/PublicPageScreen';
import { PublicFormScreen } from '../screens/PublicFormScreen';
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
import { EventsScreen } from '../screens/EventsScreen';
import { ComplyScreen } from '../screens/ComplyScreen';
import { ScannerScreen } from '../screens/ScannerScreen';
import { TrackerScreen } from '../screens/TrackerScreen';
import { SiteControlScreen } from '../screens/SiteControlScreen';
import { SslScreen } from '../screens/SslScreen';
import { IncidentsScreen } from '../screens/IncidentsScreen';
import { DecisionsScreen } from '../screens/DecisionsScreen';
import { KnowledgeScreen } from '../screens/KnowledgeScreen';
import { NotesScreen } from '../screens/NotesScreen';
import { PagesScreen } from '../screens/PagesScreen';
import { PersonalBudgetScreen } from '../screens/PersonalBudgetScreen';
import { MediaLibraryScreen } from '../screens/MediaLibraryScreen';
import { ReportsScreen } from '../screens/ReportsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { MembersScreen } from '../screens/MembersScreen';
import { AssistanceScreen } from '../screens/AssistanceScreen';
import { LibraryScreen } from '../screens/LibraryScreen';
import { EquipmentBookingScreen } from '../screens/EquipmentBookingScreen';
import { DeliveryRoundsScreen } from '../screens/DeliveryRoundsScreen';
import { CashCountScreen } from '../screens/CashCountScreen';
import { ClientReportScreen } from '../screens/ClientReportScreen';
import { CustomAlertsScreen } from '../screens/CustomAlertsScreen';
import { OrgCompareScreen } from '../screens/OrgCompareScreen';
import { SocMaturityScreen } from '../screens/SocMaturityScreen';
import { DataPortScreen } from '../screens/DataPortScreen';
import { AutomationsScreen } from '../screens/AutomationsScreen';
import { TemplatesScreen } from '../screens/TemplatesScreen';
import { ConvertersScreen } from '../screens/ConvertersScreen';
import { QrScreen } from '../screens/QrScreen';
import { PomodoroScreen } from '../screens/PomodoroScreen';
import { DiaryScreen } from '../screens/DiaryScreen';
import { PersonalGoalsScreen } from '../screens/PersonalGoalsScreen';
import { HabitsScreen } from '../screens/HabitsScreen';
import { PortfolioScreen } from '../screens/PortfolioScreen';
import { SignatureScreen } from '../screens/SignatureScreen';
import { NewsletterScreen } from '../screens/NewsletterScreen';
import { MiniSiteScreen } from '../screens/MiniSiteScreen';
import { FormsScreen } from '../screens/FormsScreen';
import { LogbookScreen } from '../screens/LogbookScreen';
import { RoutinesScreen } from '../screens/RoutinesScreen';
import { PrioritiesScreen } from '../screens/PrioritiesScreen';
import { MeetingsScreen } from '../screens/MeetingsScreen';
import { WeeklyReviewScreen } from '../screens/WeeklyReviewScreen';
import { OkrScreen } from '../screens/OkrScreen';
import { BomScreen } from '../screens/BomScreen';
import { AfterSalesScreen } from '../screens/AfterSalesScreen';
import { AssemblyScreen } from '../screens/AssemblyScreen';
import { ChecklistsScreen } from '../screens/ChecklistsScreen';
import { ShiftsScreen } from '../screens/ShiftsScreen';
import { SuppliersScreen } from '../screens/SuppliersScreen';
import { StockScreen } from '../screens/StockScreen';
import { ProjectBoardScreen } from '../screens/ProjectBoardScreen';
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
import { ControlTowerScreen } from '../screens/ControlTowerScreen';
import { OrganizationsScreen } from '../screens/OrganizationsScreen';
import { AccessLogScreen } from '../screens/AccessLogScreen';
import { GeneratorScreen } from '../screens/GeneratorScreen';
import { AgendaScreen } from '../business/AgendaScreen';
import { HomeSoloScreen } from '../business/HomeSoloScreen';
import { MediaSoloScreen } from '../business/MediaSoloScreen';
import { ClientContextLayout } from '../client-context/ClientContextLayout';
import { GardeSalleScreen } from '../screens/garde/GardeSalleScreen';
import { GardeAjmaniScreen } from '../screens/garde/GardeAjmaniScreen';
import { GardePileScreen } from '../screens/garde/GardePileScreen';
import { GardeBureauxScreen } from '../screens/garde/GardeBureauxScreen';
import { GardeCommuneScreen } from '../screens/garde/GardeCommuneScreen';
import { GardeCalendrierScreen } from '../screens/garde/GardeCalendrierScreen';
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
      {/* La mini-page et les formulaires publics : même doctrine, sans session. */}
      <Route path="/p" element={<PublicPageScreen />} />
      <Route path="/f" element={<PublicFormScreen />} />

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
        {/* Le mur plein écran (deuxième moniteur). DANS la table de routage de
            l'espace : il lit les sites et le pouls, qui vivent sous ces
            fournisseurs — son `fixed inset-0` recouvre la coquille. */}
        <Route path="/salle" element={<SalleScreen />} />
        {/* Poste de travail */}
        <Route path="/" element={<HomeScreen />} />
        <Route path="/tasks" element={<TasksScreen />} />
        <Route path="/notes" element={<NotesScreen />} />
        <Route path="/pages" element={<PagesScreen />} />
        {/* PERSONNEL (BLOC 2). Volontairement absent de ClientContextRoutes :
            en session de support, ces écrans montreraient les chiffres et les
            listes de l'OPÉRATEUR sous la bannière de la cliente — le défaut
            qui vaut déjà au Coffre-fort d'en être exclu. */}
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
        <Route path="/clients" element={<ClientsScreen />} />
        <Route path="/facturation" element={<InvoicesScreen />} />
        <Route path="/projets" element={<ProjectsScreen />} />
        <Route path="/depenses" element={<ExpensesScreen />} />
        <Route path="/temps" element={<TimeScreen />} />
        <Route path="/calculateurs" element={<CalculatorsScreen />} />
        <Route path="/commandes" element={<OrdersScreen />} />
        <Route path="/evenements" element={<EventsScreen />} />
        {/* Les documents d'un événement vivent sur le moteur de pages, comme
            la liste de courses du module Personnel : une fiche, une conduite,
            une check-list du jour J n'ont besoin d'aucun type de bloc de plus.
            Une route à part et non un onglet dans l'écran : l'éditeur de pages
            porte son propre en-tête et sa propre liste, et l'imbriquer
            donnerait deux titres l'un sous l'autre. */}
        <Route
          path="/evenements/documents"
          element={
            <PagesScreen
              scope="evenement"
              title="Documents d’événement"
              description="Les fiches, conduites et check-lists de vos dates. Écrites à plusieurs, relues sur place — souvent depuis un téléphone, en régie."
            />
          }
        />
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
        <Route path="/membres" element={<MembersScreen />} />
        <Route path="/assistance" element={<AssistanceScreen />} />
        <Route path="/messages-prives" element={<DirectMessagesScreen />} />
        <Route path="/groupes" element={<GroupsScreen />} />
        <Route path="/annonces" element={<AnnouncementsScreen />} />
        <Route path="/sondages" element={<PollsScreen />} />
        <Route path="/absences" element={<LeavesScreen />} />
        <Route path="/trombinoscope" element={<DirectoryScreen />} />
        <Route path="/appels" element={<CallsScreen />} />
        <Route path="/pipeline" element={<PipelineScreen />} />
        <Route path="/relances" element={<RemindersScreen />} />
        <Route path="/abonnements" element={<SubscriptionsScreen />} />
        <Route path="/contrats" element={<ContractsScreen />} />
        <Route path="/avis" element={<ReviewsScreen />} />
        <Route path="/fidelite" element={<LoyaltyScreen />} />
        <Route path="/parrainage" element={<ReferralsScreen />} />
        <Route path="/rdv-en-ligne" element={<BookingScreen />} />
        <Route path="/tableau-projets" element={<ProjectBoardScreen />} />
        <Route path="/stock" element={<StockScreen />} />
        <Route path="/fournisseurs" element={<SuppliersScreen />} />
        <Route path="/planning" element={<ShiftsScreen />} />
        <Route path="/controles" element={<ChecklistsScreen />} />
        <Route path="/montage" element={<AssemblyScreen />} />
        <Route path="/sav" element={<AfterSalesScreen />} />
        <Route path="/nomenclatures" element={<BomScreen />} />
        <Route path="/objectifs-resultats" element={<OkrScreen />} />
        <Route path="/revue-hebdo" element={<WeeklyReviewScreen />} />
        <Route path="/reunions" element={<MeetingsScreen />} />
        <Route path="/priorites" element={<PrioritiesScreen />} />
        <Route path="/routines" element={<RoutinesScreen />} />
        <Route path="/journal-de-bord" element={<LogbookScreen />} />
        <Route path="/formulaires" element={<FormsScreen />} />
        <Route path="/mini-page" element={<MiniSiteScreen />} />
        <Route path="/lettre" element={<NewsletterScreen />} />
        <Route path="/signature" element={<SignatureScreen />} />
        <Route path="/portfolio" element={<PortfolioScreen />} />
        <Route path="/personnel/habitudes" element={<HabitsScreen />} />
        <Route path="/personnel/objectifs" element={<PersonalGoalsScreen />} />
        <Route path="/personnel/journal" element={<DiaryScreen />} />
        <Route path="/personnel/pomodoro" element={<PomodoroScreen />} />
        <Route path="/outils/qr" element={<QrScreen />} />
        <Route path="/outils/convertisseurs" element={<ConvertersScreen />} />
        <Route path="/outils/modeles" element={<TemplatesScreen />} />
        <Route path="/outils/automatisations" element={<AutomationsScreen />} />
        <Route path="/outils/donnees" element={<DataPortScreen />} />
        <Route path="/maturite-soc" element={<SocMaturityScreen />} />
        <Route path="/comparatif" element={<OrgCompareScreen />} />
        <Route path="/alertes-personnalisees" element={<CustomAlertsScreen />} />
        <Route path="/rapport-client" element={<ClientReportScreen />} />
        <Route path="/caisse" element={<CashCountScreen />} />
        <Route path="/tournees" element={<DeliveryRoundsScreen />} />
        <Route path="/materiel" element={<EquipmentBookingScreen />} />
        <Route path="/bibliotheque" element={<LibraryScreen />} />
        <Route path="/vault" element={<VaultScreen />} />

        {/* La Garde (Bloc 3) : le troisième espace — déléguer. */}
        <Route path="/garde" element={<GardeSalleScreen />} />
        <Route path="/garde/ajmani" element={<GardeAjmaniScreen />} />
        <Route path="/garde/pile" element={<GardePileScreen />} />
        <Route path="/garde/bureaux" element={<GardeBureauxScreen />} />
        <Route path="/garde/bureaux/:equipe" element={<GardeBureauxScreen />} />
        <Route path="/garde/commune" element={<GardeCommuneScreen />} />
        <Route path="/garde/calendrier" element={<GardeCalendrierScreen />} />

        {/* Tour de contrôle */}
        <Route path="/tour" element={<ControlTowerScreen />} />
        <Route path="/tour/organisations" element={<OrganizationsScreen />} />
        <Route path="/tour/journal" element={<AccessLogScreen />} />
        {/* L'atelier (BLOC C). Un ÉCRAN, plus une boîte de dialogue : on ne
            referme pas un acte de création, on en sort avec quelque chose. */}
        <Route path="/tour/generateur" element={<GeneratorScreen />} />
        {/* Le bureau de supervision : la file de travail, avant les écrans
            par site. C'est là qu'on arrive quand quelque chose se passe. */}
        <Route path="/supervision" element={<IncidentsScreen />} />
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
        <Route
          path="/tableau-projets"
          element={
            <ModuleRoute module="board">
              <ProjectBoardScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/stock"
          element={
            <ModuleRoute module="stock">
              <StockScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/fournisseurs"
          element={
            <ModuleRoute module="suppliers">
              <SuppliersScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/planning"
          element={
            <ModuleRoute module="shifts">
              <ShiftsScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/controles"
          element={
            <ModuleRoute module="checklists">
              <ChecklistsScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/montage"
          element={
            <ModuleRoute module="assembly">
              <AssemblyScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/sav"
          element={
            <ModuleRoute module="aftersales">
              <AfterSalesScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/nomenclatures"
          element={
            <ModuleRoute module="bom">
              <BomScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/objectifs-resultats"
          element={
            <ModuleRoute module="okr">
              <OkrScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/revue-hebdo"
          element={
            <ModuleRoute module="weekly">
              <WeeklyReviewScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/reunions"
          element={
            <ModuleRoute module="meetings">
              <MeetingsScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/priorites"
          element={
            <ModuleRoute module="priorities">
              <PrioritiesScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/routines"
          element={
            <ModuleRoute module="routines">
              <RoutinesScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/journal-de-bord"
          element={
            <ModuleRoute module="logbook">
              <LogbookScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/formulaires"
          element={
            <ModuleRoute module="forms">
              <FormsScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/mini-page"
          element={
            <ModuleRoute module="minisite">
              <MiniSiteScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/lettre"
          element={
            <ModuleRoute module="newsletter">
              <NewsletterScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/signature"
          element={
            <ModuleRoute module="esign">
              <SignatureScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/portfolio"
          element={
            <ModuleRoute module="portfolio">
              <PortfolioScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/personnel/habitudes"
          element={
            <ModuleRoute module="habits">
              <HabitsScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/personnel/objectifs"
          element={
            <ModuleRoute module="personalGoals">
              <PersonalGoalsScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/personnel/journal"
          element={
            <ModuleRoute module="diary">
              <DiaryScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/personnel/pomodoro"
          element={
            <ModuleRoute module="pomodoro">
              <PomodoroScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/outils/qr"
          element={
            <ModuleRoute module="qr">
              <QrScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/outils/convertisseurs"
          element={
            <ModuleRoute module="converters">
              <ConvertersScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/outils/modeles"
          element={
            <ModuleRoute module="templates">
              <TemplatesScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/outils/automatisations"
          element={
            <ModuleRoute module="automations">
              <AutomationsScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/outils/donnees"
          element={
            <ModuleRoute module="dataPort">
              <DataPortScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/caisse"
          element={
            <ModuleRoute module="cashCount">
              <CashCountScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/tournees"
          element={
            <ModuleRoute module="rounds">
              <DeliveryRoundsScreen />
            </ModuleRoute>
          }
        />
        <Route
          path="/materiel"
          element={
            <ModuleRoute module="equipment">
              <EquipmentBookingScreen />
            </ModuleRoute>
          }
        />
        <Route path="/administration" element={<ClientAdminScreen />} />
        {/* Un écran qui n'existe pas chez elle (un `/tracker` mémorisé, par
            exemple) ramène à son accueil — jamais à un écran d'AMN DevSec. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
