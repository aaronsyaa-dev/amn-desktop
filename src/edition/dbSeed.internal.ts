import type Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { SEED_ACCOUNTS } from '../main/seed';

/**
 * Amorçage de la base locale — édition INTERNE.
 *
 * Deux choses, et elles vont ensemble : les comptes d'AMN DevSec (Aaron et
 * Mohamed, hachés au premier démarrage) et le jeu de démonstration qui garnit
 * un poste vierge — clients, devis, tâches, décisions, connaissances.
 *
 * Tout cela est sorti de `src/main/db.ts` parce que l'app packagée d'une
 * cliente le contenait mot pour mot : nos adresses, notre mot de passe de
 * départ, nos tarifs, le nom de nos offres. `@edition/dbSeed` résout vers la
 * variante Business, qui ne fait rien — sa base démarre réellement vide, et
 * son seul chemin d'authentification est son propre compte amn-api.
 */

/** Amorce la base au premier démarrage. Idempotent : chaque étape se saute si elle a déjà tourné. */
export function seedDatabase(database: Database.Database): void {
  seedAccounts(database);
  seedProfiles(database);
  seedClients(database);
  seedQuotes(database);
  seedTasks(database);
  seedDecisions(database);
  seedKnowledge(database);
  seedLearningGoals(database);
  seedObjectives(database);
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
