/**
 * Contrôle de la page « TOUS LES MODULES » (D02, v3) — la logique pure, le rendu statique et les cotes, sans navigateur.
 *
 *   npm run check:systeme-modules
 */
import path from 'node:path';
import * as esbuild from 'esbuild';
import { assert, charger, creerEssais, lire, racine, sansCommentaires } from './lib/essai-socle.ts';

/** Comme `chargerRendu`, mais les feuilles importées par les composants sont ignorées (rendu statique seulement). */
async function chargerVue<T>(code: string): Promise<T> {
  const construit = await esbuild.build({
    stdin: { contents: code, resolveDir: path.join(racine, 'scripts'), loader: 'tsx' },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    charset: 'utf8',
    jsx: 'automatic',
    tsconfig: path.join(racine, 'tsconfig.json'),
    loader: { '.css': 'empty' },
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', __AMN_EDITION__: '"internal"', __AMN_VERSION__: '"0.0.0"' },
    logLevel: 'silent',
  });
  return (await import(`data:text/javascript;charset=utf-8;base64,${Buffer.from(construit.outputFiles[0].text, 'utf8').toString('base64')}`)) as T;
}

const { dit, fin } = creerEssais('Tous les modules (D02, v3)');

/* eslint-disable @typescript-eslint/no-explicit-any */
type Niveau = 'essentiel' | 'courant' | 'avance';
interface Module { id: string; nom: string; vers: string; niveau: Niveau; badge: number; personnes: string[]; active: boolean; verrouille: boolean; nouveau: boolean; cles: string[] }
interface Famille { id: string; nom: string; teinte: string; vers: string; garde: boolean; modules: Module[] }
const L = await charger<any>('src/refonte/systeme/modules/logique.ts');

/** Des familles FICTIVES : effectifs et niveaux inventés pour l'essai. */
const niveaux: Niveau[] = ['essentiel', 'courant', 'courant', 'avance'];
const fabrique = (id: string, n: number): Famille => ({
  id,
  nom: `Famille ${id}`,
  teinte: 'jour',
  vers: `/ensemble/${id}`,
  garde: false,
  modules: Array.from({ length: n }, (_, i) => ({ id: `${id}-${i}`, nom: `Module ${id}${i}`, vers: `/${id}/${i}`, niveau: niveaux[i % 4], badge: i % 3, personnes: [], active: true, verrouille: false, nouveau: false, cles: [`${id}${i}`] })),
});
const familles = [fabrique('a', 12), fabrique('b', 5), fabrique('c', 20)];

await dit('les effectifs par niveau se calculent depuis les familles : la somme des niveaux égale le total', () => {
  const n = L.compterParNiveau(familles);
  assert.equal(n.tous, 37);
  assert.equal(n.essentiel + n.courant + n.avance, n.tous);
});

await dit('toutes les lignes de chaque famille sont montrées (plus de « + N autres »), dans l’ordre du registre', () => {
  const c = L.composerRepertoire(familles, { niveau: 'tous', correspondances: null });
  assert.deepEqual(c.map((x: any) => x.lignes.length), [12, 5, 20]);
  assert.deepEqual(c.map((x: any) => x.effectif), [12, 5, 20]);
  assert.deepEqual(c[1].lignes.map((l: any) => l.id), ['b-0', 'b-1', 'b-2', 'b-3', 'b-4']);
  assert.ok(c.every((x: any) => !('reste' in x)));
});

await dit('un filtre de niveau réduit les lignes ET les effectifs ; une famille vidée garde son en-tête et le dit', () => {
  const sansAvance = { ...fabrique('d', 3), modules: fabrique('d', 3).modules.map((m) => ({ ...m, niveau: 'courant' as Niveau })) };
  const c = L.composerRepertoire([...familles, sansAvance], { niveau: 'avance', correspondances: null });
  assert.equal(c[0].effectif, 3);
  assert.ok(c[0].lignes.every((l: any) => l.module.niveau === 'avance'));
  assert.equal(c[3].videAuNiveau, true);
  assert.equal(c[3].lignes.length, 0);
});

await dit('une recherche marque les lignes sans en retirer ni en déplacer aucune ; la meilleure née d’un verbe ajoute une ligne d’action en tête de sa famille', () => {
  const m = new Map([['b-2', { score: 93, raison: 'envoyer une facture' }], ['a-5', { score: 60 }]]);
  const c = L.composerRepertoire(familles, { niveau: 'tous', correspondances: m });
  const a = c.find((x: any) => x.id === 'a');
  assert.equal(a.lignes.length, 12, 'aucune ligne ne disparaît');
  assert.equal(a.lignes[5].id, 'a-5', 'la mise en page ne bouge pas');
  assert.equal(a.lignes[5].correspond, true);
  assert.equal(a.lignes[0].correspond, false);
  const b = c.find((x: any) => x.id === 'b');
  assert.equal(b.lignes[0].type, 'action');
  assert.equal(b.lignes[0].libelle, 'Envoyer une facture');
  assert.equal(b.lignes.length, 6);
  assert.equal(b.effectif, 5, 'la ligne d’action n’est pas un module');
});

await dit('quatre colonnes dans l’ordre de la barre latérale : 8 familles → 2 par colonne, le surplus aux premières', () => {
  const huit = Array.from({ length: 8 }, (_, i) => i);
  assert.deepEqual(L.repartirEnColonnes(huit, 4), [[0, 1], [2, 3], [4, 5], [6, 7]]);
  assert.deepEqual(L.repartirEnColonnes([0, 1, 2, 3, 4, 5, 6, 7, 8], 4), [[0, 1, 2], [3, 4], [5, 6], [7, 8]]);
  assert.deepEqual(L.repartirEnColonnes([0, 1], 4), [[0], [1], [], []]);
});

await dit('↑ ↓ parcourent les correspondances dans l’ordre de lecture ; la sélection part de la ligne d’action, sinon de la meilleure', () => {
  const m = new Map([['a-5', { score: 60 }], ['b-2', { score: 93, raison: 'envoyer une facture' }], ['c-1', { score: 70 }]]);
  const col = L.repartirEnColonnes(L.composerRepertoire(familles, { niveau: 'tous', correspondances: m }), 4);
  const { ordre, depart } = L.ordreDeSelection(col, m);
  assert.deepEqual(ordre, ['a-5', 'action:b-2', 'b-2', 'c-1']);
  assert.equal(ordre[depart], 'action:b-2');
  const sansVerbe = new Map([['a-5', { score: 60 }], ['c-1', { score: 70 }]]);
  const r = L.ordreDeSelection(L.repartirEnColonnes(L.composerRepertoire(familles, { niveau: 'tous', correspondances: sansVerbe }), 4), sansVerbe);
  assert.equal(r.ordre[r.depart], 'c-1');
  assert.deepEqual(L.ordreDeSelection(col, null), { ordre: [], depart: 0 });
});

await dit('surligner : la partie tapée, au début du libellé ou d’un mot, insensible aux accents et à la casse', () => {
  assert.deepEqual(L.surligner('Envoyer une facture', 'envoyer une fac'), ['', 'Envoyer une fac', 'ture']);
  assert.deepEqual(L.surligner('Réunions', 'reu'), ['', 'Réu', 'nions']);
  assert.deepEqual(L.surligner('Notes et pages', 'pag'), ['Notes et ', 'pag', 'es']);
  assert.deepEqual(L.surligner('Calendrier', 'xyz'), ['Calendrier', '', '']);
  assert.deepEqual(L.surligner('Tâches', ''), ['Tâches', '', '']);
});

await dit('épinglés : 8 au plus, dans l’ordre des favoris, un seul par module, les clés inconnues ignorées', () => {
  const r = (cle: string) => (cle.startsWith('x') ? undefined : { id: cle.slice(0, 2) });
  const p = L.choisirEpingles(['a1', 'a1b', 'x', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1', 'i1'], r);
  assert.equal(p.length, 8);
  assert.equal(L.MAX_EPINGLES, 8);
  assert.deepEqual(p.slice(0, 3).map((x: any) => x.id), ['a1', 'b1', 'c1']);
});

await dit('récents, à découvrir et « x sur N » : d’après le journal des ouvertures du poste, jamais inventés', () => {
  const mods = fabrique('r', 8).modules;
  mods[6].active = false;
  mods[1].verrouille = true;
  const journal = { r0: '2026-10-30T10:38:00.000Z', r2: '2026-10-30T10:30:00.000Z', r3: 'pas une date', r4: '2026-10-29T08:00:00.000Z', r5: '2026-10-30T09:00:00.000Z' };
  const ouv = L.dernieresOuvertures(mods, journal);
  assert.equal(ouv.size, 4, 'une date illisible ne compte pas');
  assert.deepEqual(L.recents(mods, ouv, 4).map((x: any) => x.module.id), ['r-0', 'r-2', 'r-5', 'r-4']);
  const d = L.aDecouvrir(mods, ouv, 3).map((m: any) => m.id);
  assert.ok(!d.includes('r-6') && !d.includes('r-1') && !d.includes('r-0'), 'ni désactivé, ni verrouillé, ni déjà ouvert');
  assert.deepEqual(d, ['r-3', 'r-7']);
  assert.equal(L.partOuverte(64, 101).toFixed(3), (64 / 101).toFixed(3));
  assert.equal(L.partOuverte(3, 0), 0);
});

await dit('le moment d’une ouverture : minutes, heures, « ce matin », « hier », puis une date', () => {
  const maintenant = new Date(2026, 9, 30, 15, 0);
  assert.deepEqual(L.momentDOuverture(maintenant.getTime() - 20_000, maintenant), { cle: 'instant' });
  assert.deepEqual(L.momentDOuverture(maintenant.getTime() - 4 * 60_000, maintenant), { cle: 'minutes', n: 4 });
  assert.deepEqual(L.momentDOuverture(new Date(2026, 9, 30, 9, 5).getTime(), maintenant), { cle: 'matin' });
  assert.deepEqual(L.momentDOuverture(new Date(2026, 9, 30, 13, 0).getTime(), maintenant), { cle: 'heures', n: 2 });
  assert.deepEqual(L.momentDOuverture(new Date(2026, 9, 29, 18, 0).getTime(), maintenant), { cle: 'hier' });
  assert.equal(L.momentDOuverture(new Date(2026, 9, 20).getTime(), maintenant).cle, 'date');
});

await dit('flèches de la grille : ↑ ↓ restent dans la colonne, ← → vont à la ligne la plus proche de la colonne voisine', () => {
  const lignes = [{ colonne: 0, haut: 0 }, { colonne: 0, haut: 21 }, { colonne: 1, haut: 0 }, { colonne: 1, haut: 21 }, { colonne: 1, haut: 42 }];
  assert.equal(L.ligneVoisine(lignes, 1, 'ArrowDown'), 1);
  assert.equal(L.ligneVoisine(lignes, 0, 'ArrowDown'), 1);
  assert.equal(L.ligneVoisine(lignes, 2, 'ArrowUp'), 2);
  assert.equal(L.ligneVoisine(lignes, 1, 'ArrowRight'), 3);
  assert.equal(L.ligneVoisine(lignes, 4, 'ArrowLeft'), 1);
  assert.equal(L.ligneVoisine(lignes, 0, 'ArrowLeft'), 0);
  assert.equal(L.ligneVoisine(lignes, 3, 'End'), 4);
  assert.equal(L.ligneVoisine(lignes, -1, 'ArrowDown'), -1);
});

/* ══════════════════════════════ le rendu ══════════════════════════════ */

const R = await chargerVue<any>(`
  import { createElement as h } from 'react';
  import { renderToStaticMarkup } from 'react-dom/server.browser';
  import { MemoryRouter } from 'react-router-dom';
  export { VueTousLesModules } from '../src/refonte/systeme/modules/VueTousLesModules';
  export { h };
  export const rendre = (el) => renderToStaticMarkup(h(MemoryRouter, null, el));
`);
const puce = (id: string, teinte = 'argent') => ({ id, nom: `Puce ${id}`, vers: `/${id}`, teinte, indice: `Indice ${id}` });
const huit = [fabrique('a', 3), fabrique('b', 2), fabrique('c', 2), fabrique('d', 2), fabrique('e', 2), fabrique('f', 2), fabrique('g', 2), { ...fabrique('h', 2), garde: true }];
huit[0].modules[1] = { ...huit[0].modules[1], active: false };
huit[0].modules[2] = { ...huit[0].modules[2], nouveau: true, badge: 4, personnes: ['Sacha'] };
huit[1].modules[0] = { ...huit[1].modules[0], verrouille: true, active: false };
const vue = (sur: Record<string, unknown> = {}): string =>
  R.rendre(
    R.h(R.VueTousLesModules, {
      familles: huit,
      correspondre: () => new Map(),
      epingles: [puce('p1'), puce('p2')],
      recents: [{ module: puce('r1'), moment: { cle: 'minutes', n: 4 } }, { module: puce('r2'), moment: { cle: 'minutes', n: 12 } }],
      decouvrir: [puce('d1'), puce('d2'), puce('d3')],
      ouverts: 7,
      cyber: { vers: '/cyber', espaces: 9 },
      touche: '⌘',
      onOuvrir: () => undefined,
      onDemanderAjmani: () => undefined,
      focusInitial: false,
      ...sur,
    }),
  );
const compter = (html: string, re: RegExp): number => (html.match(re) ?? []).length;

await dit('rendu : un h1, le sous-titre compté, le segmenté à quatre niveaux avec les comptes du répertoire, le champ « / »', () => {
  const html = vue();
  assert.equal(compter(html, /<h1[ >]/g), 1);
  assert.match(html, /<h1[^>]*>Tous les modules<\/h1>/);
  assert.match(html, />17 modules en 8 familles · tapez pour trouver, Entrée pour ouvrir</);
  assert.match(html, /role="radiogroup" aria-label="Niveau"/);
  for (const t of ['Tous 17', 'Essentiels 8', 'Courants 9', 'Avancés 0']) assert.match(html, new RegExp(`>${t}<`), t);
  assert.match(html, /placeholder="Un module ou une action"/);
  assert.match(html, /<kbd class="sc-kbd">\/<\/kbd>/);
  assert.equal(compter(html, /data-variante="primaire"/g), 0, 'aucun bouton primaire sur la page');
});

await dit('rendu du répertoire : toutes les lignes, les familles en lien vers leur vue d’ensemble, bouclier pour La Garde, lien Cyber à part', () => {
  const html = vue();
  assert.equal(compter(html, /data-ligne="/g), 17);
  assert.equal(compter(html, /class="dm-famille"/g), 8);
  assert.match(html, /href="\/ensemble\/a"[^>]*>/);
  assert.equal(compter(html, /lucide-shield/g), 1);
  assert.match(html, /href="\/cyber"[^>]*>[\s\S]*?Cyber[\s\S]*?9 espaces, à part/);
  assert.equal(compter(html, /class="dm-colonne"/g), 4);
});

await dit('états de ligne : « non activé » (pas un lien), cadenas, « Nouveau », compteur, présence ; une seule ligne tabulable', () => {
  const html = vue();
  assert.match(html, /<span role="link" aria-disabled="true"[^>]*data-ligne="a-1"[\s\S]*?non activé/);
  assert.match(html, /data-ligne="b-0"[\s\S]*?lucide-lock/);
  assert.doesNotMatch(html.slice(html.indexOf('data-ligne="b-0"'), html.indexOf('data-ligne="b-1"')), /non activé/, 'verrouillé : le cadenas, pas « non activé »');
  assert.match(html, /data-ligne="a-2"[\s\S]*?>Nouveau<[\s\S]*?class="sc-count-badge" data-variante="standard" title="[^"]*">4<span class="sr-only">/, 'le compteur est le CountBadge du socle');
  assert.match(html, /Ouvert en ce moment par Sacha/);
  assert.equal(compter(html, /data-ligne="[^"]*"[^>]*tabindex="0"|tabindex="0"[^>]*data-ligne=/g), 1);
});

await dit('sélection clavier : fond choisi et ↵ ; recherche : les lignes sans correspondance sont ternes, aucune ne disparaît', () => {
  const html = vue({ selectionInitiale: 'c-1' });
  assert.match(html, /data-ligne="c-1"[^>]*data-choisie="true"/);
  assert.match(html.slice(html.indexOf('data-ligne="c-1"')), /^[^]*?lucide-corner-down-left/);
  const r = vue({ requeteInitiale: 'mod', correspondre: () => new Map([['d-1', { score: 80 }]]) });
  assert.equal(compter(r, /data-ligne="/g), 17);
  assert.equal(compter(r, /data-terne="true"/g), 16);
  assert.match(r, /data-ligne="d-1"[^>]*data-choisie="true"/);
  const vide = vue({ requeteInitiale: 'zzz', correspondre: () => new Map() });
  assert.match(vide, /Aucun module pour « zzz »/);
  assert.match(vide, />Demander à Ajmani</);
});

await dit('colonne droite : Épinglés (⌘1 à ⌘n), Récents (« vous »), À découvrir (« Essayer », « x sur N » et sa barre)', () => {
  const html = vue();
  assert.match(html, />Épinglés</);
  assert.match(html, /<kbd class="sc-kbd">⌘1<\/kbd><span>à<\/span><kbd class="sc-kbd">⌘2<\/kbd>/);
  assert.match(html, /aria-label="Ouvrir Puce p1 \(⌘1\)"/);
  assert.match(html, />Récents<[\s\S]*?>vous</);
  assert.match(html, />il y a 4 min</);
  assert.match(html, />12 min</);
  assert.match(html, />À découvrir<[\s\S]*?>jamais ouverts</);
  assert.equal(compter(html, />Essayer</g), 3);
  assert.match(html, /Vous en avez ouvert <b class="dm-chiffres">7 sur 17<\/b>/);
  assert.match(html, /data-mvt="remplit" style="width:41.2%"/);
  assert.doesNotMatch(html, /ce mois/, 'pas de « +N ce mois » : le journal ne garde pas la date de première ouverture');
  const sansRecents = vue({ recents: [], epingles: [] });
  assert.doesNotMatch(sansRecents, />Récents</, 'récents vides : la carte se masque');
  assert.match(sansRecents, /Épinglez vos modules préférés/);
  assert.doesNotMatch(sansRecents, /⌘1/);
});

await dit('mouvement : colonnes en fondu échelonné, cartes de droite en entrée, barre qui se remplit (coupés en mouvement réduit)', () => {
  const html = vue();
  assert.equal(compter(html, /class="dm-colonne" data-mvt="fondu"/g), 4);
  assert.equal(compter(html, /data-mvt="entree"/g), 3);
  const css = sansCommentaires(lire('src/refonte/systeme/modules/modules.css'));
  assert.match(css, /\.dm-colonne\[data-mvt='fondu'\] \{ animation-delay: calc\(var\(--sc-mvt-rang, 0\) \* 80ms\); \}/);
  assert.match(css, /prefers-reduced-motion: reduce\)[^{]*\{[^}]*\.dm-colonne\[data-mvt='fondu'\] \{ animation-delay: 0ms; \}/);
});

/* ══════════════════════════════ les cotes ══════════════════════════════ */

await dit('cotes lues dans modules.css : titre 28, champ 270 × 38, colonnes de 187 (écart 6), lignes de 21, en-tête de famille 26, colonne droite 300, cartes 218 et 190', () => {
  const css = sansCommentaires(lire('src/refonte/systeme/modules/modules.css'));
  // L'en-tête est le `PageHead` du socle (28 / 600 / −.02 em / 1,1 dans archetypes.css) ; D02 règle sa hauteur et ses contrôles.
  assert.match(sansCommentaires(lire('src/socle/ui/archetypes/archetypes.css')), /\.sc-page__titre \{[^}]*font-size: 28px; font-weight: 600; letter-spacing: -0\.02em; line-height: 1\.1/);
  assert.match(css, /\.dm-entete\.sc-page__entete \{ height: 70px; flex-wrap: nowrap; gap: 24px; \}/);
  assert.match(css, /\.dm-entete \.sc-page__controles \{ margin-top: 16px; \}/);
  assert.match(vue(), /<header class="sc-page__entete dm-entete"><div class="sc-page__titres"><h1 class="sc-page__titre">Tous les modules<\/h1>/);
  assert.doesNotMatch(css, /\.dm-titre|\.dm-sous|\.dm-tuile|\.dm-puce \{|\.dm-compte/, 'titre, tuiles, puces et compteur : les briques du socle');
  assert.match(css, /\.dm-recherche \{[^}]*width: 270px;[^}]*height: 38px/);
  assert.match(css, /\.dm-recherche:focus-within \{ border-color: var\(--socle-bord-champ\); \}/);
  assert.match(css, /\.dm-colonnes \{ display: grid; grid-template-columns: repeat\(4, minmax\(0, 187px\)\); gap: 6px; \}/);
  assert.match(css, /\.dm-ligne \{[^}]*height: 21px;[^}]*font-size: 12\.5px/);
  assert.match(css, /\.dm-famille__lien \{[^}]*height: 26px/);
  assert.match(css, /\.dm-famille \+ \.dm-famille \{ margin-top: 12px; \}/);
  assert.match(css, /\.dm-corps \{[^}]*grid-template-columns: minmax\(0, 1fr\) 300px; gap: 14px/);
  assert.match(css, /\.dm-epingles \{ height: 218px; \}/);
  assert.match(css, /\.dm-recents \{ height: 190px; \}/);
  assert.match(css, /\.dm-puces \{[^}]*grid-template-columns: repeat\(2, 132px\)/);
  const briques = sansCommentaires(lire('src/socle/ui/briques-partagees/briques-partagees.css'));
  assert.match(briques, /\.sc-module-tile\[data-variante='ligne'\] \{[^}]*height: 34px;[^}]*gap: 9px;[^}]*padding: 0 8px;[^}]*border-radius: 9px;[^}]*font-size: 12\.5px;[^}]*font-weight: 500/);
  assert.match(briques, /\.sc-icon-tile\[data-taille='22'\] \{ --sc-tuile: 22px; --sc-tuile-rayon: 6px;/);
  assert.match(briques, /\.sc-icon-tile\[data-taille='28'\] \{ --sc-tuile: 28px; --sc-tuile-rayon: 8px;/);
  assert.match(vue(), /<a class="sc-module-tile sc-focus" data-variante="ligne" title="[^"]*" aria-label="[^"]*" href="[^"]*"[^>]*><span aria-hidden="true" data-taille="22" data-famille="[a-z]+" data-part="10" data-bordure="true" class="sc-icon-tile">/, 'les épinglés : ModuleTile « ligne » et IconTile 22 (part 10, bordure)');
  assert.match(css, /\.dm-recent \{[^}]*height: 33px/);
  assert.match(briques, /\.sc-count-badge\[data-variante='standard'\] \{[^}]*height: 16px;[^}]*background: var\(--socle-pastille-compte\);[^}]*font-size: 10\.5px/);
  assert.match(lire('src/socle/noir.css'), /--socle-pastille-compte: #26262a;/);
});

await dit('plus aucune zone coupée : le répertoire défile DANS sa carte (fondu au bas tant qu’il reste des lignes), la page ne défile pas, les bas de colonnes s’alignent', () => {
  const css = sansCommentaires(lire('src/refonte/systeme/modules/modules.css'));
  assert.match(css, /\.dm-repertoire\[data-socle='carte'\] \{[^}]*overflow: hidden/);
  assert.match(css, /\.dm-defile \{ min-height: 0; flex: 1; overflow-y: auto;/);
  assert.match(css, /\.dm-defile\[data-deborde='true'\] \{ mask-image:/);
  assert.match(css, /\.dm-page \{[^}]*height: calc\(100% - 4px\);[^}]*margin-bottom: -20px;/);
  assert.match(css, /\.dm-decouvrir\[data-socle='carte'\] \{ min-height: 0; flex: 1;/);
  assert.doesNotMatch(css, /position: fixed|z-index/, 'une page, plus un calque');
});

await dit('aucune couleur hex en dur, aucune encre « discret » en texte, chiffres tabulaires sur les nombres seulement (pas sur la page)', () => {
  const css = sansCommentaires(lire('src/refonte/systeme/modules/modules.css'));
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/);
  assert.doesNotMatch(css, /color:\s*var\(--socle-trait/);
  const racine = /\.dm-page \{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.doesNotMatch(racine, /tabular-nums/, 'C11 : pas sur la racine de la page');
  assert.match(sansCommentaires(lire('src/socle/ui/briques-partagees/briques-partagees.css')), /\.sc-count-badge \{ font-variant-numeric: tabular-nums; \}/);
});

await dit('aucun chiffre du registre ni nom d’exemple écrit à la main dans le dossier', () => {
  for (const f of ['logique.ts', 'repertoire.ts', 'VueTousLesModules.tsx', 'PageTousLesModules.tsx', 'i18n.ts']) {
    const src = sansCommentaires(lire(`src/refonte/systeme/modules/${f}`));
    assert.doesNotMatch(src, /(?<!taille=\{)\b(101|16|62|23|64)\b(?!px|\))/, `${f} : un effectif écrit à la main (une taille d’icône ou d’avatar n’en est pas un)`);
    assert.doesNotMatch(src, /Menna|Mohamed|Riyad|Aaron|Trésorerie|Dictée vocale|Parrainage|Messages programmés/, `${f} : un nom d’exemple`);
  }
});

await dit('la page branchée : une page de la coquille (fil « Espace / Tous les modules », bouton allumé, texte d’Ajmani), plus de portail', () => {
  const src = sansCommentaires(lire('src/refonte/systeme/modules/PageTousLesModules.tsx'));
  assert.match(src, /usePageCoquille\(page \? \{ \.\.\.page, ajmani: tm\('ajmani'\) \} : null\)/);
  assert.match(src, /pageSysteme\(ROUTE_TOUS_LES_MODULES/);
  assert.doesNotMatch(src, /createPortal|role="dialog"|aria-modal/);
  for (const source of ['useNavFavorites', 'useModulesOuverts', 'useDonneesCoquille', 'useRegards', 'lireRepertoire']) assert.match(src, new RegExp(source), source);
  const coquille = sansCommentaires(lire('src/refonte/coquille/pagesSysteme.ts'));
  assert.match(coquille, /ROUTE_TOUS_LES_MODULES\) return \{ famille: null, miettes: \[\{ libelle: mots\.espace \}, \{ libelle: mots\.tousLesModules \}\], tousLesModules: true \}/);
});

await dit('la couture de navigation interne monte cette page à la même route ; le jumeau cliente n’en sait rien', () => {
  assert.match(lire('src/edition/navigation.internal.tsx'), /PageTousLesModules as TousLesModules/);
  assert.match(lire('src/edition/appRoot.internal.tsx'), /<Route path=\{ROUTE_TOUS_LES_MODULES\} element=\{<TousLesModules \/>\} \/>/);
  assert.doesNotMatch(lire('src/edition/navigation.business.tsx'), /systeme|Page|Panneau/);
});

fin();
