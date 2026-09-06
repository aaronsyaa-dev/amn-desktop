const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto('http://127.0.0.1:4181/'); await a(1800);
await p.locator('input[name="email"]').fill('essai.interne@exemple.test'); await p.locator('input[name="password"]').fill('Interne-2026-Essai');
await p.locator('button[type="submit"]').first().click(); for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
await a(2500); await p.mouse.click(720, 860); await a(700);
for (const route of process.argv.slice(2)) {
  await p.goto(`http://127.0.0.1:4181/#${route}`); await a(3500);
  const r = await p.evaluate(() => [...document.querySelectorAll('main section, main .panel, main article')].filter((s) => !s.parentElement?.closest('section, .panel, article')).map((s) => ({ label: (s.getAttribute('aria-label') || s.querySelector('h1,h2,h3')?.textContent || s.className.slice(0, 40)).trim().slice(0, 50), mots: (s.innerText ?? '').split(/\s+/).filter(Boolean).length, hauteur: Math.round(s.getBoundingClientRect().height) })));
  console.log(route); for (const s of r) console.log(`  ${String(s.mots).padStart(5)} mots  ${String(s.hauteur).padStart(5)} px  ${s.label}`);
}
await nav.close();
