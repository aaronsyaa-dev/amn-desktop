import React from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { LoginScreen } from './screens/LoginScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SitesDashboardScreen } from './screens/SitesDashboardScreen';
import { SiteDetailScreen } from './screens/SiteDetailScreen';

export default function App() {
  return (
    <AuthProvider>
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
            <Route path="/sites/:siteId" element={<SiteDetailScreen />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
