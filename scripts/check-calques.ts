/**
 * Contrôle de la PILE DES CALQUES — un appui d'Échap, un calque.
 *
 * `check:clavier` vérifie que chaque calque APPELLE le hook. Il ne peut rien
 * dire de ce que le hook FAIT : « seul le calque du dessus répond » est une
 * propriété d'exécution, et elle a survécu telle quelle à une mutation du
 * garde-fou statique — la pile désactivée, il restait vert.
 *
 * C'est pour ça que la règle vit dans un module sans React, et que ce contrôle
 * l'exerce directement.
 *
 * ## Ce qu'il tient
 *
 * Deux calques peuvent se superposer : un panneau, et par-dessus la
 * confirmation d'un geste irréversible. Si les deux répondent au même appui,
 * la confirmation disparaît ET le panneau derrière aussi — on perd son travail
 * pour avoir voulu annuler une confirmation.
 *
 *   npm run check:calques
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

const { inscrireCalque, fermerLeSommet, calquesOuverts, viderLaPile } = await loadFromSrc<{
  inscrireCalque: (fermer: () => void) => () => void;
  fermerLeSommet: () => boolean;
  calquesOuverts: () => number;
  viderLaPile: () => void;
}>('src/lib/pileCalques.ts');

let vus = 0;
const dit = (nom: string, fn: () => void) => {
  viderLaPile();
  fn();
  vus += 1;
  console.log(`  ✓ ${nom}`);
};

console.log('\nContrôle de la pile des calques\n');

dit('sans calque ouvert, Échap ne consomme rien', () => {
  assert.equal(calquesOuverts(), 0);
  // `false` permet à l'appelant de laisser la touche passer : sinon Échap
  // serait avalé en permanence, y compris quand il devrait servir ailleurs.
  assert.equal(fermerLeSommet(), false);
});

dit('LA RÈGLE : seul le calque du dessus se ferme', () => {
  const vus: string[] = [];
  inscrireCalque(() => vus.push('panneau'));
  inscrireCalque(() => vus.push('confirmation'));

  assert.equal(fermerLeSommet(), true);
  assert.deepEqual(vus, ['confirmation'], 'le panneau derrière ne doit PAS partir avec');
});

dit('et les suivants viennent dans l’ordre inverse de l’ouverture', () => {
  const vus: string[] = [];
  const retirerA = inscrireCalque(() => vus.push('A'));
  const retirerB = inscrireCalque(() => vus.push('B'));
  const retirerC = inscrireCalque(() => vus.push('C'));

  // Chaque calque se retire lui-même en se fermant, comme le fait React au
  // démontage. Sans ce retrait, le même répondrait indéfiniment.
  fermerLeSommet();
  retirerC();
  fermerLeSommet();
  retirerB();
  fermerLeSommet();
  retirerA();

  assert.deepEqual(vus, ['C', 'B', 'A']);
  assert.equal(calquesOuverts(), 0);
});

dit('un calque retiré ne répond plus, et rend la parole à celui du dessous', () => {
  const vus: string[] = [];
  inscrireCalque(() => vus.push('dessous'));
  const retirerDessus = inscrireCalque(() => vus.push('dessus'));

  retirerDessus();
  fermerLeSommet();
  assert.deepEqual(vus, ['dessous'], 'c’est maintenant celui du dessous qui répond');
});

dit('DEUX CALQUES QUI PARTAGENT LA MÊME FERMETURE se dépilent un par un', () => {
  /*
    Deux fiches ouvertes depuis le même composant passent la même fonction de
    fermeture. Ce qui compte est que la pile les COMPTE séparément : un
    retrait ne doit en enlever qu'une, et la seconde doit continuer de
    répondre.

    (Le premier commentaire disait qu'`indexOf` « retirerait le mauvais ».
    C'était faux : deux entrées identiques sont interchangeables. Vérifié en
    mutant — la mutation passait, et c'est l'affirmation qui était de trop.)
  */
  let appels = 0;
  const fermer = () => {
    appels += 1;
  };
  const retirer1 = inscrireCalque(fermer);
  const retirer2 = inscrireCalque(fermer);
  assert.equal(calquesOuverts(), 2);

  retirer2();
  assert.equal(calquesOuverts(), 1, 'il en reste un');
  assert.equal(fermerLeSommet(), true, 'et il répond encore');
  assert.equal(appels, 1);

  retirer1();
  assert.equal(calquesOuverts(), 0);
});

dit('un retrait rejoué n’emporte pas la RÉ-inscription du même calque', () => {
  /*
    React peut appeler deux fois le nettoyage d'un effet — mode strict,
    remontage à chaud, `ouvert` qui repasse à vrai. Le cas qui casse est
    celui-ci : le calque se referme, se rouvre, et le VIEUX retrait arrive
    après coup. Sans garde, il dépile la nouvelle inscription, et Échap ne
    ferme plus un calque pourtant bien ouvert.

    Premier jet de ce contrôle : il rejouait le retrait sur une pile où le
    calque n'était plus présent du tout — `lastIndexOf` rendait -1, rien ne
    se passait, et la mutation qui retire la garde passait au vert. Le test
    ne touchait pas le cas qu'il prétendait couvrir.
  */
  let fermetures = 0;
  const fermer = () => {
    fermetures += 1;
  };

  const retirerAncien = inscrireCalque(fermer);
  retirerAncien();
  assert.equal(calquesOuverts(), 0);

  inscrireCalque(fermer); // le même calque, rouvert
  assert.equal(calquesOuverts(), 1);

  retirerAncien(); // le nettoyage de l'ancien montage, rejoué trop tard
  assert.equal(calquesOuverts(), 1, 'la ré-inscription doit survivre');

  assert.equal(fermerLeSommet(), true, 'et répondre encore à Échap');
  assert.equal(fermetures, 1);
});

dit('la fermeture lue est la DERNIÈRE fournie, pas celle de l’inscription', () => {
  /*
    Le hook inscrit `() => dernier.current()` une seule fois, et laisse la
    référence suivre les rendus. Ce contrôle vérifie que le motif tient : ce
    qui s'exécute est bien la version courante.
  */
  let cible = 'ancienne';
  const boite = { fermer: () => (cible = 'ancienne') };
  inscrireCalque(() => boite.fermer());

  boite.fermer = () => (cible = 'courante');
  fermerLeSommet();
  assert.equal(cible, 'courante');
});

console.log(`\nOK — ${vus} contrôles.\n`);
