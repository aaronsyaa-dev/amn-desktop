import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { isWeb } from './lib/platform';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container not found');
}

createRoot(container).render(
  <React.StrictMode>
    <App />
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
