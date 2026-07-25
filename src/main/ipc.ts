import { app, BrowserWindow, Notification, ipcMain } from 'electron';
import {
  IPC,
  type AddClientEventInput,
  type ChangePasswordInput,
  type NotificationPrefs,
  type UpdateProfileInput,
  type SyncedCollection,
  type CreateClientInput,
  type CreateDecisionInput,
  type CreateKnowledgeDocInput,
  type CreateLearningGoalInput,
  type CreateQuoteInput,
  type CreateSharedTaskInput,
  type SendMessageInput,
  type UpdateClientInput,
  type UpdateKnowledgeDocInput,
  type UpdateLearningGoalInput,
  type UpdateObjectiveInput,
  type UpdateQuoteInput,
  type UpdateSharedTaskInput,
} from '../shared/api';
import {
  addClientEvent,
  changePassword,
  listProfiles,
  getProfile,
  updateProfile,
  getPrefs,
  updatePrefs,
  checkChecklistItem,
  createClient,
  createDecision,
  removeDecision,
  removeQuote,
  createKnowledgeDoc,
  createLearningGoal,
  createQuote,
  createTask,
  getChecklistState,
  listClients,
  listDecisions,
  listKnowledgeDocs,
  listLearningGoals,
  listMessages,
  listObjectives,
  listQuotes,
  listTasks,
  reactToMessage,
  removeKnowledgeDoc,
  removeLearningGoal,
  removeTask,
  sendMessage,
  setMessagePinned,
  updateClient,
  updateKnowledgeDoc,
  updateLearningGoal,
  updateObjective,
  updateQuote,
  updateTask,
  verifyCredentials,
} from './services';
import type { RemoteApiClient } from './remoteApi';

/** Registers the IPC handlers backing `window.amn` in the renderer. */
interface IpcOptions {
  /** Called when the renderer raises an important OS notification. */
  onImportantNotification?: () => void;
}

export function registerIpcHandlers(remote: RemoteApiClient, options: IpcOptions = {}): void {
  ipcMain.handle(
    IPC.authLogin,
    (_event, payload: { email: string; password: string }) =>
      verifyCredentials(payload.email, payload.password),
  );
  ipcMain.handle(IPC.authChangePassword, (_event, input: ChangePasswordInput) =>
    changePassword(input),
  );

  ipcMain.handle(IPC.profilesList, () => listProfiles());
  ipcMain.handle(IPC.profilesGet, (_event, email: string) => getProfile(email));
  ipcMain.handle(
    IPC.profilesUpdateSelf,
    (_event, payload: { email: string; patch: UpdateProfileInput }) =>
      updateProfile(payload.email, payload.patch),
  );

  ipcMain.handle(IPC.prefsGet, (_event, email: string) => getPrefs(email));
  ipcMain.handle(
    IPC.prefsUpdate,
    (_event, payload: { email: string; patch: Partial<NotificationPrefs> }) =>
      updatePrefs(payload.email, payload.patch),
  );

  ipcMain.handle(IPC.messagesList, () => listMessages());
  ipcMain.handle(IPC.messagesSend, (_event, input: SendMessageInput) =>
    sendMessage(input),
  );
  ipcMain.handle(
    IPC.messagesReact,
    (_event, payload: { id: number; emoji: string; authorEmail: string }) =>
      reactToMessage(payload.id, payload.emoji, payload.authorEmail),
  );
  ipcMain.handle(
    IPC.messagesSetPinned,
    (_event, payload: { id: number; pinned: boolean }) =>
      setMessagePinned(payload.id, payload.pinned),
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

  ipcMain.handle(IPC.quotesList, () => listQuotes());
  ipcMain.handle(IPC.quotesCreate, (_event, input: CreateQuoteInput) => createQuote(input));
  ipcMain.handle(
    IPC.quotesUpdate,
    (_event, payload: { id: number; patch: UpdateQuoteInput }) =>
      updateQuote(payload.id, payload.patch),
  );
  ipcMain.handle(IPC.quotesRemove, (_event, id: number) => removeQuote(id));

  ipcMain.handle(IPC.tasksList, () => listTasks());
  ipcMain.handle(IPC.tasksCreate, (_event, input: CreateSharedTaskInput) => createTask(input));
  ipcMain.handle(
    IPC.tasksUpdate,
    (_event, payload: { id: number; patch: UpdateSharedTaskInput }) =>
      updateTask(payload.id, payload.patch),
  );
  ipcMain.handle(IPC.tasksRemove, (_event, id: number) => removeTask(id));

  ipcMain.handle(IPC.decisionsList, () => listDecisions());
  ipcMain.handle(IPC.decisionsCreate, (_event, input: CreateDecisionInput) =>
    createDecision(input),
  );
  ipcMain.handle(IPC.decisionsRemove, (_event, id: number) => removeDecision(id));

  ipcMain.handle(IPC.knowledgeList, () => listKnowledgeDocs());
  ipcMain.handle(IPC.knowledgeCreate, (_event, input: CreateKnowledgeDocInput) =>
    createKnowledgeDoc(input),
  );
  ipcMain.handle(
    IPC.knowledgeUpdate,
    (_event, payload: { id: number; patch: UpdateKnowledgeDocInput }) =>
      updateKnowledgeDoc(payload.id, payload.patch),
  );
  ipcMain.handle(IPC.knowledgeRemove, (_event, id: number) => removeKnowledgeDoc(id));

  ipcMain.handle(IPC.checklistGetState, () => getChecklistState());
  ipcMain.handle(IPC.checklistCheck, (_event, itemId: string) => checkChecklistItem(itemId));

  ipcMain.handle(IPC.learningList, () => listLearningGoals());
  ipcMain.handle(IPC.learningCreate, (_event, input: CreateLearningGoalInput) =>
    createLearningGoal(input),
  );
  ipcMain.handle(
    IPC.learningUpdate,
    (_event, payload: { id: number; patch: UpdateLearningGoalInput }) =>
      updateLearningGoal(payload.id, payload.patch),
  );
  ipcMain.handle(IPC.learningRemove, (_event, id: number) => removeLearningGoal(id));

  ipcMain.handle(IPC.objectivesList, () => listObjectives());
  ipcMain.handle(
    IPC.objectivesUpdate,
    (_event, payload: { id: number; patch: UpdateObjectiveInput }) =>
      updateObjective(payload.id, payload.patch),
  );

  ipcMain.handle(IPC.remoteListSites, () => remote.listSites());
  ipcMain.handle(
    IPC.remoteSiteEvents,
    (_event, payload: { siteId: string; opts?: { since?: string; limit?: number } }) =>
      remote.getSiteEvents(payload.siteId, payload.opts),
  );
  ipcMain.handle(IPC.remoteRegisterSite, (_event, name: string) => remote.registerSite(name));
  ipcMain.handle(IPC.remoteConnectionStatus, () => remote.getConnectionStatus());

  ipcMain.handle(IPC.remoteListRecords, (_event, collection: SyncedCollection) =>
    remote.listRecords(collection),
  );
  ipcMain.handle(
    IPC.remoteUpsertRecord,
    (_event, payload: { collection: SyncedCollection; id: string; data: Record<string, unknown> }) =>
      remote.upsertRecord(payload.collection, payload.id, payload.data),
  );
  ipcMain.handle(
    IPC.remoteDeleteRecord,
    (_event, payload: { collection: SyncedCollection; id: string }) =>
      remote.deleteRecord(payload.collection, payload.id),
  );
  ipcMain.handle(IPC.remoteGetPresence, () => remote.getPresence());
  // setIdentity is fire-and-forget from the renderer (no reply needed).
  ipcMain.on(IPC.remoteSetIdentity, (_event, email: string | null) => remote.setIdentity(email));

  // Push channels: broadcast to every open window rather than replying to a
  // specific invoke() call, since these are server-initiated updates.
  const broadcastToAll = (channel: string, payload: unknown) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(channel, payload);
    }
  };
  remote.onEvent((push) => broadcastToAll(IPC.remoteEventPush, push));
  remote.onStatusChange((status) => broadcastToAll(IPC.remoteConnectionStatusPush, status));
  remote.onRecord((record) => broadcastToAll(IPC.remoteRecordPush, record));
  remote.onPresence((users) => broadcastToAll(IPC.remotePresencePush, users));

  // Native OS notifications. The renderer decides *when* (it holds prefs +
  // identity + the live streams); the main process just shows them so they
  // surface even when the app is in the background.
  ipcMain.on(IPC.systemNotify, (_event, input: { title: string; body: string }) => {
    options.onImportantNotification?.();
    if (!Notification.isSupported()) return;
    const notification = new Notification({ title: input.title, body: input.body, silent: false });
    notification.on('click', () => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) {
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
      }
    });
    notification.show();
  });

  // Launch-at-login toggle (Settings → "Démarrer avec Windows").
  ipcMain.handle(IPC.systemGetAutoLaunch, () => {
    try {
      return app.getLoginItemSettings().openAtLogin;
    } catch {
      return false;
    }
  });
  ipcMain.handle(IPC.systemSetAutoLaunch, (_event, enabled: boolean) => {
    try {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        openAsHidden: enabled, // macOS: start hidden
        args: enabled ? ['--hidden'] : [], // Windows/Linux: our hidden-start flag
      });
      return app.getLoginItemSettings().openAtLogin;
    } catch {
      return false;
    }
  });

  ipcMain.handle(IPC.systemGetAppInfo, () => ({
    name: 'AMN Desktop',
    version: app.getVersion(),
    platform: process.platform,
    isElectron: true,
  }));
}
