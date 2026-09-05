/* Garde, Bloc 6 — la Garde des Tâches : une tâche par dossier, qui dit qui l'a posée et pourquoi, sur le tableau des tâches d'AMN DevSec (poste et téléphone). */
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
await connecter(p, [720, 860]);
// 1. Le chef des Tâches refait sa ronde ; le compte du jour a été remis à zéro avant la sonde (données de test).
await p.goto(`${BASE}/#/garde/bureaux/taches`); await a(3000);
const q = p.locator('main input[aria-label="Poser une question, donner un ordre"]');
await q.fill('Refais ta ronde maintenant'); await q.press('Enter'); await a(5000);
const reponse = await p.evaluate(() => document.querySelector('main section[aria-label="Poser une question, donner un ordre"] ol')?.textContent?.replace(/\s+/g, ' ') ?? '');
ok('1. le Chef des Tâches fait sa ronde et dit ce qu’elle a émis', /émise|mise\(s\) à jour|close/.test(reponse), reponse.slice(-160));
// 2. Le tableau des tâches : des cartes posées par la Garde, avec « par la Garde … — parce que … ».
await p.goto(`${BASE}/#/tasks`); await a(3500);
const cartes = await p.evaluate(() => {
  const g = [...document.querySelectorAll('main [data-garde]')];
  return { n: g.length, agents: [...new Set(g.map((x) => x.getAttribute('data-garde')))], exemple: g[0]?.textContent?.replace(/\s+/g, ' ').trim() ?? '', titres: g.slice(0, 3).map((x) => x.closest('.group\\/card')?.querySelector('span.text-sm')?.textContent?.trim() ?? '') };
});
ok('2. des tâches posées par la Garde, attribuées et motivées', cartes.n > 0 && /par la Garde .* — parce que/.test(cartes.exemple), `${cartes.n} carte(s), agents : ${cartes.agents.join(', ')} · « ${cartes.exemple.slice(0, 140)} »`);
console.log('   titres :', cartes.titres.join(' | '));
// 3. Une seule tâche par dossier : pas deux cartes pour le même titre.
const doublons = await p.evaluate(() => { const t = [...document.querySelectorAll('main [data-garde]')].map((x) => x.closest('.group\\/card')?.querySelector('span.text-sm')?.textContent?.trim() ?? ''); return t.length - new Set(t).size; });
ok('3. jamais deux tâches pour un même dossier', doublons === 0, `${doublons} doublon(s)`);
await p.screenshot({ path: `${OUT}/40-taches-garde.png` });
// 4. La tâche s'ouvre et son texte dit Pourquoi / Preuve / Action / Gravité / Par.
await p.locator('main [data-garde]').first().locator('xpath=..').locator('button').first().click().catch(() => {}); await a(1500);
const fiche = await p.evaluate(() => document.body.textContent?.replace(/\s+/g, ' ') ?? '');
ok('4. la fiche de la tâche dit Pourquoi, Preuve, Action, Gravité, Par', ['Pourquoi :', 'Preuve :', 'Action :', 'Gravité :', 'Par :'].every((c) => fiche.includes(c)), ['Pourquoi', 'Preuve', 'Action', 'Gravité', 'Par'].filter((c) => fiche.includes(`${c} :`)).join(', '));
await p.screenshot({ path: `${OUT}/41-tache-garde-fiche.png` });
await p.context().close();

const r = await (await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })).newPage();
await connecter(r, [195, 420]);
await r.goto(`${BASE}/#/tasks`); await a(3500);
const tel = await r.evaluate(() => ({ n: document.querySelectorAll('main [data-garde]').length, largeur: document.documentElement.scrollWidth <= window.innerWidth + 1 }));
ok('5. téléphone : les tâches de la Garde se lisent, sans débordement', tel.n > 0 && tel.largeur, `${tel.n} carte(s)`);
await r.screenshot({ path: `${OUT}/42-taches-garde-telephone.png` });
await r.context().close();

console.log('erreurs :', erreurs.length, erreurs.slice(0, 4));
await nav.close();
process.exit(erreurs.length ? 1 : 0);
