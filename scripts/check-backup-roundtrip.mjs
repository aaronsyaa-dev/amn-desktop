#!/usr/bin/env node
/**
 * Preuve de bout en bout : exporter, puis restaurer, dans l'application qui
 * tourne vraiment.
 *
 * `check-backup-coverage.mjs` vérifie la FORME du code — que la liste des
 * collections vient bien de la synchronisation, qu'aucun magasin hérité n'est
 * relu. C'est nécessaire et ça ne suffit pas : le bug d'origine ne se voyait
 * pas non plus dans le code pris isolément. Il se voyait dans le fichier
 * téléchargé, qui était vide.
 *
 * Ce script construit donc l'édition Business, la sert contre un faux amn-api
 * QUI GARDE SON ÉTAT (le stub de la capture, lui, répond n'importe quoi aux
 * écritures — ça ne servait qu'à photographier), puis conduit un vrai
 * Chromium :
 *
 *   1. connexion, Réglages, « Exporter » — le fichier est intercepté ;
 *   2. il doit contenir les 21 collections, aux bons comptes ;
 *   3. il ne doit contenir NI la pierre tombale semée exprès, NI le
 *      coffre-fort ;
 *   4. on efface trois enregistrements côté serveur ;
 *   5. « Restaurer… », on redépose le fichier, on restaure ;
 *   6. les trois enregistrements doivent être revenus, et rien d'autre ne
 *      doit avoir bougé.
 *
 * Usage :  node scripts/check-backup-roundtrip.mjs
 *          node scripts/check-backup-roundtrip.mjs --garder-build
 */

import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const requireIci = createRequire(import.meta.url);
const { WebSocketServer } = requireIci('ws');
const PORT_API = 5321;
const PORT_WEB = 5322;
const echecs = [];
const ok = (quoi, detail = '') => console.log(`  OK  ${quoi}${detail ? ` — ${detail}` : ''}`);
const ko = (quoi, detail = '') => {
  echecs.push(`${quoi}${detail ? ` — ${detail}` : ''}`);
  console.log(`  KO  ${quoi}${detail ? ` — ${detail}` : ''}`);
};
const t = (quoi, condition, detail = '') => (condition ? ok(quoi, detail) : ko(quoi, detail));

/* ------------------------------------------------------- 1. le faux dos -- */

/** Les collections attendues, lues à la source plutôt que recopiées ici. */
const COLLECTIONS = (() => {
  const src = readFileSync(join(RACINE, 'src/shared/api.ts'), 'utf-8');
  const bloc = /export type SyncedCollection =([\s\S]*?);/.exec(src);
  return [...bloc[1].matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]);
})();

const J = (s) => new Date(Date.now() + s * 864e5).toISOString();
const ORG = { id: 'org-test', name: 'Test Sauvegarde', plan: 'business_standard', logoDataUrl: null, modules: null };
const USER = { id: 'u-1', orgId: 'org-test', email: 'test@exemple.fr', role: 'owner', status: 'active' };
const SESSION = { token: 'jeton-test', expiresAt: J(30), user: USER, org: ORG };

/** État du serveur : collection → id → enregistrement. Écrit par PUT, effacé par DELETE. */
const ETAT = Object.fromEntries(COLLECTIONS.map((c) => [c, new Map()]));
const poser = (col, id, data, deleted = false) =>
  ETAT[col].set(id, { id, collection: col, data, updatedAt: J(-1), deleted });

/* Deux enregistrements par collection, pour qu'aucune ne puisse passer pour
   « couverte » en étant simplement vide des deux côtés. */
for (const col of COLLECTIONS) {
  poser(col, `${col}-a`, { titre: `${col} A`, valeur: 1 });
  poser(col, `${col}-b`, { titre: `${col} B`, valeur: 2 });
}
/* Une pierre tombale semée exprès : elle ne doit PAS ressortir dans le
   fichier, sinon la restauration ressusciterait ce que la cliente a effacé. */
poser('clients', 'clients-efface', { titre: 'effacé' }, true);
/* Un enregistrement lourd, comme une image de la médiathèque en base64 :
   c'est le cas qui fait tomber une restauration écrite naïvement. */
poser('media', 'media-lourd', { titre: 'photo', dataUrl: `data:image/png;base64,${'A'.repeat(60_000)}` });

const cors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
};

const api = createServer((req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const p = new URL(req.url, 'http://x').pathname;
  const envoyer = (o, code = 200) => {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(o));
  };
  if (p === '/v1/auth/login') return envoyer(SESSION);
  if (p === '/v1/auth/me') return envoyer({ org: ORG, user: USER });
  if (p === '/v1/auth/logout') return envoyer({ ok: true });

  const m = p.match(/^\/v1\/collections\/([^/]+)(?:\/(.+))?$/);
  if (!m) return envoyer({ error: 'inconnu', chemin: p }, 404);
  const col = m[1];
  const id = m[2] ? decodeURIComponent(m[2]) : null;
  /* Le contrat est { users } — répondre { members } laissait `users`
     undefined et faisait tomber toute la synchronisation. */
  if (col === '_presence') return envoyer({ users: [] });
  if (!ETAT[col]) return envoyer({ error: 'collection refusée' }, 404);

  if (req.method === 'GET') return envoyer({ records: [...ETAT[col].values()] });
  if (req.method === 'DELETE') {
    const actuel = ETAT[col].get(id);
    poser(col, id, actuel?.data ?? {}, true);
    return envoyer({ record: ETAT[col].get(id) });
  }
  if (req.method === 'PUT') {
    let corps = '';
    req.on('data', (c) => { corps += c; });
    req.on('end', () => {
      let data = {};
      try { data = JSON.parse(corps).data ?? {}; } catch { /* corps illisible */ }
      poser(col, id, data, false);
      envoyer({ record: ETAT[col].get(id) });
    });
    return undefined;
  }
  return envoyer({ error: 'méthode' }, 405);
});

new WebSocketServer({ server: api, path: '/v1/stream' }).on('connection', () => {});
await new Promise((r) => api.listen(PORT_API, r));
console.log(`\nfaux amn-api (avec état) → http://localhost:${PORT_API}`);
console.log(`${COLLECTIONS.length} collections, 2 enregistrements chacune.\n`);

/* ------------------------------------------------------------ 2. build -- */

console.log('build Business…');
const build = spawnSync(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.renderer.config.mts'],
  { cwd: RACINE, stdio: 'ignore',
    env: { ...process.env, AMN_EDITION: 'business', VITE_AMN_API_URL: `http://localhost:${PORT_API}` } },
);
if (build.status !== 0) { console.error('build en échec'); process.exit(1); }

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
const web = createServer((req, res) => {
  const chemin = new URL(req.url, 'http://x').pathname;
  let f = join(RACINE, 'dist', chemin === '/' ? 'index.html' : chemin.replace(/^\//, ''));
  if (!existsSync(f)) f = join(RACINE, 'dist', 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[f.slice(f.lastIndexOf('.'))] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => web.listen(PORT_WEB, r));

/* ------------------------------------------------------- 3. le parcours -- */

const pw = (() => {
  for (const essai of [() => requireIci('playwright'),
                       () => requireIci('/opt/node22/lib/node_modules/playwright')]) {
    try { return essai(); } catch { /* suivant */ }
  }
  throw new Error('Playwright introuvable : npm i -D playwright');
})();

const nav = await pw.chromium.launch();
const ctx = await nav.newContext({
  viewport: { width: 1400, height: 900 }, locale: 'fr-FR', timezoneId: 'Europe/Paris',
  acceptDownloads: true,
});
const page = await ctx.newPage();
const erreursConsole = [];
page.on('pageerror', (e) => erreursConsole.push(process.env.DEBUG_BACKUP ? (e.stack || String(e)) : String(e)));

await page.goto(`http://localhost:${PORT_WEB}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const champs = await page.$$('input');
await champs[0].fill(USER.email);
await champs[1].fill('mot-de-passe');
await page.click('button[type="submit"], button:has-text("Se connecter")');
await page.waitForTimeout(2500);

/* HashRouter : la route vit après le `#`, un chemin nu retombe sur l'accueil. */
await page.goto(`http://localhost:${PORT_WEB}/#/settings`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

/* Preuve visuelle, à la demande : le panneau tel que la cliente le voit.
   Le test s'y connecte déjà pour de vrai, autant en profiter plutôt que de
   remonter un second décor à côté. */
const CAPTURE = process.argv.includes('--capture')
  ? process.argv[process.argv.indexOf('--capture') + 1]
  : null;
if (CAPTURE) {
  await page.getByRole('button', { name: /^Exporter$/ }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: CAPTURE });
  console.log(`  panneau capturé → ${CAPTURE}`);
}

console.log('Export :');
const boutons = await page.locator('button').allTextContents();
if (process.env.DEBUG_BACKUP) {
  console.log('  boutons visibles :', JSON.stringify(boutons));
  console.log('  url :', page.url());
  await page.screenshot({ path: process.env.DEBUG_BACKUP, fullPage: true });
}
const [telechargement] = await Promise.all([
  page.waitForEvent('download', { timeout: 30_000 }),
  page.getByRole('button', { name: /^Exporter$/ }).click(),
]);
const dossier = mkdtempSync(join(tmpdir(), 'amn-backup-'));
const fichier = join(dossier, 'sauvegarde.json');
await telechargement.saveAs(fichier);
const snapshot = JSON.parse(readFileSync(fichier, 'utf-8'));

/* --------------------------------------------------- 4. ce que le fichier dit -- */

t('Le fichier est une sauvegarde AMN', snapshot.kind === 'amn-backup', `kind=${snapshot.kind}`);
t('Format 2', snapshot.version === 2, `version=${snapshot.version}`);

const presentes = Object.keys(snapshot.data ?? {});
const manquantes = COLLECTIONS.filter((c) => !presentes.includes(c));
t(`Les ${COLLECTIONS.length} collections sont dans le fichier`, manquantes.length === 0,
  manquantes.length ? `manque : ${manquantes.join(', ')}` : `${presentes.length} présentes`);

const mauvais = COLLECTIONS.filter((c) => (snapshot.data[c] ?? []).length < 2);
t('Chaque collection ramène ses enregistrements', mauvais.length === 0,
  mauvais.length ? `vides ou incomplètes : ${mauvais.join(', ')}` : 'deux minimum partout');

const tombe = (snapshot.data.clients ?? []).some((r) => r.id === 'clients-efface');
t('La pierre tombale est écartée', !tombe,
  tombe ? 'un enregistrement supprimé est dans le fichier' : 'clients-efface absent');

const brut = readFileSync(fichier, 'utf-8');
t('Le coffre-fort n’est pas dans le fichier', !/amn\.vault|vaultEntries|"vault"/.test(brut));
t('Le fichier dit ce qu’il exclut', Array.isArray(snapshot.exclut) && snapshot.exclut.length > 0,
  (snapshot.exclut ?? []).join(' | '));

/* L'export doit être le MIROIR du serveur, ni plus ni moins. Comparer à un
   nombre écrit en dur ici passerait à côté du cas qui compte : une collection
   que l'export ramène à moitié. On compare donc à l'état réel du serveur —
   l'application écrit son propre profil à la connexion, et ce genre d'écart
   légitime doit se voir dans les deux colonnes à la fois. */
const ecarts = COLLECTIONS.map((c) => {
  const serveur = [...ETAT[c].values()].filter((r) => !r.deleted).length;
  const fichier = (snapshot.data[c] ?? []).length;
  return { c, serveur, fichier };
}).filter(({ serveur, fichier }) => serveur !== fichier);
t('Le fichier est le miroir exact du serveur', ecarts.length === 0,
  ecarts.map(({ c, serveur, fichier }) => `${c} : serveur ${serveur}, fichier ${fichier}`).join(' ; ')
    || `${Object.values(snapshot.compte).reduce((n, v) => n + v, 0)} enregistrements des deux côtés`);

const lourd = (snapshot.data.media ?? []).find((r) => r.id === 'media-lourd');
t('Une image de médiathèque est bien emportée', Boolean(lourd?.data?.dataUrl?.length > 50_000),
  `${Math.round((lourd?.data?.dataUrl?.length ?? 0) / 1024)} Ko`);

/* ------------------------------------------------- 5. effacer, restaurer -- */

console.log('\nRestauration :');
const efface = [['clients', 'clients-a'], ['invoices', 'invoices-b'], ['appointments', 'appointments-a']];
for (const [col, id] of efface) poser(col, id, {}, true);
console.log(`  ${efface.length} enregistrements effacés côté serveur.`);

await page.setInputFiles('input[type="file"][accept*="json"]', fichier);
await page.waitForTimeout(600);
const apercu = await page.getByText(/enregistrement\(s\)\./).first().textContent().catch(() => '');
t('L’aperçu annonce le contenu avant d’écrire', /\d+\s+enregistrement/.test(apercu || ''),
  (apercu || '').trim().slice(0, 60));

await page.getByRole('button', { name: /Restaurer maintenant/ }).click();
await page.waitForSelector('text=/enregistrement\\(s\\) restauré\\(s\\)/', { timeout: 60_000 });
const bilan = await page.getByText(/enregistrement\(s\) restauré\(s\)/).first().textContent();
console.log(`  ${bilan.trim()}`);

const revenus = efface.filter(([col, id]) => ETAT[col].get(id)?.deleted === false);
t('Les enregistrements effacés sont revenus', revenus.length === efface.length,
  `${revenus.length}/${efface.length}`);
const contenuRevenu = ETAT.clients.get('clients-a')?.data;
t('Le contenu est le bon, pas un enregistrement vide', contenuRevenu?.titre === 'clients A',
  JSON.stringify(contenuRevenu));
t('La restauration ne ressuscite pas les suppressions du fichier',
  ETAT.clients.get('clients-efface')?.deleted === true);
t('Aucun échec annoncé', !/en échec/.test(bilan), bilan.trim());
t('Aucune erreur JavaScript', erreursConsole.length === 0, erreursConsole.join(' | '));

/* --------------------------------------------------------------- bilan -- */

await nav.close();
web.close();
api.close();
writeFileSync(join(dossier, 'etat-final.json'), JSON.stringify({ echecs }, null, 2));

console.log('');
if (echecs.length === 0) {
  console.log(`OK — export et restauration vérifiés sur les ${COLLECTIONS.length} collections, dans l'application réelle.`);
  process.exit(0);
}
console.error(`${echecs.length} échec(s) :`);
for (const e of echecs) console.error(`  - ${e}`);
process.exit(1);
