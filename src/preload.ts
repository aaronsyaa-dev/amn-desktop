// Preload script: exposes a minimal, typed surface (`window.amn`) to the
// renderer over IPC. The renderer never sees Electron or the database directly.
// See src/shared/api.ts for the contract and src/lib/bridge.ts for the consumer.
import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC,
  type AddClientEventInput,
  type AmnBridge,
  type CreateClientInput,
  type CreateDecisionInput,
  type CreateKnowledgeDocInput,
  type CreateLearningGoalInput,
  type CreateQuoteInput,
  type CreateSharedTaskInput,
  type RemoteConnectionStatus,
  type RemoteEventPush,
  type SendMessageInput,
  type UpdateClientInput,
  type UpdateKnowledgeDocInput,
  type UpdateLearningGoalInput,
  type UpdateObjectiveInput,
  type UpdateQuoteInput,
  type UpdateSharedTaskInput,
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
    react: (id: number, emoji: string, authorEmail: string) =>
      ipcRenderer.invoke(IPC.messagesReact, { id, emoji, authorEmail }),
    setPinned: (id: number, pinned: boolean) =>
      ipcRenderer.invoke(IPC.messagesSetPinned, { id, pinned }),
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
  quotes: {
    list: () => ipcRenderer.invoke(IPC.quotesList),
    create: (input: CreateQuoteInput) => ipcRenderer.invoke(IPC.quotesCreate, input),
    update: (id: number, patch: UpdateQuoteInput) =>
      ipcRenderer.invoke(IPC.quotesUpdate, { id, patch }),
  },
  tasks: {
    list: () => ipcRenderer.invoke(IPC.tasksList),
    create: (input: CreateSharedTaskInput) => ipcRenderer.invoke(IPC.tasksCreate, input),
    update: (id: number, patch: UpdateSharedTaskInput) =>
      ipcRenderer.invoke(IPC.tasksUpdate, { id, patch }),
    remove: (id: number) => ipcRenderer.invoke(IPC.tasksRemove, id),
  },
  decisions: {
    list: () => ipcRenderer.invoke(IPC.decisionsList),
    create: (input: CreateDecisionInput) => ipcRenderer.invoke(IPC.decisionsCreate, input),
  },
  knowledge: {
    list: () => ipcRenderer.invoke(IPC.knowledgeList),
    create: (input: CreateKnowledgeDocInput) => ipcRenderer.invoke(IPC.knowledgeCreate, input),
    update: (id: number, patch: UpdateKnowledgeDocInput) =>
      ipcRenderer.invoke(IPC.knowledgeUpdate, { id, patch }),
    remove: (id: number) => ipcRenderer.invoke(IPC.knowledgeRemove, id),
  },
  checklist: {
    getState: () => ipcRenderer.invoke(IPC.checklistGetState),
    check: (itemId: string) => ipcRenderer.invoke(IPC.checklistCheck, itemId),
  },
  learning: {
    list: () => ipcRenderer.invoke(IPC.learningList),
    create: (input: CreateLearningGoalInput) => ipcRenderer.invoke(IPC.learningCreate, input),
    update: (id: number, patch: UpdateLearningGoalInput) =>
      ipcRenderer.invoke(IPC.learningUpdate, { id, patch }),
    remove: (id: number) => ipcRenderer.invoke(IPC.learningRemove, id),
  },
  objectives: {
    list: () => ipcRenderer.invoke(IPC.objectivesList),
    update: (id: number, patch: UpdateObjectiveInput) =>
      ipcRenderer.invoke(IPC.objectivesUpdate, { id, patch }),
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
