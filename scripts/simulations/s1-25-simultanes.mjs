// S1 — 25 personnes sur la même organisation, en même temps.
import WebSocket from '/home/user/amn-api/node_modules/ws/index.js';
process.env.SQLITE_PATH ??= '';
const API = 'http://127.0.0.1:8792', WSURL = 'ws://127.0.0.1:8792';
const OP = { 'Content-Type': 'application/json', Authorization: 'Bearer jeton-sim' };
const DUREE = Number(process.env.DUREE_S ?? 90) * 1000;
const N = Number(process.env.N ?? 25);
const { createDb } = await import('/home/user/amn-api/src/db/index.js');
const { hashPassword } = await import('/home/user/amn-api/src/lib/password.js');
const db = createDb({ databaseUrl: null, sqlitePath: process.env.SIM_DB });
await db.init?.();
const org = (await (await fetch(`${API}/v1/admin/organizations`, { method: 'POST', headers: OP, body: JSON.stringify({ name: `Simu ${N} simultanés ${Date.now()}`, plan: 'business_premium', seats: 25, ownerEmail: `s1.0.${Date.now()}@sim.test` }) })).json()).organization;
if (!org) throw new Error('organisation non créée');
const hash = await hashPassword('motdepasse-sim');
const emails = [];
for (let i = 0; i < N; i++) {
  const email = `s1.p${i}.${org.id.slice(0, 6)}@sim.test`;
  await db.createUser({ orgId: org.id, email, passwordHash: hash, role: i === 0 ? 'owner' : i < 3 ? 'admin' : 'member', status: 'active' });
  emails.push(email);
}
const navEmail = `s1.nav.${org.id.slice(0, 6)}@sim.test`;
await db.createUser({ orgId: org.id, email: navEmail, passwordHash: hash, role: 'member', status: 'active' });
(await import('node:fs')).writeFileSync(process.env.NAV_FICHIER ?? '/dev/null', navEmail);
const lat = { login: [], bulk: [], put: [], putPartage: [], lecture: [] };
const erreurs = new Map();
const err = (k) => erreurs.set(k, (erreurs.get(k) ?? 0) + 1);
const diffusion = [];
let trames = 0;
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]); };
const COLL = ['tasks', 'clients', 'notes', 'appointments', 'projects', 'invoices', 'quotes', 'expenses', 'dms', 'groups', 'groupMessages', 'announcements', 'leaves', 'meetings', 'okrs', 'timeEntries', 'stockItems', 'resources', 'resourceBookings', 'profiles'];
const t0 = Date.now();
async function poste(i) {
  const d = Date.now();
  const r = await fetch(`${API}/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emails[i], password: 'motdepasse-sim' }) });
  lat.login.push(Date.now() - d);
  if (r.status !== 200) { err(`login ${r.status}`); return; }
  const { token } = await r.json();
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const ws = new WebSocket(`${WSURL}/v1/stream?token=${encodeURIComponent(token)}&user=${encodeURIComponent(emails[i])}`);
  ws.on('message', (raw) => { trames++; try { const f = JSON.parse(String(raw)); const s = f?.record?.data?.envoyeA; if (f.type === 'record' && s && f.record?.data?.par !== i) diffusion.push(Date.now() - s); } catch { /* */ } });
  ws.on('error', () => err('ws'));
  ws.on('close', (c) => { if (c !== 1000 && c !== 1005) err(`ws fermé ${c}`); });
  const ouvert = await Promise.race([new Promise((res) => ws.once('open', () => res(true))), new Promise((res) => setTimeout(() => res(false), 8000))]);
  if (!ouvert) err('ws jamais ouverte');
  let d2 = Date.now();
  const b = await fetch(`${API}/v1/collections/_bulk?names=${COLL.join(',')}`, { headers: H });
  lat.bulk.push(Date.now() - d2);
  if (b.status !== 200) err(`bulk ${b.status}`);
  let n = 0;
  while (Date.now() - t0 < DUREE) {
    const tirage = Math.random();
    d2 = Date.now();
    let res;
    if (tirage < 0.45) res = await fetch(`${API}/v1/collections/tasks/t-${i}-${n++}`, { method: 'PUT', headers: H, body: JSON.stringify({ data: { title: `Tâche ${i}.${n}`, status: 'todo', assigneeEmail: emails[i], envoyeA: Date.now(), par: i } }) }).then((x) => { lat.put.push(Date.now() - d2); return x; });
    else if (tirage < 0.65) res = await fetch(`${API}/v1/collections/tasks/tableau-partage`, { method: 'PUT', headers: H, body: JSON.stringify({ data: { title: `Tableau — dernier : ${i}`, status: 'doing', compteur: n, envoyeA: Date.now(), par: i } }) }).then((x) => { lat.putPartage.push(Date.now() - d2); return x; });
    else if (tirage < 0.85) res = await fetch(`${API}/v1/collections/groupMessages/m-${i}-${n++}`, { method: 'PUT', headers: H, body: JSON.stringify({ data: { groupId: 'g-equipe', body: `Message de ${i}`, authorEmail: emails[i], envoyeA: Date.now(), par: i } }) }).then((x) => { lat.put.push(Date.now() - d2); return x; });
    else res = await fetch(`${API}/v1/collections/tasks?since=${encodeURIComponent(new Date(Date.now() - 30_000).toISOString())}`, { headers: H }).then((x) => { lat.lecture.push(Date.now() - d2); return x; });
    if (res.status >= 400) err(`${res.status}`);
    await new Promise((z) => setTimeout(z, 800 + Math.random() * 2200));
  }
  await new Promise((z) => setTimeout(z, 1500));
  ws.close();
  const fin = await (await fetch(`${API}/v1/collections/tasks`, { headers: H })).json();
  return fin.records.find((x) => x.id === 'tableau-partage')?.data?.title ?? null;
}
const vus = await Promise.all(emails.map((_, i) => poste(i)));
const total = lat.put.length + lat.putPartage.length + lat.lecture.length;
const coh = new Set(vus.filter(Boolean));
console.log(JSON.stringify({
  date: new Date().toISOString(), personnes: N, dureeS: DUREE / 1000,
  operations: total, debitParSeconde: Math.round((total / (DUREE / 1000)) * 10) / 10,
  connexion: { p50: pct(lat.login, 50), p95: pct(lat.login, 95), max: pct(lat.login, 100) },
  syncInitiale20Collections: { p50: pct(lat.bulk, 50), p95: pct(lat.bulk, 95), max: pct(lat.bulk, 100) },
  ecriture: { n: lat.put.length, p50: pct(lat.put, 50), p95: pct(lat.put, 95), p99: pct(lat.put, 99), max: pct(lat.put, 100) },
  ecritureMemeFiche: { n: lat.putPartage.length, p50: pct(lat.putPartage, 50), p95: pct(lat.putPartage, 95), max: pct(lat.putPartage, 100) },
  lectureDifferentielle: { p50: pct(lat.lecture, 50), p95: pct(lat.lecture, 95) },
  diffusionEnDirect: { recues: diffusion.length, p50: pct(diffusion, 50), p95: pct(diffusion, 95), max: pct(diffusion, 100) },
  tramesWsTotal: trames,
  erreurs: Object.fromEntries(erreurs),
  coherenceFicheCommune: coh.size === 1 ? 'les 25 lisent la même valeur finale' : `DIVERGENCE : ${coh.size} valeurs`,
}, null, 1));
await db.close?.();
process.exit(0);
