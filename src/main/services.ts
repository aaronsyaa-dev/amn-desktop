import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import type {
  AddClientEventInput,
  AuthResult,
  ChangePasswordInput,
  ChangePasswordResult,
  NotificationPrefs,
  UpdateProfileInput,
  UserProfile,
  ChecklistStateEntry,
  Client,
  ClientEvent,
  CreateClientInput,
  CreateDecisionInput,
  CreateKnowledgeDocInput,
  CreateLearningGoalInput,
  CreateQuoteInput,
  CreateSharedTaskInput,
  Decision,
  KnowledgeDoc,
  LearningGoal,
  Message,
  MessageAttachment,
  MessageReaction,
  Objective,
  Quote,
  SendMessageInput,
  SharedTask,
  UpdateClientInput,
  UpdateKnowledgeDocInput,
  UpdateLearningGoalInput,
  UpdateObjectiveInput,
  UpdateQuoteInput,
  UpdateSharedTaskInput,
  User,
} from '../shared/api';
import { DEFAULT_NOTIFICATION_PREFS } from '../shared/api';
import { getDb } from './db';

interface UserRow {
  id: number;
  email: string;
  name: string;
  password_hash: string;
}

interface MessageRow {
  id: number;
  author_email: string;
  author_name: string;
  body: string;
  created_at: string;
  attachments: string;
  reply_to_id: number | null;
  pinned: number;
}

interface ReactionRow {
  message_id: number;
  emoji: string;
  author_email: string;
}

function reactionsFor(messageIds: number[]): Map<number, MessageReaction[]> {
  const map = new Map<number, MessageReaction[]>();
  if (messageIds.length === 0) return map;
  const placeholders = messageIds.map(() => '?').join(',');
  const rows = getDb()
    .prepare(`SELECT message_id, emoji, author_email FROM message_reactions WHERE message_id IN (${placeholders})`)
    .all(...messageIds) as ReactionRow[];
  for (const row of rows) {
    const list = map.get(row.message_id) ?? [];
    list.push({ emoji: row.emoji, authorEmail: row.author_email });
    map.set(row.message_id, list);
  }
  return map;
}

function toMessage(row: MessageRow, reactions: MessageReaction[] = []): Message {
  let attachments: MessageAttachment[] = [];
  try {
    attachments = JSON.parse(row.attachments) as MessageAttachment[];
  } catch {
    attachments = [];
  }
  return {
    id: row.id,
    authorEmail: row.author_email,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
    attachments,
    replyToId: row.reply_to_id,
    reactions,
    pinned: Boolean(row.pinned),
  };
}

/** Verifies credentials against the bcrypt hash stored in SQLite. */
export function verifyCredentials(email: string, password: string): AuthResult {
  const row = getDb()
    .prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?')
    .get(email.trim().toLowerCase()) as UserRow | undefined;

  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return { ok: false, error: 'Email ou mot de passe incorrect.' };
  }

  const user: User = { id: row.id, email: row.email, name: row.name };
  return { ok: true, user };
}

export function changePassword(input: ChangePasswordInput): ChangePasswordResult {
  const email = input.email.trim().toLowerCase();
  const row = getDb()
    .prepare('SELECT password_hash FROM users WHERE email = ?')
    .get(email) as { password_hash: string } | undefined;
  if (!row || !bcrypt.compareSync(input.currentPassword, row.password_hash)) {
    return { ok: false, error: 'Mot de passe actuel incorrect.' };
  }
  if (input.newPassword.length < 8) {
    return { ok: false, error: 'Le nouveau mot de passe doit faire au moins 8 caractères.' };
  }
  const hash = bcrypt.hashSync(input.newPassword, 10);
  getDb().prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(hash, email);
  return { ok: true };
}

/* ------------------------------ Profiles ------------------------------ */

interface ProfileRow {
  email: string;
  name: string;
  photo_data_url: string;
  presence_text: string;
  updated_at: string;
}

function toProfile(row: ProfileRow): UserProfile {
  return {
    email: row.email,
    name: row.name,
    photoDataUrl: row.photo_data_url,
    presenceText: row.presence_text,
    updatedAt: row.updated_at,
  };
}

export function listProfiles(): UserProfile[] {
  const rows = getDb().prepare('SELECT * FROM user_profiles').all() as ProfileRow[];
  return rows.map(toProfile);
}

export function getProfile(email: string): UserProfile {
  const key = email.trim().toLowerCase();
  const row = getDb().prepare('SELECT * FROM user_profiles WHERE email = ?').get(key) as
    | ProfileRow
    | undefined;
  if (row) return toProfile(row);
  // Fall back to the user's name if no profile row exists yet.
  const user = getDb().prepare('SELECT name FROM users WHERE email = ?').get(key) as
    | { name: string }
    | undefined;
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO user_profiles (email, name, photo_data_url, presence_text, updated_at)
       VALUES (?, ?, '', '', ?)`,
    )
    .run(key, user?.name ?? key, now);
  return { email: key, name: user?.name ?? key, photoDataUrl: '', presenceText: '', updatedAt: now };
}

export function updateProfile(email: string, patch: UpdateProfileInput): UserProfile {
  getProfile(email); // ensure a row exists
  const key = email.trim().toLowerCase();
  const fields: string[] = [];
  const values: unknown[] = [];
  const map: Record<string, unknown> = {
    name: patch.name,
    photo_data_url: patch.photoDataUrl,
    presence_text: patch.presenceText,
  };
  for (const [column, value] of Object.entries(map)) {
    if (value !== undefined) {
      fields.push(`${column} = ?`);
      values.push(value);
    }
  }
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(key);
  getDb().prepare(`UPDATE user_profiles SET ${fields.join(', ')} WHERE email = ?`).run(...values);
  return getProfile(key);
}

/* --------------------------- Notification prefs --------------------------- */

interface PrefsRow {
  email: string;
  site_offline: number;
  critical_alert: number;
  mention: number;
  task_assigned: number;
}

function toPrefs(row: PrefsRow): NotificationPrefs {
  return {
    siteOffline: Boolean(row.site_offline),
    criticalAlert: Boolean(row.critical_alert),
    mention: Boolean(row.mention),
    taskAssigned: Boolean(row.task_assigned),
  };
}

export function getPrefs(email: string): NotificationPrefs {
  const key = email.trim().toLowerCase();
  const row = getDb().prepare('SELECT * FROM notification_prefs WHERE email = ?').get(key) as
    | PrefsRow
    | undefined;
  if (row) return toPrefs(row);
  getDb()
    .prepare('INSERT OR IGNORE INTO notification_prefs (email) VALUES (?)')
    .run(key);
  return { ...DEFAULT_NOTIFICATION_PREFS };
}

export function updatePrefs(email: string, patch: Partial<NotificationPrefs>): NotificationPrefs {
  getPrefs(email);
  const key = email.trim().toLowerCase();
  const fields: string[] = [];
  const values: unknown[] = [];
  const map: Record<string, boolean | undefined> = {
    site_offline: patch.siteOffline,
    critical_alert: patch.criticalAlert,
    mention: patch.mention,
    task_assigned: patch.taskAssigned,
  };
  for (const [column, value] of Object.entries(map)) {
    if (value !== undefined) {
      fields.push(`${column} = ?`);
      values.push(value ? 1 : 0);
    }
  }
  if (fields.length > 0) {
    values.push(key);
    getDb().prepare(`UPDATE notification_prefs SET ${fields.join(', ')} WHERE email = ?`).run(...values);
  }
  return getPrefs(key);
}

export function listMessages(): Message[] {
  const rows = getDb()
    .prepare('SELECT * FROM messages ORDER BY id ASC')
    .all() as MessageRow[];
  const reactions = reactionsFor(rows.map((r) => r.id));
  return rows.map((row) => toMessage(row, reactions.get(row.id) ?? []));
}

export function sendMessage(input: SendMessageInput): Message {
  const author = getDb()
    .prepare('SELECT name FROM users WHERE email = ?')
    .get(input.authorEmail) as { name: string } | undefined;

  const createdAt = new Date().toISOString();
  const attachments = JSON.stringify(input.attachments ?? []);
  const result = getDb()
    .prepare(
      'INSERT INTO messages (author_email, author_name, body, created_at, attachments, reply_to_id, pinned) VALUES (?, ?, ?, ?, ?, ?, 0)',
    )
    .run(
      input.authorEmail,
      author?.name ?? input.authorEmail,
      input.body,
      createdAt,
      attachments,
      input.replyToId ?? null,
    );

  return {
    id: Number(result.lastInsertRowid),
    authorEmail: input.authorEmail,
    authorName: author?.name ?? input.authorEmail,
    body: input.body,
    createdAt,
    attachments: input.attachments ?? [],
    replyToId: input.replyToId ?? null,
    reactions: [],
    pinned: false,
  };
}

function getMessage(id: number): Message {
  const row = getDb().prepare('SELECT * FROM messages WHERE id = ?').get(id) as
    | MessageRow
    | undefined;
  if (!row) throw new Error(`Message ${id} introuvable`);
  const reactions = reactionsFor([id]).get(id) ?? [];
  return toMessage(row, reactions);
}

/** Toggles a reaction: inserts it if absent for this author, removes it if present. */
export function reactToMessage(id: number, emoji: string, authorEmail: string): Message {
  const db = getDb();
  const existing = db
    .prepare('SELECT id FROM message_reactions WHERE message_id = ? AND emoji = ? AND author_email = ?')
    .get(id, emoji, authorEmail);
  if (existing) {
    db.prepare('DELETE FROM message_reactions WHERE message_id = ? AND emoji = ? AND author_email = ?').run(
      id,
      emoji,
      authorEmail,
    );
  } else {
    db.prepare('INSERT INTO message_reactions (message_id, emoji, author_email) VALUES (?, ?, ?)').run(
      id,
      emoji,
      authorEmail,
    );
  }
  return getMessage(id);
}

export function setMessagePinned(id: number, pinned: boolean): Message {
  getDb().prepare('UPDATE messages SET pinned = ? WHERE id = ?').run(pinned ? 1 : 0, id);
  return getMessage(id);
}

/* ------------------------------ Clients ------------------------------ */

interface ClientRow {
  id: number;
  name: string;
  company: string;
  status: Client['status'];
  email: string;
  phone: string;
  notes: string;
  image_data_url: string;
  linked_site_ids: string;
  created_at: string;
  updated_at: string;
}

interface ClientEventRow {
  id: number;
  client_id: number;
  title: string;
  detail: string;
  date: string;
}

function toClientEvent(row: ClientEventRow): ClientEvent {
  return {
    id: row.id,
    clientId: row.client_id,
    title: row.title,
    detail: row.detail,
    date: row.date,
  };
}

function hydrateClient(row: ClientRow): Client {
  const events = getDb()
    .prepare('SELECT * FROM client_events WHERE client_id = ? ORDER BY date DESC')
    .all(row.id) as ClientEventRow[];
  let linkedSiteIds: string[] = [];
  try {
    linkedSiteIds = JSON.parse(row.linked_site_ids) as string[];
  } catch {
    linkedSiteIds = [];
  }
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    status: row.status,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    imageDataUrl: row.image_data_url,
    linkedSiteIds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    events: events.map(toClientEvent),
  };
}

function getClient(id: number): Client {
  const row = getDb()
    .prepare('SELECT * FROM clients WHERE id = ?')
    .get(id) as ClientRow | undefined;
  if (!row) throw new Error(`Client ${id} introuvable`);
  return hydrateClient(row);
}

export function listClients(): Client[] {
  const rows = getDb()
    .prepare('SELECT * FROM clients ORDER BY name ASC')
    .all() as ClientRow[];
  return rows.map(hydrateClient);
}

export function createClient(input: CreateClientInput): Client {
  const now = new Date().toISOString();
  // sync_id assigned at creation (not just backfilled for pre-existing rows)
  // so clientsSync.pushClient can mirror this client to amn-api immediately —
  // see clientsSync.ts.
  const result = getDb()
    .prepare(
      `INSERT INTO clients (sync_id, name, company, status, email, phone, notes, image_data_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, '', '', ?, ?)`,
    )
    .run(
      `client-${randomUUID()}`,
      input.name,
      input.company ?? '',
      input.status ?? 'prospect',
      input.email ?? '',
      input.phone ?? '',
      now,
      now,
    );
  return getClient(Number(result.lastInsertRowid));
}

export function updateClient(id: number, patch: UpdateClientInput): Client {
  const fields: string[] = [];
  const values: unknown[] = [];
  const map: Record<string, unknown> = {
    name: patch.name,
    company: patch.company,
    status: patch.status,
    email: patch.email,
    phone: patch.phone,
    notes: patch.notes,
    image_data_url: patch.imageDataUrl,
    linked_site_ids: patch.linkedSiteIds !== undefined ? JSON.stringify(patch.linkedSiteIds) : undefined,
  };
  for (const [column, value] of Object.entries(map)) {
    if (value !== undefined) {
      fields.push(`${column} = ?`);
      values.push(value);
    }
  }
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  getDb()
    .prepare(`UPDATE clients SET ${fields.join(', ')} WHERE id = ?`)
    .run(...values);
  return getClient(id);
}

export function addClientEvent(input: AddClientEventInput): Client {
  getDb()
    .prepare(
      'INSERT INTO client_events (client_id, title, detail, date) VALUES (?, ?, ?, ?)',
    )
    .run(input.clientId, input.title, input.detail ?? '', new Date().toISOString());
  return getClient(input.clientId);
}

export function removeClient(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM client_events WHERE client_id = ?').run(id);
  db.prepare('DELETE FROM quotes WHERE client_id = ?').run(id);
  db.prepare('DELETE FROM clients WHERE id = ?').run(id);
}

/* -------------------------------- Quotes -------------------------------- */

interface QuoteRow {
  id: number;
  client_id: number;
  title: string;
  detail: string;
  tracker_tier: string;
  price_euro: number;
  status: Quote['status'];
  payment_status: Quote['paymentStatus'];
  created_at: string;
  updated_at: string;
}

function toQuote(row: QuoteRow): Quote {
  return {
    id: row.id,
    clientId: row.client_id,
    title: row.title,
    detail: row.detail,
    trackerTier: row.tracker_tier,
    priceEuro: row.price_euro,
    status: row.status,
    paymentStatus: row.payment_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listQuotes(): Quote[] {
  const rows = getDb().prepare('SELECT * FROM quotes ORDER BY created_at DESC').all() as QuoteRow[];
  return rows.map(toQuote);
}

export function createQuote(input: CreateQuoteInput): Quote {
  const now = new Date().toISOString();
  // sync_id assigned at creation so clientsSync.pushQuote can mirror this
  // quote to amn-api immediately — see clientsSync.ts.
  const result = getDb()
    .prepare(
      `INSERT INTO quotes (sync_id, client_id, title, detail, tracker_tier, price_euro, status, payment_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', 'unpaid', ?, ?)`,
    )
    .run(
      `quote-${randomUUID()}`,
      input.clientId,
      input.title,
      input.detail ?? '',
      input.trackerTier,
      input.priceEuro,
      now,
      now,
    );
  const row = getDb()
    .prepare('SELECT * FROM quotes WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as QuoteRow;
  return toQuote(row);
}

export function removeQuote(id: number): void {
  getDb().prepare('DELETE FROM quotes WHERE id = ?').run(id);
}

export function updateQuote(id: number, patch: UpdateQuoteInput): Quote {
  const fields: string[] = [];
  const values: unknown[] = [];
  const map: Record<string, unknown> = {
    title: patch.title,
    detail: patch.detail,
    tracker_tier: patch.trackerTier,
    price_euro: patch.priceEuro,
    status: patch.status,
    payment_status: patch.paymentStatus,
  };
  for (const [column, value] of Object.entries(map)) {
    if (value !== undefined) {
      fields.push(`${column} = ?`);
      values.push(value);
    }
  }
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  getDb().prepare(`UPDATE quotes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const row = getDb().prepare('SELECT * FROM quotes WHERE id = ?').get(id) as QuoteRow;
  return toQuote(row);
}

/* --------------------------------- Tasks --------------------------------- */

interface SharedTaskRow {
  id: number;
  title: string;
  detail: string;
  assignee_email: string;
  status: SharedTask['status'];
  site_id: string | null;
  client_id: number | null;
  created_at: string;
  updated_at: string;
}

function toSharedTask(row: SharedTaskRow): SharedTask {
  return {
    id: row.id,
    title: row.title,
    detail: row.detail,
    assigneeEmail: row.assignee_email,
    status: row.status,
    siteId: row.site_id,
    clientId: row.client_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listTasks(): SharedTask[] {
  const rows = getDb().prepare('SELECT * FROM shared_tasks ORDER BY created_at DESC').all() as SharedTaskRow[];
  return rows.map(toSharedTask);
}

export function createTask(input: CreateSharedTaskInput): SharedTask {
  const now = new Date().toISOString();
  const result = getDb()
    .prepare(
      `INSERT INTO shared_tasks (title, detail, assignee_email, status, site_id, client_id, created_at, updated_at)
       VALUES (?, ?, ?, 'todo', ?, ?, ?, ?)`,
    )
    .run(input.title, input.detail ?? '', input.assigneeEmail, input.siteId ?? null, input.clientId ?? null, now, now);
  const row = getDb()
    .prepare('SELECT * FROM shared_tasks WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as SharedTaskRow;
  return toSharedTask(row);
}

export function updateTask(id: number, patch: UpdateSharedTaskInput): SharedTask {
  const fields: string[] = [];
  const values: unknown[] = [];
  const map: Record<string, unknown> = {
    title: patch.title,
    detail: patch.detail,
    assignee_email: patch.assigneeEmail,
    status: patch.status,
    site_id: patch.siteId,
    client_id: patch.clientId,
  };
  for (const [column, value] of Object.entries(map)) {
    if (value !== undefined) {
      fields.push(`${column} = ?`);
      values.push(value);
    }
  }
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  getDb().prepare(`UPDATE shared_tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const row = getDb().prepare('SELECT * FROM shared_tasks WHERE id = ?').get(id) as SharedTaskRow;
  return toSharedTask(row);
}

export function removeTask(id: number): void {
  getDb().prepare('DELETE FROM shared_tasks WHERE id = ?').run(id);
}

/* ------------------------------- Decisions ------------------------------- */

interface DecisionRow {
  id: number;
  title: string;
  detail: string;
  author_email: string;
  author_name: string;
  created_at: string;
}

function toDecision(row: DecisionRow): Decision {
  return {
    id: row.id,
    title: row.title,
    detail: row.detail,
    authorEmail: row.author_email,
    authorName: row.author_name,
    createdAt: row.created_at,
  };
}

export function listDecisions(): Decision[] {
  const rows = getDb().prepare('SELECT * FROM decisions ORDER BY created_at DESC').all() as DecisionRow[];
  return rows.map(toDecision);
}

export function removeDecision(id: number): void {
  getDb().prepare('DELETE FROM decisions WHERE id = ?').run(id);
}

export function createDecision(input: CreateDecisionInput): Decision {
  const author = getDb()
    .prepare('SELECT name FROM users WHERE email = ?')
    .get(input.authorEmail) as { name: string } | undefined;
  const now = new Date().toISOString();
  const result = getDb()
    .prepare('INSERT INTO decisions (title, detail, author_email, author_name, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(input.title, input.detail ?? '', input.authorEmail, author?.name ?? input.authorEmail, now);
  const row = getDb()
    .prepare('SELECT * FROM decisions WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as DecisionRow;
  return toDecision(row);
}

/* ---------------------------- Knowledge base ---------------------------- */

interface KnowledgeDocRow {
  id: number;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

function toKnowledgeDoc(row: KnowledgeDocRow): KnowledgeDoc {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listKnowledgeDocs(): KnowledgeDoc[] {
  const rows = getDb().prepare('SELECT * FROM knowledge_docs ORDER BY title ASC').all() as KnowledgeDocRow[];
  return rows.map(toKnowledgeDoc);
}

export function createKnowledgeDoc(input: CreateKnowledgeDocInput): KnowledgeDoc {
  const now = new Date().toISOString();
  const result = getDb()
    .prepare('INSERT INTO knowledge_docs (title, body, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .run(input.title, input.body ?? '', now, now);
  const row = getDb()
    .prepare('SELECT * FROM knowledge_docs WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as KnowledgeDocRow;
  return toKnowledgeDoc(row);
}

export function updateKnowledgeDoc(id: number, patch: UpdateKnowledgeDocInput): KnowledgeDoc {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.title !== undefined) {
    fields.push('title = ?');
    values.push(patch.title);
  }
  if (patch.body !== undefined) {
    fields.push('body = ?');
    values.push(patch.body);
  }
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  getDb().prepare(`UPDATE knowledge_docs SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const row = getDb().prepare('SELECT * FROM knowledge_docs WHERE id = ?').get(id) as KnowledgeDocRow;
  return toKnowledgeDoc(row);
}

export function removeKnowledgeDoc(id: number): void {
  getDb().prepare('DELETE FROM knowledge_docs WHERE id = ?').run(id);
}

/* ---------------------- Recurring checklists (state) --------------------- */

interface ChecklistStateRow {
  item_id: string;
  last_checked_at: string | null;
}

export function getChecklistState(): ChecklistStateEntry[] {
  const rows = getDb().prepare('SELECT * FROM checklist_state').all() as ChecklistStateRow[];
  return rows.map((row) => ({ itemId: row.item_id, lastCheckedAt: row.last_checked_at }));
}

export function checkChecklistItem(itemId: string): ChecklistStateEntry {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO checklist_state (item_id, last_checked_at) VALUES (?, ?)
       ON CONFLICT(item_id) DO UPDATE SET last_checked_at = excluded.last_checked_at`,
    )
    .run(itemId, now);
  return { itemId, lastCheckedAt: now };
}

/* ---------------------------- Learning goals ---------------------------- */

interface LearningGoalRow {
  id: number;
  owner_email: string;
  title: string;
  platform: string;
  progress_pct: number;
  target_date: string | null;
  created_at: string;
  updated_at: string;
}

function toLearningGoal(row: LearningGoalRow): LearningGoal {
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    title: row.title,
    platform: row.platform,
    progressPct: row.progress_pct,
    targetDate: row.target_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listLearningGoals(): LearningGoal[] {
  const rows = getDb().prepare('SELECT * FROM learning_goals ORDER BY created_at ASC').all() as LearningGoalRow[];
  return rows.map(toLearningGoal);
}

export function createLearningGoal(input: CreateLearningGoalInput): LearningGoal {
  const now = new Date().toISOString();
  const result = getDb()
    .prepare(
      `INSERT INTO learning_goals (owner_email, title, platform, progress_pct, target_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(input.ownerEmail, input.title, input.platform ?? '', input.progressPct ?? 0, input.targetDate ?? null, now, now);
  const row = getDb()
    .prepare('SELECT * FROM learning_goals WHERE id = ?')
    .get(Number(result.lastInsertRowid)) as LearningGoalRow;
  return toLearningGoal(row);
}

export function updateLearningGoal(id: number, patch: UpdateLearningGoalInput): LearningGoal {
  const fields: string[] = [];
  const values: unknown[] = [];
  const map: Record<string, unknown> = {
    title: patch.title,
    platform: patch.platform,
    progress_pct: patch.progressPct,
    target_date: patch.targetDate,
  };
  for (const [column, value] of Object.entries(map)) {
    if (value !== undefined) {
      fields.push(`${column} = ?`);
      values.push(value);
    }
  }
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  getDb().prepare(`UPDATE learning_goals SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const row = getDb().prepare('SELECT * FROM learning_goals WHERE id = ?').get(id) as LearningGoalRow;
  return toLearningGoal(row);
}

export function removeLearningGoal(id: number): void {
  getDb().prepare('DELETE FROM learning_goals WHERE id = ?').run(id);
}

/* ------------------------------- Objectives ------------------------------- */

interface ObjectiveRow {
  id: number;
  label: string;
  unit: string;
  target_value: number;
  current_value: number;
  period_label: string;
  updated_at: string;
}

function toObjective(row: ObjectiveRow): Objective {
  return {
    id: row.id,
    label: row.label,
    unit: row.unit,
    targetValue: row.target_value,
    currentValue: row.current_value,
    periodLabel: row.period_label,
    updatedAt: row.updated_at,
  };
}

export function listObjectives(): Objective[] {
  const rows = getDb().prepare('SELECT * FROM objectives ORDER BY id ASC').all() as ObjectiveRow[];
  return rows.map(toObjective);
}

export function updateObjective(id: number, patch: UpdateObjectiveInput): Objective {
  const fields: string[] = [];
  const values: unknown[] = [];
  const map: Record<string, unknown> = {
    label: patch.label,
    unit: patch.unit,
    target_value: patch.targetValue,
    current_value: patch.currentValue,
    period_label: patch.periodLabel,
  };
  for (const [column, value] of Object.entries(map)) {
    if (value !== undefined) {
      fields.push(`${column} = ?`);
      values.push(value);
    }
  }
  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);
  getDb().prepare(`UPDATE objectives SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  const row = getDb().prepare('SELECT * FROM objectives WHERE id = ?').get(id) as ObjectiveRow;
  return toObjective(row);
}
