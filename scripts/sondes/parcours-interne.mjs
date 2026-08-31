/* Parcours réels — édition interne : tour, organisations, supervision (prise d'incident), salle. */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const shot = (n) => p.screenshot({ path: `/tmp/e2e/chasse/${n}.png` });
p.on('pageerror', (e) => console.log('ERREUR PAGE:', String(e).slice(0, 200)));

await p.goto('http://127.0.0.1:4180/'); await a(2000);
await p.locator('input[name="email"]').fill('essai.interne@exemple.test');
await p.locator('input[name="password"]').fill('Interne-2026-Essai');
await p.locator('button[type="submit"]').first().click();
for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
await a(2500); await p.mouse.click(720, 860); await a(800);

// 1. Tour de contrôle — le relevé « Actives » sans flèche
await p.goto('http://127.0.0.1:4180/#/tour'); await a(2500);
await shot('01-tour');
let txt = await p.evaluate(() => document.body.innerText);
console.log('TOUR: flèche résiduelle ?', /[↑↓]/.test(txt), '| « Actives » présent ?', /Actives/.test(txt));

// 2. Organisations
await p.goto('http://127.0.0.1:4180/#/tour/organisations'); await a(2200);
await shot('02-organisations');
txt = await p.evaluate(() => document.body.innerText);
console.log('ORGS: flèche ?', /[↑↓]/.test(txt), '| Atelier London listé ?', txt.includes('Atelier London'));

// 3. Supervision — prendre le premier incident critique non pris
await p.goto('http://127.0.0.1:4180/#/supervision'); await a(2500);
await shot('03-supervision-avant');
const prendre = p.locator('button:has-text("Prendre")').first();
if (await prendre.count()) {
  await prendre.click(); await a(1500);
  await shot('04-supervision-apres-prise');
  txt = await p.evaluate(() => document.body.innerText);
  console.log('SUPERVISION: prise faite — « Pris » ou nom visible ?', /Pris|pris par|Essai/.test(txt));
} else {
  txt = await p.evaluate(() => document.body.innerText);
  console.log('SUPERVISION: aucun bouton « Prendre » — libellé réel ?');
  console.log(txt.split('\n').filter((l) => /incident|prendre|acquitt|résoudre/i.test(l)).slice(0, 6));
}

// 4. La bascule d'organisation par le rail : ouvrir le dossier d'une cliente
await p.goto('http://127.0.0.1:4180/#/'); await a(1500);
const avatarCliente = p.locator('aside button, [class*=rail] button').filter({ hasText: /^AL$|^FD$/ }).first();
const railBtns = await p.locator('button:has-text("AL")').count();
console.log('RAIL: bouton AL trouvé ?', railBtns);
if (railBtns) {
  await p.locator('button:has-text("AL")').first().click(); await a(1800);
  await shot('05-dossier-cliente');
  txt = await p.evaluate(() => document.body.innerText);
  console.log('DOSSIER: Atelier London ouvert ?', txt.includes('Atelier London'));
}

// 5. La salle de contrôle (veille)
await p.goto('http://127.0.0.1:4180/#/salle'); await a(2500);
await shot('06-salle');
console.log('SALLE: rendue');
await nav.close();
