import { ipcMain } from 'electron';
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

/** Registers the IPC handlers backing `window.amn` in the renderer. */
export function registerIpcHandlers(): void {
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
}
