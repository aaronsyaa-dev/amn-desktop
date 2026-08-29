/**
 * Contrôle de la BARRE LATÉRALE — ce qui décide qu'elle est dépliée.
 *
 * REMONTÉ EN TESTANT : « l'étouffoir et les règles mises en sourdine sont
 * introuvables dans l'interface ». Ils ne l'étaient pas : ils existent et
 * fonctionnent. Ce qui manquait était le CHEMIN.
 *
 * Cinq modules vivent dans la Tour de contrôle — Supervision, Sites, Trackers,
 * Scanner, Comply, c'est-à-dire tout le métier de cybersécurité — et on y
 * bascule par un sélecteur en tête de barre latérale. MESURÉ à 1 280, 1 400 et
 * 1 920 px : la barre était repliée dans les trois cas, le sélecteur réduit à
 * une icône de 47 × 44 px, et les mots « Poste de travail » / « Tour de
 * contrôle » n'apparaissaient nulle part à l'écran.
 *
 *   npm run check:barre
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

const { deplierAuDemarrage, lireChoix, SEUIL_DEPLIAGE_PX } = await loadFromSrc<{
  deplierAuDemarrage: (largeur: number, choix: boolean | null) => boolean;
  lireChoix: (brut: string | null) => boolean | null;
  SEUIL_DEPLIAGE_PX: number;
}>('src/lib/barreLaterale.ts');

let vus = 0;
const dit = (nom: string, fn: () => void) => {
  fn();
  vus += 1;
  console.log(`  ✓ ${nom}`);
};

console.log('\nContrôle de la barre latérale\n');

dit('LE DÉFAUT : sur un grand écran, elle est DÉPLIÉE', () => {
  /*
    C'est la correction elle-même. Repliée, le sélecteur d'espace n'est plus
    qu'une icône muette, et les cinq modules de la Tour de contrôle deviennent
    introuvables — ce qui a été remonté en testant.
  */
  assert.equal(deplierAuDemarrage(1920, null), true);
  assert.equal(deplierAuDemarrage(1400, null), true);
  assert.equal(deplierAuDemarrage(1280, null), true);
});

dit('sur une fenêtre étroite, elle reste repliée', () => {
  // 224 px de barre sur 900 px de fenêtre mangeraient le contenu.
  assert.equal(deplierAuDemarrage(900, null), false);
  assert.equal(deplierAuDemarrage(SEUIL_DEPLIAGE_PX - 1, null), false);
});

dit('le seuil lui-même déplie', () => {
  assert.equal(deplierAuDemarrage(SEUIL_DEPLIAGE_PX, null), true);
});

dit('LA RÈGLE : un choix explicite gagne sur la largeur, dans les DEUX sens', () => {
  /*
    Replier sur un grand écran doit tenir — sinon le réglage n'en est pas un.
    Et déplier sur un petit écran doit tenir aussi : c'est le cas de quelqu'un
    qui préfère voir les libellés quitte à serrer le contenu, et lui refuser ce
    choix serait décider à sa place.
  */
  assert.equal(deplierAuDemarrage(1920, false), false, 'replié sur grand écran : ça tient');
  assert.equal(deplierAuDemarrage(800, true), true, 'déplié sur petit écran : ça tient aussi');
});

dit('un choix illisible retombe sur la largeur, jamais sur « replié »', () => {
  /*
    Stockage refusé en navigation privée, valeur abîmée, clé d'une version
    antérieure. Retomber sur « replié » ramènerait exactement le défaut d'origine
    — et sans bruit, sur les seuls appareils où le stockage ne marche pas.
  */
  for (const brut of [null, '', 'oui', '1', 'TRUE', '{}']) {
    assert.equal(lireChoix(brut), null, `« ${brut} » ne dit ni oui ni non`);
    assert.equal(deplierAuDemarrage(1920, lireChoix(brut)), true, `« ${brut} » sur grand écran`);
  }
});

dit('et un choix lisible est lu tel quel', () => {
  assert.equal(lireChoix('true'), true);
  assert.equal(lireChoix('false'), false);
});

console.log(`\nOK — ${vus} contrôles.\n`);
