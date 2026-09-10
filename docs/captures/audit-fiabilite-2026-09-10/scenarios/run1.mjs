/**
 * Audit de fiabilité — scénarios réels multi-utilisateurs sur l'édition INTERNE
 * (AMN Business), en navigateur piloté (Playwright), contre une amn-api locale.
 *
 * Preuves produites : journal horodaté (JSON), captures d'écran, trames WebSocket
 * observées de chaque côté, notifications OS interceptées, état serveur relu.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { execSync, spawn } from 'node:child_process';

const WEB = 'http://127.0.0.1:4280';
const API = 'http://127.0.0.1:4172';
const OUT = '/home/user/amn-desktop/docs/captures/audit-fiabilite-2026-09-10';
const A = { email: 'demo.interne@exemple.test', mdp: 'Demo-2026-Interne', nom: 'A (demo.interne)' };
const B = { email: 'mohamed.audit@exemple.test', mdp: 'Mohamed-2026-Audit', nom: 'B (mohamed.audit)' };

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

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});

async function ouvrir(compte, tag) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['notifications', 'microphone'] });
  await context.addInitScript(() => {
    // Interception des notifications OS (les deux chemins que suit showLocalNotification).
    window.__notifs = [];
    const push = (title, opts) => window.__notifs.push({ at: Date.now(), title, body: opts?.body ?? '', tag: opts?.tag ?? '' });
    class FakeNotification { constructor(title, opts) { push(title, opts); } static get permission() { return 'granted'; } static requestPermission() { return Promise.resolve('granted'); } }
    window.Notification = FakeNotification;
    if (window.ServiceWorkerRegistration) {
      window.ServiceWorkerRegistration.prototype.showNotification = function (title, opts) { push(title, opts); return Promise.resolve(); };
    }
    // Pas d'écran de bienvenue du jour : il masquerait l'écran sous les clics.
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
  // Fermer un éventuel écran d'accueil / présentation.
  for (let i = 0; i < 3; i += 1) {
    const btn = page.locator('button:has-text("Passer"), button:has-text("Commencer"), button:has-text("Plus tard"), button[aria-label="Fermer"]').first();
    if (await btn.isVisible().catch(() => false)) { await btn.click().catch(() => {}); await sleep(300); } else break;
  }
  await page.keyboard.press('Escape').catch(() => {});
  return { context, page, ws, compte, tag };
}

const hello = (u) => u.ws.frames.some((f) => f.type === 'hello');
/** La carte « Première ouverture » d'un module : on la ferme si elle est là. */
const fermerCartes = async (page) => {
  for (let i = 0; i < 2; i += 1) {
    const carte = page.locator('[aria-label="Première ouverture"] button').first();
    if (await carte.isVisible().catch(() => false)) { await carte.click().catch(() => {}); await sleep(250); } else break;
  }
};
const aller = async (u, hash) => { await u.page.goto(`${WEB}/#${hash}`, { waitUntil: 'networkidle' }); await sleep(400); await fermerCartes(u.page); };
const attendre = async (fn, timeoutMs, pas = 150) => { const fin = Date.now() + timeoutMs; while (Date.now() < fin) { const v = await fn(); if (v) return v; await sleep(pas); } return null; };
const railTexte = async (page) => (await page.locator('footer, [class*="StatusRail"], body').last().innerText().catch(() => '')).replace(/\s+/g, ' ');
const rail = async (page) => { const t = await page.evaluate(() => document.body.innerText); return /Reconnexion en cours/i.test(t) ? 'reprise' : /Hors ligne/i.test(t) && !/Lien actif/i.test(t) ? 'offline' : /Lien actif/i.test(t) ? 'online' : 'inconnu'; };
const shot = (u, nom) => u.page.screenshot({ path: `${OUT}/${nom}.png` });

/* ─── S0 : connexion des deux comptes, liaison temps réel ─────────────────── */
const a = await ouvrir(A, 'A');
const b = await ouvrir(B, 'B');
await attendre(() => hello(a) && hello(b), 15000);
log('S0', 'deux sessions ouvertes, WebSocket saluée des deux côtés', { A: hello(a), B: hello(b) });

/* ─── S1 : présence — chacun voit l'autre en ligne ────────────────────────── */
await aller(a, '/appels');
await aller(b, '/appels');
const boutonAppel = (u, autre) => u.page.locator(`button[aria-label^="Appeler"]`).first();
const aVoitB = await attendre(async () => (await boutonAppel(a).isEnabled().catch(() => false)) ? true : null, 15000);
const bVoitA = await attendre(async () => (await boutonAppel(b).isEnabled().catch(() => false)) ? true : null, 15000);
log('S1', 'présence : bouton « Appeler » actif (= l’autre est vu en ligne)', { A_voit_B: Boolean(aVoitB), B_voit_A: Boolean(bVoitA) });
await shot(a, 'S1-presence-A');

/* ─── S2 : message d’équipe en temps réel + notification OS chez l’autre ──── */
await aller(a, '/team');
await sleep(1500);
const corpsS2 = `AUDIT S2 ${Date.now()}`;
const nbNotifsB0 = await b.page.evaluate(() => window.__notifs.length);
const tEnvoi = Date.now();
await a.page.locator('textarea[placeholder^="Écrire un message"]').fill(corpsS2);
await a.page.locator('button[aria-label="Envoyer"]').click();
const recuB = await attendre(() => b.ws.frames.find((f) => f.type === 'record' && f.collection === 'messages' && f.record?.data?.body === corpsS2) ?? null, 10000);
const notifB = await attendre(async () => { const n = await b.page.evaluate(() => window.__notifs); return n.length > nbNotifsB0 ? n.slice(nbNotifsB0) : null; }, 8000);
const notifsA = await a.page.evaluate(() => window.__notifs);
log('S2', 'message A → B', {
  latence_ws_ms: recuB ? recuB.at - tEnvoi : null,
  notif_B: notifB ? notifB.map((n) => `${n.title} / ${n.body}`) : 'AUCUNE',
  notifs_A_pour_son_propre_message: notifsA.filter((n) => n.body === corpsS2).length,
});
await aller(b, '/team');
const visibleB = await attendre(async () => (await b.page.getByText(corpsS2).count()) > 0 ? true : null, 8000);
log('S2', 'message visible à l’écran de B', { visible: Boolean(visibleB) });
await shot(b, 'S2-message-recu-B');
// Doublon ? B recharge sa page : rien ne doit re-notifier l’historique.
await b.page.reload({ waitUntil: 'networkidle' });
await sleep(4000);
const notifsApresReload = await b.page.evaluate(() => window.__notifs.length);
log('S2', 'après rechargement de B : notifications rejouées pour l’historique', { rejouees: notifsApresReload });

/* ─── S3 : appel audio A → B, acceptation, raccrochage ────────────────────── */
await aller(a, '/appels');
await attendre(async () => (await boutonAppel(a).isEnabled().catch(() => false)) ? true : null, 15000);
const tAppel = Date.now();
await boutonAppel(a).click();
const entrant = await attendre(async () => (await b.page.locator('[aria-label^="Appel entrant de"]').isVisible().catch(() => false)) ? true : null, 15000);
const notifAppelB = await b.page.evaluate(() => window.__notifs.filter((n) => n.title === 'Appel entrant'));
log('S3', 'B voit l’appel entrant', { sonne_apres_ms: entrant ? Date.now() - tAppel : null, notification_OS: notifAppelB.map((n) => n.body) });
await shot(b, 'S3-appel-entrant-B');
await b.page.locator('button[aria-label="Accepter l’appel"]').click();
const actif = await attendre(async () => {
  const txt = await a.page.evaluate(() => document.body.innerText);
  return /\b\d+:\d\d\b/.test(txt) && /Raccrocher/i.test(await a.page.locator('button[aria-label="Raccrocher"]').count().then((n) => (n ? 'Raccrocher' : ''))) ? txt.match(/\b\d+:\d\d\b/)[0] : null;
}, 25000);
log('S3', 'appel accepté — audio établi (compteur de durée visible chez A)', { etabli: Boolean(actif), duree_lue: actif, delai_ms: Date.now() - tAppel });
await sleep(3000);
await shot(a, 'S3-appel-actif-A');
await a.page.locator('button[aria-label="Raccrocher"]').click();
const termineB = await attendre(async () => (await b.page.locator('button[aria-label="Raccrocher"]').count()) === 0 ? true : null, 8000);
log('S3', 'A raccroche → B revient au repos', { B_au_repos: Boolean(termineB) });

/* ─── S3b : présence après déconnexion — B ferme son application ──────────── */
const bContextFerme = b.context;
await bContextFerme.close();
const bHorsLigne = await attendre(async () => (await boutonAppel(a).isDisabled().catch(() => false)) ? true : null, 15000);
log('S3b', 'B ferme l’app → chez A le bouton « Appeler » se grise (présence à jour)', { B_vu_hors_ligne: Boolean(bHorsLigne) });
await shot(a, 'S3b-B-hors-ligne-vu-par-A');
// B revient.
const b2 = await ouvrir(B, 'B');
await attendre(() => hello(b2), 15000);
Object.assign(b, b2);

/* ─── S4 : coupure réseau côté B, écriture hors ligne, reconnexion ────────── */
await aller(b, '/team');
await aller(a, '/team');
await sleep(1000);
await b.context.setOffline(true);
const railOff = await attendre(async () => (await rail(b.page)) === 'offline' ? 'offline' : null, 15000);
log('S4', 'B coupé du réseau : le rail passe « Hors ligne »', { rail: railOff ?? await rail(b.page) });
const corpsS4 = `AUDIT S4 hors ligne ${Date.now()}`;
await b.page.locator('textarea[placeholder^="Écrire un message"]').fill(corpsS4);
await b.page.locator('button[aria-label="Envoyer"]').click();
const banniere = await attendre(async () => { const t = await b.page.evaluate(() => document.body.innerText); const m = t.match(/\d+ modifications? en attente d’envoi[^\n]*/); return m ? m[0] : null; }, 8000);
const surServeurAvant = (await serverMessages()).some((r) => r.data.body === corpsS4);
log('S4', 'écriture hors ligne', { banniere_file: banniere ?? 'ABSENTE', deja_sur_serveur: surServeurAvant, visible_chez_B: (await b.page.getByText(corpsS4).count()) > 0 });
await shot(b, 'S4-hors-ligne-file-B');
await sleep(4000);
const tRetour = Date.now();
await b.context.setOffline(false);
const arriveServeur = await attendre(async () => (await serverMessages()).some((r) => r.data.body === corpsS4) ? Date.now() : null, 30000);
const arriveA = await attendre(() => a.ws.frames.find((f) => f.type === 'record' && f.record?.data?.body === corpsS4)?.at ?? null, 30000);
const railOn = await attendre(async () => (await rail(b.page)) === 'online' ? Date.now() : null, 45000);
log('S4', 'retour du réseau', {
  serveur_a_recu_apres_ms: arriveServeur ? arriveServeur - tRetour : 'JAMAIS',
  A_a_recu_apres_ms: arriveA ? arriveA - tRetour : 'JAMAIS',
  websocket_B_revenue_apres_ms: railOn ? railOn - tRetour : 'JAMAIS',
  banniere_disparue: !(await b.page.evaluate(() => /en attente d’envoi/.test(document.body.innerText))),
});

/* ─── S5 : édition concurrente du MÊME enregistrement pendant une coupure ─── */
// B hors ligne épingle le message S2 ; pendant ce temps A (en ligne) y réagit 👍.
// Au retour de B, sa version (sans la réaction de A) est rejouée telle quelle.
const msgS2 = (await serverMessages()).find((r) => r.data.body === corpsS2);
await b.context.setOffline(true);
await attendre(async () => (await rail(b.page)) === 'offline' ? true : null, 15000);
const ligneB = b.page.locator(`text=${corpsS2}`).first();
await ligneB.hover();
const pinB = b.page.locator(`button[aria-label="Épingler"]`).last();
await pinB.click({ force: true });
await sleep(800);
const ligneA = a.page.locator(`text=${corpsS2}`).first();
await ligneA.hover();
await a.page.locator('button[aria-label="Réagir"]').last().click({ force: true });
await sleep(400);
await a.page.locator('button:has-text("👍")').first().click({ force: true }).catch(async () => a.page.locator('[role="dialog"] button, .absolute button').first().click({ force: true }));
await sleep(1500);
const etatServeurAvantRetour = (await serverMessages()).find((r) => r.id === msgS2.id);
log('S5', 'pendant la coupure de B : A a réagi en ligne', { serveur_reactions: etatServeurAvantRetour?.data?.reactions?.length ?? 0, serveur_pinned: Boolean(etatServeurAvantRetour?.data?.pinned) });
await b.context.setOffline(false);
await attendre(async () => (await serverMessages()).find((r) => r.id === msgS2.id)?.data?.pinned ? true : null, 30000);
await sleep(2000);
const etatFinal = (await serverMessages()).find((r) => r.id === msgS2.id);
const aReaction = await a.page.evaluate(() => document.body.innerText.includes('👍'));
log('S5', 'après le retour de B : état FINAL du message sur le serveur', {
  pinned: Boolean(etatFinal?.data?.pinned),
  reactions: etatFinal?.data?.reactions?.length ?? 0,
  reaction_de_A_conservee: (etatFinal?.data?.reactions?.length ?? 0) > 0,
  A_voit_encore_sa_reaction: aReaction,
});
await shot(a, 'S5-conflit-vu-par-A');

/* ─── S6 : le serveur tombe puis revient (redémarrage amn-api) ────────────── */
execSync("pkill -f 'node src/server.js' || true");
const offA = await attendre(async () => (await rail(a.page)) !== 'online' ? await rail(a.page) : null, 20000);
log('S6', 'amn-api arrêtée : rail chez A', { rail: offA });
const corpsS6 = `AUDIT S6 serveur éteint ${Date.now()}`;
await a.page.locator('textarea[placeholder^="Écrire un message"]').fill(corpsS6);
await a.page.locator('button[aria-label="Envoyer"]').click();
const banS6 = await attendre(async () => { const t = await a.page.evaluate(() => document.body.innerText); const m = t.match(/\d+ modifications? en attente d’envoi[^\n]*/); return m ? m[0] : null; }, 8000);
log('S6', 'écriture pendant la panne serveur', { banniere: banS6 ?? 'ABSENTE' });
await sleep(5000);
const tRelance = Date.now();
const child = spawn('/tmp/e2e/start-api.sh', { detached: true, stdio: ['ignore', fs.openSync('/tmp/amn-api-audit.log', 'a'), fs.openSync('/tmp/amn-api-audit.log', 'a')] });
child.unref();
const backA = await attendre(async () => (await rail(a.page)) === 'online' ? Date.now() : null, 60000);
const backB = await attendre(async () => (await rail(b.page)) === 'online' ? Date.now() : null, 60000);
const s6Serveur = await attendre(async () => (await serverMessages().catch(() => [])).some((r) => r.data.body === corpsS6) ? Date.now() : null, 60000);
const s6B = await attendre(async () => (await b.page.getByText(corpsS6).count()) > 0 ? Date.now() : null, 30000);
log('S6', 'serveur relancé', {
  A_reconnecte_apres_ms: backA ? backA - tRelance : 'JAMAIS',
  B_reconnecte_apres_ms: backB ? backB - tRelance : 'JAMAIS',
  message_de_panne_arrive_serveur_apres_ms: s6Serveur ? s6Serveur - tRelance : 'JAMAIS',
  message_de_panne_visible_chez_B_apres_ms: s6B ? s6B - tRelance : 'JAMAIS',
});
// Doublons de notification après reconnexion ?
const notifsB = await b.page.evaluate(() => window.__notifs);
const parCorps = {};
for (const n of notifsB) parCorps[n.body] = (parCorps[n.body] ?? 0) + 1;
log('S6', 'notifications OS reçues par B sur toute la session (comptage par contenu)', { par_contenu: parCorps, doublons: Object.values(parCorps).filter((n) => n > 1).length });

/* ─── S7 : message privé — est-il notifié ? ───────────────────────────────── */
await aller(b, '/appels');
await aller(a, '/messages-prives');
await sleep(1000);
const nbNotifsB1 = await b.page.evaluate(() => window.__notifs.length);
await a.page.locator('button:has-text("mohamed"), button:has-text("Mohamed")').first().click();
await sleep(500);
const corpsS7 = `AUDIT S7 privé ${Date.now()}`;
await a.page.locator('[aria-label^="Écrire à"]').fill(corpsS7);
await a.page.locator('button[aria-label="Envoyer"]').click();
const dmRecu = await attendre(() => b.ws.frames.find((f) => f.type === 'record' && f.collection === 'dms' && f.record?.data?.body === corpsS7) ?? null, 10000);
await sleep(3000);
const notifsDm = await b.page.evaluate(() => window.__notifs.length);
const badgeDm = await b.page.evaluate(() => { const l = document.querySelector('a[href*="messages-prives"]'); return l ? Boolean(l.querySelector('.rounded-full.bg-accent')) : null; });
log('S7', 'message privé A → B', { recu_par_websocket_B: Boolean(dmRecu), notification_OS_chez_B: notifsDm - nbNotifsB1, pastille_menu_messages_prives: badgeDm });
await shot(b, 'S7-dm-silencieux-B');

fs.writeFileSync(`${OUT}/journal.json`, JSON.stringify(journal, null, 2));
fs.writeFileSync(`${OUT}/trames-ws-A.json`, JSON.stringify(a.ws, null, 2));
fs.writeFileSync(`${OUT}/trames-ws-B.json`, JSON.stringify(b.ws, null, 2));
await browser.close();
console.log('\nJOURNAL ÉCRIT :', `${OUT}/journal.json`);
