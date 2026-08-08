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

  seedAccounts(db);
  seedProfiles(db);
  seedClients(db);
  seedQuotes(db);
  seedTasks(db);
  seedDecisions(db);
  seedKnowledge(db);
  seedLearningGoals(db);
  seedObjectives(db);
  return db;
}

function seedProfiles(database: Database.Database): void {
  const now = new Date().toISOString();
  const insert = database.prepare(
    `INSERT OR IGNORE INTO user_profiles (email, name, photo_data_url, presence_text, updated_at)
     VALUES (?, ?, '', '', ?)`,
  );
  for (const account of SEED_ACCOUNTS) {
    insert.run(account.email, account.name, now);
  }
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

function seedQuotes(database: Database.Database): void {
  const count = database.prepare('SELECT COUNT(*) AS n FROM quotes').get() as { n: number };
  if (count.n > 0) return;
  const now = Date.now();
  const iso = (offsetDays: number) => new Date(now - offsetDays * 86400000).toISOString();
  database
    .prepare(
      `INSERT INTO quotes (client_id, title, detail, tracker_tier, price_euro, status, payment_status, created_at, updated_at)
       VALUES (1, 'Supervision annuelle + audit initial', 'Mise en place du tracker Sentinel sur 2 domaines, audit sécurité initial, suivi mensuel.', 'sentinel', 2400, 'accepted', 'paid', ?, ?)`,
    )
    .run(iso(96), iso(90));
  database
    .prepare(
      `INSERT INTO quotes (client_id, title, detail, tracker_tier, price_euro, status, payment_status, created_at, updated_at)
       VALUES (2, 'Supervision + audit initial', 'Déploiement Sentinel sur 3 sites, audit initial, rapport de synthèse.', 'sentinel', 1800, 'sent', 'unpaid', ?, ?)`,
    )
    .run(iso(5), iso(5));
}

function seedTasks(database: Database.Database): void {
  const count = database.prepare('SELECT COUNT(*) AS n FROM shared_tasks').get() as { n: number };
  if (count.n > 0) return;
  const now = Date.now();
  const iso = (offsetDays: number) => new Date(now - offsetDays * 86400000).toISOString();
  const rows = [
    { title: 'Relancer Atlas Retail sur le devis envoyé', detail: '', assignee: 'aaron@amn-devsec.com', status: 'todo', clientId: 2 },
    { title: 'Vérifier le certificat SSL du site principal', detail: 'Expire dans 3 semaines.', assignee: 'mohamed@amn-devsec.com', status: 'doing', clientId: null },
    { title: 'Rédiger le rapport mensuel G20 Corvetto', detail: '', assignee: 'aaron@amn-devsec.com', status: 'done', clientId: 1 },
  ];
  const insert = database.prepare(
    `INSERT INTO shared_tasks (title, detail, assignee_email, status, site_id, client_id, created_at, updated_at)
     VALUES (@title, @detail, @assignee, @status, NULL, @clientId, @created, @updated)`,
  );
  rows.forEach((r, i) => {
    insert.run({
      title: r.title,
      detail: r.detail,
      assignee: r.assignee,
      status: r.status,
      clientId: r.clientId,
      created: iso(10 - i),
      updated: iso(10 - i),
    });
  });
}

function seedDecisions(database: Database.Database): void {
  const count = database.prepare('SELECT COUNT(*) AS n FROM decisions').get() as { n: number };
  if (count.n > 0) return;
  const now = Date.now();
  const iso = (offsetDays: number) => new Date(now - offsetDays * 86400000).toISOString();
  database
    .prepare(
      `INSERT INTO decisions (title, detail, author_email, author_name, created_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      'Adoption de Supabase (plan gratuit) pour amn-api',
      'Évite un coût récurrent tant que le volume reste faible ; migration vers un plan payant possible sans changement de code (client pg standard).',
      'aaron@amn-devsec.com',
      'Aaron',
      iso(20),
    );
  database
    .prepare(
      `INSERT INTO decisions (title, detail, author_email, author_name, created_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      'Tarif de base Sentinel fixé à 1800–2400 €/an selon nombre de sites',
      'Aligné sur le temps de mise en place + suivi mensuel estimé.',
      'mohamed@amn-devsec.com',
      'Mohamed',
      iso(7),
    );
}

function seedKnowledge(database: Database.Database): void {
  const count = database.prepare('SELECT COUNT(*) AS n FROM knowledge_docs').get() as { n: number };
  if (count.n > 0) return;
  const now = new Date().toISOString();
  database
    .prepare(
      `INSERT INTO knowledge_docs (title, body, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    )
    .run(
      'Installation du tracker (procédure)',
      '1. npm install @amn-devsec/security-monitor\n2. Enregistrer le site depuis AMN Desktop (onglet Sites) pour obtenir la clé API\n3. Ajouter AMN_API_URL et AMN_API_KEY dans le .env du site client\n4. const tracker = createTracker(); app.use(tracker.middleware()); tracker.start();\n5. Vérifier dans AMN Desktop que le site passe "en ligne" après le premier heartbeat.',
      now,
      now,
    );
  database
    .prepare(
      `INSERT INTO knowledge_docs (title, body, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    )
    .run(
      'Modèle — email de relance devis',
      'Objet : Suite à notre devis du [date]\n\nBonjour [prénom],\n\nJe reviens vers vous concernant le devis envoyé le [date] pour [mission]. Restez-vous disponible cette semaine pour un point rapide ?\n\nBien à vous,\n[signature]',
      now,
      now,
    );
}

function seedLearningGoals(database: Database.Database): void {
  const count = database.prepare('SELECT COUNT(*) AS n FROM learning_goals').get() as { n: number };
  if (count.n > 0) return;
  const now = new Date().toISOString();
  const insert = database.prepare(
    `INSERT INTO learning_goals (owner_email, title, platform, progress_pct, target_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  insert.run('aaron@amn-devsec.com', 'Certification OSCP', 'TryHackMe', 35, null, now, now);
  insert.run('mohamed@amn-devsec.com', 'AWS Certified Security', 'A Cloud Guru', 60, null, now, now);
}

function seedObjectives(database: Database.Database): void {
  const count = database.prepare('SELECT COUNT(*) AS n FROM objectives').get() as { n: number };
  if (count.n > 0) return;
  const now = new Date().toISOString();
  const period = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const insert = database.prepare(
    `INSERT INTO objectives (label, unit, target_value, current_value, period_label, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  insert.run('Chiffre d’affaires visé', '€', 6000, 2400, period, now);
  insert.run('Nouveaux clients visés', 'clients', 3, 1, period, now);
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
