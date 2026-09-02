/* Membres : l'écran, la jauge des places, le blocage à la limite, la demande de place. */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('ERREUR PAGE:', String(e).slice(0, 200)));
const OUT = process.env.OUT || '/tmp/e2e/soir';
await p.goto('http://127.0.0.1:4180/'); await a(2000);
await p.locator('input[name="email"]').fill(process.env.E || 'fleuriste.essai@exemple.test');
await p.locator('input[name="password"]').fill(process.env.P || 'Fleuriste-2026-Essai');
await p.locator('button[type="submit"]').first().click();
for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
await a(2500); await p.mouse.click(720, 860); await a(700);
await p.goto('http://127.0.0.1:4180/#/membres'); await a(2200);
await p.screenshot({ path: `${OUT}/membres-01.png` });
let t = await p.evaluate(() => document.body.innerText);
console.log('jauge :', (t.match(/(\d+) sur (\d+)/) || [])[0], '| nav Membres ?', /Membres/.test(t));
const H = String(Date.now()).slice(-5);
// inviter jusqu'à la limite
for (let i = 0; i < 3; i += 1) {
  const btn = p.locator('button:has-text("Inviter un membre")');
  if (!(await btn.count())) break;
  await btn.click(); await a(400);
  await p.locator('input[placeholder="adresse@exemple.fr"]').fill(`invite${i}.${H}@exemple.test`);
  await p.locator('button:has-text("Émettre le lien")').click(); await a(1800);
  t = await p.evaluate(() => document.body.innerText);
  console.log(`invitation ${i} → jauge`, (t.match(/(\d+) sur (\d+)/) || [])[0], '| refus ?', /Toutes les places sont prises/.test(t));
  await p.screenshot({ path: `${OUT}/membres-0${i + 2}.png` });
  if (/Toutes les places sont prises \(/.test(t)) break;
}
// demander une place
const dem = p.locator('button:has-text("Demander une place de plus")');
if (await dem.count()) { await dem.click(); await a(1500); t = await p.evaluate(() => document.body.innerText); console.log('demande partie ?', /prestataire a été prévenu/.test(t)); }
await p.screenshot({ path: `${OUT}/membres-05-demande.png` });
await nav.close();
