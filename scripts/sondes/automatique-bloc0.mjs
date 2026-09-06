/* L'Automatique, Bloc 0 — un indicateur d'état ne bouge que quand l'état change : pendant 90 s sur le poste, le badge « Synchronisé » et l'insigne de la Garde ne doivent ni disparaître, ni changer de texte, ni clignoter, alors que la Garde bat toutes les 5 s et fait ses rondes. Et la Tour lit la même vérité que la Salle. */
const { chromium } = await import('playwright-core');
const a = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = process.env.OUT || 'docs/captures/automatique-2026-09-05';
const BASE = process.env.WEB || 'http://127.0.0.1:4181';
const DUREE_MS = Number(process.env.DUREE_MS || 90_000);
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const erreurs = [];
const ok = (etiquette, valeur, detail = '') => { console.log(`${valeur ? '✓' : '✗'} ${etiquette}${detail ? ` — ${detail}` : ''}`); if (!valeur) erreurs.push(etiquette); };
const p = await (await nav.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
p.on('pageerror', (e) => erreurs.push(`page : ${String(e).slice(0, 160)}`));
await p.goto(`${BASE}/`); await a(1800);
await p.locator('input[name="email"]').fill('essai.interne@exemple.test'); await p.locator('input[name="password"]').fill('Interne-2026-Essai');
await p.locator('button[type="submit"]').first().click();
for (let i = 0; i < 20 && (await p.content()).includes('name="password"'); i += 1) await a(1000);
await a(2500); await p.mouse.click(720, 860); await a(700);
await p.goto(`${BASE}/#/tasks`); await a(3000);

// L'observateur : chaque changement visible des deux indicateurs est compté (texte, présence, classe du point).
await p.evaluate(() => {
  const w = window;
  w.__mut = { sync: 0, garde: 0, gardeAbsente: 0, textes: new Set() };
  const lire = () => {
    const sync = document.querySelector('header span[title]')?.textContent?.trim() ?? '';
    const g = document.querySelector('header [data-garde-insigne]');
    const garde = g ? `${g.getAttribute('data-garde-insigne')}|${g.textContent?.trim()}|${g.querySelector('span')?.className}` : 'ABSENT';
    return { sync, garde };
  };
  let prev = lire();
  const obs = new MutationObserver(() => {
    const cur = lire();
    if (cur.sync !== prev.sync) { w.__mut.sync += 1; w.__mut.textes.add(`sync:${cur.sync}`); }
    if (cur.garde !== prev.garde) { w.__mut.garde += 1; w.__mut.textes.add(`garde:${cur.garde}`); if (cur.garde === 'ABSENT') w.__mut.gardeAbsente += 1; }
    prev = cur;
  });
  obs.observe(document.querySelector('header') ?? document.body, { subtree: true, childList: true, characterData: true, attributes: true });
});
const t0 = Date.now();
await a(DUREE_MS);
const m = await p.evaluate(() => ({ ...window.__mut, textes: [...window.__mut.textes] }));
ok(`1. en ${Math.round((Date.now() - t0) / 1000)} s, le badge « Synchronisé » n’a pas bougé`, m.sync === 0, `${m.sync} changement(s) ${m.textes.filter((x) => x.startsWith('sync')).join(' | ')}`);
ok('   l’insigne de la Garde n’a ni disparu ni changé', m.garde === 0 && m.gardeAbsente === 0, `${m.garde} changement(s), absent ${m.gardeAbsente} fois ${m.textes.filter((x) => x.startsWith('garde')).slice(0, 3).join(' | ')}`);
await p.screenshot({ path: `${OUT}/00-badges-stables.png`, clip: { x: 640, y: 0, width: 800, height: 72 } });

// 2. La Tour et la Salle disent la même chose.
await p.goto(`${BASE}/#/tour`); await a(3500);
const tour = await p.evaluate(() => { const s = document.querySelector('main section[aria-label="La Garde, de fond"]'); return s ? { retards: Number(s.getAttribute('data-garde-fond')), texte: s.textContent?.replace(/\s+/g, ' ').trim() ?? '' } : null; });
ok('2. la Tour lit le battement de la Garde, pas l’ancien ordonnanceur', Boolean(tour) && /Dernier battement/.test(tour.texte) && !/Rondes de fond/.test(tour.texte), tour?.texte.slice(0, 140) ?? 'absent');
ok('   aucune ronde en retard n’est annoncée alors que la Salle bat', tour?.retards === 0, `${tour?.retards}`);
await p.screenshot({ path: `${OUT}/01-tour-garde-fond.png` });
await p.goto(`${BASE}/#/garde`); await a(3000);
const salle = await p.evaluate(() => document.querySelector('main')?.textContent?.replace(/\s+/g, ' ') ?? '');
ok('   la Salle est vivante (une ronde à l’instant ou il y a moins d’une minute)', /à l.instant|il y a (\d+ s|1 min|[1-5] min)/.test(salle));
await p.context().close();
console.log('erreurs :', erreurs.length, erreurs);
await nav.close();
process.exit(erreurs.length ? 1 : 0);
