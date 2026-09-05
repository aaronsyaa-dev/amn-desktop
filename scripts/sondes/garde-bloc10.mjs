/* Garde, Bloc 10 — un seul point d'entrée pour agir : Ctrl+K cherche les écrans ET parle à la Garde (réponse sur place, confirmation sur place) ; chaque écran dit ses gestes principaux à la première ouverture ; la Bibliothèque dit quelles équipes de la Garde lisent ou modifient chaque module. */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || 'docs/captures/garde-2026-09-05';
const BASE = process.env.WEB || 'http://127.0.0.1:4181';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const connecter = async (p, clic) => {
  await p.goto(`${BASE}/`); await a(1800);
  await p.locator('input[name="email"]').fill('essai.interne@exemple.test'); await p.locator('input[name="password"]').fill('Interne-2026-Essai');
  await p.locator('button[type="submit"]').first().click();
  for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
  await a(2500); await p.mouse.click(...clic); await a(700);
};
const erreurs = [];
const ok = (etiquette, valeur, detail = '') => { console.log(`${valeur ? '✓' : '✗'} ${etiquette}${detail ? ` — ${detail}` : ''}`); if (!valeur) erreurs.push(etiquette); };

const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => erreurs.push(`page : ${String(e).slice(0, 160)}`));
// Les présentations de première ouverture reviennent pour la sonde.
await p.addInitScript(() => { try { for (const k of Object.keys(localStorage)) if (k.startsWith('amn.presentation.vue.')) localStorage.removeItem(k); } catch {} });
await connecter(p, [720, 860]);

// 1. Ctrl+K : un écran ET la Garde, dans la même liste.
await p.goto(`${BASE}/#/tasks`); await a(2500);
await p.keyboard.press('Control+k'); await a(800);
const palette = p.locator('input[placeholder]').last();
await palette.fill('qui n’a pas payé'); await a(700);
const lignes = await p.evaluate(() => [...document.querySelectorAll('[role="dialog"] button, .fixed button')].map((b) => b.textContent?.replace(/\s+/g, ' ').trim() ?? '').filter((x) => x.length > 3));
const gardeLignes = lignes.filter((x) => /Qui n’a pas payé|Demander à la Garde/.test(x));
ok('1. Ctrl+K propose la Garde à côté des écrans', gardeLignes.length >= 2, gardeLignes.join(' | ').slice(0, 200));
await p.keyboard.press('Enter'); await a(3000);
const reponse = await p.evaluate(() => document.querySelector('[data-palette-garde]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '');
ok('   la réponse du Capitaine s’affiche sur place, sans quitter la palette', /La Garde répond/.test(reponse) && reponse.length > 30, reponse.slice(0, 160));
await p.screenshot({ path: `${OUT}/70-palette-garde.png` });
// Un ordre qui modifie : la confirmation se fait sur place.
await palette.fill('Personne ne touche à Fleuriste d Essai'); await a(700);
const libre = p.locator('button', { hasText: 'Demander à la Garde' }).first();
await libre.click(); await a(3000);
const demande = await p.evaluate(() => document.querySelector('[data-palette-garde]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '');
ok('   un ordre qui modifie demande confirmation ici même', /Je confirme et je fais|D’accord pour/.test(demande) && /Oui, faites-le/.test(demande), demande.slice(0, 160));
await p.locator('[data-palette-garde] button', { hasText: 'Oui, faites-le' }).click(); await a(3000);
const fait = await p.evaluate(() => document.querySelector('[data-palette-garde]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '');
ok('   « Oui » : fait, journalisé', /Compris/.test(fait), fait.slice(0, 160));
await palette.fill('Tu peux retoucher à Fleuriste d Essai'); await a(700);
await p.locator('button', { hasText: 'Demander à la Garde' }).first().click(); await a(2500);
await p.locator('[data-palette-garde] button', { hasText: 'Oui, faites-le' }).click().catch(() => {}); await a(2000);
await p.keyboard.press('Escape'); await a(500);

// 2. Chaque écran dit ses gestes principaux, lus sur l'écran lui-même.
await p.goto(`${BASE}/#/tasks`); await a(3000);
const gestes = await p.evaluate(() => document.querySelector('main [data-gestes]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '');
ok('2. la présentation d’un écran dit ses gestes, lus sur l’écran', /Gestes/.test(gestes) && /Nouvelle tâche/.test(gestes), gestes.slice(0, 160));
await p.goto(`${BASE}/#/garde`); await a(3000);
const gestesSalle = await p.evaluate(() => document.querySelector('main [data-gestes]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '');
ok('   et sur la Salle', /Plein écran/.test(gestesSalle), gestesSalle.slice(0, 120));
await p.screenshot({ path: `${OUT}/71-presentation-gestes.png` });

// 3. La Bibliothèque : les prises de la Garde, module par module.
await p.goto(`${BASE}/#/bibliotheque`); await a(3500);
const prises = await p.evaluate(() => [...document.querySelectorAll('main [data-prises]')].map((x) => `${x.getAttribute('data-prises')} : ${x.textContent?.replace(/\s+/g, ' ').trim()}`));
ok('3. la Bibliothèque dit quelles équipes lisent ou modifient chaque module', prises.length >= 4 && prises.some((x) => /^tasks : .*modifié par/.test(x)), `${prises.length} modules · ${prises.slice(0, 3).join(' | ')}`);
const tuile = p.locator('main [data-prises="tasks"]').first();
await tuile.scrollIntoViewIfNeeded().catch(() => {}); await a(400);
await p.screenshot({ path: `${OUT}/72-bibliotheque-prises.png` });
await p.context().close();

console.log('erreurs :', erreurs.length, erreurs.slice(0, 4));
await nav.close();
process.exit(erreurs.length ? 1 : 0);
