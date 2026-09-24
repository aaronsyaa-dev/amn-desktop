/**
 * check:xss — ce qu'une personne tape ne s'exécute jamais chez une autre.
 *
 * Le serveur stocke le texte tel quel (voulu : l'échappement est l'affaire
 * de l'écran, voir la sentinelle des entrées d'amn-api). La preuve doit donc
 * se faire À L'ÉCRAN : ce contrôle écrit, par l'API et au nom du compte
 * d'essai, des valeurs hostiles là où une cliente écrit (titre de tâche, nom
 * de client, corps de note, message du Hall, nom d'affichage du Hall), ouvre
 * les écrans qui les rendent, et vérifie :
 *
 *   · qu'aucun nœud n'est né du texte (img, script, svg, iframe, style,
 *     lien javascript:) — React échappe, et rien ne doit contourner React ;
 *   · qu'aucun dialogue ni erreur de page n'a été déclenché (un `onerror`
 *     qui s'exécute ouvrirait `alert`) ;
 *   · que la page est toujours visible (une injection CSS `</style>` qui
 *     masquerait le corps se verrait ici) ;
 *   · que le texte hostile est bien affiché EN TOUTES LETTRES : il n'est ni
 *     « nettoyé » ni tronqué — un compte-rendu qui parle de `<script>` doit
 *     pouvoir le dire.
 *
 * Puis il efface ce qu'il a écrit. Il vaut pour les deux éditions ; le Hall
 * n'est joué que si le compte peut y consentir (owner/admin).
 *
 *   AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… AMN_API_URL=http://127.0.0.1:8791 node scripts/check-xss.mjs <bundle> [port]
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';

const BUNDLE = process.argv[2];
const PORT = Number(process.argv[3] ?? 4197);
const EMAIL = process.env.AMN_E2E_EMAIL ?? '';
const MDP = process.env.AMN_E2E_PASSWORD ?? '';
const API = process.env.AMN_API_URL ?? 'http://127.0.0.1:8791';
const CHROMIUM = process.env.AMN_E2E_CHROMIUM ?? '/opt/pw-browsers/chromium';
if (!BUNDLE || !EMAIL || !MDP) {
  console.log('Usage : AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… node scripts/check-xss.mjs <dossier-du-bundle> [port]');
  process.exit(1);
}

const HOSTILES = {
  img: '<img src=x onerror="window.__xss=1;alert(1)">',
  script: '<script>window.__xss=2</script>',
  svg: '<svg onload="window.__xss=3"><a xlink:href="javascript:window.__xss=4">x</a></svg>',
  lien: '<a href="javascript:window.__xss=5">cliquez</a> [texte](javascript:window.__xss=6)',
  style: '</style><style>body{display:none !important}</style>',
  iframe: '<iframe srcdoc="<script>parent.__xss=7</script>"></iframe>',
  gabarit: '{{constructor.constructor("window.__xss=8")()}} ${window.__xss=9}',
  entites: '&lt;b&gt;pas gras&lt;/b&gt; &#60;i&#62;',
};
const TOUT = Object.values(HOSTILES).join(' ');

const serveur = spawn('node', [new URL('./servir-bundle.mjs', import.meta.url).pathname, BUNDLE, String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const APP = `http://127.0.0.1:${PORT}/`;
const fautes = [];
const faute = (m) => fautes.push(m);

async function api(token, path, init = {}) {
  const r = await fetch(`${API}${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
  let body = null;
  try { body = await r.json(); } catch { body = null; }
  return { status: r.status, body };
}

const nav = await chromium.launch({ executablePath: CHROMIUM });
const ecrits = [];
let token = '';
try {
  const login = await fetch(`${API}/v1/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: MDP }) });
  if (login.status !== 200) throw new Error(`connexion API ${login.status}`);
  const session = await login.json();
  token = session.token;
  const role = session.user?.role ?? session.role ?? null;

  /* 1 · écrire l'hostile là où une cliente écrit */
  const cibles = [
    { collection: 'tasks', id: 'xss-tache', data: { title: TOUT, status: 'todo' }, route: '/tasks' },
    { collection: 'clients', id: 'xss-client', data: { name: TOUT, email: 'x@x.test' }, route: '/clients' },
    { collection: 'notes', id: 'xss-note', data: { title: `Note ${HOSTILES.img}`, body: TOUT }, route: '/notes' },
  ];
  for (const c of cibles) {
    const r = await api(token, `/v1/collections/${c.collection}/${c.id}`, { method: 'PUT', body: JSON.stringify({ data: c.data }) });
    if (r.status === 200) ecrits.push(c);
    else if (r.status === 404) console.log(`  · ${c.collection} : collection fermée pour ce compte, écran non joué`);
    else faute(`écriture ${c.collection} : ${r.status}`);
  }
  let hallJoue = false;
  let hallEtaitDedans = false;
  if (role === 'owner' || role === 'admin') {
    const etat = await api(token, '/v1/hall/participation');
    hallEtaitDedans = Boolean(etat.body?.participation?.participe);
    const p = await api(token, '/v1/hall/participation', { method: 'PUT', body: JSON.stringify({ participe: true, displayName: `Org ${EMAIL.split('@')[0]} ${HOSTILES.img}` }) });
    if (p.status === 200) {
      const m = await api(token, '/v1/hall/messages', { method: 'POST', body: JSON.stringify({ body: TOUT, signature: HOSTILES.svg }) });
      if (m.status === 201) hallJoue = true;
      else faute(`message du Hall : ${m.status} ${m.body?.error ?? ''}`);
    } else faute(`participation au Hall : ${p.status} ${p.body?.error ?? ''}`);
  } else console.log('  · Hall : le compte ne peut pas y consentir, écran non joué');

  /* 2 · ouvrir les écrans et regarder */
  const page = await nav.newPage({ viewport: { width: 1280, height: 860 } });
  const alertes = [];
  page.on('dialog', async (d) => { alertes.push(d.message()); await d.dismiss(); });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e).slice(0, 120)));
  await page.goto(APP, { waitUntil: 'networkidle' });
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(MDP);
  await page.locator('button[type="submit"]').click();
  for (let i = 0; i < 30 && (await page.content()).includes('name="password"'); i++) await page.waitForTimeout(500);
  await page.waitForTimeout(1500);
  if ((await page.getByText(/cliquez pour passer/i).count()) > 0) { await page.mouse.click(400, 400); await page.waitForTimeout(800); }
  const plusTard = page.getByRole('button', { name: /plus tard/i });
  if ((await plusTard.count()) > 0) { await plusTard.first().click(); await page.waitForTimeout(500); }

  const routes = ecrits.map((c) => c.route).concat(hallJoue ? ['/hall'] : []).concat(['/']);
  let ecrans = 0;
  for (const route of routes) {
    await page.goto(APP + '#' + route, { waitUntil: 'networkidle' }).catch(() => undefined);
    await page.waitForTimeout(1500);
    ecrans += 1;
    const mesure = await page.evaluate(() => {
      const main = document.querySelector('main') ?? document.body;
      const nes = [...main.querySelectorAll('img[src="x"], script, svg[onload], iframe, style, a[href^="javascript:"]')].map((e) => e.tagName.toLowerCase());
      const texte = main.innerText;
      return {
        nes,
        xss: window.__xss ?? null,
        corpsVisible: getComputedStyle(document.body).display !== 'none' && document.body.getBoundingClientRect().height > 100,
        montreTelQuel: texte.includes('<img src=x onerror=') && texte.includes('<script>'),
      };
    });
    if (mesure.nes.length > 0) faute(`${route} · ${mesure.nes.length} nœud(s) né(s) du texte : ${[...new Set(mesure.nes)].join(', ')}`);
    if (mesure.xss !== null) faute(`${route} · du code a tourné (__xss=${mesure.xss})`);
    if (!mesure.corpsVisible) faute(`${route} · la page a disparu : une injection CSS a pris`);
    if (route !== '/' && !mesure.montreTelQuel) faute(`${route} · le texte hostile n'est pas montré tel quel (nettoyé ou tronqué)`);
  }
  if (alertes.length > 0) faute(`${alertes.length} dialogue(s) ouvert(s) : ${alertes.slice(0, 2).join(' / ')}`);
  if (erreurs.length > 0) faute(`${erreurs.length} erreur(s) de page : ${erreurs.slice(0, 2).join(' / ')}`);
  await page.close();

  /* 3 · effacer ce qu'on a écrit */
  for (const c of ecrits) await api(token, `/v1/collections/${c.collection}/${c.id}`, { method: 'DELETE' }).catch(() => undefined);
  if (role === 'owner' || role === 'admin') {
    await api(token, '/v1/hall/participation', { method: 'PUT', body: JSON.stringify({ participe: hallEtaitDedans, displayName: hallEtaitDedans ? undefined : undefined }) }).catch(() => undefined);
  }

  if (fautes.length > 0) {
    console.log(`\nXSS : ${fautes.length} faute(s) sur ${ecrans} écran(s).`);
    for (const f of fautes) console.log(`  ✗ ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`\nXSS : OK — ${Object.keys(HOSTILES).length} charges hostiles (image, script, SVG, lien javascript:, style, iframe, gabarit, entités) dans ${ecrits.length} collection(s)${hallJoue ? ' et le Hall' : ''}, ${ecrans} écran(s) relus : aucun nœud né du texte, aucun code exécuté, page visible, texte montré tel quel.`);
  }
} catch (e) {
  console.log(`XSS : ÉCHEC — ${e.message}`);
  process.exitCode = 1;
} finally {
  await nav.close();
  serveur.kill();
}
