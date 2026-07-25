import { app, Notification } from 'electron';

/**
 * Auto-update for the Forge/Squirrel build via the free update.electronjs.org
 * service (no server to run). It checks the GitHub Releases of the configured
 * repo and, for a signed Squirrel.Windows build, downloads and stages updates
 * in the background; the user is prompted to restart when one is ready.
 *
 * Requirements for updates to actually flow (see README → "Publier une
 * nouvelle version"):
 *   - the repo is public (or update.electronjs.org is given access),
 *   - releases are published via `npm run publish` (Forge GitHub publisher),
 *     which uploads the Squirrel artifacts + RELEASES file,
 *   - the Windows build is code-signed (unsigned apps can still update but
 *     Windows may warn).
 *
 * Does nothing in dev (`app.isPackaged === false`) or on unsupported platforms.
 */
export function setupAutoUpdate(): void {
  if (!app.isPackaged) return;
  // macOS auto-update requires code signing; skip gracefully if unsigned.
  try {
    // Lazy require so dev/test (and the Linux CI) never load native update code.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { updateElectronApp, UpdateSourceType } = require('update-electron-app');
    updateElectronApp({
      updateSource: {
        type: UpdateSourceType.ElectronPublicUpdateService,
        repo: 'aaronsyaa-dev/amn-desktop',
      },
      updateInterval: '1 hour',
      notifyUser: true,
    });
  } catch (err) {
    if (Notification.isSupported()) {
      // Non-fatal: the app runs fine without auto-update.
      // eslint-disable-next-line no-console
      console.warn('[amn] auto-update unavailable:', err);
    }
  }
}
