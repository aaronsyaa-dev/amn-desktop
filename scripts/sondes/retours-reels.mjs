/* Les six retours réels du 2 septembre, rejoués sur les deux surfaces web (interne :4181, cliente :4180). */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || '/tmp/e2e/nuit2';
const API = 'http://127.0.0.1:4171'; const OP = { Authorization: 'Bearer test-operator-token', 'Content-Type': 'application/json' };
const H = String(Date.now()).slice(-5);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const connecter = async (p, base, email, mdp) => {
  await p.goto(`${base}/`); await a(1800);
  await p.locator('input[name="email"]').fill(email); await p.locator('input[name="password"]').fill(mdp);
  await p.locator('button[type="submit"]').first().click();
  for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
  await a(2500); await p.mouse.click(720, 860); await a(700);
};
const texte = (p) => p.evaluate(() => document.body.innerText);

/* ── Interne ── */
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('ERREUR PAGE:', String(e).slice(0, 160)));
await connecter(p, 'http://127.0.0.1:4181', 'essai.interne@exemple.test', 'Interne-2026-Essai');

// 6. Épinglés évidents
await p.goto('http://127.0.0.1:4181/#/tour/organisations'); await a(1800);
await p.locator('nav a[aria-label="Atelier"]').first().hover(); await a(300);
await p.locator('nav [title="Épingler en haut"]').first().click({ force: true }); await a(600);
await p.mouse.move(700, 500); await a(300);
let t = await texte(p);
console.log('6. bande « Épinglés » nommée ?', /ÉPINGLÉS|Épinglés/.test(t), '| Atelier visible une fois ?', (await p.locator('nav a[aria-label="Atelier"]').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height > 0).length)) === 1);
await p.screenshot({ path: `${OUT}/retours-06-epingles.png` });
await p.locator('nav [title="Détacher des épinglés"]').first().click({ force: true }); await a(400);

// 3. Une organisation créée par Mohamed apparaît sans recharger
const avant = await texte(p);
const nom = `Née par Mohamed ${H}`;
const creation = await (await fetch(`${API}/v1/admin/organizations`, { method: 'POST', headers: OP, body: JSON.stringify({ name: nom, plan: 'business_standard', seats: 2 }) })).json();
await a(2500);
t = await texte(p);
console.log('3. absente avant ?', !avant.includes(nom), '| présente 2,5 s après, sans rechargement ?', t.includes(nom));
await p.locator(`text=${nom}`).first().scrollIntoViewIfNeeded().catch(() => {}); await a(300);
await p.screenshot({ path: `${OUT}/retours-03-org-en-direct.png` });

// 4. La Tour entend une cliente pendant qu'Aaron regarde une AUTRE cliente
const avatar = p.locator('button[aria-label*="Née par Mohamed"], button[aria-label*="Atelier London"]').first();
if (await avatar.count()) { await avatar.click(); await a(2500); }
t = await texte(p);
console.log('4. contexte client ouvert ?', /Atelier London|Née par Mohamed/.test(t.split('\n').slice(0, 12).join(' ')));
const login = await (await fetch(`${API}/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'fleuriste.essai@exemple.test', password: 'Fleuriste-2026-Essai' }) })).json();
await fetch(`${API}/v1/support/requests`, { method: 'POST', headers: { Authorization: `Bearer ${login.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'message', subject: `Urgent ${H}`, body: 'Je n’arrive pas à imprimer une facture.' }) });
await a(1500);
t = await texte(p);
console.log('   demande reçue pendant le contexte client (toast « Demande — ») ?', /Demande — /.test(t));
await p.screenshot({ path: `${OUT}/retours-04-tour-en-contexte.png` });
// On quitte le contexte client avant de continuer sur les écrans internes.
const quitter = p.locator('button:has-text("Quitter")').first();
if (await quitter.count()) { await quitter.click(); await a(2500); }

// 5. Titres d'incidents en entier
await p.goto('http://127.0.0.1:4181/#/supervision'); await a(2500);
const coupes = await p.locator('h2.truncate').count();
const lignes = await p.evaluate(() => [...document.querySelectorAll('h2')].map((h) => h.textContent?.trim() ?? '').filter((s) => s.length > 60).slice(0, 2));
console.log('5. titres tronqués (h2.truncate) :', coupes, '| exemples longs lisibles :', lignes.map((l) => l.slice(0, 70) + '…'));
await p.screenshot({ path: `${OUT}/retours-05-titres.png` });

// 2. Équipe : membres réels, dernière connexion, historique
await p.goto('http://127.0.0.1:4181/#/team'); await a(2500);
t = await texte(p);
console.log('2. membres réels (essai.interne) ?', t.includes('essai.interne') || /Essai/.test(t), '| « Connecté il y a » ou « En ligne » ?', /Connecté il y a|En ligne|Jamais connecté/.test(t));
await p.screenshot({ path: `${OUT}/retours-02-equipe.png` });
const fiche = p.locator('button[aria-label^="Historique de"]').first();
if (await fiche.count()) { await fiche.click(); await a(1800); t = await texte(p); console.log('   historique : ouvert ?', /Historique de/.test(t), '| ligne Connexion ?', /Connexion/.test(t)); await p.screenshot({ path: `${OUT}/retours-02b-historique.png` }); }

/* ── Cliente ── */
const c = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
c.on('pageerror', (e) => console.log('ERREUR PAGE:', String(e).slice(0, 160)));
await connecter(c, 'http://127.0.0.1:4180', 'fleuriste.essai@exemple.test', 'Fleuriste-2026-Essai');
await c.goto('http://127.0.0.1:4180/#/membres'); await a(2200);
t = await texte(c);
console.log('1. Membres : bouton Retirer ?', (await c.locator('button:has-text("Retirer")').count()) > 0, '| places :', (t.match(/\d+ sur \d+|\d+ \/ \d+/) ?? [''])[0]);
const retirer = c.locator('button:has-text("Retirer")').first();
if (await retirer.count()) {
  await retirer.click(); await a(600);
  t = await texte(c);
  console.log('   confirmation posée ?', /Retirer .*\?/.test(t) && /place est libérée/.test(t));
  await c.screenshot({ path: `${OUT}/retours-01-retirer-confirmation.png` });
  await c.locator('button:has-text("Retirer ce compte")').first().click(); await a(2000);
  t = await texte(c);
  console.log('   retiré ?', /a été retiré/.test(t), '| places après :', (t.match(/\d+ sur \d+|\d+ \/ \d+/) ?? [''])[0]);
  await c.screenshot({ path: `${OUT}/retours-01b-retire.png` });
}
await nav.close();
