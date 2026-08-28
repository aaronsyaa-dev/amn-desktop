#!/usr/bin/env node
/**
 * LE PROFIL EST UN ENREGISTREMENT ENTIER — trois règles (BLOC 11)
 * ══════════════════════════════════════════════════════════════
 *
 * La synchronisation ne connaît pas la modification partielle : écrire un
 * profil remplace le profil. Toute écriture doit donc partir de
 * l'enregistrement RÉEL, jamais d'un repli fabriqué.
 *
 * Ce qui est arrivé, reproduit avec témoin sur l'application construite avant
 * d'écrire une ligne de correctif : `markTeamSeen` s'exécute à l'ouverture de
 * l'écran Équipe sans attendre l'hydratation du miroir. Sur une liaison lente,
 * `baseData` rendait alors un repli — `photoDataUrl: ''` — et l'écrivait sur
 * le serveur en dernier écrivain. La photo disparaissait pour tout le monde.
 * Le témoin (arrivée sur l'Accueil, mêmes conditions) restait intact : c'est
 * lui qui désignait l'écran Équipe, et le retard qui expliquait pourquoi le
 * défaut ne s'observait que depuis un téléphone.
 *
 * Ce contrôle empêche la classe entière, pas l'incident :
 *
 *   1. `baseData` peut rendre `null` — c'est ce qui rend l'effacement
 *      inexprimable plutôt que confié à la vigilance de chaque appelant ;
 *   2. chaque écriture dans `profiles` est précédée d'un refus explicite
 *      lorsque cette base manque ;
 *   3. AUCUN autre fichier n'écrit dans la collection `profiles` — sinon il
 *      contournerait `baseData` et rouvrirait la porte.
 *
 *   node scripts/check-profiles.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTEXTE = 'src/state/ProfilesContext.tsx';
const failures = [];
const source = fs.readFileSync(path.join(ROOT, CONTEXTE), 'utf-8');

/* ─── 1. baseData peut refuser ───────────────────────────────────────────── */

if (!/const baseData = useCallback\(\s*\(key: string\): ProfileData \| null =>/.test(source)) {
  failures.push(
    "`baseData` ne peut plus rendre `null`. C'est pourtant le seul moyen de " +
      "rendre l'effacement INEXPRIMABLE : tant qu'elle fabrique un repli " +
      "(`photoDataUrl: ''`) pour un enregistrement qu'elle n'a pas lu, n'importe " +
      "quel chemin d'écriture peut l'envoyer sur le serveur et effacer la photo.",
  );
}
if (!/const miroirFiable = ready && \(!configured \|\| !pullFailed\);/.test(source)) {
  failures.push(
    "`miroirFiable` a disparu ou a changé de forme. Les trois conditions " +
      "comptent : `ready` (la première lecture est finie), et — quand la " +
      "synchronisation est configurée — `!pullFailed` (elle a réussi). Un miroir " +
      "vide parce que la lecture a échoué n'est pas un miroir sans profils.",
  );
}

/* ─── 2. Chaque écriture refuse une base absente ─────────────────────────── */

/*
  On découpe le fichier PAR CHEMIN D'ÉCRITURE, et non sur une distance en
  caractères. Le premier jet regardait les 700 caractères précédant l'appel :
  une mutation qui retirait le refus de `markTeamSeen` passait alors, parce que
  le refus d'`updateSelf`, juste au-dessus, tombait dans la fenêtre. Un
  contrôle qui trouve le garde du voisin ne garde rien.

  Ici chaque `useCallback` / `useEffect` est un chemin : le refus doit se
  trouver dans LE MÊME.
*/
const chemins = source.split(/(?=use(?:Callback|Effect)\()/);
const ecritures = [];
for (const chemin of chemins) {
  for (const m of chemin.matchAll(/upsert\('profiles',/g)) {
    ecritures.push({ chemin, index: source.indexOf(chemin) + m.index });
  }
}
if (ecritures.length === 0) {
  failures.push(`${CONTEXTE} n'écrit plus aucun profil : contrôle sans objet, à relire.`);
}
for (const m of ecritures) {
  const refuse = /if \(!base\) return[^\n]*;/.test(m.chemin);
  const amorcage = /if \(miroirFiable && user && !records\.some/.test(m.chemin);
  if (!refuse && !amorcage) {
    const ligne = source.slice(0, m.index).split('\n').length;
    failures.push(
      `${CONTEXTE}:${ligne} — une écriture dans « profiles » n'est précédée ` +
        `d'aucun refus (« if (!base) return »). Si la base vient d'un repli, ` +
        `cette ligne efface la photo de quelqu'un, et le fera surtout sur une ` +
        `liaison lente — c'est exactement le défaut du Bloc 11.`,
    );
  }
}

/* ─── 3. Personne d'autre n'écrit dans cette collection ──────────────────── */

/*
  Les fichiers d'infrastructure sont admis : ils NOMMENT la collection dans une
  liste (collections synchronisées, sauvegarde, contrat d'API) sans écrire de
  profil. Ce qu'on traque est un `upsert`/`remove` visant `profiles` ailleurs
  que dans son contexte — un chemin qui contournerait `baseData`.
*/
const fichiers = [];
(function parcourir(dir) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) parcourir(rel);
    else if (/\.tsx?$/.test(e.name)) fichiers.push(rel);
  }
})('src');

for (const f of fichiers) {
  if (f === CONTEXTE) continue;
  const src = fs.readFileSync(path.join(ROOT, f), 'utf-8');
  if (/(upsert|remove)\(\s*'profiles'/.test(src)) {
    failures.push(
      `${f} écrit directement dans la collection « profiles ». Toute écriture ` +
        `doit passer par ProfilesContext (updateSelf / markTeamSeen), seul ` +
        `endroit qui refuse d'écrire sur une base qu'il n'a pas lue.`,
    );
  }
}

/* ─────────────────────────────── verdict ───────────────────────────────── */

if (failures.length > 0) {
  console.error('\nProfils : la photo est de nouveau à portée d’effacement.\n');
  for (const f of failures) console.error(`  ✗ ${f}\n`);
  process.exit(1);
}

console.log(
  `\nProfils : aucune écriture ne peut partir d'un repli.\n` +
    `  ${ecritures.length} écriture(s) dans « profiles », toutes gardées, toutes dans ${CONTEXTE}.`,
);
