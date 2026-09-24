// S2 — un mois, puis un an d'usage quotidien d'une petite entreprise active (5 personnes).
// Écrit directement dans la base de simulation (jamais la production), puis mesure l'API.
//   SIM_DB=… JOURS=30|365 node scripts/simulations/s2-historique.mjs
const API = process.env.SIM_API ?? 'http://127.0.0.1:8792';
const OP = { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SIM_OPERATEUR ?? 'jeton-sim'}` };
const JOURS = Number(process.env.JOURS ?? 30);
const { createDb } = await import('/home/user/amn-api/src/db/index.js');
const { hashPassword } = await import('/home/user/amn-api/src/lib/password.js');
const db = createDb({ databaseUrl: null, sqlitePath: process.env.SIM_DB });
await db.init?.();
const tag = `${JOURS}j-${Date.now().toString(36)}`;
const org = (await (await fetch(`${API}/v1/admin/organizations`, { method: 'POST', headers: OP, body: JSON.stringify({ name: `Atelier Simulé ${JOURS} jours`, plan: 'business_premium', seats: 5, ownerEmail: `s2.0.${tag}@sim.test` }) })).json()).organization;
const hash = await hashPassword('motdepasse-sim');
const equipe = [];
for (let i = 1; i < 5; i++) { const e = `s2.${i}.${tag}@sim.test`; await db.createUser({ orgId: org.id, email: e, passwordHash: hash, role: i === 1 ? 'admin' : 'member', status: 'active' }); equipe.push(e); }
const patron = `s2.0.${tag}@sim.test`;
await db.updateUser((await db.findUserByEmail(patron)).id, { passwordHash: hash, status: 'active' });
equipe.unshift(patron);
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const poisson = (m) => { let k = 0, p = 1; const L = Math.exp(-m); do { k++; p *= rnd(); } while (p > L); return k - 1; };
const jour = (d) => new Date(Date.now() - d * 86_400_000).toISOString().slice(0, 10);
const instant = (d, h = 9) => new Date(Date.now() - d * 86_400_000 + h * 3_600_000).toISOString();
const PRENOMS = ['Claire', 'Mehdi', 'Sofia', 'Jules', 'Inès', 'Hugo', 'Lina', 'Karim', 'Emma', 'Noé', 'Yasmine', 'Paul'];
const NOMS = ['Martin', 'Bernard', 'Dubois', 'Laurent', 'Moreau', 'Garcia', 'Roux', 'Fontaine', 'Chevalier', 'Mercier'];
const compte = {};
const poser = async (coll, id, data) => { await db.upsertRecord(org.id, coll, id, data); compte[coll] = (compte[coll] ?? 0) + 1; };
const debut = Date.now();
let nClient = 0, nFac = 0;
for (let d = JOURS; d >= 0; d--) {
  for (let k = 0; k < poisson(1.1); k++) { nClient++; await poser('clients', String(1000 + nClient), { name: `${pick(PRENOMS)} ${pick(NOMS)}`, company: rnd() < 0.5 ? `${pick(NOMS)} & fils` : '', status: rnd() < 0.8 ? 'active' : 'prospect', email: `c${nClient}@client.test`, phone: '06 00 00 00 00', notes: '', imageDataUrl: '', linkedSiteIds: [], createdAt: instant(d), events: [] }); }
  for (let k = 0; k < poisson(6); k++) { nFac++; const lignes = Array.from({ length: 1 + Math.floor(rnd() * 4) }, (_, n) => ({ id: `l${n}`, label: pick(['Main-d’œuvre', 'Déplacement', 'Fournitures', 'Pose', 'Réglage']), quantity: 1 + Math.floor(rnd() * 5), unitPriceCents: 2000 + Math.floor(rnd() * 20000), vatRate: 20 })); const payee = d > 20 ? rnd() < 0.92 : rnd() < 0.4; await poser('invoices', `f-${nFac}`, { number: `2026-${String(nFac).padStart(5, '0')}`, clientId: 1000 + 1 + Math.floor(rnd() * Math.max(1, nClient)), billTo: { name: 'Client', company: '', email: '', address: '', vatNumber: '' }, issuedAt: jour(d), dueAt: jour(d - 30), lines: lignes, status: payee ? 'paid' : 'sent', paidAt: payee ? jour(Math.max(0, d - 12)) : null, paymentMethod: 'virement', cancelReason: '', notes: '', quoteId: null }); }
  for (let k = 0; k < poisson(3); k++) await poser('quotes', `q-${d}-${k}`, { number: `D-${d}-${k}`, clientId: 1001, issuedAt: jour(d), validUntil: jour(d - 30), lines: [{ id: 'l1', label: 'Prestation', quantity: 1, unitPriceCents: 50000, vatRate: 20 }], status: pick(['sent', 'accepted', 'refused', 'sent']), createdAt: instant(d) });
  for (let k = 0; k < poisson(14); k++) await poser('tasks', `t-${d}-${k}`, { title: pick(['Rappeler', 'Commander', 'Préparer', 'Relancer', 'Vérifier']) + ' ' + pick(NOMS), detail: '', assigneeEmail: pick(equipe), status: d > 3 ? (rnd() < 0.85 ? 'done' : 'todo') : pick(['todo', 'doing', 'done']), siteId: null, clientId: null, priority: pick(['low', 'normal', 'normal', 'high']), createdAt: instant(d) });
  for (let k = 0; k < poisson(8); k++) await poser('appointments', `a-${d}-${k}`, { title: `RDV ${pick(NOMS)}`, startAt: `${jour(d)}T${String(8 + Math.floor(rnd() * 10)).padStart(2, '0')}:${pick(['00', '30'])}`, durationMin: pick([30, 60, 90]), clientId: 0, clientName: pick(NOMS), location: '', notes: '', reminderMin: 30, status: d > 0 ? 'done' : 'scheduled', createdAt: instant(d + 3) });
  for (let k = 0; k < poisson(2); k++) await poser('notes', `n-${d}-${k}`, { title: `Note du ${jour(d)}`, body: 'Compte rendu. '.repeat(20 + Math.floor(rnd() * 60)), authorEmail: pick(equipe), pinned: false, createdAt: instant(d) });
  for (let k = 0; k < poisson(7); k++) await poser('expenses', `e-${d}-${k}`, { amountCents: 500 + Math.floor(rnd() * 30000), category: pick(['Carburant', 'Fournitures', 'Repas', 'Outillage']), spentAt: jour(d), note: '', photoDataUrl: '', createdAt: instant(d) });
  for (let k = 0; k < poisson(55); k++) await poser('groupMessages', `gm-${d}-${k}`, { groupId: pick(['g-equipe', 'g-chantiers', 'g-bureau']), body: pick(['OK', 'Je m’en occupe', 'Le client a rappelé, il faut repasser demain matin avant 10 h.', 'Photo du chantier envoyée', 'Qui a la clé du local ?']), authorEmail: pick(equipe), createdAt: instant(d, 8 + rnd() * 10) });
  for (let k = 0; k < poisson(22); k++) await poser('dms', `dm-${d}-${k}`, { from: pick(equipe), to: pick(equipe), body: 'Tu peux regarder ça ?', createdAt: instant(d, 9 + rnd() * 8) });
  for (let k = 0; k < poisson(3); k++) await poser('interventions', `i-${d}-${k}`, { title: `Intervention ${pick(NOMS)}`, clientName: pick(NOMS), address: '', at: instant(d), volets: { avant: { photo: '', note: 'État trouvé.' }, pendant: { photo: '', note: '' }, apres: { photo: '', note: 'Fait.' } }, consommations: [], closedAt: d > 1 ? instant(d, 17) : '', reportedAt: '', createdAt: instant(d) });
  for (let k = 0; k < poisson(16); k++) await poser('timeEntries', `te-${d}-${k}`, { startedAt: instant(d, 8 + k * 0.5), endedAt: instant(d, 8.5 + k * 0.5), label: 'Travail', authorEmail: pick(equipe), createdAt: instant(d) });
  if (rnd() < 0.16) await poser('projects', `p-${d}`, { title: `Chantier ${pick(NOMS)}`, status: d > 40 ? 'termine' : 'en-cours', structure: '', clientId: 1001, priority: 'normal', nextAction: '', deadline: jour(d - 45), link: '', notes: '', extra: {}, createdAt: instant(d) });
}
const ecriture = Date.now() - debut;
const total = Object.values(compte).reduce((a, b) => a + b, 0);
// Mesures API, au nom du patron
let login = null;
for (let essai = 0; essai < 5 && !login?.token; essai++) {
  try { login = await (await fetch(`${API}/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: patron, password: 'motdepasse-sim' }) })).json(); }
  catch (e) { console.error(`connexion, essai ${essai + 1} : ${e.cause?.code ?? e.message}`); await new Promise((r) => setTimeout(r, 2000)); }
}
const H = { Authorization: `Bearer ${login.token}` };
const noms = Object.keys(compte).join(',');
const mesurer = async (chemin) => { const t = Date.now(); const r = await fetch(`${API}${chemin}`, { headers: H }); const txt = await r.text(); return { ms: Date.now() - t, octets: txt.length, statut: r.status }; };
const bulk = [];
for (let i = 0; i < 5; i++) bulk.push(await mesurer(`/v1/collections/_bulk?names=${noms}`));
const diff = await mesurer(`/v1/collections/_bulk?names=${noms}&since=${encodeURIComponent(new Date(Date.now() - 60_000).toISOString())}`);
const parColl = {};
for (const c of Object.keys(compte)) parColl[c] = (await mesurer(`/v1/collections/${c}`)).octets;
const { statSync } = await import('node:fs');
console.log(JSON.stringify({
  date: new Date().toISOString(), jours: JOURS, personnes: 5, organisation: org.name, patron, enregistrements: total, parCollection: compte,
  ecritureDuJeuMs: ecriture,
  syncInitiale: { ms: bulk.map((b) => b.ms).sort((a, b) => a - b)[2], octets: bulk[0].octets, Mo: Math.round((bulk[0].octets / 1e6) * 10) / 10 },
  syncDifferentielle1min: diff,
  octetsParCollection: parColl,
  baseSqliteMo: Math.round(statSync(process.env.SIM_DB).size / 1e5) / 10,
}, null, 1));
await db.close?.();
process.exit(0);
