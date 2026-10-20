import React, { useState } from 'react';
import { HashRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { AppRoot } from '@edition/appRoot';
import { GrainOverlay } from './components/GrainOverlay';
// Le rideau de lancement passe par la couture `@edition/vivant` (refonte S2) :
// l'édition cliente y retrouve `SplashScreen` à l'identique, l'interne l'animation du guide.
import { Lancement, lancementJoue, ReactionsGuide } from '@edition/vivant';

/**
 * Coquille commune aux deux éditions : le splash, la session, le routeur.
 *
 * La table de routes elle-même vit dans `@edition/appRoot`, résolu à la
 * compilation (voir src/edition/edition.ts). C'est ce qui fait que l'édition
 * Business ne contient pas les écrans qu'elle n'affiche pas : Rollup part de
 * cette racine-là et ne trouve simplement aucun chemin vers eux.
 */
export default function App() {
  const [showSplash, setShowSplash] = useState(() => !lancementJoue());

  return (
    <>
      {showSplash && <Lancement onDone={() => setShowSplash(false)} />}
      <AuthProvider>
        <GrainOverlay />
        {/* Le guide réagit aux moments fêtés (interne) ; rien côté cliente. */}
        <ReactionsGuide />
        <HashRouter>
          <AppRoot />
        </HashRouter>
      </AuthProvider>
    </>
  );
}
