/* Vague 6 — Supervision du parc (édition interne) : maturité, comparatif, alertes personnalisées, rapport client. */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || '/tmp/e2e/nuit2';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('ERREUR PAGE:', String(e).slice(0, 200)));
await p.goto('http://127.0.0.1:4181/'); await a(1800);
await p.locator('input[name="email"]').fill('essai.interne@exemple.test'); await p.locator('input[name="password"]').fill('Interne-2026-Essai');
await p.locator('button[type="submit"]').first().click(); await a(4000); await p.mouse.click(720, 860); await a(700);
const texte = () => p.evaluate(() => document.body.innerText);
let t;
// Maturité
await p.goto('http://127.0.0.1:4181/#/maturite-soc'); await a(3500); t = await texte();
console.log('maturité : organisations lues, niveaux affichés, signaux avec chiffres ?', /Organisations\s*\n?\s*[1-9]/i.test(t), /Fragile|En progrès|Solide/i.test(t), /\d+\/6/.test(t) && /\d+\/30/.test(t));
await p.screenshot({ path: `${OUT}/v6-maturite.png` });
// Comparatif
await p.goto('http://127.0.0.1:4181/#/comparatif'); await a(3500); t = await texte();
const lignes = await p.locator('tbody tr').count();
await p.locator('th button:has-text("Organisation")').first().click(); await a(400);
const premiere = await p.locator('tbody tr th').first().innerText();
console.log('comparatif : lignes par organisation, tri par nom ?', lignes >= 2, premiere);
await p.screenshot({ path: `${OUT}/v6-comparatif.png` });
// Alertes personnalisées : règle « silencieuse depuis 1 jour » (le parc d'essai dort) → déclenchée
await p.goto('http://127.0.0.1:4181/#/alertes-personnalisees'); await a(2500);
await p.locator('button:has-text("Nouvelle règle")').first().click(); await a(400);
await p.locator('select').first().selectOption('silence'); await p.locator('input[inputmode="numeric"]').fill('1');
await p.locator('button:has-text("Créer la règle")').click(); await a(2500); t = await texte();
console.log('alertes perso : règle créée et déclenchée sur au moins une organisation ?', /Règles\s*\n?\s*[1-9]/i.test(t), /Déclenchées\s*\n?\s*[0-9]+/i.test(t), /silencieuse depuis/.test(t));
await p.screenshot({ path: `${OUT}/v6-alertes-perso.png` });
// Rapport client : choisir la première organisation, sections là, copier
await p.goto('http://127.0.0.1:4181/#/rapport-client'); await a(3500); t = await texte();
console.log('rapport client : identité, activité, maturité composées ?', /Identité/i.test(t), /Jours actifs/i.test(t), /Maturité SOC/i.test(t) && /\d\/6/.test(t));
await p.locator('button:has-text("Copier en Markdown")').click(); await a(600); t = await texte();
console.log('rapport client : copié ?', /Copié/.test(t));
await p.screenshot({ path: `${OUT}/v6-rapport-client.png` });
// Édition cliente : ces modules n'existent pas
const c = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await c.goto('http://127.0.0.1:4180/'); await a(1800);
await c.locator('input[name="email"]').fill('fleuriste.essai@exemple.test'); await c.locator('input[name="password"]').fill('Fleuriste-2026-Essai');
await c.locator('button[type="submit"]').first().click(); await a(4000); await c.mouse.click(720, 860); await a(700);
await c.goto('http://127.0.0.1:4180/#/maturite-soc'); await a(1500); const tc = await c.evaluate(() => document.body.innerText);
console.log('édition cliente : la maturité n’existe pas chez elle ?', !/Maturité SOC/.test(tc));
// Téléphone
const m = await (await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
await m.goto('http://127.0.0.1:4181/'); await a(1800);
await m.locator('input[name="email"]').fill('essai.interne@exemple.test'); await m.locator('input[name="password"]').fill('Interne-2026-Essai');
await m.locator('button[type="submit"]').first().click(); await a(4000); await m.mouse.click(195, 420); await a(600);
for (const [chemin, nom] of [['maturite-soc', 'maturite'], ['comparatif', 'comparatif']]) {
  await m.goto(`http://127.0.0.1:4181/#/${chemin}`); await a(3000); await m.mouse.click(195, 420); await a(400);
  const large = await m.evaluate(() => document.documentElement.scrollWidth);
  console.log(`téléphone ${nom} : largeur ≤ 390 ?`, large <= 390);
  await m.screenshot({ path: `${OUT}/v6-${nom}-telephone.png` });
}
await nav.close();
