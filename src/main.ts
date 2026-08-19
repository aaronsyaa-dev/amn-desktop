import { app, BrowserWindow, Menu, Notification, Tray, desktopCapturer, nativeImage, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initDatabase } from './main/db';
import { backfillSyncIds, restoreFromRemote } from './main/clientsSync';
import { registerIpcHandlers } from './main/ipc';
import { RemoteApiClient } from './main/remoteApi';
import { setupAutoUpdate } from './main/updater';
import { handleSquirrelStartup } from './main/windowsIntegration';
import { SCAN_REPORTS_DIR } from './main/scanReports';
import { EDITION_PRODUCT_NAME, IS_BUSINESS } from './edition/edition';

// Nom de l'application, AVANT toute lecture de app.getPath('userData') :
// Electron en dérive le dossier de données. Sans cette ligne, les deux
// éditions installées sur la même machine partageraient base locale, session
// et préférences — ce qui rendrait impossible de tester ce que voit vraiment
// une cliente, et mélangerait deux organisations dans un même fichier.
app.setName(EDITION_PRODUCT_NAME);

// Handle Squirrel.Windows install/update/uninstall events. On --squirrel-updated
// this explicitly recreates the Desktop + Start-menu shortcuts (they can vanish
// after an auto-update otherwise). Quits early when an event was handled.
const squirrelHandled = handleSquirrelStartup();
if (squirrelHandled) {
  app.quit();
}

// Windows only shows toast notifications from a packaged app when the running
// process declares an explicit AppUserModelID that matches an installed
// shortcut's AUMID — otherwise `new Notification().show()` is silently dropped
// (this was never set, so native notifications never worked on installed
// Windows, only in dev via electron.exe's own AUMID). Squirrel.Windows creates
// the Start-menu/desktop shortcut with the AUMID `com.squirrel.<pkgId>.<exe>`,
// where the maker uses pkgId = package.json name with '-' → '_' (amn_desktop)
// and exe = the productName ("AMN Desktop"). We must set the exact same string.
if (process.platform === 'win32') {
  // Le maker Squirrel construit l'AUMID à partir du nom du paquet et du
  // productName : il diffère donc d'une édition à l'autre, et les toasts ne
  // partent que si la chaîne correspond exactement au raccourci installé.
  app.setAppUserModelId(
    IS_BUSINESS
      ? 'com.squirrel.amn_business.AMN Business'
      : 'com.squirrel.amn_desktop.AMN Desktop',
  );
}

// Single-instance: a second launch (e.g. via the start-with-Windows shortcut,
// or clicking the app while it's in the tray) focuses the existing window
// instead of spawning a duplicate.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let remote: RemoteApiClient | null = null;
let isQuitting = false;

const iconPath = () => path.join(app.getAppPath(), 'images', 'icon.png');

// --- Window bounds memory (session memory: remember size & position) ---------
interface SavedBounds {
  width: number;
  height: number;
  x?: number;
  y?: number;
}
const boundsFile = () => path.join(app.getPath('userData'), 'window-state.json');

function loadBounds(): SavedBounds | null {
  try {
    const raw = fs.readFileSync(boundsFile(), 'utf-8');
    const b = JSON.parse(raw) as SavedBounds;
    if (typeof b.width === 'number' && typeof b.height === 'number') return b;
  } catch {
    /* first run or unreadable — use defaults */
  }
  return null;
}

function saveBounds(win: BrowserWindow): void {
  if (win.isDestroyed() || win.isMinimized()) return;
  try {
    const { width, height, x, y } = win.getBounds();
    fs.writeFileSync(boundsFile(), JSON.stringify({ width, height, x, y }));
  } catch {
    /* non-fatal */
  }
}

/** True when launched in the background at OS login (so we stay in the tray). */
/** True when a file:// URL resolves to a path inside SCAN_REPORTS_DIR. */
function isUnderScanReportsDir(fileUrl: string): boolean {
  try {
    const resolved = path.resolve(fileURLToPath(fileUrl));
    const dir = path.resolve(SCAN_REPORTS_DIR) + path.sep;
    return resolved.startsWith(dir);
  } catch {
    return false;
  }
}

function wasLaunchedHidden(): boolean {
  if (process.argv.includes('--hidden')) return true;
  try {
    return app.getLoginItemSettings().wasOpenedAsHidden === true;
  } catch {
    return false;
  }
}

function createWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    showWindow();
    return;
  }

  const saved = loadBounds();
  mainWindow = new BrowserWindow({
    width: saved?.width ?? 1280,
    height: saved?.height ?? 832,
    x: saved?.x,
    y: saved?.y,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0a0a0a',
    show: false,
    icon: iconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // Microphone access for operator-to-operator calls (BLOC 2), plus clipboard
  // WRITE for the app's many "copier le code" buttons (tracker snippet, badge
  // embed, API key). Electron routes every permission request through this
  // handler, and an allow-list of one silently broke copy everywhere — hence
  // both entries here, and nothing else.
  //
  // Deliberately excluded: clipboard READ (the app never needs to look at what
  // the operator copied elsewhere), camera, geolocation, and everything else.
  // The renderer loads a local bundle we ship, so no third-party origin can
  // even ask.
  const ALLOWED_PERMISSIONS = new Set(['media', 'clipboard-sanitized-write']);
  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      callback(ALLOWED_PERMISSIONS.has(permission));
    },
  );
  mainWindow.webContents.session.setPermissionCheckHandler((_webContents, permission) =>
    ALLOWED_PERMISSIONS.has(permission),
  );

  // Screen sharing (BLOC B). Without a handler, `getDisplayMedia()` in the
  // renderer is refused outright in Electron — there is no built-in picker.
  //
  // The whole primary screen is granted rather than a window chooser: this is
  // remote assistance between two operators, where "montre-moi ton écran" means
  // the screen, and a chooser would add a step to something started from the
  // call bar. Nothing is captured until the renderer asks, and the renderer
  // only asks when the operator presses « Partager mon écran ».
  mainWindow.webContents.session.setDisplayMediaRequestHandler(
    (_request, callback) => {
      desktopCapturer
        .getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } })
        .then((sources) => {
          const screen = sources[0];
          if (!screen) {
            // Refusing with an empty selection surfaces as a NotAllowedError in
            // the renderer, which says so instead of hanging on a black frame.
            callback({});
            return;
          }
          // Audio is deliberately not included: the call already carries the
          // microphone, and loopback audio would echo it back.
          callback({ video: screen });
        })
        .catch(() => callback({}));
    },
    // The handler must keep working for the whole session, not just once.
    { useSystemPicker: false },
  );

  // Persist size/position so the next launch restores the same window.
  const persist = () => mainWindow && saveBounds(mainWindow);
  mainWindow.on('resized', persist);
  mainWindow.on('moved', persist);

  // External links open in the OS browser rather than a blank in-app window.
  // Scan reports (window.open() from ScannerScreen — see scanReportUrl in
  // main/remoteApi.ts) are the one file:// exception: they're written by us
  // into SCAN_REPORTS_DIR, so opening exactly that directory's contents in the
  // OS browser is safe without turning into a general file:// open hole.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    } else if (url.startsWith('file://') && isUnderScanReportsDir(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://') && url !== mainWindow?.webContents.getURL()) {
      event.preventDefault();
      if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url);
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Closing the window hides it to the tray instead of quitting; the real
  // "Quitter" lives in the tray context menu (sets isQuitting first).
  mainWindow.on('close', (event) => {
    if (mainWindow) saveBounds(mainWindow);
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      if (process.platform === 'darwin') app.dock?.hide();
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function showWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  if (process.platform === 'darwin') app.dock?.show();
  setTrayPending(false);
}

/** Reflects a waiting important notification on the tray/taskbar/dock. */
function setTrayPending(pending: boolean): void {
  if (tray && !tray.isDestroyed()) {
    tray.setToolTip(
      pending ? `${EDITION_PRODUCT_NAME} — notification en attente` : EDITION_PRODUCT_NAME,
    );
  }
  if (process.platform === 'darwin') app.setBadgeCount(pending ? 1 : 0);
  if (pending && mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
    mainWindow.flashFrame(true);
  }
}

function createTray(): void {
  const image = nativeImage.createFromPath(iconPath());
  const trayImage = image.isEmpty() ? image : image.resize({ width: 18, height: 18 });
  tray = new Tray(trayImage);
  tray.setToolTip(EDITION_PRODUCT_NAME);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `Ouvrir ${EDITION_PRODUCT_NAME}`, click: () => showWindow() },
      { type: 'separator' },
      {
        label: 'Quitter',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  // Left-click the tray icon to open (Windows/Linux convention).
  tray.on('click', () => showWindow());
}

app.on('second-instance', () => showWindow());

app.on('ready', () => {
  const db = initDatabase();
  backfillSyncIds(db);
  remote = new RemoteApiClient();
  // Durability backstop for clients/quotes (see clientsSync.ts): recovers any
  // client/quote this machine is missing but amn-api has (e.g. after a wiped
  // or fresh local DB). Additive-only, best-effort, never blocks startup.
  void restoreFromRemote(remote, db);
  // The renderer decides which events are important; when one fires and the
  // window is hidden, badge the tray so the user notices.
  registerIpcHandlers(remote, {
    onImportantNotification: () => {
      if (!mainWindow || !mainWindow.isVisible()) setTrayPending(true);
    },
  });
  remote.start();

  createTray();
  setupAutoUpdate();

  if (wasLaunchedHidden()) {
    // Silent background start: stay in the tray, no window, no Welcome. Just a
    // discreet "ready" notification. The full Welcome (voice + animation) only
    // plays when the user opens the window from the tray.
    if (Notification.isSupported()) {
      const n = new Notification({
        title: `${EDITION_PRODUCT_NAME} est prêt`,
        body: 'L’application tourne en arrière-plan. Cliquez sur l’icône pour l’ouvrir.',
        icon: iconPath(),
      });
      n.on('click', () => showWindow());
      n.show();
    }
  } else {
    createWindow();
  }
});

// With the tray, closing all windows must NOT quit the app — it lives on in the
// tray until the user explicitly chooses "Quitter".
app.on('window-all-closed', () => {
  // Intentionally empty: keep running in the tray on every platform.
});

app.on('before-quit', () => {
  isQuitting = true;
  remote?.stop();
});

app.on('activate', () => {
  // macOS: clicking the dock icon reopens the window.
  showWindow();
});
