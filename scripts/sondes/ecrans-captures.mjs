/* Captures d'écrans, poste et téléphone, pour la boucle visuelle avant/après : EDITION=interne|business OUT=<dossier> WEB=<url> node scripts/sondes/ecrans-captures.mjs */
const { chromium } = await import('playwright-core');
import fs from 'node:fs';
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const EDITION = process.env.EDITION || 'interne';
const OUT = process.env.OUT || `docs/captures/automatique-2026-09-05/${EDITION}`;
const BASE = process.env.WEB || (EDITION === 'business' ? 'http://127.0.0.1:4180' : 'http://127.0.0.1:4181');
const COMPTE = EDITION === 'business' ? ['fleuriste.essai@exemple.test', 'Fleuriste-2026-Essai'] : ['essai.interne@exemple.test', 'Interne-2026-Essai'];
const ROUTES = (process.env.ROUTES ? process.env.ROUTES.split(',') : EDITION === 'business'
  ? ['/', '/agenda', '/tasks', '/bibliotheque', '/clients', '/facturation', '/notes', '/reglages']
  : ['/', '/tour', '/garde', '/garde/ajmani', '/garde/pile', '/garde/bureaux/sites', '/bibliotheque', '/tasks', '/tour/organisations', '/incidents']);
fs.mkdirSync(OUT, { recursive: true });
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const connecter = async (p, clic) => {
  await p.goto(`${BASE}/`); await a(1800);
  if (await p.locator('input[name="email"]').count()) {
    await p.locator('input[name="email"]').fill(COMPTE[0]); await p.locator('input[name="password"]').fill(COMPTE[1]);
    await p.locator('button[type="submit"]').first().click();
    for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
  }
  await a(2500); await p.mouse.click(...clic).catch(() => {}); await a(700);
};
const mesurer = (p) => p.evaluate(() => {
  const main = document.querySelector('main') ?? document.body;
  const mots = (main.innerText ?? '').split(/\s+/).filter(Boolean).length;
  const paragraphesLongs = [...main.querySelectorAll('p')].filter((el) => el.getClientRects().length && el.getBoundingClientRect().height > 2.6 * parseFloat(getComputedStyle(el).lineHeight || '18')).length;
  const cartes = main.querySelectorAll('section, article, .panel').length;
  return { mots, paragraphesLongs, cartes };
});
const bilan = [];
for (const [nom, viewport, clic, mobile] of [['poste', { width: 1440, height: 900 }, [720, 860], false], ['telephone', { width: 390, height: 844 }, [195, 420], true]]) {
  const ctx = await nav.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const p = await ctx.newPage();
  await p.addInitScript(() => { try { for (const k of Object.keys(localStorage)) if (k.startsWith('amn.presentation.vue.')) localStorage.setItem(k, '1'); } catch {} });
  await connecter(p, clic);
  for (const route of ROUTES) {
    await p.goto(`${BASE}/#${route}`); await a(3200);
    // Les présentations de première ouverture sont fermées : on mesure l'écran de tous les jours.
    await p.locator('button', { hasText: 'Compris' }).first().click({ timeout: 800 }).catch(() => {});
    await a(400);
    const m = await mesurer(p);
    const fichier = `${OUT}/${nom}-${route === '/' ? 'accueil' : route.replace(/^\//, '').replace(/\//g, '-')}.png`;
    await p.screenshot({ path: fichier, fullPage: false });
    bilan.push({ surface: nom, route, ...m });
    console.log(`${nom.padEnd(9)} ${route.padEnd(22)} ${String(m.mots).padStart(5)} mots  ${String(m.paragraphesLongs).padStart(2)} § > 2 lignes  ${String(m.cartes).padStart(3)} blocs`);
  }
  await ctx.close();
}
fs.writeFileSync(`${OUT}/bilan.json`, JSON.stringify(bilan, null, 2));
await nav.close();
