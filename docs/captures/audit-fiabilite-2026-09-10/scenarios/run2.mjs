/**
 * Audit de fiabilité — RUN 2 : les scénarios que le run 1 n'a pas prouvés
 * proprement (appel réellement établi, coupure lue sur les trames WebSocket,
 * édition concurrente scopée au bon message, redémarrage serveur, message privé).
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { execSync, spawn } from 'node:child_process';

const WEB = 'http://127.0.0.1:4280';
const API = 'http://127.0.0.1:4172';
const OUT = '/home/user/amn-desktop/docs/captures/audit-fiabilite-2026-09-10';
const A = { email: 'demo.interne@exemple.test', mdp: 'Demo-2026-Interne' };
const B = { email: 'mohamed.audit@exemple.test', mdp: 'Mohamed-2026-Audit' };

const journal = [];
const t0 = Date.now();
const log = (scene, msg, extra = {}) => {
  const e = { t: +((Date.now() - t0) / 1000).toFixed(2), scene, msg, ...extra };
  journal.push(e);
  console.log(`[${e.t.toFixed(2)}s] ${scene} — ${msg}`, Object.keys(extra).length ? JSON.stringify(extra) : '');
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (path) => (await fetch(`${API}${path}`, { headers: { Authorization: 'Bearer audit-jeton' } })).json();
const serverMessages = async () => (await api('/v1/collections/messages')).records.filter((r) => !r.deleted);
const attendre = async (fn, timeoutMs, pas = 150) => { const fin = Date.now() + timeoutMs; while (Date.now() < fin) { let v = null; try { v = await fn(); } catch { v = null; } if (v) return v; await sleep(pas); } return null; };

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});

async function ouvrir(compte, tag) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['notifications', 'microphone'] });
  await context.addInitScript(() => {
    window.__notifs = [];
    const push = (title, opts) => window.__notifs.push({ at: Date.now(), title, body: opts?.body ?? '', tag: opts?.tag ?? '' });
    class FakeNotification { constructor(title, opts) { push(title, opts); } static get permission() { return 'granted'; } static requestPermission() { return Promise.resolve('granted'); } }
    window.Notification = FakeNotification;
    if (window.ServiceWorkerRegistration) window.ServiceWorkerRegistration.prototype.showNotification = function (title, opts) { push(title, opts); return Promise.resolve(); };
    // L'état RÉEL de la connexion WebRTC, lu à la source.
    window.__rtc = [];
    const Orig = window.RTCPeerConnection;
    function Hooked(...args) {
      const pc = new Orig(...args);
      pc.addEventListener('connectionstatechange', () => window.__rtc.push({ at: Date.now(), state: pc.connectionState }));
      pc.addEventListener('iceconnectionstatechange', () => window.__rtc.push({ at: Date.now(), ice: pc.iceConnectionState }));
      return pc;
    }
    Hooked.prototype = Orig.prototype;
    window.RTCPeerConnection = Hooked;
    try { window.localStorage.setItem('amn.welcome.lastShown', new Date().toISOString().slice(0, 10)); } catch {}
  });
  const page = await context.newPage();
  const ws = { frames: [], sent: [] };
  page.on('websocket', (sock) => {
    sock.on('framereceived', (f) => { try { const p = JSON.parse(f.payload); ws.frames.push({ at: Date.now(), ...p }); } catch {} });
    sock.on('framesent', (f) => { try { const p = JSON.parse(f.payload); ws.sent.push({ at: Date.now(), ...p }); } catch {} });
    sock.on('close', () => ws.frames.push({ at: Date.now(), type: '__close' }));
  });
  page.on('pageerror', (e) => log(tag, 'ERREUR PAGE', { message: e.message }));
  await page.goto(WEB, { waitUntil: 'networkidle' });
  await page.locator('input[name="email"]').fill(compte.email);
  await page.locator('input[name="password"]').fill(compte.mdp);
  await page.locator('button:has-text("Se connecter")').click();
  await page.waitForFunction(() => !document.querySelector('input[name="password"]'), null, { timeout: 20000 });
  await page.keyboard.press('Escape').catch(() => {});
  return { context, page, ws, compte, tag };
}
const fermerCartes = async (page) => { for (let i = 0; i < 2; i += 1) { const c = page.locator('[aria-label="Première ouverture"] button').first(); if (await c.isVisible().catch(() => false)) { await c.click().catch(() => {}); await sleep(250); } else break; } };
const aller = async (u, hash) => { await u.page.goto(`${WEB}/#${hash}`, { waitUntil: 'networkidle' }); await sleep(400); await fermerCartes(u.page); };
const nbHello = (u) => u.ws.frames.filter((f) => f.type === 'hello').length;
const nbClose = (u) => u.ws.frames.filter((f) => f.type === '__close').length;
const dernierHello = (u) => u.ws.frames.filter((f) => f.type === 'hello').at(-1)?.at ?? null;
const shot = (u, nom) => u.page.screenshot({ path: `${OUT}/${nom}.png` });
const file = (u) => u.page.evaluate(() => { try { return (JSON.parse(localStorage.getItem('amn.sync.__envoi') || '[]')).map((e) => `${e.geste}:${e.collection}/${e.id} (essais ${e.essais})`); } catch { return []; } });
const bulle = (u, corps) => u.page.locator(`xpath=//*[.//button[@aria-label="Réagir"]][contains(., ${JSON.stringify(corps)})]`).last();
const boutonAppel = (u) => u.page.locator('button[aria-label^="Appeler"]').first();

/* ─── S0 ─────────────────────────────────────────────────────────────────── */
const a = await ouvrir(A, 'A');
const b = await ouvrir(B, 'B');
await attendre(async () => nbHello(a) > 0 && nbHello(b) > 0, 15000);
log('S0', 'deux sessions, WebSocket saluée des deux côtés', { A: nbHello(a) > 0, B: nbHello(b) > 0 });

/* ─── S3 : appel — établissement RÉEL lu sur RTCPeerConnection ────────────── */
await aller(a, '/appels');
await aller(b, '/appels');
await attendre(async () => (await boutonAppel(a).isEnabled()) ? true : null, 15000);
const tAppel = Date.now();
await boutonAppel(a).click();
await attendre(async () => (await b.page.locator('[aria-label^="Appel entrant de"]').isVisible()) ? true : null, 15000);
const tSonne = Date.now();
await b.page.locator('button[aria-label="Accepter l’appel"]').click();
const connA = await attendre(() => a.page.evaluate(() => window.__rtc.find((s) => s.state === 'connected')?.at ?? null), 25000);
const connB = await attendre(() => b.page.evaluate(() => window.__rtc.find((s) => s.state === 'connected')?.at ?? null), 25000);
const dureeA = await attendre(() => a.page.evaluate(() => { const m = document.body.innerText.match(/\n(\d:\d\d)\n/); return m ? m[1] : null; }), 8000);
log('S3', 'appel A → B : sonnerie, acceptation, média établi', {
  sonne_apres_ms: tSonne - tAppel,
  rtc_connected_A_ms: connA ? connA - tSonne : 'JAMAIS',
  rtc_connected_B_ms: connB ? connB - tSonne : 'JAMAIS',
  compteur_duree_A: dureeA,
  etats_rtc_A: await a.page.evaluate(() => window.__rtc.map((s) => s.state ?? `ice:${s.ice}`)),
  notif_OS_B: await b.page.evaluate(() => window.__notifs.filter((n) => n.title === 'Appel entrant').length),
});
await shot(a, 'S3-run2-appel-etabli-A');
await shot(b, 'S3-run2-appel-etabli-B');
await a.page.locator('button[aria-label="Raccrocher"]').click();
const finB = await attendre(async () => (await b.page.locator('button[aria-label="Raccrocher"]').count()) === 0 ? true : null, 8000);
log('S3', 'A raccroche', { B_revenu_au_repos: Boolean(finB), etats_rtc_B_fin: await b.page.evaluate(() => window.__rtc.slice(-2).map((s) => s.state ?? `ice:${s.ice}`)) });

/* ─── S2b : notification pendant qu’on REGARDE le fil ──────────────────────── */
await aller(b, '/team');
await aller(a, '/team');
await sleep(800);
const n0 = await b.page.evaluate(() => window.__notifs.length);
const corpsS2b = `AUDIT S2b sous les yeux ${Date.now()}`;
await a.page.locator('textarea[placeholder^="Écrire un message"]').fill(corpsS2b);
await a.page.locator('button[aria-label="Envoyer"]').click();
await attendre(async () => (await b.page.getByText(corpsS2b).count()) > 0 ? true : null, 8000);
await sleep(1500);
log('S2b', 'B a le fil OUVERT et visible quand le message arrive', { notification_OS_quand_meme: (await b.page.evaluate(() => window.__notifs.length)) - n0 });

/* ─── S4 : coupure réseau côté B, lue sur les trames ──────────────────────── */
const closeAvant = nbClose(b);
const helloAvant = nbHello(b);
await b.context.setOffline(true);
const tOff = Date.now();
const ferme = await attendre(async () => nbClose(b) > closeAvant ? Date.now() : null, 20000);
log('S4', 'B coupé : la socket temps réel tombe', { socket_fermee_apres_ms: ferme ? ferme - tOff : 'PAS VU EN 20 s' });
const corpsS4 = `AUDIT S4 hors ligne ${Date.now()}`;
await b.page.locator('textarea[placeholder^="Écrire un message"]').fill(corpsS4);
await b.page.locator('button[aria-label="Envoyer"]').click();
await sleep(1500);
log('S4', 'écriture hors ligne', { file_attente: await file(b), banniere: await b.page.evaluate(() => (document.body.innerText.match(/\d+ modifications? en attente d’envoi[^\n]*/) || ['ABSENTE'])[0]), sur_serveur: (await serverMessages()).some((r) => r.data.body === corpsS4) });
await shot(b, 'S4-run2-hors-ligne-B');
await sleep(3000);
const tRetour = Date.now();
await b.context.setOffline(false);
const srv = await attendre(async () => (await serverMessages()).some((r) => r.data.body === corpsS4) ? Date.now() : null, 30000);
const chezA = await attendre(() => a.ws.frames.find((f) => f.type === 'record' && f.record?.data?.body === corpsS4)?.at ?? null, 30000);
const reHello = await attendre(async () => nbHello(b) > helloAvant ? dernierHello(b) : null, 45000);
const fileVide = await attendre(async () => (await file(b)).length === 0 ? Date.now() : null, 20000);
log('S4', 'retour du réseau', {
  serveur_a_recu_apres_ms: srv ? srv - tRetour : 'JAMAIS', A_a_recu_apres_ms: chezA ? chezA - tRetour : 'JAMAIS',
  socket_B_rouverte_apres_ms: reHello ? reHello - tRetour : 'JAMAIS', file_videe_apres_ms: fileVide ? fileVide - tRetour : 'JAMAIS',
  banniere_finale: await b.page.evaluate(() => (document.body.innerText.match(/\d+ modifications? en attente d’envoi[^\n]*/) || ['disparue'])[0]),
});

/* ─── S5 : édition concurrente du MÊME message pendant une coupure ────────── */
const ref = (await serverMessages()).find((r) => r.data.body === corpsS2b);
const closeAvant5 = nbClose(b);
await b.context.setOffline(true);
await attendre(async () => nbClose(b) > closeAvant5 ? true : null, 20000);
// B (hors ligne) épingle le message S2b.
const bulleB = bulle(b, corpsS2b);
await bulleB.hover();
await bulleB.locator('button[aria-label="Épingler"]').first().click({ force: true });
const epingleB = await attendre(async () => (await bulleB.locator('button[aria-label="Désépingler"]').count()) > 0 ? true : null, 5000);
// A (en ligne) réagit 👍 au même message.
const bulleA = bulle(a, corpsS2b);
await bulleA.hover();
await bulleA.locator('button[aria-label="Réagir"]').first().click({ force: true });
await bulleA.locator('button:has-text("👍")').first().click({ force: true });
const reactionServeur = await attendre(async () => { const r = (await serverMessages()).find((x) => x.id === ref.id); return (r?.data?.reactions?.length ?? 0) > 0 ? r : null; }, 8000);
log('S5', 'pendant la coupure : B épingle (local), A réagit (arrivé au serveur)', {
  B_voit_son_epingle: Boolean(epingleB), file_B: await file(b),
  serveur_reactions: reactionServeur?.data?.reactions?.length ?? 0, serveur_pinned: Boolean(reactionServeur?.data?.pinned),
});
await b.context.setOffline(false);
const rejoue = await attendre(async () => { const r = (await serverMessages()).find((x) => x.id === ref.id); return r?.data?.pinned ? r : null; }, 30000);
await sleep(2500);
const finalS5 = (await serverMessages()).find((x) => x.id === ref.id);
const aVoit = await bulleA.locator('text=👍').count();
log('S5', 'après le retour de B : état FINAL du message', {
  pinned: Boolean(finalS5?.data?.pinned), reactions: finalS5?.data?.reactions ?? [],
  reaction_de_A_conservee: (finalS5?.data?.reactions?.length ?? 0) > 0, A_voit_encore_sa_reaction: aVoit > 0,
  verdict: (finalS5?.data?.reactions?.length ?? 0) > 0 ? 'fusion OK' : 'ÉCRASEMENT : la réaction faite EN LIGNE par A est perdue',
});
await shot(a, 'S5-run2-conflit-vu-par-A');

/* ─── S6 : le serveur tombe puis revient ──────────────────────────────────── */
const pid = execSync('pgrep -f "server.js$"').toString().trim().split('\n')[0];
process.kill(Number(pid), 'SIGTERM');
const cA = nbClose(a); const cB = nbClose(b); const hA = nbHello(a); const hB = nbHello(b);
const tKill = Date.now();
await attendre(async () => nbClose(a) > cA && nbClose(b) > cB ? true : null, 20000);
log('S6', 'amn-api arrêtée : les deux sockets tombent', { A_ms: (a.ws.frames.filter((f) => f.type === '__close').at(-1)?.at ?? 0) - tKill, B_ms: (b.ws.frames.filter((f) => f.type === '__close').at(-1)?.at ?? 0) - tKill });
const corpsS6 = `AUDIT S6 serveur éteint ${Date.now()}`;
await a.page.locator('textarea[placeholder^="Écrire un message"]').fill(corpsS6);
await a.page.locator('button[aria-label="Envoyer"]').click();
await sleep(1500);
log('S6', 'écriture pendant la panne', { file_A: await file(a), banniere: await a.page.evaluate(() => (document.body.innerText.match(/\d+ modifications? en attente d’envoi[^\n]*/) || ['ABSENTE'])[0]), rail: await a.page.evaluate(() => (document.body.innerText.match(/Hors ligne|Reconnexion en cours|Lien actif|Connexion/) || ['?'])[0]) });
await shot(a, 'S6-run2-serveur-eteint-A');
await sleep(8000);
const tRelance = Date.now();
const child = spawn('/tmp/e2e/start-api.sh', { detached: true, stdio: ['ignore', fs.openSync('/tmp/amn-api-audit.log', 'a'), fs.openSync('/tmp/amn-api-audit.log', 'a')] });
child.unref();
const rA = await attendre(async () => nbHello(a) > hA ? dernierHello(a) : null, 90000);
const rB = await attendre(async () => nbHello(b) > hB ? dernierHello(b) : null, 90000);
const s6srv = await attendre(async () => (await serverMessages()).some((r) => r.data.body === corpsS6) ? Date.now() : null, 60000);
const s6B = await attendre(async () => (await b.page.getByText(corpsS6).count()) > 0 ? Date.now() : null, 30000);
log('S6', 'serveur relancé', {
  A_socket_rouverte_apres_ms: rA ? rA - tRelance : 'JAMAIS', B_socket_rouverte_apres_ms: rB ? rB - tRelance : 'JAMAIS',
  message_de_panne_sur_serveur_apres_ms: s6srv ? s6srv - tRelance : 'JAMAIS', visible_chez_B_apres_ms: s6B ? s6B - tRelance : 'JAMAIS',
  file_A_finale: await file(a),
});
const notifsB = await b.page.evaluate(() => window.__notifs);
const parCorps = {}; for (const n of notifsB) parCorps[`${n.title} / ${n.body}`] = (parCorps[`${n.title} / ${n.body}`] ?? 0) + 1;
log('S6', 'toutes les notifications OS reçues par B (doublons ?)', { par_contenu: parCorps, doublons: Object.values(parCorps).filter((n) => n > 1).length });

/* ─── S7 : message privé — notifié ? signalé ? ────────────────────────────── */
await aller(b, '/appels');
await aller(a, '/messages-prives');
await sleep(800);
const n1 = await b.page.evaluate(() => window.__notifs.length);
await a.page.locator('button:has-text("Mohamed")').first().click();
await sleep(500);
const corpsS7 = `AUDIT S7 privé ${Date.now()}`;
await a.page.locator('[aria-label^="Écrire à"]').fill(corpsS7);
await a.page.locator('button[aria-label="Envoyer"]').click();
const dmB = await attendre(() => b.ws.frames.find((f) => f.type === 'record' && f.collection === 'dms' && f.record?.data?.body === corpsS7) ?? null, 10000);
await sleep(3000);
const badge = await b.page.evaluate(() => { const l = document.querySelector('a[href*="messages-prives"]'); return l ? (l.querySelector('.bg-accent.rounded-full, .rounded-full.bg-accent') ? 'pastille' : 'aucune pastille') : 'lien absent de la barre'; });
log('S7', 'message privé A → B', { recu_par_websocket_B: Boolean(dmB), notification_OS_chez_B: (await b.page.evaluate(() => window.__notifs.length)) - n1, barre_laterale: badge });
await shot(b, 'S7-run2-dm-B');

fs.writeFileSync(`${OUT}/journal-run2.json`, JSON.stringify(journal, null, 2));
fs.writeFileSync(`${OUT}/trames-ws-run2-A.json`, JSON.stringify(a.ws, null, 2));
fs.writeFileSync(`${OUT}/trames-ws-run2-B.json`, JSON.stringify(b.ws, null, 2));
await browser.close();
console.log('\nJOURNAL :', `${OUT}/journal-run2.json`);
