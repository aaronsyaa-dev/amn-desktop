#!/usr/bin/env node
/**
 * LES ÉCRANS D'UN LOT, D'UN COUP — capture puis comparaison, écran par écran.
 *
 * Enchaîne `capturer.mjs` et `comparer.mjs` pour chaque écran d'un fichier de scénarios
 * (voir `ecrans-lot00.json`), et rend un tableau et, en option, un fichier Markdown.
 *
 *   AMN_E2E_EMAIL=… AMN_E2E_PASSWORD=… node scripts/qualite/fidelite/lot.mjs \
 *     --scenarios scripts/qualite/fidelite/ecrans-lot00.json \
 *     --dist <build> [--dist-dev <build-développement>] --images <dossier-images> --data <dossier-_data> \
 *     --api http://127.0.0.1:4171 --sortie <dossier> [--seulement H40,H41] [--rapport fichier.md]
 *
 * Même règles de sûreté que `capturer.mjs` : build servi depuis le disque, réseau limité à cette
 * machine, compte d'essai en @exemple.test. Sort 0 si tout est OK, 1 sinon, 2 en cas d'erreur.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (n, d = null) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const SCEN = opt('scenarios');
const DIST = opt('dist');
const DIST_DEV = opt('dist-dev'); // build en mode développement, pour les écrans qui n'existent qu'en développement (H43)
const IMAGES = opt('images');
const DATA = opt('data');
const API = opt('api', 'http://127.0.0.1:4171');
const SORTIE = path.resolve(opt('sortie', 'fidelite'));
const SEUL = opt('seulement')?.split(',');
const RAPPORT = opt('rapport');
if (!SCEN || !DIST || !IMAGES) {
  console.error('Usage : lot.mjs --scenarios <fichier.json> --dist <build> --images <dossier> [--data <dossier>] [--api …] [--sortie …] [--seulement ID,ID] [--rapport f.md]');
  process.exit(2);
}
const scenario = JSON.parse(fs.readFileSync(SCEN, 'utf8'));
fs.mkdirSync(SORTIE, { recursive: true });

const resultats = [];
for (const e of scenario.ecrans) {
  if (SEUL && !SEUL.includes(e.id)) continue;
  const c = { ...scenario.defaut, ...e, stockage: { ...(scenario.defaut?.stockage ?? {}), ...(e.stockage ?? {}) } };
  const png = path.join(SORTIE, `${e.id}.png`);
  const etapes = path.join(SORTIE, `${e.id}.etapes.json`);
  fs.writeFileSync(etapes, JSON.stringify(c.etapes ?? []));
  if (c.dev && !DIST_DEV) { resultats.push({ id: e.id, erreur: 'cet écran n’existe qu’en développement : passez --dist-dev <build NODE_ENV=development>' }); console.log(`${e.id.padEnd(4)} ERREUR : ${resultats.at(-1).erreur}`); continue; }
  const a = [path.join(ICI, 'capturer.mjs'), '--dist', c.dev ? DIST_DEV : DIST, '--api', API, '--sortie', png, '--etapes', etapes];
  if (c.route) a.push('--route', c.route);
  if (c.date) a.push('--date', c.date);
  if (c.mac) a.push('--mac');
  if (c.sansConnexion) a.push('--sans-connexion');
  const st = Object.entries(c.stockage).map(([k, v]) => `${k}=${v}`).join(';;');
  if (st) a.push('--stockage', st);
  const cap = spawnSync('node', a, { encoding: 'utf8' });
  if (cap.status !== 0) {
    resultats.push({ id: e.id, erreur: (cap.stderr || cap.stdout).trim().split('\n').pop() });
    console.log(`${e.id.padEnd(4)} ERREUR de capture : ${resultats.at(-1).erreur}`);
    continue;
  }
  const reseau = /Réseau : (.*)/.exec(cap.stdout)?.[1] ?? '';
  const donnees = DATA && fs.readdirSync(DATA).find((f) => f.startsWith(`${e.id}-`) && f.endsWith('.json'));
  const b = [path.join(ICI, 'comparer.mjs'), png, '--id', e.id, '--images', IMAGES, '--sortie', SORTIE, '--json', '--zones', '10'];
  if (c.gabarit) b.push('--gabarit', c.gabarit);
  if (donnees) b.push('--textes', path.join(DATA, donnees));
  for (const z of c.ignorer ?? []) b.push('--ignorer', z.join(','));
  const cmp = spawnSync('node', b, { encoding: 'utf8' });
  if (cmp.status !== 0 && cmp.status !== 1) {
    resultats.push({ id: e.id, erreur: cmp.stderr.trim() });
    console.log(`${e.id.padEnd(4)} ERREUR de comparaison : ${cmp.stderr.trim()}`);
    continue;
  }
  const r = JSON.parse(cmp.stdout);
  // Une palette posée sur une autre page : on mesure aussi la palette seule.
  let rz = null;
  if (c.zone) {
    const z = spawnSync('node', [...b, '--zone', c.zone.join(',')], { encoding: 'utf8' });
    if (z.status === 0 || z.status === 1) rz = JSON.parse(z.stdout);
  }
  resultats.push({ ...r, zone: rz, reseau });
  const ligne = (x) => `${x.verdict === 'ok' ? 'OK         ' : 'À CORRIGER '} ${(x.tauxEcart * 100).toFixed(2).padStart(6)} % · ${String(x.zonesTotal).padStart(2)} zone(s)`;
  console.log(`${e.id.padEnd(4)} ${ligne(r)}${r.textes ? ` · textes ${r.textes.trouves}/${r.textes.total}` : ''}${rz ? `  |  zone ${c.zone.join(',')} : ${ligne(rz)}` : ''}`);
}

fs.writeFileSync(path.join(SORTIE, 'resultats.json'), JSON.stringify(resultats, null, 2));
if (RAPPORT) {
  const L = [`# Fidélité ${scenario.lot} — résultats bruts`, '', '| Écran | Verdict | Pixels en écart | Zones | Textes de la maquette retrouvés |', '|---|---|---|---|---|'];
  for (const r of resultats) L.push(r.erreur ? `| ${r.id} | erreur | — | — | ${r.erreur} |` : `| ${r.ecran} | ${r.verdict === 'ok' ? 'OK' : 'À CORRIGER'} | ${(r.tauxEcart * 100).toFixed(2).replace('.', ',')} % | ${r.zonesTotal} | ${r.textes ? `${r.textes.trouves} / ${r.textes.total}` : '—'} |`);
  fs.writeFileSync(path.resolve(RAPPORT), `${L.join('\n')}\n`);
}
process.exit(resultats.some((r) => r.erreur) ? 2 : resultats.every((r) => r.verdict === 'ok') ? 0 : 1);
