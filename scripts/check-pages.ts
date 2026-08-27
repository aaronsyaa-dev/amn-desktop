/**
 * Contrôle du moteur de pages (BLOC 3).
 *
 * Une page est un document PARTAGÉ, écrit à plusieurs, qui voyage par la
 * synchronisation entre des postes qui ne portent pas forcément la même
 * version. Trois familles de défauts n'y font pas de bruit — elles effacent :
 *
 *   1. un tableau dont les lignes ne suivent pas les colonnes : la cellule
 *      manquante s'affiche vide, ce qui se lit comme une donnée absente et non
 *      comme un défaut ;
 *   2. une page que plus personne ne peut modifier, parce que la liste des
 *      rôles éditeurs a été enregistrée vide ;
 *   3. un bloc d'un type inconnu (venu d'une version plus récente) jeté à la
 *      lecture : ouvrir la page sur un poste en retard effacerait alors du
 *      contenu chez tout le monde.
 *
 *   npm run check:pages
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

interface Moteur {
  normalizePage(raw: unknown): any;
  normalizeRoles(roles: unknown): string[];
  canEditPage(role: string | null | undefined, page: any): boolean;
  moveBlock(blocks: any[], index: number, direction: -1 | 1): any[];
  emptyBlock(type: string): any;
  addColumn(bloc: any, nom: string): any;
  removeColumn(bloc: any, index: number): any;
  PAGE_TEMPLATES: { id: string; label: string; build: () => any }[];
}

const M = await loadFromSrc<Moteur>('src/lib/pageBlocks.ts');

const failures: string[] = [];
function check(name: string, run: () => void) {
  try {
    run();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push(name);
    console.error(`  ÉCHEC ${name}`);
    console.error(`         ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
  }
}

console.log('Moteur de pages — ce qui ne doit jamais effacer de contenu\n');

check('un tableau reçu de travers est remis d’équerre, ligne par ligne', () => {
  const page = M.normalizePage({
    title: 'T',
    blocks: [{ id: 'b1', type: 'table', columns: ['A', 'B', 'C'], rows: [['1'], ['1', '2', '3', '4'], []] }],
  });
  for (const ligne of page.blocks[0].rows) {
    assert.equal(ligne.length, 3, `ligne de ${ligne.length} cellules pour 3 colonnes`);
    for (const c of ligne) assert.equal(typeof c, 'string', 'une cellule vide doit être "" et non undefined');
  }
  // Ce qui était saisi est conservé, pas écrasé.
  assert.equal(page.blocks[0].rows[0][0], '1');
  assert.equal(page.blocks[0].rows[1][2], '3');
});

check('ajouter une colonne n’abîme pas les lignes déjà saisies', () => {
  const bloc = { id: 'b', type: 'table', columns: ['A', 'B'], rows: [['x', 'y'], ['z', 'w']] };
  const apres = M.addColumn(bloc, 'C');
  assert.deepEqual(apres.columns, ['A', 'B', 'C']);
  for (const l of apres.rows) assert.equal(l.length, 3);
  assert.deepEqual(apres.rows[0], ['x', 'y', '']);
  assert.deepEqual(apres.rows[1], ['z', 'w', '']);
});

check('retirer une colonne retire la bonne cellule de chaque ligne', () => {
  const bloc = { id: 'b', type: 'table', columns: ['A', 'B', 'C'], rows: [['x', 'y', 'z']] };
  const apres = M.removeColumn(bloc, 1);
  assert.deepEqual(apres.columns, ['A', 'C']);
  assert.deepEqual(apres.rows[0], ['x', 'z'], 'c’est la colonne B qui part, pas la dernière');
});

check('un tableau ne peut pas tomber à zéro colonne', () => {
  const bloc = { id: 'b', type: 'table', columns: ['A'], rows: [['x']] };
  assert.deepEqual(M.removeColumn(bloc, 0).columns, ['A'], 'un tableau sans colonne n’est plus un tableau');
});

check('une page ne peut jamais devenir immodifiable par tout le monde', () => {
  for (const roles of [[], null, undefined, ['inconnu'], ['member']] as unknown[]) {
    const r = M.normalizeRoles(roles);
    assert.ok(r.includes('owner'), `roles=${JSON.stringify(roles)} → ${JSON.stringify(r)} sans owner`);
  }
  assert.equal(M.canEditPage('owner', M.normalizePage({ editorRoles: [] })), true);
});

check('un rôle non listé ne modifie pas, et l’absence de rôle non plus', () => {
  const page = M.normalizePage({ editorRoles: ['owner', 'admin'] });
  assert.equal(M.canEditPage('member', page), false);
  assert.equal(M.canEditPage(null, page), false);
  assert.equal(M.canEditPage(undefined, page), false);
  assert.equal(M.canEditPage('admin', page), true);
});

check('un bloc d’un type inconnu est CONSERVÉ, pas jeté', () => {
  const page = M.normalizePage({ blocks: [{ id: 'x', type: 'futur', charge: 'utile' }] });
  assert.equal(page.blocks.length, 1, 'un poste en retard effacerait le contenu de tout le monde');
  assert.equal(page.blocks[0].type, 'futur');
  assert.equal(page.blocks[0].charge, 'utile', 'la charge du bloc doit survivre intacte');
});

check('déplacer un bloc hors du document ne réordonne rien', () => {
  const b = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(M.moveBlock(b, 0, -1), b, 'monter le premier ne doit rien faire');
  assert.deepEqual(M.moveBlock(b, 2, 1), b, 'descendre le dernier ne doit rien faire');
  assert.deepEqual(M.moveBlock(b, 5, 1), b);
});

check('déplacer un bloc conserve exactement les mêmes blocs', () => {
  const b = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const apres = M.moveBlock(b, 0, 1);
  assert.deepEqual(apres.map((x: any) => x.id), ['b', 'a', 'c']);
  assert.equal(apres.length, b.length, 'aucun bloc ne disparaît ni ne se duplique');
});

check('une checklist reçue de travers ne rend pas de cases indéfinies', () => {
  const page = M.normalizePage({ blocks: [{ id: 'c', type: 'checklist', items: [{ text: 'a' }, null] }] });
  for (const it of page.blocks[0].items) {
    assert.equal(typeof it.id, 'string');
    assert.equal(typeof it.text, 'string');
    assert.equal(typeof it.done, 'boolean');
  }
});

check('les gabarits produisent des pages déjà valides', () => {
  assert.ok(M.PAGE_TEMPLATES.length >= 3, 'au moins fiche de production, brief et page d’équipe');
  for (const t of M.PAGE_TEMPLATES) {
    const page = M.normalizePage({ ...t.build(), editorRoles: ['owner'] });
    assert.ok(page.title.trim().length > 0, `${t.id} : titre vide`);
    assert.ok(page.blocks.length > 0, `${t.id} : aucun bloc`);
    for (const bloc of page.blocks) {
      if (bloc.type !== 'table') continue;
      for (const l of bloc.rows) {
        assert.equal(l.length, bloc.columns.length, `${t.id} : tableau de travers dans le gabarit`);
      }
    }
  }
});

check('un titre vide ou absent ne rend pas une page anonyme', () => {
  assert.equal(M.normalizePage({}).title, 'Sans titre');
  assert.equal(M.normalizePage({ title: '   ' }).title, 'Sans titre');
});

if (failures.length > 0) {
  console.error(`\n${failures.length} contrôle(s) en échec :`);
  for (const n of failures) console.error(`  - ${n}`);
  process.exit(1);
}
console.log('\nMoteur de pages : tous les contrôles passent.');
