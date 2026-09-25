/**
 * L'ÉCRAN DE VEILLE DE L'ÉDITION CLIENTE (`41a`), éprouvé dans un vrai
 * navigateur contre un build Business servi :
 *
 *   · il s'ouvre sans coquille ni action (aucun lien, aucun bouton) ;
 *   · aucun texte sous 15 px hors surtitres en capitales (11–13 px) ;
 *   · une seule région ambre : le prochain rendez-vous ;
 *   · le premier contact le referme SANS RIEN DÉCLENCHER : un clic de réveil
 *     posé sur un lien ne navigue pas, une touche de réveil n'ouvre rien ;
 *   · accueil du public : « — € » et aucun nom de client ;
 *   · après la fermeture : l'heure et la date seules, sans ambre ;
 *   · aucun débordement à 390 px ;
 *   · avec VEILLE_LONG=1 : le déclenchement réel après deux minutes, et
 *     « jamais » qui n'en déclenche aucune (quatre minutes d'attente).
 *
 *   npx serve -s dist -l 4180 &
 *   AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… npm run check:veille-cliente
 */
import { chromium } from 'playwright-core';
const APP = (process.env.AMN_E2E_URL ?? 'http://127.0.0.1:4180/').replace(/\/?$/, '/');
const CHROMIUM = process.env.AMN_E2E_CHROMIUM ?? '/opt/pw-browsers/chromium';
const EMAIL = process.env.AMN_E2E_EMAIL ?? '';
const MOT_DE_PASSE = process.env.AMN_E2E_PASSWORD ?? '';
if (!EMAIL || !MOT_DE_PASSE) {
  console.error('check:veille-cliente — AMN_E2E_EMAIL et AMN_E2E_PASSWORD sont requis.');
  process.exit(2);
}
let echecs = 0;
const nav = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });
const page = await nav.newPage({ viewport: { width: 1280, height: 800 } });
/* L'horloge du navigateur est fixée, sinon le contrôle dépend de l'heure où on
   le lance : à 22 h il n'y a plus de « prochain rendez-vous » à mettre en ambre,
   à 8 h la « nuit » n'est pas encore tombée. Par défaut, 08:00 aujourd'hui —
   avant les rendez-vous du matin que pose la graine d'essai. */
const HEURE = process.env.AMN_E2E_HEURE ? new Date(process.env.AMN_E2E_HEURE) : (() => { const d = new Date(); d.setHours(8, 0, 0, 0); return d; })();
await page.clock.install({ time: HEURE });
const ok = (c, m) => { if (!c) echecs += 1; console.log(`${c ? '✓' : '✗'} ${m}`); };
const mesurer = () => page.evaluate(() => {
  const v = document.querySelector('[aria-label="Écran de veille"]');
  if (!v) return null;
  const petits = [];
  for (const el of v.querySelectorAll('*')) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el); const fs = parseFloat(cs.fontSize);
    const txt = el.textContent.trim();
    const caps = txt === txt.toUpperCase();
    if (fs < 15 && !(caps && fs >= 11 && fs <= 13)) petits.push(`${fs}px «${txt.slice(0, 30)}»`);
  }
  const ambre = new Set([...v.querySelectorAll('[data-signal-groupe]')].map((e) => e.getAttribute('data-signal-groupe')));
  const nAmbre = [...v.querySelectorAll('*')].filter((e) => /208,\s*154,\s*74/.test(getComputedStyle(e).backgroundColor + getComputedStyle(e).color)).length;
  return { petits, groupes: [...ambre], nAmbre, texte: v.innerText.replace(/\s+/g, ' ').slice(0, 260) };
});
const reglages = (r) => page.evaluate((r) => { localStorage.setItem('amn.veille.reglages', JSON.stringify(r)); window.dispatchEvent(new Event('amn:veille-reglages')); }, r);
const apercu = async () => { await page.evaluate(() => window.dispatchEvent(new Event('amn:veille-apercu'))); await page.waitForTimeout(600); };
try {
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(MOT_DE_PASSE);
  await page.locator('button[type="submit"]').click();
  for (let i = 0; i < 30 && (await page.content()).includes('name="password"'); i++) await page.waitForTimeout(500);
  await page.waitForTimeout(2500);
  /* Un compte d'essai jamais connecté avant ouvre la présentation d'arrivée
     puis, juste derrière, « Qui êtes-vous » (deux `role="dialog"` à la
     suite) : sans les fermer TOUS LES DEUX, l'un reste dans le DOM tout le
     test et fausse tout ce qui compte les dialogues (« la touche de réveil
     n'ouvre rien »). */
  const passer = page.getByRole('button', { name: 'Passer' });
  if ((await passer.count()) > 0) { await passer.click(); await page.waitForTimeout(500); }
  const plusTard = page.getByRole('button', { name: 'Plus tard' });
  if ((await plusTard.count()) > 0) { await plusTard.click(); await page.waitForTimeout(500); }
  await page.goto(APP + '#/agenda', { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);

  await reglages({ delaiMin: 5, accueilPublic: false, masque: null, fermetureH: 23 });
  await apercu();
  let m = await mesurer();
  ok(m !== null, 'la veille s’ouvre');
    ok(m.petits.length === 0, `aucun texte sous 15 px hors surtitres ${m.petits.join(' | ')}`);
  ok(m.groupes.length === 1 && m.groupes[0] === 'prochain', `une seule région ambre : ${m.groupes}`);
  ok(!/— €/.test(m.texte), 'montants visibles hors accueil du public');
  const liens = await page.evaluate(() => { const v = document.querySelector('[aria-label="Écran de veille"]'); return v.querySelectorAll('a,button,input').length; });
  ok(liens === 0, 'sans aucune action : ni lien ni bouton');

  // Le clic de réveil sur un lien de la barre latérale ne navigue pas.
  const lien = page.locator('a[href="#/clients"]').first();
  const box = await lien.boundingBox();
  const avant = page.url();
  if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(900);
  ok((await mesurer()) === null, 'le premier contact referme la veille');
  ok(page.url() === avant, `le clic de réveil ne déclenche rien (${page.url().split('#')[1]})`);

  // Une touche de réveil ne déclenche pas de raccourci (Ctrl+K : la palette).
  await apercu();
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(500);
  const palette = await page.locator('[role="dialog"]').count();
  ok((await mesurer()) === null && palette === 0, `la touche de réveil n’ouvre rien (dialogues : ${palette})`);

  // Accueil du public : montants et noms masqués.
  await reglages({ delaiMin: 5, accueilPublic: true, masque: null, fermetureH: 23 });
  await apercu(); m = await mesurer();
  ok(/— €/.test(m.texte) && /Rendez-vous de \d\d:\d\d/.test(m.texte) && !/Brasserie|Villa Sereine/.test(m.texte), `masquée : ${m.texte.slice(0, 160)}`);
  await page.keyboard.press('Shift'); await page.waitForTimeout(400);

  // Mode nuit : fermeture à 12 h, l'horloge avancée à 22 h 30 le même jour.
  await page.clock.setSystemTime(new Date(HEURE.getTime() + 14.5 * 3600_000));
  await reglages({ delaiMin: 5, accueilPublic: false, masque: null, fermetureH: 12 });
  await apercu(); m = await mesurer();
  ok(m.groupes.length === 0 && m.nAmbre === 0 && !/ENCAISSÉ/.test(m.texte), `mode nuit : l’heure et la date seules (${m.texte})`);
  await page.keyboard.press('Shift'); await page.waitForTimeout(400);

  if (process.env.VEILLE_LONG) {
  // Déclenchement réel : délai de 2 minutes sans action.
  await reglages({ delaiMin: 2, accueilPublic: false, masque: null, fermetureH: 23 });
  await page.waitForTimeout(115_000);
  ok((await mesurer()) === null, 'rien avant deux minutes');
  await page.waitForTimeout(8_000);
  ok((await mesurer()) !== null, 'la veille vient seule après deux minutes sans action');
  await page.keyboard.press('Shift'); await page.waitForTimeout(400);
  await reglages({ delaiMin: 0, accueilPublic: false, masque: null, fermetureH: 23 });
  await page.waitForTimeout(130_000);
  ok((await mesurer()) === null, '« jamais » : aucune veille');

  }
  // Mobile.
  await page.setViewportSize({ width: 390, height: 844 });
  await reglages({ delaiMin: 5, accueilPublic: false, masque: null, fermetureH: 23 });
  await apercu();
  const deb = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  ok(!deb, 'pas de débordement à 390 px');
} finally { await nav.close(); }
console.log(echecs ? `\n${echecs} règle(s) en défaut.` : '\nL’écran de veille tient ses règles.');
process.exit(echecs ? 1 : 0);
