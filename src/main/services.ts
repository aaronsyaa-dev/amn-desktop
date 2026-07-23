import bcrypt from 'bcryptjs';
import type {
  AuthResult,
  Message,
  SendMessageInput,
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
