import { app, BrowserWindow, Notification, ipcMain } from 'electron';
import type { UserRole } from '../shared/api';
import { EDITION_PRODUCT_NAME } from '../edition/edition';
import {
  IPC,
  type AddClientEventInput,
  type ChangePasswordInput,
  type NotificationPrefs,
  type UpdateProfileInput,
  type SyncedCollection,
  type VaultEntry,
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
  type RemoteInputEvent,
} from '../shared/api';
import {
  addClientEvent,
  removeClient,
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
import { getAutoLaunch, setAutoLaunch } from './windowsIntegration';
import { isVaultEncryptionAvailable, loadVault, saveVault } from './vault';
import { getDb } from './db';
import { injectRemoteInput, isRemoteInputAvailable } from './remoteInput';
import { registerExclusiveIpc } from '@edition/mainExclusive';
import { pushClient, pushQuote } from './clientsSync';

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

  // Every client/quote write also mirrors best-effort to amn-api (see
  // clientsSync.ts) so this per-machine data survives a wiped or fresh local
  // DB — the fix for "Clients vides après mise à jour". Push failures never
  // surface to the renderer: the local write already succeeded and is what
  // the IPC call returns.
  ipcMain.handle(IPC.clientsList, () => listClients());
  ipcMain.handle(IPC.clientsCreate, (_event, input: CreateClientInput) => {
    const client = createClient(input);
    void pushClient(remote, getDb(), client.id);
    return client;
  });
  ipcMain.handle(
    IPC.clientsUpdate,
    (_event, payload: { id: number; patch: UpdateClientInput }) => {
      const client = updateClient(payload.id, payload.patch);
      void pushClient(remote, getDb(), client.id);
      return client;
    },
  );
  ipcMain.handle(IPC.clientsAddEvent, (_event, input: AddClientEventInput) => {
    const client = addClientEvent(input);
    void pushClient(remote, getDb(), client.id);
    return client;
  });
  ipcMain.handle(IPC.clientsRemove, (_event, id: number) => removeClient(id));

  ipcMain.handle(IPC.quotesList, () => listQuotes());
  ipcMain.handle(IPC.quotesCreate, (_event, input: CreateQuoteInput) => {
    const quote = createQuote(input);
    void pushQuote(remote, getDb(), quote.id);
    return quote;
  });
  ipcMain.handle(
    IPC.quotesUpdate,
    (_event, payload: { id: number; patch: UpdateQuoteInput }) => {
      const quote = updateQuote(payload.id, payload.patch);
      void pushQuote(remote, getDb(), quote.id);
      return quote;
    },
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

  ipcMain.handle(IPC.remoteConnectionStatus, () => remote.getConnectionStatus());

  ipcMain.handle(IPC.remoteListRecords, (_event, collection: SyncedCollection) =>
    remote.listRecords(collection),
  );
  ipcMain.handle(IPC.remoteListRecordsBulk, (_event, collections: SyncedCollection[]) =>
    remote.listRecordsBulk(collections),
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
  // Session amn-api. Le renderer conserve le jeton (c'est le justificatif de
  // SON utilisateur, pas un secret de build comme le jeton opérateur) et le
  // redonne au démarrage ; le process main est celui qui s'en sert.
  ipcMain.handle(
    IPC.remoteSessionLogin,
    (_event, payload: { email: string; password: string }) =>
      remote.login(payload.email, payload.password),
  );
  ipcMain.handle(IPC.remoteSessionRestore, (_event, token: string) => remote.restoreSession(token));
  ipcMain.handle(IPC.remoteSessionClear, () => remote.clearSession());
  ipcMain.handle(
    IPC.remoteSessionChangePassword,
    (_event, payload: { currentPassword: string; newPassword: string }) =>
      remote.changeSessionPassword(payload.currentPassword, payload.newPassword),
  );
  ipcMain.handle(
    IPC.remoteLoginMfa,
    (_event, input: { challenge: string; code?: string; backupCode?: string }) => remote.loginMfa(input),
  );
  ipcMain.handle(IPC.remoteMfaStatus, () => remote.mfaStatus());
  ipcMain.handle(IPC.remoteMfaSetup, () => remote.mfaSetup());
  ipcMain.handle(IPC.remoteMfaActivate, (_event, code: string) => remote.mfaActivate(code));
  ipcMain.handle(IPC.remoteMfaBackupCodes, (_event, input: { password: string; code: string }) =>
    remote.mfaRegenerateBackupCodes(input),
  );
  ipcMain.handle(IPC.remoteMfaDisable, (_event, input: { password: string; code: string }) =>
    remote.mfaDisable(input),
  );
  ipcMain.handle(
    IPC.remoteSessionAcceptInvitation,
    (_event, payload: { token: string; password: string }) =>
      remote.acceptInvitation(payload.token, payload.password),
  );
  ipcMain.handle(IPC.remoteSessionMyOrganizations, () => remote.listMyOrganizations());
  ipcMain.handle(IPC.remoteSessionSwitchOrg, (_event, payload: { orgId: string }) =>
    remote.switchOrganization(payload.orgId),
  );
  ipcMain.handle(IPC.remoteMembersList, () => remote.listMembers());
  ipcMain.handle(IPC.remoteSupportList, () => remote.listSupportRequests());
  ipcMain.handle(IPC.remoteSupportSend, (_event, input: { kind: 'message' | 'seat'; subject?: string; body?: string }) =>
    remote.sendSupportRequest(input),
  );
  ipcMain.handle(IPC.remoteForgotPassword, (_event, email: string) => remote.forgotPassword(email));
  ipcMain.handle(IPC.remoteWelcomeInspect, (_event, token: string) => remote.welcomeInspect(token));
  ipcMain.handle(IPC.remoteWelcomeReveal, (_event, token: string) => remote.welcomeReveal(token));
  ipcMain.handle(IPC.remoteWelcomeConfirm, (_event, token: string) => remote.welcomeConfirm(token));
  ipcMain.handle(IPC.remoteMembersInvite, (_event, input: { email: string; role: UserRole }) =>
    remote.inviteMember(input),
  );
  ipcMain.handle(IPC.remoteMembersSetRole, (_event, p: { userId: string; role: UserRole }) =>
    remote.setMemberRole(p.userId, p.role),
  );
  ipcMain.handle(
    IPC.remoteMembersSetStatus,
    (_event, p: { userId: string; status: 'active' | 'suspended' }) =>
      remote.setMemberStatus(p.userId, p.status),
  );
  ipcMain.handle(IPC.remoteModuleCatalogue, () => remote.moduleCatalogue());
  ipcMain.handle(IPC.remoteModuleRequest, (_event, input: { module: string; message?: string }) =>
    remote.requestModule(input),
  );
  ipcMain.handle(IPC.remoteModuleRequests, () => remote.moduleRequests());
  ipcMain.handle(IPC.remoteCallLinkCreate, (_event, input: { label?: string; minutes?: number }) =>
    remote.createCallLink(input ?? {}),
  );
  ipcMain.handle(IPC.remoteCallLinkList, () => remote.listCallLinks());
  ipcMain.handle(IPC.remoteCallLinkRevoke, (_event, id: string) => remote.revokeCallLink(id));
  ipcMain.handle(IPC.remoteListSessions, () => remote.listSessions());
  ipcMain.handle(IPC.remoteRevokeSession, (_event, id: string) => remote.revokeSession(id));
  ipcMain.handle(IPC.remoteAccessLog, () => remote.accessLog());
  ipcMain.handle(IPC.remoteExportOrganization, () => remote.exportOrganization());
  ipcMain.handle(IPC.remoteSetOrgAccent, (_event, accent: string | null) =>
    remote.setOrganizationAccent(accent),
  );

  // Push channels: broadcast to every open window rather than replying to a
  // specific invoke() call, since these are server-initiated updates.
  const broadcastToAll = (channel: string, payload: unknown) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(channel, payload);
    }
  };
  remote.onStatusChange((status) => broadcastToAll(IPC.remoteConnectionStatusPush, status));
  remote.onRecord((record) => broadcastToAll(IPC.remoteRecordPush, record));
  remote.onPresence((users) => broadcastToAll(IPC.remotePresencePush, users));
  // La réponse du prestataire (Bloc 4) : une trame de l'organisation, relayée telle quelle.
  remote.onFrame('support:answered', (frame) => broadcastToAll(IPC.remoteSupportAnsweredPush, frame.request));

  // Produits exclusifs d'AMN DevSec (parc de sites, Scanner, Comply, SSL
  // Monitor, analyses récurrentes, bureau SOC, appels audio). Dans l'édition
  // Business, cet appel ne fait rien — et les canaux n'existent donc pas.
  registerExclusiveIpc(ipcMain, remote, broadcastToAll);

  // Native OS notifications. The renderer decides *when* (it holds prefs +
  // identity + the live streams); the main process just shows them so they
  // surface even when the app is in the background.
  ipcMain.on(
    IPC.systemNotify,
    (_event, input: { title: string; body: string; kind?: 'default' | 'call' }) => {
      options.onImportantNotification?.();
      if (!Notification.isSupported()) return;
      const isCall = input.kind === 'call';
      const notification = new Notification({
        title: input.title,
        body: input.body,
        silent: false,
        // A call is only announced while it rings, so the notification must
        // stay on screen for as long as it does — a 5 s toast that vanishes on
        // its own is precisely how the previous version let calls go unseen.
        timeoutType: isCall ? 'never' : 'default',
        urgency: isCall ? 'critical' : 'normal',
      });
      notification.on('click', () => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) {
          if (win.isMinimized()) win.restore();
          win.show();
          win.focus();
        }
      });
      notification.show();
    },
  );

  // Remote control (B.2). The main process is a dumb executor: it never
  // decides whether control is allowed — the renderer holds the consent state,
  // and only sends events while the operator has granted control.
  ipcMain.handle(IPC.systemCanRemoteControl, () => isRemoteInputAvailable());
  ipcMain.handle(IPC.systemInjectRemoteInput, (_event, input: RemoteInputEvent) =>
    injectRemoteInput(input),
  );

  // Launch-at-login toggle (Settings → "Démarrer avec Windows"). Delegated to
  // windowsIntegration so the login item registers against Squirrel's stable
  // Update.exe launcher (surviving auto-updates) rather than the versioned exe.
  ipcMain.handle(IPC.systemGetAutoLaunch, () => getAutoLaunch());
  ipcMain.handle(IPC.systemSetAutoLaunch, (_event, enabled: boolean) => setAutoLaunch(enabled));

  ipcMain.handle(IPC.systemGetAppInfo, () => ({
    name: EDITION_PRODUCT_NAME,
    version: app.getVersion(),
    platform: process.platform,
    isElectron: true,
  }));

  // Password vault — local-only, encrypted at rest. Never touches remote/
  // the WebSocket hub above: see main/vault.ts.
  ipcMain.handle(IPC.vaultIsEncrypted, () => isVaultEncryptionAvailable());
  ipcMain.handle(IPC.vaultList, () => loadVault());
  ipcMain.handle(IPC.vaultSave, (_event, entries: VaultEntry[]) => saveVault(entries));
}
