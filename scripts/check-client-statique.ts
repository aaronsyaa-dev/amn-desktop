/**
 * PREUVE STATIQUE D'ISOLEMENT DE L'ÉDITION CLIENTE — sans build servi, sans navigateur.
 *
 *   npm run check:client-statique [-- --liste <fichier>] [-- --metafile <fichier.json>]
 *
 * Construit le paquet client (AMN Desktop, `business`) avec esbuild depuis l'entrée `src/renderer.tsx`,
 * en mémoire, avec les alias de `editionAliases('business')` (vite.edition.ts) et le tsconfig Business,
 * puis lit le graphe d'imports (metafile) :
 *
 *   · le paquet client n'atteint AUCUN fichier de `src/socle/**`, `src/refonte/**`, `src/edition/*.internal.*`,
 *     `src/components/AppLayout.tsx`, `src/components/IdleScreensaver.tsx`, ni de la coque interne
 *     `src/client-context/**` (la session de support) et `src/bureaux/**` (les cinq bureaux) — un import de
 *     `ClientContextLayout` ou de `CadreBureau` par un fichier partagé est une faute d'import, pas un hasard de texte ;
 *   · le texte du paquet ne contient aucun motif de `scripts/business-bundle-rules.mjs` (`FORBIDDEN`,
 *     exception comptée comprise) ;
 *   · la liste des fichiers atteints hors node_modules est écrite dans la sortie, pour relecture.
 *
 * Ce contrôle garantit les IMPORTS. Les feuilles CSS sont chargées vides ici : une fuite de CSS (le bloc
 * socle de `src/index.css`, constat C-001 de T1) n'est pas ce qu'il mesure ; elle est RAPPORTÉE à part,
 * sans faire échouer, et reste au CO.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { editionAliases } from '../vite.edition.ts';
import { FORBIDDEN, REQUIRED, maskAllowed, createAllowanceBudget } from './business-bundle-rules.mjs';
import { racine } from './lib/essai-socle.ts';

process.chdir(racine);
const args = process.argv.slice(2);
const iListe = args.indexOf('--liste');
const LISTE = iListe >= 0 ? args[iListe + 1] : null;
const iMeta = args.indexOf('--metafile');
const METAFILE = iMeta >= 0 ? args[iMeta + 1] : null;

const ENTREE = 'src/renderer.tsx';
/** Ce que le paquet client ne doit jamais atteindre : un préfixe, ou un test. */
const INTERDITS: { nom: string; touche: (f: string) => boolean }[] = [
  { nom: 'src/socle/**', touche: (f) => f.startsWith('src/socle/') },
  { nom: 'src/refonte/**', touche: (f) => f.startsWith('src/refonte/') },
  { nom: 'src/edition/*.internal.*', touche: (f) => /^src\/edition\/[^/]*\.internal\./.test(f) },
  { nom: 'src/components/AppLayout.tsx', touche: (f) => f === 'src/components/AppLayout.tsx' },
  { nom: 'src/components/IdleScreensaver.tsx', touche: (f) => f === 'src/components/IdleScreensaver.tsx' },
  // La coque interne : la session de support cliente et la pièce des cinq bureaux, montées par AppLayout seulement.
  { nom: 'src/client-context/**', touche: (f) => f.startsWith('src/client-context/') },
  { nom: 'src/bureaux/**', touche: (f) => f.startsWith('src/bureaux/') },
];
/** Ce que le paquet client DOIT atteindre : sans quoi un build vide ou mal aiguillé passerait au vert. */
const ATTENDUS = ['src/edition/appRoot.business.tsx', 'src/business/BusinessLayout.tsx'];

const alias = editionAliases('business');
const tsconfigBusiness = JSON.parse(fs.readFileSync(path.join(racine, 'tsconfig.business.json'), 'utf8').replace(/^\s*\/\/.*$/gm, ''));
const chemins = tsconfigBusiness.compilerOptions.paths as Record<string, string[]>;

const fautes: string[] = [];
const notes: string[] = [];

// 0. Les alias de vite.edition.ts et de tsconfig.business.json disent la même chose : le paquet construit ici
//    est bien celui que Vite construirait.
for (const [nom, cible] of Object.entries(alias)) {
  const rel = path.relative(racine, cible).replace(/\\/g, '/');
  if (!chemins[nom] || chemins[nom][0] !== rel) fautes.push(`alias ${nom} : vite.edition.ts → ${rel}, tsconfig.business.json → ${chemins[nom]?.[0] ?? 'absent'}`);
  if (!fs.existsSync(cible)) fautes.push(`alias ${nom} : ${rel} n'existe pas`);
  if (/\.internal\./.test(rel)) fautes.push(`alias ${nom} : l'édition cliente pointerait vers un fichier interne (${rel})`);
}
for (const nom of Object.keys(chemins)) if (!alias[nom]) fautes.push(`alias ${nom} : dans tsconfig.business.json mais pas dans vite.edition.ts`);

/**
 * esbuild ne replie pas une constante d'un module à l'autre, là où Rollup (Vite) le fait : `IS_BUSINESS` resterait une
 * variable, et les branches de l'édition interne (`IS_BUSINESS ? … : …`) resteraient dans le texte alors que le vrai
 * paquet ne les a pas. `IS_BUSINESS` est, par définition, `__AMN_EDITION__ === 'business'` (src/edition/edition.ts) :
 * il est replié à la source dans chaque fichier qui l'importe, et `define` en fait un littéral. Rien d'autre n'est réécrit.
 */
const SRC = path.join(racine, 'src') + path.sep;
const EDITION_TS = path.join(racine, 'src', 'edition', 'edition.ts');
let replies = 0;
const pluginRepli: esbuild.Plugin = {
  name: 'repli-is-business',
  setup(b) {
    b.onLoad({ filter: /\.tsx?$/ }, (args) => {
      if (!args.path.startsWith(SRC)) return null;
      const source = fs.readFileSync(args.path, 'utf8');
      if (!/\bIS_BUSINESS\b/.test(source)) return null;
      replies += 1;
      const morceaux = source.split(/(import\s+(?:type\s+)?\{[^}]*\}\s*from\s*'[^']*';?)/g);
      const contents = morceaux
        .map((m, i) => (i % 2 === 1 ? m : m.replace(/(?<!const )\bIS_BUSINESS\b/g, "(__AMN_EDITION__ === 'business')")))
        .join('')
        .replace(/export const IS_BUSINESS = EDITION === 'business';/, "export const IS_BUSINESS = __AMN_EDITION__ === 'business';");
      if (args.path === EDITION_TS && !contents.includes("export const IS_BUSINESS = __AMN_EDITION__ === 'business';")) {
        throw new Error('src/edition/edition.ts : la définition de IS_BUSINESS a changé, le repli ne la reconnaît plus');
      }
      return { contents, loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts' };
    });
  },
};

// 1. Le paquet client, en mémoire — minifié, comme le vrai : les commentaires et les noms de variables n'y sont
//    pas, et `import.meta.env.VITE_*` est remplacé par sa valeur (vide ici, comme un build cliente sans jeton).
const envVite = new Set<string>();
const marcher = (d: string) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) marcher(p);
    else if (/\.(tsx?|mjs|js)$/.test(e.name)) for (const [, n] of fs.readFileSync(p, 'utf8').matchAll(/import\.meta\.env\.(VITE_\w+)/g)) envVite.add(n);
  }
};
marcher(path.join(racine, 'src'));
const vide = ['.css', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.mp3', '.wav', '.md', '.txt'];
const construit = await esbuild.build({
  entryPoints: [path.join(racine, ENTREE)],
  bundle: true,
  write: false,
  metafile: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  charset: 'utf8',
  jsx: 'automatic',
  tsconfig: path.join(racine, 'tsconfig.business.json'),
  alias,
  loader: Object.fromEntries(vide.map((ext) => [ext, 'empty' as const])),
  define: {
    'process.env.NODE_ENV': '"production"',
    'import.meta.env.DEV': 'false',
    'import.meta.env.PROD': 'true',
    'import.meta.env.MODE': '"production"',
    __AMN_EDITION__: '"business"',
    __AMN_VERSION__: '"0.0.0"',
    __AMN_TOKEN_BAKED__: 'false',
    ...Object.fromEntries([...envVite].sort().map((n) => [`import.meta.env.${n}`, '""'])),
  },
  minify: true,
  plugins: [pluginRepli],
  logLevel: 'silent',
});

const propre = (p: string) => p.replace(/\\/g, '/');
const atteints = Object.keys(construit.metafile.inputs).map(propre).sort();
// `node_modules` peut être un lien vers un autre dossier : on reconnaît le segment, pas le préfixe.
const horsModules = atteints.filter((f) => !/(^|\/)node_modules\//.test(f) && !/^[(<]/.test(f));
const premierTexte = construit.outputFiles.map((o) => o.text).join('\n');

/**
 * esbuild compte les usages d'un symbole AVANT de retirer une branche morte : une constante qui ne servait qu'à
 * cette branche reste dans le texte (Rollup, lui, la retire). Le texte est repassé dans esbuild, comme un module
 * ES, jusqu'à ce qu'il ne maigrisse plus : ce que Rollup fait en une passe. Le graphe d'imports (metafile) reste
 * celui de la première passe, la seule qui lit les sources.
 */
async function repasser(texte: string): Promise<{ texte: string; passes: number }> {
  let courant = texte;
  for (let passes = 1; passes <= 6; passes += 1) {
    const r = await esbuild.build({
      stdin: { contents: `${courant}\nexport {};`, loader: 'js', resolveDir: racine },
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'browser',
      target: 'es2022',
      charset: 'utf8',
      minify: true,
      logLevel: 'silent',
    });
    const suivant = r.outputFiles[0].text;
    if (suivant.length >= courant.length) return { texte: courant, passes };
    courant = suivant;
  }
  return { texte: courant, passes: 6 };
}
const { texte, passes } = await repasser(premierTexte);

// 2. Les imports : rien de la refonte, rien de la coque interne.
for (const { nom, touche } of INTERDITS) {
  const fuites = horsModules.filter(touche);
  for (const f of fuites) {
    // Le premier importeur, pour que la correction aille droit au fichier fautif.
    const importeur = Object.entries(construit.metafile.inputs).find(([k, v]) => propre(k) !== f && v.imports.some((i) => propre(i.path) === f))?.[0];
    fautes.push(`${nom} : le paquet client atteint ${f}${importeur ? ` (importé par ${propre(importeur)})` : ''}`);
  }
}
for (const f of ATTENDUS) if (!atteints.includes(f)) fautes.push(`le paquet client n'atteint pas ${f} : ce n'est pas l'édition cliente qui a été construite`);

// 3. Le texte du paquet : les motifs interdits de business-bundle-rules.mjs, exception comptée respectée
//    (maskAllowed masque « by AMN DevSec » une fois pour tout le paquet, et pas une de plus).
const budget = createAllowanceBudget();
for (const regle of FORBIDDEN) {
  const scanne = maskAllowed(texte, regle, budget);
  const botte = regle.caseSensitive ? scanne : scanne.toLowerCase();
  const aiguille = regle.caseSensitive ? regle.pattern : regle.pattern.toLowerCase();
  const i = botte.indexOf(aiguille);
  if (i !== -1) {
    fautes.push(`motif interdit « ${regle.pattern} » (${regle.why}) : …${texte.slice(Math.max(0, i - 70), i + regle.pattern.length + 70).replace(/\s+/g, ' ')}…`);
  }
}
// Les marqueurs que le paquet livré DOIT porter (mêmes règles que check:business) : un build vide passerait au vert sans eux.
const texteMinuscule = texte.toLowerCase();
for (const regle of REQUIRED) {
  if (!texteMinuscule.includes(regle.pattern.toLowerCase())) fautes.push(`marqueur attendu absent « ${regle.pattern} » (${regle.why}) : ce n’est pas l’édition livrée`);
}

// 4. Le CSS, rapporté à part (hors du périmètre de ce contrôle : C-001 est au CO).
const feuilles = horsModules.filter((f) => f.endsWith('.css'));
for (const f of feuilles) {
  const css = fs.readFileSync(path.join(racine, f), 'utf8');
  const socle = (css.match(/--color-socle-|\[data-famille=|\[data-mouvement=|\.socle-|\.fam-|\.etat-/g) ?? []).length;
  if (socle > 0) notes.push(`${f} est atteint par le paquet client et contient ${socle} référence(s) au socle (constat C-001 de T1, au CO) : chargé vide ici, non mesuré`);
}

// 5. La sortie.
const liste = horsModules.join('\n');
if (METAFILE) fs.writeFileSync(METAFILE, JSON.stringify(construit.metafile));
if (LISTE) {
  fs.mkdirSync(path.dirname(path.resolve(LISTE)), { recursive: true });
  fs.writeFileSync(LISTE, `${liste}\n`);
}
console.log(`Preuve statique d’isolement de l’édition cliente — ${ENTREE}, ${Object.keys(alias).length} alias business, IS_BUSINESS replié dans ${replies} fichiers, ${atteints.length} fichiers atteints (${horsModules.length} hors node_modules), ${Math.round(premierTexte.length / 1024)} Ko de JavaScript, ${Math.round(texte.length / 1024)} Ko après ${passes} repasse(s)\n`);
console.log('Fichiers atteints hors node_modules :');
for (const f of horsModules) console.log(`  ${f}`);
console.log('');
for (const n of notes) console.log(`  note : ${n}`);
if (notes.length) console.log('');
if (fautes.length) {
  console.error(`ÉCHEC — ${fautes.length} fuite(s) vers l’édition cliente :`);
  for (const f of fautes) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`OK — aucun fichier de ${INTERDITS.map((i) => i.nom).join(', ')} ; aucun des ${FORBIDDEN.length} motifs interdits dans le texte du paquet, les ${REQUIRED.length} marqueurs de l’édition livrée présents.`);
