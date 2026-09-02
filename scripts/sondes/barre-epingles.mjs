/* Bloc 8 : épingler « Atelier » ne le fait plus apparaître deux fois dans la barre. */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || '/tmp/e2e/soir';
const INTERNE = process.env.INTERNE || 'http://127.0.0.1:4181';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('ERREUR PAGE:', String(e).slice(0, 200)));
await p.goto(`${INTERNE}/`); await a(2000);
await p.locator('input[name="email"]').fill('essai.interne@exemple.test');
await p.locator('input[name="password"]').fill('Interne-2026-Essai');
await p.locator('button[type="submit"]').first().click();
for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
await a(2500); await p.mouse.click(720, 860); await a(800);
await p.goto(`${INTERNE}/#/tour/organisations`); await a(2000);
// Seules les lignes VISIBLES comptent : le tiroir du téléphone rend la même barre, repliée à zéro pixel.
const compter = async () => p.evaluate(() => [...document.querySelectorAll('nav a[aria-label="Atelier"]')].filter((e) => e.getBoundingClientRect().height > 0).length);
console.log('« Atelier » dans la barre avant épingle :', await compter());
const ligne = p.locator('nav a[aria-label="Atelier"]').first();
await ligne.hover(); await a(400);
const epingle = p.locator('nav [title="Épingler en haut"]').first();
if (await epingle.count()) { await epingle.click({ force: true }); await a(800); } else console.log('bouton d’épingle introuvable');
console.log('« Atelier » dans la barre après épingle :', await compter(), '| lignes courantes visibles :', await p.evaluate(() => [...document.querySelectorAll('nav a[aria-current="page"]')].filter((e) => e.getBoundingClientRect().height > 0).length));
await p.mouse.move(700, 500); await a(400);
await p.screenshot({ path: `${OUT}/barre-01-epingle.png` });
const sections = await p.evaluate(() => [...document.querySelectorAll('nav p.eyebrow')].map((e) => e.textContent));
console.log('sections :', sections.join(' · '));
// On détache pour laisser le poste d'essai propre
await ligne.hover(); await a(300);
const detacher = p.locator('nav [title="Détacher des épinglés"]').first();
if (await detacher.count()) { await detacher.click({ force: true }); await a(500); }
console.log('après détachement :', await compter());
await nav.close();
