import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { isWeb } from './lib/platform';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container not found');
}

// ErrorBoundary wraps App itself (not just App's children) so a crash during
// App's own render — before it returns any JSX — still gets caught and shown
// as a recoverable error screen instead of leaving <div id="root"> empty.
createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
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
