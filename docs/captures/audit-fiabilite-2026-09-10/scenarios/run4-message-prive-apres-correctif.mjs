// S7bis : après correctif — un message privé A → B arrive par la synchro ; seul B est notifié.
import { chromium } from 'playwright-core';
const WEB = 'http://127.0.0.1:4280', API = 'http://127.0.0.1:4172';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
async function ouvrir(email, mdp) {
  const context = await browser.newContext({ permissions: ['notifications'] });
  await context.addInitScript(() => {
    window.__notifs = [];
    const push = (t, o) => window.__notifs.push({ title: t, body: o?.body ?? '' });
    class N { constructor(t, o) { push(t, o); } static get permission() { return 'granted'; } static requestPermission() { return Promise.resolve('granted'); } }
    window.Notification = N;
    if (window.ServiceWorkerRegistration) window.ServiceWorkerRegistration.prototype.showNotification = function (t, o) { push(t, o); return Promise.resolve(); };
    try { window.localStorage.setItem('amn.welcome.lastShown', new Date().toISOString().slice(0, 10)); } catch {}
  });
  const page = await context.newPage();
  await page.goto(WEB, { waitUntil: 'networkidle' });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(mdp);
  await page.locator('button:has-text("Se connecter")').click();
  await page.waitForFunction(() => !document.querySelector('input[name="password"]'), null, { timeout: 20000 });
  return page;
}
const a = await ouvrir('demo.interne@exemple.test', 'Demo-2026-Interne');
const b = await ouvrir('mohamed.audit@exemple.test', 'Mohamed-2026-Audit');
await sleep(5000);
// Vrai geste : A écrit depuis l'écran Messages privés.
await a.goto(`${WEB}/#/messages-prives`, { waitUntil: 'networkidle' });
await sleep(800);
await a.locator('button:has-text("Mohamed")').first().click();
await sleep(400);
const corps = `AUDIT S7bis privé ${Date.now()}`;
await a.locator('[aria-label^="Écrire à"]').fill(corps);
await a.locator('button[aria-label="Envoyer"]').click();
await sleep(4000);
console.log('S7bis notifs A :', JSON.stringify(await a.evaluate(() => window.__notifs)));
console.log('S7bis notifs B :', JSON.stringify(await b.evaluate(() => window.__notifs)));
await b.screenshot({ path: '/home/user/amn-desktop/docs/captures/audit-fiabilite-2026-09-10/S7bis-apres-correctif-B.png' });
await browser.close();
