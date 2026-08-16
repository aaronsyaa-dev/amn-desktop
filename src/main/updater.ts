import { app, autoUpdater, BrowserWindow, ipcMain } from 'electron';
import { IPC } from '../shared/api';
import type { UpdateCheck } from '../shared/api';
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
/**
 * Le canal de mise à jour de l'édition Business, s'il en existe un.
 *
 * Lu dans l'environnement de build parce que ce canal N'EXISTE PAS ENCORE :
 * l'édition Business n'est publiée nulle part (voir docs/BUSINESS.md, « Envoyer
 * l'installeur »), et tant que l'hébergement du `.exe` n'est pas décidé, il n'y
 * a rien à interroger. Le jour où il existera, cette variable suffira à
 * brancher la vérification — sans toucher à l'interface.
 */
const BUSINESS_FEED = process.env.AMN_BUSINESS_UPDATE_URL || '';

/**
 * Vérifie à la demande, et rend un état NOMMÉ.
 *
 * Quatre situations qui ne se ressemblent que dans le code :
 *   - à jour (on a regardé, il n'y a rien) ;
 *   - une version attend (Squirrel l'a déjà téléchargée et mise de côté) ;
 *   - aucun canal configuré — le cas de l'édition Business aujourd'hui ;
 *   - la vérification a échoué (réseau, service indisponible).
 *
 * Répondre « à jour » dans les deux derniers cas serait le défaut à ne pas
 * commettre : quelqu'un qui n'est pas à jour lirait qu'il l'est.
 */
async function checkNow(): Promise<UpdateCheck> {
  if (!app.isPackaged) {
    return {
      status: 'unconfigured',
      reason: 'Application lancée depuis le code source : aucune mise à jour à vérifier.',
    };
  }

  if (IS_BUSINESS) {
    if (!BUSINESS_FEED) {
      return {
        status: 'unconfigured',
        reason:
          'Aucun canal de mise à jour n’est configuré pour cette édition. ' +
          'Les correctifs vous sont transmis directement par AMN DevSec.',
      };
    }
    try {
      const res = await fetch(BUSINESS_FEED, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error(`réponse ${res.status}`);
      const feed = (await res.json()) as { version?: string };
      const latest = String(feed.version ?? '').replace(/^v/, '');
      if (!latest) throw new Error('version absente de la réponse');
      return latest === app.getVersion()
        ? { status: 'uptodate', version: app.getVersion() }
        : { status: 'available', version: latest };
    } catch (err) {
      return {
        status: 'error',
        message: `Vérification impossible : ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // Édition interne : Squirrel sait déjà interroger le service. On lui demande
  // de regarder tout de suite, et on rend ce qu'il a sous la main.
  if (staged) return { status: 'available', version: staged };
  try {
    autoUpdater.checkForUpdates();
    // `checkForUpdates` est asynchrone et sans promesse : on ne peut pas
    // prétendre connaître son verdict ici. « Je regarde » est la seule réponse
    // honnête — l'écran « prête à installer » apparaîtra tout seul si quelque
    // chose arrive.
    return { status: 'downloading' };
  } catch (err) {
    return {
      status: 'error',
      message: `Vérification impossible : ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/** La version mise de côté par Squirrel, quand il y en a une. */
let staged = '';

export function setupAutoUpdate(): void {
  ipcMain.handle(IPC.updateCheck, () => checkNow());

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
      staged = version;
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
