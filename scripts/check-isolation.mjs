#!/usr/bin/env node
/**
 * ISOLATION ENTRE ORGANISATIONS, DANS LE NAVIGATEUR — deux organisations,
 * toutes les collections, et le compte qui passe de l'une à l'autre.
 *
 * Le défaut qu'il fige : dans l'édition interne, le module Clients montrait
 * des clients appartenant aux Desktops de nos clientes. amn-api servait juste ;
 * c'est le poste qui mélangeait. Son miroir local (`amn.sync.<collection>`)
 * était commun à toutes les organisations d'un compte, le rattrapage
 * FUSIONNE au lieu de remplacer, et la bascule d'organisation (le rail)
 * rechargeait l'app sans le vider. Un compte membre de plusieurs
 * organisations voyait donc, dans chacune, les fiches de toutes les autres —
 * et la file d'envoi, commune elle aussi, pouvait les y écrire.
 *
 * Ce contrôle démarre SON amn-api (en mémoire, rien de réel n'est touché),
 * y crée deux organisations remplies sur toutes les collections synchronisées,
 * et vérifie, à chaque étape, ce que l'écran Clients affiche et ce que
 * contient CHAQUE miroir local :
 *
 *   1. un ancien miroir non indexé, laissé par une version précédente avec une
 *      fiche étrangère dedans, ne doit jamais réapparaître ;
 *   2. A → B → A pour un compte membre des deux ;
 *   3. le sens inverse : un compte de B seul ne voit rien de A.
 *
 * Usage : node scripts/check-isolation.mjs <dossier-du-bundle> <port>
 * amn-api est trouvé comme pour les contrôles croisés (AMN_API_ROOT, voir
 * scripts/api-root.mjs). Sans lui, le contrôle passe en le disant.
 */
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { trouverApiRoot } from './api-root.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [BUNDLE, PORT] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!BUNDLE || !PORT) {
  console.error('Usage : node scripts/check-isolation.mjs <dossier-du-bundle> <port>');
  process.exit(2);
}
const apiRoot = trouverApiRoot(ROOT);
if (!apiRoot) {
  console.log('Isolation : amn-api introuvable (AMN_API_ROOT) — contrôle sauté.');
  process.exit(0);
}

process.env.NODE_ENV = 'test';
process.env.OPERATOR_TOKEN ||= 'controle-isolation';
const depuis = (f) => import(pathToFileURL(path.join(apiRoot, f)).href);
const { createApp } = await depuis('src/server.js');
const { createSqliteDb } = await depuis('src/db/sqlite.js');
const { hashPassword } = await depuis('src/lib/password.js');
const { ALLOWED } = await depuis('src/routes/collections.js');
const { AMN_ORG_ID } = await depuis('src/db/tenancy.js');
// `--fondatrice` : A est AMN DevSec elle-même — le cas signalé, dans l'édition interne.
const FONDATRICE = process.argv.includes('--fondatrice');

const MDP = 'controle-isolation-2026';
const db = createSqliteDb(':memory:');
await db.init();
const serveur = http.createServer(await createApp({ db }));
await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
const API = `http://127.0.0.1:${serveur.address().port}`;

async function compte(email, orgId) {
  const u = await db.createUser({ orgId, email, passwordHash: await hashPassword(MDP), role: 'owner', status: 'active' });
  await db.addMembership({ userId: u.id, orgId, role: 'owner' });
  return u;
}
const orgA = FONDATRICE
  ? await db.getOrganization(AMN_ORG_ID) // créée par l'initialisation de la base
  : await db.createOrganization({ name: 'Isolation A', plan: 'business_standard' });
const orgB = await db.createOrganization({ name: 'Isolation B', plan: 'business_standard' });
const membreDesDeux = await compte('iso-a@exemple.test', orgA.id);
await db.addMembership({ userId: membreDesDeux.id, orgId: orgB.id, role: 'member' });
await compte('iso-b@exemple.test', orgB.id);
const COLLECTIONS = [...ALLOWED];
for (const nom of COLLECTIONS) {
  await db.upsertRecord(orgA.id, nom, `A-${nom}`, { name: `A ${nom}`, title: `A ${nom}` });
  await db.upsertRecord(orgB.id, nom, `B-${nom}`, { name: `B ${nom}`, title: `B ${nom}` });
}
await db.upsertRecord(orgA.id, 'clients', 'A-clients', { name: 'Alice Client-de-A', company: 'A', status: 'active' });
await db.upsertRecord(orgB.id, 'clients', 'B-clients', { name: 'Bruno Client-de-B', company: 'B', status: 'active' });

const servi = spawn('node', [path.join(ROOT, 'scripts', 'servir-bundle.mjs'), BUNDLE, PORT], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const APP = `http://127.0.0.1:${PORT}`;

const echecs = [];
const verifier = (ok, message) => {
  console.log(`  ${ok ? '✓' : '✗'} ${message}`);
  if (!ok) echecs.push(message);
};

const navigateur = await chromium.launch({ executablePath: process.env.AMN_CHROMIUM ?? '/opt/pw-browsers/chromium' });

async function session(email, { miroirHerite = false } = {}) {
  const contexte = await navigateur.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await contexte.newPage();
  // Le bundle parle à l'amn-api pour laquelle il a été construit : on l'envoie
  // ici, sans reconstruire. Seules les routes /v1 sont détournées.
  await page.route(/^https?:\/\/[^/]+\/v1\//, (route) => {
    const u = new URL(route.request().url());
    if (u.origin === APP) return route.continue();
    return route.continue({ url: `${API}${u.pathname}${u.search}` });
  });
  await page.goto(`${APP}/`, { waitUntil: 'networkidle' });
  if (miroirHerite) {
    await page.evaluate(() => {
      const etranger = { id: 'ETRANGER-clients', collection: 'clients', deleted: false, updatedAt: new Date().toISOString(), data: { name: 'Zoé Client-étranger', company: 'Ailleurs' } };
      localStorage.setItem('amn.sync.clients', JSON.stringify([etranger]));
      localStorage.setItem('amn.sync.__envoi', JSON.stringify([{ collection: 'clients', id: 'ETRANGER-clients', geste: 'ecriture', donnees: etranger.data, pose: 1, essais: 0 }]));
    });
  }
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(MDP);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(4000);
  return { page, contexte };
}

async function passerLesFenetres(page) {
  for (let i = 0; i < 8; i++) {
    const d = page.locator('[role="dialog"][aria-modal="true"]').first();
    if (!(await d.count())) break;
    const b = d.locator('button').filter({ hasText: /Passer|Plus tard|Ignorer|Entrer|Commencer|Continuer|Fermer|Aller/ }).first();
    if (await b.count()) await b.click();
    else await d.locator('button').first().click();
    await page.waitForTimeout(500);
  }
}

async function ecranClients(page) {
  await page.evaluate(() => { window.location.hash = '#/clients'; });
  // Le premier affichage précède le premier rattrapage : on attend qu'une des
  // deux fiches connues soit là (ou dix secondes), puis on laisse le reste arriver.
  let texte = '';
  for (let i = 0; i < 20; i++) {
    await passerLesFenetres(page);
    // Les fiches semées partout sont réduites à un nom : un écran qui en
    // attend plus peut tomber sur la limite d'erreur. On la relève — ce
    // contrôle juge l'isolation, pas la tolérance des écrans aux fiches vides.
    const relever = page.getByRole('button', { name: 'Réessayer' });
    if (await relever.count()) await relever.first().click();
    texte = await page.locator('body').innerText();
    if (/Client-de-[AB]/.test(texte)) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1500);
  texte = await page.locator('body').innerText();
  return { A: texte.includes('Alice Client-de-A'), B: texte.includes('Bruno Client-de-B'), etranger: texte.includes('Zoé Client-étranger') };
}

/** Chaque miroir local, par organisation : quels préfixes d'identifiant il contient. */
async function miroirs(page) {
  return page.evaluate(() => {
    const parOrg = {};
    const herites = [];
    for (const cle of Object.keys(localStorage)) {
      if (!cle.startsWith('amn.sync.')) continue;
      const m = /^amn\.sync\.(org-[^.]+|ctx-[^.]+|sans-organisation)\.(.+)$/.exec(cle);
      if (!m) { if (!cle.startsWith('amn.sync.quarantaine')) herites.push(cle); continue; }
      if (m[2] === '__envoi') continue;
      let lignes = [];
      try { lignes = JSON.parse(localStorage.getItem(cle) || '[]'); } catch { lignes = []; }
      const ens = (parOrg[m[1]] ??= new Set());
      for (const l of Array.isArray(lignes) ? lignes : []) ens.add(String(l.id).split('-')[0]);
    }
    return { parOrg: Object.fromEntries(Object.entries(parOrg).map(([k, v]) => [k, [...v].sort()])), herites };
  });
}

async function basculer(page, orgId) {
  await page.evaluate(async ({ orgId, API }) => {
    const s = JSON.parse(localStorage.getItem('amn-desktop.auth.session'));
    // La requête du rail, puis ce qu'il fait : ranger la session et recharger.
    const r = await fetch(`${API}/v1/auth/organizations/switch`, { method: 'POST', headers: { Authorization: `Bearer ${s.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ orgId }) });
    const j = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(j));
    localStorage.setItem('amn-desktop.auth.session', JSON.stringify({ ...s, token: j.token, org: j.org, role: j.user?.role ?? s.role }));
    localStorage.removeItem('amn-desktop.support.token');
  }, { orgId, API });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
}

// Le poste écrit aussi ses propres fiches (profil, préférences…) : on vérifie
// que l'AUTRE organisation est absente, et que la sienne est bien là.
const seul = (m, cle, [lettre]) => {
  const prefixes = m.parOrg[cle] ?? [];
  const autre = lettre === 'A' ? 'B' : 'A';
  return prefixes.includes(lettre) && !prefixes.includes(autre) && !prefixes.includes('ETRANGER');
};

try {
  console.log('Isolation entre organisations — compte membre de A et de B :');
  const { page, contexte } = await session('iso-a@exemple.test', { miroirHerite: true });

  let vu = await ecranClients(page);
  let m = await miroirs(page);
  verifier(vu.A && !vu.B, 'dans A, Clients montre A et pas B');
  verifier(!vu.etranger, 'l’ancien miroir non indexé ne réapparaît pas');
  verifier(m.herites.length === 0, `aucune clé de miroir non indexée ne subsiste (${m.herites.join(', ') || 'aucune'})`);
  verifier(seul(m, `org-${orgA.id}`, ['A']), `le miroir de A ne contient que A, sur ${COLLECTIONS.length} collections`);

  await basculer(page, orgB.id);
  vu = await ecranClients(page);
  m = await miroirs(page);
  verifier(vu.B && !vu.A, 'après bascule vers B, Clients montre B et pas A');
  verifier(seul(m, `org-${orgB.id}`, ['B']), 'le miroir de B ne contient que B');
  verifier(seul(m, `org-${orgA.id}`, ['A']), 'le miroir de A n’a rien reçu de B');

  await basculer(page, orgA.id);
  vu = await ecranClients(page);
  verifier(vu.A && !vu.B, 'retour dans A : Clients montre A et pas B');

  const ecritsAilleurs = (await db.listRecords(orgB.id, 'clients')).filter((r) => !r.deleted && !r.id.startsWith('B-'));
  const etrangersChezA = (await db.listRecords(orgA.id, 'clients')).filter((r) => !r.deleted && !r.id.startsWith('A-'));
  verifier(ecritsAilleurs.length === 0 && etrangersChezA.length === 0, 'côté serveur, aucune fiche écrite dans la mauvaise organisation (file héritée comprise)');
  await contexte.close();

  console.log('Sens inverse — compte de B seul :');
  const b = await session('iso-b@exemple.test');
  vu = await ecranClients(b.page);
  m = await miroirs(b.page);
  verifier(vu.B && !vu.A, 'Clients montre B et rien de A');
  verifier(Object.values(m.parOrg).every((p) => !p.includes('A')), 'aucun miroir ne contient un enregistrement de A');
  await b.contexte.close();
} finally {
  await navigateur.close();
  servi.kill();
  serveur.closeAllConnections?.();
  await new Promise((r) => serveur.close(r));
  await db.close();
}

if (echecs.length) {
  console.error(`\n${echecs.length} défaut(s) d’isolation.`);
  process.exit(1);
}
console.log('\nIsolation : aucune donnée d’une organisation n’apparaît ni ne s’écrit dans une autre.');
