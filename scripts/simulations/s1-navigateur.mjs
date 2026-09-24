import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const [BUNDLE, PORT, FICHIER, DUREE] = process.argv.slice(2);
for (let i = 0; i < 60 && !fs.existsSync(FICHIER); i++) await new Promise((r) => setTimeout(r, 500));
const email = fs.readFileSync(FICHIER, 'utf8');
const serveur = spawn('node', ['/home/user/amn-desktop/scripts/servir-bundle.mjs', BUNDLE, PORT], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const APP = `http://127.0.0.1:${PORT}/`;
try {
  const page = await nav.newPage({ viewport: { width: 1280, height: 860 } });
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 120)));
  await page.addInitScript(() => { window.__longues = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__longues.push(e.duration); }).observe({ type: 'longtask', buffered: true }); });
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.locator('input[name="email"]').fill(email); await page.locator('input[name="password"]').fill('motdepasse-sim'); await page.locator('button[type="submit"]').click();
  for (let i = 0; i < 30 && (await page.content()).includes('name="password"'); i++) await page.waitForTimeout(500);
  await page.evaluate(() => { localStorage.setItem('amn.guide.presentation.' + (document.cookie || ''), 'vu'); });
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  const pt = page.getByRole('button', { name: /plus tard/i }); if ((await pt.count()) > 0) await pt.first().click();
  await page.goto(APP + '#/tasks', { waitUntil: 'networkidle' }).catch(() => undefined);
  const mesures = []; const toasts = [];
  const fin = Date.now() + Number(DUREE) * 1000;
  while (Date.now() < fin) {
    const t = Date.now();
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
    mesures.push(Date.now() - t);
    toasts.push(await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && /mises? à jour/.test(e.textContent ?? '')).length));
    await page.waitForTimeout(1000);
  }
  const r = await page.evaluate(() => ({ longues: window.__longues, tas: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null, taches: document.querySelectorAll('main [class*="group/card"]').length }));
  const s = [...mesures].sort((a, b) => a - b);
  console.log(JSON.stringify({ navigateur: 'Tâches ouvert pendant la salve', imageSuivante_p50: s[Math.floor(s.length / 2)], imageSuivante_max: s.at(-1), tachesLongues: r.longues.length, tacheLongueMax: Math.round(Math.max(0, ...r.longues)), tasJsMo: r.tas, toastsSynchroVisibles_max: Math.max(...toasts), secondesAvecToast: toasts.filter((n) => n > 0).length + '/' + toasts.length, cartesAffichees: r.taches, erreurs: err }));
} finally { await nav.close(); serveur.kill(); }
