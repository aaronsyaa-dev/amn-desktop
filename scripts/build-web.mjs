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
 * L'ÉDITION — et pourquoi son ABSENCE est refusée chez un hébergeur.
 * ═════════════════════════════════════════════════════════════════
 *
 * La règle historique tenait en une ligne : « tout ce qui n'est pas exactement
 * `business` est interne ». Elle est juste sur un poste — un build lancé par
 * réflexe ne fabrique jamais par accident une app amputée — et elle est
 * DANGEREUSE chez un hébergeur, pour une raison qui n'a rien de théorique :
 *
 *   · `vercel.json` est lu par les DEUX projets. L'édition ne se choisit donc
 *     que par une variable d'environnement de projet ;
 *   · si cette variable disparaît, est mal orthographiée, ou n'est pas cochée
 *     pour l'environnement qui construit, le défaut s'applique en silence ;
 *   · le défaut est l'édition INTERNE ;
 *   · et `check:business` ne tourne QUE sur une sortie Business. En retombant
 *     sur l'interne, le build perd le bundle attendu ET le contrôle qui
 *     l'aurait dit. Les deux filets lâchent du même geste.
 *
 * Autrement dit : la seule panne qui livre le mauvais bundle est aussi celle
 * qui éteint l'alarme. C'est ce cumul qu'on refuse ici.
 *
 * Chez un hébergeur, l'édition doit donc être ÉCRITE. Pas devinée :
 *
 *   · `business` ou `internal` → on construit ce qui est demandé ;
 *   · vide, ou autre chose  → le build ÉCHOUE, bruyamment.
 *
 * Un build rouge chez Vercel se voit et ne sert rien. Un build vert qui sert
 * le mauvais bundle ne se voit pas, et sert tout. Entre les deux, le choix
 * n'est pas difficile.
 *
 * Une valeur inconnue (`Business` avec une capitale, `bussiness`) est refusée
 * PARTOUT, hébergeur ou non : personne n'écrit une variable d'édition pour
 * obtenir l'édition par défaut, donc une valeur que nous ne comprenons pas est
 * toujours l'expression d'une intention que nous sommes en train de trahir.
 */
const EDITIONS = ['internal', 'business'];

/** Vercel pose `VERCEL=1` sur tous ses builds ; `VERCEL_ENV` vaut production/preview/development. */
const chezUnHebergeur = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

function refuser(pourquoi) {
  // eslint-disable-next-line no-console
  console.error(
    `\n[amn] BUILD REFUSÉ — ${pourquoi}\n\n` +
      `  L'édition à construire doit être écrite explicitement, parce que\n` +
      `  \`vercel.json\` est partagé par les deux projets et ne peut pas la porter.\n\n` +
      `  Dans les variables d'environnement DU PROJET (Production ET Preview) :\n\n` +
      `    AMN_EDITION=business   → AMN Desktop, l'édition livrée aux organisations clientes\n` +
      `    AMN_EDITION=internal   → AMN Business, l'édition d'AMN DevSec\n\n` +
      `  Sans cette variable, le défaut serait l'édition INTERNE — et \`check:business\`,\n` +
      `  qui ne relit qu'une sortie Business, ne tournerait pas pour le dire.\n` +
      `  Voir docs/BUSINESS.md, « Sur Vercel ».\n`,
  );
  process.exit(1);
}

const declaree = (process.env.AMN_EDITION ?? '').trim();

if (declaree !== '' && !EDITIONS.includes(declaree)) {
  refuser(`AMN_EDITION vaut « ${declaree} », qui n'est ni « business » ni « internal ».`);
}
if (declaree === '' && chezUnHebergeur) {
  refuser('AMN_EDITION n’est pas définie, et ce build tourne chez un hébergeur.');
}

const edition = declaree === 'business' ? 'business' : 'internal';
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
