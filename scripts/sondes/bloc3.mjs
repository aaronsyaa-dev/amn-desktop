/* Bloc 3 — cartes (quoi / pour qui / exemple), présentation à la première ouverture, alléger / rajouter ma barre (poste + téléphone, mémorisé par personne). */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || 'docs/captures/supervision-2026-09-04';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const connecter = async (p, base, email, mdp, clic) => {
  await p.goto(`${base}/`); await a(1800);
  await p.locator('input[name="email"]').fill(email); await p.locator('input[name="password"]').fill(mdp);
  await p.locator('button[type="submit"]').first().click();
  for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
  await a(2500); await p.mouse.click(...clic); await a(600);
};
const texte = (p) => p.evaluate(() => document.body.innerText);
// Les liens de navigation hors contenu : barre latérale + lanceur, jamais l'écran lui-même.
const barre = (p) => p.evaluate(() => [...document.querySelectorAll('a[href^="#/"]')].filter((x) => !x.closest('main')).map((x) => x.getAttribute('href')));

const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('ERREUR PAGE:', String(e).slice(0, 160)));
await connecter(p, 'http://127.0.0.1:4180', 'fleuriste.essai@exemple.test', 'Fleuriste-2026-Essai', [720, 860]);
// Repartir propre : rien d'allégé, aucune présentation vue.
await p.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('amn.nav.alleges') || k.startsWith('amn.presentation')) localStorage.removeItem(k); });
await p.goto('http://127.0.0.1:4180/#/decouvrir'); await a(2500);
let t = await texte(p);
console.log('Découvrir : cartes ?', /Pour qui/.test(t), '| exemple sur Sondages ?', /Fermeture estivale/.test(t), '| bouton Alléger ma barre ?', (await p.locator('button:has-text("Alléger ma barre")').count()) > 0);
await p.screenshot({ path: `${OUT}/07-decouvrir-cartes.png` });

// 1. Première ouverture : Sondages
await p.goto('http://127.0.0.1:4180/#/sondages'); await a(2000);
t = await texte(p);
console.log('Sondages, première fois : présentation ?', /PREMIÈRE OUVERTURE/i.test(t), '| quoi ?', /Une question, un vote par personne/.test(t), '| bouton Compris ?', (await p.locator('button:has-text("Compris")').count()) > 0);
await p.screenshot({ path: `${OUT}/08-premiere-ouverture.png` });
await p.locator('button:has-text("Compris")').first().click(); await a(600);
await p.reload(); await a(2500); await p.mouse.click(720, 860); await a(400);
console.log('après Compris + rechargement : présentation revenue ?', /PREMIÈRE OUVERTURE/i.test(await texte(p)));

// 2. Alléger ma barre : Sondages quitte la barre latérale
const avant = await barre(p);
await p.goto('http://127.0.0.1:4180/#/decouvrir'); await a(2000);
await p.locator('button:has-text("Alléger ma barre")').click(); await a(600);
const tuile = p.locator('button[aria-pressed]').filter({ hasText: 'Sondages' }).first();
await tuile.evaluate((el) => el.scrollIntoView({ block: 'center' })); await a(300);
console.log('mode alléger : tuile Sondages :', (await tuile.innerText()).split('\n').pop());
await tuile.click(); await a(1200);
console.log('après clic :', (await tuile.innerText()).split('\n').pop(), '| opacité :', await tuile.evaluate((el) => getComputedStyle(el).opacity));
await p.screenshot({ path: `${OUT}/09-alleger-ma-barre.png` });
await p.locator('button:has-text("Terminer")').click(); await a(500);
const apres = await barre(p);
console.log('barre latérale : lien #/sondages avant ?', avant.includes('#/sondages'), '→ après ?', apres.includes('#/sondages'), `(${avant.length} → ${apres.length} liens)`);
await p.reload(); await a(2600); await p.mouse.click(720, 860); await a(400);
console.log('après rechargement : lien #/sondages dans la barre ?', (await barre(p)).includes('#/sondages'), '| adresse directe ouvre encore ?', await (async () => { await p.goto('http://127.0.0.1:4180/#/sondages'); await a(1500); return /Sondages/.test(await p.evaluate(() => document.querySelector('h1')?.innerText ?? '')); })());
const login = await (await fetch('http://127.0.0.1:4171/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'fleuriste.essai@exemple.test', password: 'Fleuriste-2026-Essai' }) })).json();
const prefs = await (await fetch('http://127.0.0.1:4171/v1/auth/me/prefs', { headers: { Authorization: `Bearer ${login.token}` } })).json();
console.log('préférence côté serveur nav-alleges :', JSON.stringify(prefs.prefs['nav-alleges']));

// 3. Téléphone : la même personne, même barre allégée (le serveur fait foi)
const m = await (await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
await connecter(m, 'http://127.0.0.1:4180', 'fleuriste.essai@exemple.test', 'Fleuriste-2026-Essai', [195, 420]);
await a(1500);
await m.locator('nav[aria-label="Navigation principale"] button').last().tap(); await a(1200);
const lanceur = await m.evaluate(() => [...document.querySelectorAll('[role="dialog"] a[href^="#/"]')].map((x) => x.textContent.trim()));
console.log('téléphone, lanceur : Sondages présent ?', lanceur.some((s) => /Sondages/.test(s)), `(${lanceur.length} tuiles)`);
await m.screenshot({ path: `${OUT}/10-telephone-barre-allegee.png` });

// 4. Rajouter, pour laisser le décor propre
await p.goto('http://127.0.0.1:4180/#/decouvrir'); await a(2000);
await p.locator('button:has-text("Alléger ma barre")').click(); await a(500);
const t2 = p.locator('button[aria-pressed]').filter({ hasText: 'Sondages' }).first();
await t2.evaluate((el) => el.scrollIntoView({ block: 'center' })); await a(300); await t2.click(); await a(1000);
await p.locator('button:has-text("Terminer")').click(); await a(500);
console.log('rajouté : lien #/sondages dans la barre ?', (await barre(p)).includes('#/sondages'));
await nav.close();
