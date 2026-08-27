import { app } from 'electron';

/**
 * Démarrage avec Windows — sans Squirrel.
 *
 * L'ancienne version passait par `Update.exe --processStart`, le lanceur de
 * Squirrel.Windows, parce qu'une installation Squirrel vivait dans un dossier
 * PAR VERSION (`…\app-1.2.33\AMN Desktop.exe`) : pointer l'élément de
 * connexion sur l'exécutable versionné cassait le réglage à chaque mise à
 * jour.
 *
 * L'installeur NSIS (electron-builder) installe à un chemin STABLE
 * (`%LOCALAPPDATA%\Programs\<produit>\<produit>.exe`), que les mises à jour
 * d'electron-updater remplacent en place. L'élément de connexion peut donc
 * viser l'exécutable lui-même, ce qui est aussi le chemin que
 * `app.setLoginItemSettings` prend par défaut. Toute la mécanique Squirrel
 * (stub, Update.exe, événements `--squirrel-*`) a été retirée avec la
 * migration — voir electron-builder.config.mjs pour le pourquoi.
 *
 * `--hidden` reste notre drapeau de démarrage en arrière-plan (l'app s'ouvre
 * dans la barre système, pas en fenêtre) ; macOS garde `openAsHidden`.
 */

function loginItemSettings(enabled: boolean): Electron.Settings {
  return {
    openAtLogin: enabled,
    openAsHidden: enabled, // macOS : démarrer masqué
    args: enabled ? ['--hidden'] : [],
  };
}

/** Lit l'état réel du démarrage automatique. */
export function getAutoLaunch(): boolean {
  try {
    return app.getLoginItemSettings({ args: ['--hidden'] }).openAtLogin;
  } catch {
    return false;
  }
}

/** Active/désactive le démarrage automatique ; rend l'état effectif. */
export function setAutoLaunch(enabled: boolean): boolean {
  try {
    app.setLoginItemSettings(loginItemSettings(enabled));
    return getAutoLaunch();
  } catch {
    return false;
  }
}
