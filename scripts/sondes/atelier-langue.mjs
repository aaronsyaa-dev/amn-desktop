const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto('http://127.0.0.1:4180/'); await a(2000);
await p.locator('input[name="email"]').fill('essai.interne@exemple.test');
await p.locator('input[name="password"]').fill('Interne-2026-Essai');
await p.locator('button[type="submit"]').first().click();
for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
await a(2500); await p.mouse.click(720, 860); await a(700);
await p.goto('http://127.0.0.1:4180/#/tour/generateur'); await a(1800);
// passer à l'étape configuration : choisir un profil métier
const profil = p.locator('button', { hasText: 'Boutique en ligne' }).first();
if (await profil.count()) { await profil.click(); await a(1200); }
else { const b = p.locator('button').filter({ hasText: /page blanche|blanche|Continuer/i }).first(); if (await b.count()) { await b.click(); await a(1200); } }
const sec = p.locator('section', { hasText: 'Langue de l’espace' }).last();
if (await sec.count()) { await sec.scrollIntoViewIfNeeded(); await a(500); } else { console.log('SECTION LANGUE INTROUVABLE'); }
await p.screenshot({ path: '/tmp/e2e/lang/i4-atelier-langue.png' });
const texte = await p.evaluate(() => document.body.innerText);
console.log('atelier — sélecteur langue ?', texte.includes('Langue de l’espace'), '| English proposé ?', texte.includes('English'));
await nav.close();
