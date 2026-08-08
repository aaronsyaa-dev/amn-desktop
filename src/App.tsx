import React, { useState } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { LoginScreen } from './screens/LoginScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SitesDashboardScreen } from './screens/SitesDashboardScreen';
import { TeamScreen } from './screens/TeamScreen';
import { TasksScreen } from './screens/TasksScreen';
import { ClientsScreen } from './screens/ClientsScreen';
import { ScannerScreen } from './screens/ScannerScreen';
import { TrackerScreen } from './screens/TrackerScreen';
import { DecisionsScreen } from './screens/DecisionsScreen';
import { KnowledgeScreen } from './screens/KnowledgeScreen';
import { NotesScreen } from './screens/NotesScreen';
import { MediaLibraryScreen } from './screens/MediaLibraryScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { GrainOverlay } from './components/GrainOverlay';
import { SplashScreen, hasSplashPlayed } from './components/SplashScreen';

export default function App() {
  const [showSplash, setShowSplash] = useState(() => !hasSplashPlayed());

  return (
    <>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      <AuthProvider>
        <GrainOverlay />
        <HashRouter>
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
              <Route path="/scanner" element={<ScannerScreen />} />
              <Route path="/decisions" element={<DecisionsScreen />} />
              <Route path="/knowledge" element={<KnowledgeScreen />} />
              <Route path="/notes" element={<NotesScreen />} />
              <Route path="/media" element={<MediaLibraryScreen />} />
              <Route path="/reports" element={<ReportsScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
            </Route>
          </Routes>
        </HashRouter>
      </AuthProvider>
    </>
  );
}
