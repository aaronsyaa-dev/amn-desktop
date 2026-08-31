const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
if (process.env.LANGUE) await ctx.addInitScript((l) => { try { localStorage.setItem('amn.langue.utilisateur', l); } catch {} }, process.env.LANGUE);
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:4180/'); await a(2000);
await p.locator('input[name="email"]').fill(process.env.E);
await p.locator('input[name="password"]').fill(process.env.P);
await p.locator('button[type="submit"]').first().click();
for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
await a(2500); await p.mouse.click(720, 860); await a(700);
await p.goto('http://127.0.0.1:4180/#/settings'); await a(1800);
const sec = p.locator('section', { hasText: process.env.TITRE }).last();
await sec.scrollIntoViewIfNeeded(); await a(500);
await p.screenshot({ path: process.env.OUTPNG });
// bascule réelle : cliquer l'option demandée et recapturer
if (process.env.CLIC) {
  await p.locator(`button:has-text("${process.env.CLIC}")`).last().click(); await a(900);
  await p.screenshot({ path: process.env.OUTPNG2 });
  const texte = await p.evaluate(() => document.body.innerText);
  console.log('après clic — « Language » visible ?', texte.includes('Language'), '| « Langue » visible ?', /\bLangue\b/.test(texte));
}
await nav.close(); console.log('ok');
