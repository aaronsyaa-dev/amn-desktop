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

    CREATE TABLE IF NOT EXISTS clients (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL,
      company       TEXT NOT NULL DEFAULT '',
      status        TEXT NOT NULL DEFAULT 'prospect',
      email         TEXT NOT NULL DEFAULT '',
      phone         TEXT NOT NULL DEFAULT '',
      notes         TEXT NOT NULL DEFAULT '',
      image_data_url TEXT NOT NULL DEFAULT '',
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
  `);

  seedAccounts(db);
  seedClients(db);
  return db;
}

function seedClients(database: Database.Database): void {
  const count = database
    .prepare('SELECT COUNT(*) AS n FROM clients')
    .get() as { n: number };
  if (count.n > 0) return;

  const now = Date.now();
  const iso = (offsetDays: number) =>
    new Date(now - offsetDays * 86400000).toISOString();

  const insertClient = database.prepare(
    `INSERT INTO clients (name, company, status, email, phone, notes, image_data_url, created_at, updated_at)
     VALUES (@name, @company, @status, @email, @phone, @notes, '', @created_at, @updated_at)`,
  );
  const insertEvent = database.prepare(
    'INSERT INTO client_events (client_id, title, detail, date) VALUES (?, ?, ?, ?)',
  );

  const seed = [
    {
      client: {
        name: 'Mohamed Bensalah',
        company: 'G20 Corvetto',
        status: 'active',
        email: 'contact@g20corvetto.it',
        phone: '+39 02 1234 5678',
        notes:
          'Client historique. Sensible aux temps de réponse en soirée (pic e-commerce). Préfère un point hebdo le lundi.',
        created_at: iso(120),
        updated_at: iso(2),
      },
      events: [
        { title: 'Onboarding', detail: 'Mise en place de la supervision des 2 domaines.', date: iso(120) },
        { title: 'Audit sécurité initial', detail: 'Correction de 4 vulnérabilités, durcissement WAF.', date: iso(96) },
        { title: 'Renouvellement contrat', detail: 'Contrat annuel reconduit.', date: iso(30) },
        { title: 'Incident paiement', detail: 'Latence PSP traitée en 40 min.', date: iso(2) },
      ],
    },
    {
      client: {
        name: 'Sarah Lemaire',
        company: 'Atlas Retail',
        status: 'prospect',
        email: 's.lemaire@atlas-retail.fr',
        phone: '+33 6 12 34 56 78',
        notes: 'Prospect entrant via recommandation. Devis supervision + audit envoyé.',
        created_at: iso(14),
        updated_at: iso(5),
      },
      events: [
        { title: 'Premier contact', detail: 'Appel de découverte, 3 sites à superviser.', date: iso(14) },
        { title: 'Devis envoyé', detail: 'Offre supervision + audit initial.', date: iso(5) },
      ],
    },
  ];

  const tx = database.transaction(() => {
    for (const entry of seed) {
      const result = insertClient.run(entry.client);
      const clientId = Number(result.lastInsertRowid);
      for (const ev of entry.events) {
        insertEvent.run(clientId, ev.title, ev.detail, ev.date);
      }
    }
  });
  tx();
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
