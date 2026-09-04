/* Casser exprès (Bloc 7), au navigateur, sur les vrais builds : entrées absurdes rendues, rechargement pendant l'écriture, deux postes sur la même note, téléphone avec trois mille tâches, API tuée puis revenue. */
const { chromium } = await import('playwright-core');
const { spawn } = await import('node:child_process');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || 'docs/captures/supervision-2026-09-04';
const API = 'http://127.0.0.1:4171';
const WEB = 'http://127.0.0.1:4180';
const COMPTE = { email: 'fleuriste.essai@exemple.test', password: 'Fleuriste-2026-Essai' };
const VOLUME = Number(process.env.VOLUME || 3000);

// L'API est sous la main de la sonde : elle la lance, la tue exprès, la relance.
const lancerApi = () => {
  const enfant = spawn('node', ['src/server.js'], {
    cwd: '/home/user/amn-api',
    env: { ...process.env, PORT: '4171', SQLITE_PATH: '/tmp/e2e/amn.db', OPERATOR_TOKEN: 'test-operator-token', APP_PUBLIC_URL: 'http://127.0.0.1:4181', APP_BUSINESS_PUBLIC_URL: WEB },
    detached: true,
    stdio: 'ignore',
  });
  enfant.unref();
  return enfant;
};
const attendreApi = async () => {
  for (let i = 0; i < 80; i += 1) {
    try { if ((await fetch(`${API}/v1/health`)).ok) return; } catch { /* pas encore */ }
    await a(500);
  }
  throw new Error('API absente');
};
let api = lancerApi();
await attendreApi();

let jetonCourant = null;
const jeton = async () => {
  if (!jetonCourant) jetonCourant = (await (await fetch(`${API}/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(COMPTE) })).json()).token;
  return jetonCourant;
};
const appel = async (chemin, init = {}) => {
  const r = await fetch(`${API}${chemin}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await jeton()}`, ...(init.headers ?? {}) } });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const enregistrement = async (collection, id) => (await appel(`/v1/collections/${collection}`)).body?.records?.find((r) => r.id === id) ?? null;

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const erreurs = [];
const console_ = [];
const ouvrir = async (viewport, mobile = false) => {
  const p = await (await nav.newContext({ viewport, ...(mobile ? { isMobile: true, hasTouch: true } : {}) })).newPage();
  p.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
  p.on('console', (m) => { if (m.type() === 'error') console_.push(m.text().slice(0, 120)); });
  await p.goto(`${WEB}/`); await a(1800);
  await p.locator('input[name="email"]').fill(COMPTE.email); await p.locator('input[name="password"]').fill(COMPTE.password);
  await p.locator('button[type="submit"]').first().click();
  for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
  await a(2500); await p.mouse.click(...(mobile ? [195, 420] : [720, 860])); await a(600);
  return p;
};
const texte = (p) => p.evaluate(() => document.body.innerText);
const indicateur = (p) => p.evaluate(() => [...document.querySelectorAll('span[title]')].map((s) => s.textContent.trim()).find((s) => /Synchronis|Reconnexion|Hors ligne|Connexion/i.test(s)) ?? '(aucun)');
const H = Date.now().toString(36).slice(-4);

const p = await ouvrir({ width: 1440, height: 900 });

// 1. Entrées absurdes, tapées dans l'écran : HTML actif, emoji, titre géant, corps géant.
const TITRE = `<img src=x onerror="document.title='CASSÉ'"> <b>gras</b> 🌸 ${H} ` + 'x'.repeat(3000);
const CORPS = `<script>document.title="CASSÉ2"</script> 🍾 « guillemets » ’apostrophe\n` + 'y'.repeat(20000);
await p.goto(`${WEB}/#/notes`); await a(1500);
await p.locator('button:has-text("Nouvelle note")').first().click(); await a(600);
const menu = p.locator('button:has-text("Note d’équipe")'); if (await menu.count()) { await menu.click(); await a(500); }
const titre = p.locator('input[placeholder*="itre"]').first();
await titre.fill(TITRE); await titre.press('Tab'); await a(400);
await p.locator('textarea').first().fill(CORPS); await a(2000);
const liste = await appel('/v1/collections/notes');
const note = liste.body.records.find((r) => (r.data.title ?? '').includes(`🌸 ${H}`));
console.log('1. absurdes : note enregistrée ?', Boolean(note), '| titre intact (3 000+ car.) ?', note?.data.title === TITRE, `(${note?.data.title?.length ?? 0} car.)`, '| corps intact (20 000+) ?', note?.data.body === CORPS,
  '| HTML rendu en texte ?', (await p.evaluate(() => document.querySelector('img[src="x"]') === null && !document.title.startsWith('CASSÉ'))), '| titre de page :', await p.title());
await p.screenshot({ path: `${OUT}/16-casser-absurdes.png` });

// 2. Rechargement pendant l'écriture : la phrase tapée 100 ms avant le rechargement survit-elle ?
const PHRASE = `Phrase tapée juste avant le rechargement ${H}`;
const zone = p.locator('textarea').first();
await zone.fill(`${CORPS}\n${PHRASE}`); await a(100);
await p.reload(); await a(2500); await p.mouse.click(720, 860); await a(800);
const apresRechargement = note ? await enregistrement('notes', note.id) : null;
console.log('2. rechargement pendant la frappe : phrase sur le serveur ?', Boolean(apresRechargement?.data.body?.includes(PHRASE)));

// 3. Deux postes sur la même note, en même temps.
const q = await ouvrir({ width: 1440, height: 900 });
const ouvrirNote = async (page) => {
  await page.goto(`${WEB}/#/notes`); await a(1500);
  await page.locator('input[placeholder="Rechercher…"]').fill(`🌸 ${H}`); await a(600);
  await page.locator('button, li').filter({ hasText: `🌸 ${H}` }).first().click(); await a(800);
};
await ouvrirNote(p); await ouvrirNote(q);
await Promise.all([
  p.locator('textarea').first().fill(`Version du poste A ${H}`),
  q.locator('textarea').first().fill(`Version du poste B ${H}`),
]);
await a(3500);
const serveur = note ? await enregistrement('notes', note.id) : null;
const [vueA, vueB] = await Promise.all([p.locator('textarea').first().inputValue(), q.locator('textarea').first().inputValue()]);
const doublons = (await appel('/v1/collections/notes')).body.records.filter((r) => (r.data.title ?? '').includes(`🌸 ${H}`)).length;
console.log('3. deux postes : serveur =', JSON.stringify(serveur?.data.body?.slice(0, 24)), '| poste A voit', JSON.stringify(vueA.slice(0, 24)), '| poste B voit', JSON.stringify(vueB.slice(0, 24)), '| un seul enregistrement ?', doublons === 1, '| les deux postes lisent la même chose ?', vueA === vueB && vueA === serveur?.data.body);
await q.context().close();

// 4. Téléphone avec trois mille tâches. Le serveur freine les écritures à
// six cents par minute et par personne (routes/collections.js) : trois mille
// tâches par l'API, c'est cinq minutes de 429. On les pose donc directement
// en base, API arrêtée, comme le ferait une reprise de données.
const { createSqliteDb } = await import('/home/user/amn-api/src/db/sqlite.js');
const orgId = (await appel('/v1/auth/me')).body.org.id;
const enBase = async (geste) => {
  process.kill(-api.pid, 'SIGKILL'); await a(800);
  const db = createSqliteDb('/tmp/e2e/amn.db'); await db.init();
  await geste(db); await db.close();
  api = lancerApi(); await attendreApi(); jetonCourant = null;
};
const t0 = performance.now();
await enBase(async (db) => { for (let i = 0; i < VOLUME; i += 1) await db.upsertRecord(orgId, 'tasks', `casser-${H}-${i}`, { title: `Tâche de volume ${i} ${H}`, status: i % 3 ? 'todo' : 'done', createdAt: new Date(Date.now() - i * 60000).toISOString() }); });
console.log(`4. volume : ${VOLUME} tâches posées en base en ${((performance.now() - t0) / 1000).toFixed(1)} s (API relancée)`);
const m = await ouvrir({ width: 390, height: 844 }, true);
const t1 = performance.now();
await m.goto(`${WEB}/#/tasks`);
let lignes = 0;
for (let i = 0; i < 120; i += 1) { lignes = await m.evaluate((h) => (document.querySelector('main')?.innerText.match(new RegExp(`Tâche de volume \\d+ ${h}`, 'g')) ?? []).length, H); if (lignes >= 20) break; await a(250); }
const t2 = performance.now();
await a(1500);
const noeuds = await m.evaluate(() => document.querySelectorAll('main *').length);
const cartes = await m.evaluate((h) => (document.querySelector('main')?.innerText.match(new RegExp(`Tâche de volume \\d+ ${h}`, 'g')) ?? []).length, H);
const suite = m.locator('button:has-text("suivantes")').first();
const t3 = performance.now();
await m.evaluate(() => { const el = document.querySelector('main'); if (el) el.scrollTop = el.scrollHeight; window.scrollTo(0, document.body.scrollHeight); }); await a(300);
const t4 = performance.now();
const t5 = performance.now();
await m.locator('button:has-text("Nouvelle tâche")').first().tap(); await a(100);
let formulaire = false;
for (let i = 0; i < 40; i += 1) { formulaire = (await m.locator('button:has-text("Créer la tâche")').count()) > 0; if (formulaire) break; await a(100); }
const t6 = performance.now();
await m.locator('button[aria-label="Fermer"]').first().tap().catch(() => {}); await a(400);
const compteurs = await m.evaluate(() => document.querySelector('main')?.innerText.match(/\d{3,4}/g)?.slice(0, 3) ?? []);
console.log(`   téléphone : ${lignes} cartes visibles au bout de ${((t2 - t1) / 1000).toFixed(1)} s | ${cartes} cartes posées, ${noeuds} nœuds DOM dans main | bouton « suivantes » ? ${(await suite.count()) > 0} | compteurs lus : ${compteurs.join(' / ')} | défilement ${(t4 - t3).toFixed(0)} ms | formulaire « Nouvelle tâche » en ${(t6 - t5).toFixed(0)} ms (${formulaire ? 'ouvert' : 'JAMAIS OUVERT'})`);
if (await suite.count()) { await suite.evaluate((el) => el.scrollIntoView({ block: 'center' })); await a(200); const t7 = performance.now(); await suite.tap(); await a(300); const apres = await m.evaluate((h) => (document.querySelector('main')?.innerText.match(new RegExp(`Tâche de volume \\d+ ${h}`, 'g')) ?? []).length, H); console.log(`   « suivantes » : ${cartes} → ${apres} cartes en ${(performance.now() - t7).toFixed(0)} ms`); }
await m.screenshot({ path: `${OUT}/17-casser-telephone-volume.png` });
await m.context().close();
await enBase(async (db) => { for (let i = 0; i < VOLUME; i += 1) await db.deleteRecord(orgId, 'tasks', `casser-${H}-${i}`); });
console.log('   volume retiré :', (await appel('/v1/collections/tasks')).body.records.filter((r) => r.id.startsWith(`casser-${H}`) && !r.deleted).length === 0);

// 5. API tuée en pleine session, puis relancée.
await p.goto(`${WEB}/#/notes`); await a(1500);
await p.locator('input[placeholder="Rechercher…"]').fill(''); await a(400);
console.log('5. avant la panne, indicateur :', await indicateur(p));
process.kill(-api.pid, 'SIGKILL');
await a(4000);
const pendant = await indicateur(p);
await p.locator('button:has-text("Nouvelle note")').first().click(); await a(600);
if (await menu.count()) { await menu.click(); await a(500); }
const t7 = p.locator('input[placeholder*="itre"]').first();
await t7.fill(`Écrite pendant la panne ${H}`); await t7.press('Tab'); await a(400);
await p.locator('textarea').first().fill('Le serveur est à terre, je continue.'); await a(1500);
console.log('   pendant la panne : indicateur :', pendant, '| la note apparaît dans la liste ?', (await p.locator('main').innerText()).includes(`Écrite pendant la panne ${H}`), '| erreurs de page :', erreurs.length);
await p.screenshot({ path: `${OUT}/18-casser-api-tuee.png` });
api = lancerApi(); await attendreApi();
let revenue = false;
for (let i = 0; i < 40 && !revenue; i += 1) { await a(1000); revenue = (await appel('/v1/collections/notes')).body?.records?.some((r) => r.data.title === `Écrite pendant la panne ${H}`) ?? false; }
console.log('   après relance : indicateur :', await indicateur(p), '| la note écrite pendant la panne est arrivée sur le serveur ?', revenue);
await p.screenshot({ path: `${OUT}/19-casser-api-revenue.png` });

// Ménage : les notes de la sonde.
for (const r of (await appel('/v1/collections/notes')).body.records.filter((r) => (r.data.title ?? '').includes(H))) await appel(`/v1/collections/notes/${r.id}`, { method: 'DELETE' });
console.log('erreurs de page (exceptions) sur toute la sonde :', erreurs.length, erreurs.slice(0, 3), '| messages console d’erreur (réseau pendant la panne compris) :', console_.length);
await nav.close();
