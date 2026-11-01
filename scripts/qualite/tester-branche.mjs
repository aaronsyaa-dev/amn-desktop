#!/usr/bin/env node
/**
 * TESTER UNE BRANCHE AVANT FUSION — la part automatisable de la liste de
 * contrôle de docs/refonte/INTEGRATION-F1.md, utilisable pour toute session.
 *
 * Lecture seule : la branche est extraite dans un worktree temporaire, rien
 * n'est commité, le worktree est supprimé à la fin.
 *
 * Usage :
 *   node scripts/qualite/tester-branche.mjs <ref> [--base origin/claude/refonte-vivante]
 *        [--zone 'src/ateliers/**,docs/atelier/**'] [--sans-gardes] [--rapport f.md]
 *
 * Ce qu'il vérifie :
 *   - la branche part de la dernière base (merge-base = tête de la base) ;
 *   - fichiers hors zone, `*.business.*` touchés, package.json / lockfile,
 *     `src/i18n/fr.ts` / `en.ts`, fichiers sensibles modifiés non additivement ;
 *   - imports de `src/ateliers`, `src/refonte`, `src/socle` depuis un fichier
 *     partagé (ni `.internal.`, ni dans ces dossiers) ;
 *   - motifs de secret et noms de données réelles dans les lignes ajoutées ;
 *   - mot « Ajmani » ailleurs que dans une barre de texte (signalé, à relire) ;
 *   - typecheck, typecheck:business, lint, et toutes les `check:*` de
 *     editions.yml, dans le worktree.
 * Sortie 1 si un point bloquant est trouvé.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = (n, d = null) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const REF = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
if (!REF) { console.error('Usage : node scripts/qualite/tester-branche.mjs <ref> [--base …] [--zone …] [--sans-gardes] [--rapport f.md]'); process.exit(2); }
const BASE = opt('base', 'origin/claude/refonte-vivante');
const ZONE = opt('zone')?.split(',').map((g) => g.trim()).filter(Boolean) ?? null;
const SANS_GARDES = args.includes('--sans-gardes');
const RAPPORT = opt('rapport');

const git = (...a) => execFileSync('git', a, { cwd: ROOT, maxBuffer: 1 << 28 }).toString().trim();
const globVersRegex = (g) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '§').replace(/\*/g, '[^/]*').replace(/§/g, '.*') + '$');

const SENSIBLES = ['src/index.css', 'src/renderer.tsx', 'src/App.tsx', 'src/screens/SettingsScreen.tsx', 'vite.edition.ts', 'tsconfig.json', 'tsconfig.business.json', 'package.json', '.github/workflows/editions.yml', 'src/socle/moments.ts'];
const INTERDITS_SANS_CO = ['src/components/rail/BarreRail.tsx', 'src/components/MobileBottomNav.tsx', 'docs/refonte/REGLES.md', 'docs/refonte/STATUT.md'];
const SECRETS = [/sk_(live|test)_[0-9a-zA-Z]{10,}/, /gh[pousr]_[0-9A-Za-z]{30,}/, /AKIA[0-9A-Z]{16}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\b(api[_-]?key|secret|password|mot_?de_?passe|token)\b\s*[:=]\s*['"][^'"\s]{12,}['"]/i, /xox[baprs]-[0-9A-Za-z-]{10,}/, /AIza[0-9A-Za-z_-]{35}/];
const REELLES = [/syraagensy/i, /\bnwsy\b/i];

const lignes = [];
const dire = (l = '') => { console.log(l); lignes.push(l); };
const bloquants = [];
const signal = (gravite, texte) => { dire(`- **${gravite}** ${texte}`); if (gravite === 'Bloquant') bloquants.push(texte); };

const sha = git('rev-parse', '--short', REF);
const shaBase = git('rev-parse', '--short', BASE);
const mb = git('merge-base', REF, BASE);
dire(`# Test de branche : \`${REF}\` @ \`${sha}\``);
dire();
dire(`- base : \`${BASE}\` @ \`${shaBase}\` ; merge-base \`${mb.slice(0, 7)}\``);
const retard = Number(git('rev-list', '--count', `${REF}..${BASE}`));
dire(`- retard sur la base : ${retard} commit(s) ; avance : ${git('rev-list', '--count', `${BASE}..${REF}`)} commit(s)`);
const conflits = spawnSync('git', ['merge-tree', '--write-tree', '--name-only', BASE, REF], { cwd: ROOT }).stdout.toString().trim().split('\n').slice(1).filter((l) => l && !l.startsWith('Auto-merging') && !l.startsWith('CONFLICT'));
dire(`- fusion simulée : ${conflits.length ? `${conflits.length} conflit(s) : ${conflits.join(', ')}` : 'sans conflit'}`);

dire();
dire('## Périmètre');
const fichiers = git('diff', '--name-status', `${mb}..${REF}`).split('\n').filter(Boolean).map((l) => { const [statut, ...p] = l.split('\t'); return { statut, fichier: p.at(-1) }; });
dire(`- ${fichiers.length} fichier(s) touché(s)`);
if (retard > 0) signal('Majeur', `la branche ne part pas de la dernière base (${retard} commit(s) de retard)`);
if (ZONE) {
  const rx = ZONE.map(globVersRegex);
  const hors = fichiers.filter((f) => !rx.some((r) => r.test(f.fichier)));
  if (hors.length) signal('Majeur', `${hors.length} fichier(s) hors zone (${ZONE.join(', ')}) : ${hors.map((f) => `\`${f.fichier}\``).join(', ')}`);
}
for (const f of fichiers) {
  const jumeau = /\.business\.(tsx?|mjs|js)$/.test(f.fichier);
  if (jumeau && f.statut !== 'A') {
    // Ajouter un export inerte à une couture existante peut être prévu par la zone (ex. S2 et socle.*) : à relire, pas bloquant d'office.
    const retraits = Number(git('diff', '--numstat', `${mb}..${REF}`, '--', f.fichier).split('\t')[1]);
    signal(retraits > 0 ? 'Bloquant' : 'Majeur', `jumeau \`${f.fichier}\` modifié (${retraits > 0 ? `${retraits} ligne(s) retirée(s)` : 'ajouts seulement : vérifier que la zone le permet et que l\'ajout ne fait rien'})`);
  }
  if (jumeau && f.statut === 'A') signal('Info', `nouveau jumeau \`${f.fichier}\` : vérifier qu'il ne fait rien`);
  if (INTERDITS_SANS_CO.includes(f.fichier)) signal('Bloquant', `\`${f.fichier}\` est interdit sans accord du CO`);
  if (['src/i18n/fr.ts', 'src/i18n/en.ts'].includes(f.fichier)) signal('Majeur', `\`${f.fichier}\` modifié : les textes vont dans l'i18n.ts de la zone`);
  if (f.fichier === 'package-lock.json' || f.fichier === 'package.json') {
    const d = git('diff', `${mb}..${REF}`, '--', 'package.json');
    if (/^\+\s+"[^"]+":\s*"[\^~]?\d/m.test(d)) signal('Majeur', 'nouvelle dépendance dans package.json (accord écrit du CO requis)');
  }
  if (SENSIBLES.includes(f.fichier)) {
    const retraits = git('diff', '--numstat', `${mb}..${REF}`, '--', f.fichier).split('\t')[1];
    signal(Number(retraits) > 0 ? 'Majeur' : 'Info', `fichier sensible \`${f.fichier}\` : ${Number(retraits) > 0 ? `${retraits} ligne(s) retirée(s), pas un ajout seul` : 'ajouts seulement, à signaler au rapport'}`);
  }
}

dire();
dire('## Isolement des éditions et contenu ajouté');
const interne = (f) => /^src\/(ateliers|refonte|socle|securite)\//.test(f) || /\.internal\./.test(f);
for (const f of fichiers.filter((x) => x.statut !== 'D' && /\.(tsx?|css|mjs|js)$/.test(x.fichier))) {
  const contenu = spawnSync('git', ['show', `${REF}:${f.fichier}`], { cwd: ROOT, maxBuffer: 1 << 26 }).stdout.toString();
  if (f.fichier.startsWith('src/') && !interne(f.fichier)) {
    const m = contenu.match(/from\s+['"][^'"]*(?:\/|^)(ateliers|refonte|socle)\/[^'"]*['"]/);
    if (m) signal('Bloquant', `fichier partagé \`${f.fichier}\` importe en direct : \`${m[0]}\` (passer par une couture @edition/*)`);
    if (/emettreMoment\(|\bemit\(/.test(contenu) && git('diff', `${mb}..${REF}`, '--', f.fichier).match(/^\+.*(emettreMoment\(|\bemit\()/m)) signal('Majeur', `\`emit\` ajouté dans le fichier partagé \`${f.fichier}\` : accord du CO requis`);
  }
}
const ajout = git('diff', '-U0', `${mb}..${REF}`, '--', '.', ':(exclude)*.md').split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'));
for (const rx of SECRETS) { const l = ajout.find((x) => rx.test(x)); if (l) signal('Bloquant', `motif de secret (${rx.source.slice(0, 30)}…) : \`${l.slice(0, 120)}\``); }
for (const rx of REELLES) { const l = ajout.find((x) => rx.test(x)); if (l) signal('Bloquant', `donnée réelle possible (${rx.source}) : \`${l.slice(0, 120)}\``); }
const ajmani = ajout.filter((l) => /ajmani/i.test(l) && /mascotte|svg|personnage|robot|regard|cligne|expression/i.test(l));
if (ajmani.length) signal('Info', `à relire : ${ajmani.length} ligne(s) ajoutée(s) associent Ajmani à un personnage (mascotte, svg, regard…) — décision « sans personnage » ; ex. \`${ajmani[0].slice(0, 120)}\``);
const fetchs = ajout.filter((l) => /\bfetch\(|new WebSocket\(|XMLHttpRequest/.test(l));
if (fetchs.length) signal('Info', `${fetchs.length} appel(s) réseau ajouté(s) : à décrire dans le rapport`);

if (!SANS_GARDES) {
  dire();
  dire('## Gardes sans navigateur (worktree)');
  const wt = fs.mkdtempSync(path.join(os.tmpdir(), 'tester-branche-'));
  git('worktree', 'add', '--detach', wt, REF);
  try {
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(wt, 'node_modules'));
    const yml = fs.readFileSync(path.join(wt, '.github', 'workflows', 'editions.yml'), 'utf8');
    const checks = [...new Set([...yml.matchAll(/npm run (check:[a-z-]+)/g)].map((m) => m[1]))].filter((c) => c !== 'check:business');
    for (const c of ['typecheck', 'typecheck:business', 'lint', ...checks]) {
      const r = spawnSync('npm', ['run', '-s', c], { cwd: wt, env: process.env, maxBuffer: 1 << 26 });
      const fin = (r.stdout.toString() + r.stderr.toString()).trim().split('\n').filter(Boolean).pop() ?? '';
      dire(`- ${r.status === 0 ? '✓' : '✗'} \`${c}\`${r.status === 0 ? '' : ` — ${fin.slice(0, 160)}`}`);
      if (r.status !== 0) bloquants.push(`${c} rouge`);
    }
  } finally {
    git('worktree', 'remove', '--force', wt);
  }
}

dire();
dire(bloquants.length ? `**${bloquants.length} point(s) bloquant(s).**` : '**Aucun point bloquant automatique.** Restent à relire à la main : design, rendu, ambre, briques du socle.');
if (RAPPORT) fs.writeFileSync(RAPPORT, lignes.join('\n') + '\n');
process.exit(bloquants.length ? 1 : 0);
