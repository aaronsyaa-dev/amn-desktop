/* Le lien de bienvenue, de bout en bout : accueil → politique → accès → confirmation → connexion. */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || '/tmp/e2e/soir';
const API = 'http://127.0.0.1:4171';
const TOK = 'test-operator-token';
const H = String(Date.now()).slice(-5);
const EMAIL = `bienvenue.${H}@exemple.test`;

// Un compte invité dans Atelier London (org d'essai), puis un lien émis par la console.
const orgs = await (await fetch(`${API}/v1/admin/organizations`, { headers: { Authorization: `Bearer ${TOK}` } })).json();
const org = orgs.organizations.find((o) => o.name.startsWith('Atelier London'));
// La propriétaire d'Atelier London invite : c'est le vrai chemin, et il respecte les places.
const proprietaire = await (await fetch(`${API}/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'atelier.london.0831@exemple.test', password: 'London-2026-Essai' }) })).json();
const inv = await (await fetch(`${API}/v1/auth/invitations`, { method: 'POST', headers: { Authorization: `Bearer ${proprietaire.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, role: 'member' }) })).json();
if (!inv.user) { console.log('invitation refusée :', inv); process.exit(1); }
const users = await (await fetch(`${API}/v1/admin/organizations/${org.id}/users`, { headers: { Authorization: `Bearer ${TOK}` } })).json();
const user = users.users.find((u) => u.email === EMAIL);
const emis = await (await fetch(`${API}/v1/admin/organizations/${org.id}/welcome-links`, { method: 'POST', headers: { Authorization: `Bearer ${TOK}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id }) })).json();
console.log('lien émis :', emis.url);

const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('ERREUR PAGE:', String(e).slice(0, 200)));
await p.goto(emis.url); await a(2500);
await p.screenshot({ path: `${OUT}/bienvenue-01-accueil.png` });
let t = await p.evaluate(() => document.body.innerText);
console.log('accueil : Bienvenue ?', /Bienvenue/.test(t), '| usage unique ?', /usage unique/.test(t), '| jeton retiré de l’adresse ?', !p.url().includes('token='));
const bouton = p.locator('button:has-text("Afficher mes accès")');
console.log('bouton inactif avant politique ?', await bouton.isDisabled());
await p.locator('input[type="checkbox"]').check(); await a(300);
await bouton.click(); await a(2000);
await p.screenshot({ path: `${OUT}/bienvenue-02-acces.png` });
t = await p.evaluate(() => document.body.innerText);
const mdp = (t.match(/MOT DE PASSE TEMPORAIRE\n([^\n]+)/i) || [])[1]?.trim();
console.log('accès : identifiant ?', t.includes(EMAIL), '| mot de passe lu ?', Boolean(mdp), '| chemin Mac/téléphone ?', /navigateur/.test(t));
await p.locator('button:has-text("J’ai bien reçu mes accès")').click(); await a(1800);
await p.screenshot({ path: `${OUT}/bienvenue-03-fini.png` });
t = await p.evaluate(() => document.body.innerText);
console.log('fini : lien détruit ?', /détruit/.test(t));
// Le lien rouvert ne donne plus rien
await p.goto(emis.url); await a(1800);
t = await p.evaluate(() => document.body.innerText);
console.log('rouvert : déjà servi ?', /déjà servi/.test(t));
await p.screenshot({ path: `${OUT}/bienvenue-04-rouvert.png` });
// Et le mot de passe ouvre la porte
await p.goto('http://127.0.0.1:4180/#/login'); await a(1500);
await p.locator('input[name="email"]').fill(EMAIL);
await p.locator('input[name="password"]').fill(mdp);
await p.locator('button[type="submit"]').first().click();
for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
await a(3500); await p.mouse.click(720, 860); await a(1200);
t = await p.evaluate(() => document.body.innerText);
console.log('connexion avec le mot de passe affiché : accueil ?', /Atelier London/.test(t) && !/Se connecter/.test(t));
await p.screenshot({ path: `${OUT}/bienvenue-05-connectee.png` });
await nav.close();
