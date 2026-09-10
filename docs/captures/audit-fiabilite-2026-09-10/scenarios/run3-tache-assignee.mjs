// S9 : une tâche assignée à B arrive par la synchro — qui est notifié ?
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
const id = `audit-tache-${Date.now()}`;
const res = await fetch(`${API}/v1/collections/tasks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer audit-jeton' }, body: JSON.stringify({ data: { title: 'Relire le contrat Corvetto (audit S9)', detail: '', status: 'todo', priority: 'normal', assigneeEmail: 'mohamed.audit@exemple.test', siteId: null, clientId: null, createdAt: new Date().toISOString(), _by: 'demo.interne@exemple.test' } }) });
console.log('PUT tâche :', res.status);
await sleep(4000);
console.log('S9 notifs A :', JSON.stringify(await a.evaluate(() => window.__notifs)));
console.log('S9 notifs B :', JSON.stringify(await b.evaluate(() => window.__notifs)));
await browser.close();
