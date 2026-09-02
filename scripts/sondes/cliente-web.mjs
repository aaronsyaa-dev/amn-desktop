/* Bloc 7 : l'expérience cliente sur le web, du login à l'accueil — grand écran et téléphone. */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || '/tmp/e2e/soir';
const APP = process.env.APP || 'http://127.0.0.1:4180';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
for (const [nom, viewport, mobile] of [['poste', { width: 1440, height: 900 }, false], ['telephone', { width: 390, height: 844 }, true]]) {
  const ctx = await nav.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERREUR PAGE:', String(e).slice(0, 200)));
  await p.goto(`${APP}/`); await a(2000);
  const titre = await p.title();
  const manifeste = await p.evaluate(async () => { const r = await fetch('./manifest.webmanifest'); const m = await r.json(); return `${m.name} · ${m.short_name}`; });
  let t = await p.evaluate(() => document.body.innerText);
  console.log(`[${nom}] titre : ${titre} | manifeste : ${manifeste} | « AMN DevSec » visible ? ${/AMN DevSec/.test(t)} | « Business » visible ? ${/Business/.test(t)} | point d’exclamation ? ${/!/.test(t)}`);
  await p.screenshot({ path: `${OUT}/cliente-${nom}-01-login.png` });
  await p.locator('input[name="email"]').fill('fleuriste.essai@exemple.test');
  await p.locator('input[name="password"]').fill('Fleuriste-2026-Essai');
  await p.locator('button[type="submit"]').first().click();
  for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
  await a(1200);
  await p.screenshot({ path: `${OUT}/cliente-${nom}-02-bienvenue.png` });
  await a(2200); await p.mouse.click(mobile ? 195 : 720, mobile ? 800 : 860); await a(1200);
  t = await p.evaluate(() => document.body.innerText);
  console.log(`[${nom}] accueil : Fleuriste nommée ? ${/Fleuriste/.test(t)} | « Tour de contrôle » ? ${/Tour de contrôle/.test(t)} | « Scanner|Trackers|Comply » ? ${/Scanner|Trackers|Comply/.test(t)} | point d’exclamation ? ${/!/.test(t)}`);
  await p.screenshot({ path: `${OUT}/cliente-${nom}-03-accueil.png` });
  await ctx.close();
}
await nav.close();
