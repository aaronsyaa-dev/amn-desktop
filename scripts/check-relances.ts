/**
 * Contrôle des RELANCES GRADUÉES — le ton doit monter avec le retard.
 *
 * `RemindersScreen` proposait avant ce chantier le même message, quel que soit le
 * nombre de jours de retard : un rappel de trois jours et un silence de cent
 * quarante jours recevaient la même formule polie. Ce contrôle vérifie le moteur
 * pur qui corrige ça : quel palier un retard atteint (`paliereDe`), et si le ton
 * doit changer depuis la dernière relance envoyée (`toneAMonte`).
 *
 *   npm run check:relances
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

type PalierRelance = 'rappel' | 'ferme' | 'mise-en-demeure' | 'dernier-avis';

const { paliereDe, rangPalier, toneAMonte, cleMessagePalier, CLE_LIBELLE_PALIER } = await loadFromSrc<{
  paliereDe: (joursRetard: number) => PalierRelance;
  rangPalier: (p: PalierRelance) => number;
  toneAMonte: (dernier: PalierRelance | null, actuel: PalierRelance) => boolean;
  cleMessagePalier: (p: PalierRelance) => string;
  CLE_LIBELLE_PALIER: Record<PalierRelance, string>;
}>('src/lib/relances.ts');

let vus = 0;
const dit = (nom: string, fn: () => void) => {
  fn();
  vus += 1;
  console.log(`  ✓ ${nom}`);
};

/* ─── Les seuils, un jour de part et d'autre de chaque frontière ─────────── */

dit('1 jour de retard : un simple rappel', () => {
  assert.equal(paliereDe(1), 'rappel');
});

dit('exactement 7 jours : encore un rappel — la frontière est « au-delà », pas « à partir de »', () => {
  assert.equal(paliereDe(7), 'rappel');
  assert.equal(paliereDe(8), 'ferme');
});

dit('exactement 21 jours : encore ferme, 22 bascule en mise en demeure', () => {
  assert.equal(paliereDe(21), 'ferme');
  assert.equal(paliereDe(22), 'mise-en-demeure');
});

dit('exactement 45 jours : encore mise en demeure, 46 bascule en dernier avis', () => {
  assert.equal(paliereDe(45), 'mise-en-demeure');
  assert.equal(paliereDe(46), 'dernier-avis');
});

dit('un retard énorme (deux ans) reste au dernier palier — jamais un cinquième inventé', () => {
  assert.equal(paliereDe(730), 'dernier-avis');
});

dit('zéro jour ou un nombre négatif (horloge locale en avance) ne casse rien : un rappel, jamais une exception', () => {
  assert.equal(paliereDe(0), 'rappel');
  assert.equal(paliereDe(-1), 'rappel');
});

/* ─── L'ordre, et la détection d'une montée de ton ───────────────────────── */

dit('l’ordre des paliers est strictement croissant', () => {
  assert.ok(rangPalier('rappel') < rangPalier('ferme'));
  assert.ok(rangPalier('ferme') < rangPalier('mise-en-demeure'));
  assert.ok(rangPalier('mise-en-demeure') < rangPalier('dernier-avis'));
});

dit('LE CAS CENTRAL : la même relance deux fois de suite n’est pas une montée de ton', () => {
  assert.equal(toneAMonte('ferme', 'ferme'), false);
});

dit('LE CAS CENTRAL : passer de rappel à ferme EST une montée de ton', () => {
  assert.equal(toneAMonte('rappel', 'ferme'), true);
});

dit('un palier qui redescend (avoir partiel réduisant le retard perçu ?) n’est jamais une « montée »', () => {
  assert.equal(toneAMonte('mise-en-demeure', 'rappel'), false);
});

dit('jamais encore relancée (null) n’est pas une montée : c’est un premier envoi, l’écran doit le dire autrement', () => {
  assert.equal(toneAMonte(null, 'rappel'), false);
  assert.equal(toneAMonte(null, 'dernier-avis'), false);
});

/* ─── Chaque palier a sa propre clé de message et de libellé, jamais partagée ─ */

dit('chaque palier pointe vers une clé i18n distincte, pour le message comme pour le libellé', () => {
  const paliers: PalierRelance[] = ['rappel', 'ferme', 'mise-en-demeure', 'dernier-avis'];
  const clesMessage = new Set(paliers.map(cleMessagePalier));
  const clesLibelle = new Set(paliers.map((p) => CLE_LIBELLE_PALIER[p]));
  assert.equal(clesMessage.size, 4, 'quatre paliers, quatre messages — jamais deux qui partagent le même texte');
  assert.equal(clesLibelle.size, 4);
});

dit('le rappel réutilise la clé qui existait avant ce chantier — son ton ne change pas', () => {
  assert.equal(cleMessagePalier('rappel'), 'relances.message');
});

console.log(`\nOK — ${vus} contrôles.\n`);
