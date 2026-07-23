// Preload script: exposes a minimal, typed surface (`window.amn`) to the
// renderer over IPC. The renderer never sees Electron or the database directly.
// See src/shared/api.ts for the contract and src/lib/bridge.ts for the consumer.
import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type AmnBridge, type SendMessageInput } from './shared/api';

const bridge: AmnBridge = {
  auth: {
    login: (email, password) =>
      ipcRenderer.invoke(IPC.authLogin, { email, password }),
  },
  messages: {
    list: () => ipcRenderer.invoke(IPC.messagesList),
    send: (input: SendMessageInput) =>
      ipcRenderer.invoke(IPC.messagesSend, input),
  },
  env: { isElectron: true },
};

contextBridge.exposeInMainWorld('amn', bridge);
