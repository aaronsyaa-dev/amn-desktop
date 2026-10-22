/**
 * INVENTAIRE DES ROUTES — lu dans l'application Express elle-même, pas dans la
 * documentation : une route oubliée du README est justement celle qu'on veut
 * voir. On monte l'app sur une base de simulation (sans l'écouter) et on
 * parcourt sa pile de routeurs.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { AMN_API_DIR } from './harness.mjs';

function prefixe(layer) {
  const src = layer.regexp?.source ?? '';
  if (!src || src === '^\\/?(?=\\/|$)') return '';
  return src
    .replace(/^\^/, '')
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, '')
    .replace(/\\\//g, '/')
    .replace(/\(\?:\(\[\^\\\/\]\+\?\)\)/g, ':param');
}

function parcourir(pile, base, sortie) {
  for (const layer of pile) {
    if (layer.route) {
      for (const methode of Object.keys(layer.route.methods)) {
        if (layer.route.methods[methode]) sortie.push({ methode: methode.toUpperCase(), chemin: base + (layer.route.path === '/' ? '' : layer.route.path) });
      }
    } else if (layer.name === 'router' && layer.handle?.stack) {
      parcourir(layer.handle.stack, base + prefixe(layer), sortie);
    }
  }
}

export async function inventaireRoutes(db) {
  const { createApp } = await import(pathToFileURL(path.join(AMN_API_DIR, 'src/server.js')).href);
  const app = await createApp({ db });
  const sortie = [];
  parcourir(app._router.stack, '', sortie);
  const vus = new Set();
  return sortie.filter((r) => typeof r.chemin === 'string' && !r.chemin.includes('*')).filter((r) => {
    const k = `${r.methode} ${r.chemin}`;
    if (vus.has(k)) return false;
    vus.add(k);
    return true;
  });
}
