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
  type CallSignal,
  type CreateScheduleInput,
  type ProductRegression,
  type OutgoingCallSignal,
  type PresenceEntry,
  type ComplyProgress,
  type ScanProgress,
  type ScanTier,
  type TrackerTier,
  type VaultEntry,
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
    listSites: () => ipcRenderer.invoke(IPC.remoteListSites),
    getSiteEvents: (siteId, opts) =>
      ipcRenderer.invoke(IPC.remoteSiteEvents, { siteId, opts }),
    registerSite: (name: string) => ipcRenderer.invoke(IPC.remoteRegisterSite, name),
    updateSite: (id: string, name: string) => ipcRenderer.invoke(IPC.remoteUpdateSite, { id, name }),
    deleteSite: (id: string) => ipcRenderer.invoke(IPC.remoteDeleteSite, id),
    configureSite: (id: string, patch: { tier?: TrackerTier; url?: string | null }) =>
      ipcRenderer.invoke(IPC.remoteConfigureSite, { id, patch }),
    getSiteSummary: (id: string, hours?: number) =>
      ipcRenderer.invoke(IPC.remoteSiteSummary, { id, hours }),
    getSiteDigest: (id: string) => ipcRenderer.invoke(IPC.remoteSiteDigest, id),
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
    listSslStatus: () => ipcRenderer.invoke(IPC.remoteListSslStatus),
    checkSsl: (host: string) => ipcRenderer.invoke(IPC.remoteCheckSsl, host),
    listSchedules: () => ipcRenderer.invoke(IPC.remoteListSchedules),
    createSchedule: (input: CreateScheduleInput) =>
      ipcRenderer.invoke(IPC.remoteCreateSchedule, input),
    deleteSchedule: (id: string) => ipcRenderer.invoke(IPC.remoteDeleteSchedule, id),
    onProductRegression: (callback: (r: ProductRegression) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, r: ProductRegression) => callback(r);
      ipcRenderer.on(IPC.remoteProductRegressionPush, listener);
      return () => ipcRenderer.removeListener(IPC.remoteProductRegressionPush, listener);
    },
    getOrgOverview: (days: number) => ipcRenderer.invoke(IPC.remoteGetOrgOverview, days),
    getSiteBadge: (siteId: string) => ipcRenderer.invoke(IPC.remoteGetSiteBadge, siteId),
    sendCallSignal: (signal: OutgoingCallSignal) =>
      ipcRenderer.invoke(IPC.remoteSendCallSignal, signal),
    onCallSignal: (callback: (signal: CallSignal) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, signal: CallSignal) => callback(signal);
      ipcRenderer.on(IPC.remoteCallSignalPush, listener);
      return () => ipcRenderer.removeListener(IPC.remoteCallSignalPush, listener);
    },
    onPresence: (callback: (users: PresenceEntry[]) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, users: PresenceEntry[]) => callback(users);
      ipcRenderer.on(IPC.remotePresencePush, listener);
      return () => ipcRenderer.removeListener(IPC.remotePresencePush, listener);
    },
    startScan: (url: string, tier: ScanTier) => ipcRenderer.invoke(IPC.remoteStartScan, { url, tier }),
    listScans: () => ipcRenderer.invoke(IPC.remoteListScans),
    getScan: (id: string) => ipcRenderer.invoke(IPC.remoteGetScan, id),
    scanReportUrl: (id: string) => ipcRenderer.invoke(IPC.remoteScanReportUrl, id),
    onScanProgress: (callback: (progress: ScanProgress) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: ScanProgress) => callback(progress);
      ipcRenderer.on(IPC.remoteScanProgressPush, listener);
      return () => ipcRenderer.removeListener(IPC.remoteScanProgressPush, listener);
    },
    startComply: (url: string) => ipcRenderer.invoke(IPC.remoteStartComply, url),
    listComplyChecks: () => ipcRenderer.invoke(IPC.remoteListComplyChecks),
    getComplyCheck: (id: string) => ipcRenderer.invoke(IPC.remoteGetComplyCheck, id),
    onComplyProgress: (callback: (progress: ComplyProgress) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, progress: ComplyProgress) => callback(progress);
      ipcRenderer.on(IPC.remoteComplyProgressPush, listener);
      return () => ipcRenderer.removeListener(IPC.remoteComplyProgressPush, listener);
    },
  },
  system: {
    notify: (input: { title: string; body: string; kind?: 'default' | 'call' }) =>
      ipcRenderer.send(IPC.systemNotify, input),
    getAutoLaunch: () => ipcRenderer.invoke(IPC.systemGetAutoLaunch),
    setAutoLaunch: (enabled: boolean) => ipcRenderer.invoke(IPC.systemSetAutoLaunch, enabled),
    getAppInfo: () => ipcRenderer.invoke(IPC.systemGetAppInfo),
  },
  watch: {
    list: () => ipcRenderer.invoke(IPC.watchList),
    refresh: () => ipcRenderer.invoke(IPC.watchRefresh),
  },
  ollama: {
    status: () => ipcRenderer.invoke(IPC.ollamaStatus),
    chat: (input: { model: string; system: string; prompt: string }) =>
      ipcRenderer.invoke(IPC.ollamaChat, input),
  },
  updates: {
    onDownloaded: (cb: (info: { version: string; notes?: string }) => void) => {
      const listener = (_e: unknown, info: { version: string; notes?: string }) => cb(info);
      ipcRenderer.on(IPC.updateDownloaded, listener);
      return () => ipcRenderer.removeListener(IPC.updateDownloaded, listener);
    },
    install: () => ipcRenderer.invoke(IPC.updateInstall),
  },
  vault: {
    isEncrypted: () => ipcRenderer.invoke(IPC.vaultIsEncrypted),
    list: () => ipcRenderer.invoke(IPC.vaultList),
    save: (entries: VaultEntry[]) => ipcRenderer.invoke(IPC.vaultSave, entries),
  },
  env: { isElectron: true },
};

contextBridge.exposeInMainWorld('amn', bridge);
