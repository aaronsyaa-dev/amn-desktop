/**
 * La boucle visuelle du chantier de design.
 *
 * Sert un bundle déjà construit, se connecte avec le compte d'essai FICTIF
 * (`@exemple.test`, base sqlite du bac à sable — jamais une donnée réelle),
 * et capture une liste d'écrans à la largeur des maquettes (1180 px).
 *
 *   node captures.mjs <dossier-du-bundle> <dossier-de-sortie> <port> [routes...]
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [, , bundle, sortie, portArg, ...routesArg] = process.argv;
const PORT = Number(portArg ?? 4190);
const APP = `http://127.0.0.1:${PORT}/`;
const EMAIL = process.env.AMN_E2E_EMAIL ?? 'design@exemple.test';
const MOT_DE_PASSE = process.env.AMN_E2E_PASSWORD ?? '';

/* Les maquettes sont toutes dessinées à 1180 px : on mesure à la même largeur,
   sinon « avant » et « après » ne sont pas comparables. */
const LARGEUR = 1180;
const HAUTEUR = 1000;

const ROUTES = routesArg.length
  ? routesArg.map((r) => {
      const [nom, route] = r.split('=');
      return { nom, route };
    })
  : [
      { nom: 'accueil', route: '' },
      { nom: 'clients', route: '#/clients' },
      { nom: 'facturation', route: '#/facturation' },
      { nom: 'taches', route: '#/tasks' },
    ];

fs.mkdirSync(sortie, { recursive: true });

const serveur = spawn('node', [new URL('./servir-bundle.mjs', import.meta.url).pathname, bundle, String(PORT)], {
  stdio: 'ignore',
  detached: false,
});
await new Promise((r) => setTimeout(r, 3500));

const navigateur = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await navigateur.newPage({ viewport: { width: LARGEUR, height: HAUTEUR } });

try {
  await page.goto(APP, { waitUntil: 'networkidle' });
  // La connexion : le formulaire est le même dans les deux bundles.
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[name="password"]').fill(MOT_DE_PASSE);
  await page.locator('button[type="submit"]').click();
  for (let i = 0; i < 20 && (await page.content()).includes('name="password"'); i += 1) {
    await page.waitForTimeout(500);
  }
  if ((await page.content()).includes('name="password"')) {
    throw new Error('connexion refusée — le bac à sable ne répond pas');
  }
  await page.waitForTimeout(1500);

  for (const { nom, route } of ROUTES) {
    await page.goto(APP + route, { waitUntil: 'networkidle' }).catch(() => undefined);
    await page.waitForTimeout(1600);
    const fichier = path.join(sortie, `${nom}.png`);
    await page.screenshot({ path: fichier });
    console.log(`  ✓ ${nom} → ${fichier}`);
  }
} finally {
  await navigateur.close();
  serveur.kill('SIGTERM');
}
