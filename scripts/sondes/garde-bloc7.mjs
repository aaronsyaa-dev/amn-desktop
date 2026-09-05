/* Garde, Bloc 7 — la supervision réadaptée : un compte interne neuf choisit sa mission d'un geste, sa barre suit ; la Tour montre les exceptions d'abord, en un clic chacune ; les trois espaces disent agir, décider, déléguer. */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || 'docs/captures/garde-2026-09-05';
const BASE = process.env.WEB || 'http://127.0.0.1:4181';
const EMAIL = process.env.EMAIL || 'nouveau.interne@exemple.test';
const MDP = process.env.MDP || 'Nouveau-2026-Essai';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const connecter = async (p, clic) => {
  await p.goto(`${BASE}/`); await a(1800);
  await p.locator('input[name="email"]').fill(EMAIL); await p.locator('input[name="password"]').fill(MDP);
  await p.locator('button[type="submit"]').first().click();
  for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
  await a(2500); await p.mouse.click(...clic); await a(700);
};
const erreurs = [];
const ok = (etiquette, valeur, detail = '') => { console.log(`${valeur ? '✓' : '✗'} ${etiquette}${detail ? ` — ${detail}` : ''}`); if (!valeur) erreurs.push(etiquette); };
const liens = (p) => p.evaluate(() => [...document.querySelectorAll('a[href^="#/"]')].filter((x) => !x.closest('main')).map((x) => x.getAttribute('href')));

const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => erreurs.push(`page : ${String(e).slice(0, 160)}`));
await p.addInitScript(() => { try { for (const k of Object.keys(localStorage)) if (k.startsWith('amn.profil-interne.')) localStorage.removeItem(k); } catch {} });
await connecter(p, [720, 860]);

// 0. La sonde rejoue : on remet la barre du compte entière (« Tout garder »), comme au premier jour.
await p.goto(`${BASE}/#/bibliotheque`); await a(2500);
await p.locator('main button', { hasText: 'Alléger ma barre' }).first().click().catch(() => {}); await a(600);
await p.locator('main button', { hasText: 'Tout garder' }).first().click().catch(() => {}); await a(1200);
await p.locator('main button', { hasText: 'Terminer' }).first().click().catch(() => {}); await a(400);
await p.evaluate(() => { try { for (const k of Object.keys(localStorage)) if (k.startsWith('amn.profil-interne.')) localStorage.removeItem(k); } catch {} });

// 1. Un compte neuf : la carte « Quel est votre poste ? », et une barre complète.
await p.goto(`${BASE}/#/`); await a(3000);
const avant = await liens(p);
const carte = await p.locator('main [data-profil-carte]').count();
ok('1. compte interne neuf : la carte « Quel est votre poste ? » est là', carte === 1, `${avant.length} liens dans la barre`);
await p.screenshot({ path: `${OUT}/50-nouveau-compte-profil.png` });
// 2. Supervision, d'un geste : la barre ne garde que la mission.
await p.locator('main [data-profil-carte] button', { hasText: 'Supervision' }).first().click(); await a(2500);
const apres = await liens(p);
ok('2. « Supervision » : la barre s’allège à la mission', apres.length < avant.length / 2, `${avant.length} → ${apres.length} liens`);
ok('   la carte ne revient pas', (await p.locator('main [data-profil-carte]').count()) === 0);
await p.reload(); await a(2600); await p.mouse.click(720, 860); await a(800);
const relu = await liens(p);
ok('   mémorisé après rechargement', relu.length < avant.length / 2 && (await p.locator('main [data-profil-carte]').count()) === 0, `${relu.length} liens`);
await p.goto(`${BASE}/#/garde`); await a(2500);
const gardeLiens = (await liens(p)).filter((h) => h.startsWith('#/garde'));
ok('   la Garde reste entière pour la supervision', gardeLiens.length >= 5, `${gardeLiens.length} liens vers la Garde`);
await p.goto(`${BASE}/#/`); await a(2000);
await p.screenshot({ path: `${OUT}/51-barre-supervision.png` });

// 3. Les trois espaces disent leur verbe.
const espaces = await p.evaluate(() => document.body.textContent?.replace(/\s+/g, ' ') ?? '');
await p.locator('button[aria-haspopup="menu"]').first().click().catch(() => {}); await a(800);
const menu = await p.evaluate(() => document.body.textContent?.replace(/\s+/g, ' ') ?? '');
ok('3. les trois espaces : agir, décider, déléguer', /Agir/.test(menu) && /Décider/.test(menu) && /Déléguer/.test(menu), (menu.match(/Agir[^A]{0,60}|Décider[^A]{0,60}|Déléguer[^A]{0,60}/g) ?? []).slice(0, 3).join(' | ').slice(0, 200));
await p.keyboard.press('Escape'); await a(300);
void espaces;

// 4. La Tour : les exceptions d'abord, chacune en un geste.
await p.goto(`${BASE}/#/tour`); await a(3500);
const exc = await p.evaluate(() => {
  const s = document.querySelector('main section[aria-label="Ce qui attend une décision"]');
  const h1 = document.querySelector('main h1');
  return { present: Boolean(s), n: Number(s?.getAttribute('data-exceptions') ?? -1), lignes: [...(s?.querySelectorAll('li') ?? [])].map((l) => l.textContent?.replace(/\s+/g, ' ').trim().slice(0, 120)), gestes: [...(s?.querySelectorAll('a') ?? [])].map((x) => x.textContent?.trim()), sousEntete: s && h1 ? s.getBoundingClientRect().top > h1.getBoundingClientRect().top : false, avantLeParc: s ? [...document.querySelectorAll('main section')].indexOf(s) <= 1 : false };
});
ok('4. la Tour montre « Ce qui attend une décision » d’abord', exc.present && exc.sousEntete && exc.n >= 0, `${exc.n} exception(s) : ${exc.lignes.join(' || ')}`);
ok('   chaque exception tient en un geste', exc.n === 0 ? exc.gestes.length === 1 : exc.gestes.length === exc.n, exc.gestes.join(' | '));
await p.screenshot({ path: `${OUT}/52-tour-exceptions.png` });
if (exc.n > 0) {
  await p.locator('main section[aria-label="Ce qui attend une décision"] a').first().click(); await a(2000);
  const ou = await p.evaluate(() => window.location.hash);
  ok('   un clic, et l’on est là où l’on décide', /#\/garde|#\/tour\/organisations/.test(ou), ou);
}
await p.context().close();

// Téléphone : la Tour, exceptions d'abord, sans débordement.
const q = await (await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
await connecter(q, [195, 420]);
await q.goto(`${BASE}/#/tour`); await a(3500);
const tel = await q.evaluate(() => ({ s: Boolean(document.querySelector('main section[aria-label="Ce qui attend une décision"]')), largeur: document.documentElement.scrollWidth <= window.innerWidth + 1 }));
ok('5. téléphone : les exceptions d’abord, sans débordement', tel.s && tel.largeur);
await q.screenshot({ path: `${OUT}/53-tour-exceptions-telephone.png` });
await q.context().close();

console.log('erreurs :', erreurs.length, erreurs.slice(0, 4));
await nav.close();
process.exit(erreurs.length ? 1 : 0);
