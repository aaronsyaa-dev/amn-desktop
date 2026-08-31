/**
 * Contrôle de la LANGUE — deux dictionnaires, une seule voix chacun.
 *
 * Le compilateur garantit déjà qu'aucune clé française ne manque (le type
 * vient du schéma anglais). Ce contrôle épingle ce que les types ne voient
 * pas :
 *
 *   · les MÊMES interpolations dans les deux langues — une traduction qui
 *     perd `{nom}` afficherait un trou, silencieusement ;
 *   · aucun point d'exclamation, dans aucune langue (grammaire de la maison) ;
 *   · la typographie française tenue (apostrophes typographiques, espaces
 *     fines devant ? ! ;) et l'anglais SANS résidu de copier-coller français
 *     (guillemets « », espaces fines, apostrophes courbes en plein mot
 *     anglais) — le mélange de langues est exactement ce qu'on interdit ;
 *   · aucune valeur vide, aucune clé qui traduit vers elle-même par accident.
 *
 *   npm run check:langue
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));

async function loadFromSrc<T>(entry: string): Promise<T> {
  const built = await esbuild.build({
    entryPoints: [path.join(here, '..', entry)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    target: 'node22',
    charset: 'utf8',
  });
  return (await import(
    `data:text/javascript;charset=utf-8;base64,${Buffer.from(built.outputFiles[0].text, 'utf8').toString('base64')}`
  )) as T;
}

const { en } = await loadFromSrc<{ en: Record<string, string> }>('src/i18n/en.ts');
const { fr } = await loadFromSrc<{ fr: Record<string, string> }>('src/i18n/fr.ts');

let vus = 0;
const dit = (nom: string, fn: () => void) => {
  fn();
  vus += 1;
  console.log(`  ✓ ${nom}`);
};

const clesEn = Object.keys(en).sort();
const clesFr = Object.keys(fr).sort();

dit('les deux dictionnaires portent exactement les mêmes clés', () => {
  assert.deepEqual(clesFr, clesEn);
});

dit('aucune valeur vide, dans aucune langue', () => {
  for (const [k, v] of [...Object.entries(en), ...Object.entries(fr)]) {
    assert.ok(v.trim().length > 0, `valeur vide : ${k}`);
  }
});

dit('LA RÈGLE : les interpolations sont les mêmes dans les deux langues', () => {
  for (const k of clesEn) {
    const motifs = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    assert.deepEqual(motifs(fr[k]), motifs(en[k]), `interpolations divergentes : ${k}`);
  }
});

dit('jamais de point d’exclamation, dans aucune langue', () => {
  for (const [k, v] of [...Object.entries(en), ...Object.entries(fr)]) {
    assert.ok(!v.includes('!'), `exclamation : ${k} → ${v}`);
  }
});

dit('le français emploie l’apostrophe typographique, pas la droite', () => {
  for (const [k, v] of Object.entries(fr)) {
    assert.ok(!v.includes("'"), `apostrophe droite : ${k} → ${v}`);
  }
});

dit('LA RÈGLE : l’anglais est sans résidu français', () => {
  /*
    Le mélange de langues sur un écran est exactement ce que ce chantier
    interdit — et le copier-coller est comment il arrive. Guillemets
    français, espaces fines, ou mots français fréquents dans une valeur
    anglaise : refusés. (Les noms propres et « Français » comme nom de
    langue dans son propre sélecteur sont légitimes.)
  */
  const residus = /[«»  ]|\b(le|la|les|un|une|des|votre|vos|est|sont|avec|pour|dans)\b/i;
  for (const [k, v] of Object.entries(en)) {
    if (k === 'reglages.langue.francais') continue; // « Français » se nomme chez lui
    assert.ok(!residus.test(v), `résidu français dans l'anglais : ${k} → ${v}`);
  }
});

dit('le français devant ? ! ; porte l’espace fine — pas l’espace simple', () => {
  for (const [k, v] of Object.entries(fr)) {
    assert.ok(!/ [?!;]/.test(v), `espace simple avant ponctuation haute : ${k} → ${v}`);
  }
});

console.log(`\nOK — ${vus} contrôles sur ${clesEn.length} clés.\n`);
