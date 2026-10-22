/**
 * L'APERÇU AUTONOME D'UN MODULE D'ATELIER — `node src/ateliers/apercu.mjs <id> [<id>…]`.
 *
 * Construit `docs/atelier/apercus/<id>.html` à partir du VRAI écran du module
 * (pas d'une maquette refaite à la main, qui dériverait) :
 *
 *   · le JavaScript : esbuild empaquette React, le socle et l'écran en un seul
 *     script en ligne ;
 *   · le CSS : Tailwind (le même moteur que l'application) ne produit que les
 *     classes trouvées dans le module, `_commun` et `src/socle/ui`, sur les
 *     jetons du socle relus dans `src/index.css` ;
 *   · le fond NOIR ET GRIS de la direction validée, posé par-dessus les jetons
 *     graphite du socle (pas encore activés dans l'application, voir STATUT.md) ;
 *   · Inter, embarquée en base64 depuis `@fontsource/inter`.
 *
 * Aucune ressource n'est chargée du réseau : le fichier s'ouvre seul, hors ligne.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { compile } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const dossierAteliers = path.join(racine, 'src/ateliers');
const sortie = path.join(racine, 'docs/atelier/apercus');

/** Le bloc du socle de `src/index.css` : jetons, thème clair, variables de famille. */
function jetonsDuSocle() {
  const css = fs.readFileSync(path.join(racine, 'src/index.css'), 'utf8');
  const debut = css.lastIndexOf('/*', css.indexOf('LE SOCLE DE LA REFONTE (S0)'));
  const fin = css.indexOf('\n', css.indexOf("[data-famille='outils'] { --fam:"));
  if (debut < 0 || fin < 0) throw new Error('bloc du socle introuvable dans src/index.css');
  return css.slice(debut, fin);
}

/** Noir et gris : la direction validée par Harun (2026-10-22), par-dessus le graphite. */
const NOIR_ET_GRIS = `
:root {
  --color-socle-fond: #0b0b0b; --color-socle-creux: #080808; --color-socle-surface: #131313;
  --color-socle-eleve: #1a1a1a; --color-socle-survol: #212121; --color-socle-bord: #2a2a2a;
  --color-socle-bord-fort: #6e6e6e; --color-socle-texte: #f2f2f2; --color-socle-texte-doux: #c9c9c9;
  --color-socle-texte-discret: #a0a0a0; --color-socle-focus: #f2f2f2;
  --color-socle-primaire: #ffffff; --color-socle-primaire-survol: #e9e9e9; --color-socle-primaire-encre: #0b0b0b;
}`;

function inter() {
  return [400, 500, 600]
    .map((poids) => {
      const f = path.join(racine, `node_modules/@fontsource/inter/files/inter-latin-${poids}-normal.woff2`);
      const b64 = fs.readFileSync(f).toString('base64');
      return `@font-face{font-family:'Inter';font-style:normal;font-weight:${poids};font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
    })
    .join('\n');
}

async function css(id) {
  const entree = `@import 'tailwindcss';\n${jetonsDuSocle()}\n`;
  const compilateur = await compile(entree, { base: racine, onDependency: () => {} });
  const scanner = new Scanner({
    sources: [path.join(dossierAteliers, id), path.join(dossierAteliers, '_commun'), path.join(racine, 'src/socle/ui')].map((base) => ({ base, pattern: '**/*', negated: false })),
  });
  const candidats = new Set(scanner.scan());
  return compilateur.build([...candidats]);
}

/**
 * Les dictionnaires communs (`src/i18n/fr.ts`, `en.ts` : 400 Ko) n'ont rien à
 * faire dans un aperçu : l'atelier n'en lit que la langue active. Ce relais
 * tient le même contrat (`useLangue`, `changerLangue`, `langueActive`).
 */
const RELAIS_LANGUE = `
import { useEffect, useState } from 'react';
let langue = 'fr';
const abonnes = new Set();
export function langueActive() { return langue; }
export function changerLangue(l) { langue = l || 'fr'; for (const a of abonnes) a(); }
export function useLangue() {
  const [, forcer] = useState(0);
  useEffect(() => { const a = () => forcer((n) => n + 1); abonnes.add(a); return () => { abonnes.delete(a); }; }, []);
  return { langue, t: (cle) => cle };
}`;
const i18nCommun = path.join(racine, 'src/i18n');
const relais = {
  name: 'relais-langue',
  setup(b) {
    b.onResolve({ filter: /(^|\/)i18n$/ }, (a) => (path.resolve(a.resolveDir, a.path) === i18nCommun ? { path: 'relais-langue', namespace: 'relais' } : undefined));
    b.onLoad({ filter: /.*/, namespace: 'relais' }, () => ({ contents: RELAIS_LANGUE, loader: 'js', resolveDir: racine }));
  },
};

async function js(id) {
  const code = [
    "import { createElement as h, useState } from 'react';",
    "import { createRoot } from 'react-dom/client';",
    "import { changerLangue } from '../i18n';",
    `import Ecran from './${id}/Ecran';`,
    'function Apercu() {',
    "  const [l, setL] = useState('fr');",
    '  const choisir = (x) => { changerLangue(x); setL(x); };',
    "  const lien = (x) => h('button', { type: 'button', onClick: () => choisir(x), 'aria-pressed': l === x, className: 'apercu-langue' }, x.toUpperCase());",
    "  return h('div', null, h('nav', { className: 'apercu-barre', 'aria-label': 'Langue' }, lien('fr'), lien('en')), h(Ecran));",
    '}',
    "changerLangue('fr');",
    "createRoot(document.getElementById('racine')).render(h(Apercu));",
  ].join('\n');
  const r = await esbuild.build({
    stdin: { contents: code, resolveDir: dossierAteliers, loader: 'tsx' },
    bundle: true,
    write: false,
    minify: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    charset: 'utf8',
    jsx: 'automatic',
    loader: { '.css': 'empty', '.woff': 'empty', '.woff2': 'empty' },
    plugins: [relais],
    tsconfig: path.join(racine, 'tsconfig.json'),
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', __AMN_EDITION__: '"internal"', __AMN_VERSION__: '"0.0.0"' },
    logLevel: 'silent',
  });
  return r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
}

const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error('usage : node src/ateliers/apercu.mjs <id> [<id>…]');
  process.exit(2);
}
fs.mkdirSync(sortie, { recursive: true });
for (const id of ids) {
  const MODULE_NOM = /nom:\s*'([^']+)'/.exec(fs.readFileSync(path.join(dossierAteliers, id, 'module.ts'), 'utf8'))?.[1] ?? id;
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Atelier · ${MODULE_NOM}</title>
<!-- Généré par « node src/ateliers/apercu.mjs ${id} » depuis le vrai écran du module. Ne pas modifier à la main. -->
<style>
${inter()}
${await css(id)}
${NOIR_ET_GRIS}
html, body { margin: 0; background: var(--color-socle-fond); color: var(--color-socle-texte); }
body, [data-atelier] { font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif; }
.apercu-barre { display: flex; justify-content: flex-end; gap: 4px; padding: 12px 24px 0; max-width: 64rem; margin: 0 auto; }
.apercu-langue { font: 500 12px 'Inter', system-ui, sans-serif; color: var(--color-socle-texte-discret); background: transparent; border: 1px solid var(--color-socle-bord); border-radius: 6px; padding: 4px 8px; cursor: pointer; }
.apercu-langue[aria-pressed='true'] { color: var(--color-socle-texte); border-color: var(--color-socle-bord-fort); }
</style>
</head>
<body>
<div id="racine"></div>
<script>${await js(id)}</script>
</body>
</html>
`;
  fs.writeFileSync(path.join(sortie, `${id}.html`), html);
  console.log(`docs/atelier/apercus/${id}.html — ${Math.round(html.length / 1024)} Ko`);
}
