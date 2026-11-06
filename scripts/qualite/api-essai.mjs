#!/usr/bin/env node
/**
 * UNE amn-api D'ESSAI, EN MÉMOIRE — pour lancer les gardes navigateur ici.
 *
 * Les gardes navigateur (`check:mouvement`, `check:contraste`, `check:focus`,
 * `check:cibles`, `check:signal`, `check:mobile`, `check:coquille`…) veulent
 * une amn-api joignable et un compte qui ouvre une session. Elles ne tournaient
 * donc nulle part. Ce script démarre la VRAIE amn-api (son `createApp`), sur
 * une base SQLite `:memory:` : rien n'est écrit sur disque, rien de réel n'est
 * touché, tout disparaît à l'arrêt.
 *
 * Deux comptes factices, ceux qu'attend `scripts/gardes-navigateur.mjs` :
 *   - cliente : fleuriste.essai@exemple.test, organisation « Fleuriste d'essai » ;
 *   - interne : essai.interne@exemple.test, propriétaire de l'organisation AMN
 *     (créée par l'initialisation de la base).
 *
 * Usage : AMN_API_ROOT=../amn-api node scripts/qualite/api-essai.mjs [port]
 * (port par défaut 4171). Écrit « prête sur <url> » quand elle répond.
 */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { trouverApiRoot } from '../api-root.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = Number(process.argv[2] ?? 4171);
const apiRoot = trouverApiRoot(ROOT);
if (!apiRoot) {
  console.error('amn-api introuvable : renseignez AMN_API_ROOT (voir scripts/api-root.mjs).');
  process.exit(2);
}

// Mode test d'amn-api : ni courrier, ni paiement, ni rondes de la Garde.
process.env.NODE_ENV = 'test';
process.env.OPERATOR_TOKEN ||= 'essai-qualite';
const depuis = (f) => import(pathToFileURL(path.join(apiRoot, f)).href);
const { createApp } = await depuis('src/server.js');
const { createSqliteDb } = await depuis('src/db/sqlite.js');
const { hashPassword } = await depuis('src/lib/password.js');
const { AMN_ORG_ID } = await depuis('src/db/tenancy.js');
const { createHub } = await depuis('src/ws/hub.js');

const COMPTES = [
  { email: 'fleuriste.essai@exemple.test', motDePasse: 'Fleuriste-2026-Essai', org: { name: "Fleuriste d'essai", plan: 'business_standard' } },
  { email: 'essai.interne@exemple.test', motDePasse: 'Interne-2026-Essai', org: AMN_ORG_ID },
];

const db = createSqliteDb(':memory:');
await db.init();
for (const c of COMPTES) {
  if (!c.email.endsWith('@exemple.test')) throw new Error(`compte non factice refusé : ${c.email}`);
  const org = typeof c.org === 'string' ? await db.getOrganization(c.org) : await db.createOrganization(c.org);
  const u = await db.createUser({ orgId: org.id, email: c.email, passwordHash: await hashPassword(c.motDePasse), role: 'owner', status: 'active' });
  await db.addMembership({ userId: u.id, orgId: org.id, role: 'owner' });
}

const app = await createApp({ db });
const serveur = http.createServer(app);
app.locals.hub = createHub(serveur, { db });
await new Promise((r) => serveur.listen(PORT, '127.0.0.1', r));
console.log(`prête sur http://127.0.0.1:${PORT}`);

const fermer = () => serveur.close(() => process.exit(0));
process.on('SIGTERM', fermer);
process.on('SIGINT', fermer);
