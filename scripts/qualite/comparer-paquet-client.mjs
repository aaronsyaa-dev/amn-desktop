#!/usr/bin/env node
/**
 * LE PAQUET CLIENT A-T-IL CHANGÉ ? — avant / après, au-delà des renommages.
 *
 * Règle du chantier : l'édition cliente (AMN Desktop, `business`) ne doit pas
 * changer. Comparer deux builds octet par octet ne suffit pas : le
 * minificateur renomme ses variables dès qu'une fonction s'ajoute n'importe
 * où, et tout le fichier diffère. Ce script :
 *
 *   1. compare les empreintes (identiques → fin, rien n'a bougé) ;
 *   2. sinon, reformate chaque JS (esbuild), remplace les noms minifiés
 *      (≤ 3 caractères) par `ι`, et compare ligne à ligne : ce qui reste est
 *      un vrai changement de code ou de texte ;
 *   3. liste les sélecteurs CSS ajoutés ou retirés ;
 *   4. cherche les mots qui ne doivent jamais y être (« Ajmani », code de la
 *      refonte : `src/socle`, `src/refonte`, `moments`…).
 *
 * Usage : node scripts/qualite/comparer-paquet-client.mjs <avant> <après> [--rapport fichier.md]
 * Sort en 1 si un mot interdit est trouvé dans <après>, en 3 si le code a
 * changé, en 0 si seuls les noms minifiés diffèrent.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ESBUILD = path.join(ROOT, 'node_modules', '.bin', 'esbuild');
const args = process.argv.slice(2);
const [AVANT, APRES] = args.filter((a) => !a.startsWith('--'));
const iRapport = args.indexOf('--rapport');
const RAPPORT = iRapport >= 0 ? args[iRapport + 1] : null;
if (!AVANT || !APRES) {
  console.error('Usage : node scripts/qualite/comparer-paquet-client.mjs <avant> <après> [--rapport fichier.md]');
  process.exit(2);
}

// Mots qu'aucun octet du paquet client ne doit porter. Insensibles à la casse.
const INTERDITS = ['ajmani', 'src/socle', 'src/refonte', 'refonte', 'emettreMoment', 'garde.escalade', 'site.muet'];

const fichiers = (d) => {
  const out = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) out.push(...fichiers(f));
    else out.push(f);
  }
  return out;
};
const empreinte = (d) => {
  const h = crypto.createHash('sha256');
  for (const f of fichiers(d).sort()) h.update(path.relative(d, f)).update(fs.readFileSync(f));
  return h.digest('hex').slice(0, 16);
};
const jsPrincipaux = (d) => fichiers(d).filter((f) => f.endsWith('.js'));
const cssDe = (d) => fichiers(d).filter((f) => f.endsWith('.css'));

/** JS reformaté, noms minifiés masqués, une ligne par ligne source. */
function normaliser(f) {
  const source = execFileSync(ESBUILD, [f, '--log-level=error'], { maxBuffer: 1 << 30 }).toString();
  const lignes = [];
  let courante = -1;
  let tampon = [];
  for (const t of acorn.tokenizer(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true })) {
    if (t.loc.start.line !== courante) {
      if (tampon.length) lignes.push(tampon.join(' '));
      tampon = [];
      courante = t.loc.start.line;
    }
    const brut = source.slice(t.start, t.end);
    tampon.push(t.type.label === 'name' && brut.length <= 3 ? 'ι' : brut);
  }
  if (tampon.length) lignes.push(tampon.join(' '));
  return lignes;
}

/** Diff minimal par plus longue sous-suite commune, sur des lignes hachées. */
function diffLignes(a, b) {
  // Les lignes communes en tête et en queue sortent d'abord : le reste est petit.
  let debut = 0;
  while (debut < a.length && debut < b.length && a[debut] === b[debut]) debut++;
  let fa = a.length, fb = b.length;
  while (fa > debut && fb > debut && a[fa - 1] === b[fb - 1]) { fa--; fb--; }
  const A = a.slice(debut, fa), B = b.slice(debut, fb);
  if (A.length * B.length > 4e7) return { ajout: B, retrait: A };
  const n = A.length, m = B.length;
  const L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ajout = [], retrait = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) retrait.push(A[i++]); else ajout.push(B[j++]);
  }
  while (i < n) retrait.push(A[i++]);
  while (j < m) ajout.push(B[j++]);
  return { ajout, retrait };
}

const selecteurs = (f) => {
  const css = execFileSync(ESBUILD, [f, '--log-level=error'], { maxBuffer: 1 << 30 }).toString();
  return new Set(css.split('\n').map((l) => l.trim()).filter((l) => l.endsWith('{') || l.endsWith(',')));
};

const sortie = [];
const dire = (l = '') => { console.log(l); sortie.push(l); };

const eAvant = empreinte(AVANT), eApres = empreinte(APRES);
dire(`# Paquet client : avant / après`);
dire();
dire(`- avant : \`${AVANT}\` — empreinte \`${eAvant}\`, ${fichiers(AVANT).length} fichiers`);
dire(`- après : \`${APRES}\` — empreinte \`${eApres}\`, ${fichiers(APRES).length} fichiers`);

let code = 0;
if (eAvant === eApres) {
  dire('- **identiques octet pour octet.**');
} else {
  // JS : on apparie par taille décroissante (le gros chunk avec le gros chunk).
  const parTaille = (l) => l.sort((x, y) => fs.statSync(y).size - fs.statSync(x).size);
  const ja = parTaille(jsPrincipaux(AVANT)), jb = parTaille(jsPrincipaux(APRES));
  dire();
  dire('## JavaScript (noms minifiés masqués)');
  for (let k = 0; k < Math.max(ja.length, jb.length); k++) {
    if (!ja[k] || !jb[k]) { dire(`- fichier sans vis-à-vis : ${ja[k] ?? jb[k]}`); code = 3; continue; }
    const na = normaliser(ja[k]), nb = normaliser(jb[k]);
    const { ajout, retrait } = diffLignes(na, nb);
    dire(`- \`${path.basename(ja[k])}\` → \`${path.basename(jb[k])}\` : ${ajout.length} ligne(s) ajoutée(s), ${retrait.length} retirée(s)`);
    for (const l of retrait.slice(0, 15)) dire(`    - ${l.slice(0, 220)}`);
    for (const l of ajout.slice(0, 15)) dire(`    + ${l.slice(0, 220)}`);
    if (ajout.length || retrait.length) code = 3;
  }
  dire();
  dire('## CSS (sélecteurs)');
  const sa = new Set(cssDe(AVANT).flatMap((f) => [...selecteurs(f)]));
  const sb = new Set(cssDe(APRES).flatMap((f) => [...selecteurs(f)]));
  const plus = [...sb].filter((s) => !sa.has(s)), moins = [...sa].filter((s) => !sb.has(s));
  dire(`- ${plus.length} sélecteur(s) ajouté(s), ${moins.length} retiré(s)`);
  for (const s of plus.slice(0, 40)) dire(`    + ${s}`);
  if (plus.length > 40) dire(`    … et ${plus.length - 40} autres`);
  for (const s of moins.slice(0, 20)) dire(`    - ${s}`);
  if (plus.length || moins.length) code = 3;
}

dire();
dire('## Mots interdits dans « après »');
let trouves = 0;
for (const f of fichiers(APRES)) {
  if (!/\.(js|css|html|json|webmanifest|txt|map)$/.test(f)) continue;
  const t = fs.readFileSync(f, 'utf8').toLowerCase();
  for (const mot of INTERDITS) {
    const i = t.indexOf(mot.toLowerCase());
    if (i >= 0) { trouves++; dire(`- \`${mot}\` dans ${path.relative(APRES, f)} : …${t.slice(Math.max(0, i - 50), i + 50).replace(/\s+/g, ' ')}…`); }
  }
}
if (!trouves) dire(`- aucun (${INTERDITS.map((m) => `« ${m} »`).join(', ')})`);

if (RAPPORT) fs.writeFileSync(RAPPORT, sortie.join('\n') + '\n');
process.exit(trouves ? 1 : code);
