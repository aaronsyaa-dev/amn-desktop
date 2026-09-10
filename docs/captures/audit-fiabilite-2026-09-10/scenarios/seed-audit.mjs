#!/usr/bin/env node
// Audit de fiabilité : un second compte INTERNE (AMN DevSec) pour jouer Mohamed
// face à demo.interne@exemple.test, sur une base sqlite de test dédiée.
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
const { createSqliteDb } = await import('/home/user/amn-api/src/db/sqlite.js');
const { hashPassword } = await import('/home/user/amn-api/src/lib/password.js');
const { AMN_ORG_ID } = await import('/home/user/amn-api/src/db/tenancy.js');

const db = createSqliteDb(process.env.SQLITE_PATH ?? '/tmp/e2e/audit.db');
await db.init();
const email = 'mohamed.audit@exemple.test';
const existant = await db.findUserByEmail(email).catch(() => null);
if (!existant) {
  await db.createUser({ orgId: AMN_ORG_ID, email, passwordHash: await hashPassword('Mohamed-2026-Audit'), role: 'member', status: 'active' });
  console.log('créé :', email);
} else console.log('déjà là :', email);
// Une tâche existante, partagée, pour le scénario d'écrasement (édition concurrente).
await db.upsertRecord(AMN_ORG_ID, 'tasks', 'audit-tache-conflit', {
  title: 'Tâche de conflit — version initiale', detail: '', status: 'todo', priority: 'normal',
  assigneeEmail: 'demo.interne@exemple.test', siteId: null, clientId: null, createdAt: new Date().toISOString(),
});
await db.close();
console.log('ok');
