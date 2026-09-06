/**
 * La face Business de la couture du process main (voir `exclusive.internal.ts`).
 *
 * Rien n'est enregistré : dans l'app livrée à une organisation cliente, aucun
 * canal IPC n'existe pour les sites supervisés, le Scanner, Comply, SSL
 * Monitor, les analyses récurrentes, le bureau SOC, les appels audio — ni
 * pour le CONTRÔLE À DISTANCE. Ce n'est pas une permission refusée — il n'y a
 * pas de destinataire, donc `ipcRenderer.invoke` sur ces canaux échoue faute
 * de gestionnaire.
 *
 * Les appels HTTP correspondants ne sont pas non plus compilés : ce fichier
 * n'importe ni `apiFetch`, ni `scanReports`, ni la moindre route `/v1/scans`,
 * `/v1/comply`, `/v1/ssl` ou `/v1/sites`. Ni `remoteInput` : `SendInput` de
 * user32.dll, qui pilote la souris et le clavier du poste, n'entre pas dans
 * le process main d'une cliente.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
export function registerExclusiveIpc(
  _ipcMain: Electron.IpcMain,
  _remote: unknown,
  _broadcastToAll: (channel: string, payload: unknown) => void,
): void {
  /* intentionnellement vide — voir l'en-tête */
}
/* eslint-enable @typescript-eslint/no-unused-vars */
