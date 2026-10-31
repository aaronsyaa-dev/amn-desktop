/**
 * Contrôle des GRAPHIQUES DU SOCLE — courbe, mini-courbe, barres, donut, anneau,
 * et la mise en forme française des chiffres.
 *
 * Sans navigateur, sans build, sans réseau : les composants sont rendus en HTML
 * statique (`react-dom/server.browser`), les calculs sont appelés tels quels.
 * Les données ci-dessous sont des JEUX D'ESSAI fictifs : aucune ne vient de
 * l'application, et les composants n'en contiennent aucune.
 *
 *   1. L'ÉCHELLE : bornes, graduations, pas lisible — pour le vide, un point,
 *      les valeurs égales, les négatives, les entiers, et 300 jeux tirés au sort.
 *   2. LES FORMATS : « 1 234,5 », « 78 % », « 3 840 € », espaces insécables exacts.
 *   3. LES PARTS ET LE DONUT : somme 100 %, écart de 2 px entre segments, tour complet.
 *   4. LES COMPOSANTS : rôles et libellés ARIA, alternative textuelle, états
 *      limites (0, 1, 2 points, égaux, négatifs, zéro), points au clavier et
 *      désactivables, légendes, anneau sans régression.
 *   5. LES SOURCES : aucune couleur écrite en dur, aucune encre « discret »,
 *      aucun texte sous 10,5 px, jetons existants, animation 400 ms coupée par
 *      `prefers-reduced-motion`, imports limités au socle, mots fr/en.
 *
 *   npm run check:socle-graphiques
 */

import fs from 'node:fs';
import path from 'node:path';
import { assert, chargerRendu, creerEssais, jetons, lire, racine, sansCommentaires } from './lib/essai-socle.ts';

const { dit, fin } = creerEssais('Graphiques du socle — courbe, barres, donut, anneau, formats français\n');

const NBSP = '\u00a0';
const FINE = '\u202f';
const REP = 'src/socle/ui/graphiques';

/* ── Chargement ───────────────────────────────────────────────────────────── */

type Echelle = { min: number; max: number; pas: number; graduations: number[] };
type Arc = { debut: number; longueur: number; visible: number; ecart: number; part: number };
interface Modules {
  calculerEchelle: (v: number[], o?: { graduations?: number; inclureZero?: boolean }) => Echelle | null;
  positionner: (v: number, e: { min: number; max: number }, haut: number, bas: number) => number;
  repartirPourcents: (v: number[]) => number[];
  arcsDonut: (v: number[], c: number, e?: number) => Arc[];
  pasEtiquettes: (n: number, place: number, largeur: number) => number;
  indicesEtiquetes: (n: number, pas: number) => number[];
  resumer: (v: number[]) => { n: number; min: number; max: number; premier: number; dernier: number } | null;
  cheminLigne: (p: Array<[number, number] | null>) => string;
  formaterNombre: (v: number, o?: { decimales?: number; decimalesMin?: number }) => string;
  formaterPourcent: (v: number, o?: { decimales?: number }) => string;
  formaterEuro: (v: number, o?: { decimales?: number }) => string;
  formatCentsCompact: (c: number) => string;
  couleurTon: (t: string | undefined) => string;
  TAILLE_AXE: number;
  Courbe: unknown;
  MiniCourbe: unknown;
  Barres: unknown;
  Donut: unknown;
  Anneau: unknown;
  AnneauProgression: unknown;
  traduireSocle: (langue: 'fr' | 'en', cle: string, params?: Record<string, string | number>) => string;
  DICTIONNAIRES_SOCLE: Record<'fr' | 'en', Record<string, string>>;
}

const M = (await chargerRendu<Modules & Record<string, unknown>>(
  [
    "import { Courbe, MiniCourbe, Barres, Donut, Anneau, formaterNombre, formaterPourcent, formaterEuro } from '../src/socle/ui/graphiques';",
    "import { calculerEchelle, positionner, repartirPourcents, arcsDonut, pasEtiquettes, indicesEtiquetes, resumer, cheminLigne, TAILLE_AXE } from '../src/socle/ui/graphiques/calculs';",
    "import { couleurTon } from '../src/socle/ui/graphiques/tons';",
    "import { AnneauProgression } from '../src/socle/ui/Indicateurs';",
    "import { formatCentsCompact } from '../src/lib/money';",
    "import { traduireSocle, DICTIONNAIRES_SOCLE } from '../src/socle/i18n';",
  ].join('\n'),
  [
    'Courbe', 'MiniCourbe', 'Barres', 'Donut', 'Anneau', 'AnneauProgression', 'formaterNombre', 'formaterPourcent', 'formaterEuro',
    'calculerEchelle', 'positionner', 'repartirPourcents', 'arcsDonut', 'pasEtiquettes', 'indicesEtiquetes', 'resumer', 'cheminLigne',
    'TAILLE_AXE', 'couleurTon', 'formatCentsCompact', 'traduireSocle', 'DICTIONNAIRES_SOCLE',
  ],
)) as unknown as Modules & { h: (t: unknown, p?: Record<string, unknown> | null, ...c: unknown[]) => unknown; rendre: (e: unknown) => string };

const { h, rendre } = M;
const rend = (composant: unknown, props: Record<string, unknown>): string => rendre(h(composant, props));
const points = (valeurs: number[], etiquettes?: string[]) => valeurs.map((valeur, i) => ({ etiquette: etiquettes?.[i] ?? `p${i + 1}`, valeur }));
const nombres = (html: string, attribut: string): number[] => [...html.matchAll(new RegExp(`${attribut}="(-?[\\d.e+-]+)"`, 'g'))].map((m) => Number(m[1]));
const compter = (html: string, motif: RegExp): number => (html.match(motif) ?? []).length;
/** La valeur, ou un échec net si elle manque (évite les `!` et dit ce qui manquait). */
const present = <T,>(valeur: T | null | undefined, quoi = 'valeur attendue'): T => {
  assert.ok(valeur !== null && valeur !== undefined, quoi);
  return valeur as T;
};
const echelle = (v: number[], o?: { graduations?: number; inclureZero?: boolean }): Echelle => present(M.calculerEchelle(v, o), `échelle nulle pour ${v}`);
const groupe = (re: RegExp, texte: string, i = 1): string => present(re.exec(texte), `${re} introuvable`)[i];
const sansBlancs = (s: string): string => s.replace(/[\s\u00a0\u202f]/g, '_');

/* ── 1. L'échelle ─────────────────────────────────────────────────────────── */

await dit('échelle : aucune valeur finie → null (vide, NaN, Infinity)', () => {
  assert.equal(M.calculerEchelle([]), null);
  assert.equal(M.calculerEchelle([Number.NaN, Number.POSITIVE_INFINITY]), null);
});

await dit('échelle : min et max encadrent les données, graduations régulières de min à max', () => {
  const e = echelle([3, 9, 5, 7]);
  assert.ok(e.min <= 3 && e.max >= 9, JSON.stringify(e));
  assert.equal(e.graduations[0], e.min);
  assert.equal(e.graduations[e.graduations.length - 1], e.max);
  assert.ok(e.graduations.length >= 2 && e.graduations.length <= 8, `${e.graduations.length} graduations`);
  for (let i = 1; i < e.graduations.length; i += 1) assert.ok(Math.abs(e.graduations[i] - e.graduations[i - 1] - e.pas) < 1e-9, 'pas régulier');
});

await dit('échelle : un seul point ou tous égaux → une plage non nulle autour de la valeur', () => {
  for (const jeu of [[5], [5, 5, 5], [-7, -7], [1250.5, 1250.5]]) {
    const e = echelle(jeu);
    assert.ok(e.max > e.min, `plage nulle pour ${jeu}`);
    assert.ok(e.min < jeu[0] && e.max > jeu[0], `${jeu[0]} n'est pas à l'intérieur de [${e.min}, ${e.max}]`);
  }
});

await dit('échelle : zéro partout → 0 à 1 (jamais une division par zéro)', () => {
  const e = echelle([0, 0, 0]);
  assert.deepEqual([e.min, e.max], [0, 1]);
  assert.equal(M.positionner(0, e, 10, 110), 110);
});

await dit('échelle : valeurs négatives et mixtes → l’échelle descend sous zéro, le zéro reste une graduation', () => {
  const neg = echelle([-8, -2, -5]);
  assert.ok(neg.min <= -8 && neg.max >= -2 && neg.max <= 0 + neg.pas, JSON.stringify(neg));
  const mixte = echelle([-3, 5, 1]);
  assert.ok(mixte.min <= -3 && mixte.max >= 5);
  assert.ok(mixte.graduations.includes(0), `pas de zéro dans ${mixte.graduations}`);
});

await dit('échelle : « inclureZero » ancre le zéro ; des entiers donnent des graduations entières', () => {
  const e = echelle([120, 180, 150], { inclureZero: true });
  assert.equal(e.min, 0);
  const n = echelle([1, 2, 3, 2, 1]);
  assert.ok(n.graduations.every(Number.isInteger), `graduations non entières : ${n.graduations}`);
  const bas = echelle([0.1, 0.3]);
  assert.ok(bas.graduations.every((g) => Number.isFinite(g)) && bas.min <= 0.1 && bas.max >= 0.3);
});

await dit('échelle : 300 jeux tirés au sort — jamais de NaN, bornes qui encadrent, graduations strictement croissantes', () => {
  let graine = 20260131;
  const hasard = () => {
    graine = (graine * 1664525 + 1013904223) % 4294967296;
    return graine / 4294967296;
  };
  for (let k = 0; k < 300; k += 1) {
    const n = 1 + Math.floor(hasard() * 12);
    const grandeur = 10 ** Math.floor(hasard() * 8 - 3);
    const jeu = Array.from({ length: n }, () => Math.round((hasard() - 0.4) * 1000) / 1000 * grandeur);
    const e = echelle(jeu, { inclureZero: hasard() < 0.3 });
    assert.ok(e && Number.isFinite(e.min) && Number.isFinite(e.max) && e.pas > 0, JSON.stringify([jeu, e]));
    for (const v of jeu) assert.ok(v >= e.min - 1e-9 && v <= e.max + 1e-9, `${v} hors de [${e.min}, ${e.max}]`);
    for (let i = 1; i < e.graduations.length; i += 1) assert.ok(e.graduations[i] > e.graduations[i - 1], 'graduations croissantes');
  }
});

await dit('positions : le minimum tombe en bas, le maximum en haut', () => {
  const e = { min: 0, max: 10 };
  assert.equal(M.positionner(0, e, 20, 120), 120);
  assert.equal(M.positionner(10, e, 20, 120), 20);
  assert.equal(M.positionner(5, e, 20, 120), 70);
});

await dit('étiquettes d’axe : on en saute quand la place manque, et la dernière est toujours nommée', () => {
  assert.equal(M.pasEtiquettes(12, 80, 30), 1);
  assert.ok(M.pasEtiquettes(60, 8, 40) > 1);
  assert.deepEqual(M.indicesEtiquetes(7, 3), [0, 3, 6]);
  assert.equal(M.indicesEtiquetes(10, 4).at(-1), 9);
});

await dit('tracé : un trou (null) rouvre le trait avec « M », sans NaN', () => {
  const d = M.cheminLigne([[0, 1], [1, 2], null, [3, 4]]);
  assert.equal(d, 'M0,1L1,2M3,4');
});

/* ── 2. Les formats français ──────────────────────────────────────────────── */

await dit('nombres : virgule décimale, milliers en insécable fine', () => {
  assert.equal(M.formaterNombre(1234567.5), `1${FINE}234${FINE}567,5`);
  assert.equal(M.formaterNombre(3.8), '3,8');
  assert.equal(M.formaterNombre(0), '0');
  assert.equal(M.formaterNombre(999), '999');
  assert.equal(M.formaterNombre(1000), `1${FINE}000`);
  assert.equal(M.formaterNombre(-1234.5), `-1${FINE}234,5`);
  assert.equal(M.formaterNombre(1234.44, { decimales: 0 }), `1${FINE}234`);
  assert.equal(M.formaterNombre(2, { decimales: 2, decimalesMin: 2 }), '2,00');
  assert.equal(M.formaterNombre(-0.001, { decimales: 1 }), '0', 'jamais « -0 »');
});

await dit('pour cent : insécable avant %, virgule décimale', () => {
  assert.equal(M.formaterPourcent(78), `78${NBSP}%`);
  assert.equal(M.formaterPourcent(92.5), `92,5${NBSP}%`);
  assert.equal(M.formaterPourcent(0), `0${NBSP}%`);
  assert.equal(M.formaterPourcent(100), `100${NBSP}%`);
  assert.equal(M.formaterPourcent(3.84, { decimales: 0 }), `4${NBSP}%`);
  assert.equal(M.formaterPourcent(-12), `-12${NBSP}%`);
});

await dit('euros : insécable avant €, milliers en insécable fine, décimales seulement si le montant n’est pas rond', () => {
  assert.equal(M.formaterEuro(3840), `3${FINE}840${NBSP}€`);
  assert.equal(M.formaterEuro(1234.5), `1${FINE}234,50${NBSP}€`);
  assert.equal(M.formaterEuro(890), `890${NBSP}€`);
  assert.equal(M.formaterEuro(0), `0${NBSP}€`);
  assert.equal(M.formaterEuro(-250), `-250${NBSP}€`);
  assert.equal(M.formaterEuro(12, { decimales: 2 }), `12,00${NBSP}€`);
  assert.equal(M.formaterEuro(18420), `18${FINE}420${NBSP}€`);
});

await dit('euros : même écriture que `formatCentsCompact` de src/lib/money.ts (une seule convention dans l’application)', () => {
  for (const v of [0, 5, 890, 1000, 3840, 18420, 1234.5, 99.9]) {
    assert.equal(sansBlancs(M.formaterEuro(v)), sansBlancs(M.formatCentsCompact(Math.round(v * 100))), `montant ${v}`);
  }
});

await dit('formats : aucune espace ordinaire dans un nombre, devant % ni devant € ; une valeur illisible devient « — »', () => {
  for (const s of [M.formaterNombre(1234567.891), M.formaterPourcent(45.5), M.formaterEuro(1234567.5), M.formaterEuro(0.5)]) {
    assert.ok(!/ /.test(s), `espace ordinaire dans « ${s} »`);
    assert.ok(!/\d\.\d/.test(s), `point décimal dans « ${s} »`);
  }
  for (const f of [M.formaterNombre, M.formaterPourcent, M.formaterEuro]) {
    assert.equal(f(Number.NaN), '—');
    assert.equal(f(Number.POSITIVE_INFINITY), '—');
  }
});

/* ── 3. Parts et donut ────────────────────────────────────────────────────── */

await dit('parts : des pour cent entiers dont la somme fait toujours 100 (plus fort reste)', () => {
  const somme = (a: number[]) => a.reduce((x, y) => x + y, 0);
  assert.deepEqual(M.repartirPourcents([1, 1, 1]), [34, 33, 33]);
  assert.equal(somme(M.repartirPourcents([1, 1, 1])), 100);
  assert.equal(somme(M.repartirPourcents([30, 20, 50])), 100);
  assert.deepEqual(M.repartirPourcents([5, 0, 5]), [50, 0, 50]);
  assert.deepEqual(M.repartirPourcents([0, 0]), [0, 0]);
  assert.deepEqual(M.repartirPourcents([]), []);
  assert.deepEqual(M.repartirPourcents([10, -5, Number.NaN, 10]), [50, 0, 0, 50]);
  let graine = 7;
  for (let k = 0; k < 100; k += 1) {
    graine = (graine * 48271) % 2147483647;
    const jeu = Array.from({ length: 2 + (graine % 7) }, (_, i) => ((graine >> i) % 997) + 1);
    assert.equal(somme(M.repartirPourcents(jeu)), 100, `jeu ${jeu}`);
  }
});

await dit('arcs du donut : 2 px d’écart entre segments, ils se touchent bout à bout et font le tour', () => {
  const tour = 2 * Math.PI * ((116 - 14) / 2);
  const arcs = M.arcsDonut([30, 20, 50], tour, 2);
  assert.equal(arcs.length, 3);
  for (const a of arcs) {
    assert.equal(a.ecart, 2);
    assert.ok(Math.abs(a.longueur - a.visible - 2) < 1e-9, 'visible = longueur − 2');
  }
  assert.ok(Math.abs(arcs.reduce((s, a) => s + a.longueur, 0) - tour) < 1e-9, 'la somme des longueurs est la circonférence');
  assert.ok(Math.abs(arcs.reduce((s, a) => s + a.part, 0) - 1) < 1e-12, 'la somme des parts est 100 %');
  assert.ok(Math.abs(arcs[1].debut - (arcs[0].debut + arcs[0].longueur)) < 1e-9);
});

await dit('arcs du donut : un seul segment non nul = l’anneau entier sans écart ; somme nulle = rien à tracer', () => {
  const tour = 300;
  const seul = M.arcsDonut([0, 7, 0], tour, 2);
  assert.equal(seul[1].visible, tour);
  assert.equal(seul[1].ecart, 0);
  assert.equal(seul[0].visible, 0);
  assert.ok(M.arcsDonut([0, 0], tour).every((a) => a.visible === 0 && a.part === 0));
  assert.ok(M.arcsDonut([], tour).length === 0);
  const fin = M.arcsDonut([1000, 1], tour, 2);
  assert.ok(fin[1].visible >= 1 - 1e-9, 'un segment minuscule reste visible');
});

/* ── 4. Les composants ────────────────────────────────────────────────────── */

const JEU = [3, 5, 4, 8, 6, 7, 9, 5, 6, 8, 7, 9];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

await dit('Courbe : role="img", libellé « Courbe, 12 points, de X à Y, dernier : Z », sans NaN', () => {
  const html = rend(M.Courbe, { donnees: points(JEU, MOIS), libelle: 'Activité' });
  assert.equal(compter(html, /role="img"/g), 1, 'un seul role="img" : le dessin');
  const label = /aria-label="(Activité\. Courbe, 12 points, de 3 à 9, dernier : 9)"/.exec(html);
  assert.ok(label, `libellé introuvable : ${/aria-label="[^"]*"/.exec(html)?.[0]}`);
  assert.ok(!/NaN|Infinity|undefined/.test(html));
  assert.match(html, /<svg[^>]*viewBox="0 0 560 180"/);
});

await dit('Courbe : alternative textuelle — un tableau sr-only avec les 12 valeurs, et la légende de la série', () => {
  const html = rend(M.Courbe, { donnees: points(JEU, MOIS), libelle: 'Activité', nom: 'Dossiers' });
  assert.match(html, /<table class="sr-only"/);
  assert.match(html, /<caption>Activité\. Courbe, 12 points/);
  assert.equal(compter(html, /<tbody>[\s\S]*<\/tbody>/g), 1);
  assert.equal(compter(html, /<th scope="row">/g), 12);
  assert.match(html, /<th scope="col">Dossiers<\/th>/);
  assert.match(html, /<th scope="row">févr\.<\/th><td>5<\/td>/);
});

await dit('Courbe : la forme du dessin — aire dégradée .28 → 0, ligne tracée, point final cerclé, grille, axes en jeton', () => {
  const html = rend(M.Courbe, { donnees: points(JEU, MOIS), libelle: 'Activité' });
  assert.match(html, /<stop class="sc-g__degrade" offset="0" stop-opacity="0.28"/);
  assert.match(html, /<stop class="sc-g__degrade" offset="1" stop-opacity="0"/);
  assert.match(html, /<path class="sc-g__ligne" d="M[^"]+" pathLength="1"/);
  assert.match(html, /<path class="sc-g__aire" d="M[^"]+Z" fill="url\(#/);
  assert.equal(compter(html, /class="sc-g__fin"/g), 1);
  assert.ok(compter(html, /class="sc-g__grille"/g) >= 3);
  assert.match(html, /style="--sc-g-c:var\(--socle-texte-1\)"/);
});

await dit('Courbe : les valeurs viennent des données — l’échelle suit les montants, formatés en euros', () => {
  const html = rend(M.Courbe, { donnees: points([1200, 1800, 2400, 3000], ['a', 'b', 'c', 'd']), libelle: 'Encaissements', formater: M.formaterEuro });
  assert.ok(html.includes(`dernier : 3${FINE}000${NBSP}€`), 'le dernier montant est formaté en euros');
  assert.ok(html.includes(`>3${FINE}000${NBSP}€<`), 'une graduation est écrite en euros');
  assert.ok(html.includes(`de 1${FINE}200${NBSP}€ à 3${FINE}000${NBSP}€`));
});

await dit('Courbe : un seul point actif à la fois, annoncé — boutons aux flèches, une tabulation, le dernier point par défaut', () => {
  const html = rend(M.Courbe, { donnees: points(JEU, MOIS), libelle: 'Activité' });
  assert.match(html, /<div role="group" aria-label="Points du graphique\./);
  assert.equal(compter(html, /<button /g), 12);
  assert.equal(compter(html, /tabindex="0"/g), 1, 'une seule tabulation (roving tabindex)');
  assert.equal(compter(html, /tabindex="-1"/g), 11);
  assert.ok(/<button[^>]*tabindex="0"[^>]*aria-label="déc\. : 9"/.test(html) || /<button[^>]*aria-label="déc\. : 9"[^>]*tabindex="0"/.test(html), 'la tabulation tombe sur le dernier point');
  assert.match(html, /aria-label="févr\. : 5"/);
  assert.match(html, /<span role="status" class="sr-only"><\/span>/, 'une région d’annonce, vide au repos');
  assert.ok(!/<button[^>]*class="sc-g__zone"[^>]*\bonclick/i.test(html));
});

await dit('Courbe : « interactif » coupé → aucun bouton, aucune tabulation, le résumé et le tableau restent', () => {
  const html = rend(M.Courbe, { donnees: points(JEU, MOIS), libelle: 'Activité', interactif: false });
  assert.equal(compter(html, /<button/g), 0);
  assert.equal(compter(html, /tabindex/g), 0);
  assert.ok(!/role="group"/.test(html));
  assert.match(html, /role="img"/);
  assert.match(html, /<table class="sr-only"/);
});

await dit('Courbe : les flèches ← → et Début/Fin sont câblées (le rendu statique ne tape pas de touche)', () => {
  const src = sansCommentaires(lire(`${REP}/commun.tsx`));
  for (const touche of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) assert.ok(src.includes(`'${touche}'`), `touche ${touche} non gérée`);
  assert.match(src, /preventDefault\(\)/);
  assert.match(src, /onFocus=/);
  assert.match(src, /onMouseEnter=/);
  assert.match(src, /focus-visible/, 'le clavier se distingue de la souris');
});

await dit('Courbe : 0 point → « Pas encore de données » à la place, jamais un dessin vide', () => {
  for (const donnees of [[], points([Number.NaN, Number.POSITIVE_INFINITY])]) {
    const html = rend(M.Courbe, { donnees, libelle: 'Activité' });
    assert.match(html, /role="img" aria-label="Activité\. Courbe, pas encore de données"/);
    assert.match(html, /<span>Pas encore de données<\/span>/);
    assert.ok(!/<svg|<button|<table/.test(html));
  }
});

await dit('Courbe : 1 point → le point seul (pas de ligne ni d’aire) ; 2 points → un trait', () => {
  const un = rend(M.Courbe, { donnees: points([42], ['mars']), libelle: 'Activité' });
  assert.match(un, /aria-label="Activité\. Courbe, 1 point : 42"/);
  assert.equal(compter(un, /class="sc-g__fin"/g), 1);
  assert.ok(!/sc-g__ligne"|sc-g__aire"/.test(un));
  assert.ok(!/NaN|Infinity/.test(un));
  assert.equal(compter(un, /<button /g), 1);
  const deux = rend(M.Courbe, { donnees: points([4, 6]), libelle: 'Activité' });
  assert.match(deux, /Courbe, 2 points, de 4 à 6, dernier : 6/);
  assert.match(deux, /class="sc-g__ligne"/);
  assert.ok(!/NaN|Infinity/.test(deux));
});

await dit('Courbe : valeurs toutes égales, négatives, nulles → rien de cassé, la ligne reste dans le cadre', () => {
  for (const jeu of [[5, 5, 5, 5], [-8, -3, -5, -1], [0, 0, 0], [-2, 4, -6, 8]]) {
    const html = rend(M.Courbe, { donnees: points(jeu), libelle: 'Écart' });
    assert.ok(!/NaN|Infinity|undefined/.test(html), `valeurs ${jeu}`);
    const ys = nombres(html, 'cy');
    assert.ok(ys.length >= 1 && ys.every((y) => y >= 0 && y <= 180), `ordonnées hors cadre pour ${jeu} : ${ys}`);
  }
  const neg = rend(M.Courbe, { donnees: points([-8, -3, -5, -1]), libelle: 'Écart' });
  assert.match(neg, /de -8 à -1, dernier : -1/);
});

await dit('Courbe : valeur manquante dans une seconde série → un trou, pas une erreur', () => {
  const html = rend(M.Courbe, { donnees: points([1, 2, 3, 4]), secondeSerie: [2, null, 4, undefined], libelle: 'Prévu et réel' });
  assert.ok(!/NaN|Infinity|undefined/.test(html));
  assert.match(html, /<path class="sc-g__ligne2" d="M[\d.,-]+M[\d.,-]+"/);
});

await dit('Courbe : seconde série en pointillé, avec légende (jamais la couleur seule) et colonne dans le tableau', () => {
  const html = rend(M.Courbe, { donnees: points([1, 2, 3, 4]), secondeSerie: [2, 3, 3, 5], nom: 'Réel', nomSeconde: 'Objectif', libelle: 'Chiffre' });
  assert.match(html, /<path class="sc-g__ligne2"/);
  assert.match(html, /<ul class="sc-g__legende" aria-label="Légende">/);
  assert.match(html, /sc-g__ligne-echantillon sc-g__ligne-echantillon--pointille/);
  assert.match(html, /<span>Réel<\/span>/);
  assert.match(html, /<span>Objectif<\/span>/);
  assert.match(html, /<th scope="col">Réel<\/th><th scope="col">Objectif<\/th>/);
  assert.match(html, /aria-label="p1 : 1 \(Réel\), 2 \(Objectif\)"/);
});

await dit('Courbe : le ton est un NOM de jeton (état ou famille), traduit en var(--socle-…)', () => {
  assert.equal(M.couleurTon('info'), 'var(--socle-etat-info)');
  assert.equal(M.couleurTon('neutre'), 'var(--socle-texte-1)');
  assert.equal(M.couleurTon('argent'), 'var(--socle-fam-argent)');
  assert.equal(M.couleurTon('critique'), 'var(--socle-etat-critique)');
  assert.equal(M.couleurTon(undefined), 'var(--socle-texte-1)');
  assert.equal(M.couleurTon('toString'), 'var(--socle-texte-1)');
  const html = rend(M.Courbe, { donnees: points(JEU), libelle: 'x', ton: 'argent' });
  assert.match(html, /style="--sc-g-c:var\(--socle-fam-argent\)"/);
});

await dit('MiniCourbe : 70 × 26, trait seul et point final, role="img" + résumé + valeurs en <desc>', () => {
  const html = rend(M.MiniCourbe, { valeurs: [3, 4, 3, 6, 5, 8], libelle: 'Encaissements' });
  assert.match(html, /<svg[^>]*role="img"/);
  assert.match(html, /width="70" height="26"/);
  assert.match(html, /aria-label="Encaissements\. Tendance, 6 points, de 3 à 8, dernier : 8"/);
  assert.match(html, /<desc id="[^"]+">3 ; 4 ; 3 ; 6 ; 5 ; 8<\/desc>/);
  assert.match(html, /aria-describedby="([^"]+)"/);
  const id = groupe(/aria-describedby="([^"]+)"/, html);
  assert.ok(html.includes(`<desc id="${id}">`), 'aria-describedby pointe vers le <desc>');
  assert.equal(compter(html, /class="sc-g__mini-ligne"/g), 1);
  assert.equal(compter(html, /class="sc-g__mini-fin"/g), 1);
  assert.ok(!/<text|class="sc-g__grille"|<button/.test(html), 'ni axe, ni grille, ni survol');
});

await dit('MiniCourbe : 0 point (trait de repos), 1 point, valeurs égales — sans NaN', () => {
  const vide = rend(M.MiniCourbe, { valeurs: [], libelle: 'Tendance' });
  assert.match(vide, /aria-label="Tendance\. Tendance, pas encore de données"/);
  assert.match(vide, /class="sc-g__repos"/);
  assert.ok(!/NaN|Infinity/.test(vide));
  const un = rend(M.MiniCourbe, { valeurs: [9], libelle: 'Tendance' });
  assert.match(un, /Tendance, 1 point : 9/);
  assert.ok(!/NaN|Infinity/.test(un));
  const egal = rend(M.MiniCourbe, { valeurs: [4, 4, 4], libelle: 'Tendance' });
  assert.ok(!/NaN|Infinity/.test(egal));
  assert.ok(nombres(egal, 'cy').every((y) => y === 13), 'la ligne plate court au milieu');
});

const MESURES = [0, 14, 9, 0, 21];
const SEMAINE = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.'];

await dit('Barres : role="img", libellé « Barres, 5 colonnes, de X à Y », tableau sr-only avec chaque valeur', () => {
  const html = rend(M.Barres, { donnees: points(MESURES, SEMAINE), libelle: 'Appels' });
  assert.equal(compter(html, /role="img"/g), 1);
  assert.match(html, /aria-label="Appels\. Barres, 5 colonnes, de 0 à 21"/);
  assert.match(html, /<table class="sr-only"/);
  assert.equal(compter(html, /<th scope="row">/g), 5);
  assert.match(html, /<th scope="row">mar\.<\/th><td>14<\/td>/);
  assert.ok(!/NaN|Infinity|undefined/.test(html));
});

await dit('Barres : la valeur 0 est un filet visible (2 px), jamais une colonne de hauteur nulle', () => {
  const html = rend(M.Barres, { donnees: points(MESURES, SEMAINE), libelle: 'Appels' });
  const colonnes = [...html.matchAll(/<rect class="sc-g__colonne"[^>]*>/g)].map((m) => m[0]);
  assert.equal(colonnes.length, 5);
  for (const c of colonnes) assert.ok(Number(groupe(/height="([\d.]+)"/, c)) >= 2, `colonne invisible : ${c}`);
  const zeros = colonnes.filter((c) => c.includes('data-zero="oui"'));
  assert.equal(zeros.length, 2);
  for (const z of zeros) assert.match(z, /height="2"/);
  const tout0 = rend(M.Barres, { donnees: points([0, 0, 0]), libelle: 'Rien' });
  assert.equal(compter(tout0, /data-zero="oui"/g), 3);
  assert.ok(!/NaN|Infinity/.test(tout0));
});

await dit('Barres : la plus grande est mise en valeur avec sa valeur au-dessus ; `miseEnValeur` choisit, null retire', () => {
  const html = rend(M.Barres, { donnees: points(MESURES, SEMAINE), libelle: 'Appels' });
  assert.equal(compter(html, /data-mise="oui"/g), 1);
  assert.match(html, /<rect class="sc-g__colonne"[^>]*data-mise="oui"/);
  assert.match(html, /<text class="sc-g__valeur"[^>]*>21<\/text>/);
  const choix = rend(M.Barres, { donnees: points(MESURES, SEMAINE), libelle: 'Appels', miseEnValeur: 1 });
  assert.match(choix, /<text class="sc-g__valeur"[^>]*>14<\/text>/);
  const aucune = rend(M.Barres, { donnees: points(MESURES, SEMAINE), libelle: 'Appels', miseEnValeur: null });
  assert.equal(compter(aucune, /data-mise="oui"/g), 0);
  assert.equal(compter(aucune, /sc-g__valeur/g), 0);
  assert.match(html, /style="--sc-g-c:var\(--socle-etat-info\)"/, 'la mise en valeur est « info » par défaut');
});

await dit('Barres : étiquettes d’axe en T4 (classe d’axe), colonnes en jeton, une zone cliquable par colonne', () => {
  const html = rend(M.Barres, { donnees: points(MESURES, SEMAINE), libelle: 'Appels' });
  assert.equal(compter(html, /<text class="sc-g__axe"/g), 5);
  assert.equal(compter(html, /<button /g), 5);
  assert.equal(compter(html, /tabindex="0"/g), 1);
  const sans = rend(M.Barres, { donnees: points(MESURES, SEMAINE), libelle: 'Appels', interactif: false });
  assert.equal(compter(sans, /<button|tabindex/g), 0);
});

await dit('Barres : valeurs négatives sous la ligne de base, vide → « Pas encore de données »', () => {
  const html = rend(M.Barres, { donnees: points([-4, 6, -2, 3]), libelle: 'Solde' });
  assert.equal(compter(html, /data-sens="bas"/g), 2);
  assert.ok(!/NaN|Infinity/.test(html));
  const vide = rend(M.Barres, { donnees: [], libelle: 'Solde' });
  assert.match(vide, /Barres, pas encore de données/);
  assert.match(vide, /<span>Pas encore de données<\/span>/);
});

const SEGMENTS = [
  { libelle: 'Marketing', valeur: 3000, ton: 'info' },
  { libelle: 'Matériel', valeur: 2000, ton: 'argent' },
  { libelle: 'Déplacements', valeur: 5000, ton: 'attention' },
];

await dit('Donut : 116 px, épaisseur 14, un cercle par segment, couleurs = jetons passés en props', () => {
  const html = rend(M.Donut, { segments: SEGMENTS, libelle: 'Dépenses', formater: M.formaterEuro });
  assert.match(html, /<svg[^>]*role="img"[^>]*viewBox="0 0 116 116"/);
  const cercles = [...html.matchAll(/<circle class="sc-g__segment"[^>]*>/g)].map((m) => m[0]);
  assert.equal(cercles.length, 3);
  for (const c of cercles) assert.match(c, /stroke-width="14"/);
  assert.match(cercles[0], /style="stroke:var\(--socle-etat-info\)"/);
  assert.match(cercles[1], /style="stroke:var\(--socle-fam-argent\)"/);
  assert.match(cercles[2], /style="stroke:var\(--socle-etat-attention\)"/);
  assert.match(html, /aria-label="Dépenses\. Répartition, 3 parts, total : 10\u202f000\u00a0€"/);
});

await dit('Donut : segments séparés de 2 px (mesuré sur les cercles rendus), qui bouclent le tour', () => {
  const html = rend(M.Donut, { segments: SEGMENTS, libelle: 'Dépenses' });
  const tour = 2 * Math.PI * ((116 - 14) / 2);
  const lus = [...html.matchAll(/<circle class="sc-g__segment"[^>]*>/g)].map((m) => ({
    visible: Number(groupe(/stroke-dasharray="([\d.]+) /, m[0])),
    debut: -Number(groupe(/stroke-dashoffset="(-?[\d.]+)"/, m[0])),
  }));
  for (let i = 0; i < lus.length; i += 1) {
    const suivant = i + 1 < lus.length ? lus[i + 1].debut : lus[0].debut + tour;
    const ecart = suivant - (lus[i].debut + lus[i].visible);
    assert.ok(Math.abs(ecart - 2) < 1e-6, `écart ${ecart} entre le segment ${i} et le suivant`);
  }
});

await dit('Donut : légende à droite (pastille + libellé + valeur), tableau sr-only avec les parts qui somment 100 %', () => {
  const html = rend(M.Donut, { segments: SEGMENTS, libelle: 'Dépenses', formater: M.formaterEuro });
  const legende = groupe(/<ul class="sc-g__legende sc-g__legende--donut"[^>]*>[\s\S]*?<\/ul>/, html, 0);
  assert.equal(compter(legende, /<li>/g), 3);
  for (const s of SEGMENTS) {
    assert.ok(legende.includes(`>${s.libelle}<`), `libellé ${s.libelle}`);
    assert.ok(legende.includes(`>${M.formaterEuro(s.valeur)}<`), `valeur de ${s.libelle}`);
  }
  assert.match(legende, /class="sc-g__pastille" style="background:var\(--socle-etat-info\)"/);
  const table = groupe(/<table class="sr-only"[\s\S]*?<\/table>/, html, 0);
  assert.equal(compter(table, /<th scope="row">/g), 3);
  const parts = [...table.matchAll(/<td>(\d+)\u00a0%<\/td>/g)].map((m) => Number(m[1]));
  assert.deepEqual(parts, [30, 20, 50]);
  assert.equal(parts.reduce((a, b) => a + b, 0), 100);
  assert.ok(!/NaN|Infinity/.test(html));
});

await dit('Donut : la part 33/33/34 d’un tiers somme encore 100 ; une part optionnelle dans la légende', () => {
  const html = rend(M.Donut, { segments: [1, 1, 1].map((valeur, i) => ({ libelle: `L${i}`, valeur, ton: 'jour' })), libelle: 'Tiers', afficherPart: true });
  const parts = [...html.matchAll(/<td>(\d+)\u00a0%<\/td>/g)].map((m) => Number(m[1]));
  assert.equal(parts.reduce((a, b) => a + b, 0), 100);
  assert.equal(compter(html, /class="sc-g__legende-part"/g), 3);
});

await dit('Donut : le centre est facultatif ; somme nulle → anneau vide et « Aucune donnée »', () => {
  const avec = rend(M.Donut, { segments: SEGMENTS, libelle: 'D', centre: h('span', null, '10 k') });
  assert.match(avec, /<div class="sc-g__donut-centre"><span>10 k<\/span><\/div>/);
  const sans = rend(M.Donut, { segments: SEGMENTS, libelle: 'D' });
  assert.ok(!/sc-g__donut-centre/.test(sans));
  const zero = rend(M.Donut, { segments: SEGMENTS.map((s) => ({ ...s, valeur: 0 })), libelle: 'Dépenses' });
  assert.match(zero, /Répartition, aucune donnée/);
  assert.match(zero, /<span class="sc-g__donut-vide">Aucune donnée<\/span>/);
  assert.equal(compter(zero, /class="sc-g__segment"/g), 0);
  assert.equal(compter(zero, /class="sc-g__piste"/g), 1);
  assert.ok(!/NaN|Infinity/.test(zero));
  const aucun = rend(M.Donut, { segments: [], libelle: 'Dépenses' });
  assert.match(aucun, /Aucune donnée/);
  assert.ok(!/NaN|Infinity/.test(aucun));
});

await dit('Donut : un seul segment non nul → l’anneau entier ; valeurs négatives ou illisibles comptées pour zéro', () => {
  const html = rend(M.Donut, { segments: [{ libelle: 'A', valeur: 5, ton: 'info' }, { libelle: 'B', valeur: -3, ton: 'argent' }, { libelle: 'C', valeur: Number.NaN, ton: 'creer' }], libelle: 'X' });
  assert.equal(compter(html, /class="sc-g__segment"/g), 1);
  const tour = 2 * Math.PI * 51;
  assert.ok(Math.abs(Number(groupe(/stroke-dasharray="([\d.]+) /, html)) - tour) < 1e-6);
  assert.ok(!/NaN|Infinity/.test(html));
});

await dit('Anneau : alias de AnneauProgression — 72 px, épaisseur 8, fond --socle-anneau-fond, valeur au centre en pour cent', () => {
  const html = rend(M.Anneau, { valeur: 0.8, libelle: 'Objectif du mois' });
  assert.match(html, /role="progressbar"/);
  assert.match(html, /aria-label="Objectif du mois"/);
  assert.match(html, /aria-valuenow="80"/);
  assert.match(html, new RegExp(`aria-valuetext="80${NBSP}%"`));
  assert.match(html, /<svg width="72" height="72" viewBox="0 0 72 72"/);
  assert.equal(compter(html, /stroke-width="8"/g), 2);
  assert.match(html, /class="sc-anneau__piste"[^>]*style="stroke:var\(--socle-anneau-fond\)"/);
  assert.match(html, new RegExp(`<span class="sc-anneau__centre">80${NBSP}%</span>`));
  const grand = rend(M.Anneau, { valeur: 0.5, libelle: 'H42', taille: 80 });
  assert.match(grand, /width="80" height="80"/);
  assert.ok(!/NaN|Infinity/.test(rend(M.Anneau, { valeur: Number.NaN, libelle: 'x' })));
  assert.match(rend(M.Anneau, { valeur: 3, libelle: 'x' }), /aria-valuenow="100"/);
});

await dit('Anneau : un ton d’état colore le trait ; centre libre possible', () => {
  const html = rend(M.Anneau, { valeur: 0.6, libelle: 'x', ton: 'succes' });
  assert.match(html, /class="sc-anneau__trait"[^>]*style="stroke:var\(--socle-etat-succes\)"/);
  assert.match(rend(M.Anneau, { valeur: 0.6, libelle: 'x' }), /<circle class="sc-anneau__trait"[^>]*stroke-dashoffset="[\d.]+"><\/circle>/, 'neutre : pas de style en ligne sur le trait');
  const centre = rend(M.Anneau, { valeur: 3 / 7, libelle: 'x', children: '3/7' });
  assert.match(centre, /sc-anneau__centre">3\/7</);
});

await dit('AnneauProgression : défaut inchangé — 44 px, épaisseur 4, aucun style en ligne sur le trait ni sur la piste', () => {
  const html = rend(M.AnneauProgression, { valeur: 0.5, libelle: 'Avancement', children: '1/2' });
  assert.match(html, /<svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">/);
  assert.equal(compter(html, /stroke-width="4"/g), 2);
  assert.ok(!/style="stroke/.test(html), 'aucune couleur en ligne par défaut');
  assert.match(html, /class="sc-anneau"/);
});

/* ── 5. Les sources ───────────────────────────────────────────────────────── */

const fichiersGraphiques = fs.readdirSync(path.join(racine, REP)).filter((f) => /\.(tsx?|css)$/.test(f)).map((f) => `${REP}/${f}`);
const css = sansCommentaires(lire(`${REP}/graphiques.css`));
const composants = fichiersGraphiques.filter((f) => /\.tsx?$/.test(f));

await dit('aucune couleur écrite en dur — ni dans graphiques.css, ni dans les composants (jetons seulement)', () => {
  assert.ok(composants.length >= 9, `${composants.length} fichiers de composants seulement`);
  for (const f of fichiersGraphiques) {
    const src = sansCommentaires(lire(f)).replace(/url\(#\$\{[^}]*\}\)/g, '');
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(src), `${f} : couleur hexadécimale`);
    assert.ok(!/\b(rgb|rgba|hsl|hsla|oklch|lab)\(/i.test(src), `${f} : couleur fonctionnelle`);
    assert.ok(!/(?:fill|stroke|color|background)(?:Color)?\s*[=:]\s*['"]?(white|black|red|green|blue|gray|grey|currentColor)\b/i.test(src), `${f} : couleur nommée`);
  }
});

await dit('aucune encre « discret » (trait-discret, trait-tres-discret, #77777c, #5f5f64) dans les graphiques', () => {
  for (const f of fichiersGraphiques) {
    const src = sansCommentaires(lire(f));
    assert.ok(!/trait-discret|trait-tres-discret|77777c|5f5f64|777777|5f5f5f/i.test(src), `${f} emploie une encre « discret »`);
  }
  // Et le texte des graphiques prend T1, T2, T3 ou T4 : jamais un fond ni une bordure.
  const texte = [...css.matchAll(/(?:^|[;{\s])(?:color|fill)\s*:\s*([^;}]+)/g)].map((m) => m[1].trim());
  const permis = /^(var\(--socle-texte-[123]\)|var\(--sc-g-c\)|var\(--socle-carte-bas\)|none|var\(--socle-colonne-graphique\)|color-mix\(in srgb, var\(--sc-g-c\) \d+%, var\(--socle-colonne-graphique\)\))$/;
  for (const t of texte) assert.ok(permis.test(t), `encre inattendue : ${t}`);
});

await dit('aucun texte sous 10,5 px : plancher des axes, et toute taille écrite dans la feuille ≥ 10,5', () => {
  assert.equal(M.TAILLE_AXE, 10.5);
  assert.match(css, /--sc-g-axe:\s*10\.5px/);
  for (const [, v] of css.matchAll(/font-size:\s*([\d.]+)px/g)) assert.ok(Number(v) >= 10.5, `font-size ${v}px`);
  for (const [, nom, v] of css.matchAll(/(--sc-g-(?:axe|valeur|legende|anneau-valeur)):\s*([\d.]+)px/g)) assert.ok(Number(v) >= 10.5, `${nom} = ${v}px`);
  for (const f of composants) assert.ok(!/fontSize/.test(sansCommentaires(lire(f))), `${f} pose une taille de texte en ligne`);
  const axes = groupe(/\.sc-g__axe\s*\{[^}]*\}/, css, 0);
  assert.match(axes, /fill:\s*var\(--socle-texte-3\)/, 'axes en T4');
  assert.match(axes, /font-size:\s*var\(--sc-g-axe\)/);
});

await dit('la colonne, la grille et le fond d’anneau sont les jetons de la spec', () => {
  assert.match(css, /\.sc-g__grille\s*\{[^}]*stroke:\s*var\(--socle-grille-graphique\)/);
  assert.match(css, /\.sc-g__colonne\s*\{[^}]*fill:\s*var\(--socle-colonne-graphique\)/);
  assert.match(css, /\.sc-g__piste\s*\{[^}]*stroke:\s*var\(--socle-anneau-fond\)/);
  assert.match(css, /--sc-g-trait:\s*2px/);
  assert.match(css, /--sc-g-pastille:\s*8px/);
  assert.match(css, /:root\[data-ambiance='noir'\]\s*\{[^}]*--sc-g-axe/, 'jetons --sc-g-* sous :root[data-ambiance=\'noir\']');
});

await dit('chaque var(--socle-…) employée existe dans noir.css, chaque var(--sc-g-…) est définie ici', () => {
  const noir = new Set([...jetons(lire('src/socle/noir.css')).keys(), ...[...sansCommentaires(lire('src/socle/noir.css')).matchAll(/(--socle-[\w-]+)\s*:/g)].map((m) => m[1])]);
  // Définis dans la feuille, ou posés en ligne par un composant (`'--sc-g-c'`, `'--sc-g-tour'`).
  const enLigne = composants.flatMap((f) => [...lire(f).matchAll(/'(--sc-g-[\w-]+)'/g)].map((m) => m[1]));
  const definis = new Set([...[...css.matchAll(/(--sc-g-[\w-]+)\s*:/g)].map((m) => m[1]), ...enLigne]);
  for (const f of fichiersGraphiques) {
    const src = sansCommentaires(lire(f));
    for (const [, nom] of src.matchAll(/var\((--socle-[\w-]*\w)[,)]/g)) assert.ok(noir.has(nom), `${f} : ${nom} n'existe pas dans noir.css`);
    for (const [, nom] of src.matchAll(/var\((--sc-g-[\w-]+)/g)) assert.ok(definis.has(nom), `${f} : ${nom} non défini`);
  }
  // Tous les tons possibles (états et sept familles) pointent vers un jeton qui existe.
  for (const ton of ['neutre', 'succes', 'attention', 'critique', 'info', 'jour', 'contacts', 'ecrire', 'argent', 'echanger', 'creer', 'outils']) {
    const nom = groupe(/var\((--[\w-]+)\)/, M.couleurTon(ton));
    assert.ok(noir.has(nom), `le ton « ${ton} » vise ${nom}, absent de noir.css`);
  }
});

await dit('animation d’entrée de 400 ms, coupée par prefers-reduced-motion (et par Mouvement « aucun », déjà géré dans src/index.css)', () => {
  assert.match(css, /--sc-g-trace:\s*400ms/);
  assert.equal(compter(css, /animation:[^;]*var\(--sc-g-trace\)/g) >= 5, true);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.sc-g \*\s*\{[^}]*animation:\s*none/);
  assert.match(sansCommentaires(lire('src/index.css')), /:root\[data-mouvement='aucun'\] \*[\s\S]*?animation-duration:\s*0\.01ms !important/);
});

await dit('les graphiques n’importent que le socle, src/lib, src/i18n et les bibliothèques ; aucun fichier partagé ne les importe', () => {
  for (const f of composants) {
    for (const [, spec] of sansCommentaires(lire(f)).matchAll(/from\s+'([^']+)'/g)) {
      if (!spec.startsWith('.')) {
        assert.ok(['react', 'framer-motion'].includes(spec), `${f} importe « ${spec} »`);
        continue;
      }
      const cible = path.relative(racine, path.resolve(racine, path.dirname(f), spec)).replace(/\\/g, '/');
      assert.ok(/^src\/(socle|lib|i18n)(\/|$)/.test(cible), `${f} importe ${cible}`);
    }
  }
  const dehors: string[] = [];
  (function marcher(dir: string) {
    for (const e of fs.readdirSync(path.join(racine, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        if (rel === 'src/socle') continue;
        marcher(rel);
      } else if (/\.(tsx?|css)$/.test(e.name) && /socle\/(ui\/)?graphiques|socle\/mots\/graphiques/.test(lire(rel))) dehors.push(rel);
    }
  })('src');
  const permis = new Set(['src/refonte/accueil/Ambiance.tsx']);
  for (const f of dehors) assert.ok(permis.has(f), `${f} importe les graphiques du socle`);
  const pkg = JSON.parse(lire('package.json')) as { dependencies?: Record<string, string> };
  assert.ok(!Object.keys(pkg.dependencies ?? {}).some((d) => /chart|d3|recharts|victory|nivo|visx/i.test(d)), 'aucune bibliothèque de graphiques');
});

await dit('mots : fr et en portent les mêmes clés et les mêmes {paramètres}, sans point d’exclamation', () => {
  const cles = Object.keys(M.DICTIONNAIRES_SOCLE.en).filter((k) => k.startsWith('graphique.'));
  assert.ok(cles.length >= 15, `${cles.length} clés`);
  for (const k of cles) {
    const en = M.DICTIONNAIRES_SOCLE.en[k];
    const fr = M.DICTIONNAIRES_SOCLE.fr[k];
    assert.ok(en && fr, `clé ${k} manquante`);
    const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    assert.equal(params(fr), params(en), `paramètres de ${k}`);
    assert.ok(!/!/.test(en + fr), `point d'exclamation dans ${k}`);
  }
  assert.equal(M.traduireSocle('en', 'graphique.courbe', { n: 3, min: 1, max: 9, dernier: 9 }), 'Line chart, 3 points, from 1 to 9, last: 9');
});

await dit('aucun robot, mascotte, émoji ni point d’exclamation dans les textes des graphiques', () => {
  for (const f of fichiersGraphiques.concat('src/socle/mots/graphiques.ts')) {
    const src = sansCommentaires(lire(f));
    assert.ok(!/\p{Extended_Pictographic}/u.test(src), `${f} : émoji`);
    assert.ok(!/(robot|mascotte|confetti)/i.test(src), `${f} : mascotte`);
  }
});

await dit('package.json : le script check:socle-graphiques existe, sur le modèle de check:socle', () => {
  const pkg = JSON.parse(lire('package.json')) as { scripts: Record<string, string> };
  assert.equal(pkg.scripts['check:socle-graphiques'], pkg.scripts['check:socle'].replace('check-socle.ts', 'check-socle-graphiques.ts'));
});

fin();
