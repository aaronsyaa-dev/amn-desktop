import { BrowserWindow, ipcMain } from 'electron';
import {
  IPC,
  type AddClientEventInput,
  type CreateClientInput,
  type SendMessageInput,
  type UpdateClientInput,
} from '../shared/api';
import {
  addClientEvent,
  createClient,
  listClients,
  listMessages,
  sendMessage,
  updateClient,
  verifyCredentials,
} from './services';
import type { RemoteApiClient } from './remoteApi';

/** Registers the IPC handlers backing `window.amn` in the renderer. */
export function registerIpcHandlers(remote: RemoteApiClient): void {
  ipcMain.handle(
    IPC.authLogin,
    (_event, payload: { email: string; password: string }) =>
      verifyCredentials(payload.email, payload.password),
  );

  ipcMain.handle(IPC.messagesList, () => listMessages());
  ipcMain.handle(IPC.messagesSend, (_event, input: SendMessageInput) =>
    sendMessage(input),
  );

  ipcMain.handle(IPC.clientsList, () => listClients());
  ipcMain.handle(IPC.clientsCreate, (_event, input: CreateClientInput) =>
    createClient(input),
  );
  ipcMain.handle(
    IPC.clientsUpdate,
    (_event, payload: { id: number; patch: UpdateClientInput }) =>
      updateClient(payload.id, payload.patch),
  );
  ipcMain.handle(IPC.clientsAddEvent, (_event, input: AddClientEventInput) =>
    addClientEvent(input),
  );

  ipcMain.handle(IPC.remoteListSites, () => remote.listSites());
  ipcMain.handle(
    IPC.remoteSiteEvents,
    (_event, payload: { siteId: string; opts?: { since?: string; limit?: number } }) =>
      remote.getSiteEvents(payload.siteId, payload.opts),
  );
  ipcMain.handle(IPC.remoteRegisterSite, (_event, name: string) => remote.registerSite(name));
  ipcMain.handle(IPC.remoteConnectionStatus, () => remote.getConnectionStatus());

  // Push channels: broadcast to every open window rather than replying to a
  // specific invoke() call, since these are server-initiated updates.
  remote.onEvent((push) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.remoteEventPush, push);
    }
  });
  remote.onStatusChange((status) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.remoteConnectionStatusPush, status);
    }
  });
}
