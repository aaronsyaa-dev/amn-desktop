/**
 * Contrôle de la suppression de message (BLOC 10).
 *
 * Supprimer, dans un fil partagé, retire du texte de l'écran de quelqu'un
 * d'autre. Deux défauts symétriques sont possibles, et aucun des deux ne fait
 * de bruit :
 *
 *   1. trop permissif — un compte quelconque efface le message d'un collègue,
 *      ou la réponse d'Ajmani qu'un autre vient de demander ;
 *   2. trop restrictif — une installation locale, sans session distante, rend
 *      un rôle `null` et l'auteure ne peut alors plus retirer sa propre
 *      bévue.
 *
 *   npm run check:messages
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

interface Regles {
  isOwnMessage(email: string | null | undefined, m: { authorEmail: string }): boolean;
  canModerateMessages(role: string | null | undefined): boolean;
  canDeleteMessage(
    role: string | null | undefined,
    email: string | null | undefined,
    m: { authorEmail: string },
  ): boolean;
  deleteMessageLabel(email: string | null | undefined, m: { authorEmail: string }): string;
}

const R = await loadFromSrc<Regles>('src/lib/messageRules.ts');

const AARON = 'aaron@amn-devsec.com';
const MOHAMED = 'mohamed@amn-devsec.com';
const AJMANI = 'ajmani@amn-devsec.com';

const deAaron = { authorEmail: AARON };
const deMohamed = { authorEmail: MOHAMED };
const dAjmani = { authorEmail: AJMANI };

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

console.log('Suppression de message — qui a le droit, et qui ne l’a pas\n');

check('on retire toujours son propre message, même sans rôle connu', () => {
  // Le cas réel : installation locale, aucune session distante, `role` null.
  // Sans cette garantie, l'auteure ne pourrait plus corriger sa propre bévue.
  assert.equal(R.canDeleteMessage(null, AARON, deAaron), true);
  assert.equal(R.canDeleteMessage(undefined, AARON, deAaron), true);
  assert.equal(R.canDeleteMessage('guest', AARON, deAaron), true);
  assert.equal(R.canDeleteMessage('member', AARON, deAaron), true);
});

check('un membre ne touche pas au message d’un autre', () => {
  assert.equal(R.canDeleteMessage('member', AARON, deMohamed), false);
  assert.equal(R.canDeleteMessage('guest', AARON, deMohamed), false);
  assert.equal(R.canDeleteMessage(null, AARON, deMohamed), false);
});

check('owner et admin modèrent, personne d’autre', () => {
  assert.equal(R.canModerateMessages('owner'), true);
  assert.equal(R.canModerateMessages('admin'), true);
  for (const r of ['member', 'guest', '', null, undefined, 'OWNER', 'administrateur']) {
    assert.equal(R.canModerateMessages(r as string), false, `« ${String(r)} » ne doit pas modérer`);
  }
});

check('la réponse d’Ajmani n’appartient à personne : modération seule', () => {
  /*
    Ajmani répond sous une adresse réservée. Si elle comptait comme « son
    propre message » pour le compte qui porte cette adresse — ou pour
    n'importe qui par comparaison hâtive — un membre pourrait effacer
    l'analyse qu'un collègue vient de demander.
  */
  assert.equal(R.isOwnMessage(AJMANI, dAjmani), false);
  assert.equal(R.canDeleteMessage('member', AARON, dAjmani), false);
  assert.equal(R.canDeleteMessage('member', AJMANI, dAjmani), false);
  assert.equal(R.canDeleteMessage('admin', AARON, dAjmani), true);
  assert.equal(R.canDeleteMessage('owner', AARON, dAjmani), true);
});

check('la casse de l’adresse ne décide de rien', () => {
  /*
    Les adresses voyagent par la synchronisation et par le serveur, qui
    normalise à la connexion. Une comparaison stricte ferait dépendre un droit
    d'une majuscule — et le message deviendrait non supprimable par son auteur
    même.
  */
  assert.equal(R.isOwnMessage('Aaron@AMN-DevSec.com', deAaron), true);
  assert.equal(R.isOwnMessage(` ${AARON} `, deAaron), true);
  assert.equal(R.isOwnMessage(AARON, { authorEmail: 'AARON@AMN-DEVSEC.COM' }), true);
  // Mais deux adresses différentes restent différentes.
  assert.equal(R.isOwnMessage(AARON, deMohamed), false);
  // Et une adresse absente n'est jamais « la même » qu'une autre absente.
  assert.equal(R.isOwnMessage(null, { authorEmail: '' }), false);
  assert.equal(R.isOwnMessage('', { authorEmail: '' }), false);
});

check('le libellé dit lequel des deux droits on exerce', () => {
  /*
    Un owner voit le même bouton sur son message et sur celui d'un autre. Si
    le libellé ne distingue pas, le geste de modération se confond avec la
    correction ordinaire — et s'exerce par inadvertance.
  */
  const sien = R.deleteMessageLabel(AARON, deAaron);
  const autre = R.deleteMessageLabel(AARON, deMohamed);
  assert.notEqual(sien, autre, 'les deux gestes doivent se nommer différemment');
  assert.ok(/modération/i.test(autre), 'le geste sur autrui doit se dire « modération »');
  assert.ok(!/modération/i.test(sien), 'corriger son propre message n’est pas de la modération');
});

if (failures.length > 0) {
  console.error(`\n${failures.length} contrôle(s) en échec :`);
  for (const n of failures) console.error(`  - ${n}`);
  process.exit(1);
}
console.log('\nSuppression de message : tous les contrôles passent.');
