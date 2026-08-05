/**
 * Platform detection (B2). The same React/Vite renderer runs both inside
 * Electron (desktop) and, when deployed to a static HTTPS host, as an installable
 * PWA on the web / iPhone home screen. Electron exposes `window.amn` via the
 * preload bridge; its absence means we're in a plain browser, where the
 * browser-fallback bridge talks to amn-api directly (so sync still works) but
 * native-only features (SQLite, Windows notifications, Squirrel auto-update,
 * cross-origin RSS veille) are unavailable and must be hidden.
 */

/** True when running inside the Electron shell (desktop app). */
export function isElectron(): boolean {
  return typeof window !== 'undefined' && Boolean(window.amn);
}

/** True in a plain browser / PWA (no Electron shell). */
export function isWeb(): boolean {
  return !isElectron();
}

/** True when launched as an installed PWA (standalone display mode). */
export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari exposes navigator.standalone instead of display-mode.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
