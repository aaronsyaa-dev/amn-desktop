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
  type VaultEntry,
  type RemoteConnectionStatus,
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
import { exclusiveBridge, exclusivePreload } from '@edition/preloadExclusive';

const bridge: AmnBridge = {
  // Vide dans l'édition Business : voir @edition/preloadExclusive.
  ...exclusiveBridge,
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
    remove: (id: number) => ipcRenderer.invoke(IPC.clientsRemove, id),
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
    // Étalé en premier pour que les entrées explicites ci-dessous priment.
    // Vide dans l'édition Business : voir @edition/preloadExclusive.
    ...exclusivePreload,
    getConnectionStatus: () => ipcRenderer.invoke(IPC.remoteConnectionStatus),
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
    session: {
      login: (email: string, password: string) =>
        ipcRenderer.invoke(IPC.remoteSessionLogin, { email, password }),
      restore: (token: string) => ipcRenderer.invoke(IPC.remoteSessionRestore, token),
      clear: () => ipcRenderer.invoke(IPC.remoteSessionClear),
      changePassword: (currentPassword: string, newPassword: string) =>
        ipcRenderer.invoke(IPC.remoteSessionChangePassword, { currentPassword, newPassword }),
      acceptInvitation: (token: string, password: string) =>
        ipcRenderer.invoke(IPC.remoteSessionAcceptInvitation, { token, password }),
      listMyOrganizations: () => ipcRenderer.invoke(IPC.remoteSessionMyOrganizations),
      switchOrganization: (orgId: string) =>
        ipcRenderer.invoke(IPC.remoteSessionSwitchOrg, { orgId }),
      loginMfa: (input: { challenge: string; code?: string; backupCode?: string }) =>
        ipcRenderer.invoke(IPC.remoteLoginMfa, input),
    },
    mfa: {
      status: () => ipcRenderer.invoke(IPC.remoteMfaStatus),
      setup: () => ipcRenderer.invoke(IPC.remoteMfaSetup),
      activate: (code: string) => ipcRenderer.invoke(IPC.remoteMfaActivate, code),
      regenerateBackupCodes: (input: { password: string; code: string }) =>
        ipcRenderer.invoke(IPC.remoteMfaBackupCodes, input),
      disable: (input: { password: string; code: string }) =>
        ipcRenderer.invoke(IPC.remoteMfaDisable, input),
    },
    listSessions: () => ipcRenderer.invoke(IPC.remoteListSessions),
    revokeSession: (id: string) => ipcRenderer.invoke(IPC.remoteRevokeSession, id),
    accessLog: () => ipcRenderer.invoke(IPC.remoteAccessLog),
    exportOrganization: () => ipcRenderer.invoke(IPC.remoteExportOrganization),
    setOrganizationAccent: (accent) => ipcRenderer.invoke(IPC.remoteSetOrgAccent, accent),
    modules: {
      catalogue: () => ipcRenderer.invoke(IPC.remoteModuleCatalogue),
      request: (input: { module: string; message?: string }) =>
        ipcRenderer.invoke(IPC.remoteModuleRequest, input),
      requests: () => ipcRenderer.invoke(IPC.remoteModuleRequests),
    },
    callLinks: {
      create: (input) => ipcRenderer.invoke(IPC.remoteCallLinkCreate, input),
      list: () => ipcRenderer.invoke(IPC.remoteCallLinkList),
      revoke: (id: string) => ipcRenderer.invoke(IPC.remoteCallLinkRevoke, id),
    },
    getPresence: () => ipcRenderer.invoke(IPC.remoteGetPresence),
    onPresence: (callback: (users: PresenceEntry[]) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, users: PresenceEntry[]) => callback(users);
      ipcRenderer.on(IPC.remotePresencePush, listener);
      return () => ipcRenderer.removeListener(IPC.remotePresencePush, listener);
    },
  },
  system: {
    notify: (input: { title: string; body: string; kind?: 'default' | 'call' }) =>
      ipcRenderer.send(IPC.systemNotify, input),
    getAutoLaunch: () => ipcRenderer.invoke(IPC.systemGetAutoLaunch),
    setAutoLaunch: (enabled: boolean) => ipcRenderer.invoke(IPC.systemSetAutoLaunch, enabled),
    getAppInfo: () => ipcRenderer.invoke(IPC.systemGetAppInfo),
    canBeRemoteControlled: () => ipcRenderer.invoke(IPC.systemCanRemoteControl),
    injectRemoteInput: (event: unknown) => ipcRenderer.invoke(IPC.systemInjectRemoteInput, event),
  },
  updates: {
    onDownloaded: (cb: (info: { version: string; notes?: string }) => void) => {
      const listener = (_e: unknown, info: { version: string; notes?: string }) => cb(info);
      ipcRenderer.on(IPC.updateDownloaded, listener);
      return () => ipcRenderer.removeListener(IPC.updateDownloaded, listener);
    },
    install: () => ipcRenderer.invoke(IPC.updateInstall),
    check: () => ipcRenderer.invoke(IPC.updateCheck),
  },
  vault: {
    isEncrypted: () => ipcRenderer.invoke(IPC.vaultIsEncrypted),
    list: () => ipcRenderer.invoke(IPC.vaultList),
    save: (entries: VaultEntry[]) => ipcRenderer.invoke(IPC.vaultSave, entries),
  },
  env: { isElectron: true },
};

contextBridge.exposeInMainWorld('amn', bridge);
