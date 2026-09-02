/* La Bibliothèque : trois vues — interne (Bibliothèque), dossier d'une cliente (composer), cliente (Découvrir + demander). */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || '/tmp/e2e/nuit2';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const connecter = async (p, base, email, mdp) => {
  await p.goto(`${base}/`); await a(1800);
  await p.locator('input[name="email"]').fill(email); await p.locator('input[name="password"]').fill(mdp);
  await p.locator('button[type="submit"]').first().click();
  for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
  await a(2500); await p.mouse.click(720, 860); await a(700);
};
const texte = (p) => p.evaluate(() => document.body.innerText);

const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('ERREUR PAGE:', String(e).slice(0, 160)));
await connecter(p, 'http://127.0.0.1:4181', 'essai.interne@exemple.test', 'Interne-2026-Essai');
await p.goto('http://127.0.0.1:4181/#/bibliotheque'); await a(2200);
let t = await texte(p);
const sections = await p.evaluate(() => [...document.querySelectorAll('section[aria-label]')].map((s) => s.getAttribute('aria-label')));
console.log('interne : titre Bibliothèque ?', /Bibliothèque/.test(t), '| sections :', sections.join(' · '), '| tuiles :', await p.locator('section[aria-label] a').count());
await p.screenshot({ path: `${OUT}/biblio-01-interne.png` });
await p.screenshot({ path: `${OUT}/biblio-01-interne-page.png`, fullPage: true });
await p.locator('input[type="search"]').fill('fact'); await a(500);
console.log('recherche « fact » : tuiles restantes :', await p.locator('section[aria-label] a').count());
await p.screenshot({ path: `${OUT}/biblio-02-recherche.png` });
await p.locator('input[type="search"]').fill('');

// Le dossier d'une cliente : composer
await p.goto('http://127.0.0.1:4181/#/tour/organisations'); await a(2200);
const dossier = p.locator('button:has-text("Dossier")').first();
await dossier.scrollIntoViewIfNeeded(); await dossier.click(); await a(2000);
const grille = p.locator('[role="dialog"] button[aria-pressed], button[aria-pressed]').first();
await grille.scrollIntoViewIfNeeded(); await a(500);
console.log('dossier : tuiles à composer :', await p.locator('button[aria-pressed]').count(), '| inclus verrouillés :', await p.locator('button[aria-pressed][disabled]').count());
await p.screenshot({ path: `${OUT}/biblio-03-dossier-composer.png` });
const compter = () => p.locator('[role="dialog"] button[aria-pressed="true"]:not([disabled])').count();
const avant = await compter();
const cible = p.locator('[role="dialog"] button[aria-pressed="true"]:not([disabled])').first();
const nomCible = await cible.locator('span.text-sm').first().innerText();
await cible.evaluate((el) => el.scrollIntoView({ block: 'center' })); await a(400);
await cible.click(); await a(2000);
const apres = await compter();
console.log(`un clic ferme « ${nomCible} » :`, avant, '→', apres, '| dialogue toujours ouvert ?', (await p.locator('[role="dialog"]').count()) > 0);
const rouvrir = p.locator('[role="dialog"] button[aria-pressed="false"]:not([disabled])').first();
await rouvrir.evaluate((el) => el.scrollIntoView({ block: 'center' })); await a(300); await rouvrir.click(); await a(2000);
console.log('un second clic le rouvre :', await compter());

// La cliente : Découvrir
const c = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
c.on('pageerror', (e) => console.log('ERREUR PAGE:', String(e).slice(0, 160)));
await connecter(c, 'http://127.0.0.1:4180', 'atelier.london.0831@exemple.test', 'London-2026-Essai');
await c.goto('http://127.0.0.1:4180/#/decouvrir'); await a(2500);
t = await texte(c);
console.log('cliente (Atelier London, en anglais) : Discover ?', /Discover/.test(t), '| Open/Included/Available ?', /Open/.test(t), /Included/.test(t), /Available/.test(t), '| boutons Ask for it :', await c.locator('button:has-text("Ask for it")').count());
await c.screenshot({ path: `${OUT}/biblio-04-decouvrir.png` });
const dem = c.locator('button:has-text("Ask for it")').first();
if (await dem.count()) { await dem.click(); await a(1800); t = await texte(c); console.log('   après Ask for it : « Requested » ?', /Requested/.test(t)); await c.screenshot({ path: `${OUT}/biblio-05-demande.png` }); }
// Téléphone
const m = await (await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
await connecter(m, 'http://127.0.0.1:4180', 'fleuriste.essai@exemple.test', 'Fleuriste-2026-Essai');
await m.goto('http://127.0.0.1:4180/#/decouvrir'); await a(2500);
await m.screenshot({ path: `${OUT}/biblio-06-decouvrir-telephone.png` });
console.log('téléphone : largeur de page ≤ 390 ?', (await m.evaluate(() => document.documentElement.scrollWidth)) <= 390);
await nav.close();
