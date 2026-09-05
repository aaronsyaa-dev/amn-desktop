/**
 * check:migration — AUCUNE DONNÉE NE SE PERD À LA MISE À JOUR.
 *
 * Le 4 septembre 2026, la 1.2.44 a fait disparaître les logos des
 * organisations de l'écran : la base les avait, la page du parc ne les
 * portait plus, le poste les mettait à null. Aucun test ne comparait ce que
 * la version précédente possédait à ce que la candidate montre. Ce garde le
 * fait, à chaque publication, et rien ne se publie s'il manque une donnée.
 *
 * Ce qu'il rejoue :
 *   1. la VERSION PRÉCÉDENTE d'amn-api (celle qui tournait quand la dernière
 *      version publiée est sortie) écrit un jeu de données COMPLET dans une
 *      base neuve — toutes ses collections, logo, étiquettes, verrous,
 *      comptes, préférences, supervision, journal (scripts/migration/jeu-complet.mjs) ;
 *   2. la base est relevée table par table, ligne par ligne ;
 *   3. l'amn-api CANDIDAT démarre sur cette base — ses migrations s'appliquent —
 *      et la base est relevée à nouveau : chaque ligne d'hier doit être là,
 *      chaque valeur non nulle identique ;
 *   4. le desktop CANDIDAT (build web, édition interne) est construit contre
 *      cet amn-api, et un navigateur réel exige à l'écran ce que le jeu a
 *      écrit : logos dans le rail, registre, dossiers, chaque enregistrement
 *      dans le miroir du poste (scripts/migration/contrat-poste.mjs) ;
 *   5. l'identité de l'application (appId, nom, productName) n'a pas bougé
 *      entre la version précédente et la candidate : c'est elle qui décide
 *      du dossier de données utilisateur, et un dossier qui change est une
 *      perte qui ne dit pas son nom.
 *
 *   AMN_API_DIR=../amn-api npm run check:migration
 *   npm run check:migration -- --mutation=poste      → doit ÉCHOUER (les logos remis à null)
 *   npm run check:migration -- --mutation=serveur    → doit ÉCHOUER (les logos effacés à la migration)
 *
 * Références : MIGRATION_PRECEDENT (tag desktop précédent, sinon le dernier
 * tag v* différent de la version candidate), MIGRATION_API_PRECEDENT (commit
 * d'amn-api, sinon celui de main à la date de ce tag).
 *
 * Ce qu'il ne rejoue PAS, et le dit : le contenu du dossier de données
 * utilisateur d'Electron (coffre-fort local, cache) — la version précédente
 * de l'application de bureau n'est pas lancée ici ; l'identité (5) en est la
 * garde statique.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { dumper, comparer } from './migration/dump-sqlite.mjs';

const RACINE = process.cwd();
const API_DIR = path.resolve(process.env.AMN_API_DIR || path.join(RACINE, '..', 'amn-api'));
const MUTATION = (process.argv.find((x) => x.startsWith('--mutation=')) ?? '').split('=')[1] || null;
const TRAVAIL = path.join(os.tmpdir(), 'amn-migration');
const dire = (m) => console.log(m);
const git = (dir, ...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: opts.silencieux ? 'pipe' : 'inherit', encoding: 'utf8', ...opts });
const echecs = [];
const notes = [];
const enfants = [];
const tuer = () => { for (const e of enfants) { try { e.kill('SIGTERM'); } catch { /* déjà parti */ } } };
process.on('exit', tuer);

if (!fs.existsSync(path.join(API_DIR, 'src', 'server.js'))) {
  console.error(`amn-api introuvable en ${API_DIR} — posez AMN_API_DIR.`);
  process.exit(2);
}
fs.rmSync(TRAVAIL, { recursive: true, force: true });
fs.mkdirSync(TRAVAIL, { recursive: true });

/* ── Les références ─────────────────────────────────────────────────── */
const version = JSON.parse(fs.readFileSync(path.join(RACINE, 'package.json'), 'utf8')).version;
let precedent = process.env.MIGRATION_PRECEDENT;
if (!precedent) {
  const tags = git(RACINE, 'tag', '-l', 'v*').split('\n').filter(Boolean).filter((t) => t !== `v${version}`)
    .sort((x, y) => x.replace(/^v/, '').split('.').map(Number).reduce((acc, n, i) => acc + n * 1000 ** (2 - i), 0) - y.replace(/^v/, '').split('.').map(Number).reduce((acc, n, i) => acc + n * 1000 ** (2 - i), 0));
  precedent = tags.at(-1);
}
if (!precedent) { console.error('Aucun tag v* précédent : posez MIGRATION_PRECEDENT.'); process.exit(2); }
const datePrecedent = git(RACINE, 'log', '-1', '--format=%cI', precedent);
const apiPrecedent = process.env.MIGRATION_API_PRECEDENT || git(API_DIR, 'rev-list', '-1', `--before=${datePrecedent}`, git(API_DIR, 'rev-parse', '--verify', '--quiet', 'origin/main') ? 'origin/main' : 'main');
dire(`Migration — version précédente ${precedent} (${datePrecedent.slice(0, 10)}), amn-api précédent ${apiPrecedent.slice(0, 12)} → candidat ${git(API_DIR, 'rev-parse', '--short', 'HEAD')} ; desktop candidat ${version}${MUTATION ? ` — MUTATION « ${MUTATION} », le garde doit échouer` : ''}`);

/* ── 5. L'identité de l'application ────────────────────────────────── */
const identite = (ref) => {
  const lire = (f) => (ref ? git(RACINE, 'show', `${ref}:${f}`) : fs.readFileSync(path.join(RACINE, f), 'utf8'));
  const pkg = JSON.parse(lire('package.json'));
  const eb = lire('electron-builder.config.mjs');
  return { name: pkg.name, appId: (eb.match(/appId:[^\n]*/) ?? [''])[0].replace(/\s+/g, ' '), productName: (eb.match(/productName:[^\n]*/) ?? [''])[0].replace(/\s+/g, ' ') };
};
const idAvant = identite(precedent);
const idApres = identite(null);
for (const k of Object.keys(idAvant)) {
  if (idAvant[k] !== idApres[k]) echecs.push(`identité : ${k} a changé (${idAvant[k]} → ${idApres[k]}) — le dossier de données utilisateur changerait avec lui`);
}
if (echecs.length === 0) dire(`  ✓ identité stable depuis ${precedent} : ${idApres.name}, ${idApres.appId}`);

/* ── L'amn-api précédent, dans un worktree ──────────────────────────── */
const apiPrev = path.join(TRAVAIL, 'api-precedent');
git(API_DIR, 'worktree', 'add', '--detach', '--force', apiPrev, apiPrecedent);
const deps = (dir) => JSON.stringify(JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).dependencies ?? {});
if (deps(apiPrev) === deps(API_DIR) && fs.existsSync(path.join(API_DIR, 'node_modules'))) {
  fs.symlinkSync(path.join(API_DIR, 'node_modules'), path.join(apiPrev, 'node_modules'));
  dire('  · dépendances de l’amn-api précédent : identiques, partagées');
} else {
  dire('  · dépendances de l’amn-api précédent : installation');
  sh('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund'], { cwd: apiPrev, silencieux: true });
}

/* ── L'amn-api candidat (éventuellement muté) ───────────────────────── */
let apiCandidat = API_DIR;
if (MUTATION === 'serveur') {
  apiCandidat = path.join(TRAVAIL, 'api-mute');
  git(API_DIR, 'worktree', 'add', '--detach', '--force', apiCandidat, 'HEAD');
  fs.symlinkSync(path.join(API_DIR, 'node_modules'), path.join(apiCandidat, 'node_modules'));
  const f = path.join(apiCandidat, 'src/db/sqlite.js');
  const src = fs.readFileSync(f, 'utf8');
  const ancre = "ensureColumn('organizations', 'logo_data_url', 'TEXT');";
  if (!src.includes(ancre)) { console.error('mutation serveur : ancre introuvable'); process.exit(2); }
  fs.writeFileSync(f, src.replace(ancre, `${ancre}\n  db.exec("UPDATE organizations SET logo_data_url = NULL");`));
}

/* ── 1. Le jeu complet, écrit par la version précédente ────────────── */
const base = path.join(TRAVAIL, 'amn.db');
const reference = path.join(TRAVAIL, 'reference.json');
sh('node', [path.join(RACINE, 'scripts/migration/jeu-complet.mjs'), '--api', apiPrev, '--db', base, '--reference', reference]);
const ref = JSON.parse(fs.readFileSync(reference, 'utf8'));
if (ref.manques.length) notes.push(`familles non écrites par la version précédente : ${ref.manques.join(' ; ')}`);

/* ── 2. Relevé d'hier ───────────────────────────────────────────────── */
const avant = dumper(base);
const lignesAvant = Object.values(avant).reduce((n, rows) => n + rows.length, 0);
dire(`  · base d’hier : ${Object.keys(avant).length} tables, ${lignesAvant} lignes`);

/* ── 3. Le candidat démarre sur la base d'hier ─────────────────────── */
const portLibre = () => new Promise((resolve) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
const portApi = await portLibre();
const portWeb = await portLibre();
const api = spawn('node', ['src/server.js'], { cwd: apiCandidat, env: { ...process.env, PORT: String(portApi), SQLITE_PATH: base, OPERATOR_TOKEN: 'migration-operateur', TRACKER_MONITORS: 'off', NODE_ENV: 'production', APP_PUBLIC_URL: `http://127.0.0.1:${portWeb}`, DATABASE_URL: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
enfants.push(api);
let journalApi = '';
api.stdout.on('data', (d) => { journalApi += d; });
api.stderr.on('data', (d) => { journalApi += d; });
const attendre = async (url, essais = 80) => { for (let i = 0; i < essais; i += 1) { try { if ((await fetch(url)).ok) return true; } catch { /* pas encore */ } await new Promise((r) => setTimeout(r, 250)); } return false; };
if (!(await attendre(`http://127.0.0.1:${portApi}/v1/health`))) { console.error(`amn-api candidat ne démarre pas :\n${journalApi.slice(-1500)}`); process.exit(1); }
const apres = dumper(base);
const pertes = comparer(avant, apres);
if (pertes.length) echecs.push(`migration serveur : ${pertes.length} perte(s) —\n    ${pertes.slice(0, 12).join('\n    ')}${pertes.length > 12 ? `\n    … et ${pertes.length - 12} de plus` : ''}`);
else dire(`  ✓ migration serveur : ${lignesAvant} lignes d’hier retrouvées intactes après le démarrage du candidat`);

/* ── 4. Le desktop candidat, construit contre cet amn-api ──────────── */
let desktop = RACINE;
if (MUTATION === 'poste') {
  desktop = path.join(TRAVAIL, 'desktop-mute');
  git(RACINE, 'worktree', 'add', '--detach', '--force', desktop, 'HEAD');
  fs.symlinkSync(path.join(RACINE, 'node_modules'), path.join(desktop, 'node_modules'));
  const f = path.join(desktop, 'src/lib/parcEchantillon.ts');
  const src = fs.readFileSync(f, 'utf8');
  const ancre = 'commeAdmin(o, logos.get(o.id) ?? null)';
  if (!src.includes(ancre)) { console.error('mutation poste : ancre introuvable'); process.exit(2); }
  fs.writeFileSync(f, src.replace(ancre, 'commeAdmin(o, null)'));
}
const distWeb = path.join(TRAVAIL, 'dist-web');
dire('  · construction du desktop candidat (build web, édition interne)');
sh('node', ['scripts/build-web.mjs'], { cwd: desktop, silencieux: true, env: { ...process.env, VITE_AMN_API_URL: `http://127.0.0.1:${portApi}`, AMN_WEB_OUT: distWeb } });
const web = spawn('node', [path.join(RACINE, 'scripts/migration/servir.mjs'), distWeb, String(portWeb)], { stdio: 'ignore' });
enfants.push(web);
if (!(await attendre(`http://127.0.0.1:${portWeb}/`))) { console.error('le build web ne se sert pas'); process.exit(1); }
const captures = process.env.MIGRATION_CAPTURES || '';
if (captures) fs.mkdirSync(captures, { recursive: true });
const contrat = spawn('node', [path.join(RACINE, 'scripts/migration/contrat-poste.mjs')], { env: { ...process.env, WEB: `http://127.0.0.1:${portWeb}`, API: `http://127.0.0.1:${portApi}`, REFERENCE: reference, CAPTURES: captures }, stdio: ['ignore', 'pipe', 'inherit'], cwd: RACINE });
let sortieContrat = '';
contrat.stdout.on('data', (d) => { sortieContrat += d; process.stdout.write(d); });
const codeContrat = await new Promise((resolve) => contrat.on('exit', resolve));
if (codeContrat !== 0) echecs.push(`contrat du poste : ${(sortieContrat.match(/"pertes":(\d+)/) ?? [, '?'])[1]} exigence(s) non tenue(s) à l’écran`);
else dire('  ✓ contrat du poste : tout ce que la version précédente avait écrit se voit dans le desktop candidat');

/* ── Verdict ────────────────────────────────────────────────────────── */
tuer();
try { git(API_DIR, 'worktree', 'remove', '--force', apiPrev); } catch { /* laissé dans le dossier temporaire */ }
if (MUTATION === 'serveur') { try { git(API_DIR, 'worktree', 'remove', '--force', apiCandidat); } catch { /* idem */ } }
if (MUTATION === 'poste') { try { git(RACINE, 'worktree', 'remove', '--force', desktop); } catch { /* idem */ } }
for (const n of notes) dire(`  · ${n}`);
if (MUTATION) {
  if (echecs.length) { dire(`\nMutation « ${MUTATION} » ATTRAPÉE — le garde refuse bien la perte :\n  - ${echecs.join('\n  - ')}`); process.exit(0); }
  console.error(`\nMutation « ${MUTATION} » PASSÉE INAPERÇUE — ce garde ne protège pas de ce qu'il prétend.`);
  process.exit(1);
}
if (echecs.length) {
  console.error(`\n${echecs.length} perte(s) à la mise à jour ${precedent} → ${version} — rien ne se publie :\n  - ${echecs.join('\n  - ')}`);
  process.exit(1);
}
dire(`\nMigration ${precedent} → ${version} : la base d’hier et tout ce qu’elle contenait se retrouvent intacts dans le candidat, en base et à l’écran.`);
