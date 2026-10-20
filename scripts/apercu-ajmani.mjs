/**
 * LA PAGE D'APERÇU D'AJMANI — un fichier HTML autonome, ouvrable d'un double clic.
 *
 * Compile `src/refonte/accueil/apercu/Apercu.tsx` (le vrai composant Ajmani,
 * React et framer-motion compris) en un seul script, et l'inscrit dans
 * `docs/refonte/apercu-ajmani.html`. Aucun réseau à l'ouverture, aucun
 * serveur : ce n'est pas un build de l'app.
 *
 *   npm run apercu:ajmani
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sortie = path.join(racine, 'docs/refonte/apercu-ajmani.html');

const construit = await esbuild.build({
  entryPoints: [path.join(racine, 'src/refonte/accueil/apercu/Apercu.tsx')],
  bundle: true,
  write: false,
  minify: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  charset: 'utf8',
  jsx: 'automatic',
  tsconfig: path.join(racine, 'tsconfig.json'),
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', __AMN_EDITION__: '"internal"', __AMN_VERSION__: '"0.0.0"' },
  logLevel: 'warning',
});

// `</script>` dans le code fermerait la balise : on le neutralise.
const script = construit.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ajmani — aperçu</title>
<style>
  :root { color-scheme: dark; --color-signal: #d09a4a; }
  html, body { margin: 0; background: #161513; }
  button:focus-visible { outline: 2px solid #F2EFE9; outline-offset: 2px; }
</style>
</head>
<body>
<div id="racine"></div>
<script>${script}</script>
</body>
</html>
`;
fs.mkdirSync(path.dirname(sortie), { recursive: true });
fs.writeFileSync(sortie, html);
console.log(`✓ aperçu écrit : ${path.relative(racine, sortie)} (${Math.round(html.length / 1024)} Ko)`);
