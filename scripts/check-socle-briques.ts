/**
 * Contrôle des BRIQUES PARTAGÉES du socle v3 (STATUT §1.10 point 1 ; 01-SOCLE-DESIGN §3, §4, fiche D02) — sans
 * navigateur, sans build, sans réseau : les composants sont rendus en HTML statique, les feuilles sont lues.
 *
 *   1. LES VALEURS : chaque cote du §4 et des images (tailles de tuile 22 à 48 avec rayon et glyphe, 41 px et 34 px
 *      de `ModuleTile`, 16 px de `CountBadge`, 21 px de la pastille latérale, rayons, parts de teinte) lue dans
 *      `briques-partagees.css` ; les couleurs ne sont que des jetons de `noir.css`, qui existent.
 *   2. LE BALISAGE ET LES RÔLES : tuile décorative ou image nommée, compteur dit en mots (zéro invisible, 99+),
 *      tuile de module en lien ou en bouton avec focus visible, `aria-current` du module ouvert, grille de groupe
 *      nommée par son titre, en-tête avec contrôles à la place des boutons, pastille d'état (point + mot).
 *   3. LES ALIAS (`noms.ts`, `coquille/index.ts`) : chaque nom de fiche pointe sur la bonne brique.
 *   4. LES ÉCRANS : D02 et la barre latérale passent par `ModuleTile` / `CountBadge`, H40, H42, H47 et D02 par
 *      `PageHead`, H41, H43 (BlocEtat) et D02 par `IconTile` ; plus de compteur ni de tuile locale.
 *   5. LES SOURCES : aucune couleur en dur dans les .tsx ni la feuille, mots fr/en de même clés, feuille chargée
 *      par `briques.css` (donc par Ambiance.tsx), rien de partagé n'importe le groupe.
 *
 *   npm run check:socle-briques
 */
import fs from 'node:fs';
import path from 'node:path';
import { assert, chargerRendu, creerEssais, jetons, lire, racine, rapportContraste, sansCommentaires } from './lib/essai-socle.ts';

const { dit, fin } = creerEssais('Socle — briques partagées (v3)');

const REP = 'src/socle/ui/briques-partagees';
const css = sansCommentaires(lire(`${REP}/briques-partagees.css`));
const noirBrut = lire('src/socle/noir.css');
const noir = jetons(noirBrut);
const bloc = (selecteur: string): string => {
  const re = new RegExp(`(?:^|\\n)${selecteur.replace(/[.[\]()+*?]/g, '\\$&')} \\{([^}]*)\\}`);
  const m = re.exec(css);
  assert.ok(m, `règle « ${selecteur} » introuvable`);
  return m[1];
};
const compter = (s: string, re: RegExp): number => (s.match(re) ?? []).length;

/* eslint-disable @typescript-eslint/no-explicit-any */
type Composant = (props: any) => unknown;
const R = await chargerRendu<Record<string, Composant>>(
  [
    "import { IconTile, CountBadge, ModuleTile, ModuleGroupGrid, AddModuleTile, PageHead, EnTeteDePage, StatusPill, PastilleEtat, Carte, Card, Bouton, Button, TuileKpi, Kpi, BarreProgression, Progress, AnneauProgression, Ring, Raccourci, Kbd, PileAvatars, AvatarStack, CaseACocher, Check, Saisie, Field, Interrupteur, Toggle, BoutonIcone, IconButton, Selecteur, Select, BoiteRecherche, SearchBox, Onglets, Tabs, Segmente, Segmented, SuggestionAjmani, Suggestion, SousCarte, Subcard, DrapeauUrgent, FlagUrgent, FilterChips, Chips, InlineSuggestion, SuggestionCompact, MiniCourbe, Sparkline, LigneTemps, TimelineItem, EtatVide, Empty } from '../src/socle/ui';",
    "import { BarreLaterale, Sidebar, EnTete, Header, BarreAjmani, AjmaniBar } from '../src/socle/coquille';",
  ].join('\n'),
  [
    'IconTile', 'CountBadge', 'ModuleTile', 'ModuleGroupGrid', 'AddModuleTile', 'PageHead', 'EnTeteDePage', 'StatusPill', 'PastilleEtat',
    'Carte', 'Card', 'Bouton', 'Button', 'TuileKpi', 'Kpi', 'BarreProgression', 'Progress', 'AnneauProgression', 'Ring', 'Raccourci', 'Kbd', 'PileAvatars', 'AvatarStack',
    'CaseACocher', 'Check', 'Saisie', 'Field', 'Interrupteur', 'Toggle', 'BoutonIcone', 'IconButton', 'Selecteur', 'Select', 'BoiteRecherche', 'SearchBox', 'Onglets', 'Tabs',
    'Segmente', 'Segmented', 'SuggestionAjmani', 'Suggestion', 'SousCarte', 'Subcard', 'DrapeauUrgent', 'FlagUrgent', 'FilterChips', 'Chips', 'InlineSuggestion', 'SuggestionCompact',
    'MiniCourbe', 'Sparkline', 'LigneTemps', 'TimelineItem', 'EtatVide', 'Empty', 'BarreLaterale', 'Sidebar', 'EnTete', 'Header', 'BarreAjmani', 'AjmaniBar',
  ],
);
const { h, rendre } = R as unknown as { h: (t: unknown, p?: Record<string, unknown> | null, ...e: unknown[]) => unknown; rendre: (el: unknown) => string };
const glyphe = () => h('svg', { 'data-glyphe': 'oui' });
const noop = () => undefined;

/* ═══════════════════════  1. Les valeurs, lues dans la feuille  ═══════════════════════ */

await dit('IconTile : huit tailles, chacune avec son rayon et son glyphe (D02 22 / 28, H41 26 / 42, H43 36, Cartes 38, Empty 44, BlocEtat 48)', () => {
  const attendu: Record<string, [number, number]> = { 22: [6, 11], 26: [7, 13], 28: [8, 13], 36: [10, 16], 38: [10, 18], 42: [10, 18], 44: [12, 20], 48: [14, 20] };
  for (const [taille, [rayon, glyphe]] of Object.entries(attendu)) {
    assert.match(css, new RegExp(`\\.sc-icon-tile\\[data-taille='${taille}'\\] \\{ --sc-tuile: ${taille}px; --sc-tuile-rayon: ${rayon}px; --sc-tuile-glyphe: ${glyphe}px; \\}`), `tuile ${taille}`);
  }
  const base = bloc('.sc-icon-tile');
  assert.match(base, /--sc-tuile-teinte: var\(--fam, var\(--socle-fam-outils\)\)/);
  assert.match(base, /--sc-tuile-part: 13%/, 'rgba(famille,.13) : la part du §4');
  assert.match(base, /box-sizing: border-box/);
  assert.match(base, /width: var\(--sc-tuile\);\s*height: var\(--sc-tuile\)/);
  assert.match(base, /border-radius: var\(--sc-tuile-rayon\)/);
  assert.match(base, /background: color-mix\(in srgb, var\(--sc-tuile-teinte\) var\(--sc-tuile-part\), transparent\)/);
  assert.match(base, /color: var\(--sc-tuile-teinte\)/);
  assert.match(css, /\.sc-icon-tile > svg \{ width: var\(--sc-tuile-glyphe\); height: var\(--sc-tuile-glyphe\); \}/);
  for (const part of [10, 14, 18]) assert.match(css, new RegExp(`\\.sc-icon-tile\\[data-part='${part}'\\] \\{ --sc-tuile-part: ${part}%; \\}`), `part ${part}`);
  assert.match(css, /\.sc-icon-tile\[data-bordure='true'\] \{ border: 1px solid color-mix\(in srgb, var\(--sc-tuile-teinte\) 22%, transparent\); \}/, 'la bordure de D02');
  assert.match(css, /\.sc-icon-tile\[data-ton='neutre'\] \{ background: var\(--socle-tag\); color: var\(--socle-texte-2\); \}/, 'neutre = aplat #1A1A1C');
  assert.equal(noir.get('--socle-tag'), '#1a1a1c');
  for (const ton of ['succes', 'attention', 'critique', 'info']) assert.match(css, new RegExp(`\\.sc-icon-tile\\[data-ton='${ton}'\\] \\{ --sc-tuile-teinte: var\\(--socle-etat-${ton}\\); \\}`), ton);
  assert.match(css, /\.sc-icon-tile\[data-famille='garde'\] \{ --fam: var\(--socle-fam-garde\); \}/);
  assert.ok(noir.has('--socle-fam-garde'));
});

await dit('CountBadge : 16 px, fond #26262A (--socle-pastille-compte), 10,5 / 600 ; pastille latérale 21 px / 11,5 / 500 ; chiffre seul 11,5 T3 ; rouge si critique ; tabulaire', () => {
  const standard = bloc(".sc-count-badge[data-variante='standard']");
  assert.match(standard, /display: inline-flex/);
  assert.match(standard, /min-width: 16px;\s*height: 16px/);
  assert.match(standard, /padding: 0 4px/);
  assert.match(standard, /border-radius: var\(--socle-rayon-pastille\)/);
  assert.match(standard, /background: var\(--socle-pastille-compte\)/);
  assert.match(standard, /color: var\(--socle-texte-1\)/);
  assert.match(standard, /font-size: 10\.5px;\s*font-weight: 600/);
  assert.equal(noir.get('--socle-pastille-compte'), '#26262a');
  assert.match(noirBrut, /--socle-rayon-pastille: 99px;/);
  const laterale = bloc(".sc-count-badge[data-variante='laterale']");
  // Elle pose son propre `display` : 21 × 16 même hors d'un parent flex (dans un titre, une cellule), pas seulement dans la barre.
  assert.match(laterale, /display: inline-flex;\s*flex: none;\s*min-width: 21px;\s*height: 16px;\s*align-items: center;\s*justify-content: center/);
  assert.match(laterale, /padding: 0 6px/);
  assert.match(laterale, /background: var\(--socle-lateral-compteur\)/);
  assert.match(laterale, /color: var\(--socle-texte-courant\)/);
  assert.match(laterale, /font-size: 11\.5px;\s*font-weight: 500;\s*line-height: 16px;\s*text-align: center/);
  assert.equal(noir.get('--socle-lateral-compteur'), '#262628');
  assert.match(bloc(".sc-count-badge[data-variante='texte']"), /color: var\(--socle-texte-2\);\s*font-size: 11\.5px/);
  assert.match(css, /\.sc-count-badge\[data-critique='true'\] \{ color: var\(--socle-etat-critique\); \}/);
  assert.match(css, /\.sc-count-badge \{ font-variant-numeric: tabular-nums; \}/);
  assert.match(sansCommentaires(noirBrut), /:is\([^)]*\.sc-count-badge[^)]*\) \{\s*font-variant-numeric: tabular-nums;/, 'noir.css range le compteur parmi les nombres tabulaires');
});

await dit('ModuleTile : ligne 34 px (D02 : tuile 22, nom 12,5 / 500, bordée, rayon 9, fond sous-carte) ; standard 41 px (tuile 26, nom 13 T2, sous-texte 11,5 T4, survol de ligne, module ouvert)', () => {
  const base = bloc('.sc-module-tile');
  assert.match(base, /display: flex/);
  assert.match(base, /width: 100%/);
  assert.match(base, /color: var\(--socle-texte-courant\)/, 'nom T2');
  assert.match(base, /cursor: pointer/);
  const ligne = bloc(".sc-module-tile[data-variante='ligne']");
  assert.match(ligne, /height: 34px/);
  assert.match(ligne, /gap: 9px;\s*padding: 0 8px/);
  assert.match(ligne, /border: 1px solid var\(--socle-bord-sous-carte\)/);
  // Le rayon 9 de la puce est le jeton du socle (le même que la variante standard), pas une cote écrite en dur.
  assert.match(ligne, /border-radius: var\(--socle-rayon-controle\)/);
  assert.match(noirBrut, /--socle-rayon-controle: 9px;/);
  assert.match(ligne, /background: var\(--socle-sous-carte\)/);
  assert.match(ligne, /color: var\(--socle-texte-1\)/);
  assert.match(ligne, /font-size: 12\.5px;\s*font-weight: 500/);
  assert.match(css, /\.sc-module-tile\[data-variante='ligne'\]:hover \{ border-color: var\(--socle-bord-survol\); \}/);
  const standard = bloc(".sc-module-tile[data-variante='standard']");
  assert.match(standard, /height: 41px/);
  assert.match(standard, /gap: 10px/);
  assert.match(standard, /border-radius: var\(--socle-rayon-controle\)/);
  assert.match(standard, /font-size: 13px;\s*font-weight: 500/, 'nom 13 px / 500');
  assert.match(css, /\.sc-module-tile\[aria-current='page'\] \{ background: var\(--socle-ligne-choisie\); color: var\(--socle-texte-1\); \}/);
  assert.equal(noir.get('--socle-ligne-choisie'), '#262629', 'le fond du module ouvert (fiche D02 : sélection clavier)');
  assert.match(bloc('.sc-module-tile__sous'), /color: var\(--socle-texte-3\);\s*font-size: 11\.5px/);
  // Sur le fond du module ouvert, T4 n'atteint pas AA : le sous-texte y passe en T3, et noir.css doit le prouver.
  assert.match(css, /\.sc-module-tile\[aria-current='page'\] \.sc-module-tile__sous \{ color: var\(--socle-texte-2\); \}/, 'sous-texte du module ouvert en T3');
  assert.ok(rapportContraste(String(noir.get('--socle-texte-2')), String(noir.get('--socle-ligne-choisie'))) >= 4.5, 'T3 sur le fond du module ouvert : AA');
  assert.ok(rapportContraste(String(noir.get('--socle-texte-3')), String(noir.get('--socle-ligne-choisie'))) < 4.5, 'T4 n’y tient pas : la règle reste nécessaire');
  assert.match(bloc('.sc-module-tile__nom'), /overflow: hidden;\s*text-overflow: ellipsis;\s*white-space: nowrap/, 'jamais un nom coupé net (§7.1)');
  assert.match(bloc('.sc-module-tile__acc'), /margin-left: auto/);
  assert.match(sansCommentaires(lire('src/socle/mouvement.css')), /\[data-mvt-survol='ligne'\]:hover \{ background-color: var\(--socle-ligne-survol\); \}/);
});

await dit('AddModuleTile : pointillé --socle-pointille (#2E2E33, comme Empty), même hauteur et même rayon que ModuleTile, libellé T3 ; ModuleGroupGrid : titre 11 px capitales T4 .08em, N colonnes, écart 6', () => {
  const ajout = bloc('.sc-add-module-tile');
  assert.match(ajout, /height: 41px/);
  assert.match(ajout, /border: 1px dashed var\(--socle-pointille\)/);
  assert.match(ajout, /border-radius: var\(--socle-rayon-controle\)/);
  assert.match(ajout, /color: var\(--socle-texte-2\)/, 'T3');
  assert.match(ajout, /font-size: 12\.5px/);
  assert.equal(noir.get('--socle-pointille'), '#2e2e33');
  assert.match(css, /\.sc-add-module-tile\[data-variante='ligne'\] \{ height: 34px; border-radius: var\(--socle-rayon-controle\); \}/);
  assert.match(css, /prefers-reduced-motion: reduce\)[^{]*\{[^}]*\.sc-add-module-tile \{ transition: none; \}/);
  const titre = bloc('.sc-module-group__titre');
  assert.match(titre, /color: var\(--socle-texte-3\)/, 'T4');
  assert.match(titre, /font-size: 11px;\s*font-weight: 600/, '11 px / 600');
  assert.match(titre, /letter-spacing: 0\.08em/);
  assert.match(titre, /text-transform: uppercase/);
  assert.match(bloc('.sc-module-group__grille'), /grid-template-columns: repeat\(var\(--sc-module-colonnes, 3\), minmax\(0, 1fr\)\);\s*gap: 6px/);
  assert.match(css, /\.sc-module-group \+ \.sc-module-group \{ margin-top: var\(--sc-ecart-page, 14px\); \}/);
});

await dit('PageHead (§3) : h1 28 / 600 / −.02 em / 1,1, sous-titre 13,5 T4 à 7 px, boutons de 31 px à 9 px, contrôles à la place des boutons ; StatusPill (§4) : point 6 + libellé 11,5, fond 10 à 13 %, 3 × 9, rayon 99', () => {
  const arche = sansCommentaires(lire('src/socle/ui/archetypes/archetypes.css'));
  assert.match(arche, /\.sc-page__titre \{[^}]*font-size: 28px; font-weight: 600; letter-spacing: -0\.02em; line-height: 1\.1/);
  assert.match(arche, /\.sc-page__sous-titre \{ margin: 7px 0 0; color: var\(--socle-texte-3\); font-size: 13\.5px/);
  assert.match(arche, /\.sc-page__actions \{[^}]*gap: 9px/);
  assert.match(arche, /\.sc-page__actions \[data-socle='bouton'\] \{ min-height: 31px; \}/);
  assert.match(arche, /\.sc-page__controles \{ display: flex; flex: none; align-items: center; gap: 9px; \}/);
  const briques = sansCommentaires(lire('src/socle/ui/briques.css'));
  const etat = /\.sc-etat \{([^}]*)\}/.exec(briques)?.[1] ?? '';
  assert.match(etat, /padding: 3px 9px/);
  assert.match(etat, /border-radius: var\(--socle-rayon-pastille\)/);
  assert.match(etat, /font-size: 11\.5px/);
  const part = Number(/color-mix\(in srgb, var\(--etat\) (\d+)%, transparent\)/.exec(etat)?.[1]);
  assert.ok(part >= 10 && part <= 13, `fond teinté à ${part} % (10 à 13)`);
  assert.match(briques, /\.sc-etat::before \{ content: ''; width: 6px; height: 6px; border-radius: 99px; background: var\(--etat\); \}/);
});

/* ═══════════════════════  2. Le balisage et les rôles  ═══════════════════════ */

await dit('IconTile : décorative par défaut, image nommée avec `libelle` ; taille, famille, ton, part (13 omise) et bordure en attributs de données', () => {
  const simple = rendre(h(R.IconTile, { icone: glyphe(), famille: 'contacts' }));
  assert.match(simple, /^<span aria-hidden="true" data-taille="26" data-famille="contacts" class="sc-icon-tile"><svg data-glyphe="oui"><\/svg><\/span>$/);
  const nommee = rendre(h(R.IconTile, { icone: glyphe(), taille: 44, ton: 'neutre', libelle: 'Aucun client' }));
  assert.match(nommee, /^<span role="img" aria-label="Aucun client" data-taille="44" data-ton="neutre" class="sc-icon-tile">/);
  assert.match(rendre(h(R.IconTile, { icone: glyphe(), taille: 22, famille: 'argent', part: 10, bordure: true })), /data-taille="22" data-famille="argent" data-part="10" data-bordure="true"/);
  assert.doesNotMatch(rendre(h(R.IconTile, { icone: glyphe(), part: 13 })), /data-part/, '13 est la part du socle : rien à dire');
  assert.match(rendre(h(R.IconTile, { icone: glyphe(), famille: 'garde', className: 'x-tuile' })), /data-famille="garde" class="sc-icon-tile x-tuile"/);
});

await dit('CountBadge : rien à zéro, 99+ au-delà, le chiffre dit en mots (lecteur d’écran et info-bulle), trois variantes, critique', () => {
  assert.equal(rendre(h(R.CountBadge, { n: 0, libelle: 'rien' })), '');
  assert.equal(rendre(h(R.CountBadge, { n: -2, libelle: 'rien' })), '');
  assert.equal(rendre(h(R.CountBadge, { n: 3, libelle: '3 à voir' })), '<span class="sc-count-badge" data-variante="standard" title="3 à voir">3<span class="sr-only"> 3 à voir</span></span>');
  assert.match(rendre(h(R.CountBadge, { n: 120, libelle: 'beaucoup' })), />99\+<span class="sr-only"> beaucoup<\/span>/);
  assert.match(rendre(h(R.CountBadge, { n: 5, libelle: '5 alertes ouvertes', variante: 'laterale' })), /^<span class="sc-count-badge" data-variante="laterale" title="5 alertes ouvertes">5</);
  assert.match(rendre(h(R.CountBadge, { n: 2, libelle: '2 à voir', variante: 'texte', className: 'sc-epingle__compteur' })), /^<span class="sc-count-badge sc-epingle__compteur" data-variante="texte" title="2 à voir">2</);
  assert.match(rendre(h(R.CountBadge, { n: 2, critique: true })), /data-critique="true" title="2 (alertes critiques|critical alerts)">2<span class="sr-only"> 2 (alertes critiques|critical alerts)<\/span>/, 'le mot du socle dit la gravité');
  assert.match(rendre(h(R.CountBadge, { n: 1, critique: true })), /data-critique="true" title="1 (alerte critique|critical alert)">1<span class="sr-only"> 1 (alerte critique|critical alert)<\/span>/, 'au singulier (fiche D02 : Alertes [1])');
  assert.match(rendre(h(R.CountBadge, { n: 4 })), /title="4 (à voir|to see)"/);
});

await dit('ModuleTile : un lien avec `vers`, un bouton sinon, focus visible, survol de ligne en standard seulement, nom et sous-texte, accessoire à droite, module ouvert en aria-current', () => {
  const lien = rendre(h(R.ModuleTile, { nom: 'Module A', icone: glyphe(), famille: 'jour', vers: '/a', sousTexte: '3 à faire', accessoire: h(R.CountBadge, { n: 3, libelle: '3 à voir' }) }));
  assert.match(lien, /^<a class="sc-module-tile sc-focus" data-variante="standard" data-mvt-survol="ligne" title="Module A" href="\/a"/);
  assert.match(lien, /<span aria-hidden="true" data-taille="26" data-famille="jour" class="sc-icon-tile"><svg/);
  assert.match(lien, /<span class="sc-module-tile__textes"><span class="sc-module-tile__nom">Module A<\/span><span class="sc-module-tile__sous">3 à faire<\/span><\/span><span class="sc-module-tile__acc"><span class="sc-count-badge"/);
  const bouton = rendre(h(R.ModuleTile, { nom: 'Module B', icone: glyphe(), onClick: noop, actif: true }));
  assert.match(bouton, /^<button type="button" class="sc-module-tile sc-focus" data-variante="standard" aria-current="page" data-mvt-survol="ligne" title="Module B">/);
  assert.match(bouton, /<span class="sr-only"> · (module ouvert|current module)<\/span>/, 'l’état se dit en mots');
  assert.doesNotMatch(bouton, /sc-module-tile__sous|sc-module-tile__acc/);
  const ligne = rendre(h(R.ModuleTile, { nom: 'Module C', icone: glyphe(), famille: 'argent', variante: 'ligne', vers: '/c', tuile: { part: 10, bordure: true }, sousTexte: 'ignoré', 'aria-label': 'Ouvrir Module C (⌘1)' }));
  assert.match(ligne, /^<a class="sc-module-tile sc-focus" data-variante="ligne" title="Module C" aria-label="Ouvrir Module C \(⌘1\)" href="\/c"/);
  assert.doesNotMatch(ligne, /data-mvt-survol/, 'la puce de D02 n’éclaire que sa bordure');
  assert.match(ligne, /data-taille="22" data-famille="argent" data-part="10" data-bordure="true"/);
  assert.doesNotMatch(ligne, /sc-module-tile__sous/, 'pas de sous-texte en ligne');
});

await dit('AddModuleTile et ModuleGroupGrid : « + Ajouter un module » en lien ou en bouton, dernière tuile de la grille quand on peut ajouter ; le groupe est une section nommée par son titre et son effectif', () => {
  const ajout = rendre(h(R.AddModuleTile, { vers: '/modules' }));
  assert.match(ajout, /^<a class="sc-add-module-tile sc-focus" data-variante="standard" href="\/modules"[^>]*><svg[^>]*lucide-plus[^>]*>[\s\S]*<\/svg><span class="sc-add-module-tile__libelle">(Ajouter un module|Add a module)<\/span><\/a>$/);
  assert.match(ajout, /<svg[^>]*width="14"[^>]*height="14"[^>]*lucide-plus/, 'icône + de 14 px');
  assert.match(rendre(h(R.AddModuleTile, { onClick: noop, variante: 'ligne', libelle: 'Épingler' })), /^<button type="button" class="sc-add-module-tile sc-focus" data-variante="ligne">[\s\S]*<span class="sc-add-module-tile__libelle">Épingler<\/span><\/button>$/);
  assert.match(rendre(h(R.AddModuleTile, { onClick: noop, variante: 'ligne' })), /<span class="sc-add-module-tile__libelle">(Ajouter|Add)<\/span>/, 'en ligne (132 px), le mot court');
  assert.match(bloc('.sc-add-module-tile__libelle'), /overflow: hidden;\s*text-overflow: ellipsis;\s*white-space: nowrap/);
  const tuiles = [1, 2, 3, 4].map((i) => h(R.ModuleTile, { key: i, nom: `Module ${i}`, icone: glyphe(), onClick: noop }));
  const groupe = rendre(h(R.ModuleGroupGrid, { titre: 'Ma journée', colonnes: 2, onAjouter: noop }, ...tuiles));
  // L'effectif : le chiffre à l'œil, « 4 modules » en texte pour les lecteurs d'écran (jamais un aria-label sur un span sans rôle).
  assert.match(groupe, /^<section aria-labelledby="([^"]+)" class="sc-module-group"><h3 id="\1" class="sc-module-group__titre"><span class="sc-module-group__nom">Ma journée<\/span><span class="sc-module-group__effectif sc-nombre"><span aria-hidden="true">4<\/span><span class="sr-only"> 4 modules<\/span><\/span><\/h3><div class="sc-module-group__grille" style="--sc-module-colonnes:2">/);
  assert.doesNotMatch(groupe, /sc-module-group__effectif[^>]*aria-label/, 'pas d’aria-label sur l’effectif');
  assert.equal(compter(groupe, /class="sc-module-tile sc-focus"/g), 4);
  assert.match(groupe, /class="sc-add-module-tile sc-focus" data-variante="standard"><svg[\s\S]*<\/div><\/section>$/, 'la tuile d’ajout ferme la grille');
  assert.match(rendre(h(R.ModuleGroupGrid, { titre: 'Vers', versAjouter: '/modules' }, tuiles[0])), /<a class="sc-add-module-tile sc-focus" data-variante="standard" href="\/modules"/, 'versAjouter : un lien');
  const sans = rendre(h(R.ModuleGroupGrid, { titre: 'Un seul', effectif: 1 }, tuiles[0]));
  assert.doesNotMatch(sans, /sc-add-module-tile/);
  assert.match(sans, /<span aria-hidden="true">1<\/span><span class="sr-only"> 1 module<\/span>/);
  // Une tuile sans `vers` ni `onClick` serait un bouton inerte : le type le refuse (CibleTuile), pour ModuleTile et AddModuleTile.
  const src = sansCommentaires(lire(`${REP}/ModuleTile.tsx`));
  assert.match(src, /export type CibleTuile = \{ vers: string; onClick\?: \(\) => void \} \| \{ vers\?: undefined; onClick: \(\) => void \};/);
  assert.match(src, /export type ModuleTileProps = ModuleTileBase & CibleTuile;/);
  assert.match(src, /export type AddModuleTileProps = AddModuleTileBase & CibleTuile;/);
});

await dit('PageHead : un seul h1, attributs de données sur le titre, classe de l’écran, infobulle d’un bouton, et `controles` à la place du groupe d’actions ; EnTeteDePage est le même composant', () => {
  assert.strictEqual(R.EnTeteDePage, R.PageHead);
  const boutons = rendre(h(R.PageHead, { titre: 'Démarrage', sousTitre: 'Bonjour', className: 'dem-entete', attributsTitre: { 'data-guide': 'titre' }, secondaires: [{ libelle: 'Passer', onClick: noop }], primaire: { libelle: 'Continuer', onClick: noop, disabled: true, infobulle: 'Choisissez un métier' } }));
  assert.match(boutons, /^<header class="sc-page__entete dem-entete"><div class="sc-page__titres"><h1 class="sc-page__titre" data-guide="titre">Démarrage<\/h1><p class="sc-page__sous-titre">Bonjour<\/p><\/div><div role="group" aria-label="[^"]+" class="sc-page__actions">/);
  assert.equal(compter(boutons, /<h1[ >]/g), 1);
  assert.equal(compter(boutons, /data-variante="secondaire"/g), 1);
  assert.equal(compter(boutons, /data-variante="primaire"/g), 1);
  const infobulle = /<span title="Choisissez un métier"><button[^>]*>/.exec(boutons)?.[0] ?? '';
  assert.match(infobulle, /data-variante="primaire"/, 'l’infobulle enveloppe le primaire');
  assert.match(infobulle, /disabled=""/, 'le bouton reste inactif sous son infobulle');
  const controles = rendre(h(R.PageHead, { titre: 'Tous les modules', controles: h('div', { role: 'search' }, 'champ') }));
  assert.match(controles, /<\/div><div class="sc-page__controles"><div role="search">champ<\/div><\/div><\/header>$/);
  assert.doesNotMatch(controles, /sc-page__actions|data-variante="primaire"/, 'des contrôles À LA PLACE des boutons');
  // L'exclusivité est dans le type : `controles` avec `primaire`, `secondaires` ou `extra` ne compile pas (rien ne disparaît en silence).
  assert.match(sansCommentaires(lire('src/socle/ui/archetypes/Page.tsx')), /controles: React\.ReactNode;\s*primaire\?: never;\s*secondaires\?: never;\s*extra\?: never;/, 'PageHeadProps : actions ou contrôles, par le type');
  assert.doesNotMatch(rendre(h(R.PageHead, { titre: 'T' })), /sc-page__actions|sc-page__controles|<p/);
});

await dit('StatusPill : PastilleEtat sous son nom de fiche ; un point et un mot, jamais la couleur seule', () => {
  assert.strictEqual(R.StatusPill, R.PastilleEtat);
  assert.equal(rendre(h(R.StatusPill, { etat: 'succes' }, 'à jour')), '<span data-etat="succes" class="sc-etat">à jour</span>');
  assert.match(rendre(h(R.StatusPill, { etat: 'critique', allegee: true }, 'en retard')), /data-etat="critique" data-allegee="true" class="sc-etat">en retard</);
});

/* ═══════════════════════  3. Les alias des fiches  ═══════════════════════ */

await dit('noms.ts : chaque nom de fiche pointe sur sa brique (et le tableau en tête les documente tous), Empty compris depuis que l’état vide suit le §4 ; Sidebar, Header, AjmaniBar depuis la coquille', () => {
  const paires: [string, string][] = [
    ['Card', 'Carte'], ['Button', 'Bouton'], ['Kpi', 'TuileKpi'], ['Progress', 'BarreProgression'], ['Ring', 'AnneauProgression'], ['Kbd', 'Raccourci'], ['AvatarStack', 'PileAvatars'],
    ['Check', 'CaseACocher'], ['Field', 'Saisie'], ['Toggle', 'Interrupteur'], ['IconButton', 'BoutonIcone'], ['Select', 'Selecteur'], ['SearchBox', 'BoiteRecherche'], ['Tabs', 'Onglets'],
    ['Segmented', 'Segmente'], ['Suggestion', 'SuggestionAjmani'], ['Subcard', 'SousCarte'], ['FlagUrgent', 'DrapeauUrgent'], ['Chips', 'FilterChips'], ['SuggestionCompact', 'InlineSuggestion'],
    ['Sparkline', 'MiniCourbe'], ['TimelineItem', 'LigneTemps'], ['StatusPill', 'PastilleEtat'], ['Empty', 'EtatVide'], ['Sidebar', 'BarreLaterale'], ['Header', 'EnTete'], ['AjmaniBar', 'BarreAjmani'],
  ];
  const noms = lire('src/socle/ui/noms.ts');
  for (const [alias, brique] of paires) {
    // Un composant est une fonction, ou un objet `forwardRef` (Bouton).
    assert.ok(['function', 'object'].includes(typeof R[alias]) && R[alias], `${alias} n’est pas exporté`);
    assert.strictEqual(R[alias], R[brique], `${alias} ≠ ${brique}`);
    assert.match(noms, new RegExp(`\\| ${alias}\\s+\\| ${brique.replace('PageHead', 'PageHead')}`), `${alias} absent du tableau de noms.ts`);
  }
  assert.match(noms, /\| PageHead\s+\| PageHead \(= EnTeteDePage\)/);
  // L'état vide suit le §4 (check:socle-controles le mesure) : le catalogue ne décrit plus l'ancien écart, et sa ligne dit l'action demandée.
  assert.doesNotMatch(noms, /SANS ALIAS|`Empty` ≠ `EtatVide`|action est facultative|gardent leurs pixels/, 'le catalogue décrit un écart Empty qui n’existe plus');
  assert.match(noms, /\| Empty\s+\| EtatVide\s+\| src\/socle\/ui\/Etats\.tsx[^\n]*pointillé `--socle-pointille`[^\n]*rayon 14[^\n]*icône 44 px[^\n]*titre 14 \/ 600[^\n]*12,5 T4[^\n]*action demandée/, 'la ligne Empty du tableau');
  assert.match(noms, /export \{ EtatVide as Empty \} from '\.\/Etats';/);
  assert.match(sansCommentaires(lire('src/socle/ui/index.ts')), /export \* from '\.\/briques-partagees';\s*export \* from '\.\/noms';/);
});

/* ═══════════════════════  4. Les écrans qui en vivent  ═══════════════════════ */

await dit('D02, la barre latérale, H40, H42, H47, H41 et BlocEtat passent par les briques : plus de tuile, de compteur ni d’en-tête local', () => {
  const d02 = sansCommentaires(lire('src/refonte/systeme/modules/VueTousLesModules.tsx'));
  assert.match(d02, /import \{ [^}]*CountBadge[^}]*IconTile[^}]*ModuleTile[^}]*PageHead[^}]* \} from '\.\.\/\.\.\/\.\.\/socle\/ui'/);
  assert.match(d02, /<PageHead\s+className="dm-entete"/);
  assert.match(d02, /<ModuleTile\s+variante="ligne"/);
  assert.match(d02, /<CountBadge n=\{m\.badge\}/);
  assert.match(d02, /<IconTile taille=\{taille\} famille=\{familleDe\(module\.teinte\)\} part=\{TUILE_D02\.part\} bordure=\{TUILE_D02\.bordure\}/);
  const d02css = sansCommentaires(lire('src/refonte/systeme/modules/modules.css'));
  assert.doesNotMatch(d02css, /\.dm-tuile|\.dm-puce \{|\.dm-puce__|\.dm-compte|\.dm-titre|\.dm-sous \{/);
  const barre = sansCommentaires(lire('src/socle/coquille/BarreLaterale.tsx'));
  assert.match(barre, /<CountBadge n=\{n\} libelle=\{aide\} variante=\{pastille \? 'laterale' : 'texte'\} \/>/);
  assert.match(barre, /<CountBadge n=\{m\.badge\}[^>]*variante="texte" className="sc-epingle__compteur" \/>/);
  assert.doesNotMatch(barre, /sc-compteur/);
  assert.doesNotMatch(sansCommentaires(lire('src/socle/coquille/coquille.css')), /\.sc-compteur|\.sc-epingle__compteur \{/);
  for (const [f, classe] of [['notifications/VueNotifications.tsx', 'sc-notif__entete'], ['demarrage/VueDemarrage.tsx', 'dem-entete'], ['demarrage/VueMetier.tsx', 'dem-entete']] as const) {
    const src = sansCommentaires(lire(`src/refonte/systeme/${f}`));
    assert.match(src, new RegExp(`<PageHead\\s+className="${classe}"`), f);
    assert.doesNotMatch(src, /<h1[ >]/, `${f} : le h1 est celui de PageHead`);
  }
  assert.match(sansCommentaires(lire('src/refonte/systeme/recherche/PaletteRecherche.tsx')), /<IconTile\s+className="rc-tuile"\s+taille=\{grande \? 42 : 26\}\s+part=\{grande \? 18 : 14\}/);
  assert.doesNotMatch(sansCommentaires(lire('src/refonte/systeme/recherche/recherche.css')), /\.rc-tuile \{/);
  // BlocEtat emploie la brique pour de vrai : son ton lui est passé, et situations.css ne redéfinit ni cote, ni fond, ni couleur de la tuile.
  assert.match(sansCommentaires(lire('src/socle/ui/situations/BlocEtat.tsx')), /<IconTile className="sc-bloc-etat__icone" taille=\{taille === 'compact' \? 36 : 48\} ton=\{tonTuile\(ton, taille\)\} icone=\{icone\} \/>/);
  const situations = sansCommentaires(lire('src/socle/ui/situations/situations.css'));
  assert.match(situations, /\.sc-bloc-etat__icone \{ --sc-tuile-teinte: var\(--sc-ton\); \}/, 'la teinte du bloc passe par la variable de la brique');
  assert.doesNotMatch(situations, /\.sc-bloc-etat__icone(\s+svg)? \{[^}]*(width|height|border-radius|background|color):/, 'situations.css redéfinit la tuile');
  assert.doesNotMatch(situations, /\.sc-bloc-etat\[data-taille='compact'\][^{]*\.sc-bloc-etat__icone(\s+svg)?\s*\{/, 'plus de cote compacte locale pour la tuile');
});

/* ═══════════════════════  5. Les sources  ═══════════════════════ */

await dit('sources : aucune couleur en dur (ni hex, ni rgb) dans les .tsx ni la feuille, aucune encre « discret » en texte, chaque jeton lu existe dans noir.css', () => {
  for (const f of fs.readdirSync(path.join(racine, REP))) {
    const src = sansCommentaires(lire(`${REP}/${f}`));
    assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/, `${f} : une couleur en dur`);
  }
  assert.doesNotMatch(css, /color:\s*var\(--socle-trait/);
  const declares = new Set([...sansCommentaires(noirBrut).matchAll(/(--socle-[\w-]+):/g)].map((m) => m[1]));
  for (const [, nom] of css.matchAll(/var\((--socle-[\w-]+)/g)) assert.ok(declares.has(nom), `${nom} n’existe pas dans noir.css`);
  assert.doesNotMatch(css, /font-size:\s*(?:10(?:\.[0-4])?|[0-9])px/, 'rien sous 10,5 px');
});

await dit('mots : EN_BRIQUES et FR_BRIQUES ont les mêmes clés, fusionnés dans le socle ; la feuille est chargée par briques.css (donc par Ambiance.tsx) ; rien de partagé n’importe le groupe', async () => {
  const M = await chargerRendu<{ EN_BRIQUES: Record<string, string>; FR_BRIQUES: Record<string, string> }>("import { EN_BRIQUES, FR_BRIQUES } from '../src/socle/mots/briques';", ['EN_BRIQUES', 'FR_BRIQUES']);
  assert.deepEqual(Object.keys(M.EN_BRIQUES).sort(), Object.keys(M.FR_BRIQUES).sort());
  for (const [cle, en] of Object.entries(M.EN_BRIQUES)) {
    const fr = M.FR_BRIQUES[cle];
    assert.deepEqual((en.match(/\{\w+\}/g) ?? []).sort(), (fr.match(/\{\w+\}/g) ?? []).sort(), `${cle} : paramètres`);
    assert.ok(!fr.includes('!') && !en.includes('!'), `${cle} : point d’exclamation`);
  }
  const i18n = sansCommentaires(lire('src/socle/i18n.ts'));
  assert.match(i18n, /import \{ EN_BRIQUES, FR_BRIQUES \} from '\.\/mots\/briques';/);
  assert.match(i18n, /\.\.\.EN_BRIQUES,/);
  assert.match(i18n, /\.\.\.FR_BRIQUES,/);
  assert.match(sansCommentaires(lire('src/socle/ui/briques.css')), /@import '\.\/briques-partagees\/briques-partagees\.css';/);
  const marche = (d: string): string[] => fs.readdirSync(path.join(racine, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? marche(`${d}/${e.name}`) : [`${d}/${e.name}`]));
  const fautes = marche('src').filter((f) => /\.(tsx?|css)$/.test(f) && !f.startsWith('src/socle/') && !f.startsWith('src/refonte/') && !/\.internal\.tsx?$/.test(f) && /briques-partagees|socle\/ui\/noms/.test(sansCommentaires(lire(f))));
  assert.deepEqual(fautes, [], 'un fichier partagé importe les briques partagées');
});

fin();
