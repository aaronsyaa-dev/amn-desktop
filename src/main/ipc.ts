import { ipcMain } from 'electron';
import { IPC, type SendMessageInput } from '../shared/api';
import { listMessages, sendMessage, verifyCredentials } from './services';

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
}
