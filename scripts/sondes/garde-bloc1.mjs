/* Garde, Bloc 1 — le bandeau du parc sous l'en-tête (interne), et alléger d'un geste : tout, rien, par section, préréglages (Business). */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || 'docs/captures/garde-2026-09-05';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const connecter = async (p, base, email, mdp, clic) => {
  await p.goto(`${base}/`); await a(1800);
  await p.locator('input[name="email"]').fill(email); await p.locator('input[name="password"]').fill(mdp);
  await p.locator('button[type="submit"]').first().click();
  for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
  await a(2500); await p.mouse.click(...clic); await a(700);
};
const erreurs = [];

// 1. Interne : le bandeau de la file du parc ne flotte plus sur l'en-tête.
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => erreurs.push(String(e).slice(0, 160)));
await connecter(p, 'http://127.0.0.1:4181', 'essai.interne@exemple.test', 'Interne-2026-Essai', [720, 860]);
await p.goto(`http://127.0.0.1:4181/#/${process.env.ROUTE_SUPERVISION || 'supervision'}`); await a(3000);
const boites = await p.evaluate(() => {
  const h1 = document.querySelector('main h1, h1');
  const bloc = h1?.closest('header') ?? h1?.parentElement?.parentElement;
  const parc = document.querySelector('section[aria-label="La file du parc"]');
  const r = (el) => (el ? el.getBoundingClientRect() : null);
  return { h1: r(h1), entete: r(bloc), parc: r(parc) };
});
const sousEntete = Boolean(boites.parc && boites.entete && boites.parc.top >= boites.entete.bottom - 1);
console.log('1. bureau de supervision : bandeau du parc présent ?', Boolean(boites.parc), '| sous l’en-tête ?', sousEntete, `(en-tête bas ${boites.entete?.bottom.toFixed(0)}, bandeau haut ${boites.parc?.top.toFixed(0)})`);
await p.screenshot({ path: `${OUT}/02-bureau-supervision-bandeau.png` });
await p.context().close();

// 2. Business : alléger d'un geste.
const q = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
q.on('pageerror', (e) => erreurs.push(String(e).slice(0, 160)));
await connecter(q, 'http://127.0.0.1:4180', 'fleuriste.essai@exemple.test', 'Fleuriste-2026-Essai', [720, 860]);
const liens = () => q.evaluate(() => [...document.querySelectorAll('a[href^="#/"]')].filter((x) => !x.closest('main')).map((x) => x.getAttribute('href')).length);
await q.goto('http://127.0.0.1:4180/#/decouvrir'); await a(2000);
await q.locator('button:has-text("Alléger ma barre")').click(); await a(600);
const depart = await liens();
const clic = async (texte) => { await q.locator('button', { hasText: new RegExp(`^${texte}`) }).first().click(); await a(900); return liens(); };
const commerce = await clic('Commerce');
await q.screenshot({ path: `${OUT}/03-alleger-prereglage-commerce.png` });
const leger = await clic('Léger');
const service = await clic('Service');
const rien = await clic('Tout alléger');
const tout = await clic('Tout garder');
const sansPilotage = await clic('Alléger Pilotage');
const avecPilotage = await clic('Garder Pilotage');
console.log(`2. alléger d’un geste (liens hors contenu) : départ ${depart} → Commerce ${commerce} → Léger ${leger} → Service ${service} → Tout alléger ${rien} → Tout garder ${tout} → Alléger Pilotage ${sansPilotage} → Garder Pilotage ${avecPilotage}`);
console.log('   cohérent ?', commerce < depart && leger < commerce && rien < leger && tout === depart && sansPilotage < tout && avecPilotage === tout);
await q.locator('button:has-text("Terminer")').click(); await a(500);
await q.reload(); await a(2600); await q.mouse.click(720, 860); await a(500);
console.log('   après rechargement, liens :', await liens(), '(la liste vide « tout garder » est mémorisée)');
console.log('erreurs de page :', erreurs.length, erreurs.slice(0, 2));
await nav.close();
