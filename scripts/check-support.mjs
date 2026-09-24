/**
 * check:support — entrer chez une cliente depuis le support, et que rien ne plante.
 *
 * Né du bug du 24 septembre 2026 : le contexte de support est un arbre de
 * routes à part ; un composant de l'Accueil y appelait `useGuide` sans
 * fournisseur, et Harun ne pouvait plus entrer chez AUCUNE cliente (écran
 * « Une erreur inattendue s'est produite »). Aucun contrôle n'entrait en
 * support ; celui-ci le fait, puis parcourt chaque écran de la barre de la
 * cliente et refuse le moindre écran de secours ou la moindre erreur de page.
 *
 *   AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… node scripts/check-support.mjs <bundle-interne> [port]
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const BUNDLE = process.argv[2];
const PORT = Number(process.argv[3] ?? 4198);
const EMAIL = process.env.AMN_E2E_EMAIL ?? '';
const MDP = process.env.AMN_E2E_PASSWORD ?? '';
const CHROMIUM = process.env.AMN_E2E_CHROMIUM ?? '/opt/pw-browsers/chromium';
if (!BUNDLE || !EMAIL || !MDP) {
  console.log('Usage : AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… node scripts/check-support.mjs <bundle-interne> [port]');
  process.exit(1);
}
const serveur = spawn('node', [new URL('./servir-bundle.mjs', import.meta.url).pathname, BUNDLE, String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const APP = `http://127.0.0.1:${PORT}/`;
const nav = await chromium.launch({ executablePath: CHROMIUM });
const fautes = [];
try {
  const page = await nav.newPage({ viewport: { width: 1280, height: 860 } });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e).slice(0, 160)));
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(MDP);
  await page.locator('button[type="submit"]').click();
  for (let i = 0; i < 30 && (await page.content()).includes('name="password"'); i++) await page.waitForTimeout(500);
  await page.waitForTimeout(2000);
  if ((await page.getByText(/cliquez pour passer/i).count()) > 0) { await page.mouse.click(400, 400); await page.waitForTimeout(800); }
  const plusTard = page.getByRole('button', { name: /plus tard/i });
  if ((await plusTard.count()) > 0) await plusTard.first().click();
  const cibles = page.locator('[aria-label="Organisations"] button[aria-label]');
  if ((await cibles.count()) < 2) throw new Error('aucune organisation cliente dans le rail — le compte n’en voit aucune');
  const nom = await cibles.nth(1).getAttribute('aria-label');
  await cibles.nth(1).click();
  await page.waitForTimeout(6000);
  const secours = async () => /erreur inattendue/i.test(await page.evaluate(() => document.body.innerText));
  if (await secours()) fautes.push(`entrée chez « ${nom} » : écran de secours`);
  if (!/session de support/i.test(await page.evaluate(() => document.body.innerText))) fautes.push(`entrée chez « ${nom} » : pas de bandeau de support`);
  /* Toutes les familles de la cliente : on ouvre chaque tuile du rail et on relève ses liens. */
  const routes = new Set();
  const tuiles = page.locator('[data-rail-tuile]');
  for (let i = 0; i < (await tuiles.count()); i++) {
    await tuiles.nth(i).click();
    await page.waitForTimeout(150);
    for (const r of await page.evaluate(() => [...document.querySelectorAll('aside a[href^="#/"]')].map((a) => a.getAttribute('href').slice(1)))) routes.add(r);
  }
  let vus = 0;
  for (const route of routes) {
    erreurs.length = 0;
    await page.goto(APP + '#' + route, { waitUntil: 'networkidle' }).catch(() => undefined);
    await page.waitForTimeout(700);
    vus += 1;
    if (await secours()) fautes.push(`${route} : écran de secours`);
    if (erreurs.length) fautes.push(`${route} : ${erreurs[0]}`);
  }
  if (fautes.length) {
    console.log(`\nSupport : ${fautes.length} faute(s).`);
    for (const f of fautes) console.log(`  ✗ ${f}`);
    process.exitCode = 1;
  } else console.log(`\nSupport : OK — entrée chez « ${nom} », ${vus} écran(s) de la cliente parcourus, aucun écran de secours, aucune erreur de page.`);
} catch (e) {
  console.log(`Support : ÉCHEC — ${e.message}`);
  process.exitCode = 1;
} finally {
  await nav.close();
  serveur.kill();
}
