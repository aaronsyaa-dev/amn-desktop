import { app } from 'electron';
import { spawn } from 'node:child_process';
import path from 'node:path';

/**
 * Windows Squirrel integration: desktop/Start-menu shortcuts and start-at-login.
 *
 * Both features must go through Squirrel's `Update.exe` stub rather than the
 * versioned app executable, because a Squirrel install lives in a per-version
 * folder (`…\app-1.1.7\AMN Desktop.exe`) that changes on every auto-update:
 *
 *  - A1.2 (start with Windows): registering the login item against the
 *    versioned exe means the registry entry points at a path that no longer
 *    exists after the next update — the toggle appears to "do nothing" the next
 *    time it launches. Pointing it at the stable `Update.exe --processStart`
 *    launcher fixes that (it always starts the current version).
 *  - A1.3 (desktop shortcut disappears after update): we take shortcut creation
 *    over from electron-squirrel-startup so we can pin the Desktop location
 *    explicitly on both install AND update. Squirrel otherwise recreates only
 *    the locations it tracked, and the desktop icon can silently vanish after
 *    an auto-update.
 *
 * Everything here is a no-op on macOS/Linux, where the original login-item
 * behaviour (openAsHidden + `--hidden`) is preserved.
 */

const isWindows = process.platform === 'win32';

/** Path to Squirrel's Update.exe stub (parent of the per-version app folder). */
function updateExePath(): string {
  return path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
}

/** Bare executable name, e.g. "AMN Desktop.exe". */
function exeName(): string {
  return path.basename(process.execPath);
}

/**
 * Login-item registration that survives updates. On Windows we register the
 * Update.exe launcher (with our `--hidden` background-start flag); elsewhere we
 * keep the direct openAtLogin/openAsHidden behaviour. The embedded quotes are
 * intentional — Squirrel's Update.exe re-parses the argument string.
 */
function loginItemSettings(enabled: boolean): Electron.Settings {
  if (isWindows) {
    return {
      openAtLogin: enabled,
      path: updateExePath(),
      args: [
        '--processStart',
        `"${exeName()}"`,
        '--process-start-args',
        '"--hidden"',
      ],
    };
  }
  return {
    openAtLogin: enabled,
    openAsHidden: enabled, // macOS: start hidden
    args: enabled ? ['--hidden'] : [], // Linux: our hidden-start flag
  };
}

/** Reads the current start-at-login state (matching the same launcher on Windows). */
export function getAutoLaunch(): boolean {
  try {
    const opts: Electron.LoginItemSettingsOptions | undefined = isWindows
      ? {
          path: updateExePath(),
          args: [
            '--processStart',
            `"${exeName()}"`,
            '--process-start-args',
            '"--hidden"',
          ],
        }
      : undefined;
    return app.getLoginItemSettings(opts).openAtLogin;
  } catch {
    return false;
  }
}

/** Enables/disables start-at-login. Returns the effective state after applying. */
export function setAutoLaunch(enabled: boolean): boolean {
  try {
    app.setLoginItemSettings(loginItemSettings(enabled));
    return getAutoLaunch();
  } catch {
    return false;
  }
}

/** Runs Update.exe with the given args, then invokes `done` (always). */
function runUpdate(args: string[], done: () => void): void {
  try {
    const child = spawn(updateExePath(), args, { detached: true });
    child.on('close', done);
    child.on('error', done);
  } catch {
    done();
  }
}

/**
 * Handles the Squirrel.Windows lifecycle events fired as the first CLI argument
 * during install/update/uninstall. Returns true when an event was handled and
 * the caller should stop booting (the process quits once the stub finishes).
 *
 * Replaces electron-squirrel-startup so the Desktop shortcut is recreated on
 * every update, not just the first install.
 */
export function handleSquirrelStartup(): boolean {
  if (!isWindows) return false;
  const cmd = process.argv[1];
  const target = exeName();
  const locations = '--shortcut-locations=Desktop,StartMenu';

  switch (cmd) {
    case '--squirrel-install':
    case '--squirrel-updated':
      runUpdate([`--createShortcut=${target}`, locations], () => app.quit());
      return true;
    case '--squirrel-uninstall':
      runUpdate([`--removeShortcut=${target}`, locations], () => app.quit());
      return true;
    case '--squirrel-obsolete':
      app.quit();
      return true;
    default:
      return false;
  }
}
