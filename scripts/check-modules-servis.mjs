#!/usr/bin/env node
/**
 * APRÈS DÉPLOIEMENT — les modules de base sont-ils là pour une vraie session ?
 *
 * `check:modules-de-base` prouve le comportement AVANT de livrer, contre un
 * amn-api en mémoire. Celui-ci relit ce qui est SERVI : il ouvre l'adresse des
 * clientes avec le compte d'une organisation de référence (de test, jamais une
 * cliente), et vérifie que Clients, Agenda, Tâches et Facturation sont dans le
 * menu, s'ouvrent sans écran d'erreur, et montrent la fiche « Référence » que
 * l'organisation de référence contient.
 *
 * Ce que l'organisation de référence doit contenir (à créer une fois, à la
 * main, dans l'application) : un client, un rendez-vous, une tâche et une
 * facture dont le nom commence par « Référence ». Voir docs/MISE-EN-LIGNE.md.
 *
 * Usage :
 *   AMN_REF_EMAIL=… AMN_REF_MDP=… node scripts/check-modules-servis.mjs --url https://…
 * Sans identifiants, le contrôle passe son tour EN LE DISANT (code 0).
 */
import fs from 'node:fs';
import { chromium } from 'playwright-core';

const i = process.argv.indexOf('--url');
const URL_SERVIE = i > -1 ? process.argv[i + 1] : process.env.URL_CLIENTE;
const EMAIL = process.env.AMN_REF_EMAIL;
const MDP = process.env.AMN_REF_MDP;
if (!URL_SERVIE) {
  console.error('Usage : node scripts/check-modules-servis.mjs --url https://…');
  process.exit(2);
}
if (!EMAIL || !MDP) {
  console.log('::warning title=Modules de base non vérifiés::AMN_REF_EMAIL / AMN_REF_MDP absents — voir docs/MISE-EN-LIGNE.md.');
  process.exit(0);
}

const BASE = [
  { key: 'Clients', route: '/clients' },
  { key: 'Agenda', route: '/agenda' },
  { key: 'Tâches', route: '/tasks' },
  { key: 'Facturation', route: '/facturation' },
];
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
const chemin = process.env.AMN_CHROMIUM ?? '/opt/pw-browsers/chromium';
const navigateur = await chromium.launch(fs.existsSync(chemin) ? { executablePath: chemin } : {});
const echecs = [];
const verifier = (ok, message) => {
  console.log(`  ${ok ? '✓' : '✗'} ${message}`);
  if (!ok) echecs.push(message);
};

try {
  const page = await navigateur.newPage({ viewport: { width: 1360, height: 900 } });
  const erreurs = [];
  page.on('pageerror', (e) => erreurs.push(String(e).slice(0, 160)));
  const base = URL_SERVIE.replace(/\/?$/, '/');
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(MDP);
  await page.locator('button[type="submit"]').click();
  for (let n = 0; n < 40 && (await page.locator('input[name="password"]').count()); n++) await attendre(500);
  verifier(!(await page.locator('input[name="password"]').count()), 'connexion du compte de référence');
  await attendre(3000);
  for (let n = 0; n < 8; n++) {
    const d = page.locator('[role="dialog"][aria-modal="true"]').first();
    if (!(await d.count())) break;
    const b = d.locator('button').filter({ hasText: /Passer|Plus tard|Ignorer|Entrer|Commencer|Continuer|Fermer|Aller/ }).first();
    if (await b.count()) await b.click();
    else await d.locator('button').first().click();
    await attendre(400);
  }

  const menu = new Set();
  const lire = async () => {
    for (const h of await page.evaluate(() => [...document.querySelectorAll('aside a[href^="#/"], nav a[href^="#/"]')].map((a) => a.getAttribute('href').slice(1)))) menu.add(h);
  };
  await lire();
  const tuiles = page.locator('[data-rail-tuile]');
  for (let n = 0; n < (await tuiles.count()); n++) {
    await tuiles.nth(n).click({ timeout: 2000 }).catch(() => undefined);
    await attendre(150);
    await lire();
  }

  for (const m of BASE) {
    verifier(menu.has(m.route), `${m.key} : présent dans le menu`);
    await page.evaluate((r) => { window.location.hash = `#${r}`; }, m.route);
    let texte = '';
    for (let n = 0; n < 24; n++) {
      texte = await page.locator('body').innerText();
      if (/Référence/.test(texte) || /erreur inattendue/i.test(texte)) break;
      await attendre(500);
    }
    const ici = page.url().split('#')[1] ?? '';
    verifier(ici.startsWith(m.route) && !/erreur inattendue/i.test(texte), `${m.key} : s'ouvre`);
    verifier(/Référence/.test(texte), `${m.key} : affiche la fiche « Référence »`);
  }
  verifier(erreurs.length === 0, `aucune erreur de page${erreurs.length ? ` (${erreurs[0]})` : ''}`);
} finally {
  await navigateur.close();
}

if (echecs.length) {
  console.error(`\n${echecs.length} défaut(s) sur ${URL_SERVIE} : un module de base n'est plus visible ou n'affiche plus ses données.`);
  process.exit(1);
}
console.log(`\nModules de base servis sur ${URL_SERVIE} : visibles et remplis.`);
