/**
 * Contrôle du MÉCANISME DE SUBSTITUTION D'ÉCRANS (refonte, STATUT § 1.3) — sans navigateur.
 *
 *   npm run check:substitutions
 *
 * Ce qu'il tient : chaque route déclarée existe dans `appRoot.internal.tsx` (lecture des sources),
 * aucune route en double, les substituts vivent dans `src/refonte/<lot>/` et n'importent pas
 * `src/screens/**`, le jumeau `.business` est inerte (rend l'Outlet, registre vide), la coque interne
 * (`AppLayout`, `CadreBureau`, `ClientContextLayout`) n'a plus un seul Outlet nu — un point de substitution
 * à la place de chacun —, la clé `module` déclarée est celle de la garde `ModuleRoute` de la route d'origine
 * (lue dans les sources, par bloc : édition interne, session de support), `ModuleRoute` est conservé quand
 * `module` est déclaré, `declarations/` ne contient que des `.tsx` (un `.ts` serait ignoré en silence),
 * coquille éteinte → l'écran d'origine, et le mécanisme survit à un fichier de déclaration vide ou absent.
 *
 * `node_modules` peut être un lien vers un autre dossier (les arbres de travail) : le graphe d'imports le
 * reconnaît au segment, jamais au préfixe.
 *
 * Le registre réel n'a aucune substitution aujourd'hui (LOT-00 n'a rien d'honnête à substituer) : une
 * substitution FACTICE est montée ici, dans le contrôle seulement, sur le même composant.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { assert, creerEssais, lire, racine, sansCommentaires } from './lib/essai-socle.ts';
import { editionAliases } from '../vite.edition.ts';

process.chdir(racine);
const { dit, fin } = creerEssais('Substitution d’écrans (§ 1.3)');

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * `import.meta.glob` est un mot de Vite, qu'esbuild ne connaît pas : les deux registres de la refonte
 * (`modules/registre.ts`, `substitutions/registre.ts`) ramassent leurs déclarations avec. Ici, on le
 * remplace par les imports du dossier, lus sur le disque — ou, pour le registre des substitutions, par des
 * fichiers VIRTUELS (`virtuels`) : un dossier vide, un fichier vide, une déclaration factice.
 */
function pluginGlob(virtuels?: Record<string, string>): esbuild.Plugin {
  return {
    name: 'import-meta-glob',
    setup(b) {
      b.onLoad({ filter: /[\\/]src[\\/]refonte[\\/](modules|substitutions)[\\/]registre\.ts$/ }, (args) => {
        const dir = path.dirname(args.path);
        const substitutions = /[\\/]substitutions[\\/]/.test(args.path);
        const imports: string[] = [];
        let remplacements = 0;
        const contents = fs.readFileSync(args.path, 'utf8').replace(
          /import\.meta\.glob(?:<[^>]*>)?\(\s*'\.\/([\w-]+)\/\*\.(tsx?)'[^)]*\)/g,
          (_tout, sous: string, ext: string) => {
            remplacements += 1;
            const noms =
              substitutions && virtuels
                ? Object.keys(virtuels)
                : fs.readdirSync(path.join(dir, sous)).filter((f) => f.endsWith(`.${ext}`)).sort();
            const champs = noms.map((f) => {
              const n = imports.length;
              imports.push(`import * as __glob${n} from '${substitutions && virtuels ? `virtuel:${f}` : `./${sous}/${f}`}';`);
              return `'./${sous}/${f}': __glob${n}`;
            });
            return `{ ${champs.join(', ')} }`;
          },
        );
        if (remplacements !== 1) throw new Error(`${args.path} : ${remplacements} import.meta.glob remplacé(s), 1 attendu`);
        return { contents: `${imports.join('\n')}\n${contents}`, loader: 'ts' };
      });
      if (virtuels) {
        b.onResolve({ filter: /^virtuel:/ }, (a) => ({ path: a.path.slice('virtuel:'.length), namespace: 'virtuel' }));
        b.onLoad({ filter: /.*/, namespace: 'virtuel' }, (a) => ({
          contents: virtuels[a.path],
          loader: 'tsx',
          resolveDir: path.join(racine, 'src/refonte/substitutions/declarations'),
        }));
      }
    },
  };
}

/** Charge un bout de code des sources (alias résolus par tsconfig.json : édition interne), feuilles ignorées. */
async function charger<T>(code: string, virtuels?: Record<string, string>): Promise<T> {
  const construit = await esbuild.build({
    plugins: [pluginGlob(virtuels)],
    stdin: { contents: code, resolveDir: path.join(racine, 'scripts'), loader: 'tsx' },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    charset: 'utf8',
    jsx: 'automatic',
    tsconfig: path.join(racine, 'tsconfig.json'),
    loader: { '.css': 'empty', '.svg': 'empty', '.png': 'empty' },
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', __AMN_EDITION__: '"internal"', __AMN_VERSION__: '"0.0.0"' },
    logLevel: 'silent',
  });
  return (await import(`data:text/javascript;charset=utf-8;base64,${Buffer.from(construit.outputFiles[0].text, 'utf8').toString('base64')}`)) as T;
}

/** Le graphe d'imports d'un fichier des sources (chemins relatifs à la racine, hors node_modules). */
async function graphe(fichier: string): Promise<{ directs: string[]; tous: string[] }> {
  const r = await esbuild.build({
    entryPoints: [path.join(racine, fichier)],
    bundle: true,
    write: false,
    metafile: true,
    format: 'esm',
    platform: 'browser',
    jsx: 'automatic',
    tsconfig: path.join(racine, 'tsconfig.json'),
    loader: { '.css': 'empty', '.svg': 'empty', '.png': 'empty' },
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', __AMN_EDITION__: '"internal"', __AMN_VERSION__: '"0.0.0"' },
    logLevel: 'silent',
  });
  const entrees = r.metafile.inputs;
  const propre = (p: string) => p.replace(/\\/g, '/');
  // `node_modules` peut être un lien vers un autre dossier (`../autre-arbre/node_modules/react/…` dans le metafile) :
  // on reconnaît le segment, pas le préfixe — sinon un `import { lazy } from 'react'` passerait pour un import de source.
  const horsModules = (p: string) => !/(^|\/)node_modules\//.test(p);
  const directs = (entrees[fichier]?.imports ?? []).map((i) => propre(i.path)).filter(horsModules);
  const tous = Object.keys(entrees).map(propre).filter(horsModules);
  return { directs, tous };
}

const DOSSIER = 'src/refonte/substitutions';
const DECLARATIONS = `${DOSSIER}/declarations`;
const fichiersDeclares = fs.readdirSync(path.join(racine, DECLARATIONS)).filter((f) => f.endsWith('.tsx')).sort();

/* ── 1. La déclaration, la couture et ses trois alias ─────────────────────────────────────────── */

await dit('declarer.ts expose declarerSubstitutions et le type Substitution (route, module?, composant, support?, toujours?)', () => {
  const src = sansCommentaires(lire(`${DOSSIER}/declarer.ts`));
  assert.match(src, /export function declarerSubstitutions\(lot: string, substitutions: readonly Substitution\[\]\): DeclarationSubstitutions/);
  assert.match(src, /route: string;/);
  assert.match(src, /module\?: string;/);
  assert.match(src, /composant: React\.ComponentType \| React\.LazyExoticComponent<React\.ComponentType>;/);
  assert.match(src, /support\?: 'identique' \| 'aucune';/);
  assert.match(src, /toujours\?: boolean;/);
});

await dit('l’alias @edition/substitutions est déclaré aux trois endroits (vite.edition.ts, tsconfig.json, tsconfig.business.json), et chaque alias l’est', () => {
  for (const edition of ['internal', 'business'] as const) {
    const alias = editionAliases(edition);
    const chemins = JSON.parse(lire(edition === 'internal' ? 'tsconfig.json' : 'tsconfig.business.json').replace(/^\s*\/\/.*$/gm, '')).compilerOptions.paths as Record<string, string[]>;
    assert.ok(alias['@edition/substitutions'], 'vite.edition.ts ne déclare pas @edition/substitutions');
    assert.deepEqual(Object.keys(chemins).sort(), Object.keys(alias).sort(), `${edition} : vite.edition.ts et le tsconfig ne déclarent pas les mêmes alias`);
    for (const [nom, cible] of Object.entries(alias)) {
      const rel = path.relative(racine, cible).replace(/\\/g, '/');
      assert.deepEqual(chemins[nom], [rel], `${edition} › ${nom} : ${chemins[nom]} ≠ ${rel}`);
      assert.ok(fs.existsSync(cible), `${edition} › ${nom} : ${rel} n'existe pas`);
    }
  }
});

await dit('le jumeau .business est inerte : il n’importe rien du socle ni de la refonte, rend l’Outlet, et son registre est vide', async () => {
  const src = sansCommentaires(lire('src/edition/substitutions.business.tsx'));
  assert.doesNotMatch(src, /from '[^']*(socle|refonte)[^']*'/);
  assert.match(src, /import \{ Outlet \} from 'react-router-dom';/);
  assert.match(src, /<Outlet \/>/);
  const m = await charger<any>(`
    import { createElement as h } from 'react';
    import { renderToStaticMarkup } from 'react-dom/server.browser';
    import { MemoryRouter, Routes, Route } from 'react-router-dom';
    import { SubstitutionDEcran, REGISTRE_SUBSTITUTIONS } from '../src/edition/substitutions.business.tsx';
    export const registre = REGISTRE_SUBSTITUTIONS;
    export const rendu = renderToStaticMarkup(h(MemoryRouter, { initialEntries: ['/tasks'] }, h(Routes, null,
      h(Route, { element: h(SubstitutionDEcran, { support: true }) }, h(Route, { path: '/tasks', element: h('p', null, 'ORIGINE') })))));
  `);
  assert.deepEqual(m.registre, { substitutions: [], fautes: [] });
  assert.equal(m.rendu, '<p>ORIGINE</p>');
});

await dit('AppLayout a un point de substitution par Outlet (deux : ancienne coquille et CoquilleRefonte) et CadreBureau un (les routes des bureaux), par la couture ; ClientContextLayout un, en support', () => {
  const layout = sansCommentaires(lire('src/components/AppLayout.tsx'));
  assert.match(layout, /import \{ SubstitutionDEcran \} from '@edition\/substitutions';/);
  assert.doesNotMatch(layout, /<Outlet/, 'un Outlet nu subsiste dans AppLayout : un écran y échapperait à la substitution');
  assert.doesNotMatch(layout, /\bOutlet\b/, 'AppLayout importe encore Outlet');
  assert.equal(layout.match(/<SubstitutionDEcran \/>/g)?.length, 2, 'AppLayout : deux points de substitution attendus, sans propriété support');
  const coquille = layout.slice(layout.indexOf('<CoquilleRefonte'), layout.indexOf('</CoquilleRefonte>'));
  assert.equal(coquille.match(/<SubstitutionDEcran \/>/g)?.length, 1, 'un seul point dans CoquilleRefonte');
  // Les bureaux : AppLayout rend CadreBureau AVANT ses deux points, et CadreBureau pose l'écran lui-même. Un Outlet nu
  // ici, et les routes des cinq bureaux (/garde/*, /cyber/*, /supervisor/*, /studio/*, /strategie/*) échapperaient au mécanisme.
  assert.match(layout, /\{bureau \? \(\s*<CadreBureau bureau=\{bureau\} \/>/, 'AppLayout rend CadreBureau pour un chemin de bureau');
  const cadre = sansCommentaires(lire('src/bureaux/CadreBureau.tsx'));
  assert.match(cadre, /import \{ SubstitutionDEcran \} from '@edition\/substitutions';/, 'CadreBureau passe par la couture');
  assert.doesNotMatch(cadre, /<Outlet|\bOutlet\b/, 'un Outlet nu subsiste dans CadreBureau : les écrans des bureaux y échapperaient à la substitution');
  assert.equal(cadre.match(/<SubstitutionDEcran \/>/g)?.length, 1, 'CadreBureau : un point de substitution, sans propriété support');
  const support = sansCommentaires(lire('src/client-context/ClientContextLayout.tsx'));
  assert.match(support, /import \{ SubstitutionDEcran \} from '@edition\/substitutions';/);
  assert.doesNotMatch(support, /<Outlet|\bOutlet\b/);
  assert.equal(support.match(/<SubstitutionDEcran support \/>/g)?.length, 1, 'ClientContextLayout : un point, en session de support');
});

await dit('aucun autre <Outlet /> dans src : les seuls sont le point lui-même, son jumeau cliente et la coque cliente (BusinessLayout)', () => {
  const admis = new Set([`${DOSSIER}/SubstitutionDEcran.tsx`, 'src/edition/substitutions.business.tsx', 'src/business/BusinessLayout.tsx']);
  const fautes: string[] = [];
  const marcher = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) marcher(f);
      else if (/\.tsx?$/.test(e.name)) {
        const rel = path.relative(racine, f).replace(/\\/g, '/');
        if (admis.has(rel)) continue;
        if (/<Outlet\b/.test(sansCommentaires(fs.readFileSync(f, 'utf8')))) fautes.push(rel);
      }
    }
  };
  marcher(path.join(racine, 'src'));
  assert.deepEqual(fautes, [], 'un Outlet nu rend des écrans hors du point de substitution');
  for (const f of admis) assert.match(sansCommentaires(lire(f)), /<Outlet \/>/, `${f} : l'Outlet attendu manque`);
});

await dit('aucun fichier partagé n’importe src/refonte/substitutions : seule la couture interne y mène', () => {
  const fautes: string[] = [];
  const marcher = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) marcher(f);
      else if (/\.tsx?$/.test(e.name)) {
        const rel = path.relative(racine, f).replace(/\\/g, '/');
        if (rel.startsWith(DOSSIER) || rel === 'src/edition/substitutions.internal.tsx') continue;
        if (/from '[^']*refonte\/substitutions[^']*'/.test(sansCommentaires(fs.readFileSync(f, 'utf8')))) fautes.push(rel);
      }
    }
  };
  marcher(path.join(racine, 'src'));
  assert.deepEqual(fautes, []);
});

/* ── 2. Les routes d'origine, lues dans les sources ──────────────────────────────────────────── */

/** Les gardes `ModuleRoute` d'un bloc de routes (`<Route path="…" element={<ModuleRoute module="…">`) : route → clé de module. */
function gardesDuBloc(bloc: string): Map<string, string> {
  const gardes = new Map<string, string>();
  for (const [, route, module] of bloc.matchAll(/<Route\s+path="([^"]+)"\s+element=\{\s*<ModuleRoute module="([^"]+)">/g)) gardes.set(route, module);
  return gardes;
}

interface RoutesDOrigine {
  /** Toutes les routes montées par `appRoot.internal.tsx` : littérales, constantes importées, bureaux, registre. */
  routes: Set<string>;
  /** Les gardes `ModuleRoute` des routes de l'édition interne (`AmnRoutes`, sous `AppLayout`). */
  gardesInterne: Map<string, string>;
  /** Les gardes `ModuleRoute` des routes de la session de support cliente (`ClientContextRoutes`). */
  gardesSupport: Map<string, string>;
}

/** Les routes d'origine, lues dans les sources, et la garde `ModuleRoute` de chacune, par bloc. */
async function routesDAppRoot(): Promise<RoutesDOrigine> {
  const routes = new Set<string>();
  const appRoot = sansCommentaires(lire('src/edition/appRoot.internal.tsx'));
  for (const [, p] of appRoot.matchAll(/path="([^"]+)"/g)) routes.add(p);
  const debutInterne = appRoot.indexOf('function AmnRoutes()');
  const debutSupport = appRoot.indexOf('function ClientContextRoutes()');
  assert.ok(debutInterne >= 0 && debutSupport > debutInterne, 'appRoot.internal.tsx : les blocs AmnRoutes puis ClientContextRoutes');
  const gardesInterne = gardesDuBloc(appRoot.slice(debutInterne, debutSupport));
  const gardesSupport = gardesDuBloc(appRoot.slice(debutSupport));
  for (const [, p] of sansCommentaires(lire('src/bureaux/routes.tsx')).matchAll(/path="([^"]+)"/g)) routes.add(p);
  // `path={CONSTANTE}` : la constante est lue dans le module qui l'exporte, jamais devinée.
  const noms = [...new Set([...appRoot.matchAll(/path=\{(\w+)\}/g)].map((m) => m[1]))];
  const imports: string[] = [];
  for (const nom of noms) {
    const ligne = [...appRoot.matchAll(/import \{([^}]+)\} from '([^']+)';/g)].find((m) => m[1].split(',').some((n) => n.trim() === nom));
    assert.ok(ligne, `appRoot.internal.tsx : la constante ${nom} n'est pas importée`);
    const spec = ligne[2].startsWith('.') ? path.join('../src/edition', ligne[2]).replace(/\\/g, '/') : ligne[2];
    imports.push(`import { ${nom} } from '${spec}';`);
  }
  const m = await charger<any>(`
    ${imports.join('\n')}
    import { ecransNeufs } from '../src/refonte/modules/routes';
    export const constantes = { ${noms.join(', ')} };
    export const registre = ecransNeufs().map((e) => e.route);
  `);
  for (const v of Object.values(m.constantes)) {
    assert.equal(typeof v, 'string');
    routes.add(v as string);
  }
  for (const r of m.registre) routes.add(r);
  return { routes, gardesInterne, gardesSupport };
}

const ORIGINES = await routesDAppRoot();
const ROUTES = ORIGINES.routes;

await dit('les routes d’origine se lisent dans appRoot.internal.tsx (littérales, constantes, bureaux, registre) : plus de 150, dont /tasks, /notifications, /supervisor ; leurs gardes ModuleRoute aussi, par bloc', () => {
  assert.ok(ROUTES.size > 150, `${ROUTES.size} routes lues`);
  for (const r of ['/', '/tasks', '/settings', '/notifications', '/tous-les-modules', '/supervisor', '/garde/bureaux/:equipe']) assert.ok(ROUTES.has(r), `${r} manque`);
  assert.ok(!ROUTES.has('/nulle-part'));
  // La session de support garde ses modules un à un ; l'édition interne, aujourd'hui, aucun (l'organisation interne a tout).
  assert.ok(ORIGINES.gardesSupport.size > 100, `${ORIGINES.gardesSupport.size} garde(s) ModuleRoute lue(s) dans ClientContextRoutes`);
  assert.equal(ORIGINES.gardesSupport.get('/tasks'), 'tasks');
  assert.equal(ORIGINES.gardesSupport.get('/agenda'), 'agenda');
  assert.equal(ORIGINES.gardesSupport.get('/settings'), undefined, '/settings n’a pas de garde en session de support');
  for (const [route] of ORIGINES.gardesSupport) assert.ok(ROUTES.has(route), `${route} gardée mais inconnue`);
  for (const [route] of ORIGINES.gardesInterne) assert.ok(ROUTES.has(route), `${route} gardée mais inconnue`);
  assert.deepEqual(gardesDuBloc('<Route path="/a" element={<ModuleRoute module="x"><A /></ModuleRoute>} /><Route\n path="/b"\n element={\n <ModuleRoute module="y">\n <B />'), new Map([['/a', 'x'], ['/b', 'y']]));
  assert.deepEqual(gardesDuBloc('<Route path="/c" element={<C />} />'), new Map());
});

/**
 * La clé `module` déclarée doit être celle de la garde `ModuleRoute` de la route d'origine, là où le substitut est rendu :
 * dans l'édition interne toujours (`gardesInterne`), en session de support seulement avec `support: 'identique'`
 * (`gardesSupport`). Une clé recopiée de travers renverrait à l'Accueil un écran ouvert ; une clé oubliée rendrait un
 * écran que la route d'origine ferme. Pur : la faute, ou `null`.
 */
function fauteDeModule(s: { route: string; module?: string; support?: string; source: string }, origines: Pick<RoutesDOrigine, 'gardesInterne' | 'gardesSupport'>): string | null {
  const ou = `${s.source} › ${s.route}`;
  const interne = origines.gardesInterne.get(s.route);
  const support = s.support === 'identique' ? origines.gardesSupport.get(s.route) : undefined;
  if (s.module === undefined) {
    if (interne !== undefined) return `${ou} : la route d'origine est gardée par ModuleRoute module="${interne}" dans l'édition interne — déclarez module: '${interne}'`;
    if (support !== undefined) return `${ou} : rendu en session de support (support: 'identique') sans la garde ModuleRoute module="${support}" de la route d'origine — déclarez module: '${support}'`;
    return null;
  }
  const attendues = new Set([interne, origines.gardesSupport.get(s.route)].filter((m): m is string => m !== undefined));
  if (attendues.size === 0) return `${ou} : module « ${s.module} » déclaré, mais la route d'origine n'a de garde ModuleRoute ni dans l'édition interne ni en session de support`;
  if (!attendues.has(s.module)) return `${ou} : module « ${s.module} » n'est pas la clé de la garde ModuleRoute de la route d'origine (« ${[...attendues].join(' » / « ')} »)`;
  if (interne !== undefined && interne !== s.module) return `${ou} : module « ${s.module} » n'est pas la clé de la garde de l'édition interne (« ${interne} »)`;
  return null;
}

await dit('fauteDeModule (pur) : la clé déclarée est celle de la garde de la route d’origine ; oubliée là où l’origine est gardée, c’est une faute ; en trop là où rien ne garde, aussi', () => {
  const origines = { gardesInterne: new Map([['/salle', 'salle']]), gardesSupport: new Map([['/tasks', 'tasks'], ['/salle', 'salle']]) };
  const f = (s: { route: string; module?: string; support?: string }) => fauteDeModule({ ...s, source: 'declarations/essai.tsx' }, origines);
  assert.equal(f({ route: '/tasks', module: 'tasks', support: 'identique' }), null, 'la bonne clé, rendue en support');
  assert.equal(f({ route: '/tasks', module: 'tasks' }), null, 'la bonne clé, jamais rendue en support : la garde s’applique quand même en interne');
  assert.equal(f({ route: '/tasks' }), null, 'sans module ni support : en interne, l’origine n’a pas de garde non plus');
  assert.match(f({ route: '/tasks', support: 'identique' }) ?? '', /sans la garde ModuleRoute module="tasks"/, 'rendu en support sans la garde de l’origine');
  assert.match(f({ route: '/tasks', module: 'taches', support: 'identique' }) ?? '', /« taches » n'est pas la clé de la garde ModuleRoute de la route d'origine \(« tasks »\)/, 'une clé recopiée de travers');
  assert.match(f({ route: '/tasks', module: 'taches' }) ?? '', /« taches » n'est pas la clé/, 'une clé fausse, même hors support');
  assert.match(f({ route: '/notes', module: 'notes' }) ?? '', /n'a de garde ModuleRoute ni dans l'édition interne ni en session de support/, 'une garde que l’origine n’a nulle part');
  assert.equal(f({ route: '/notes' }), null);
  assert.equal(f({ route: '/salle', module: 'salle' }), null, 'gardée dans les deux blocs, même clé');
  assert.match(f({ route: '/salle' }) ?? '', /gardée par ModuleRoute module="salle" dans l'édition interne/, 'gardée en interne : la clé est obligatoire');
  assert.match(f({ route: '/salle', module: 'autre' }) ?? '', /n'est pas la clé/);
});

/* ── 3. Le registre réel ─────────────────────────────────────────────────────────────────────── */

const reel = await charger<any>(`
  export { REGISTRE_SUBSTITUTIONS as registre } from '../src/refonte/substitutions/registre';
`);

await dit('le registre réel se ramasse sans faute ; chaque route déclarée existe dans appRoot.internal.tsx ; une seule déclaration par route ; la clé module est celle de la garde d’origine', () => {
  assert.deepEqual(reel.registre.fautes, []);
  const vues = new Set<string>();
  for (const s of reel.registre.substitutions) {
    assert.ok(ROUTES.has(s.route), `${s.source} › ${s.route} : route absente de appRoot.internal.tsx`);
    assert.ok(!vues.has(s.route), `${s.route} déclarée deux fois`);
    vues.add(s.route);
    const faute = fauteDeModule(s, ORIGINES);
    assert.equal(faute, null, faute ?? '');
  }
  console.log(`      ${fichiersDeclares.length} fichier(s) de déclaration, ${reel.registre.substitutions.length} substitution(s) : ${reel.registre.substitutions.map((s: any) => `${s.route} (${s.lot})`).join(', ') || 'aucune'}`);
});

await dit('declarations/ ne contient que des fichiers .tsx : un .ts y serait ignoré en silence, par Vite (glob *.tsx du registre) comme par ce contrôle', () => {
  // Le fichier brut : « /*.tsx » dans le motif du glob passerait pour l'ouverture d'un commentaire.
  assert.match(lire(`${DOSSIER}/registre.ts`), /import\.meta\.glob<\{ default: unknown \}>\('\.\/declarations\/\*\.tsx', \{ eager: true \}\)/, 'le registre ramasse ./declarations/*.tsx');
  const autres = fs.readdirSync(path.join(racine, DECLARATIONS)).filter((f) => !f.endsWith('.tsx'));
  assert.deepEqual(autres, [], `fichier(s) que personne ne ramasse dans ${DECLARATIONS} : ${autres.join(', ')} — un fichier de déclaration se nomme <lot>.tsx`);
  assert.ok(fichiersDeclares.length > 0, 'au moins un fichier de déclaration (systeme.tsx, le modèle)');
});

await dit('chaque fichier de déclaration n’importe que src/refonte/<lot>/ (et declarer.ts), et aucun substitut n’atteint src/screens/**', async () => {
  for (const f of fichiersDeclares) {
    const fichier = `${DECLARATIONS}/${f}`;
    const lot = (await charger<any>(`export { default as d } from '../${fichier}';`)).d?.lot;
    assert.equal(typeof lot, 'string', `${fichier} : pas de déclaration par défaut`);
    const { directs, tous } = await graphe(fichier);
    for (const d of directs) {
      assert.ok(d === `${DOSSIER}/declarer.ts` || d.startsWith(`src/refonte/${lot}/`), `${fichier} importe ${d} : un substitut vit dans src/refonte/${lot}/`);
    }
    const ecrans = tous.filter((p) => p.startsWith('src/screens/'));
    assert.deepEqual(ecrans, [], `${fichier} atteint src/screens/** : ${ecrans.join(', ')}`);
  }
});

/* ── 4. L'assemblage : doublons, fautes, fichiers vides ou absents ───────────────────────────── */

const A = await charger<any>(`
  export { assemblerSubstitutions, trouverSubstitution } from '../src/refonte/substitutions/registre';
  export { declarerSubstitutions } from '../src/refonte/substitutions/declarer';
`);
const Composant = () => null;

await dit('assembler : une route déclarée deux fois est une faute qui nomme les deux fichiers ; la première est gardée', () => {
  const r = A.assemblerSubstitutions([
    { chemin: 'declarations/jour.tsx', declaration: A.declarerSubstitutions('jour', [{ route: '/tasks', composant: Composant }]) },
    { chemin: 'declarations/outils.tsx', declaration: A.declarerSubstitutions('outils', [{ route: '/tasks', composant: Composant }]) },
  ]);
  assert.equal(r.substitutions.length, 1);
  assert.equal(r.substitutions[0].lot, 'jour');
  assert.deepEqual(r.fautes, ['declarations/outils.tsx › /tasks : route déjà substituée par declarations/jour.tsx']);
});

await dit('assembler : une déclaration mal formée est une faute, jamais une exception ; un fichier sans export ne déclare rien', () => {
  const r = A.assemblerSubstitutions([
    { chemin: 'declarations/vide.tsx', declaration: undefined },
    { chemin: 'declarations/faux.tsx', declaration: { lot: 'x' } },
    { chemin: 'declarations/sans-route.tsx', declaration: A.declarerSubstitutions('x', [{ composant: Composant }]) },
    { chemin: 'declarations/support.tsx', declaration: A.declarerSubstitutions('x', [{ route: '/a', composant: Composant, support: 'parfois' }]) },
    { chemin: 'declarations/sans-composant.tsx', declaration: A.declarerSubstitutions('x', [{ route: '/b' }]) },
    { chemin: 'declarations/bon.tsx', declaration: A.declarerSubstitutions('x', [{ route: '/c', composant: Composant }]) },
  ]);
  assert.equal(r.substitutions.length, 1);
  assert.equal(r.substitutions[0].route, '/c');
  assert.equal(r.fautes.length, 4, r.fautes.join('\n'));
  assert.match(r.fautes[0], /faux\.tsx/);
  assert.match(r.fautes[1], /sans-route\.tsx : route manquante/);
  assert.match(r.fautes[2], /support doit être/);
  assert.match(r.fautes[3], /composant manquant/);
});

await dit('le mécanisme survit à un dossier sans déclaration, à un fichier vide et à un fichier sans export : registre vide, écran d’origine', async () => {
  for (const virtuels of [{}, { 'vide.tsx': '' }, { 'rien.tsx': '// rien à déclarer\nexport {};' }]) {
    const m = await charger<any>(
      `
      import { createElement as h } from 'react';
      import { renderToStaticMarkup } from 'react-dom/server.browser';
      import { MemoryRouter, Routes, Route } from 'react-router-dom';
      import { SubstitutionDEcran } from '../src/edition/substitutions.internal.tsx';
      export { REGISTRE_SUBSTITUTIONS as registre } from '../src/refonte/substitutions/registre';
      export const rendu = renderToStaticMarkup(h(MemoryRouter, { initialEntries: ['/tasks'] }, h(Routes, null,
        h(Route, { element: h(SubstitutionDEcran, null) }, h(Route, { path: '/tasks', element: h('p', null, 'ORIGINE') })))));
      `,
      virtuels,
    );
    assert.deepEqual(m.registre, { substitutions: [], fautes: [] }, JSON.stringify(Object.keys(virtuels)));
    assert.equal(m.rendu, '<p>ORIGINE</p>');
  }
});

/* ── 5. Le choix de la substitution (pur) ────────────────────────────────────────────────────── */

const registreFactice = A.assemblerSubstitutions([
  {
    chemin: 'declarations/essai.tsx',
    declaration: A.declarerSubstitutions('essai', [
      { route: '/tasks', module: 'tasks', composant: Composant },
      { route: '/garde/bureaux/:equipe', composant: Composant, toujours: true },
      { route: '/garde/bureaux/x', composant: Composant, toujours: true, support: 'identique' },
      { route: '/notes', composant: Composant, support: 'identique' },
    ]),
  },
]);

await dit('trouver : route exacte, route paramétrée (jamais au-delà de ses segments), l’exacte l’emporte sur la paramétrée', () => {
  assert.deepEqual(registreFactice.fautes, []);
  const ctx = { support: false, coquille: true };
  assert.equal(A.trouverSubstitution('/tasks', ctx, registreFactice)?.module, 'tasks');
  assert.equal(A.trouverSubstitution('/tasks/', ctx, registreFactice)?.route, '/tasks');
  assert.equal(A.trouverSubstitution('/tasks/autre', ctx, registreFactice), undefined);
  assert.equal(A.trouverSubstitution('/garde/bureaux/soc', ctx, registreFactice)?.route, '/garde/bureaux/:equipe');
  assert.equal(A.trouverSubstitution('/garde/bureaux', ctx, registreFactice), undefined);
  assert.equal(A.trouverSubstitution('/garde/bureaux/soc/plus', ctx, registreFactice), undefined);
  assert.equal(A.trouverSubstitution('/garde/bureaux/x', ctx, registreFactice)?.route, '/garde/bureaux/x');
  assert.equal(A.trouverSubstitution('/settings', ctx, registreFactice), undefined);
});

await dit('trouver : coquille éteinte, seul un substitut « toujours » ; en session de support, seul un substitut « identique »', () => {
  assert.equal(A.trouverSubstitution('/tasks', { support: false, coquille: false }, registreFactice), undefined);
  assert.equal(A.trouverSubstitution('/garde/bureaux/soc', { support: false, coquille: false }, registreFactice)?.route, '/garde/bureaux/:equipe');
  assert.equal(A.trouverSubstitution('/tasks', { support: true, coquille: true }, registreFactice), undefined);
  assert.equal(A.trouverSubstitution('/notes', { support: true, coquille: true }, registreFactice)?.route, '/notes');
  assert.equal(A.trouverSubstitution('/notes', { support: true, coquille: false }, registreFactice), undefined);
  assert.equal(A.trouverSubstitution('/garde/bureaux/soc', { support: true, coquille: true }, registreFactice), undefined, 'support: aucune (défaut)');
  assert.equal(A.trouverSubstitution('/garde/bureaux/x', { support: true, coquille: false }, registreFactice)?.route, '/garde/bureaux/x');
});

/* ── 6. Le point unique, rendu avec une substitution factice ─────────────────────────────────── */

const R = await charger<any>(`
  import { createElement as h, lazy } from 'react';
  import { renderToStaticMarkup } from 'react-dom/server.browser';
  import { prerender } from 'react-dom/static.browser';
  import { MemoryRouter, Routes, Route } from 'react-router-dom';
  import { SubstitutionDEcranDe, SubstitutionDEcran } from '../src/refonte/substitutions/SubstitutionDEcran';
  import { assemblerSubstitutions } from '../src/refonte/substitutions/registre';
  export { trouverSubstitution, REGISTRE_SUBSTITUTIONS as registreReel } from '../src/refonte/substitutions/registre';
  import { declarerSubstitutions } from '../src/refonte/substitutions/declarer';
  import { ModuleRoute } from '../src/components/ModuleRoute';
  export { setLockedModules, isModuleEnabled } from '../src/data/spaces';
  const Substitut = ({ nom }) => h('p', { 'data-substitut': nom }, 'SUBSTITUT ' + nom);
  export const registre = (s) => assemblerSubstitutions([{ chemin: 'declarations/essai.tsx', declaration: declarerSubstitutions('essai', s) }]);
  export const composants = {
    taches: () => h(Substitut, { nom: 'taches' }),
    tachesParesseux: lazy(() => Promise.resolve({ default: () => h(Substitut, { nom: 'taches' }) })),
    equipe: () => h(Substitut, { nom: 'equipe' }),
  };
  const arbre = (chemin, point) => h(MemoryRouter, { initialEntries: [chemin] }, h(Routes, null,
    h(Route, { element: point },
      h(Route, { path: '/', element: h('p', null, 'ACCUEIL') }),
      h(Route, { path: '/tasks', element: h('p', null, 'ORIGINE tasks') }),
      h(Route, { path: '/garde/bureaux', element: h('p', null, 'ORIGINE bureaux') }),
      h(Route, { path: '/garde/bureaux/:equipe', element: h('p', null, 'ORIGINE equipe') }))));
  export const rendre = (chemin, registre, support, coquille) => renderToStaticMarkup(arbre(chemin, h(SubstitutionDEcranDe, { registre, support, coquille })));
  export const rendreReel = (chemin) => renderToStaticMarkup(arbre(chemin, h(SubstitutionDEcran, null)));
  export const rendreGarde = (module) => renderToStaticMarkup(h(MemoryRouter, { initialEntries: ['/tasks'] }, h(ModuleRoute, { module }, h('p', null, 'ENFANT'))));
  export async function rendreComplet(chemin, registre, support, coquille) {
    const { prelude } = await prerender(arbre(chemin, h(SubstitutionDEcranDe, { registre, support, coquille })));
    return await new Response(prelude).text();
  }
`);

await dit('coquille allumée : le substitut est rendu à la place de la route d’origine ; les autres routes restent l’origine', () => {
  const reg = R.registre([{ route: '/tasks', composant: R.composants.taches }]);
  assert.equal(R.rendre('/tasks', reg, false, true), '<p data-substitut="taches">SUBSTITUT taches</p>');
  assert.equal(R.rendre('/', reg, false, true), '<p>ACCUEIL</p>');
  assert.equal(R.rendre('/garde/bureaux', reg, false, true), '<p>ORIGINE bureaux</p>');
});

await dit('coquille éteinte : l’écran d’origine, à l’identique — sauf un substitut « toujours »', () => {
  const reg = R.registre([{ route: '/tasks', composant: R.composants.taches }, { route: '/garde/bureaux/:equipe', composant: R.composants.equipe, toujours: true }]);
  assert.equal(R.rendre('/tasks', reg, false, false), '<p>ORIGINE tasks</p>');
  assert.equal(R.rendre('/garde/bureaux/soc', reg, false, false), '<p data-substitut="equipe">SUBSTITUT equipe</p>');
  assert.equal(R.rendre('/garde/bureaux', reg, false, false), '<p>ORIGINE bureaux</p>');
});

await dit('session de support cliente : l’écran d’origine, sauf « support: identique » (le même substitut)', () => {
  const reg = R.registre([{ route: '/tasks', composant: R.composants.taches }, { route: '/garde/bureaux/:equipe', composant: R.composants.equipe, support: 'identique' }]);
  assert.equal(R.rendre('/tasks', reg, true, true), '<p>ORIGINE tasks</p>');
  assert.equal(R.rendre('/garde/bureaux/soc', reg, true, true), '<p data-substitut="equipe">SUBSTITUT equipe</p>');
});

await dit('ModuleRoute est conservé quand module est déclaré : module fermé → redirection (ni substitut ni origine), module ouvert → substitut', () => {
  const reg = R.registre([{ route: '/tasks', module: 'tasks', composant: R.composants.taches }]);
  R.setLockedModules(['tasks']);
  try {
    assert.equal(R.isModuleEnabled('tasks'), false);
    const redirige = R.rendreGarde('tasks');
    assert.equal(redirige, '', 'la garde seule rend la redirection (rien, côté serveur)');
    assert.equal(R.rendre('/tasks', reg, false, true), redirige, 'le substitut gardé rend la même chose que la garde seule');
  } finally {
    R.setLockedModules([]);
  }
  assert.equal(R.rendre('/tasks', reg, false, true), '<p data-substitut="taches">SUBSTITUT taches</p>');
});

await dit('un substitut paresseux (lazy) est rendu dans Suspense, repli null : vide au premier rendu, complet une fois chargé', async () => {
  const reg = R.registre([{ route: '/tasks', composant: R.composants.tachesParesseux }]);
  assert.equal(R.rendre('/tasks', reg, false, true), '', 'le repli de Suspense est null, comme les routes paresseuses de appRoot');
  const complet = await R.rendreComplet('/tasks', reg, false, true);
  assert.match(complet, /<p data-substitut="taches">SUBSTITUT taches<\/p>/);
  assert.doesNotMatch(complet, /ORIGINE/);
});

await dit('le point réel (SubstitutionDEcran, registre ramassé, drapeau de la coquille lu — éteint hors navigateur) rend l’écran d’origine, sauf un substitut « toujours » déclaré', () => {
  // L'attendu vient du registre réel : une déclaration légale (`toujours: true`) ne fait pas rougir ce contrôle.
  for (const [chemin, origine] of [['/tasks', '<p>ORIGINE tasks</p>'], ['/garde/bureaux/soc', '<p>ORIGINE equipe</p>']]) {
    const rendu = R.rendreReel(chemin);
    const declaree = R.trouverSubstitution(chemin, { support: false, coquille: false }, R.registreReel);
    if (declaree) assert.doesNotMatch(rendu, /ORIGINE/, `${chemin} : ${declaree.source} déclare un substitut « toujours », l'origine ne doit pas être rendue`);
    else assert.equal(rendu, origine, `${chemin} : rien de déclaré, l'écran d'origine à l'identique`);
  }
});

await dit('SubstitutionDEcran.tsx : le drapeau vient de coquille/drapeau.ts, la garde de components/ModuleRoute, le repli de Suspense est null', () => {
  const src = sansCommentaires(lire(`${DOSSIER}/SubstitutionDEcran.tsx`));
  assert.match(src, /import \{ useCoquilleActive \} from '\.\.\/coquille\/drapeau';/);
  assert.match(src, /import \{ ModuleRoute \} from '\.\.\/\.\.\/components\/ModuleRoute';/);
  assert.match(src, /<Suspense fallback=\{null\}>/);
  assert.match(src, /if \(!substitution\) return <Outlet \/>;/);
  assert.match(src, /<ModuleRoute module=\{substitution\.module\}>\{contenu\}<\/ModuleRoute>/);
});

fin();
