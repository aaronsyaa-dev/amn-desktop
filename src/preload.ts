// Preload script: exposes a minimal, typed surface (`window.amn`) to the
// renderer over IPC. The renderer never sees Electron or the database directly.
// See src/shared/api.ts for the contract and src/lib/bridge.ts for the consumer.
import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC,
  type AddClientEventInput,
  type AmnBridge,
  type CreateClientInput,
  type RemoteConnectionStatus,
  type RemoteEventPush,
  type SendMessageInput,
  type UpdateClientInput,
} from './shared/api';

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
  clients: {
    list: () => ipcRenderer.invoke(IPC.clientsList),
    create: (input: CreateClientInput) =>
      ipcRenderer.invoke(IPC.clientsCreate, input),
    update: (id: number, patch: UpdateClientInput) =>
      ipcRenderer.invoke(IPC.clientsUpdate, { id, patch }),
    addEvent: (input: AddClientEventInput) =>
      ipcRenderer.invoke(IPC.clientsAddEvent, input),
  },
  remote: {
    listSites: () => ipcRenderer.invoke(IPC.remoteListSites),
    getSiteEvents: (siteId, opts) =>
      ipcRenderer.invoke(IPC.remoteSiteEvents, { siteId, opts }),
    registerSite: (name: string) => ipcRenderer.invoke(IPC.remoteRegisterSite, name),
    getConnectionStatus: () => ipcRenderer.invoke(IPC.remoteConnectionStatus),
    onEvent: (callback: (push: RemoteEventPush) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, push: RemoteEventPush) =>
        callback(push);
      ipcRenderer.on(IPC.remoteEventPush, listener);
      return () => ipcRenderer.removeListener(IPC.remoteEventPush, listener);
    },
    onConnectionStatusChange: (callback: (status: RemoteConnectionStatus) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, status: RemoteConnectionStatus) =>
        callback(status);
      ipcRenderer.on(IPC.remoteConnectionStatusPush, listener);
      return () => ipcRenderer.removeListener(IPC.remoteConnectionStatusPush, listener);
    },
  },
  env: { isElectron: true },
};

contextBridge.exposeInMainWorld('amn', bridge);
