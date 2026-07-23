import bcrypt from 'bcryptjs';
import type {
  AddClientEventInput,
  AuthResult,
  Client,
  ClientEvent,
  CreateClientInput,
  Message,
  SendMessageInput,
  UpdateClientInput,
  User,
} from '../shared/api';
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
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    authorEmail: row.author_email,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
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

export function listMessages(): Message[] {
  const rows = getDb()
    .prepare('SELECT * FROM messages ORDER BY id ASC')
    .all() as MessageRow[];
  return rows.map(toMessage);
}

export function sendMessage(input: SendMessageInput): Message {
  const author = getDb()
    .prepare('SELECT name FROM users WHERE email = ?')
    .get(input.authorEmail) as { name: string } | undefined;

  const createdAt = new Date().toISOString();
  const result = getDb()
    .prepare(
      'INSERT INTO messages (author_email, author_name, body, created_at) VALUES (?, ?, ?, ?)',
    )
    .run(input.authorEmail, author?.name ?? input.authorEmail, input.body, createdAt);

  return {
    id: Number(result.lastInsertRowid),
    authorEmail: input.authorEmail,
    authorName: author?.name ?? input.authorEmail,
    body: input.body,
    createdAt,
  };
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
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    status: row.status,
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    imageDataUrl: row.image_data_url,
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
  const result = getDb()
    .prepare(
      `INSERT INTO clients (name, company, status, email, phone, notes, image_data_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '', '', ?, ?)`,
    )
    .run(
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
