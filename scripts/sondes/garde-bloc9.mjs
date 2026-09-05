/* Garde, Bloc 9 — la présence des gardes dans l'interface : l'insigne en haut à droite (poste et téléphone), qui dit qui fait quoi ; l'historique de la Garde dans le dossier d'une organisation, et « parler au garde qu'on croise » ; les collaborations arbitrées par le Capitaine, dans la Salle. */
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
const insigne = (p) => p.evaluate(() => { const b = document.querySelector('header [data-garde-insigne]'); return b ? { niveau: b.getAttribute('data-garde-insigne'), enRonde: Number(b.getAttribute('data-garde-en-ronde')), mot: b.textContent?.trim() ?? '', titre: b.getAttribute('title') ?? '' } : null; });

const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => erreurs.push(`page : ${String(e).slice(0, 160)}`));
await connecter(p, [720, 860]);

// 1. L'insigne, sur un écran quelconque du Poste de travail.
await p.goto(`${BASE}/#/tasks`); await a(3000);
const i1 = await insigne(p);
ok('1. l’insigne de la Garde est en haut à droite, sur un écran du Poste', Boolean(i1) && ['calme', 'attention', 'critique'].includes(i1.niveau), i1 ? `${i1.niveau} · « ${i1.mot} »` : 'absent');
await p.screenshot({ path: `${OUT}/60-insigne-garde.png`, clip: { x: 640, y: 0, width: 800, height: 72 } });
// 2. Une ronde, et l'insigne dit qui vient de passer.
await p.goto(`${BASE}/#/garde`); await a(3500);
const avant = await insigne(p);
await p.locator('main article[aria-label="Disponibilité"] button', { hasText: 'Ronde maintenant' }).first().click(); await a(4000);
const apres = await insigne(p);
ok('2. après une ronde, l’insigne dit qui vient de passer', Boolean(apres) && (apres.mot !== avant?.mot || apres.titre !== avant?.titre), `« ${avant?.mot} » → « ${apres?.mot} » (titre : ${apres?.titre.slice(0, 80)})`);
// 3. Les collaborations arbitrées, dans la Salle : Disponibilité a sollicité l'Escalade.
await p.reload(); await a(3500); await p.mouse.click(720, 860).catch(() => {}); await a(500);
const collab = await p.evaluate(() => { const s = document.querySelector('main section[aria-label="Collaborations arbitrées par le Capitaine"]'); return s ? { n: Number(s.getAttribute('data-collaborations')), texte: s.textContent?.replace(/\s+/g, ' ').slice(0, 260) ?? '' } : null; });
ok('3. la Salle montre les collaborations, arbitrées par le Capitaine', Boolean(collab) && collab.n > 0 && /demande à/.test(collab.texte), collab ? collab.texte.slice(0, 200) : 'aucune collaboration');
await p.screenshot({ path: `${OUT}/61-salle-collaborations.png` });
// 4. Dans le dossier d'une organisation : la Garde chez elle, et parler au garde qu'on croise.
await p.goto(`${BASE}/#/tour/organisations`); await a(3000);
await p.locator('input[aria-label="Chercher une organisation"]').fill('Fleuriste d Essai'); await a(1800);
await p.locator('main button', { hasText: 'Fleuriste d Essai' }).first().click(); await a(2500);
const chezElle = await p.evaluate(() => { const ol = document.querySelector('[data-garde-chez-elle]'); return ol ? { n: Number(ol.getAttribute('data-garde-chez-elle')), texte: ol.textContent?.replace(/\s+/g, ' ').slice(0, 240) ?? '', parler: [...document.querySelectorAll('a[href^="#/garde/bureaux/"]')].map((x) => x.textContent?.trim()) } : null; });
ok('4. le dossier de l’organisation dit ce que la Garde y a fait, avec qui et pourquoi', Boolean(chezElle) && chezElle.n > 0 && /par la Garde/.test(chezElle.texte), chezElle ? `${chezElle.n} lignes · ${chezElle.texte.slice(0, 160)}` : 'aucune trace');
ok('   et l’on peut parler au garde qu’on croise', Boolean(chezElle) && chezElle.parler.some((x) => /Parler à la Garde/.test(x ?? '')), chezElle?.parler.join(' | ') ?? '');
await p.screenshot({ path: `${OUT}/62-dossier-garde-chez-elle.png` });
if (chezElle?.parler.length) {
  await p.locator('a[href^="#/garde/bureaux/"]').first().click(); await a(2000);
  ok('   un clic mène au bureau du chef', /#\/garde\/bureaux\//.test(await p.evaluate(() => window.location.hash)));
}
await p.context().close();

// Téléphone : la pastille.
const q = await (await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
await connecter(q, [195, 420]);
await q.goto(`${BASE}/#/tasks`); await a(3000);
const tel = await q.evaluate(() => { const b = document.querySelector('header [data-garde-insigne]'); if (!b) return null; const r = b.getBoundingClientRect(); return { visible: r.width > 0 && r.right <= window.innerWidth, largeur: r.width, motCache: (b.querySelector('span.hidden') !== null) }; });
ok('5. téléphone : la pastille est là, compacte', Boolean(tel) && tel.visible && tel.largeur < 80, tel ? `${Math.round(tel.largeur)} px` : 'absente');
await q.screenshot({ path: `${OUT}/63-insigne-telephone.png` });
await q.context().close();

console.log('erreurs :', erreurs.length, erreurs.slice(0, 4));
await nav.close();
process.exit(erreurs.length ? 1 : 0);
