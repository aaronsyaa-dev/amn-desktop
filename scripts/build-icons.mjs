#!/usr/bin/env node
/**
 * Fabrique les icônes de l'application à partir de `images/icon.svg`.
 *
 * ## Pourquoi un script, et pas des fichiers déposés à la main
 *
 * Il y a cinq tailles à tenir en accord — l'icône de fenêtre, celle du plateau
 * système, celle de l'installeur Windows, celle du raccourci, celle de la PWA
 * sur un téléphone. Déposées une par une, elles divergent au premier retouche :
 * on remplace le PNG, on oublie le `.ico`, et l'application porte deux logos
 * selon l'endroit où on la regarde. Ici, la SOURCE est le SVG ; tout le reste
 * en découle.
 *
 * ## Ce qu'il produit
 *
 *   images/icon.png    1024×1024   fenêtre, plateau, paquets Linux
 *   images/icon.ico    7 tailles   installeur et raccourcis Windows
 *   public/icon.png    1024×1024   PWA — l'icône sur l'écran d'accueil du téléphone
 *
 * ## Le moteur de rendu
 *
 * Chromium, par `playwright-core`. Ce dépôt n'a ni ImageMagick ni rsvg ; et
 * Chromium a l'avantage de rasteriser le SVG exactement comme le fera
 * l'application, qui est elle-même un Chromium. Si le module manque, le script
 * le dit et s'arrête — il ne fabrique pas une icône approximative en silence.
 *
 *   npm run icons
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'images', 'icon.svg');
const SOURCE_PETITE = path.join(ROOT, 'images', 'icon-small.svg');

/** Les tailles que Windows attend dans un `.ico`, de la barre des tâches au bureau. */
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

/**
 * En dessous de ce seuil, on rend la variante « A » plutôt que la marque
 * complète.
 *
 * Ce n'est pas une préférence : à 32 px, « AMN » au trait devient une tache
 * grise — trois lettres d'un pixel dans un carré de 32, le trait tombe au
 * tiers de pixel et le fond noir avale le reste. Mesuré en agrandissant le
 * rendu réel. Une composition par ordre de grandeur est ce que fait n'importe
 * quelle identité dessinée au trait.
 */
const SEUIL_PETITE = 64;

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  console.error(
    'playwright-core est absent — c’est lui qui rasterise le SVG.\n' +
      '  npm i -D playwright-core\n' +
      'Puis relancez `npm run icons`. Rien n’a été modifié.',
  );
  process.exit(1);
}

if (!fs.existsSync(SOURCE)) {
  console.error(`Source introuvable : ${SOURCE}`);
  process.exit(1);
}

/**
 * L'exécutable Chromium.
 *
 * `PLAYWRIGHT_BROWSERS_PATH` est posé sur les machines où les navigateurs sont
 * rangés hors du dossier par défaut ; sinon on laisse Playwright chercher.
 */
function executablePath() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base || !fs.existsSync(base)) return undefined;
  const dossier = fs
    .readdirSync(base)
    .filter((n) => n.startsWith('chromium-'))
    .sort()
    .pop();
  if (!dossier) return undefined;
  const exe = path.join(base, dossier, 'chrome-linux', 'chrome');
  return fs.existsSync(exe) ? exe : undefined;
}

const svg = fs.readFileSync(SOURCE, 'utf8');
const svgPetite = fs.existsSync(SOURCE_PETITE) ? fs.readFileSync(SOURCE_PETITE, 'utf8') : svg;
const browser = await chromium.launch({ executablePath: executablePath(), args: ['--no-sandbox'] });

async function rasterise(taille) {
  const source = taille <= SEUIL_PETITE ? svgPetite : svg;
  const page = await browser.newPage({
    viewport: { width: taille, height: taille },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<html><body style="margin:0;padding:0">` +
      `<div style="width:${taille}px;height:${taille}px">` +
      source.replace('<svg', `<svg width="${taille}" height="${taille}"`) +
      `</div></body></html>`,
    { waitUntil: 'load' },
  );
  // Le SVG est statique, mais la première peinture n'est pas garantie à la
  // milliseconde où `load` se déclenche.
  await page.waitForTimeout(200);
  const octets = await page.screenshot({ type: 'png' });
  await page.close();
  return octets;
}

/**
 * Assemble des PNG en un `.ico`.
 *
 * Le format est un simple conteneur : un en-tête, une entrée de 16 octets par
 * image, puis les images bout à bout. Une largeur de 256 s'écrit `0` — l'octet
 * ne va pas plus haut, et c'est la convention du format.
 */
function assembleIco(images) {
  const ENTETE = 6;
  const ENTREE = 16;
  const debut = ENTETE + ENTREE * images.length;

  const entete = Buffer.alloc(ENTETE);
  entete.writeUInt16LE(0, 0); // réservé
  entete.writeUInt16LE(1, 2); // type : icône
  entete.writeUInt16LE(images.length, 4);

  const entrees = [];
  let decalage = debut;
  for (const { taille, octets } of images) {
    const e = Buffer.alloc(ENTREE);
    e.writeUInt8(taille >= 256 ? 0 : taille, 0);
    e.writeUInt8(taille >= 256 ? 0 : taille, 1);
    e.writeUInt8(0, 2); // palette : aucune
    e.writeUInt8(0, 3); // réservé
    e.writeUInt16LE(1, 4); // plans
    e.writeUInt16LE(32, 6); // bits par pixel
    e.writeUInt32LE(octets.length, 8);
    e.writeUInt32LE(decalage, 12);
    entrees.push(e);
    decalage += octets.length;
  }

  return Buffer.concat([entete, ...entrees, ...images.map((i) => i.octets)]);
}

const grand = await rasterise(1024);
fs.writeFileSync(path.join(ROOT, 'images', 'icon.png'), grand);
fs.writeFileSync(path.join(ROOT, 'public', 'icon.png'), grand);
console.log('images/icon.png  1024x1024');
console.log('public/icon.png  1024x1024  (PWA — écran d’accueil du téléphone)');

const petites = [];
for (const taille of ICO_SIZES) {
  petites.push({ taille, octets: await rasterise(taille) });
}
fs.writeFileSync(path.join(ROOT, 'images', 'icon.ico'), assembleIco(petites));
const petitesTailles = ICO_SIZES.filter((t) => t <= SEUIL_PETITE);
console.log(
  `images/icon.ico  ${ICO_SIZES.join(', ')}  ` +
    `(variante « A » jusqu'à ${SEUIL_PETITE} px : ${petitesTailles.join(', ')})`,
);

await browser.close();
console.log('\nIcônes régénérées depuis images/icon.svg.');
