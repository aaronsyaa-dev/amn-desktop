// S4 — N clientes aux profils variés, Harun présent. Base neuve, serveur dédié.
//   N=10|100|1000 SIM_DB=… PORT=… node scripts/simulations/s4-echelle.mjs
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import WebSocket from '/home/user/amn-api/node_modules/ws/index.js';
const N = Number(process.env.N ?? 10);
const DB = process.env.SIM_DB;
const PORT = Number(process.env.PORT ?? 8793);
const API = `http://127.0.0.1:${PORT}`;
for (const f of [DB, `${DB}-wal`, `${DB}-shm`]) if (fs.existsSync(f)) fs.unlinkSync(f);
const { createDb } = await import('/home/user/amn-api/src/db/index.js');
const { hashPassword } = await import('/home/user/amn-api/src/lib/password.js');
const { AMN_ORG_ID } = await import('/home/user/amn-api/src/db/tenancy.js');
const db = createDb({ databaseUrl: null, sqlitePath: DB });
await db.init?.();
let graine = N; const h = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(h() * a.length)];
const METIERS = ['boutique', 'services', 'evenementiel', 'artisan', 'collectif', 'etudes', 'agence', 'cabinet', 'restaurant', 'association'];
const hash = await hashPassword('motdepasse-sim');
await db.createUser({ orgId: AMN_ORG_ID, email: 'harun@amn.sim', passwordHash: hash, role: 'owner', status: 'active' });
const profils = { dormante: 0, normale: 0, tresActive: 0 }; let fiches = 0; const actives = [];
const tSeed = Date.now();
for (let i = 0; i < N; i++) {
  const r = h();
  const activite = r < 0.4 ? 'dormante' : r < 0.85 ? 'normale' : 'tresActive';
  profils[activite]++;
  const taille = h() < 0.4 ? 1 : h() < 0.67 ? 2 + Math.floor(h() * 4) : 6 + Math.floor(h() * 20);
  const plan = taille >= 5 || h() < 0.2 ? 'business_premium' : 'business_standard';
  const org = await db.createOrganization({ name: `${pick(METIERS)} ${i}`, plan });
  const modules = h() < 0.3 ? ['clients', 'invoices', 'agenda', 'tasks', 'notes'] : h() < 0.7 ? ['clients', 'invoices', 'agenda', 'tasks', 'notes', 'expenses', 'projects', 'quotes', 'reminders', 'time', 'stock', 'interventions'] : null;
  await db.updateOrganization(org.id, { seats: Math.min(25, [1, 2, 5, 10, 25].find((s) => s >= taille) ?? 25), ...(modules ? { modules } : {}) }).catch(() => undefined);
  const emails = [];
  for (let u = 0; u < taille; u++) { const e = `c${i}.u${u}@sim.test`; await db.createUser({ orgId: org.id, email: e, passwordHash: hash, role: u === 0 ? 'owner' : 'member', status: 'active' }); emails.push(e); }
  const volume = activite === 'dormante' ? 5 : activite === 'normale' ? 150 : 900;
  for (let k = 0; k < volume; k++) {
    const c = pick(['tasks', 'tasks', 'invoices', 'clients', 'appointments', 'notes', 'groupMessages', 'groupMessages', 'expenses']);
    await db.upsertRecord(org.id, c, `${c}-${k}`, { title: `Fiche ${k}`, status: 'todo', body: 'x'.repeat(40 + Math.floor(h() * 200)), createdAt: new Date(Date.now() - h() * 3e10).toISOString() });
    fiches++;
  }
  if (activite !== 'dormante') actives.push({ org, emails, activite });
}
const seedMs = Date.now() - tSeed;
await db.close?.();
const log = fs.openSync(`${DB}.log`, 'w');
const serveur = spawn('node', ['src/server.js'], { cwd: '/home/user/amn-api', env: { ...process.env, PORT: String(PORT), SQLITE_PATH: DB, OPERATOR_TOKEN: 'jeton-s4', TRACKER_MONITORS: 'on' }, stdio: ['ignore', log, log] });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`${API}/v1/health`)).ok) break; } catch { /* */ } await new Promise((r) => setTimeout(r, 500)); }
const OP = { Authorization: 'Bearer jeton-s4' };
const mesure = async (chemin, H = OP) => { const t = Date.now(); try { const r = await fetch(`${API}${chemin}`, { headers: H }); const txt = await r.text(); return { ms: Date.now() - t, Ko: Math.round(txt.length / 1024), statut: r.status }; } catch (e) { return { ms: Date.now() - t, erreur: e.cause?.code ?? e.message }; } };
const orgs = (await (await fetch(`${API}/v1/admin/organizations/page?limit=5`, { headers: OP })).json()).organizations ?? [];
const uneOrg = actives[0]?.org.id ?? orgs[0]?.id;
const harun = {
  listeComplete: await mesure('/v1/admin/organizations'),
  pageDe50: await mesure('/v1/admin/organizations/page?limit=50'),
  pageTriActivite: await mesure('/v1/admin/organizations/page?limit=50&sort=activity'),
  resume: await mesure('/v1/admin/organizations/summary'),
  dossier: await mesure(`/v1/admin/organizations/${uneOrg}/dossier`),
  pouls: await mesure(`/v1/admin/organizations/${uneOrg}/pulse`),
  salleGarde: await mesure('/v1/garde/salle'),
  pileGarde: await mesure('/v1/garde/pile'),
  demandes: await mesure('/v1/admin/support-requests'),
  journalAcces: await mesure('/v1/admin/access-log'),
};
// Les rondes de la Garde qui parcourent les organisations, déclenchées à la main
const rondes = {};
for (const k of ['comptes.places', 'registre.hygiene', 'produit.integrite', 'clientes.rapports', 'clientes.accueil', 'securite.campagnes', 'taches.emission']) {
  const t = Date.now();
  const r = await fetch(`${API}/v1/garde/agents/${k}/ronde`, { method: 'POST', headers: { ...OP, 'Content-Type': 'application/json' }, body: '{}' }).then((x) => x.json()).catch((e) => ({ erreur: String(e) }));
  rondes[k] = { ms: Date.now() - t, resume: (r.ronde?.resume ?? r.erreur ?? r.error ?? '').slice(0, 90) };
}
// Trafic : les clientes actives connectées (jusqu'à 200 postes), une écriture toutes les 5 s pendant 60 s
const connectees = actives.slice(0, 200);
const lat = []; let err = 0; let trames = 0; const t0 = Date.now();
await Promise.all(connectees.map(async ({ emails }, i) => {
  const l = await fetch(`${API}/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emails[0], password: 'motdepasse-sim' }) });
  if (!l.ok) { err++; return; }
  const { token } = await l.json();
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/v1/stream?token=${encodeURIComponent(token)}`);
  ws.on('message', () => trames++); ws.on('error', () => err++);
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const s = Date.now(); const b = await fetch(`${API}/v1/collections/_bulk?names=tasks,invoices,clients,appointments,notes,groupMessages,expenses`, { headers: H }); if (!b.ok) err++; await b.text(); lat.push(Date.now() - s);
  let n = 0;
  while (Date.now() - t0 < 60_000) {
    await new Promise((z) => setTimeout(z, 3000 + Math.random() * 4000));
    const d = Date.now();
    const r = await fetch(`${API}/v1/collections/tasks/s4-${i}-${n++}`, { method: 'PUT', headers: H, body: JSON.stringify({ data: { title: 'écrit en charge', status: 'todo' } }) }).catch(() => null);
    if (!r?.ok) err++; lat.push(Date.now() - d);
  }
  ws.close();
}));
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : 0; };
const rssMo = Math.round(Number(execSync(`ps -o rss= -p ${serveur.pid}`).toString().trim()) / 1024);
const sante = await (await fetch(`${API}/v1/health`)).json();
serveur.kill();
console.log(JSON.stringify({
  date: new Date().toISOString(), clientes: N, profils, comptesTotal: 1 + actives.reduce((n, a) => n + a.emails.length, 0), fiches, fabricationMs: seedMs,
  baseMo: Math.round(fs.statSync(DB).size / 1e5) / 10, harun, rondesGarde: rondes,
  trafic: { postesConnectes: connectees.length, operations: lat.length, p50: pct(lat, 50), p95: pct(lat, 95), p99: pct(lat, 99), max: pct(lat, 100), erreurs: err, trames },
  serveur: { rssMo, gardeEnRetard: sante.garde?.enRetard ?? null },
}, null, 1));
process.exit(0);
