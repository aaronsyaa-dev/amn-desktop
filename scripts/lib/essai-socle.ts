/**
 * Outils communs aux contrôles du socle (`check-socle*.ts`, `check-systeme-*.ts`) : sans navigateur,
 * sans build, sans réseau. Charge un module des sources avec esbuild, rend des composants en HTML
 * statique, déroule des propriétés une à une.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

export const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export { assert };

export const lire = (rel: string): string => fs.readFileSync(path.join(racine, rel), 'utf8');
export const sansCommentaires = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Charge un module des sources (`'src/…'`) ou un bout de code (`{ code }`, qui peut importer `../src/…`). */
export async function charger<T>(entree: string | { code: string }): Promise<T> {
  const construit = await esbuild.build({
    ...(typeof entree === 'string'
      ? { entryPoints: [path.join(racine, entree)] }
      : { stdin: { contents: entree.code, resolveDir: path.join(racine, 'scripts'), loader: 'tsx' as const } }),
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    charset: 'utf8',
    jsx: 'automatic',
    tsconfig: path.join(racine, 'tsconfig.json'),
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', __AMN_EDITION__: '"internal"', __AMN_VERSION__: '"0.0.0"' },
    logLevel: 'silent',
  });
  return (await import(
    `data:text/javascript;charset=utf-8;base64,${Buffer.from(construit.outputFiles[0].text, 'utf8').toString('base64')}`
  )) as T;
}

/** Les outils de rendu : `h` (createElement), `rendre` (HTML statique, dans un MemoryRouter), plus les exports demandés. */
export async function chargerRendu<T extends Record<string, unknown>>(imports: string, exports: string[]): Promise<{
  h: (type: unknown, props?: Record<string, unknown> | null, ...enfants: unknown[]) => unknown;
  rendre: (el: unknown) => string;
} & T> {
  const code = [
    "import { createElement as h } from 'react';",
    "import { renderToStaticMarkup } from 'react-dom/server.browser';",
    "import { MemoryRouter } from 'react-router-dom';",
    imports,
    'export const rendre = (el) => renderToStaticMarkup(h(MemoryRouter, null, el));',
    `export { h, ${exports.join(', ')} };`,
  ].join('\n');
  return charger(({ code }));
}

export const attr = (html: string, nom: string): string | undefined => new RegExp(`${nom}="([^"]*)"`).exec(html)?.[1];

/** Un déroulé de propriétés : chaque `dit` affiche ✓ ou ✗ ; `fin()` sort en erreur s'il y en a une. */
export function creerEssais(titre: string) {
  let echecs = 0;
  let vus = 0;
  console.log(`${titre}\n`);
  return {
    async dit(nom: string, fn: () => void | Promise<void>) {
      try {
        await fn();
        vus += 1;
        console.log(`  ✓ ${nom}`);
      } catch (err) {
        echecs += 1;
        console.error(`  ✗ ${nom}\n      ${(err as Error).message.split('\n').join('\n      ')}`);
      }
    },
    fin() {
      console.log('');
      if (echecs > 0) {
        console.error(`ÉCHEC — ${echecs} propriété(s) ne tiennent pas.`);
        process.exit(1);
      }
      console.log(`OK — ${vus} propriétés tiennent.`);
      // framer-motion garde une boucle d'images armée : on sort explicitement.
      process.exit(0);
    },
  };
}

/** Rapport de contraste WCAG entre deux `#rrggbb`. */
export function rapportContraste(a: string, b: string): number {
  const rvb = (h: string) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
  const canal = (c: number) => ((c / 255) <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4);
  const lum = (h: string) => { const [r, g, b] = rvb(h); return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b); };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Les valeurs `--nom: #rrggbb;` d'une feuille, par nom. */
export function jetons(css: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const [, nom, v] of sansCommentaires(css).matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) m.set(nom, v.toLowerCase());
  return m;
}
