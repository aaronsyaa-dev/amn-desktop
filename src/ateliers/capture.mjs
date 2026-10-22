/**
 * LA PHOTO D'UN APERÇU — `node src/ateliers/capture.mjs <id> <sortie.png> [largeur]`.
 *
 * Ouvre `docs/atelier/apercus/<id>.html` dans le Chromium local (fichier
 * statique : ni application lancée, ni serveur), photographie la page entière
 * et signale toute erreur de script ou toute requête qui sortirait du fichier.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const [, , id, png, largeur = '1280'] = process.argv;
if (!id || !png) {
  console.error('usage : node src/ateliers/capture.mjs <id> <sortie.png> [largeur]');
  process.exit(2);
}
const navigateur = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await navigateur.newPage({ viewport: { width: Number(largeur), height: 900 } });
const fautes = [];
page.on('pageerror', (e) => fautes.push(`script : ${e.message}`));
page.on('console', (m) => m.type() === 'error' && fautes.push(`console : ${m.text()}`));
page.on('request', (r) => !/^(file|data):/.test(r.url()) && fautes.push(`réseau : ${r.url()}`));
await page.goto(`file://${path.join(racine, 'docs/atelier/apercus', `${id}.html`)}`);
await page.waitForTimeout(400);
await page.screenshot({ path: png, fullPage: true });
await navigateur.close();
console.log(fautes.length ? fautes.join('\n') : `${png} — aucune erreur, aucune requête réseau`);
process.exit(fautes.length ? 1 : 0);
