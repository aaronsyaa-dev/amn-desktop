#!/usr/bin/env node
/**
 * ON SORT TOUJOURS DE LA VEILLE — `npm run check:veille`.
 *
 * Le 5 septembre 2026, l'application installée s'est rouverte SUR la Salle de
 * contrôle et n'en est plus sortie : la mémoire d'onglet (`amn.lastTab`) avait
 * retenu `/salle`, l'avait restaurée au démarrage sans page derrière, et la
 * Salle ne sortait que par `navigate(-1)`. Reproduit sur l'application
 * empaquetée (scripts/sondes/veille-electron.mjs), corrigé dans
 * src/lib/memoireOnglet.ts. Ce garde, statique, empêche le retour de chacune
 * des trois conditions :
 *
 *   1. tout écran plein écran (`fixed inset-0` posé par une route) est dans
 *      ROUTES_SANS_MEMOIRE ;
 *   2. chaque mise en page qui mémorise le dernier onglet passe par
 *      `ongletMemorise` (lecture) et `routeMemorisable` (écriture) ;
 *   3. aucun écran plein écran ne sort par un `navigate(-1)` nu — il passe par
 *      `sortirDuPleinEcran`, qui ramène au poste quand il n'y a rien derrière.
 */
import fs from 'node:fs';
import path from 'node:path';

const fautes = [];
const lire = (f) => fs.readFileSync(path.resolve(f), 'utf8');
const src = (f) => lire(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// 1. Les routes plein écran, lues dans les tables de routes, et la liste sans mémoire.
const memoire = lire('src/lib/memoireOnglet.ts');
const sansMemoire = [...memoire.matchAll(/'(\/[a-z-]+)'/g)].map((m) => m[1]);
const routesPleinEcran = [];
for (const table of ['src/edition/appRoot.internal.tsx', 'src/edition/appRoot.business.tsx']) {
  if (!fs.existsSync(table)) continue;
  const t = lire(table);
  for (const m of t.matchAll(/<Route path="(\/[a-z-]+)" element=\{<(\w+)/g)) {
    const [, route, composant] = m;
    const fichier = ['src/screens', 'src/business', 'src/screens/garde'].map((d) => path.join(d, `${composant}.tsx`)).find((f) => fs.existsSync(f));
    if (!fichier) continue;
    const code = src(fichier);
    // Un écran plein écran est un écran dont la RACINE couvre tout : le premier `return (` du composant exporté
    // ouvre un `<div className="fixed inset-0`. Une fenêtre modale rendue par un sous-composant ne compte pas.
    const debut = code.indexOf(`export function ${composant}(`);
    if (debut < 0) continue;
    const fin = code.indexOf('\n}', debut);
    const corps = code.slice(debut, fin < 0 ? undefined : fin);
    if (/return \(\s*<div className="fixed inset-0/.test(corps)) routesPleinEcran.push({ route, composant, fichier });
  }
}
if (routesPleinEcran.length === 0) fautes.push('aucun écran plein écran trouvé dans les tables de routes : le garde ne voit plus rien (la Salle a-t-elle changé de forme ?)');
for (const e of routesPleinEcran) {
  if (!sansMemoire.includes(e.route)) fautes.push(`${e.route} (${e.composant}) est un écran plein écran absent de ROUTES_SANS_MEMOIRE : l’app pourrait se rouvrir dessus`);
  const code = src(e.fichier);
  if (/navigate\(-1\)/.test(code)) fautes.push(`${e.fichier} sort par navigate(-1) : sans page derrière, on n’en sort plus — passer par sortirDuPleinEcran`);
  if (!/sortirDuPleinEcran/.test(code)) fautes.push(`${e.fichier} ne passe pas par sortirDuPleinEcran`);
}

// 2. Les mises en page qui mémorisent le dernier onglet.
for (const f of ['src/components/AppLayout.tsx', 'src/business/BusinessLayout.tsx']) {
  const code = src(f);
  if (!/lastTab|LAST_TAB_KEY/.test(code)) continue;
  if (!/ongletMemorise\(/.test(code)) fautes.push(`${f} restaure le dernier onglet sans passer par ongletMemorise`);
  if (!/routeMemorisable\(/.test(code)) fautes.push(`${f} écrit le dernier onglet sans passer par routeMemorisable`);
}

if (fautes.length) {
  console.error(`check:veille — ${fautes.length} manquement(s) :`);
  for (const x of fautes) console.error(`  · ${x}`);
  process.exit(1);
}
console.log(`check:veille — ${routesPleinEcran.map((e) => e.route).join(', ')} : jamais mémorisé au démarrage, sortie qui ramène au poste ; ${sansMemoire.length} route(s) sans mémoire.`);
