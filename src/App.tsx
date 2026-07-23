import React from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { LoginScreen } from './screens/LoginScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SitesDashboardScreen } from './screens/SitesDashboardScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { GrainOverlay } from './components/GrainOverlay';

export default function App() {
  return (
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
            <Route path="/settings" element={<SettingsScreen />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
