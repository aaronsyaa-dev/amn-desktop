/* Tour de contrôle (édition interne) : la file des demandes, les alertes d'entrée, le bouton « Bienvenue » du dossier. */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || '/tmp/e2e/soir';
const API = 'http://127.0.0.1:4171';
const H = String(Date.now()).slice(-5);
// Une demande en attente et une tentative d'injection, écrites par la cliente (par l'API) juste avant.
const login = await (await fetch(`${API}/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'fleuriste.essai@exemple.test', password: 'Fleuriste-2026-Essai' }) })).json();
const auth = { Authorization: `Bearer ${login.token}`, 'Content-Type': 'application/json' };
await fetch(`${API}/v1/support/requests`, { method: 'POST', headers: auth, body: JSON.stringify({ kind: 'message', subject: `Facture ${H}`, body: 'Bonjour, je ne retrouve plus la facture de juillet. Pouvez-vous m’aider ?' }) });
await fetch(`${API}/v1/collections/clients/piege-${H}`, { method: 'PUT', headers: auth, body: JSON.stringify({ data: { id: `piege-${H}`, nom: `Robert'); DROP TABLE clients; --` } }) });

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('ERREUR PAGE:', String(e).slice(0, 200)));
await p.goto('http://127.0.0.1:4180/'); await a(2000);
await p.locator('input[name="email"]').fill('essai.interne@exemple.test');
await p.locator('input[name="password"]').fill('Interne-2026-Essai');
await p.locator('button[type="submit"]').first().click();
for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
await a(2500); await p.mouse.click(720, 860); await a(800);

await p.goto('http://127.0.0.1:4180/#/tour/organisations'); await a(2800);
let t = await p.evaluate(() => document.body.innerText);
console.log('file visible ?', /Demandes|À traiter/.test(t), '| ma demande listée ?', t.includes(`Facture ${H}`), '| alertes d’entrée visibles ?', /Alertes d’entrée|Tentatives|sql_injection|Injection SQL/.test(t));
await p.screenshot({ path: `${OUT}/tour-01-file.png`, fullPage: false });
await p.screenshot({ path: `${OUT}/tour-01-file-page.png`, fullPage: true });

// Répondre depuis la file
const ligne = p.locator(`text=Facture ${H}`).first();
if (await ligne.count()) {
  await ligne.scrollIntoViewIfNeeded(); await a(400);
  const repondre = p.locator('button:has-text("Répondre")').first();
  if (await repondre.count()) { await repondre.click(); await a(600); }
  const zone = p.locator('textarea').first();
  if (await zone.count()) {
    await zone.fill('La facture de juillet est dans Factures → filtre « Juillet ». Je vous l’ai aussi remise en tête de liste.');
    await p.screenshot({ path: `${OUT}/tour-02-reponse.png` });
    await p.locator('button:has-text("Envoyer la réponse")').first().click(); await a(1800);
  }
  t = await p.evaluate(() => document.body.innerText);
  console.log('après réponse : ma ligne a quitté « à traiter » ?', !t.includes(`Facture ${H}`));
  await p.locator('button:has-text("Répondu")').first().click(); await a(1200);
  t = await p.evaluate(() => document.body.innerText);
  console.log('dans « répondu » avec ma réponse ?', t.includes(`Facture ${H}`) && /filtre « Juillet »/.test(t));
  await p.screenshot({ path: `${OUT}/tour-03-repondu.png` });
  await p.locator('button:has-text("À traiter")').first().click(); await a(600);
}

// Le dossier d'une organisation : le bouton « Bienvenue » par compte
const dossier = p.locator('button:has-text("Dossier")').first();
await dossier.scrollIntoViewIfNeeded(); await dossier.click(); await a(2000);
t = await p.evaluate(() => document.body.innerText);
console.log('dossier ouvert ?', /Places|Comptes/.test(t), '| bouton Bienvenue ?', (await p.locator('button:has-text("Bienvenue")').count()) > 0, '| select Places ?', (await p.locator('select').count()) > 0);
await p.screenshot({ path: `${OUT}/tour-04-dossier.png` });
await p.locator('button:has-text("Bienvenue")').first().scrollIntoViewIfNeeded(); await a(500);
await p.screenshot({ path: `${OUT}/tour-05-dossier-comptes.png` });
await nav.close();
