import { BrowserWindow, ipcMain } from 'electron';
import {
  IPC,
  type AddClientEventInput,
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
  checkChecklistItem,
  createClient,
  createDecision,
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
export function registerIpcHandlers(remote: RemoteApiClient): void {
  ipcMain.handle(
    IPC.authLogin,
    (_event, payload: { email: string; password: string }) =>
      verifyCredentials(payload.email, payload.password),
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

  // Push channels: broadcast to every open window rather than replying to a
  // specific invoke() call, since these are server-initiated updates.
  remote.onEvent((push) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.remoteEventPush, push);
    }
  });
  remote.onStatusChange((status) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.remoteConnectionStatusPush, status);
    }
  });
}
