import React, { useState } from 'react';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { AppRoot } from '@edition/appRoot';
import { GrainOverlay } from './components/GrainOverlay';
import { SplashScreen, hasSplashPlayed } from './components/SplashScreen';

/**
 * Coquille commune aux deux éditions : le splash, la session, le routeur.
 *
 * La table de routes elle-même vit dans `@edition/appRoot`, résolu à la
 * compilation (voir src/edition/edition.ts). C'est ce qui fait que l'édition
 * Business ne contient pas les écrans qu'elle n'affiche pas : Rollup part de
 * cette racine-là et ne trouve simplement aucun chemin vers eux.
 */
export default function App() {
  const [showSplash, setShowSplash] = useState(() => !hasSplashPlayed());

  return (
    <>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      <AuthProvider>
        <GrainOverlay />
        <HashRouter>
          <AppRoot />
        </HashRouter>
      </AuthProvider>
    </>
  );
}
