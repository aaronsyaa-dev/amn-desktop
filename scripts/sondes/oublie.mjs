/* Mot de passe oublié : le geste sur la connexion, le message honnête, la ligne dans la file. */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || '/tmp/e2e/soir';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto('http://127.0.0.1:4180/#/login'); await a(1800);
await p.locator('button:has-text("Mot de passe oublié")').click(); await a(600);
await p.screenshot({ path: `${OUT}/oublie-01.png` });
let t = await p.evaluate(() => document.body.innerText);
console.log('formulaire : consigne ?', /prestataire sera prévenu/.test(t), '| carte de connexion masquée ?', !/Se connecter/.test(t));
await p.locator('input[type="email"]').fill('fleuriste.essai@exemple.test');
await p.locator('button:has-text("Prévenir mon prestataire")').click(); await a(1500);
await p.screenshot({ path: `${OUT}/oublie-02.png` });
t = await p.evaluate(() => document.body.innerText);
console.log('après envoi :', /prestataire a été prévenu/.test(t));
const file = await (await fetch('http://127.0.0.1:4171/v1/admin/support-requests?status=pending', { headers: { Authorization: 'Bearer test-operator-token' } })).json();
console.log('dans la file :', file.requests.filter((r) => r.kind === 'password_reset').map((r) => `${r.requestedByEmail} (${r.orgName})`).slice(0, 2));
await nav.close();
