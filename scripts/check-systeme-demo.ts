/**
 * Contrôle de la PAGE DE DÉMONSTRATION DU SOCLE (`src/refonte/systeme/demo`) — sans navigateur, sans build, sans réseau.
 *
 * Il prouve que la page :
 *   1. se rend en HTML statique sans exception, avec une section par groupe du socle (base, contrôles, graphiques,
 *      situations, archétypes) et son sommaire en BOUTONS (jamais `href="#…"` : l'application est en HashRouter) ;
 *   2. montre TOUS les composants exportés par `src/socle/ui/index.ts` et ses sous-index — la liste est lue dans les
 *      `export { … }`, pas recopiée ; les seules exceptions sont écrites plus bas, avec leur raison ;
 *   3. lit ses jetons (noms réels de `noir.css`, valeurs lues par `getComputedStyle`), n'invente aucune couleur,
 *      et ne pose jamais une encre « discret » en couleur de texte ;
 *   4. n'emploie que des données fictives et génériques (aucun nom propre de la maquette), sans point d'exclamation
 *      ni émoji, avec des dictionnaires fr et en qui disent la même chose ;
 *   5. génère la semaine courante par rapport à la date du jour, et n'est importée par aucun fichier partagé.
 *
 * L'essai de rendu charge la page avec esbuild en laissant de côté la feuille `demo.css` (le bundle d'essai ne
 * produit que du JavaScript) ; la feuille est jugée à part, sur sa source.
 *
 *   npm run check:systeme-demo
 */
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { assert, creerEssais, lire, racine, sansCommentaires } from './lib/essai-socle.ts';

const { dit, fin } = creerEssais('Page de démonstration du socle');

const DOSSIER = 'src/refonte/systeme/demo';
const PAGE = `${DOSSIER}/PageDemoSocle.tsx`;
const FICHIERS = [PAGE, `${DOSSIER}/exemples.ts`, `${DOSSIER}/i18n.ts`, `${DOSSIER}/demo.css`];

const page = lire(PAGE);
const pageSansCommentaires = sansCommentaires(page);
const css = sansCommentaires(lire(`${DOSSIER}/demo.css`));
const noir = sansCommentaires(lire('src/socle/noir.css'));

/** Charge un module des sources avec esbuild ; les feuilles CSS importées sont ignorées. */
async function chargerSansCss<T>(code: string): Promise<T> {
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
  const sortie = construit.outputFiles.find((f) => f.path.endsWith('.js')) ?? construit.outputFiles[0];
  return (await import(`data:text/javascript;charset=utf-8;base64,${Buffer.from(sortie.text, 'utf8').toString('base64')}`)) as T;
}

type H = (type: unknown, props?: Record<string, unknown> | null, ...enfants: unknown[]) => unknown;
const R = await chargerSansCss<{
  h: H;
  rendre: (el: unknown) => string;
  PageDemoSocle: unknown;
  SECTIONS: readonly string[];
  evenementsDeLaSemaine: (r: Date) => { debut: Date; evenements: { id: string; debut: Date; fin: Date }[] };
  lundiDe: (r: Date) => Date;
  nomsDesJours: (l: string) => { nom: string; initiale: string }[];
  PERSONNES: string[];
  ORGANISATIONS: string[];
  MESSAGES: { titre: string }[];
  MODULES: { titre: string }[];
  dictionnairesDemo: { en: Record<string, string>; fr: Record<string, string> };
}>(
  [
    "import { createElement as h } from 'react';",
    "import { renderToStaticMarkup } from 'react-dom/server.browser';",
    "import { MemoryRouter } from 'react-router-dom';",
    "import PageDemoSocle, { SECTIONS } from '../src/refonte/systeme/demo/PageDemoSocle';",
    "import { evenementsDeLaSemaine, lundiDe, nomsDesJours, PERSONNES, ORGANISATIONS, MESSAGES, MODULES } from '../src/refonte/systeme/demo/exemples';",
    "import { dictionnairesDemo } from '../src/refonte/systeme/demo/i18n';",
    'export const rendre = (el) => renderToStaticMarkup(h(MemoryRouter, null, el));',
    'export { h, PageDemoSocle, SECTIONS, evenementsDeLaSemaine, lundiDe, nomsDesJours, PERSONNES, ORGANISATIONS, MESSAGES, MODULES, dictionnairesDemo };',
  ].join('\n'),
);

let html = '';
const texte = (h: string): string =>
  h
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ');
const compter = (s: string, re: RegExp): number => (s.match(re) ?? []).length;

/* ═════════════════════════  1. Le rendu et les sections  ═════════════════════════ */

await dit('la page se rend en HTML statique sans exception, sous le fond de page, en Inter', () => {
  html = R.rendre((R.h as H)(R.PageDemoSocle as never, {}));
  assert.ok(html.length > 20_000, `rendu trop court (${html.length} caractères)`);
  assert.match(html, /<div class="sd" data-refonte-police="inter">/);
  assert.match(css, /\.sd \{[^}]*background-color: var\(--socle-fond-page\)/, 'le fond de la page est --socle-fond-page');
  assert.equal(compter(html, /<h1[ >]/g) >= 1, true);
});

/** Les groupes du socle et la ou les sections qui les montrent. */
const GROUPES: Record<string, string[]> = {
  base: ['jetons', 'boutons', 'cartes', 'avatars', 'progression', 'kpi', 'taches', 'etats'],
  controles: ['cartes', 'champs', 'ludiques', 'suggestion', 'alignement'],
  graphiques: ['graphiques', 'progression', 'alignement'],
  situations: ['etats'],
  archetypes: ['archetypes', 'gabarit'],
};

await dit('une section par groupe du socle, chacune avec titre, description et liste des états ; l’ordre est celui du sommaire', () => {
  assert.equal(R.SECTIONS.length, 17);
  const trouvees = [...html.matchAll(/<section id="sd-([a-z]+)" data-section="([a-z]+)" aria-labelledby="sd-([a-z]+)-titre" class="sd-section">/g)];
  assert.deepEqual(trouvees.map((m) => m[1]), [...R.SECTIONS], 'sections absentes ou dans le désordre');
  for (const m of trouvees) assert.ok(m[1] === m[2] && m[2] === m[3], `identifiants incohérents pour ${m[1]}`);
  assert.equal(compter(html, /<h2 id="sd-[a-z]+-titre" class="sd-section__titre">[^<]+<\/h2>/g), 17, 'un titre par section');
  assert.equal(compter(html, /<p class="sd-section__desc">[^<]{20,}<\/p>/g), 17, 'une description par section');
  assert.equal(compter(html, /<p class="sd-section__etats"><span class="sd-section__etats-etiquette">ÉTATS<\/span> [^<]{10,}<\/p>/g), 17, 'une liste d’états par section');
  for (const [groupe, sections] of Object.entries(GROUPES)) for (const s of sections) assert.ok(R.SECTIONS.includes(s), `le groupe « ${groupe} » vise la section « ${s} », qui n’existe pas`);
  assert.ok(R.SECTIONS.includes('mouvement') && R.SECTIONS.includes('jetons'));
});

await dit('le sommaire est fait de boutons qui font scrollIntoView : aucun href="#…" (HashRouter), aucune ancre', () => {
  const nav = /<nav aria-label="[^"]+">([\s\S]*?)<\/nav>/.exec(html)?.[1] ?? '';
  assert.equal(compter(nav, /<button type="button"[^>]*class="sd-sommaire__lien sc-focus"/g), 17, 'dix-sept boutons');
  assert.equal(compter(nav, /<a[\s>]/g), 0, 'aucune ancre dans le sommaire');
  assert.ok(!/href="#/.test(html), 'un href="#…" dans le rendu');
  assert.ok(!/href="#/.test(pageSansCommentaires) && !/href=\{`#/.test(pageSansCommentaires), 'un href="#…" dans la source');
  assert.match(pageSansCommentaires, /\.scrollIntoView\(/);
  assert.equal(compter(html, /aria-current="location"/g), 1, 'une seule section courante');
});

await dit('le réglage Mouvement : quatre boutons qui appellent ecrireMouvement(complet | reduit | aucun | null), et la page remet l’état d’avant', () => {
  assert.match(pageSansCommentaires, /CHOIX_MOUVEMENT: \(NiveauMouvement \| null\)\[\] = \['complet', 'reduit', 'aucun', null\]/);
  assert.match(pageSansCommentaires, /ecrireMouvement\(n\);/);
  const zone = html.slice(html.indexOf('id="sd-mouvement"'));
  assert.equal(compter(zone, /<button [^>]*aria-pressed="(?:true|false)"/g), 4, 'quatre boutons à état');
  assert.match(pageSansCommentaires, /const avant = choixMouvement\(\);\s*return \(\) => ecrireMouvement\(avant\);/, 'le démontage remet le réglage d’avant');
  assert.match(html, /role="switch"[^>]*aria-label="Réduire le mouvement"/, 'l’interrupteur « Réduire le mouvement »');
});

await dit('pas d’interrupteur « thème clair » : ce thème ne redéfinit aucun jeton --socle-* (les briques noires n’en changeraient pas)', () => {
  const index = lire('src/index.css');
  const bloc = /:root\[data-theme='clair'\] \{([\s\S]*?)\n\}/.exec(index)?.[1];
  assert.ok(bloc, 'le bloc du thème clair est introuvable dans src/index.css');
  assert.ok(!/(^|[\s;{])--socle-[\w-]+\s*:/.test(bloc as string), 'le thème clair redéfinit un jeton --socle-* : il faut alors reposer l’interrupteur');
  assert.ok(!/data-theme|dataset\.theme/.test(pageSansCommentaires.replace(/Pas d'interrupteur[\s\S]*?$/m, '')), 'la page touche à data-theme sans que rien ne change');
});

/* ═════════════════════════  2. Tous les composants du socle  ═════════════════════════ */

/**
 * Les composants qu'on ne rend PAS dans cette page, et pourquoi. Chaque entrée doit être exportée par le socle et ne
 * doit pas apparaître dans la page (sinon elle sort de la liste).
 */
const EXCEPTIONS: Record<string, string> = {
  EtatVideInvitation: 'montré par /dev/etats (H43, modèle 1)',
  EtatChargement: 'montré par /dev/etats (H43, modèle 2) ; la page montre ses pièces : Chargement, Squelette, SqueletteLignes',
  EtatHorsConnexion: 'montré par /dev/etats (H43, modèle 3)',
  EtatAccesRefuse: 'montré par /dev/etats (H43, modèle 4)',
  EtatAucunResultat: 'montré par /dev/etats (H43, modèle 5)',
  EtatErreurChargement: 'montré par /dev/etats (H43, erreur de chargement)',
  DialogueConfirmation: 'calque plein écran à piège de focus : montré en place par /dev/etats (H43, modèle 6)',
  DialogueConfirmationEnPlace: 'montré par /dev/etats (H43, modèle 6)',
  Toast: 'montré par /dev/etats (H43, modèle 7)',
  FournisseurToasts: 'fournisseur à poser à la racine de l’application, sans rendu propre ; ses toasts sont sur /dev/etats',
  AvisCollaboration: 'montré par /dev/etats (H43, modèle 8)',
};

/** Les noms exportés par un fichier d'index, en suivant les `export { … } from` et les `export * from`. */
function exportes(fichier: string, vus = new Set<string>()): string[] {
  const cle = path.resolve(racine, fichier);
  if (vus.has(cle)) return [];
  vus.add(cle);
  const source = sansCommentaires(fs.readFileSync(cle, 'utf8'));
  const noms: string[] = [];
  for (const m of source.matchAll(/export\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
    for (const brut of m[1].split(',')) {
      const nom = brut.trim();
      if (!nom || nom.startsWith('type ')) continue;
      noms.push(nom.split(/\s+as\s+/).pop() as string);
    }
  }
  for (const m of source.matchAll(/export\s*\*\s*from\s*'([^']+)'/g)) {
    const cible = path.join(path.dirname(fichier), m[1]);
    const resolu = [`${cible}.ts`, `${cible}.tsx`, path.join(cible, 'index.ts')].find((c) => fs.existsSync(path.resolve(racine, c)));
    if (resolu) noms.push(...exportes(resolu, vus));
  }
  return noms;
}

const composants = [...new Set(exportes('src/socle/ui/index.ts'))].filter((n) => /^[A-Z][A-Za-z0-9]*$/.test(n) && !/^[A-Z0-9_]+$/.test(n)).sort();

await dit('la liste des composants est bien lue dans les index du socle (garde contre un analyseur qui ne verrait plus rien)', () => {
  assert.ok(composants.length >= 80, `seulement ${composants.length} composants lus`);
  for (const attendu of ['Bouton', 'Carte', 'Tableau', 'Kanban', 'Courbe', 'SuggestionAjmani', 'CarteJalon', 'BlocEtat', 'Semaine', 'Page']) assert.ok(composants.includes(attendu), `${attendu} absent de la liste lue`);
  assert.ok(!composants.includes('SANS_ACTION') && !composants.includes('ECART_DONUT') && !composants.includes('PX_PAR_HEURE'), 'une constante est prise pour un composant');
});

await dit('chaque composant exporté par le socle apparaît dans la page, sauf les exceptions écrites et justifiées', () => {
  const absents = composants.filter((n) => !(n in EXCEPTIONS) && !new RegExp(`<${n}(?=[\\s/>]|<)`).test(pageSansCommentaires));
  assert.deepEqual(absents, [], `composants du socle absents de la démonstration : ${absents.join(', ')}`);
  for (const [nom, raison] of Object.entries(EXCEPTIONS)) {
    assert.ok(composants.includes(nom), `l’exception « ${nom} » n’est plus exportée par le socle`);
    assert.ok(raison.length > 20, `l’exception « ${nom} » n’est pas justifiée`);
    assert.ok(!new RegExp(`<${nom}(?=[\\s/>]|<)`).test(pageSansCommentaires), `« ${nom} » est montré par la page : il sort de la liste des exceptions`);
  }
  assert.ok(Object.keys(EXCEPTIONS).length <= 12, 'la liste des exceptions doit rester courte');
});

await dit('la page ne montre rien de plus que le socle exporte : ses imports viennent de React, lucide-react et du socle', () => {
  const sources = FICHIERS.filter((f) => /\.tsx?$/.test(f));
  for (const f of sources) {
    for (const m of sansCommentaires(lire(f)).matchAll(/(?:from|import)\s+'([^']+)'/g)) {
      const chemin = m[1];
      if (chemin.startsWith('.')) {
        assert.ok(/^(\.\/|\.\.\/\.\.\/\.\.\/socle\/)/.test(chemin), `${f} importe « ${chemin} » : hors du socle`);
      } else assert.ok(['react', 'lucide-react'].includes(chemin), `${f} importe le paquet « ${chemin} »`);
    }
  }
});

await dit('le rendu contient les cellules typées du tableau, trois colonnes de kanban, six cartes de module, un scindé, la semaine et la chronologie', () => {
  for (const marque of ['sc-tableau__nom"', 'sc-tableau__texte"', 'data-etat=', 'sc-tableau__progression', 'sc-pile', 'sc-tableau__montant', 'sc-tag', 'sc-tableau__date', 'sc-case', 'sc-interrupteur', 'sc-tableau__icone']) {
    assert.ok(html.includes(marque), `cellule « ${marque} » absente du tableau`);
  }
  assert.equal(compter(html, /class="sc-tableau__titre/g) >= 11 || compter(html, /role="columnheader"/g) >= 11, true, 'les en-têtes de colonne');
  assert.equal(compter(html, /class="sc-kanban__colonne"/g), 3 + 1, 'trois colonnes de kanban, plus la colonne seule');
  assert.equal(compter(html, /<article[^>]*class="sc-carte-module"/g), 6, 'six cartes de module');
  assert.equal(compter(html, /class="sc-scinde sc-zone/g), 2, 'deux scindés (un plein, un vide)');
  assert.equal(compter(html, /class="sc-semaine sc-zone/g), 1);
  assert.equal(compter(html, /class="sc-chronologie"/g), 1);
  assert.equal(compter(html, /class="sc-semaine__evenement sc-focus"/g), 5, 'cinq événements dans la semaine');
  assert.ok(html.includes('data-aujourdhui="true"'), 'aujourd’hui porte sa pastille : la semaine affichée est la semaine courante');
});

await dit('la section « Alignement § 4 » (s1b) montre les variantes : anneau 26 à 72 (muet, petit, moyen), case 16, segmenté compact, recherche 38, Mono 11 à 18, hachures et pointillés par leur jeton, gris de décor, état vide avec icône', () => {
  const zone = html.slice(html.indexOf('id="sd-alignement"'));
  assert.ok(zone.length > 2000, 'section absente');
  for (const t of [26, 34, 40, 48, 58, 72]) assert.ok(zone.includes(`<svg width="${t}" height="${t}" viewBox="0 0 ${t} ${t}"`), `anneau de ${t} px`);
  for (const cote of ['muet', 'petit', 'moyen']) assert.ok(zone.includes(`data-cote="${cote}"`), `anneau ${cote}`);
  assert.ok(zone.includes('data-taille="16"') && zone.includes('data-taille="serie"'), 'cases de 16 et 24 px');
  assert.ok(zone.includes('data-taille="compact"'), 'segmenté compact');
  assert.ok(zone.includes('data-hauteur="38"'), 'recherche de 38 px');
  assert.equal(compter(zone, /data-socle="mono"/g), 6, 'six Mono (11, 12,5, 14, 18, time, code)');
  assert.ok(zone.includes('style="font-size:11px"') && zone.includes('style="font-size:18px"'), 'Mono de 11 et 18 px');
  for (const j of ['--socle-hachure-attention', '--socle-hachure-grise', '--socle-pointille-ok', '--socle-pointille-attention']) assert.ok(zone.includes(`style="--sd-motif:var(${j})"`), `motif ${j}`);
  assert.match(css, /\.sd-motif\[data-genre='fond'\] \{ background-image: var\(--sd-motif\); \}/);
  assert.match(css, /\.sd-motif\[data-genre='bord'\] \{ border: var\(--sd-motif\); \}/);
  assert.match(zone, /<span aria-hidden="true" class="sc-vide__icone"><svg/, 'état vide avec icône');
  for (const g of ['--socle-decor-1', '--socle-decor-2', '--socle-decor-3']) assert.ok(html.includes(`data-genre="decor"><div class="sd-jeton__echantillon" style="--sd-ech:var(${g})"`), `gris de décor ${g}`);
  assert.match(css, /\.sd-jeton\[data-genre='decor'\] \.sd-jeton__echantillon\[style\*='--socle-decor'\] \{ background: var\(--sd-ech\); \}/);
});

await dit('le gabarit de page : Page autonome, en-tête avec un seul bouton primaire, quatre KPI, colonne droite', () => {
  const mini = /<main[^>]*data-socle-page[^>]*data-autonome="true"[\s\S]*?<\/main>/.exec(html)?.[0] ?? '';
  assert.ok(mini.length > 500, 'miniature introuvable');
  assert.equal(compter(mini, /<h1[ >]/g), 1);
  assert.equal(compter(mini, /class="sc-rangee-kpi"/g), 1);
  assert.equal(compter(mini, /data-socle="kpi"/g), 4);
  assert.equal(compter(mini, /class="sc-colonne-droite"/g), 1);
  // Un seul primaire pour la page, plus celui de la suggestion d'Ajmani (l'exception du socle, §3).
  assert.equal(compter(mini, /data-variante="primaire"/g), 2);
  assert.equal(compter(/<header class="sc-page__entete">[\s\S]*?<\/header>/.exec(mini)?.[0] ?? '', /data-variante="primaire"/g), 1);
});

/* ═════════════════════════  3. Les jetons  ═════════════════════════ */

await dit('jetons : tous les noms montrés existent dans noir.css, par groupe, et chaque échantillon est peint depuis sa variable', () => {
  const definis = new Set([...noir.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  const figures = [...html.matchAll(/<figure class="sd-jeton" data-genre="([a-z]+)"><div class="sd-jeton__echantillon" style="--sd-ech:var\((--[\w-]+)\)">/g)];
  assert.ok(figures.length >= 45, `seulement ${figures.length} échantillons`);
  const parGenre = new Map<string, string[]>();
  for (const [, genre, jeton] of figures) {
    assert.ok(definis.has(jeton), `${jeton} n’est pas défini dans noir.css`);
    parGenre.set(genre, [...(parGenre.get(genre) ?? []), jeton]);
  }
  const nombre = (g: string) => parGenre.get(g)?.length ?? 0;
  assert.ok(nombre('fond') >= 12 && nombre('bord') >= 10, 'fonds et bordures');
  assert.equal(nombre('encre'), 4, 'les quatre encres T1 à T4');
  assert.equal(nombre('decor'), 5, 'les deux filets décoratifs et les trois gris de décor (B15)');
  assert.equal(nombre('famille'), 7);
  assert.equal(nombre('etat'), 4);
  assert.equal(nombre('avatar'), 6);
  // Chaque échantillon dit son nom ; la valeur, elle, est lue à l'exécution (le rendu statique n'a pas de style calculé).
  assert.equal(compter(html, /<code class="sd-jeton__nom">--socle-[\w-]+<\/code>/g), figures.length);
  assert.match(pageSansCommentaires, /window\.getComputedStyle\(document\.documentElement\)\.getPropertyValue\(jeton\)\.trim\(\)/);
  assert.match(pageSansCommentaires, /requestAnimationFrame/);
});

await dit('aucune encre « discret » en texte : ni dans la feuille, ni dans la page, ni dans un échantillon d’encre ; le texte lu est T1 à T4', () => {
  assert.ok(!/(?<![-\w])color\s*:[^;}]*--socle-trait/.test(css), 'demo.css pose une encre « discret » en color');
  assert.ok(!/(?<![-\w])color\s*:[^,}]*socle-trait/.test(pageSansCommentaires), 'la page pose une encre « discret » en color');
  for (const m of html.matchAll(/data-genre="encre"><div class="sd-jeton__echantillon" style="--sd-ech:var\((--[\w-]+)\)">/g)) {
    assert.match(m[1], /^--socle-texte-(1|2|3|courant)$/, `${m[1]} n’est pas une encre de texte`);
  }
  // Toute couleur de texte de la feuille est une encre de texte, un état ou la variable d'échantillon d'encre.
  for (const [, selecteur, corps] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    for (const d of corps.matchAll(/(?<![-\w])color\s*:\s*([^;]+);/g)) {
      const valeur = d[1].trim();
      if (valeur === 'var(--sd-ech)') assert.match(selecteur, /data-genre='(encre|avatar)'/, `color: var(--sd-ech) hors d’un échantillon d’encre (${selecteur.trim()})`);
      else assert.match(valeur, /^var\(--socle-(texte-1|texte-2|texte-3|texte-courant|etat-succes)\)$/, `couleur de texte « ${valeur} » (${selecteur.trim()})`);
    }
  }
  // Le sélecteur de l'avatar pose du T1 sur la couleur d'avatar : lisible.
  assert.match(css, /\[data-genre='avatar'\] \.sd-jeton__echantillon \{[^}]*color: var\(--socle-texte-1\)/);
});

await dit('demo.css : aucune couleur en dur (ni hex, ni rgb, ni hsl), tout par var(--socle-…) ; chaque --socle-* existe, chaque --sd-* est défini', () => {
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(css), `couleur hex en dur : ${css.match(/#[0-9a-fA-F]{3,8}\b/)?.[0]}`);
  assert.ok(!/\b(?:rgba?|hsla?|hwb|lab|lch|oklch|oklab)\(/i.test(css), 'couleur fonctionnelle en dur');
  assert.ok(!/(?<![-\w])(?:white|black|red|green|blue|gray|grey|orange|yellow|purple|pink|silver)(?![-\w])/i.test(css.replace(/var\([^)]*\)/g, '')), 'couleur nommée en dur');
  const definis = new Set([...noir.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  for (const f of [css, pageSansCommentaires]) {
    for (const m of f.matchAll(/var\((--socle-[\w-]+)/g)) assert.ok(definis.has(m[1]), `${m[1]} n’existe pas dans noir.css`);
  }
  const poses = new Set([...css.matchAll(/(--sd-[\w-]+)\s*:/g)].map((m) => m[1]).concat([...pageSansCommentaires.matchAll(/'(--sd-[\w-]+)'/g)].map((m) => m[1])));
  for (const m of css.matchAll(/var\((--sd-[\w-]+)/g)) assert.ok(poses.has(m[1]), `${m[1]} est lu mais jamais posé`);
  for (const f of [PAGE, `${DOSSIER}/exemples.ts`, `${DOSSIER}/i18n.ts`]) assert.ok(!/#[0-9a-fA-F]{6}\b/.test(sansCommentaires(lire(f))), `${f} : couleur hex en dur`);
  // Les valeurs de --sd-* sous l'ambiance noire ne sont que des cotes : pas de couleur.
  const bloc = /:root\[data-ambiance='noir'\] \{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.ok(bloc.length > 0 && !/#|rgb|hsl/.test(bloc), '--sd-* sous l’ambiance noire : seulement des cotes');
});

await dit('texte lu ≥ T4 (#8a8a8e) et plus petit texte 10,5 px : la feuille n’écrit aucune taille sous 11 px et aucune encre plus sombre', () => {
  for (const m of css.matchAll(/font-size\s*:\s*([\d.]+)px/g)) assert.ok(Number(m[1]) >= 10.5, `font-size ${m[1]}px sous le plancher de 10,5 px`);
  assert.ok(!/opacity\s*:\s*0?\.[0-4]/.test(css), 'une opacité qui assombrirait du texte');
  assert.match(noir, /--socle-texte-3:\s*#8a8a8e/i, 'le plancher T4 de noir.css');
});

/* ═════════════════════════  4. Données fictives, langue, hygiène  ═════════════════════════ */

const NOMS_INTERDITS = ['Menna', 'Dupont', 'Dupuis', 'Aaron', 'Mohamed', 'Riyad', 'Harun', 'Cabinet Roux', 'Medina', 'Atelier du mardi', 'Roux'];

await dit('aucun nom propre d’exemple : ni les noms de la maquette ni de personne réelle, ni dans les sources ni dans le rendu', () => {
  for (const f of FICHIERS) {
    const src = lire(f).toLowerCase();
    for (const nom of NOMS_INTERDITS) assert.ok(!new RegExp(`\\b${nom.toLowerCase()}\\b`).test(src), `${f} contient « ${nom} »`);
  }
  const vu = texte(html).toLowerCase();
  for (const nom of NOMS_INTERDITS) assert.ok(!new RegExp(`\\b${nom.toLowerCase()}\\b`).test(vu), `le rendu contient « ${nom} »`);
  // Les exemples sont génériques : « Personne 1 », « Client A », « Projet A »…
  assert.ok(R.PERSONNES.every((p) => /^Personne \d+$/.test(p)), 'personnes');
  assert.ok(R.ORGANISATIONS.every((o) => /^Client [A-Z]$/.test(o)), 'organisations');
  assert.ok(R.MESSAGES.every((m) => /^Message [A-Z]$/.test(m.titre)) && R.MODULES.every((m) => /^Module [A-Z]$/.test(m.titre)), 'messages et modules');
  const exemples = sansCommentaires(lire(`${DOSSIER}/exemples.ts`));
  assert.ok(!/@|https?:\/\/|\+?\d{2}[ .]\d{2}[ .]\d{2}[ .]\d{2}/.test(exemples), 'un courriel, une adresse ou un téléphone dans les exemples');
  assert.ok(R.PERSONNES.length >= 6, 'six personnes au moins : les six teintes d’avatar');
  for (let t = 0; t < 6; t += 1) assert.ok(html.includes(`data-teinte="${t}"`), `la teinte d’avatar ${t} n’est pas montrée`);
});

await dit('français : vouvoiement, aucun point d’exclamation, aucun émoji, dans les sources et dans le rendu', () => {
  const emoji = /\p{Extended_Pictographic}/u;
  const sansSignesDeClavier = (s: string) => s.replace(/[⌘·§→−–—…]/g, '');
  for (const f of FICHIERS) {
    const src = sansSignesDeClavier(lire(f));
    assert.ok(!emoji.test(src), `${f} : un émoji (${src.match(emoji)?.[0]})`);
  }
  assert.ok(!emoji.test(sansSignesDeClavier(html)), 'le rendu contient un émoji');
  const vu = texte(html);
  assert.ok(!vu.includes('!'), `le rendu contient un point d’exclamation : « ${vu.slice(Math.max(0, vu.indexOf('!') - 30), vu.indexOf('!') + 10)} »`);
  const { en, fr } = R.dictionnairesDemo;
  for (const [langue, d] of Object.entries({ en, fr })) {
    for (const [cle, v] of Object.entries(d)) {
      assert.ok(!v.includes('!'), `${langue} « ${cle} » : point d’exclamation`);
      assert.ok(v.trim().length > 0, `${langue} « ${cle} » est vide`);
    }
  }
  for (const [cle, v] of Object.entries(fr)) {
    assert.ok(!/(?<![\p{L}])(tu|toi|tes)(?![\p{L}])|(?<![\p{L}])t['’][\p{L}]/iu.test(v), `fr « ${cle} » : tutoiement`);
    assert.ok(!/'/.test(v), `fr « ${cle} » : apostrophe droite (utiliser ’)`);
    assert.deepEqual([...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(), [...en[cle].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(), `fr « ${cle} » : mêmes paramètres que l’anglais`);
  }
  assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort(), 'fr et en ont les mêmes clés');
  assert.ok(!/[«»]/.test(Object.values(en).join('')), 'l’anglais ne garde pas de guillemets français');
});

await dit('aucun texte en dur dans la page : tout passe par i18n.ts (le JSX ne contient que des expressions)', () => {
  const lignes = pageSansCommentaires.split('\n');
  // Une ligne de pur texte (des mots séparés par des espaces, sans accolade ni chevron), ou du texte entre deux balises.
  const brut = lignes.filter((l) => /^\s*[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ']*( [A-Za-zÀ-ÿ'.,]+)+\s*$/.test(l) && !/^\s*(import|export|return|const|type|interface|function|case|default|else|if)\b/.test(l));
  const entreBalises = lignes.filter((l) => />[A-Za-zÀ-ÿ][^<>{}]{3,}<\//.test(l));
  assert.deepEqual([...brut, ...entreBalises], [], `texte brut dans le JSX : ${[...brut, ...entreBalises].slice(0, 3).join(' | ')}`);
});

/* ═════════════════════════  5. La semaine courante  ═════════════════════════ */

await dit('semaine : cinq événements générés par rapport à la date de référence, toujours dans la semaine affichée, y compris le dimanche et aux changements d’heure', () => {
  // Chaque jour d'une année, dont les deux changements d'heure d'Europe/Paris : la propriété tient partout.
  let jour = new Date(2026, 0, 1, 13, 30);
  let essais = 0;
  while (jour.getFullYear() === 2026) {
    const { debut, evenements } = R.evenementsDeLaSemaine(jour);
    const lundi = R.lundiDe(jour);
    assert.equal(lundi.getDay(), 1, `le lundi de ${jour.toDateString()}`);
    assert.equal(debut.getTime(), lundi.getTime());
    assert.equal(evenements.length, 5);
    const finDeSemaine = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + 7);
    for (const e of evenements) {
      assert.ok(e.debut >= lundi && e.fin <= finDeSemaine, `l’événement ${e.id} sort de la semaine du ${lundi.toDateString()}`);
      assert.ok(e.fin > e.debut, `l’événement ${e.id} finit avant de commencer`);
      assert.ok(e.debut.getHours() >= 8 && e.fin.getHours() <= 19, 'dans la plage 8 h à 19 h de la grille');
    }
    const memeJour = (d: Date) => d.toDateString() === jour.toDateString();
    const aujourdhui = evenements.filter((e) => memeJour(e.debut));
    assert.equal(aujourdhui.length, 2, 'deux événements le jour de référence');
    assert.ok(aujourdhui[0].debut < aujourdhui[1].fin && aujourdhui[1].debut < aujourdhui[0].fin, 'ils se chevauchent');
    assert.equal(new Set(evenements.map((e) => e.debut.toDateString())).size, 4, 'quatre jours différents');
    jour = new Date(jour.getFullYear(), jour.getMonth(), jour.getDate() + 1, 13, 30);
    essais += 1;
  }
  assert.equal(essais, 365);
  // La page l'appelle avec l'instant présent, pas avec une date écrite.
  assert.match(pageSansCommentaires, /const maintenant = new Date\(\);\s*const semaine = evenementsDeLaSemaine\(maintenant\);/);
  assert.ok(!/new Date\(\d{4}/.test(pageSansCommentaires), 'une date écrite en dur dans la page');
  const jours = R.nomsDesJours('fr-FR');
  assert.equal(jours.length, 7);
  assert.equal(jours[0].nom, 'lundi');
  assert.equal(jours[6].initiale, 'D');
});

/* ═════════════════════════  6. L'édition cliente  ═════════════════════════ */

await dit('édition cliente : aucun fichier hors de la page (et hors couture *.internal) ne l’importe, et elle ne touche à aucun fichier partagé', () => {
  const fautes: string[] = [];
  const parcourir = (dir: string) => {
    for (const e of fs.readdirSync(path.join(racine, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) {
        if (rel !== DOSSIER) parcourir(rel);
      } else if (/\.(tsx?|css|mjs|js)$/.test(e.name) && !/\.internal\.tsx?$/.test(rel)) {
        if (/(?:from|import|lazy)[^\n]*(?:systeme\/demo|PageDemoSocle)|import\s*\(\s*'[^']*(?:systeme\/demo|PageDemoSocle)/.test(fs.readFileSync(path.join(racine, rel), 'utf8'))) fautes.push(rel);
      }
    }
  };
  parcourir('src');
  assert.deepEqual(fautes, [], `importée par un fichier partagé : ${fautes.join(', ')}`);
  // Elle n'importe elle-même rien de l'édition, des écrans ni des composants d'origine.
  for (const f of FICHIERS.filter((x) => /\.tsx?$/.test(x))) assert.ok(!/src\/(edition|screens|components)\b|\.\.\/(edition|screens|components)\//.test(lire(f)), `${f} importe l’édition, les écrans ou les composants`);
});

await dit('package.json : check:systeme-demo est déclaré, sur une ligne, sur le modèle de check:socle-controles', () => {
  const lignes = lire('package.json').split('\n');
  const modele = lignes.find((l) => l.includes('"check:socle-controles"')) ?? '';
  const miens = lignes.filter((l) => l.includes('"check:systeme-demo"'));
  assert.equal(miens.length, 1, 'une seule déclaration');
  assert.equal(miens[0].trim().replace('check:systeme-demo', 'check:socle-controles').replace('check-systeme-demo.ts', 'check-socle-controles.ts'), modele.trim().replace(/,$/, '') + (miens[0].trim().endsWith(',') ? ',' : ''));
});

fin();
