#!/usr/bin/env node
/**
 * CONSTRUIT LES TROIS BUNDLES DE L'APPLICATION DE BUREAU — SANS FORGE
 * ══════════════════════════════════════════════════════════════════
 *
 * ## Pourquoi ce script existe
 *
 * Quatre versions publiées d'affilée ne démarraient pas une fois installées.
 * L'autopsie des artefacts publiés (v1.2.33 bonne / v1.2.35 et v1.2.38
 * cassées, comparées octet par octet) a montré que les fichiers du moteur
 * Electron étaient STRICTEMENT identiques à l'officiel dans les trois — la
 * défaillance ne venait pas du contenu, mais du mécanisme d'installation et de
 * lancement Squirrel.Windows lui-même. La publication passe donc à
 * electron-builder + NSIS, une chaîne sans `Update.exe` résident ni stub de
 * lancement.
 *
 * electron-builder ne pilote pas Vite (c'était le rôle du plugin Forge). Ce
 * script produit exactement la disposition que `src/main.ts` attend :
 *
 *     .vite/build/main.js                       ← processus principal (cjs)
 *     .vite/build/preload.js                    ← préchargement (cjs)
 *     .vite/renderer/main_window/index.html     ← écran, chargé en file://
 *
 * ## Les constantes que Forge injectait
 *
 * `src/main.ts` lit `MAIN_WINDOW_VITE_DEV_SERVER_URL` (adresse du serveur de
 * dev, absente en production) et `MAIN_WINDOW_VITE_NAME` (le nom du dossier du
 * renderer). Elles étaient définies par le plugin Vite de Forge ; ici on les
 * fixe à leurs valeurs de production. `npm start` reste sur Forge et continue
 * de les injecter en mode dev — les deux chemins produisent le même contrat.
 *
 * ## L'édition
 *
 * Même règle que partout (vite.edition.ts) : AMN_EDITION=business ou interne.
 * Les configs Vite existantes portent déjà toute la couture d'édition (alias
 * `@edition/*`, jeton opérateur jamais dans un build Business…) — ce script ne
 * fait que les invoquer, il ne décide de rien.
 */

import { build, mergeConfig, loadConfigFromFile } from 'vite';
import { rmSync } from 'node:fs';
import path from 'node:path';

const edition = process.env.AMN_EDITION === 'business' ? 'business' : 'internal';
// eslint-disable-next-line no-console
console.log(`[amn] build desktop — édition ${edition}`);

/** Charge une config Vite du dépôt telle que la CLI l'aurait chargée. */
async function charger(fichier) {
  const charge = await loadConfigFromFile(
    { command: 'build', mode: 'production' },
    path.resolve(fichier),
  );
  if (!charge) throw new Error(`config Vite illisible : ${fichier}`);
  return charge.config;
}

// Une seule sortie propre par build : un reste d'un build précédent dans
// `.vite/` finirait empaqueté tel quel.
rmSync('.vite', { recursive: true, force: true });

/* ------------------------------ Processus main ----------------------------- */

const mainBase = await charger('vite.main.config.ts');
await build(
  mergeConfig(mainBase, {
    configFile: false,
    mode: 'production',
    publicDir: false,
    define: {
      // En production il n'y a pas de serveur de dev : la constante doit
      // exister (main.ts la lit) et être fausse.
      MAIN_WINDOW_VITE_DEV_SERVER_URL: 'undefined',
      MAIN_WINDOW_VITE_NAME: JSON.stringify('main_window'),
    },
    build: {
      outDir: '.vite/build',
      emptyOutDir: false,
      // Même forme que le plugin Forge : une lib CommonJS, `main.js`.
      lib: { entry: 'src/main.ts', formats: ['cjs'], fileName: () => 'main.js' },
      target: 'node20',
      minify: false,
      sourcemap: false,
    },
    ssr: { noExternal: true },
  }),
);

/* ------------------------------- Préchargement ----------------------------- */

const preloadBase = await charger('vite.preload.config.ts');
await build(
  mergeConfig(preloadBase, {
    configFile: false,
    mode: 'production',
    publicDir: false,
    build: {
      outDir: '.vite/build',
      emptyOutDir: false,
      lib: { entry: 'src/preload.ts', formats: ['cjs'], fileName: () => 'preload.js' },
      target: 'node20',
      minify: false,
      sourcemap: false,
      rollupOptions: { external: ['electron'] },
    },
  }),
);

/* --------------------------------- Renderer -------------------------------- */

const rendererBase = await charger('vite.renderer.config.mts');
await build(
  mergeConfig(rendererBase, {
    configFile: false,
    mode: 'production',
    // `./` et non `/` : la page est servie en file:// dans l'application
    // installée, un chemin absolu viserait la racine du disque.
    base: './',
    build: {
      outDir: '.vite/renderer/main_window',
      emptyOutDir: true,
    },
  }),
);

// eslint-disable-next-line no-console
console.log('[amn] build desktop terminé — .vite/build + .vite/renderer/main_window');
