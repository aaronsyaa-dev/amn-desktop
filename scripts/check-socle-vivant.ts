/**
 * Contrôle du groupe « VIVANT » du socle et de la COUCHE DE MOUVEMENT commune (v3, 01-SOCLE-DESIGN §0.2 et §0.4).
 * Sans navigateur, sans build, sans réseau : les composants sont rendus en HTML statique, les feuilles sont lues.
 *
 *   1. LA COUCHE : chaque cote du §0.2 dans `mouvement.css` (et la même dans `couche-mouvement.ts`), une règle par
 *      nom de `data-mvt`, tout coupé sous `prefers-reduced-motion` et en « aucun », seuls les fondus courts en
 *      « réduit », jamais de remplissage `forwards`/`both` (l'état final est le style normal).
 *   2. LES BRIQUES BRANCHÉES : barre, anneau, carte, graphiques posent `data-mvt` ; graphiques.css n'anime plus rien.
 *   3. LES COMPOSANTS : balisage et rôles, libellés jamais portés par la couleur seule, clavier, cibles de 34 px.
 *   4. LES SOURCES : jetons seulement (aucune couleur en dur dans les .tsx ni les feuilles), police monospace du
 *      socle, mots fr/en, chargement par Ambiance.tsx seulement, aucun fichier partagé qui les importe.
 *
 *   npm run check:socle-vivant
 */
import fs from 'node:fs';
import path from 'node:path';
import { assert, chargerRendu, creerEssais, jetons, lire, racine, sansCommentaires } from './lib/essai-socle.ts';

const { dit, fin } = creerEssais('Socle — vivant et couche de mouvement (v3)');

const REP = 'src/socle/ui/vivant';
const couche = sansCommentaires(lire('src/socle/mouvement.css'));
const vivantCss = sansCommentaires(lire(`${REP}/vivant.css`));
const noirBrut = lire('src/socle/noir.css');
const noir = sansCommentaires(noirBrut);
const compter = (s: string, re: RegExp): number => (s.match(re) ?? []).length;
const ms = (nom: string, css = couche): number => {
  const m = new RegExp(`${nom}:\\s*([\\d.]+)(ms|s)\\s*;`).exec(css);
  assert.ok(m, `${nom} introuvable`);
  return Number(m[1]) * (m[2] === 's' ? 1000 : 1);
};
const px = (nom: string, css = couche): number => {
  const m = new RegExp(`${nom}:\\s*([\\d.]+)px\\s*;`).exec(css);
  assert.ok(m, `${nom} introuvable`);
  return Number(m[1]);
};

/* ═══════════════════════  1. La couche de mouvement  ═══════════════════════ */

type Niveau = 'complet' | 'reduit' | 'aucun';
const C = await chargerRendu<{
  COTES_MOUVEMENT: Record<string, Record<string, number>>;
  COURBE_MOUVEMENT: readonly number[];
  rangMouvement: (r: number) => number;
  styleRang: (r: number, s?: Record<string, unknown>) => Record<string, unknown>;
  entreeCarte: (r?: number) => { 'data-mvt': string; style: Record<string, unknown> };
  arriveeLigne: () => Record<string, string>;
  decalageBarres: (n: number) => number;
  dureeFlux: (d?: number) => number;
  niveauVivant: (n: Niveau, s: boolean) => Niveau;
  entreeMotion: (r: number, n: Niveau) => Record<string, unknown>;
}>("import { COTES_MOUVEMENT, COURBE_MOUVEMENT, rangMouvement, styleRang, entreeCarte, arriveeLigne, decalageBarres, dureeFlux, niveauVivant, entreeMotion } from '../src/socle/couche-mouvement';", [
  'COTES_MOUVEMENT', 'COURBE_MOUVEMENT', 'rangMouvement', 'styleRang', 'entreeCarte', 'arriveeLigne', 'decalageBarres', 'dureeFlux', 'niveauVivant', 'entreeMotion',
]);

await dit('mouvement.css : les cotes du §0.2, valeur pour valeur', () => {
  assert.match(couche, /--sc-mvt-courbe:\s*cubic-bezier\(0\.2, 0\.7, 0\.2, 1\)/, 'courbe cubic-bezier(.2,.7,.2,1)');
  assert.equal(ms('--sc-mvt-entree'), 500);
  assert.equal(px('--sc-mvt-entree-montee'), 6);
  assert.equal(ms('--sc-mvt-entree-decalage'), 45);
  assert.equal(ms('--sc-mvt-progression'), 900);
  assert.equal(ms('--sc-mvt-progression-depart'), 200);
  assert.equal(ms('--sc-mvt-anneau'), 1100);
  assert.equal(ms('--sc-mvt-anneau-depart'), 250);
  assert.equal(ms('--sc-mvt-barre'), 700);
  const decalage = ms('--sc-mvt-barre-decalage');
  assert.ok(decalage >= 22 && decalage <= 40, `décalage des barres ${decalage} ms hors de 22 à 40`);
  assert.equal(ms('--sc-mvt-trace'), 1300);
  assert.equal(ms('--sc-mvt-point-final'), 1200);
  assert.ok(ms('--sc-mvt-aire-depart') + ms('--sc-mvt-aire') <= 1300, 'l’aire finit avec le tracé (1,3 s)');
  assert.ok(ms('--sc-mvt-aire-depart') > 0, 'l’aire suit le tracé');
  assert.equal(ms('--sc-mvt-voyant'), 2200);
  const flux = ms('--sc-mvt-flux');
  assert.ok(flux >= 1200 && flux <= 2200, `flux ${flux} ms`);
  const balayage = ms('--sc-mvt-balayage');
  assert.ok(balayage >= 6000 && balayage <= 7000, `balayage ${balayage} ms`);
  assert.equal(ms('--sc-mvt-curseur'), 1100);
  assert.equal(ms('--sc-mvt-arrivee'), 450);
  assert.equal(px('--sc-mvt-arrivee-glisse'), 8);
  const survol = ms('--sc-mvt-survol');
  assert.ok(survol >= 150 && survol <= 200, `survol ${survol} ms`);
  assert.match(couche, /:root\[data-ambiance='noir'\]\s*\{[^}]*--sc-mvt-entree:/, 'jetons --sc-mvt-* sous l’ambiance noire');
});

await dit('couche-mouvement.ts dit les mêmes cotes que la feuille (pour framer-motion)', () => {
  const k = C.COTES_MOUVEMENT;
  assert.equal(k.entree.duree, ms('--sc-mvt-entree'));
  assert.equal(k.entree.montee, px('--sc-mvt-entree-montee'));
  assert.equal(k.entree.decalage, ms('--sc-mvt-entree-decalage'));
  assert.equal(k.entree.max, 14);
  assert.equal(k.progression.duree, ms('--sc-mvt-progression'));
  assert.equal(k.progression.depart, ms('--sc-mvt-progression-depart'));
  assert.equal(k.anneau.duree, ms('--sc-mvt-anneau'));
  assert.equal(k.anneau.depart, ms('--sc-mvt-anneau-depart'));
  assert.equal(k.barres.duree, ms('--sc-mvt-barre'));
  assert.deepEqual([k.barres.decalageMin, k.barres.decalageMax], [22, 40]);
  assert.equal(k.courbe.trace, ms('--sc-mvt-trace'));
  assert.equal(k.courbe.pointFinal, ms('--sc-mvt-point-final'));
  assert.equal(k.voyant.duree, ms('--sc-mvt-voyant'));
  assert.equal(k.flux.defaut, ms('--sc-mvt-flux'));
  assert.deepEqual([k.flux.min, k.flux.max], [1200, 2200]);
  assert.equal(k.balayage.duree, ms('--sc-mvt-balayage'));
  assert.equal(k.curseur.duree, ms('--sc-mvt-curseur'));
  assert.equal(k.arrivee.duree, ms('--sc-mvt-arrivee'));
  assert.equal(k.arrivee.glisse, px('--sc-mvt-arrivee-glisse'));
  assert.equal(k.survol.duree, ms('--sc-mvt-survol'));
  assert.equal(k.fonduCourt.duree, ms('--sc-mvt-fondu-court'));
  assert.deepEqual([...C.COURBE_MOUVEMENT], [0.2, 0.7, 0.2, 1]);
});

const NOMS = ['entree', 'cascade', 'arrivee', 'fondu', 'remplit', 'anneau', 'arc', 'pousse', 'trace', 'aire', 'point-final', 'onde', 'flux', 'balayage', 'curseur'];
const CONTINUS = ['onde', 'flux', 'balayage', 'curseur'];
/** Les règles hors des blocs de coupure : la feuille avant « réduit ». */
const base = couche.split(/\[data-mouvement='reduit'\]/)[0];

await dit('une règle par nom de data-mvt (et de data-mvt-survol), chacune animée par ses jetons', () => {
  for (const n of NOMS) assert.match(base, new RegExp(`\\[data-mvt='${n}'\\][^{]*\\{[^}]*animation`), `data-mvt="${n}" sans règle`);
  for (const n of ['carte', 'bouton', 'ligne', 'noeud']) assert.match(base, new RegExp(`\\[data-mvt-survol='${n}'\\]:hover`), `survol ${n}`);
  assert.match(base, /\[data-mvt-survol='carte'\]:hover\s*\{\s*border-color:\s*var\(--socle-bord-survol\)/);
  assert.match(base, /\[data-mvt-survol='bouton'\]:hover\s*\{\s*background-color:\s*var\(--socle-survol\)/);
  assert.match(base, /\[data-mvt-survol='ligne'\]:hover\s*\{\s*background-color:\s*var\(--socle-ligne-survol\)/);
  assert.match(base, /\[data-mvt-survol='noeud'\]:hover\s*\{\s*transform:\s*translateY\(-2px\)/);
  // Les boucles tournent sans fin, les entrées une seule fois.
  for (const n of CONTINUS) assert.match(base, new RegExp(`\\[data-mvt='${n}'\\](::after)?\\s*\\{[^}]*animation:[^;]*infinite`), `${n} : boucle`);
  for (const n of NOMS.filter((x) => !CONTINUS.includes(x) && x !== 'cascade')) assert.doesNotMatch(/\[data-mvt='[^']+'\][^{]*\{[^}]*\}/.exec(base.slice(base.indexOf(`[data-mvt='${n}']`)))?.[0] ?? '', /infinite/, `${n} ne boucle pas`);
  // L'entrée : 45 ms × rang, rang borné à 13 (14 cartes au plus) ; la cascade numérote jusqu'à 14.
  assert.match(base, /calc\(min\(var\(--sc-mvt-rang, 0\), 13\) \* var\(--sc-mvt-entree-decalage\)\)/);
  assert.match(base, /\[data-mvt='cascade'\] > :nth-child\(n \+ 14\) \{ --sc-mvt-rang: 13; \}/);
  assert.match(base, /@keyframes sc-mvt-entree \{ from \{ opacity: 0; transform: translateY\(var\(--sc-mvt-entree-montee\)\); \} \}/);
  assert.match(base, /@keyframes sc-mvt-arrivee \{ from \{ opacity: 0; transform: translateX\(calc\(-1 \* var\(--sc-mvt-arrivee-glisse\)\)\); \} \}/);
});

await dit('l’état final est le style normal : jamais de remplissage forwards ni both, rien n’est caché une fois fini', () => {
  assert.doesNotMatch(couche, /\b(forwards|both)\b/, 'un remplissage forwards/both garderait l’état d’animation');
  for (const [, nom, corps] of couche.matchAll(/@keyframes ([\w-]+)\s*\{([\s\S]*?\})\s*\}/g)) {
    // Un « to » explicite ne ramène qu'à l'état normal (plein, tracé, sans décalage) ou fait tourner une boucle.
    const to = /\bto\s*\{([^}]*)\}/.exec(corps)?.[1] ?? '';
    if (to) assert.match(to, /^\s*(clip-path: inset\(0 0 0 0\)|stroke-dashoffset: 0|opacity: 0; transform: scale\([\d.]+\)|stroke-dashoffset: calc\(-1 \* var\(--sc-mvt-flux-pas, 10px\)\)|transform: rotate\(360deg\));\s*$/, `${nom} : « to » inattendu (${to.trim()})`);
  }
});

const REDUIT = (couche.split(/@media/)[0].match(/:root\[data-ambiance='noir'\]\[data-mouvement='reduit'\][^{]*\{[^}]*\}/g) ?? []).join('\n');
const AUCUN = (couche.match(/:root\[data-ambiance='noir'\]\[data-mouvement='aucun'\][^{]*\{[^}]*\}/g) ?? []).join('\n');
const SYSTEME = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*)\}\s*$/.exec(couche)?.[1] ?? '';

await dit('prefers-reduced-motion : tout est coupé (entrées, boucles, onde, cascade, survol qui monte), quel que soit le réglage', () => {
  assert.ok(SYSTEME.length > 0, 'bloc @media (prefers-reduced-motion: reduce) absent de mouvement.css');
  assert.match(SYSTEME, /:root\[data-ambiance='noir'\] \[data-mvt\],/);
  assert.match(SYSTEME, /:root\[data-ambiance='noir'\]\[data-mouvement\] \[data-mvt\],/, 'plus fort que les fondus de « réduit »');
  assert.match(SYSTEME, /\[data-mvt='onde'\]::after[^{]*\{\s*animation:\s*none/);
  assert.match(SYSTEME, /\[data-mvt='cascade'\] > \*/);
  assert.match(SYSTEME, /\[data-mvt-survol='noeud'\]:hover \{ transform: none; \}/);
  assert.match(SYSTEME, /\[data-mvt-survol\] \{ transition: none; \}/);
});

await dit('Mouvement « aucun » (data-mouvement sur <html>) : tout est coupé ; et RacineSocle pose bien l’attribut', () => {
  assert.match(AUCUN, /\[data-mouvement='aucun'\] \[data-mvt\],[\s\S]*?\{\s*animation:\s*none/);
  assert.match(AUCUN, /\[data-mvt='onde'\]::after/);
  assert.match(AUCUN, /\[data-mvt-survol\] \{ transition: none; \}/);
  assert.match(AUCUN, /\[data-mvt-survol='noeud'\]:hover \{ transform: none; \}/);
  assert.match(lire('src/edition/socle.internal.tsx'), /document\.documentElement\.dataset\.mouvement = niveau/);
});

await dit('Mouvement « réduit » : seuls restent les fondus courts — les tracés, poussées, remplissages et boucles sont coupés', () => {
  const fondus = /([^{}]*)\{\s*animation:\s*sc-mvt-fondu var\(--sc-mvt-fondu-court\) ease-out backwards;\s*\}/.exec(REDUIT);
  assert.ok(fondus, 'pas de bloc de fondus courts en « réduit »');
  for (const n of ['entree', 'arrivee', 'aire', 'point-final']) assert.ok(fondus[1].includes(`[data-mvt='${n}']`), `« ${n} » devient un fondu court`);
  assert.ok(fondus[1].includes("[data-mvt='cascade'] > *"), 'la cascade devient un fondu court');
  const coupes = /([^{}]*)\{\s*animation:\s*none;\s*\}/.exec(REDUIT);
  assert.ok(coupes, 'pas de bloc de coupure en « réduit »');
  for (const n of ['remplit', 'anneau', 'arc', 'pousse', 'trace', 'flux', 'balayage', 'curseur']) assert.ok(coupes[1].includes(`[data-mvt='${n}']`), `« ${n} » coupé en réduit`);
  assert.ok(coupes[1].includes("[data-mvt='onde']::after"), 'l’onde coupée en réduit');
  assert.match(REDUIT, /\[data-mvt-survol='noeud'\]:hover \{ transform: none; \}/);
  assert.equal(ms('--sc-mvt-fondu-court'), 200);
});

await dit('les outils : rang borné à 0–13, décalage des barres 22–40 ms, flux 1,2–2,2 s, entrée framer-motion par niveau', () => {
  assert.deepEqual([-3, 0, 5, 13, 14, 40, Number.NaN].map(C.rangMouvement), [0, 0, 5, 13, 13, 13, 0]);
  assert.deepEqual(C.styleRang(20, { color: 'x' }), { color: 'x', '--sc-mvt-rang': 13 });
  assert.deepEqual(C.entreeCarte(2), { 'data-mvt': 'entree', style: { '--sc-mvt-rang': 2 } });
  assert.deepEqual(C.arriveeLigne(), { 'data-mvt': 'arrivee' });
  for (let n = 0; n <= 120; n += 1) {
    const d = C.decalageBarres(n);
    assert.ok(d >= 22 && d <= 40, `${n} barres : ${d} ms`);
  }
  assert.equal(C.decalageBarres(7), 40);
  assert.equal(C.decalageBarres(30), 22);
  assert.deepEqual([undefined, 100, 1500, 9000, Number.NaN].map((d) => C.dureeFlux(d)), [1600, 1200, 1500, 2200, 1600]);
  assert.equal(C.niveauVivant('complet', true), 'aucun', 'le système l’emporte');
  assert.equal(C.niveauVivant('reduit', false), 'reduit');
  assert.deepEqual(C.entreeMotion(3, 'aucun'), { initial: false });
  assert.deepEqual((C.entreeMotion(3, 'reduit') as { initial: unknown }).initial, { opacity: 0 });
  const complet = C.entreeMotion(3, 'complet') as { initial: { y: number }; transition: { duration: number; delay: number } };
  assert.equal(complet.initial.y, 6);
  assert.equal(complet.transition.duration, 0.5);
  assert.ok(Math.abs(complet.transition.delay - 0.135) < 1e-9);
});

/* ═══════════════════════  2. Les briques branchées  ═══════════════════════ */

const K = await chargerRendu<Record<string, any>>( // eslint-disable-line @typescript-eslint/no-explicit-any
  [
    "import { BarreProgression, AnneauProgression, Carte, Anneau, Courbe, Barres, Donut, MiniCourbe, LiveDot, Caret, Severity, NIVEAUX_SEVERITE, FilterChips, Gauge, HeatCell, opaciteChaleur, FlowLine, cheminFlux, InlineSuggestion } from '../src/socle/ui';",
    "import { DICTIONNAIRES_SOCLE } from '../src/socle/i18n';",
  ].join('\n'),
  ['BarreProgression', 'AnneauProgression', 'Carte', 'Anneau', 'Courbe', 'Barres', 'Donut', 'MiniCourbe', 'LiveDot', 'Caret', 'Severity', 'NIVEAUX_SEVERITE', 'FilterChips', 'Gauge', 'HeatCell', 'opaciteChaleur', 'FlowLine', 'cheminFlux', 'InlineSuggestion', 'DICTIONNAIRES_SOCLE'],
);
const { h, rendre } = K;
const rend = (c: unknown, p: Record<string, unknown> = {}, ...e: unknown[]): string => rendre(h(c, p, ...e));
const svg = (...e: unknown[]): string => rendre(h('svg', null, ...e));

await dit('BarreProgression et AnneauProgression : remplissage et tracé de la couche, coupables par anime={false}', () => {
  assert.match(rend(K.BarreProgression, { valeur: 0.4, libelle: 'x' }), /<span data-mvt="remplit" style="width:40%">/);
  assert.doesNotMatch(rend(K.BarreProgression, { valeur: 0.4, libelle: 'x', anime: false }), /data-mvt/);
  const a = rend(K.AnneauProgression, { valeur: 0.5, libelle: 'x', taille: 44, epaisseur: 4 });
  assert.match(a, /class="sc-anneau" style="width:44px;height:44px;--sc-mvt-tour:125\.66/);
  assert.match(a, /<circle class="sc-anneau__trait"[^>]*data-mvt="anneau"[^>]*stroke-dashoffset=/);
  assert.doesNotMatch(rend(K.AnneauProgression, { valeur: 0.5, libelle: 'x', anime: false }), /data-mvt|--sc-mvt-tour/);
});

await dit('Carte : rang → entrée de la couche (data-mvt="entree", --sc-mvt-rang borné) ; sans rang, rien ne change', () => {
  assert.match(rend(K.Carte, { rang: 3, titre: 'T' }, 'x'), /data-mvt="entree" style="--sc-mvt-rang:3"/);
  assert.match(rend(K.Carte, { rang: 30 }, 'x'), /--sc-mvt-rang:13/);
  assert.doesNotMatch(rend(K.Carte, { titre: 'T' }, 'x'), /data-mvt|style=/);
});

await dit('graphiques : courbe (trace, aire, point final), barres (pousse + rang), donut (arc), anneau ; graphiques.css n’anime plus rien', () => {
  const c = rend(K.Courbe, { donnees: [1, 4, 2, 5].map((v, i) => ({ etiquette: `p${i}`, valeur: v })), libelle: 'x' });
  assert.match(c, /class="sc-g__ligne"[^>]*pathLength="1" data-mvt="trace"/);
  assert.match(c, /class="sc-g__aire"[^>]*data-mvt="aire"/);
  assert.match(c, /class="sc-g__fin"[^>]*data-mvt="point-final"/);
  const b = rend(K.Barres, { donnees: [1, 2, 3, 4].map((v, i) => ({ etiquette: `p${i}`, valeur: v })), libelle: 'x' });
  for (let i = 0; i < 4; i += 1) assert.match(b, new RegExp(`data-mvt="pousse" style="--sc-mvt-rang:${i}"`));
  assert.match(rend(K.Donut, { segments: [{ libelle: 'A', valeur: 2, ton: 'info' }], libelle: 'x' }), /--sc-mvt-tour:[\d.]+[\s\S]*data-mvt="arc"/);
  assert.match(rend(K.Anneau, { valeur: 0.3, libelle: 'x' }), /data-mvt="anneau"/);
  const g = sansCommentaires(lire('src/socle/ui/graphiques/graphiques.css'));
  assert.doesNotMatch(g, /@keyframes|animation(?:-name)?\s*:(?!\s*none\b)/);
  assert.doesNotMatch(sansCommentaires(lire('src/socle/ui/briques.css')), /@keyframes sc-mvt/, 'la couche ne se recopie pas');
});

/* ═══════════════════════  3. Les composants  ═══════════════════════ */

await dit('LiveDot : un point décoratif + un libellé toujours présent (lu, ou affiché), l’onde de la couche en option', () => {
  const r = rend(K.LiveDot, { ton: 'critique', libelle: 'Alerte en cours' });
  assert.match(r, /^<span class="sc-voyant" data-socle="voyant" data-ton="critique">/);
  assert.match(r, /<span aria-hidden="true" class="sc-voyant__point" data-mvt="onde"><\/span>/);
  assert.match(r, /<span class="sr-only">Alerte en cours<\/span>/, 'le libellé est lu même s’il n’est pas affiché');
  const v = rend(K.LiveDot, { libelle: 'En direct', afficherLibelle: true, onde: false, taille: 6, halo: false });
  assert.match(v, /data-ton="ok" data-taille="6"/);
  assert.match(v, /<span class="sc-voyant__libelle">En direct<\/span>/);
  assert.doesNotMatch(v, /data-mvt/);
  assert.match(v, /data-halo="non"/);
  assert.match(vivantCss, /\.sc-voyant__point \{[^}]*width:\s*var\(--sc-v-voyant\)[^}]*box-shadow:\s*0 0 0 var\(--sc-v-halo\) color-mix\(in srgb, var\(--sc-v-c, var\(--socle-etat-succes\)\) 14%, transparent\)/);
  assert.equal(px('--sc-v-voyant', vivantCss), 8);
  assert.equal(px('--sc-v-halo', vivantCss), 4);
});

await dit('Caret : décoratif (aria-hidden), clignote par la couche (data-mvt="curseur")', () => {
  assert.equal(rend(K.Caret), '<span aria-hidden="true" class="sc-curseur" data-socle="curseur" data-mvt="curseur"></span>');
  assert.match(vivantCss, /\.sc-curseur \{[^}]*background:\s*var\(--socle-texte-1\)/);
});

await dit('Severity : le mot dit le niveau (fr et en), en capitales monospace 11 px / 600, couleur d’état redite', () => {
  const attendus: Record<string, [string, string]> = { critique: ['Critique', 'Critical'], moyen: ['Moyen', 'Medium'], faible: ['Faible', 'Low'], info: ['Info', 'Info'], ok: ['OK', 'OK'] };
  assert.deepEqual([...K.NIVEAUX_SEVERITE], Object.keys(attendus));
  for (const [n, [fr, en]] of Object.entries(attendus)) {
    assert.equal(rend(K.Severity, { niveau: n }), `<span class="sc-severite" data-socle="severite" data-niveau="${n}">${fr}</span>`);
    assert.equal(K.DICTIONNAIRES_SOCLE.en[`vivant.niveau.${n}`], en);
  }
  assert.match(rend(K.Severity, { niveau: 'critique' }, 'P1'), />P1</);
  const bloc = /\.sc-severite \{[^}]*\}/.exec(vivantCss)?.[0] ?? '';
  for (const re of [/font-family:\s*var\(--socle-police-mono\)/, /font-size:\s*var\(--sc-v-severite\)/, /font-weight:\s*600/, /text-transform:\s*uppercase/, /font-variant-numeric:\s*tabular-nums/]) assert.match(bloc, re);
  assert.equal(px('--sc-v-severite', vivantCss), 11);
  const couleurs: Record<string, string> = { critique: 'critique', moyen: 'attention', faible: 'info', info: 'info', ok: 'succes' };
  for (const [n, etat] of Object.entries(couleurs)) assert.match(vivantCss, new RegExp(`\\.sc-severite\\[data-niveau='${n}'\\][^{]*\\{ --sc-v-c: var\\(--socle-etat-${etat}\\); \\}`), n);
  const j = jetons(noirBrut);
  assert.deepEqual(['critique', 'attention', 'info', 'succes'].map((e) => j.get(`--socle-etat-${e}`)), ['#e08a80', '#e0b35a', '#8aa4d6', '#8fbf7a']);
});

const PUCES = [{ cle: 'tout', libelle: 'Tout', compteur: 12 }, { cle: 'critique', libelle: 'Critiques', compteur: 2 }, { cle: 'faible', libelle: 'Faibles' }];

await dit('FilterChips : radiogroup nommé, radios, une seule tabulation, aria-checked (pas la couleur), compteur', () => {
  const r = rend(K.FilterChips, { libelle: 'Filtrer par niveau', puces: PUCES, valeur: 'critique', onChange: () => undefined });
  assert.match(r, /^<div role="radiogroup" aria-label="Filtrer par niveau" class="sc-puces" data-socle="puces">/);
  assert.equal(compter(r, /role="radio"/g), 3);
  assert.equal(compter(r, /tabindex="0"/g), 1);
  assert.equal(compter(r, /aria-checked="true"/g), 1);
  assert.match(r, /aria-checked="true" tabindex="0"[^>]*><span class="sc-puce__corps">Critiques/);
  assert.match(r, /<b class="sc-puce__compteur" title="12 éléments">12<\/b>/);
  const perdu = rend(K.FilterChips, { libelle: 'x', puces: PUCES, valeur: 'absente', onChange: () => undefined });
  assert.equal(compter(perdu, /tabindex="0"/g), 1, 'une valeur inconnue laisse la première puce atteignable');
  assert.equal(compter(perdu, /aria-checked="true"/g), 0);
  assert.match(sansCommentaires(lire(`${REP}/FilterChips.tsx`)), /cleSuivante\(cles, p\.cle, e\.key\)/, 'flèches, Début, Fin');
});

await dit('FilterChips : 12 px, active fond #242427 (--socle-segment-actif) et 600, focus visible, cible de 34 px', () => {
  assert.equal(px('--sc-v-puce-texte', vivantCss), 12);
  assert.equal(px('--sc-v-cible', vivantCss), 34);
  assert.match(vivantCss, /\.sc-puce \{[^}]*min-height:\s*var\(--sc-v-cible\)/);
  assert.match(vivantCss, /\.sc-puce__corps \{[^}]*font-size:\s*var\(--sc-v-puce-texte\)/);
  assert.match(vivantCss, /\.sc-puce\[aria-checked='true'\] \.sc-puce__corps \{[^}]*background:\s*var\(--socle-segment-actif\)[^}]*color:\s*var\(--socle-texte-1\)[^}]*font-weight:\s*600/);
  assert.equal(jetons(noirBrut).get('--socle-segment-actif'), '#242427');
  assert.match(vivantCss, /\.sc-puce:focus-visible \.sc-puce__corps \{\s*outline:\s*2px solid var\(--socle-texte-1\);\s*outline-offset:\s*2px;/);
});

await dit('Gauge : demi-jauge 180° en SVG, progressbar 0–100 redite en mots, arc de la couche, bornes et NaN', () => {
  const r = rend(K.Gauge, { valeur: 72, libelle: 'Score de conformité', ton: 'ok' });
  assert.match(r, /role="progressbar" aria-label="Score de conformité" aria-valuemin="0" aria-valuemax="100" aria-valuenow="72" aria-valuetext="72 sur 100"/);
  assert.match(r, /data-ton="ok"/);
  assert.match(r, /<svg aria-hidden="true" focusable="false" width="120" height="64" viewBox="0 0 120 64"/);
  assert.match(r, /style="--sc-mvt-tour:100"/);
  assert.equal(compter(r, /d="M 4 60 A 56 56 0 0 1 116 60"/g), 2, 'piste et arc : le même demi-cercle de gauche à droite par le haut');
  assert.match(r, /class="sc-jauge__arc"[^>]*pathLength="100" stroke-dasharray="72 100" data-mvt="arc"/);
  assert.match(r, /<span class="sc-jauge__valeur">72<\/span>/);
  const zero = rend(K.Gauge, { valeur: Number.NaN, libelle: 'x' });
  assert.match(zero, /aria-valuenow="0"/);
  assert.doesNotMatch(zero, /sc-jauge__arc|NaN/);
  assert.match(rend(K.Gauge, { valeur: 340, libelle: 'x' }), /aria-valuenow="100"[\s\S]*stroke-dasharray="100 100"/);
  assert.doesNotMatch(rend(K.Gauge, { valeur: 50, libelle: 'x', anime: false }), /data-mvt/);
  assert.match(rend(K.Gauge, { valeur: 50, libelle: 'x' }, 'B+'), /sc-jauge__valeur">B\+</);
  assert.match(vivantCss, /\.sc-jauge__piste \{ stroke: var\(--socle-anneau-fond\); \}/);
});

await dit('HeatCell : opacité .18 → .90 de la couleur d’état, nommée et titrée ; cliquable = bouton de 34 px', () => {
  assert.deepEqual([0, 0.5, 1, -1, 3, Number.NaN].map(K.opaciteChaleur), [0.18, 0.54, 0.9, 0.18, 0.9, 0.18]);
  const r = rend(K.HeatCell, { intensite: 1, libelle: 'Mardi, 14 h : 6 alertes', ton: 'attention' });
  assert.match(r, /^<span role="img" aria-label="Mardi, 14 h : 6 alertes" title="Mardi, 14 h : 6 alertes" class="sc-chaleur" data-socle="chaleur" data-ton="attention" style="--sc-v-opacite:0\.9"/);
  const b = rend(K.HeatCell, { intensite: 0, libelle: 'Lundi', onClick: () => undefined, taille: 22 }, '0');
  assert.match(b, /^<button type="button" aria-label="Lundi" title="Lundi" class="sc-chaleur sc-focus"[^>]*data-ton="critique" style="--sc-v-opacite:0\.18;width:22px;height:22px">/);
  assert.match(b, /<span class="sc-chaleur__valeur">0<\/span>/);
  assert.match(vivantCss, /\.sc-chaleur::before \{[^}]*background:\s*var\(--sc-v-c\);\s*opacity:\s*var\(--sc-v-opacite, 0\.18\)/);
  assert.match(vivantCss, /button\.sc-chaleur \{ min-width: var\(--sc-v-cible\); min-height: var\(--sc-v-cible\);/);
});

await dit('FlowLine : un <path> pointillé ; il n’avance (data-mvt="flux") que s’il est actif ; nommé = <title>, sinon décoratif', () => {
  assert.equal(K.cheminFlux([0, 10], [100, 50]), 'M 0 10 C 50 10, 50 50, 100 50');
  const actif = svg(h(K.FlowLine, { de: [0, 10], a: [100, 50], ton: 'info', libelle: 'Facture vers paiement' }));
  assert.match(actif, /<path d="M 0 10 C 50 10, 50 50, 100 50" class="sc-flux" data-socle="flux" data-ton="info" data-mvt="flux" stroke-width="1\.5" style="--sc-mvt-flux-duree:1600ms" role="img" aria-label="Facture vers paiement"><title>Facture vers paiement<\/title><\/path>/);
  const immobile = svg(h(K.FlowLine, { d: 'M 0 0 L 10 0', actif: false, duree: 9000 }));
  assert.match(immobile, /data-actif="non"/);
  assert.doesNotMatch(immobile, /data-mvt/);
  assert.match(immobile, /--sc-mvt-flux-duree:2200ms/);
  assert.match(immobile, /aria-hidden="true"/);
  assert.equal(rendre(h(K.FlowLine, {})), '', 'sans chemin, rien');
  assert.match(vivantCss, /\.sc-flux \{[^}]*stroke-dasharray:\s*4 6/);
  assert.equal(px('--sc-mvt-flux-pas', vivantCss), 10, 'la période du pointillé (4 + 6) est le pas de la couche');
});

await dit('InlineSuggestion : groupe « Suggestion d’Ajmani », étincelle verte décorative, Oui / Non de 34 px, jamais d’avatar', () => {
  const r = rend(K.InlineSuggestion, { texte: 'Relier ce message au projet A ?', onOui: () => undefined, onNon: () => undefined });
  assert.match(r, /^<div role="group" aria-label="Suggestion d’Ajmani" class="sc-suggestion-ligne" data-socle="suggestion-ligne"><svg aria-hidden="true"[^>]*class="sc-etincelle"/);
  assert.match(r, /<p class="sc-suggestion-ligne__texte">Relier ce message au projet A \?<\/p>/);
  assert.match(r, /data-reponse="oui">Oui<\/button>[\s\S]*data-reponse="non">Non<\/button>/);
  assert.equal(compter(r, /<button type="button"/g), 2);
  assert.doesNotMatch(r, /sc-avatar|<img|data-variante="primaire"/);
  assert.match(rend(K.InlineSuggestion, { texte: 'x', onOui: () => undefined, onNon: () => undefined, libelleOui: 'Relier', libelleNon: 'Plus tard' }), />Relier<[\s\S]*>Plus tard</);
  assert.match(vivantCss, /\.sc-suggestion-ligne__bouton \{[^}]*min-height:\s*var\(--sc-v-cible\)/);
  assert.match(vivantCss, /\.sc-suggestion-ligne \{[^}]*border:\s*1px solid var\(--socle-bord-suggestion\)[^}]*background:\s*linear-gradient\(180deg, var\(--socle-suggestion-haut\), var\(--socle-suggestion-bas\)\)/);
  assert.match(sansCommentaires(lire('src/socle/ui/controles/controles.css')), /\.sc-etincelle \{[^}]*color:\s*var\(--socle-etat-succes\)/);
});

await dit('tout ce qui est cliquable a son focus visible (sc-focus ou règle :focus-visible)', () => {
  for (const f of fs.readdirSync(path.join(racine, REP)).filter((x) => x.endsWith('.tsx'))) {
    const src = sansCommentaires(lire(`${REP}/${f}`));
    for (const m of src.matchAll(/<button[\s\S]*?className=\{?[`'"]([^`'"]+)/g)) {
      const classe = m[1];
      assert.ok(/sc-focus/.test(classe) || new RegExp(`\\.${classe.split(' ')[0]}:focus-visible`).test(vivantCss), `${f} : bouton « ${classe} » sans focus visible`);
    }
  }
});

/* ═══════════════════════  4. Les sources  ═══════════════════════ */

const TSX = [...fs.readdirSync(path.join(racine, REP)).filter((f) => /\.tsx?$/.test(f)).map((f) => `${REP}/${f}`), 'src/socle/couche-mouvement.ts'];
const FEUILLES = [`${REP}/vivant.css`, 'src/socle/mouvement.css'];

await dit('aucune couleur écrite en dur : ni dans les .tsx du groupe, ni dans ses feuilles (jetons --socle-* seulement)', () => {
  assert.ok(TSX.length >= 7, `${TSX.length} fichiers seulement`);
  for (const f of [...TSX, ...FEUILLES]) {
    const src = sansCommentaires(lire(f));
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(src), `${f} : couleur hexadécimale`);
    assert.ok(!/\b(rgb|rgba|hsl|hsla|oklch|lab)\(/i.test(src), `${f} : couleur fonctionnelle`);
    assert.ok(!/(?:fill|stroke|color|background)(?:Color)?\s*[=:]\s*['"]?(white|black|red|green|blue|gray|grey|orange)\b/i.test(src), `${f} : couleur nommée`);
  }
  for (const f of TSX) assert.ok(!/fontSize|fontFamily/.test(sansCommentaires(lire(f))), `${f} pose une police ou une taille en ligne`);
});

await dit('chaque var(--socle-…) existe dans noir.css, chaque var(--sc-v-…) et var(--sc-mvt-…) est définie ou posée par un composant', () => {
  const definisNoir = new Set([...noir.matchAll(/(--socle-[\w-]+)\s*:/g)].map((m) => m[1]));
  const enLigne = TSX.flatMap((f) => [...lire(f).matchAll(/'(--sc-(?:v|mvt)-[\w-]+)'/g)].map((m) => m[1]));
  const definis = new Set([...[...(vivantCss + couche).matchAll(/(--sc-(?:v|mvt)-[\w-]+)\s*:/g)].map((m) => m[1]), ...enLigne, '--sc-mvt-rang']);
  for (const f of [...FEUILLES, ...TSX]) {
    const src = sansCommentaires(lire(f));
    for (const [, nom] of src.matchAll(/var\((--socle-[\w-]*\w)[,)]/g)) assert.ok(definisNoir.has(nom), `${f} : ${nom} absent de noir.css`);
    for (const [, nom] of src.matchAll(/var\((--sc-(?:v|mvt)-[\w-]+)/g)) assert.ok(definis.has(nom), `${f} : ${nom} non défini`);
  }
  for (const nom of ['--socle-bord-survol', '--socle-ligne-survol', '--socle-police-mono']) assert.ok(definisNoir.has(nom), nom);
});

await dit('aucune encre « discret » en texte, aucun texte sous 10,5 px dans les feuilles du groupe', () => {
  for (const f of FEUILLES) {
    const css = sansCommentaires(lire(f));
    for (const [, c] of css.matchAll(/(?:^|[;{\s])color\s*:\s*([^;}]+)/g)) assert.ok(!/trait-discret|trait-tres-discret/.test(c), `${f} : color ${c}`);
    for (const [, v] of css.matchAll(/font-size:\s*([\d.]+)px/g)) assert.ok(Number(v) >= 10.5, `${f} : ${v}px`);
    for (const [, nom, v] of css.matchAll(/(--sc-v-[\w-]*(?:texte|severite|valeur))\s*:\s*([\d.]+)px/g)) assert.ok(Number(v) >= 10.5, `${nom} = ${v}px`);
  }
});

await dit('police monospace : le jeton du socle (valeur de la spec), .sc-mono en chiffres tabulaires ; --font-mono de index.css intact', () => {
  assert.match(noir, /--socle-police-mono:\s*ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Consolas, monospace;/);
  assert.match(noir, /\.sc-mono \{[^}]*font-family:\s*var\(--socle-police-mono\);[^}]*font-variant-numeric:\s*tabular-nums;/);
  assert.equal(jetons(noirBrut).get('--socle-bord-survol'), '#303033');
  assert.match(noir, /--socle-ligne-survol:\s*rgba\(255, 255, 255, 0\.03\);/);
  assert.match(lire('src/index.css'), /--font-mono:\s*'JetBrains Mono'/, '--font-mono (ancienne interface) ne change pas');
});

await dit('chargement : Ambiance.tsx charge vivant.css et mouvement.css ; index.ts réexporte le groupe ; aucun fichier partagé ne les importe', () => {
  const ambiance = lire('src/refonte/accueil/Ambiance.tsx');
  assert.match(ambiance, /import '\.\.\/\.\.\/socle\/ui\/vivant\/vivant\.css';/);
  assert.match(ambiance, /import '\.\.\/\.\.\/socle\/mouvement\.css';/);
  assert.match(lire('src/socle/ui/index.ts'), /export \* from '\.\/vivant';/);
  assert.ok(!/mouvement\.css|vivant\.css/.test(lire('src/index.css')), 'index.css (partagé) ne charge pas la couche');
  const fautes: string[] = [];
  (function marcher(dir: string) {
    for (const e of fs.readdirSync(path.join(racine, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        if (rel === 'src/socle' || rel === 'src/refonte') continue;
        marcher(rel);
      } else if (/\.(tsx?|css)$/.test(e.name) && !/\.internal\.tsx?$/.test(e.name) && /(?:from|import)\s+['"][^'"]*socle\/(?:ui\/vivant|couche-mouvement|mouvement\.css|ui['"])/.test(lire(rel))) fautes.push(rel);
    }
  })('src');
  assert.deepEqual(fautes, [], 'un fichier partagé importe le groupe vivant ou la couche');
  for (const f of TSX) {
    for (const [, spec] of sansCommentaires(lire(f)).matchAll(/from\s+'([^']+)'/g)) {
      if (!spec.startsWith('.')) {
        assert.ok(['react'].includes(spec), `${f} importe « ${spec} »`);
        continue;
      }
      const cible = path.relative(racine, path.resolve(racine, path.dirname(f), spec)).replace(/\\/g, '/');
      assert.ok(/^src\/socle(\/|$)/.test(cible), `${f} importe ${cible}`);
    }
  }
});

await dit('mots : fr et en, mêmes clés, mêmes {paramètres}, ni point d’exclamation ni émoji ; aucun avatar ni personnage', () => {
  const { en, fr } = K.DICTIONNAIRES_SOCLE as { en: Record<string, string>; fr: Record<string, string> };
  const cles = Object.keys(en).filter((k) => k.startsWith('vivant.'));
  assert.ok(cles.length >= 8, `${cles.length} clés « vivant. » seulement : mots/vivant.ts n’est pas fusionné dans i18n.ts`);
  const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const k of cles) {
    assert.ok(en[k] && fr[k], `clé ${k} manquante`);
    assert.equal(params(fr[k]), params(en[k]), k);
    assert.ok(!/!/.test(en[k] + fr[k]), `point d’exclamation dans ${k}`);
  }
  for (const f of [...TSX, ...FEUILLES, 'src/socle/mots/vivant.ts']) {
    const src = sansCommentaires(lire(f));
    assert.ok(!/\p{Extended_Pictographic}/u.test(src.replace(/[⌘·§→−–—…]/g, '')), `${f} : émoji`);
    assert.ok(!/<img|<Avatar|robot|mascotte/i.test(src), `${f} : image, avatar ou personnage`);
  }
});

await dit('la page de démo /dev/socle montre chaque composant du groupe dans sa section « vivant »', () => {
  const page = sansCommentaires(lire('src/refonte/systeme/demo/PageDemoSocle.tsx'));
  assert.match(page, /'mouvement',\s*'vivant',\s*\] as const;/);
  const section = page.slice(page.indexOf('function SectionVivant'));
  for (const c of ['LiveDot', 'Caret', 'Severity', 'FilterChips', 'Gauge', 'HeatCell', 'FlowLine', 'InlineSuggestion']) assert.match(section, new RegExp(`<${c}[\\s/>]`), c);
  for (const n of ['balayage', 'cascade', 'entree', 'arrivee']) assert.ok(section.includes(n), `la couche : ${n}`);
});

await dit('package.json et la CI : le script check:socle-vivant existe et tourne à côté des autres check:socle-*', () => {
  const pkg = JSON.parse(lire('package.json')) as { scripts: Record<string, string> };
  assert.match(pkg.scripts['check:socle-vivant'] ?? '', /scripts\/check-socle-vivant\.ts$/);
  assert.equal(pkg.scripts['check:socle-vivant'].replace('vivant', 'controles'), pkg.scripts['check:socle-controles']);
  assert.match(lire('.github/workflows/editions.yml'), /run: npm run check:socle-vivant/);
});

await dit('les noms des fiches (LOT-06) : .amn-grow = entree, .amn-slide = arrivee, .amn-bar = pousse (même règle, par :is), keyframes amnFlow = flux et amnHalo = onde ; coupés comme le reste (s1b)', () => {
  assert.match(base, /:is\(\[data-mvt='entree'\], \.amn-grow\),\s*:root\[data-ambiance='noir'\] \[data-mvt='cascade'\] > \* \{[^}]*animation: sc-mvt-entree/);
  assert.match(base, /:is\(\[data-mvt='arrivee'\], \.amn-slide\) \{ animation: sc-mvt-arrivee/);
  assert.match(base, /:is\(\[data-mvt='pousse'\], \.amn-bar\) \{[^}]*transform-origin: 50% 100%;[^}]*animation: sc-mvt-pousse/);
  assert.match(base, /\[data-mvt='flux'\] \{ animation: amnFlow var\(--sc-mvt-flux-duree, var\(--sc-mvt-flux\)\) linear infinite; \}/);
  assert.match(base, /\[data-mvt='onde'\]::after \{[^}]*animation: amnHalo var\(--sc-mvt-voyant\) ease-out infinite;/);
  assert.match(base, /@keyframes amnHalo \{ from \{ opacity: 0\.55; transform: scale\(1\); \} to \{ opacity: 0; transform: scale\(2\.6\); \} \}/);
  assert.match(base, /@keyframes amnFlow \{ to \{ stroke-dashoffset: calc\(-1 \* var\(--sc-mvt-flux-pas, 10px\)\); \} \}/);
  // Un seul jeu de keyframes : les anciens noms n'existent plus, aucune règle n'est écrite deux fois.
  assert.doesNotMatch(couche, /@keyframes sc-mvt-(onde|flux)\b|animation: sc-mvt-(onde|flux)\b/, 'anciens noms de keyframes');
  for (const c of ['amn-grow', 'amn-slide', 'amn-bar']) assert.equal((base.match(new RegExp(`\\.${c}\\b`, 'g')) ?? []).length, 1, `${c} : une seule règle dans la base`);
  // Coupés : réduit (fondu court pour grow et slide, rien pour bar), aucun, et le système.
  const fondus = /([^{}]*)\{\s*animation:\s*sc-mvt-fondu var\(--sc-mvt-fondu-court\) ease-out backwards;\s*\}/.exec(REDUIT)?.[1] ?? '';
  assert.ok(fondus.includes('.amn-grow') && fondus.includes('.amn-slide'), 'grow et slide deviennent des fondus en « réduit »');
  const coupes = /([^{}]*)\{\s*animation:\s*none;\s*\}/.exec(REDUIT)?.[1] ?? '';
  assert.ok(coupes.includes('.amn-bar'), 'bar coupé en « réduit »');
  assert.match(AUCUN, /\[data-mouvement='aucun'\] :is\(\.amn-grow, \.amn-slide, \.amn-bar\)/);
  assert.match(SYSTEME, /:root\[data-ambiance='noir'\] :is\(\.amn-grow, \.amn-slide, \.amn-bar\),/);
  assert.match(SYSTEME, /:root\[data-ambiance='noir'\]\[data-mouvement\] :is\(\.amn-grow, \.amn-slide, \.amn-bar\),/);
  // Documentés en tête de la feuille et dans docs/refonte-socle.md.
  assert.match(lire('src/socle/mouvement.css'), /\.amn-grow\s+= data-mvt="entree"[\s\S]*\.amn-slide\s+= data-mvt="arrivee"[\s\S]*\.amn-bar\s+= data-mvt="pousse"[\s\S]*amnFlow\s+= les keyframes de data-mvt="flux"[\s\S]*amnHalo\s+= les keyframes de data-mvt="onde"/);
  assert.match(lire('docs/refonte-socle.md'), /amn-grow[^\n]*entree[\s\S]*amn-slide[^\n]*arrivee[\s\S]*amn-bar[^\n]*pousse[\s\S]*amnFlow[^\n]*flux[\s\S]*amnHalo[^\n]*onde/);
});

fin();
