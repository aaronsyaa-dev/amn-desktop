#!/usr/bin/env node
/**
 * LES MODULES DE BASE RESTENT LÀ — visibles, ouvrables, et avec leurs données.
 *
 * Né d'un signalement en production (octobre 2026) : « mon desktop n'affiche
 * plus le module Clients ». Rien ne vérifiait, de bout en bout, qu'un module
 * OUVERT à une organisation est encore dans son menu ET montre ses fiches après
 * un changement — de code, de configuration ou de version.
 *
 * Ce contrôle démarre SON amn-api (en mémoire, rien de réel n'est touché), crée
 * une organisation de référence avec une fiche dans chaque module de base, et
 * exige, pour chaque scénario :
 *
 *   · Clients, Agenda, Tâches, Facturation présents dans la barre latérale ;
 *   · leur adresse s'ouvre (pas de renvoi à l'accueil, pas d'écran d'erreur) ;
 *   · la fiche de référence s'y affiche.
 *
 * Scénarios (édition Business) :
 *   1. organisation « tous les modules », rôles propriétaire, admin, membre ;
 *   2. la même après un geste de configuration (ouverture d'un module hors
 *      formule, puis changement de formule) — c'est ce geste qui matérialise
 *      une liste de modules ;
 *   3. le passage d'une ancienne version : un ancien miroir avec une fiche
 *      étrangère (qui ne doit PAS réapparaître) et une écriture restée en
 *      attente (qui doit arriver, dans la bonne organisation).
 * Avec `--interne` : le même contrôle dans le dossier de la cliente ouvert
 * depuis Supervisor (contexte de support).
 *
 * Usage : node scripts/check-modules-de-base.mjs <bundle> <port> [--interne]
 * amn-api est trouvé comme pour les contrôles croisés (AMN_API_ROOT).
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { trouverApiRoot } from './api-root.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [BUNDLE, PORT] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const INTERNE = process.argv.includes('--interne');
if (!BUNDLE || !PORT) {
  console.error('Usage : node scripts/check-modules-de-base.mjs <bundle> <port> [--interne]');
  process.exit(2);
}
const apiRoot = trouverApiRoot(ROOT);
if (!apiRoot) {
  console.log('Modules de base : amn-api introuvable (AMN_API_ROOT) — contrôle sauté.');
  process.exit(0);
}

process.env.NODE_ENV = 'test';
process.env.OPERATOR_TOKEN ||= 'controle-modules-de-base';
const depuis = (f) => import(pathToFileURL(path.join(apiRoot, f)).href);
const { createApp } = await depuis('src/server.js');
const { createSqliteDb } = await depuis('src/db/sqlite.js');
const { hashPassword } = await depuis('src/lib/password.js');
const { AMN_ORG_ID } = await depuis('src/db/tenancy.js');

/** Les modules de base, et ce qui prouve que leurs données s'affichent. */
const BASE = [
  { key: 'clients', route: '/clients', preuve: /Référence Client/ },
  { key: 'agenda', route: '/agenda', preuve: /Référence RDV/ },
  { key: 'tasks', route: '/tasks', preuve: /Référence Tâche/ },
  { key: 'invoices', route: '/facturation', preuve: /REF-0001|Référence Facture/ },
];

const MDP = 'controle-modules-2026';
const db = createSqliteDb(':memory:');
await db.init();
const serveur = http.createServer(await createApp({ db }));
await new Promise((r) => serveur.listen(0, '127.0.0.1', r));
const API = `http://127.0.0.1:${serveur.address().port}`;
const operateur = (chemin, init = {}) =>
  fetch(API + chemin, { ...init, headers: { 'content-type': 'application/json', Authorization: `Bearer ${process.env.OPERATOR_TOKEN}`, ...(init.headers ?? {}) } });

async function compte(orgId, email, role) {
  const u = await db.createUser({ orgId, email, passwordHash: await hashPassword(MDP), role, status: 'active' });
  await db.addMembership({ userId: u.id, orgId, role });
  return u;
}
async function remplir(orgId) {
  const aujourdhui = new Date();
  aujourdhui.setHours(10, 0, 0, 0);
  const iso = new Date().toISOString();
  await db.upsertRecord(orgId, 'clients', 'ref-client', { name: 'Référence Client', company: 'Référence', status: 'active', email: '', phone: '', notes: '', createdAt: iso });
  await db.upsertRecord(orgId, 'appointments', 'ref-rdv', { title: 'Référence RDV', startAt: aujourdhui.toISOString(), durationMin: 30, clientId: null, clientName: '', location: '', notes: '' });
  await db.upsertRecord(orgId, 'tasks', 'ref-tache', { title: 'Référence Tâche', detail: '', assigneeEmail: '', status: 'todo', siteId: null, clientId: null, createdAt: iso });
  await db.upsertRecord(orgId, 'invoices', 'ref-facture', {
    number: 'REF-0001',
    status: 'sent',
    clientId: 0,
    billTo: { name: 'Référence Facture', company: '', email: '', address: '', vatNumber: '' },
    issuedAt: iso.slice(0, 10),
    dueAt: iso.slice(0, 10),
    lines: [{ id: 'l1', label: 'Prestation', quantity: 1, unitPriceCents: 10000, vatRate: 20 }],
    createdAt: iso,
  });
}

// Organisation 1 : tous les modules (colonne `modules` nulle), trois rôles.
const ref = await db.createOrganization({ name: 'Référence Modules', plan: 'business_standard' });
await remplir(ref.id);
await compte(ref.id, 'ref-proprio@exemple.test', 'owner');
await compte(ref.id, 'ref-admin@exemple.test', 'admin');
await compte(ref.id, 'ref-membre@exemple.test', 'member');
// Organisation 2 : la même, puis un geste de configuration qui matérialise une liste.
const conf = await db.createOrganization({ name: 'Référence Configurée', plan: 'business_standard' });
await remplir(conf.id);
await compte(conf.id, 'ref-conf@exemple.test', 'owner');
for (const [chemin, corps, methode] of [
  [`/v1/admin/organizations/${conf.id}/modules/videoProductions`, { open: true }, 'PUT'],
  [`/v1/admin/organizations/${conf.id}/plan`, { plan: 'solo' }, 'PUT'],
]) {
  const r = await operateur(chemin, { method: methode, body: JSON.stringify(corps) });
  if (!r.ok) throw new Error(`${methode} ${chemin} : ${r.status} ${await r.text()}`);
}
// Organisation 3 : le passage d'une ancienne version.
const maj = await db.createOrganization({ name: 'Référence Mise à jour', plan: 'business_standard' });
await remplir(maj.id);
await compte(maj.id, 'ref-maj@exemple.test', 'owner');
// Édition interne : un compte d'AMN DevSec qui ouvre le dossier de la référence.
if (INTERNE) await compte(AMN_ORG_ID, 'ref-amn@exemple.test', 'owner');

const servi = spawn('node', [path.join(ROOT, 'scripts', 'servir-bundle.mjs'), BUNDLE, PORT], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const APP = `http://127.0.0.1:${PORT}`;
const cheminChromium = process.env.AMN_CHROMIUM ?? '/opt/pw-browsers/chromium';
// En CI, `playwright-core install chromium` le range ailleurs : on le laisse le trouver.
const navigateur = await chromium.launch(fs.existsSync(cheminChromium) ? { executablePath: cheminChromium } : {});

const echecs = [];
const verifier = (ok, message) => {
  console.log(`    ${ok ? '✓' : '✗'} ${message}`);
  if (!ok) echecs.push(message);
};
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

async function ouvrirSession(email) {
  const contexte = await navigateur.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await contexte.newPage();
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e).slice(0, 160)));
  await page.route(/^https?:\/\/[^/]+\/v1\//, (route) => {
    const u = new URL(route.request().url());
    if (u.origin === APP) return route.continue();
    return route.continue({ url: `${API}${u.pathname}${u.search}` });
  });
  await page.goto(`${APP}/`, { waitUntil: 'networkidle' });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(MDP);
  await page.locator('button[type="submit"]').click();
  for (let i = 0; i < 30 && (await page.locator('input[name="password"]').count()); i++) await attendre(500);
  await attendre(2500);
  await passer(page);
  return { page, contexte, erreurs };
}

async function passer(page) {
  if ((await page.getByText(/cliquez pour passer/i).count()) > 0) await page.mouse.click(400, 400);
  for (let i = 0; i < 8; i++) {
    const d = page.locator('[role="dialog"][aria-modal="true"]').first();
    if (!(await d.count())) break;
    const b = d.locator('button').filter({ hasText: /Passer|Plus tard|Ignorer|Entrer|Commencer|Continuer|Fermer|Aller/ }).first();
    if (await b.count()) await b.click();
    else await d.locator('button').first().click();
    await attendre(400);
  }
}

/** Tous les liens de la barre latérale, famille par famille (le rail n'en déplie qu'une). */
async function liensDuMenu(page) {
  const vus = new Set();
  const lire = async () => {
    for (const h of await page.evaluate(() => [...document.querySelectorAll('aside a[href^="#/"], nav a[href^="#/"]')].map((a) => a.getAttribute('href').slice(1)))) vus.add(h);
  };
  await lire();
  const tuiles = page.locator('[data-rail-tuile]');
  const n = await tuiles.count();
  for (let i = 0; i < n; i++) {
    await tuiles.nth(i).click({ timeout: 2000 }).catch(() => undefined);
    await attendre(150);
    await lire();
  }
  return vus;
}

async function verifierModules(page, erreurs) {
  const menu = await liensDuMenu(page);
  for (const m of BASE) {
    verifier(menu.has(m.route), `${m.key} : présent dans le menu`);
    await page.evaluate((r) => { window.location.hash = `#${r}`; }, m.route);
    let texte = '';
    for (let i = 0; i < 20; i++) {
      await passer(page);
      texte = await page.locator('body').innerText();
      if (m.preuve.test(texte) || /erreur inattendue/i.test(texte)) break;
      await attendre(500);
    }
    const ici = page.url().split('#')[1] ?? '';
    verifier(ici.startsWith(m.route) && !/erreur inattendue/i.test(texte), `${m.key} : s'ouvre (${ici || '/'})`);
    verifier(m.preuve.test(texte), `${m.key} : affiche sa fiche de référence`);
  }
  verifier(erreurs.length === 0, `aucune erreur de page${erreurs.length ? ` (${erreurs[0]})` : ''}`);
}

try {
  if (!INTERNE) {
    for (const [email, role] of [['ref-proprio@exemple.test', 'propriétaire'], ['ref-admin@exemple.test', 'admin'], ['ref-membre@exemple.test', 'membre']]) {
      console.log(`  Organisation « tous les modules » — ${role} :`);
      const s = await ouvrirSession(email);
      await verifierModules(s.page, s.erreurs);
      await s.contexte.close();
    }

    console.log('  Organisation configurée (module ouvert hors formule, puis formule changée) — propriétaire :');
    const modules = (await db.getOrganization(conf.id)).modules;
    verifier(Array.isArray(modules) && BASE.every((m) => modules.includes(m.key)), 'côté serveur : la liste matérialisée garde les modules de base');
    const c = await ouvrirSession('ref-conf@exemple.test');
    await verifierModules(c.page, c.erreurs);
    await c.contexte.close();

    console.log('  Passage d’une ancienne version (ancien miroir + écriture en attente) — propriétaire :');
    const u = await ouvrirSession('ref-maj@exemple.test');
    await u.page.evaluate(() => {
      const iso = new Date().toISOString();
      localStorage.setItem('amn.sync.clients', JSON.stringify([{ id: 'etranger', collection: 'clients', deleted: false, updatedAt: iso, data: { name: 'Fantôme Étranger' } }]));
      localStorage.setItem('amn.sync.__envoi', JSON.stringify([{ collection: 'clients', id: 'ref-hors-ligne', geste: 'ecriture', donnees: { name: 'Référence Hors-ligne', company: '', status: 'prospect', _by: 'ref-maj@exemple.test' }, pose: iso, essais: 2 }]));
    });
    await u.page.reload({ waitUntil: 'networkidle' });
    await attendre(4000);
    await passer(u.page);
    await verifierModules(u.page, u.erreurs);
    const texte = await u.page.locator('body').innerText().catch(() => '');
    await u.page.evaluate(() => { window.location.hash = '#/clients'; });
    await attendre(2500);
    const clients = await u.page.locator('body').innerText();
    verifier(!clients.includes('Fantôme Étranger') && !texte.includes('Fantôme Étranger'), 'l’ancien miroir ne réapparaît pas');
    verifier(clients.includes('Référence Hors-ligne'), 'l’écriture en attente réapparaît à l’écran');
    const surServeur = (await db.listRecords(maj.id, 'clients')).some((r) => r.id === 'ref-hors-ligne' && !r.deleted);
    verifier(surServeur, 'l’écriture en attente est arrivée sur le serveur, dans la bonne organisation');
    const ailleurs = (await db.listRecords(ref.id, 'clients')).some((r) => r.id === 'ref-hors-ligne');
    verifier(!ailleurs, 'et nulle part ailleurs');
    await u.contexte.close();
  } else {
    console.log('  Dossier de la cliente ouvert depuis Supervisor (contexte de support) :');
    const s = await ouvrirSession('ref-amn@exemple.test');
    const cible = s.page.locator(`[aria-label="Organisations"] button[aria-label="${ref.name}"]`);
    verifier((await cible.count()) > 0, 'la référence est dans le rail');
    await cible.first().click();
    await attendre(6000);
    verifier(/session de support/i.test(await s.page.locator('body').innerText()), 'session de support ouverte');
    await verifierModules(s.page, s.erreurs);
    await s.contexte.close();
  }
} finally {
  await navigateur.close();
  servi.kill();
  serveur.closeAllConnections?.();
  await new Promise((r) => serveur.close(r));
  await db.close();
}

if (echecs.length) {
  console.error(`\n${echecs.length} défaut(s) : un module de base n'est plus visible ou n'affiche plus ses données.`);
  process.exit(1);
}
console.log(`\nModules de base : Clients, Agenda, Tâches, Facturation visibles et remplis dans chaque scénario${INTERNE ? ' (dossier client, édition interne)' : ''}.`);
