#!/usr/bin/env node
/**
 * LES GARDES NAVIGATEUR, DANS UN BAC À SABLE — sans poste, sans données réelles.
 *
 * `npm run gardes` (scripts/gardes-navigateur.mjs) suppose une amn-api déjà
 * lancée sur un poste, avec ses comptes. Personne ne l'avait, donc ces gardes
 * ne tournaient nulle part (docs/refonte/STATUT.md, « Gardes qui ne tournent
 * nulle part »). Ici, tout est fourni :
 *
 *   1. amn-api d'essai en mémoire (scripts/qualite/api-essai.mjs) ;
 *   2. peuplement factice (scripts/seed-essai.mjs, comptes @exemple.test) ;
 *   3. pour chaque édition, le bundle déjà construit avec
 *      VITE_AMN_API_URL=http://127.0.0.1:4171, servi en local ;
 *   4. chaque garde lancée, TOUTES, même après un échec, avec sa sortie gardée.
 *
 * Usage :
 *   AMN_API_ROOT=../amn-api node scripts/qualite/gardes-bac-a-sable.mjs \
 *     --cliente <dist-cliente> --interne <dist-interne> [--sortie <dossier>] [--seulement a,b]
 *
 * Construire avant (environ 1 min chacun) :
 *   VITE_AMN_API_URL=http://127.0.0.1:4171 AMN_WEB_OUT=<dist-interne> node scripts/build-web.mjs
 *   VITE_AMN_API_URL=http://127.0.0.1:4171 AMN_EDITION=business AMN_WEB_OUT=<dist-cliente> node scripts/build-web.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (nom) => { const i = process.argv.indexOf(`--${nom}`); return i >= 0 ? process.argv[i + 1] : null; };
const DIST = { cliente: arg('cliente'), interne: arg('interne') };
const SORTIE = path.resolve(arg('sortie') ?? path.join(ROOT, 'docs', 'qualite', 'resultats'));
const SEULEMENT = arg('seulement')?.split(',') ?? null;
const API_PORT = 4171;
const API = `http://127.0.0.1:${API_PORT}`;
fs.mkdirSync(SORTIE, { recursive: true });

const COMPTES = {
  cliente: { email: 'fleuriste.essai@exemple.test', motDePasse: 'Fleuriste-2026-Essai' },
  interne: { email: 'essai.interne@exemple.test', motDePasse: 'Interne-2026-Essai' },
};

/*
  Comment chaque garde se lance. Trois familles :
    - « url »    : lit AMN_E2E_URL, il faut servir le bundle soi-même ;
    - « bundle » : prend <bundle> [port] et sert lui-même ;
    - « isolation » : démarre SA propre amn-api, prend <bundle> <port>.
*/
const GARDES = [
  { nom: 'business', mode: 'statique', editions: ['cliente'] },
  { nom: 'isolation', mode: 'isolation', editions: ['cliente', 'interne'] },
  { nom: 'mouvement', mode: 'url', editions: ['cliente', 'interne'] },
  { nom: 'contraste', mode: 'url', editions: ['cliente', 'interne'] },
  { nom: 'focus', mode: 'url', editions: ['cliente', 'interne'] },
  { nom: 'cibles', mode: 'url', editions: ['cliente', 'interne'] },
  { nom: 'etiquettes', mode: 'url', editions: ['cliente', 'interne'] },
  { nom: 'largeur', mode: 'url', editions: ['cliente', 'interne'] },
  { nom: 'signal', mode: 'bundle', editions: ['cliente', 'interne'] },
  { nom: 'mobile', mode: 'bundle', editions: ['cliente', 'interne'] },
  { nom: 'coquille', mode: 'bundle', editions: ['cliente', 'interne'] },
].filter((g) => !SEULEMENT || SEULEMENT.includes(g.nom));

/*
  LE GUIDE DE PREMIÈRE CONNEXION MASQUE TOUT — et un navigateur neuf le montre toujours.

  Le produit retient « guide vu » dans localStorage, par compte
  (`amn.guide.<quoi>.<email>`, voir src/guide/memoire.ts). Chaque garde ouvre
  un navigateur vierge : la fenêtre « Bienvenue » (role=dialog, z-290, plein
  écran) reste ouverte sur CHAQUE écran, `check:focus` y voit 277 « fenêtres
  sans focus » et les gardes de cibles, d'étiquettes et de largeur ne
  parviennent pas à ouvrir une seule vue de détail. On ne modifie pas les
  gardes : on sert une COPIE du bundle dont index.html marque le guide comme
  vu pour les comptes factices, comme l'aurait fait une personne qui l'a déjà
  parcouru.
*/
function preparerBundle(ed) {
  const dest = path.join(SORTIE, 'bundles', ed);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(DIST[ed], dest, { recursive: true });
  const cles = Object.values(COMPTES).flatMap((c) => ['general', 'profil', 'presentation'].map((q) => `amn.guide.${q}.${c.email}`));
  const script = `<script>try{${cles.map((k) => `localStorage.setItem(${JSON.stringify(k)},'vu')`).join(';')}}catch(e){}</script>`;
  const idx = path.join(dest, 'index.html');
  const html = fs.readFileSync(idx, 'utf8');
  if (!html.includes('<head>')) throw new Error(`index.html sans <head> : ${idx}`);
  fs.writeFileSync(idx, html.replace('<head>', `<head>${script}`));
  return dest;
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
// Une garde qui clique sur chaque bouton (focus) peut dépasser vingt minutes : délai réglable.
const DELAI_MS = Number(process.env.QUALITE_DELAI_MIN ?? 45) * 60_000;
function lancer(cmd, args, env = {}, delaiMs = DELAI_MS) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env } });
    let sortie = '';
    p.stdout.on('data', (d) => (sortie += d));
    p.stderr.on('data', (d) => (sortie += d));
    const minuteur = setTimeout(() => { sortie += `\n[bac à sable] arrêtée après ${delaiMs / 1000} s\n`; p.kill('SIGKILL'); }, delaiMs);
    p.on('close', (code) => { clearTimeout(minuteur); resolve({ code: code ?? 1, sortie }); });
  });
}

// 1. amn-api d'essai
const api = spawn('node', [path.join(ROOT, 'scripts', 'qualite', 'api-essai.mjs'), String(API_PORT)], { cwd: ROOT, env: process.env });
let journalApi = '';
api.stdout.on('data', (d) => (journalApi += d));
api.stderr.on('data', (d) => (journalApi += d));
for (let i = 0; i < 40 && !journalApi.includes('prête'); i++) await attendre(250);
if (!journalApi.includes('prête')) { console.error(`amn-api d'essai muette :\n${journalApi}`); api.kill(); process.exit(2); }
console.log(`amn-api d'essai : ${API}`);

const resultats = [];
try {
  // 2. peuplement factice
  for (const [ed, c] of Object.entries(COMPTES)) {
    const r = await lancer('node', ['scripts/seed-essai.mjs'], { AMN_API: API, AMN_E2E_EMAIL: c.email, AMN_E2E_PASSWORD: c.motDePasse });
    console.log(`peuplement ${ed} : ${r.sortie.trim().split('\n').pop()}`);
  }

  // 3. gardes
  let port = 4180;
  const SERVI = Object.fromEntries(Object.keys(DIST).filter((e) => DIST[e]).map((e) => [e, preparerBundle(e)]));
  for (const g of GARDES) {
    for (const ed of g.editions) {
      if (!DIST[ed]) continue;
      const c = COMPTES[ed];
      const env = { AMN_E2E_EMAIL: c.email, AMN_E2E_PASSWORD: c.motDePasse, ...(ed === 'interne' ? { AMN_EDITION: 'interne' } : {}) };
      const p = port++;
      const t0 = Date.now();
      let r;
      if (g.mode === 'statique') {
        r = await lancer('node', ['scripts/check-business-bundle.mjs', '--dir', DIST[ed]]);
      } else if (g.mode === 'isolation') {
        r = await lancer('node', ['scripts/check-isolation.mjs', SERVI[ed], String(p), ...(ed === 'interne' ? ['--fondatrice'] : [])]);
      } else if (g.mode === 'bundle') {
        r = await lancer('node', [`scripts/check-${g.nom}.mjs`, SERVI[ed], String(p)], env);
      } else {
        const serveur = spawn('node', ['scripts/servir-bundle.mjs', SERVI[ed], String(p)], { cwd: ROOT, stdio: 'ignore' });
        await attendre(1200);
        try {
          r = await lancer('node', [`scripts/check-${g.nom}.mjs`], { ...env, AMN_E2E_URL: `http://127.0.0.1:${p}/` });
        } finally { serveur.kill(); }
      }
      const s = Math.round((Date.now() - t0) / 1000);
      const fichier = path.join(SORTIE, `${g.nom}-${ed}.txt`);
      fs.writeFileSync(fichier, r.sortie);
      const derniere = r.sortie.trim().split('\n').filter(Boolean).pop() ?? '';
      resultats.push({ garde: g.nom, edition: ed, code: r.code, secondes: s, derniere, fichier: path.relative(ROOT, fichier) });
      console.log(`${r.code === 0 ? '✓' : '✗'} ${g.nom.padEnd(11)} ${ed.padEnd(8)} ${String(s).padStart(4)} s  ${derniere.slice(0, 120)}`);
    }
  }
} finally {
  api.kill('SIGTERM');
}

fs.writeFileSync(path.join(SORTIE, 'resultats.json'), JSON.stringify(resultats, null, 2) + '\n');
const rates = resultats.filter((r) => r.code !== 0);
console.log(`\n${resultats.length - rates.length}/${resultats.length} vertes. Sorties : ${path.relative(ROOT, SORTIE)}/`);
process.exit(rates.length ? 1 : 0);
