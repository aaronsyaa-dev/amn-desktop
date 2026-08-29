/**
 * Contrôle de la DISPOSITION DU GRAPHE — ce qu'un dessin doit garantir.
 *
 * Une disposition force-dirigée ne se vérifie pas au pixel : ce qu'on peut
 * affirmer, ce sont ses PROPRIÉTÉS. Elles tiennent en quatre phrases, et
 * chacune correspond à une façon dont un graphe devient illisible :
 *
 *   · le même carnet donne toujours le même dessin (sinon on perd ses repères
 *     à chaque ouverture) ;
 *   · tout tient dans le cadre (sinon des notes sont hors de vue) ;
 *   · deux notes qui se citent finissent plus proches que deux qui s'ignorent
 *     (sinon le dessin ne dit rien) ;
 *   · rien ne se superpose exactement (sinon deux notes n'en font qu'une à
 *     l'œil).
 *
 *   npm run check:graphe
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

interface Place {
  id: string;
  x: number;
  y: number;
  degre: number;
}

const { disposer, rayon } = await loadFromSrc<{
  disposer: (
    noeuds: ReadonlyArray<{ id: string }>,
    arcs: ReadonlyArray<{ de: string; vers: string }>,
    tours?: number,
  ) => Place[];
  rayon: (degre: number, base?: number, max?: number) => number;
}>('src/lib/notesGraphe.ts');

let vus = 0;
const dit = (nom: string, fn: () => void) => {
  fn();
  vus += 1;
  console.log(`  ✓ ${nom}`);
};

const noeuds = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `n${i}` }));
const dist = (a: Place, b: Place) => Math.hypot(a.x - b.x, a.y - b.y);
const par = (p: Place[]) => new Map(p.map((x) => [x.id, x]));

console.log('\nContrôle de la disposition du graphe\n');

dit('un carnet vide ne dessine rien, sans planter', () => {
  assert.deepEqual(disposer([], []), []);
});

dit('une note seule est au centre', () => {
  const [p] = disposer(noeuds(1), []);
  assert.deepEqual([p.x, p.y], [0.5, 0.5]);
});

dit('LA RÈGLE : le même carnet donne toujours le même dessin', () => {
  /*
    Aucun aléatoire nulle part. Un placement aléatoire redessinerait tout à
    chaque ouverture, et il faudrait relire le graphe entier pour retrouver la
    note qu'on cherchait la veille.
  */
  const a = disposer(noeuds(12), [
    { de: 'n0', vers: 'n1' },
    { de: 'n1', vers: 'n2' },
    { de: 'n5', vers: 'n7' },
  ]);
  const b = disposer(noeuds(12), [
    { de: 'n0', vers: 'n1' },
    { de: 'n1', vers: 'n2' },
    { de: 'n5', vers: 'n7' },
  ]);
  assert.deepEqual(a, b);
});

dit('LA RÈGLE : tout tient dans le cadre, marges comprises', () => {
  // Un nœud hors du cadre est une note qu'on ne verra jamais.
  for (const n of [2, 5, 30, 80]) {
    const arcs = Array.from({ length: n - 1 }, (_, i) => ({ de: `n${i}`, vers: `n${i + 1}` }));
    for (const p of disposer(noeuds(n), arcs)) {
      assert.ok(p.x >= 0 && p.x <= 1, `x hors cadre à ${n} nœuds : ${p.x}`);
      assert.ok(p.y >= 0 && p.y <= 1, `y hors cadre à ${n} nœuds : ${p.y}`);
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), 'ni NaN ni infini');
    }
  }
});

dit('LA RÈGLE : ce qui se cite se RAPPROCHE, même parti d’en face', () => {
  /*
    C'est la seule chose que le dessin doit DIRE. Sans elle, on regarde une
    constellation qui n'apprend rien.

    LE PIÈGE, ET IL M'A EU. Premier jet : deux grappes n0-n1-n2 et n3-n4-n5.
    Elles sont VOISINES sur le cercle de départ, donc « les liées sont plus
    proches » était déjà vrai avant la moindre simulation — mesuré sans aucun
    lien : 0,492 contre 0,793. Le contrôle passait, et la mutation qui coupe
    la force des liens passait avec lui.

    On relie donc des nœuds OPPOSÉS sur le cercle, et on compare au même
    carnet sans liens. Ce qui est affirmé n'est plus « ils sont proches » —
    ce que le hasard du placement peut offrir — mais « le lien les a
    RAPPROCHÉS », ce que seule la force peut faire.
  */
  const arcs = [
    { de: 'n0', vers: 'n3' },
    { de: 'n3', vers: 'n6' },
    { de: 'n1', vers: 'n4' },
    { de: 'n4', vers: 'n7' },
  ];
  const avec = par(disposer(noeuds(8), arcs));
  const sans = par(disposer(noeuds(8), []));

  const lies = dist(avec.get('n0')!, avec.get('n3')!);
  const liesSansLien = dist(sans.get('n0')!, sans.get('n3')!);
  assert.ok(
    lies < liesSansLien * 0.6,
    `n0 et n3 doivent se rapprocher nettement : ${liesSansLien.toFixed(3)} → ${lies.toFixed(3)}`,
  );

  // Et ils finissent plus proches que des voisins de cercle qui ne se citent pas.
  const etrangers = dist(avec.get('n0')!, avec.get('n2')!);
  assert.ok(lies < etrangers, `liés ${lies.toFixed(3)} vs étrangers ${etrangers.toFixed(3)}`);
});

dit('LA RÈGLE : deux notes ne se superposent jamais exactement', () => {
  // Superposées, elles n'en font qu'une à l'œil, et l'une des deux est
  // inatteignable à la souris.
  const p = disposer(noeuds(25), []);
  for (let i = 0; i < p.length; i += 1) {
    for (let j = i + 1; j < p.length; j += 1) {
      assert.ok(dist(p[i], p[j]) > 1e-6, `${p[i].id} et ${p[j].id} superposés`);
    }
  }
});

dit('un carnet sans aucun lien reste dans le cadre, sans partir à l’infini', () => {
  /*
    C'est ce que fait le rappel vers le centre. Sans lui, la répulsion seule
    pousse indéfiniment des nœuds que rien ne retient.
  */
  for (const p of disposer(noeuds(20), [])) {
    assert.ok(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
  }
});

dit('le degré compte les liens des deux sens', () => {
  const p = par(
    disposer(noeuds(3), [
      { de: 'n0', vers: 'n1' },
      { de: 'n2', vers: 'n1' },
    ]),
  );
  assert.equal(p.get('n1')!.degre, 2, 'n1 est cité deux fois');
  assert.equal(p.get('n0')!.degre, 1);
});

dit('un arc vers une note absente du carnet est ignoré', () => {
  // Il arrive : un lien résolu, puis la note supprimée. Le dessin ne doit pas
  // s'en trouver faussé, ni planter.
  const p = disposer(noeuds(2), [{ de: 'n0', vers: 'inconnue' }]);
  assert.equal(p.length, 2);
  assert.equal(p[0].degre, 0);
});

/* ─── La taille d’un nœud ──────────────────────────────────────────────────── */

dit('un nœud très cité est plus gros, mais pas dix fois plus', () => {
  /*
    La progression est en racine carrée : dix liens ne doivent pas faire un
    disque dix fois plus large, ce serait le seul objet visible de la carte.
  */
  assert.ok(rayon(10) > rayon(1));
  assert.ok(rayon(10) < rayon(1) * 3, 'la croissance reste tempérée');
  assert.equal(rayon(1000), rayon(1000, 5, 16), 'et elle est plafonnée');
  assert.ok(rayon(1000) <= 16);
});

console.log(`\nOK — ${vus} contrôles.\n`);
