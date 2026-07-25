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
  type PresenceEntry,
  type RemoteConnectionStatus,
  type RemoteEventPush,
  type RemoteRecord,
  type SyncedCollection,
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
    changePassword: (input) => ipcRenderer.invoke(IPC.authChangePassword, input),
  },
  profiles: {
    list: () => ipcRenderer.invoke(IPC.profilesList),
    get: (email: string) => ipcRenderer.invoke(IPC.profilesGet, email),
    updateSelf: (email: string, patch) =>
      ipcRenderer.invoke(IPC.profilesUpdateSelf, { email, patch }),
  },
  prefs: {
    get: (email: string) => ipcRenderer.invoke(IPC.prefsGet, email),
    update: (email: string, patch) => ipcRenderer.invoke(IPC.prefsUpdate, { email, patch }),
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
    remove: (id: number) => ipcRenderer.invoke(IPC.quotesRemove, id),
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
    remove: (id: number) => ipcRenderer.invoke(IPC.decisionsRemove, id),
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
    listRecords: (collection: SyncedCollection) =>
      ipcRenderer.invoke(IPC.remoteListRecords, collection),
    upsertRecord: (collection: SyncedCollection, id: string, data: Record<string, unknown>) =>
      ipcRenderer.invoke(IPC.remoteUpsertRecord, { collection, id, data }),
    deleteRecord: (collection: SyncedCollection, id: string) =>
      ipcRenderer.invoke(IPC.remoteDeleteRecord, { collection, id }),
    onRecord: (callback: (record: RemoteRecord) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, record: RemoteRecord) => callback(record);
      ipcRenderer.on(IPC.remoteRecordPush, listener);
      return () => ipcRenderer.removeListener(IPC.remoteRecordPush, listener);
    },
    setIdentity: (email: string | null) => ipcRenderer.send(IPC.remoteSetIdentity, email),
    getPresence: () => ipcRenderer.invoke(IPC.remoteGetPresence),
    onPresence: (callback: (users: PresenceEntry[]) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, users: PresenceEntry[]) => callback(users);
      ipcRenderer.on(IPC.remotePresencePush, listener);
      return () => ipcRenderer.removeListener(IPC.remotePresencePush, listener);
    },
  },
  system: {
    notify: (input: { title: string; body: string }) => ipcRenderer.send(IPC.systemNotify, input),
    getAutoLaunch: () => ipcRenderer.invoke(IPC.systemGetAutoLaunch),
    setAutoLaunch: (enabled: boolean) => ipcRenderer.invoke(IPC.systemSetAutoLaunch, enabled),
    getAppInfo: () => ipcRenderer.invoke(IPC.systemGetAppInfo),
  },
  env: { isElectron: true },
};

contextBridge.exposeInMainWorld('amn', bridge);
