import path from 'node:path';
import { app } from 'electron';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { SEED_ACCOUNTS } from './seed';

/**
 * Local persistence for the app. A single SQLite file lives in Electron's
 * per-user data directory, so accounts and messages survive across sessions.
 *
 * When the central API arrives, this module stays the local cache/offline store
 * and gains a sync layer; the schema below is intentionally close to what a
 * server would expose (stable ids, ISO timestamps, author denormalised on
 * messages so the feed renders without a join).
 */

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialised — call initDatabase() first.');
  }
  return db;
}

export function initDatabase(): Database.Database {
  if (db) return db;

  const file = path.join(app.getPath('userData'), 'amn.db');
  db = new Database(file);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      author_email TEXT NOT NULL,
      author_name  TEXT NOT NULL,
      body         TEXT NOT NULL,
      created_at   TEXT NOT NULL
    );
  `);

  seedAccounts(db);
  return db;
}

function seedAccounts(database: Database.Database): void {
  const count = database
    .prepare('SELECT COUNT(*) AS n FROM users')
    .get() as { n: number };
  if (count.n > 0) return;

  const insert = database.prepare(
    'INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)',
  );
  const now = new Date().toISOString();
  const tx = database.transaction(() => {
    for (const account of SEED_ACCOUNTS) {
      const hash = bcrypt.hashSync(account.password, 10);
      insert.run(account.email, account.name, hash, now);
    }
  });
  tx();
}
