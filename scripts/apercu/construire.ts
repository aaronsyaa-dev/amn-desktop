/**
 * APERÇU STATIQUE D'UN ÉCRAN — pour la capture 1440 × 900 et la comparaison à son image.
 *
 * Construit `scripts/apercu/ecrans/<ID>.tsx` (qui exporte par défaut l'élément à montrer, sur des
 * données FICTIVES de bac à sable) en une page HTML autonome : un fichier ouvert en file://, sans
 * serveur, sans réseau, sans lancer l'application. Le CSS est celui de l'édition interne : Tailwind
 * compilé depuis `src/index.css`, plus les feuilles du socle importées par les composants.
 *
 *   npm run apercu -- H40            → /tmp/apercu/H40/index.html
 *   npm run apercu -- H40 --sortie <dossier>
 *
 * Puis : `node scripts/qualite/fidelite/capturer.mjs --page /tmp/apercu/H40/index.html …` (outil de T1,
 * `docs/refonte/CONTROLE-FIDELITE.md`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
// Livrés avec @tailwindcss/vite (même version) : le compilateur que Vite utilise pour l'app.
// eslint-disable-next-line import/no-unresolved
import { compile } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
if (!id) {
  console.error('usage : npm run apercu -- <ID> [--sortie <dossier>]');
  process.exit(2);
}
const iSortie = args.indexOf('--sortie');
const sortie = path.resolve(iSortie >= 0 ? args[iSortie + 1] : path.join('/tmp/apercu', id));
const entree = path.join(racine, 'scripts/apercu/ecrans', `${id}.tsx`);
if (!fs.existsSync(entree)) {
  console.error(`aucun aperçu : ${path.relative(racine, entree)}`);
  process.exit(2);
}
fs.rmSync(sortie, { recursive: true, force: true });
fs.mkdirSync(sortie, { recursive: true });

/** `import.meta.glob('<motif>', { eager: true })` (Vite) → imports statiques, pour esbuild. */
const globVite: esbuild.Plugin = {
  name: 'glob-vite',
  setup(b) {
    b.onLoad({ filter: /src[\\/].*\.tsx?$/ }, (a) => {
      const src = fs.readFileSync(a.path, 'utf8');
      if (!src.includes('import.meta.glob')) return undefined;
      let n = 0;
      const tetes: string[] = [];
      const code = src.replace(/import\.meta\.glob(?:<[^>]*>)?\(\s*'([^']+)'\s*,\s*\{\s*eager:\s*true\s*\}\s*\)/g, (_m, motif: string) => {
        const dossier = path.resolve(path.dirname(a.path), path.dirname(motif));
        const ext = path.extname(motif);
        const fichiers = fs.readdirSync(dossier).filter((f) => f.endsWith(ext)).sort();
        const paires = fichiers.map((f) => {
          const nom = `__glob${n++}`;
          tetes.push(`import * as ${nom} from ${JSON.stringify(path.join(dossier, f))};`);
          return `${JSON.stringify(`./${path.relative(path.dirname(a.path), path.join(dossier, f)).replace(/\\/g, '/')}`)}: ${nom}`;
        });
        return `({ ${paires.join(', ')} })`;
      });
      return { contents: `${tetes.join('\n')}\n${code}`, loader: a.path.endsWith('x') ? 'tsx' : 'ts' };
    });
  },
};

const montage = `
import { createElement as h, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Ecran from ${JSON.stringify(entree)};
document.documentElement.dataset.ambiance = 'noir';
document.documentElement.lang = 'fr';
createRoot(document.getElementById('racine')).render(h(StrictMode, null, h(Ecran)));
`;

await esbuild.build({
  stdin: { contents: montage, resolveDir: path.join(racine, 'scripts/apercu'), loader: 'tsx' },
  bundle: true,
  outdir: sortie,
  entryNames: 'ecran',
  assetNames: 'fichiers/[name]-[hash]',
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  charset: 'utf8',
  jsx: 'automatic',
  tsconfig: path.join(racine, 'tsconfig.json'),
  loader: { '.woff2': 'file', '.woff': 'file', '.png': 'file', '.svg': 'file', '.jpg': 'file' },
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true', 'import.meta.env.MODE': '"production"', 'import.meta.env': '{"DEV":false,"PROD":true,"MODE":"production"}', __AMN_EDITION__: '"internal"', __AMN_VERSION__: '"0.0.0"' },
  plugins: [globVite],
  logLevel: 'error',
});

// Tailwind 4 : les classes réellement écrites dans src/, compilées depuis la feuille de l'app.
const feuille = path.join(racine, 'src/index.css');
const compilateur = await compile(fs.readFileSync(feuille, 'utf8'), { base: path.dirname(feuille), onDependency: () => undefined });
const scanner = new Scanner({ sources: [{ base: path.join(racine, 'src'), pattern: '**/*', negated: false }] });
const tailwind = compilateur.build(scanner.scan());
// Les polices et images de la feuille compilée : esbuild les recopie à côté.
const tmp = path.join(racine, 'src', `.apercu-${process.pid}.css`);
fs.writeFileSync(tmp, tailwind);
try {
  await esbuild.build({ entryPoints: [tmp], bundle: true, outfile: path.join(sortie, 'base.css'), assetNames: 'fichiers/[name]-[hash]', loader: { '.woff2': 'file', '.woff': 'file', '.png': 'file', '.svg': 'file' }, external: ['/*'], logLevel: 'error' });
} finally {
  fs.rmSync(tmp, { force: true });
}

const css = fs.existsSync(path.join(sortie, 'ecran.css')) ? '<link rel="stylesheet" href="ecran.css">' : '';
fs.writeFileSync(
  path.join(sortie, 'index.html'),
  `<!doctype html><html lang="fr" class="dark" data-ambiance="noir"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aperçu ${id}</title><link rel="stylesheet" href="base.css">${css}</head><body><div id="racine"></div><script src="ecran.js"></script></body></html>`,
);
console.log(path.join(sortie, 'index.html'));
