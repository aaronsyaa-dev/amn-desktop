/* La veille qui ne se réveille plus — reproduction sur l'application EMPAQUETÉE (pas le dev).
   1. On ouvre l'app, on se connecte, on va dans la Salle de contrôle (#/salle), on FERME l'app.
   2. On la rouvre : elle doit revenir au poste, pas rester sur la Salle ; et depuis la Salle, Échap et « Quitter » doivent toujours sortir.
   Lancer : xvfb-run -a node scripts/sondes/veille-electron.mjs   (HOME isolé pour ne toucher aucun profil réel) */
import fs from 'node:fs';
import path from 'node:path';
const { _electron: electron } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || 'docs/captures/veille-2026-09-05';
fs.mkdirSync(OUT, { recursive: true });
const HOME = process.env.HOME_ESSAI || '/tmp/e2e/home-electron';
fs.rmSync(HOME, { recursive: true, force: true }); fs.mkdirSync(HOME, { recursive: true });
// L'application empaquetée (dist-app, electron-builder) : ses fusibles coupent l'inspecteur Node dont Playwright a besoin
// pour piloter le binaire lui-même ; on charge donc SON archive (app.asar, le code exactement livré) dans l'Electron de la
// même version, fusibles ouverts. Même main, même preload, même rendu ; seul le binaire porteur diffère.
const dossier = fs.readdirSync('dist-app').find((d) => d.endsWith('-unpacked'));
const asar = path.resolve('dist-app', dossier, 'resources', 'app.asar');
const executablePath = path.resolve('node_modules/electron/dist/electron');
const erreurs = [];
const ok = (etiquette, valeur, detail = '') => { console.log(`${valeur ? '✓' : '✗'} ${etiquette}${detail ? ` — ${detail}` : ''}`); if (!valeur) erreurs.push(etiquette); };
const lancer = async () => {
  const app = await electron.launch({ executablePath, args: [asar, '--no-sandbox', '--disable-gpu'], timeout: 60_000, env: { ...process.env, HOME, XDG_CONFIG_HOME: `${HOME}/.config`, ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' } });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded'); await a(2500);
  return { app, page };
};
const ou = (page) => page.evaluate(() => window.location.hash);
const salleVisible = (page) => page.evaluate(() => Boolean([...document.querySelectorAll('button')].find((b) => /Quitter/.test(b.textContent ?? ''))));

console.log(`archive : ${asar} · electron : ${executablePath}`);
// 1. Première ouverture : connexion, puis la Salle.
let { app, page } = await lancer();
await page.screenshot({ path: `${OUT}/01-ouverture.png` });
await page.locator('input[name="email"]').fill('essai.interne@exemple.test'); await page.locator('input[name="password"]').fill('Interne-2026-Essai');
await page.locator('button[type="submit"]').first().click();
for (let i = 0; i < 20 && (await page.content()).includes('name="password"'); i += 1) await a(1000);
if ((await page.content()).includes('name="password"')) console.log('connexion refusée :', (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 300));
await a(2500); await page.mouse.click(720, 500); await a(800);
await page.evaluate(() => { window.location.hash = '#/salle'; }); await a(2500);
ok('1. la Salle de contrôle s’ouvre dans l’app empaquetée', await salleVisible(page), await ou(page));
await page.screenshot({ path: `${OUT}/02-salle.png` });
// Fermeture complète du processus, Salle affichée.
await app.close(); await a(1500);

// 2. Réouverture : où arrive-t-on, et peut-on sortir ?
({ app, page } = await lancer());
const arrivee = await ou(page); const surSalle = await salleVisible(page);
console.log(`réouverture : hash ${arrivee}, Salle affichée : ${surSalle}`);
await page.screenshot({ path: `${OUT}/03-reouverture.png` });
ok('2. à la réouverture, l’app ne se rouvre pas sur la Salle', !surSalle, arrivee);
if (surSalle) {
  await page.mouse.move(300, 300); await page.mouse.move(600, 400); await a(800);
  ok('   (bug) un mouvement de souris ne fait rien sur la Salle, par conception', await salleVisible(page));
  await page.keyboard.press('Escape'); await a(1200);
  ok('   Échap sort de la Salle', !(await salleVisible(page)), await ou(page));
  if (await salleVisible(page)) { await page.locator('button', { hasText: 'Quitter' }).click(); await a(1200); ok('   « Quitter » sort de la Salle', !(await salleVisible(page)), await ou(page)); }
  await page.screenshot({ path: `${OUT}/04-apres-echap.png` });
}
// 3. Depuis un poste normal : entrer dans la Salle puis Échap, doit revenir au poste.
if (!(await salleVisible(page))) {
  await page.evaluate(() => { window.location.hash = '#/salle'; }); await a(2000);
  await page.keyboard.press('Escape'); await a(1500);
  ok('3. Salle → Échap ramène au poste', !(await salleVisible(page)), await ou(page));
  await page.evaluate(() => { window.location.hash = '#/salle'; }); await a(2000);
  await page.locator('button', { hasText: 'Quitter' }).click(); await a(1500);
  ok('   Salle → « Quitter » ramène au poste', !(await salleVisible(page)), await ou(page));
  await page.screenshot({ path: `${OUT}/05-retour-poste.png` });
}
await app.close();
console.log('erreurs :', erreurs.length, erreurs);
process.exit(erreurs.length ? 1 : 0);
