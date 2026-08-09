import { app, autoUpdater, BrowserWindow, ipcMain } from 'electron';
import { IPC } from '../shared/api';
import { IS_BUSINESS } from '../edition/edition';

/**
 * Auto-update for the Forge/Squirrel build via the free update.electronjs.org
 * service (no server to run). It checks the GitHub Releases of the configured
 * repo and, for a signed Squirrel.Windows build, downloads and stages updates
 * automatically in the background — exactly like Discord/Spotify. When one is
 * ready we DON'T show Electron's stock dialog (`notifyUser: false`); instead we
 * tell the renderer, which shows a polished in-app "update ready" panel with the
 * changelog and a single "Restart to install" button (see UpdateReady.tsx).
 *
 * Requirements for updates to actually flow (see README → "Publier une
 * nouvelle version"):
 *   - the repo is public (or update.electronjs.org is given access),
 *   - releases are published via a pushed version tag → GitHub Actions
 *     (`.github/workflows/release.yml`) builds + uploads the Squirrel artifacts,
 *   - the Windows build is code-signed (unsigned apps can still update but
 *     Windows may warn).
 *
 * Does nothing in dev (`app.isPackaged === false`) or on unsupported platforms.
 */
export function setupAutoUpdate(): void {
  // The renderer's "install now" button routes here. Registered even in dev so
  // the IPC channel always exists (it just no-ops when nothing is staged).
  ipcMain.handle(IPC.updateInstall, () => {
    try {
      autoUpdater.quitAndInstall();
    } catch {
      /* nothing staged / unsupported — ignore */
    }
  });

  if (!app.isPackaged) return;

  // L'édition Business ne s'auto-met pas à jour. Le service de mise à jour lit
  // les Releases de aaronsyaa-dev/amn-desktop, qui portent les artefacts de
  // l'édition INTERNE : brancher la cliente dessus lui installerait notre
  // application, produits de cybersécurité compris. Ses mises à jour sont
  // remises à la main tant que l'édition n'a pas son propre canal.
  if (IS_BUSINESS) return;

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
      notifyUser: false, // we present our own in-app UI instead of the stock dialog
    });

    // When Squirrel has downloaded + staged an update, surface it in-app.
    autoUpdater.on('update-downloaded', (_event, notes, releaseName) => {
      const version = (releaseName || '').replace(/^v/, '') || 'nouvelle version';
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send(IPC.updateDownloaded, { version, notes: notes || '' });
      }
    });
  } catch (err) {
    // Non-fatal: the app runs fine without auto-update.
    // eslint-disable-next-line no-console
    console.warn('[amn] auto-update unavailable:', err);
  }
}
