#!/usr/bin/env node
/**
 * « CITÉS N FOIS » DOIT ÊTRE VRAI — la garde du plan des Paramètres
 * ════════════════════════════════════════════════════════════════
 *
 * Le plan des Paramètres (`26d`) annonce, pour la rubrique qui compte, un
 * nombre de modules qui lisent son réglage. Ce nombre vient de
 * `src/data/consequencesReglages.ts` — donc d'une liste, et une liste ment
 * dès qu'on déplace du code : un écran qui cesse de lire le réglage laisse
 * son nom derrière lui, et l'écran affiche un chiffre plus grand que la
 * réalité. Un compteur faux est pire qu'un compteur absent.
 *
 * Cette garde ouvre donc chaque fichier déclaré et vérifie qu'il contient le
 * `marqueur` du réglage. Elle ne prouve pas l'usage — elle prouve la
 * PRÉSENCE, ce qui suffit à empêcher le mensonge le plus courant : le lecteur
 * qui a disparu.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const source = fs.readFileSync(path.join(RACINE, 'src/data/consequencesReglages.ts'), 'utf8');

/* Le fichier est du TypeScript : on en extrait les entrées sans le compiler,
   parce qu'une garde qui demande un outil de plus finit par ne plus tourner. */
const entrees = [];
for (const bloc of source.split(/\n  \{\n/).slice(1)) {
  const rubrique = /rubrique: '([^']+)'/.exec(bloc)?.[1];
  const reglage = /reglage: '([^']+)'/.exec(bloc)?.[1];
  const marqueur = /marqueur: '([^']+)'/.exec(bloc)?.[1];
  if (!rubrique || !marqueur) continue;
  const lecteurs = [...bloc.matchAll(/\{ module: '([^']+)', fichier: '([^']+)' \}/g)].map((m) => ({
    module: m[1],
    fichier: m[2],
  }));
  entrees.push({ rubrique, reglage, marqueur, lecteurs });
}

if (entrees.length === 0) {
  console.error('ÉCHEC : aucune conséquence lue dans src/data/consequencesReglages.ts.');
  process.exit(1);
}

const fautes = [];
let comptes = 0;

for (const e of entrees) {
  if (e.lecteurs.length === 0) {
    fautes.push(`« ${e.reglage} » n'a aucun lecteur : une rubrique sans conséquence ne doit pas figurer ici.`);
    continue;
  }
  const vus = new Set();
  for (const l of e.lecteurs) {
    const abs = path.join(RACINE, l.fichier);
    if (!fs.existsSync(abs)) {
      fautes.push(`« ${e.reglage} » cite ${l.fichier}, qui n'existe plus.`);
      continue;
    }
    if (!fs.readFileSync(abs, 'utf8').includes(e.marqueur)) {
      fautes.push(
        `« ${e.reglage} » compte ${l.fichier} parmi ses lecteurs, mais ce fichier ne contient plus ` +
          `« ${e.marqueur} » : le plan des Paramètres annoncerait un module de trop.`,
      );
      continue;
    }
    if (vus.has(l.module)) {
      fautes.push(`« ${e.reglage} » compte le module « ${l.module} » deux fois.`);
      continue;
    }
    vus.add(l.module);
    comptes += 1;
  }
}

if (fautes.length > 0) {
  console.error('\nConséquences des réglages : le compte affiché serait faux.\n');
  for (const f of fautes) console.error(`  ✗ ${f}`);
  console.error('');
  process.exit(1);
}

console.log(
  `\nOK — ${entrees.length} réglage(s) à conséquence, ${comptes} lecteur(s) vérifié(s) fichier par fichier.`,
);
