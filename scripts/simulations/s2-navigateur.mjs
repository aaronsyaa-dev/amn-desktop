// S2 côté poste : charger un compte chargé d'historique et mesurer chaque écran lourd.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
const [BUNDLE, PORT, EMAIL, SORTIE] = process.argv.slice(2);
const APP = `http://127.0.0.1:${PORT}/`;
const serveur = spawn('node', ['/home/user/amn-desktop/scripts/servir-bundle.mjs', BUNDLE, PORT], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--enable-precise-memory-info'] });
const ROUTES = ['/', '/facturation', '/clients', '/tasks', '/agenda', '/groupes', '/depenses', '/interventions', '/projets', '/tresorerie', '/tableau-de-bord'];
try {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.addInitScript(() => { window.__longues = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__longues.push(e.duration); }).observe({ type: 'longtask', buffered: true }); });
  const page = await ctx.newPage();
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 120)));
  let octets = 0; page.on('response', async (r) => { if (r.url().includes('/v1/collections')) { try { octets += (await r.body()).length; } catch { /* */ } } });
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.locator('input[name="email"]').fill(EMAIL); await page.locator('input[name="password"]').fill('motdepasse-sim');
  const t0 = Date.now();
  await page.locator('button[type="submit"]').click();
  await page.getByText(/synchronisé/i).first().waitFor({ timeout: 120000 }).catch(() => undefined);
  const synchro = Date.now() - t0;
  console.error(`synchro ${synchro} ms, ${octets} octets`);
  for (const b of ['Passer la présentation', 'Plus tard']) { const x = page.getByRole('button', { name: new RegExp(b, 'i') }); if ((await x.count()) > 0) { await x.first().click(); await page.waitForTimeout(400); } }
  const ecrans = [];
  for (const route of ROUTES) {
    const l0 = await page.evaluate(() => window.__longues.length);
    const t = Date.now();
    await page.goto(APP + '#' + route).catch(() => undefined);
    await page.waitForFunction(() => (document.querySelector('main h1')?.textContent ?? '').length > 0, null, { timeout: 30000 }).catch(() => undefined);
    await page.waitForTimeout(300);
    const ms = Date.now() - t;
    const m = await Promise.race([page.evaluate((n) => ({ longues: window.__longues.slice(n), noeuds: document.querySelectorAll('main *').length, secours: /erreur inattendue/i.test(document.body.innerText) }), l0), new Promise((r) => setTimeout(() => r({ longues: [99999], noeuds: -1, secours: false }), 60000))]);
    const ligne = { route, ms, tacheLongueMax: Math.round(Math.max(0, ...m.longues)), noeudsDom: m.noeuds, secours: m.secours };
    ecrans.push(ligne);
    console.error(JSON.stringify(ligne));
    if (SORTIE) await page.screenshot({ path: `${SORTIE}${route.replace(/\//g, '_') || '_accueil'}.png`, timeout: 20000 }).catch((e) => console.error(`capture ${route} : ${String(e).slice(0, 80)}`));
  }
  const tas = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null));
  console.log(JSON.stringify({ compte: EMAIL, connexionJusquaSynchronise_ms: synchro, octetsCollectionsTelecharges: octets, tasJsMo: tas, ecrans, erreurs: err.slice(0, 3) }));
} finally { await nav.close(); serveur.kill(); }
