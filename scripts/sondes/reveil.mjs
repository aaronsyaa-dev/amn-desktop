/* Bloc 8 : le serveur dort (502) — « Reconnexion en cours », puis l'écran se rafraîchit seul ; s'il ne revient pas, l'erreur en trois parties. */
import fs from 'node:fs';
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || '/tmp/e2e/soir';
const APP = process.env.APP || 'http://127.0.0.1:4180';
const DORMIR = '/tmp/e2e/dormir';
fs.rmSync(DORMIR, { force: true });
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('ERREUR PAGE:', String(e).slice(0, 200)));
await p.goto(`${APP}/`); await a(2000);
await p.locator('input[name="email"]').fill('fleuriste.essai@exemple.test');
await p.locator('input[name="password"]').fill('Fleuriste-2026-Essai');
await p.locator('button[type="submit"]').first().click();
for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
await a(2500); await p.mouse.click(720, 860); await a(700);
await p.screenshot({ path: `${OUT}/reveil-00-accueil.png` });
// 1. Le serveur s'endort ; une lecture part.
fs.writeFileSync(DORMIR, '');
await p.goto(`${APP}/#/membres`); await a(1500);
let t = await p.evaluate(() => document.body.innerText);
console.log('pendant : « Reconnexion en cours » ?', /Reconnexion en cours/i.test(t), '| « Bad Gateway » nu ?', /Bad Gateway/.test(t), '| « Failed to fetch » ?', /Failed to fetch/.test(t));
await p.screenshot({ path: `${OUT}/reveil-01-reconnexion.png` });
// 2. Il se réveille avant la fin des reprises : l'écran arrive seul.
await a(1200); fs.rmSync(DORMIR, { force: true }); await a(4500);
t = await p.evaluate(() => document.body.innerText);
console.log('après réveil : Membres chargé ?', /Places|Membres/.test(t) && !/Reconnexion en cours/i.test(t));
await p.screenshot({ path: `${OUT}/reveil-02-revenu.png` });
// 3. Il ne se réveille pas : l'erreur, en trois parties.
fs.writeFileSync(DORMIR, '');
await p.goto(`${APP}/#/assistance`); await a(9000);
t = await p.evaluate(() => document.body.innerText);
console.log('dernier recours : trois parties ?', /Le serveur n’a pas répondu( \(\d{3}\))?\. Rien n’est perdu : vos données sont en sécurité[^.]*\. Réessayez dans un instant\./.test(t), '| « Bad Gateway » nu ?', /Bad Gateway/.test(t));
await p.screenshot({ path: `${OUT}/reveil-03-dernier-recours.png` });
fs.rmSync(DORMIR, { force: true });
await nav.close();
