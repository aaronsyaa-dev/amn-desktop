// S4, palier 1 000 000 : un million d'organisations et de comptes réels dans une base neuve
// (sans historique : le volume de fiches s'extrapole du palier 1 000), puis ce qu'Harun et la Garde vivent.
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';
import Database from '/home/user/amn-api/node_modules/better-sqlite3/lib/index.js';
const DB = process.env.SIM_DB; const PORT = 8794; const API = `http://127.0.0.1:${PORT}`; const N = Number(process.env.N ?? 1_000_000);
for (const f of [DB, `${DB}-wal`, `${DB}-shm`]) if (fs.existsSync(f)) fs.unlinkSync(f);
const { createDb } = await import('/home/user/amn-api/src/db/index.js');
const { hashPassword } = await import('/home/user/amn-api/src/lib/password.js');
const { AMN_ORG_ID } = await import('/home/user/amn-api/src/db/tenancy.js');
const d0 = createDb({ databaseUrl: null, sqlitePath: DB }); await d0.init?.();
const hash = await hashPassword('motdepasse-sim');
await d0.createUser({ orgId: AMN_ORG_ID, email: 'harun@amn.sim', passwordHash: hash, role: 'owner', status: 'active' });
await d0.close?.();
const raw = new Database(DB);
raw.pragma('journal_mode = WAL');
const t = Date.now();
const insOrg = raw.prepare("INSERT INTO organizations (id, name, plan, status, created_at) VALUES (?, ?, ?, 'active', ?)");
const insUser = raw.prepare("INSERT INTO users (id, org_id, email, password_hash, role, status, invited_at, joined_at) VALUES (?, ?, ?, ?, 'owner', 'active', ?, ?)");
const lot = raw.transaction((debut, fin) => { for (let i = debut; i < fin; i++) { const id = crypto.randomUUID(); const at = new Date(Date.now() - (i % 1000) * 86400000).toISOString(); insOrg.run(id, `cliente ${i}`, i % 5 === 0 ? 'business_premium' : 'business_standard', at); insUser.run(crypto.randomUUID(), id, `m${i}@sim.test`, hash, at, at); } });
for (let i = 0; i < N; i += 50_000) lot(i, Math.min(N, i + 50_000));
const fabrication = Date.now() - t;
raw.close();
const log = fs.openSync(`${DB}.log`, 'w');
const t1 = Date.now();
const serveur = spawn('node', ['--max-old-space-size=4096', 'src/server.js'], { cwd: '/home/user/amn-api', env: { ...process.env, PORT: String(PORT), SQLITE_PATH: DB, OPERATOR_TOKEN: 'jeton-s4' }, stdio: ['ignore', log, log] });
let demarrage = null;
for (let i = 0; i < 240; i++) { try { if ((await fetch(`${API}/v1/health`)).ok) { demarrage = Date.now() - t1; break; } } catch { /* */ } await new Promise((r) => setTimeout(r, 500)); }
const OP = { Authorization: 'Bearer jeton-s4' };
const mesure = async (chemin, ms = 120000) => { const t2 = Date.now(); try { const r = await fetch(`${API}${chemin}`, { headers: OP, signal: AbortSignal.timeout(ms) }); const txt = await r.text(); return { ms: Date.now() - t2, Mo: Math.round(txt.length / 1e5) / 10, statut: r.status }; } catch (e) { return { ms: Date.now() - t2, erreur: e.name === 'TimeoutError' ? `pas de réponse en ${ms / 1000} s` : (e.cause?.code ?? e.message) }; } };
const harun = {};
for (const [k, c] of [['pageDe50', '/v1/admin/organizations/page?limit=50'], ['pageTriActivite', '/v1/admin/organizations/page?limit=50&sort=activity'], ['recherche', '/v1/admin/organizations/page?limit=50&q=cliente%20999'], ['resume', '/v1/admin/organizations/summary'], ['salleGarde', '/v1/garde/salle']]) harun[k] = await mesure(c);
const rondes = {};
for (const k of ['comptes.places', 'registre.hygiene', 'produit.integrite', 'clientes.rapports', 'clientes.accueil']) { const t3 = Date.now(); const r = await fetch(`${API}/v1/garde/agents/${k}/ronde`, { method: 'POST', headers: { ...OP, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(300000) }).then((x) => x.json()).catch((e) => ({ erreur: String(e).slice(0, 80) })); rondes[k] = { ms: Date.now() - t3, resume: (r.ronde?.resume ?? r.erreur ?? '').slice(0, 100) }; }
const t4 = Date.now(); const l = await fetch(`${API}/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'm777777@sim.test', password: 'motdepasse-sim' }) }).catch(() => null);
const connexionUneCliente = { ms: Date.now() - t4, statut: l?.status };
let rss = null; try { rss = Math.round(Number(execSync(`ps -o rss= -p ${serveur.pid}`).toString().trim()) / 1024); } catch { /* */ }
// En dernier : la liste complète, que le Parc interne appelle encore.
harun.listeComplete = await mesure('/v1/admin/organizations');
const vivantApresListe = await fetch(`${API}/v1/health`).then((x) => x.ok).catch(() => false);
let rssFin = null; const vivant = await fetch(`${API}/v1/health`).then((x) => x.ok).catch(() => false);
serveur.kill();
console.log(JSON.stringify({ date: new Date().toISOString(), clientes: N, fabricationMs: fabrication, baseMo: Math.round(fs.statSync(DB).size / 1e5) / 10, demarrageServeurMs: demarrage, harun, rondesGarde: rondes, connexionUneCliente, serveur: { rssMo: rss, vivantApresListeComplete: vivantApresListe, vivantALaFin: vivant } }, null, 1));
process.exit(0);
