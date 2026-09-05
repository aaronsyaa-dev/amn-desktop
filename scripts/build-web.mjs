#!/usr/bin/env node
/**
 * Build web/PWA — le seul point d'entrée, pour les deux éditions.
 *
 * Pourquoi passer par un script plutôt que d'appeler `vite build` directement :
 *
 * Le build Business a été livré une fois à une cliente avec le rail interne
 * complet dedans (Scanner, Comply, SSL Monitor, Trackers, une adresse
 * @amn-devsec.com en clair). `check:business` existait pourtant déjà — mais il
 * n'avait jamais tourné, parce que le build ne se faisait plus en local : il se
 * faisait chez Vercel, où personne ne lance de commande à la main.
 *
 * La leçon est que le contrôle ne doit pas être une commande séparée qu'on
 * pense à lancer. Il fait partie du build : toute sortie Business est relue
 * immédiatement après avoir été écrite, et un résidu fait échouer le build
 * lui-même — en local comme chez Vercel, sans que personne n'ait à y penser.
 *
 * L'édition vient de AMN_EDITION (voir vite.edition.ts) : absente = interne.
 */

import { spawnSync } from 'node:child_process';

/**
 * Même règle que `resolveEdition()` dans vite.edition.ts — recopiée ici parce
 * qu'un script .mjs ne peut pas importer un module TypeScript au runtime.
 * Elle tient en une ligne et n'a qu'une seule valeur particulière : tout ce qui
 * n'est pas exactement « business » est interne.
 */
const edition = process.env.AMN_EDITION === 'business' ? 'business' : 'internal';
// `AMN_WEB_OUT` : construire ailleurs que dans dist/ (check:migration bâtit le candidat dans un dossier temporaire).
const outDir = process.env.AMN_WEB_OUT || 'dist';

// eslint-disable-next-line no-console
console.log(`[amn] build web — édition ${edition}`);

const build = spawnSync(
  process.execPath,
  ['node_modules/vite/bin/vite.js', 'build', '--config', 'vite.renderer.config.mts', ...(process.env.AMN_WEB_OUT ? ['--outDir', outDir, '--emptyOutDir'] : [])],
  { stdio: 'inherit', env: { ...process.env, AMN_EDITION: edition } },
);
if (build.status !== 0) process.exit(build.status ?? 1);

if (edition !== 'business') process.exit(0);

// eslint-disable-next-line no-console
console.log('\n[amn] édition Business — contrôle du bundle livré');
const check = spawnSync(
  process.execPath,
  ['scripts/check-business-bundle.mjs', '--dir', outDir],
  { stdio: 'inherit' },
);
if (check.status !== 0) {
  // eslint-disable-next-line no-console
  console.error(
    '\n[amn] BUILD REFUSÉ — le bundle Business contient des traces internes (voir ci-dessus).',
  );
  process.exit(check.status ?? 1);
}
