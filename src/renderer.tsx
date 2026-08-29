import React from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { isWeb } from './lib/platform';
import { beginBoot } from './lib/safeBoot';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container not found');
}

/*
  AVANT le premier rendu, et c'est tout l'intérêt.

  Si le démarrage précédent n'a jamais abouti, `beginBoot` a déjà effacé le
  contexte d'organisation quand cette ligne rend la main — donc l'arbre React
  qui suit est monté sur un état sûr, et ne peut pas replonger dans l'écran
  qui plantait. Le faire depuis un effet React serait trop tard : le composant
  fautif aurait déjà été rendu.
*/
beginBoot();

// ErrorBoundary wraps App itself (not just App's children) so a crash during
// App's own render — before it returns any JSX — still gets caught and shown
// as a recoverable error screen instead of leaving <div id="root"> empty.
/*
  LES ANIMATIONS OBÉISSENT AU RÉGLAGE DU SYSTÈME — ET ELLES NE LE FAISAIENT PAS
  ═══════════════════════════════════════════════════════════════════════════

  `index.css` honore `prefers-reduced-motion` depuis longtemps, avec soin :
  quatre blocs coupent le scintillement des squelettes, l'enfoncement des
  boutons, la lévitation des cartes et le clignotement du point « en direct ».

  Mais QUATRE-VINGT-DIX composants animent avec framer-motion — chaque
  transition d'écran, chaque apparition en cascade, chaque panneau qui se
  déplie — et framer-motion **n'obéit à rien par défaut**. La moitié CSS était
  faite avec attention ; la moitié JavaScript, c'est-à-dire l'essentiel de ce
  qui bouge, ignorait purement le réglage.

  Ce n'est pas un détail de confort. Quelqu'un qui coche « réduire les
  animations » le fait en général parce que le mouvement lui donne la nausée ou
  déclenche un vertige. Une application qui l'ignore ne se contente pas d'être
  moins agréable : elle devient inutilisable pour cette personne. « Des
  animations qui servent vraiment à quelque chose » vaut aussi dans l'autre
  sens — une animation qui rend malade ne sert rien du tout.

  `reducedMotion="user"` fait exactement ce qu'il faut, et rien de plus : les
  animations de POSITION et d'échelle sont désactivées — ce sont elles qui
  provoquent le malaise — pendant que les fondus d'opacité restent. L'interface
  garde donc sa continuité (on voit toujours qu'un panneau apparaît), sans le
  déplacement. Tout couper aurait rendu l'application sèche et illisible : on
  ne saurait plus ce qui vient d'arriver à l'écran.

  Posé ICI, au-dessus de tout, parce qu'un contexte oublié dans un sous-arbre
  est un sous-arbre qui continue de bouger — et personne ne le remarquerait
  sans cocher la case et relire les vingt écrans.
*/
createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </ErrorBoundary>
  </React.StrictMode>,
);

// PWA service worker (B2): register only in a real browser build, never inside
// Electron (file:// can't host a SW) and never in dev (avoids stale caching).
if (isWeb() && import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* SW is a progressive enhancement — ignore registration failures */
    });
  });
}
