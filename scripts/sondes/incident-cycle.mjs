/* Le cycle de vie d'un incident, exercé pour de vrai : prise → clôture. */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('ERREUR PAGE:', String(e).slice(0, 200)));
await p.goto('http://127.0.0.1:4180/'); await a(2000);
await p.locator('input[name="email"]').fill('essai.interne@exemple.test');
await p.locator('input[name="password"]').fill('Interne-2026-Essai');
await p.locator('button[type="submit"]').first().click();
for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
await a(2500); await p.mouse.click(720, 860); await a(700);
await p.goto('http://127.0.0.1:4180/#/supervision'); await a(2500);

const compteur = async (nom) => {
  const t = await p.evaluate(() => document.body.innerText);
  const m = t.match(new RegExp(nom + '\\n(\\d+)'));
  return m ? Number(m[1]) : null;
};
const avantATraiter = await compteur('À TRAITER');
const avantEnCours = await compteur('EN COURS');
console.log('avant : à traiter', avantATraiter, '| en cours', avantEnCours);

// PRISE — le premier « Je m'en occupe »
const premierTitre = await p.locator('main li, main [class*=incident], main article').first().innerText().catch(() => '');
await p.locator('button:has-text("Je m’en occupe"), button:has-text("Je m’en occupe")').first().click();
await a(2000);
const apresATraiter = await compteur('À TRAITER');
const apresEnCours = await compteur('EN COURS');
console.log('après prise : à traiter', apresATraiter, '| en cours', apresEnCours);
await p.screenshot({ path: '/tmp/e2e/chasse/07-apres-prise.png' });

// CLÔTURE — le premier « Clore »
await p.locator('button:has-text("Clore")').first().click(); await a(2000);
const finATraiter = await compteur('À TRAITER');
console.log('après clôture : à traiter', finATraiter);
await p.screenshot({ path: '/tmp/e2e/chasse/08-apres-cloture.png' });

// LES FILTRES
await p.locator('button:has-text("MIS EN SOURDINE"), button:has-text("Mis en sourdine")').first().click(); await a(1500);
await p.screenshot({ path: '/tmp/e2e/chasse/09-sourdine.png' });
const sourdine = await p.evaluate(() => document.body.innerText);
console.log('filtre sourdine rend quelque chose ?', sourdine.length > 500);
await nav.close();
