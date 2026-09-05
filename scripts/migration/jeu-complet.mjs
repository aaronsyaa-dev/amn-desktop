/**
 * LE JEU DE DONNÉES COMPLET — écrit par la VERSION PRÉCÉDENTE d'amn-api.
 *
 *   node scripts/migration/jeu-complet.mjs --api <dossier amn-api précédent> --db <fichier sqlite> --reference <json>
 *
 * Tout ce qu'une organisation peut posséder, une fois au moins : un logo,
 * des étiquettes, des verrous de consentement, des places, des ajustements
 * de modules, des comptes de chaque rôle, des préférences, un enregistrement
 * vivant ET un enregistrement supprimé dans CHAQUE collection que cette
 * version connaît, des sites, des événements, un incident, un étouffoir, une
 * fenêtre de maintenance, une invitation, un lien de bienvenue, un abonnement
 * push, un scan, des lignes de journal. La liste des collections est lue
 * dans la version précédente elle-même : une collection née depuis est
 * couverte par le prochain passage, jamais oubliée.
 *
 * Le fichier de référence dit ce qui a été écrit, pour que le contrat du
 * poste (contrat-poste.mjs) sache quoi exiger à l'écran.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const arg = (nom, defaut) => { const i = process.argv.indexOf(`--${nom}`); return i > -1 ? process.argv[i + 1] : defaut; };
const API = path.resolve(arg('api'));
const DB = path.resolve(arg('db'));
const REFERENCE = path.resolve(arg('reference'));
const charger = (rel) => import(pathToFileURL(path.join(API, rel)).href);

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
const { createSqliteDb } = await charger('src/db/sqlite.js');
const { AMN_ORG_ID, MODULE_COLLECTIONS = {} } = await charger('src/db/tenancy.js');
const { hashPassword } = await charger('src/lib/password.js');
let ALLOWED;
try {
  ({ ALLOWED } = await charger('src/routes/collections.js'));
} catch {
  ALLOWED = null;
}
if (!ALLOWED) {
  // Avant que la liste ne soit exportée : on la lit dans le fichier, sans l'exécuter.
  const src = fs.readFileSync(path.join(API, 'src/routes/collections.js'), 'utf8');
  const bloc = src.slice(src.indexOf('new Set(['), src.indexOf('])', src.indexOf('new Set([')));
  ALLOWED = new Set([...bloc.matchAll(/'([a-z_-]+)'/g)].map((m) => m[1]));
}

const db = createSqliteDb(DB);
await db.init();
const MDP = 'Migration-2026-Essai';
const hash = await hashPassword(MDP);
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const LOGO = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="18" fill="#c8a24a"/><text x="48" y="60" font-family="sans-serif" font-size="40" text-anchor="middle" fill="#111">MG</text></svg>').toString('base64')}`;
const couverts = [];
const manques = [];
const tenter = async (nom, geste) => { try { const r = await geste(); couverts.push(nom); return r; } catch (err) { manques.push(`${nom} : ${err.message}`); return null; } };

const reference = { motDePasse: MDP, proprietaire: { email: 'aaron.migration@exemple.test' }, organisations: [], collections: {}, preferences: {}, couverts, manques };
const aaron = await db.createUser({ orgId: AMN_ORG_ID, email: reference.proprietaire.email, passwordHash: hash, role: 'owner', status: 'active' });
await db.createUser({ orgId: AMN_ORG_ID, email: 'mohamed.migration@exemple.test', passwordHash: hash, role: 'member', status: 'active' });

// ── Organisation A : tout ce qui se règle.
const A = await db.createOrganization({ name: 'Migration — Le Jardin d’Élise 🌸', plan: 'business_standard' });
await db.updateOrganization(A.id, { logoDataUrl: LOGO, seats: 5, accent: 'amber', language: 'fr', timezone: 'Europe/Paris' });
await tenter('modules ajustés', () => db.updateOrganization(A.id, { modules: ['agenda', 'clients', 'notes', 'tasks', 'invoices', 'orders'], modulesAdded: ['orders'], modulesRemoved: [] }));
await tenter('étiquettes', () => db.setOrgTags(A.id, ['pilote', 'fleuristes', 'à relancer']));
const ownerA = await db.createUser({ orgId: A.id, email: 'elise.migration@exemple.test', passwordHash: hash, role: 'owner', status: 'active' });
await db.createUser({ orgId: A.id, email: 'nadia.migration@exemple.test', passwordHash: hash, role: 'member', status: 'active' });
await db.createUser({ orgId: A.id, email: 'invite.migration@exemple.test', passwordHash: null, role: 'guest', status: 'invited' });
await tenter('verrous de consentement', async () => { await db.setModuleLock(A.id, 'notes', { locked: true, byEmail: ownerA.email }); await db.setModuleLock(A.id, 'invoices', { locked: true, byEmail: ownerA.email }); });
await tenter('préférences', async () => { await db.setUserPref(aaron.id, 'nav-alleges', ['pomodoro', 'routines']); await db.setUserPref(ownerA.id, 'nav-alleges', ['notes']); });
reference.preferences[aaron.email] = { 'nav-alleges': ['pomodoro', 'routines'] };
// Les collections des modules verrouillés ne se lisent pas en session de support — c'est le consentement
// qui marche, pas une perte : le contrat du poste les saute, la base migrée les couvre.
const verrouillees = ['notes', 'invoices'].flatMap((m) => MODULE_COLLECTIONS[m] ?? [m]);
reference.organisations.push({ id: A.id, name: A.name, plan: 'business_standard', seats: 5, tags: ['pilote', 'fleuristes', 'à relancer'], locks: ['notes', 'invoices'], verrouillees, logo: true, logoDataUrl: LOGO, comptes: 3 });

// ── Organisation B : sobre, sans logo, une place.
const B = await db.createOrganization({ name: 'Migration — Boulangerie Martin', plan: 'business_premium' });
await db.createUser({ orgId: B.id, email: 'martin.migration@exemple.test', passwordHash: hash, role: 'owner', status: 'active' });
reference.organisations.push({ id: B.id, name: B.name, plan: 'business_premium', seats: null, tags: [], locks: [], logo: false, logoDataUrl: null, comptes: 1 });

// ── Chaque collection : un enregistrement riche, un supprimé (tombe).
const RICHE = (c, i) => ({
  title: `${c} ${i} — accents éèà, « guillemets », emoji 🍾`,
  status: 'todo',
  amount: 1234.5,
  nested: { deep: { list: [1, 'deux', { trois: true }] } },
  long: 'x'.repeat(20_000),
  createdAt: new Date(Date.now() - i * 3_600_000).toISOString(),
});
for (const org of [A, B]) {
  reference.collections[org.id] = {};
  const noms = org === A ? [...ALLOWED] : [...ALLOWED].slice(0, 3);
  for (const c of noms) {
    const vivants = [];
    for (const i of [1, 2]) {
      const id = `mig-${c}-${i}`;
      const data = RICHE(c, i);
      await db.upsertRecord(org.id, c, id, data);
      vivants.push({ id, data });
    }
    const supprime = `mig-${c}-supprime`;
    await db.upsertRecord(org.id, c, supprime, { title: 'à supprimer' });
    await db.deleteRecord(org.id, c, supprime);
    reference.collections[org.id][c] = { vivants, supprimes: [supprime] };
  }
}

// ── Supervision, journal, accès.
const site = await tenter('sites', () => db.createSite({ orgId: A.id, name: 'jardin-elise.fr', apiKeyHash: sha('cle-site-1') }));
await tenter('sites (second)', () => db.createSite({ orgId: A.id, name: 'boutique.jardin-elise.fr', apiKeyHash: sha('cle-site-2') }));
if (site) {
  await tenter('événements', async () => { for (const i of [1, 2, 3]) await db.insertEvent({ orgId: A.id, siteId: site.id, type: 'request', severity: i === 3 ? 'warning' : 'info', message: `requête ${i}`, payload: { path: `/p${i}`, ip: `10.0.0.${i}` } }); });
  await tenter('incident', () => db.createIncident({ orgId: A.id, siteId: site.id, actor: '10.0.0.3', actorKind: 'ip', severity: 'critical', kinds: ['brute_force'] }));
  await tenter('étouffoir', () => db.createSuppression({ orgId: A.id, siteId: site.id, actor: '10.0.0.9', kind: 'rate_limit', note: 'scanner connu', createdBy: aaron.email, expiresAt: new Date(Date.now() + 86_400_000).toISOString() }));
  await tenter('fenêtre de maintenance', () => db.createMaintenanceWindow({ orgId: A.id, siteId: site.id, reason: 'migration hébergeur', startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 7_200_000).toISOString(), createdBy: aaron.email }));
  await tenter('scan', () => db.createScan({ orgId: A.id, url: 'https://jardin-elise.fr', tier: 'lite' }));
}
await tenter('abonnement push', () => db.savePushSubscription(A.id, ownerA.email, { endpoint: 'https://push.exemple.test/abonnement-1', keys: { p256dh: 'p256dh-essai', auth: 'auth-essai' } }));
await tenter('invitation', () => db.createInvitation({ tokenHash: sha('invitation-1'), userId: ownerA.id, expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString() }));
await tenter('lien de bienvenue', () => db.createWelcomeLink({ id: crypto.randomUUID(), tokenHash: sha('bienvenue-1'), orgId: A.id, userId: ownerA.id, createdByEmail: aaron.email, expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString() }));
await tenter('journal', async () => { for (const [action, detail] of [['enter', null], ['module_opened', 'Commandes — ajouté hors formule'], ['leave', null]]) await db.logOrgAccess({ orgId: A.id, actorId: aaron.id, actorEmail: aaron.email, action, detail }); });

await db.close();
fs.mkdirSync(path.dirname(REFERENCE), { recursive: true });
fs.writeFileSync(REFERENCE, JSON.stringify(reference, null, 2));
console.log(`jeu complet : ${ALLOWED.size} collections × 2 organisations, ${couverts.length} familles couvertes${manques.length ? `, ${manques.length} non écrite(s) : ${manques.join(' ; ')}` : ''}`);
