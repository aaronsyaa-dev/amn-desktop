/* Casser exprès (Bloc 7), édition interne : le rechargement pendant la frappe dans Connaissances, et la coquille de support après le retrait de son fournisseur de toasts monté à la main. */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || 'docs/captures/supervision-2026-09-04';
const API = 'http://127.0.0.1:4171';
const WEB = 'http://127.0.0.1:4181';
const COMPTE = { email: 'essai.interne@exemple.test', password: 'Interne-2026-Essai' };
const H = Date.now().toString(36).slice(-4);
const jeton = (await (await fetch(`${API}/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(COMPTE) })).json()).token;
const lire = async (c) => (await (await fetch(`${API}/v1/collections/${c}`, { headers: { Authorization: `Bearer ${jeton}` } })).json()).records;

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const erreurs = [];
p.on('pageerror', (e) => erreurs.push(String(e).slice(0, 200)));
await p.goto(`${WEB}/`); await a(1800);
await p.locator('input[name="email"]').fill(COMPTE.email); await p.locator('input[name="password"]').fill(COMPTE.password);
await p.locator('button[type="submit"]').first().click();
for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
await a(2500); await p.mouse.click(720, 860); await a(600);

// 1. Connaissances : nouveau document, phrase tapée, rechargement cent millisecondes plus tard.
await p.goto(`${WEB}/#/knowledge`); await a(1500);
await p.locator('button:has-text("Nouveau document")').first().click(); await a(800);
const titre = p.locator('input[placeholder="Titre du document"]').first();
await titre.fill(`Procédure casser ${H}`); await a(900);
const PHRASE = `Phrase tapée juste avant le rechargement ${H}`;
await p.locator('textarea').first().fill(PHRASE); await a(100);
await p.reload(); await a(2500); await p.mouse.click(720, 860); await a(800);
const doc = (await lire('knowledge')).find((r) => r.data.title === `Procédure casser ${H}`);
console.log('1. Connaissances : document créé ?', Boolean(doc), '| phrase tapée 100 ms avant le rechargement sur le serveur ?', doc?.data.body === PHRASE);
await p.screenshot({ path: `${OUT}/20-casser-connaissances.png` });

// 2. La coquille de support : entrer chez une cliente par le rail.
const rail = p.locator('aside button, [class*=rail] button').filter({ hasText: /^[A-Z]{2}$/ });
const n = await rail.count();
if (n) {
  await rail.first().click(); await a(2200);
  const h1 = await p.evaluate(() => document.querySelector('h1')?.innerText ?? '(aucun h1)');
  console.log(`2. coquille de support : ${n} clientes au rail | entrée chez la première : h1 = ${JSON.stringify(h1)} | bandeau de contexte ?`, /Contexte|support|espace de/i.test(await p.evaluate(() => document.body.innerText)));
  await p.goto(`${WEB}/#/notes`); await a(1500);
  console.log('   notes de la cliente rendues ?', /Notes/.test(await p.evaluate(() => document.querySelector('h1')?.innerText ?? '')));
  await p.screenshot({ path: `${OUT}/21-casser-coquille-support.png` });
} else console.log('2. coquille de support : aucune cliente au rail');
// Ménage.
if (doc) await fetch(`${API}/v1/collections/knowledge/${doc.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${jeton}` } });
console.log('erreurs de page :', erreurs.length, erreurs.slice(0, 2));
await nav.close();
