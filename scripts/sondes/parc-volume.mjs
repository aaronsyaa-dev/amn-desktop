/* Bloc 4 — le registre à l'échelle, sur la base de volume (100 000 organisations d'essai) :
   ouverture, recherche, filtres, sélection et geste groupé, dossier. L'API sur :4171 doit servir /tmp/e2e/volume.db. */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || 'docs/captures/supervision-2026-09-04';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('ERREUR PAGE:', String(e).slice(0, 160)));
const reseau = [];
p.on('response', (r) => { if (r.url().includes('/v1/admin/organizations')) reseau.push({ url: r.url().replace('http://127.0.0.1:4171', ''), status: r.status(), octets: Number(r.headers()['content-length'] ?? 0) }); });
await p.goto('http://127.0.0.1:4181/'); await a(1800);
await p.locator('input[name="email"]').fill('volume.interne@exemple.test'); await p.locator('input[name="password"]').fill('Volume-2026-Essai');
await p.locator('button[type="submit"]').first().click();
for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
await a(2500); await p.mouse.click(720, 860); await a(500);
const texte = () => p.evaluate(() => document.body.innerText);
const lignes = () => p.locator('main ul li input[type="checkbox"]').count();

await p.goto('http://127.0.0.1:4181/#/tour'); await a(2500);
let t0 = performance.now();
await p.goto('http://127.0.0.1:4181/#/tour/organisations');
await p.locator('main ul li').first().waitFor({ timeout: 20000 });
console.log(`registre : premières lignes affichées en ${(performance.now() - t0).toFixed(0)} ms | lignes : ${await lignes()}`);
await a(1500);
let t = await texte();
console.log('en-tête :', (t.match(/GÉRÉES\s+\d[\d\s]*/i) || ['—'])[0].replace(/\s+/g, ' '), '|', (t.match(/\d[\d ]* organisations? · \d+ affichée/i) || ['—'])[0]);
await p.screenshot({ path: `${OUT}/11-registre-100k.png` });

t0 = performance.now();
await p.locator('input[aria-label="Chercher une organisation"]').fill('0999');
await p.waitForFunction(() => /\b120 organisations\b/i.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
console.log(`recherche « 0999 » : ${(performance.now() - t0).toFixed(0)} ms (délai de frappe compris) | ${(await texte()).match(/\d+ organisations? · \d+ affichée/i)?.[0]}`);

await p.locator('input[aria-label="Chercher une organisation"]').fill('');
await p.locator('select[aria-label="Formule"]').selectOption('business_premium');
await p.locator('select[aria-label="Activité"]').selectOption('7d');
await p.waitForFunction(() => /1 ?909 organisations/i.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
console.log('filtre premium + actives 7 j :', (await texte()).match(/\d[\d ]* organisations? · \d+ affichée/i)?.[0]);
await p.locator('button:has-text("Cinquante de plus")').click(); await a(1200);
console.log('après « cinquante de plus » : lignes =', await lignes());
await p.screenshot({ path: `${OUT}/12-registre-filtres.png` });

// Sélection de trois organisations, étiquette groupée
for (let i = 0; i < 3; i += 1) await p.locator('main ul li input[type="checkbox"]').nth(i).check();
await p.locator('select[aria-label="Geste groupé"]').selectOption('tag_add');
await p.locator('input[aria-label="Étiquette"]').fill('pilote volume');
await p.locator('button:has-text("Appliquer")').click(); await a(300);
t = await texte();
console.log('confirmation demandée ?', /sur 3 organisations — sûr/i.test(t));
await p.locator('button:has-text("Confirmer")').click(); await a(2500);
t = await texte();
console.log('geste groupé :', (t.match(/3 faites[^\n]*/i) || ['—'])[0]);
await p.screenshot({ path: `${OUT}/13-geste-groupe.png` });
await p.locator('select[aria-label="Étiquette"]').selectOption({ label: 'pilote volume (3)' }).catch(async () => { await a(1500); await p.locator('select[aria-label="Étiquette"]').selectOption({ label: 'pilote volume (3)' }); });
await a(1500);
console.log('filtre par étiquette :', (await texte()).match(/\d+ organisations? · \d+ affichée/i)?.[0]);

// Dossier d'une organisation
await p.locator('main ul li button:has-text("Dossier")').first().click(); await a(2200);
t = await texte();
console.log('dossier ouvert ?', /Étiquettes/i.test(t) && /Ce qu’elle nous a fermé/i.test(t), '| étiquette visible ?', /pilote volume/.test(t));
await p.screenshot({ path: `${OUT}/14-dossier-volume.png` });

const tailles = reseau.filter((r) => r.url.includes('/page')).map((r) => r.octets);
console.log(`réseau : ${reseau.length} appels admin/organizations, pages de ${Math.min(...tailles)}–${Math.max(...tailles)} octets, aucun appel à la liste entière ? ${!reseau.some((r) => /\/organizations(\?|$)/.test(r.url))}`);
await nav.close();
