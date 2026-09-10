/**
 * BLOC 2 — le correctif d'écrasement, et la non-régression de ce que l'audit
 * du 10/09 avait déjà validé. Deux vrais postes (navigateur piloté), vrais
 * gestes à l'écran, amn-api locale.
 *
 *   C1  l'écrasement lui-même : le scénario S5 de l'audit, à l'identique
 *   C2  synchro normale A → B                        (S2 de l'audit)
 *   C3  coupure réseau, écriture hors ligne, reprise (S4 de l'audit)
 *   C4  redémarrage du serveur                        (S6 de l'audit)
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { execSync, spawn } from 'node:child_process';

const WEB = 'http://127.0.0.1:4280';
const API = 'http://127.0.0.1:4172';
const OUT = '/home/user/amn-desktop/docs/captures/fusion-2026-09-10';
fs.mkdirSync(OUT, { recursive: true });
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
const attendre = async (fn, ms, pas = 150) => {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    let v = null;
    try { v = await fn(); } catch { v = null; }
    if (v) return v;
    await sleep(pas);
  }
  return null;
};
const messages = async () => {
  const res = await fetch(`${API}/v1/collections/messages`, { headers: { Authorization: 'Bearer audit-jeton' } });
  const { records } = await res.json();
  return records.filter((r) => !r.deleted);
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

async function ouvrir(compte, tag) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, permissions: ['notifications'] });
  await context.addInitScript(() => {
    try { window.localStorage.setItem('amn.welcome.lastShown', new Date().toISOString().slice(0, 10)); } catch {}
  });
  const page = await context.newPage();
  const ws = { frames: [] };
  page.on('websocket', (sock) => {
    sock.on('framereceived', (f) => { try { ws.frames.push({ at: Date.now(), ...JSON.parse(f.payload) }); } catch {} });
    sock.on('close', () => ws.frames.push({ at: Date.now(), type: '__close' }));
  });
  page.on('pageerror', (e) => log(tag, 'ERREUR PAGE', { message: e.message }));
  await page.goto(WEB, { waitUntil: 'networkidle' });
  await page.locator('input[name="email"]').fill(compte.email);
  await page.locator('input[name="password"]').fill(compte.mdp);
  await page.locator('button:has-text("Se connecter")').click();
  await page.waitForFunction(() => !document.querySelector('input[name="password"]'), null, { timeout: 20000 });
  await page.keyboard.press('Escape').catch(() => {});
  return { context, page, ws, tag };
}
const fermerCartes = async (page) => {
  for (let i = 0; i < 2; i += 1) {
    const c = page.locator('[aria-label="Première ouverture"] button').first();
    if (await c.isVisible().catch(() => false)) { await c.click().catch(() => {}); await sleep(250); } else break;
  }
};
const aller = async (u, hash) => { await u.page.goto(`${WEB}/#${hash}`, { waitUntil: 'networkidle' }); await sleep(500); await fermerCartes(u.page); };
const nbHello = (u) => u.ws.frames.filter((f) => f.type === 'hello').length;
const nbClose = (u) => u.ws.frames.filter((f) => f.type === '__close').length;
const bulle = (u, corps) => u.page.locator(`xpath=//*[.//button[@aria-label="Réagir"]][contains(., ${JSON.stringify(corps)})]`).last();
const file = (u) => u.page.evaluate(() => { try { return JSON.parse(localStorage.getItem('amn.sync.__envoi') || '[]'); } catch { return []; } });

const a = await ouvrir(A, 'A');
const b = await ouvrir(B, 'B');
await attendre(async () => nbHello(a) > 0 && nbHello(b) > 0, 15000);
log('C0', 'deux postes connectés', { A: nbHello(a) > 0, B: nbHello(b) > 0 });

/* ─── C1 : LE SCÉNARIO S5 DE L'AUDIT, À L'IDENTIQUE ──────────────────────── */
await aller(a, '/team');
await aller(b, '/team');
await sleep(1000);
const corps = `FUSION C1 ${Date.now()}`;
await a.page.locator('textarea[placeholder^="Écrire un message"]').fill(corps);
await a.page.locator('button[aria-label="Envoyer"]').click();
await attendre(async () => (await b.page.getByText(corps).count()) > 0 ? true : null, 10000);
const ref = (await messages()).find((r) => r.data.body === corps);
log('C1', 'un message existe, les deux postes le voient', { updatedAt: ref.updatedAt });

// B perd le réseau et ÉPINGLE le message (champ `pinned`).
const closeAvant = nbClose(b);
await b.context.setOffline(true);
await attendre(async () => nbClose(b) > closeAvant ? true : null, 20000);
const bulleB = bulle(b, corps);
await bulleB.hover();
await bulleB.locator('button[aria-label="Épingler"]').first().click({ force: true });
await attendre(async () => (await bulleB.locator('button[aria-label="Désépingler"]').count()) > 0 ? true : null, 5000);
const fileB = await file(b);
log('C1', 'B (HORS LIGNE) épingle — son écriture attend en file', {
  en_file: fileB.length,
  base_annoncee: fileB[0]?.base ?? 'AUCUNE',
  champs_declares: fileB[0]?.patch ? Object.keys(fileB[0].patch) : 'AUCUN',
});

// A, EN LIGNE, réagit 👍 au même message (champ `reactions`).
const bulleA = bulle(a, corps);
await bulleA.hover();
await bulleA.locator('button[aria-label="Réagir"]').first().click({ force: true });
await bulleA.locator('button:has-text("👍")').first().click({ force: true });
const avecReaction = await attendre(async () => {
  const m = (await messages()).find((r) => r.id === ref.id);
  return (m?.data?.reactions?.length ?? 0) > 0 ? m : null;
}, 10000);
log('C1', 'A (EN LIGNE) réagit 👍 — le serveur l’enregistre', {
  reactions_serveur: avecReaction?.data?.reactions?.length ?? 0,
  pinned_serveur: Boolean(avecReaction?.data?.pinned),
});

// B revient : sa file rejoue l'épingle, bâtie sur la version d'avant la réaction.
await b.context.setOffline(false);
await attendre(async () => (await messages()).find((r) => r.id === ref.id)?.data?.pinned ? true : null, 30000);
await sleep(2500);
const fin = (await messages()).find((r) => r.id === ref.id);
const aVoitSaReaction = await bulle(a, corps).locator('text=👍').count();
log('C1', 'B RETROUVE LE RÉSEAU — état FINAL du message', {
  pinned: Boolean(fin?.data?.pinned),
  reactions: fin?.data?.reactions?.length ?? 0,
  A_voit_encore_sa_reaction: aVoitSaReaction > 0,
  verdict:
    fin?.data?.pinned && (fin?.data?.reactions?.length ?? 0) > 0
      ? 'LES DEUX SURVIVENT — l’écrasement est fermé'
      : 'ÉCRASEMENT : du travail a été perdu',
});
await bulle(a, corps).scrollIntoViewIfNeeded().catch(() => {});
await a.page.screenshot({ path: `${OUT}/C1-apres-fusion-A.png` });
await b.page.screenshot({ path: `${OUT}/C1-apres-fusion-B.png` });

/* ─── C2 : synchro normale A → B (S2 de l'audit) ─────────────────────────── */
const corpsC2 = `FUSION C2 synchro ${Date.now()}`;
const tEnvoi = Date.now();
await a.page.locator('textarea[placeholder^="Écrire un message"]').fill(corpsC2);
await a.page.locator('button[aria-label="Envoyer"]').click();
const recu = await attendre(() => b.ws.frames.find((f) => f.type === 'record' && f.record?.data?.body === corpsC2)?.at ?? null, 10000);
const vuB = await attendre(async () => (await b.page.getByText(corpsC2).count()) > 0 ? true : null, 8000);
log('C2', 'synchro normale A → B', { latence_ws_ms: recu ? recu - tEnvoi : 'JAMAIS', visible_chez_B: Boolean(vuB) });

/* ─── C3 : coupure réseau, écriture hors ligne, reprise (S4) ─────────────── */
const closeAvant3 = nbClose(b);
await b.context.setOffline(true);
await attendre(async () => nbClose(b) > closeAvant3 ? true : null, 20000);
const corpsC3 = `FUSION C3 hors ligne ${Date.now()}`;
await b.page.locator('textarea[placeholder^="Écrire un message"]').fill(corpsC3);
await b.page.locator('button[aria-label="Envoyer"]').click();
await sleep(1500);
const banniere = await b.page.evaluate(() => (document.body.innerText.match(/\d+ modifications? en attente d’envoi[^\n]*/) || ['ABSENTE'])[0]);
log('C3', 'B écrit hors ligne', { banniere, sur_serveur: (await messages()).some((r) => r.data.body === corpsC3) });
const tRetour = Date.now();
await b.context.setOffline(false);
const srv = await attendre(async () => (await messages()).some((r) => r.data.body === corpsC3) ? Date.now() : null, 30000);
const chezA = await attendre(() => a.ws.frames.find((f) => f.type === 'record' && f.record?.data?.body === corpsC3)?.at ?? null, 30000);
log('C3', 'retour du réseau', {
  serveur_apres_ms: srv ? srv - tRetour : 'JAMAIS',
  A_apres_ms: chezA ? chezA - tRetour : 'JAMAIS',
  file_videe: (await file(b)).length === 0,
});

/* ─── C4 : redémarrage du serveur (S6) ──────────────────────────────────── */
const pid = execSync('pgrep -f "node src/server.js"').toString().trim().split('\n')[0];
const hA = nbHello(a); const hB = nbHello(b);
process.kill(Number(pid), 'SIGTERM');
await attendre(async () => nbClose(a) > 0 && nbClose(b) > 0 ? true : null, 20000);
const corpsC4 = `FUSION C4 serveur eteint ${Date.now()}`;
await a.page.locator('textarea[placeholder^="Écrire un message"]').fill(corpsC4);
await a.page.locator('button[aria-label="Envoyer"]').click();
await sleep(1500);
const banniereC4 = await a.page.evaluate(() => (document.body.innerText.match(/\d+ modifications? en attente d’envoi[^\n]*/) || ['ABSENTE'])[0]);
log('C4', 'amn-api arrêtée, A écrit quand même', { banniere: banniereC4 });
await sleep(4000);
const tRelance = Date.now();
spawn('/tmp/e2e/start-api.sh', { detached: true, stdio: ['ignore', fs.openSync('/tmp/e2e/repro-api.log', 'a'), fs.openSync('/tmp/e2e/repro-api.log', 'a')] }).unref();
const rA = await attendre(async () => nbHello(a) > hA ? Date.now() : null, 90000);
const rB = await attendre(async () => nbHello(b) > hB ? Date.now() : null, 90000);
const srvC4 = await attendre(async () => (await messages().catch(() => [])).some((r) => r.data.body === corpsC4) ? Date.now() : null, 60000);
const vuBC4 = await attendre(async () => (await b.page.getByText(corpsC4).count()) > 0 ? Date.now() : null, 30000);
log('C4', 'serveur relancé', {
  A_socket_ms: rA ? rA - tRelance : 'JAMAIS',
  B_socket_ms: rB ? rB - tRelance : 'JAMAIS',
  ecriture_de_panne_sur_serveur_ms: srvC4 ? srvC4 - tRelance : 'JAMAIS',
  visible_chez_B_ms: vuBC4 ? vuBC4 - tRelance : 'JAMAIS',
  file_A_finale: (await file(a)).length,
});

fs.writeFileSync(`${OUT}/journal.json`, JSON.stringify(journal, null, 2));
await browser.close();
console.log(`\nJOURNAL : ${OUT}/journal.json`);
