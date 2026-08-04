import { app, BrowserWindow, Menu, Notification, Tray, nativeImage, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import { initDatabase } from './main/db';
import { registerIpcHandlers } from './main/ipc';
import { RemoteApiClient } from './main/remoteApi';
import { setupAutoUpdate } from './main/updater';
import { warmWatch } from './main/watch';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
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

  // Persist size/position so the next launch restores the same window.
  const persist = () => mainWindow && saveBounds(mainWindow);
  mainWindow.on('resized', persist);
  mainWindow.on('moved', persist);

  // External links open in the OS browser rather than a blank in-app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url);
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
    tray.setToolTip(pending ? 'AMN Desktop — notification en attente' : 'AMN Desktop');
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
  tray.setToolTip('AMN Desktop');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Ouvrir AMN Desktop', click: () => showWindow() },
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
  initDatabase();
  remote = new RemoteApiClient();
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
  warmWatch(); // prime the RSS watch cache in the background

  if (wasLaunchedHidden()) {
    // Silent background start: stay in the tray, no window, no Welcome. Just a
    // discreet "ready" notification. The full Welcome (voice + animation) only
    // plays when the user opens the window from the tray.
    if (Notification.isSupported()) {
      const n = new Notification({
        title: 'AMN Desktop est prêt',
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
