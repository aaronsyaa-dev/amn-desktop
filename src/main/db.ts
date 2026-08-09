import path from 'node:path';
import { app } from 'electron';
import Database from 'better-sqlite3';
import { seedDatabase } from '@edition/dbSeed';

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
      created_at   TEXT NOT NULL,
      attachments  TEXT NOT NULL DEFAULT '[]',
      reply_to_id  INTEGER,
      pinned       INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS message_reactions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id   INTEGER NOT NULL,
      emoji        TEXT NOT NULL,
      author_email TEXT NOT NULL,
      UNIQUE(message_id, emoji, author_email)
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      email          TEXT PRIMARY KEY,
      name           TEXT NOT NULL DEFAULT '',
      photo_data_url TEXT NOT NULL DEFAULT '',
      presence_text  TEXT NOT NULL DEFAULT '',
      updated_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notification_prefs (
      email         TEXT PRIMARY KEY,
      site_offline  INTEGER NOT NULL DEFAULT 1,
      critical_alert INTEGER NOT NULL DEFAULT 1,
      mention       INTEGER NOT NULL DEFAULT 1,
      task_assigned INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS clients (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_id       TEXT NOT NULL DEFAULT '',
      name          TEXT NOT NULL,
      company       TEXT NOT NULL DEFAULT '',
      status        TEXT NOT NULL DEFAULT 'prospect',
      email         TEXT NOT NULL DEFAULT '',
      phone         TEXT NOT NULL DEFAULT '',
      notes         TEXT NOT NULL DEFAULT '',
      image_data_url TEXT NOT NULL DEFAULT '',
      linked_site_ids TEXT NOT NULL DEFAULT '[]',
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS client_events (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id  INTEGER NOT NULL,
      title      TEXT NOT NULL,
      detail     TEXT NOT NULL DEFAULT '',
      date       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      sync_id        TEXT NOT NULL DEFAULT '',
      client_id      INTEGER NOT NULL,
      title          TEXT NOT NULL,
      detail         TEXT NOT NULL DEFAULT '',
      tracker_tier   TEXT NOT NULL,
      price_euro     REAL NOT NULL DEFAULT 0,
      status         TEXT NOT NULL DEFAULT 'draft',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shared_tasks (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      title         TEXT NOT NULL,
      detail        TEXT NOT NULL DEFAULT '',
      assignee_email TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'todo',
      site_id       TEXT,
      client_id     INTEGER,
      created_at    TEXT NOT NULL,
      updated_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS decisions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      title        TEXT NOT NULL,
      detail       TEXT NOT NULL DEFAULT '',
      author_email TEXT NOT NULL,
      author_name  TEXT NOT NULL,
      created_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_docs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      title      TEXT NOT NULL,
      body       TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS checklist_state (
      item_id         TEXT PRIMARY KEY,
      last_checked_at TEXT
    );

    CREATE TABLE IF NOT EXISTS learning_goals (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_email  TEXT NOT NULL,
      title        TEXT NOT NULL,
      platform     TEXT NOT NULL DEFAULT '',
      progress_pct REAL NOT NULL DEFAULT 0,
      target_date  TEXT,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS objectives (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      label         TEXT NOT NULL,
      unit          TEXT NOT NULL DEFAULT '',
      target_value  REAL NOT NULL DEFAULT 0,
      current_value REAL NOT NULL DEFAULT 0,
      period_label  TEXT NOT NULL DEFAULT '',
      updated_at    TEXT NOT NULL
    );
  `);

  runMigrations(db);

  // Comptes et jeu de démonstration d'AMN DevSec. Dans l'édition Business,
  // cet appel ne fait rien : une installation cliente ne doit contenir ni nos
  // adresses, ni l'empreinte d'un mot de passe partagé, ni des fiches qui ne
  // sont pas les siennes.
  seedDatabase(db);
  return db;
}

/**
 * `CREATE TABLE IF NOT EXISTS` never alters an *existing* table, so columns
 * added to a table after its first release are missing on any DB created by an
 * earlier version. This adds them idempotently. Without it, upgrading users hit
 * "no such column: attachments" the moment they send a chat message, which is
 * exactly the messaging breakage reported from the field.
 */
function runMigrations(database: Database.Database): void {
  const ensureColumn = (table: string, column: string, definition: string) => {
    const cols = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === column)) {
      database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };

  // messages: attachments / reply_to_id / pinned were added after the first
  // release of the messages table.
  ensureColumn('messages', 'attachments', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn('messages', 'reply_to_id', 'INTEGER');
  ensureColumn('messages', 'pinned', 'INTEGER NOT NULL DEFAULT 0');

  // clients: linked_site_ids added for the health score.
  ensureColumn('clients', 'linked_site_ids', "TEXT NOT NULL DEFAULT '[]'");

  // clients/quotes: sync_id added so this per-machine data can be mirrored to
  // amn-api for durability (see clientsSync.ts) without disturbing the
  // existing local autoincrement ids that client_events/quotes depend on.
  ensureColumn('clients', 'sync_id', "TEXT NOT NULL DEFAULT ''");
  ensureColumn('quotes', 'sync_id', "TEXT NOT NULL DEFAULT ''");
}

