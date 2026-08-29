#!/usr/bin/env node
/**
 * TOUTE LA FAMILLE « IL FAUT UN VRAI NAVIGATEUR », EN UNE COMMANDE
 * ═══════════════════════════════════════════════════════════════
 *
 * Six contrôles — cibles, contraste, étiquettes, focus, mouvement, largeur —
 * ne peuvent pas tourner en intégration continue : il leur faut un build
 * SERVI, une amn-api joignable, et une session ouverte. Ils vivent donc en
 * dehors, et un contrôle qui vit en dehors est un contrôle qu'on ne lance pas.
 *
 * La procédure complète faisait une vingtaine de gestes : construire l'édition
 * cliente, peupler, servir, se connecter, lancer les six, recommencer pour
 * l'édition interne. Personne ne fait ça deux fois.
 *
 *   npm run gardes
 *
 * ## Ce qu'il fait, et dans quel ordre
 *
 *   1. peuple les deux organisations d'essai (sinon les écrans sont vides, et
 *      les contrôles ne mesurent que des états vides — c'est ce qui a caché
 *      neuf défauts la nuit du 28) ;
 *   2. pour chaque édition : construit, sert, lance les six, referme.
 *
 * Il rend un compte rendu unique, et sort en échec dès qu'un contrôle échoue —
 * mais seulement APRÈS les avoir tous lancés. S'arrêter au premier cacherait
 * les cinq autres, et on corrigerait une chose à la fois en relançant vingt
 * minutes de mesure à chaque tour.
 */

import { spawn } from 'node:child_process';
import process from 'node:process';

const API = process.env.AMN_API ?? 'http://127.0.0.1:4171';
const PORT = Number(process.env.AMN_E2E_PORT ?? 4180);

const EDITIONS = [
  {
    nom: 'cliente',
    build: 'build:web:business',
    email: process.env.AMN_E2E_EMAIL_CLIENTE ?? 'fleuriste.essai@exemple.test',
    motDePasse: process.env.AMN_E2E_PASSWORD_CLIENTE ?? 'Fleuriste-2026-Essai',
  },
  {
    nom: 'interne',
    build: 'build:web',
    email: process.env.AMN_E2E_EMAIL_INTERNE ?? 'essai.interne@exemple.test',
    motDePasse: process.env.AMN_E2E_PASSWORD_INTERNE ?? 'Interne-2026-Essai',
  },
];

const GARDES = ['cibles', 'contraste', 'etiquettes', 'focus', 'mouvement', 'largeur'];

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

/** Lance une commande et rend `{ code, sortie }`. */
function lancer(commande, args, env = {}) {
  return new Promise((resolve) => {
    const p = spawn(commande, args, { env: { ...process.env, ...env }, shell: false });
    let sortie = '';
    p.stdout.on('data', (d) => (sortie += d));
    p.stderr.on('data', (d) => (sortie += d));
    p.on('close', (code) => resolve({ code: code ?? 1, sortie }));
  });
}

/** Vérifie qu'amn-api répond avant de construire quoi que ce soit. */
async function apiJoignable(email, motDePasse) {
  try {
    const r = await fetch(`${API}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: motDePasse }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

console.log('\n══ Garde-fous navigateur ══\n');

/*
  On vérifie AVANT de construire. Sans ça, on découvre qu'amn-api est éteinte
  après quatre minutes de build, et le message d'échec parle de connexion
  refusée dans un navigateur plutôt que du serveur qu'il fallait démarrer.
*/
for (const e of EDITIONS) {
  if (!(await apiJoignable(e.email, e.motDePasse))) {
    console.error(
      `ÉCHEC : impossible de se connecter en « ${e.nom} » (${e.email}) sur ${API}.\n\n` +
        '  · amn-api tourne-t-elle ? (cd ../amn-api && PORT=4171 SQLITE_PATH=… node src/server.js)\n' +
        '  · le compte d’essai existe-t-il dans cette base ?\n\n' +
        '  Rien n’a été construit : autant le dire maintenant qu’après quatre minutes de build.',
    );
    process.exit(1);
  }
}
console.log(`amn-api répond sur ${API}, les deux comptes d’essai ouvrent une session.\n`);

/* ─── 1. Peupler ───────────────────────────────────────────────────────────── */

for (const e of EDITIONS) {
  const r = await lancer('node', ['scripts/seed-essai.mjs'], {
    AMN_E2E_EMAIL: e.email,
    AMN_E2E_PASSWORD: e.motDePasse,
  });
  if (r.code !== 0) {
    console.error(`ÉCHEC du peuplement (${e.nom}) :\n${r.sortie}`);
    process.exit(1);
  }
  const ligne = /(\d+) enregistrement\(s\) écrit\(s\), (\d+) échec/.exec(r.sortie);
  console.log(`  ${e.nom.padEnd(8)} peuplée — ${ligne ? `${ligne[1]} enregistrement(s)` : 'fait'}`);
}

/* ─── 2. Construire, servir, mesurer ───────────────────────────────────────── */

const resultats = [];

for (const e of EDITIONS) {
  console.log(`\n── édition ${e.nom} ──`);

  const build = await lancer('npm', ['run', e.build], { VITE_AMN_API_URL: API });
  if (build.code !== 0) {
    console.error(`ÉCHEC du build ${e.build} :\n${build.sortie.slice(-2000)}`);
    process.exit(1);
  }
  console.log('  build ✓');

  const serveur = spawn('npx', ['serve', '-s', 'dist', '-l', String(PORT)], { stdio: 'ignore' });
  // Laisser le serveur statique se lier au port : le premier contrôle
  // arriverait sinon sur une connexion refusée, et parlerait de session.
  await attendre(3000);

  try {
    for (const garde of GARDES) {
      const t0 = Date.now();
      const r = await lancer('npm', ['run', `check:${garde}`], {
        AMN_E2E_URL: `http://127.0.0.1:${PORT}/`,
        AMN_E2E_EMAIL: e.email,
        AMN_E2E_PASSWORD: e.motDePasse,
      });
      const secondes = Math.round((Date.now() - t0) / 1000);
      const derniere = r.sortie.trim().split('\n').filter(Boolean).pop() ?? '';
      resultats.push({ edition: e.nom, garde, code: r.code, sortie: r.sortie, derniere, secondes });
      console.log(
        `  ${r.code === 0 ? '✓' : '✗'} ${garde.padEnd(11)} ${String(secondes).padStart(3)} s  ` +
          (r.code === 0 ? derniere.replace(/^OK — /, '') : 'ÉCHEC'),
      );
    }
  } finally {
    serveur.kill();
    await attendre(500);
  }
}

/* ─── 3. Le compte rendu ───────────────────────────────────────────────────── */

const rates = resultats.filter((r) => r.code !== 0);

if (rates.length > 0) {
  console.error(`\n\n══ ${rates.length} contrôle(s) en échec ══`);
  for (const r of rates) {
    console.error(`\n──── ${r.garde} · édition ${r.edition} ────\n`);
    // La sortie complète : c'est elle qui nomme les éléments et leurs mesures.
    console.error(r.sortie.trim());
  }
  process.exit(1);
}

console.log(
  `\n\n══ ${resultats.length} contrôles verts sur les deux éditions ══\n` +
    resultats.map((r) => `  ${r.edition.padEnd(8)} ${r.garde.padEnd(11)} ${r.derniere}`).join('\n') +
    '\n',
);
