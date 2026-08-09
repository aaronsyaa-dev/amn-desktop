/**
 * Message d'erreur lisible, débarrassé de l'emballage IPC d'Electron.
 *
 * Une erreur levée dans `ipcMain.handle` traverse le pont enrobée :
 *
 *   Error invoking remote method 'remote:sessionLogin': Error: Email ou mot de
 *   passe incorrect.
 *
 * amn-api écrit pourtant ses refus POUR l'utilisateur final. Les afficher tels
 * quels donnait, sur l'écran de connexion d'une cliente, une phrase qui parle
 * de méthode distante avant de dire ce qui ne va pas — et qui expose au passage
 * des noms de canaux internes.
 */
const IPC_WRAPPER = /^Error invoking remote method '[^']*':\s*(?:[A-Za-z]*Error:\s*)?/;

export function cleanErrorMessage(error: unknown, fallback = 'Une erreur est survenue.'): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const cleaned = raw.replace(IPC_WRAPPER, '').trim();
  return cleaned || fallback;
}
