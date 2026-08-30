/**
 * Contrôle des SÉRIES VITALES — la mémoire d'un chiffre ne doit jamais mentir.
 *
 * La refonte des Signes Vitaux pose une mini-courbe et un delta sous les
 * relevés de toute l'application. Une courbe fausse sous un vrai chiffre
 * serait pire que pas de courbe : elle donnerait au mensonge la crédibilité
 * du reste. Ce contrôle épingle donc les propriétés qui rendent la série
 * honnête :
 *
 *   · un flux compte les arrivées PAR JOUR, dans la fenêtre, et rien d'autre ;
 *   · un stock CUMULE, son dernier point est le total d'aujourd'hui, et les
 *     enregistrements sans date comptent dans le socle (ils existent) ;
 *   · les fuseaux ne déplacent pas un soir vers le lendemain (clé LOCALE) ;
 *   · une série plate ne se dessine pas au plancher (un stock à 7 n'est pas
 *     un zéro) ;
 *   · le delta parle la grammaire de la Relève (lettres, pas de flèches).
 *
 *   npm run check:vitaux
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

interface Point {
  jour: string;
  valeur: number;
}
interface Serie {
  points: Point[];
  delta: number;
  nature: 'flux' | 'stock';
}

const { cleJour, derniersJours, serieFlux, serieStock, phraseDelta, litLeNombre, traceSerie } =
  await loadFromSrc<{
    cleJour: (d: Date) => string;
    derniersJours: (n: number, m: Date) => string[];
    serieFlux: (dates: unknown[], jours: number, m: Date) => Serie;
    serieStock: (dates: unknown[], jours: number, m: Date) => Serie;
    phraseDelta: (s: Serie) => string;
    litLeNombre: (n: number) => string;
    traceSerie: (s: Serie) => Array<{ x: number; y: number }>;
  }>('src/lib/serieVitale.ts');

let vus = 0;
const dit = (nom: string, fn: () => void) => {
  fn();
  vus += 1;
  console.log(`  ✓ ${nom}`);
};

/* Un « maintenant » fixe : le 15 mars 2026 à 14 h, heure locale. */
const M = new Date(2026, 2, 15, 14, 0, 0);
const iso = (y: number, mo: number, d: number, h = 12) => new Date(y, mo - 1, d, h).toISOString();

/* ─── La fenêtre de jours ──────────────────────────────────────────────────── */

dit('sept derniers jours : du 9 au 15, dans l’ordre', () => {
  const j = derniersJours(7, M);
  assert.equal(j.length, 7);
  assert.equal(j[0], '2026-03-09');
  assert.equal(j[6], '2026-03-15');
});

dit('LA RÈGLE : la clé de jour est LOCALE — minuit et demie n’est pas hier', () => {
  /*
    Le script s'exécute en TZ=Europe/Paris (voir package.json) : 0 h 30 locale
    le 15 mars, c'est 23 h 30 UTC le 14. Une clé calculée en UTC renverrait
    donc « hier » — et c'est exactement la mutation que ce contrôle a d'abord
    LAISSÉ PASSER, parce que la machine de test vit en UTC et que mon premier
    témoin (23 h 30 locale) y était identique dans les deux lectures. L'heure
    du témoin est choisie pour que local et UTC divergent.
  */
  const nuit = new Date(2026, 2, 15, 0, 30);
  assert.equal(cleJour(nuit), '2026-03-15');
});

/* ─── Le flux ──────────────────────────────────────────────────────────────── */

dit('un flux compte par jour, dans la fenêtre seulement', () => {
  const s = serieFlux(
    [iso(2026, 3, 15), iso(2026, 3, 15), iso(2026, 3, 12), iso(2026, 3, 1) /* hors fenêtre */],
    7,
    M,
  );
  assert.equal(s.points[6].valeur, 2, 'deux aujourd’hui');
  assert.equal(s.points[3].valeur, 1, 'un le 12');
  assert.equal(s.delta, 3, 'le delta est le total de la fenêtre — le 1er mars n’y est pas');
});

dit('une date invalide ne compte pas — plutôt manquer que mentir', () => {
  const s = serieFlux(['pas-une-date', undefined, null, 42], 7, M);
  assert.equal(s.delta, 0);
});

/* ─── Le stock ─────────────────────────────────────────────────────────────── */

dit('un stock cumule, et son dernier point est le total d’aujourd’hui', () => {
  const s = serieStock(
    [iso(2026, 1, 10) /* vieux */, iso(2026, 3, 12), iso(2026, 3, 15)],
    7,
    M,
  );
  assert.equal(s.points[0].valeur, 1, 'le socle : ce qui existait avant la fenêtre');
  assert.equal(s.points[6].valeur, 3, 'le dernier point EST le total');
  assert.equal(s.delta, 2, 'deux créations dans la fenêtre');
});

dit('LA RÈGLE : un enregistrement sans date compte dans le socle', () => {
  /*
    Il EXISTE — on ne sait simplement pas depuis quand. L'exclure ferait
    mentir le dernier point : l'écran dirait « 2 clients » sur la courbe et
    « 3 » dans la liste d'à côté.
  */
  const s = serieStock([undefined, iso(2026, 3, 14)], 7, M);
  assert.equal(s.points[6].valeur, 2);
  assert.equal(s.delta, 1, 'mais il ne compte pas comme une création récente');
});

dit('une date FUTURE ne gonfle aucun jour', () => {
  const s = serieStock([iso(2026, 3, 20)], 7, M);
  assert.equal(s.points[6].valeur, 0);
});

/* ─── Le tracé ─────────────────────────────────────────────────────────────── */

dit('le tracé est normalisé, y inversé (SVG)', () => {
  const t = traceSerie(serieFlux([iso(2026, 3, 15)], 7, M));
  assert.equal(t.length, 7);
  assert.equal(t[6].y, 0, 'le maximum est en HAUT');
  assert.equal(t[0].y, 1, 'le minimum en bas');
});

dit('LA RÈGLE : une série plate ne se dessine pas au plancher', () => {
  // Un stock constant à 7 n'est pas un zéro. Collé en bas, il se lirait
  // « rien » ; au tiers bas, il se lit « stable ».
  const t = traceSerie(serieStock([iso(2026, 1, 1)], 7, M));
  for (const p of t) assert.equal(p.y, 0.66);
});

/* ─── La grammaire ─────────────────────────────────────────────────────────── */

dit('les petits nombres s’écrivent en lettres', () => {
  assert.equal(litLeNombre(2), 'deux');
  assert.equal(litLeNombre(11), '11');
});

dit('un delta nul se tait — « zéro cette semaine » répété serait du bruit', () => {
  assert.equal(phraseDelta(serieFlux([], 7, M)), '');
});

dit('flux et stock ne disent pas la même phrase', () => {
  const flux = serieFlux([iso(2026, 3, 14), iso(2026, 3, 15)], 7, M);
  assert.equal(phraseDelta(flux), 'deux sur 7 jours');
  const stock = serieStock([iso(2026, 3, 14)], 7, M);
  assert.equal(phraseDelta(stock), 'un de plus en 7 jours');
});

console.log(`\nOK — ${vus} contrôles.\n`);
