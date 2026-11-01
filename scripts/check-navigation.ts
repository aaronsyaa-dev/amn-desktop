/**
 * Contrôle de la NAVIGATION DE LA REFONTE (S1) — `npm run check:navigation`.
 *
 * Sans navigateur, sans build, sans réseau. Il tient ce qu'un `grep` ou une
 * capture ne voient pas :
 *
 *   1. LE REGISTRE ET LE CATALOGUE S'ACCORDENT. Chaque module du catalogue
 *      interne (`modules.internal.ts`) est une vue d'une entrée du registre
 *      (`src/refonte/modules/declarations/`, S5), avec la MÊME route, une
 *      famille déclarée, une action de cette famille, au moins un verbe et un
 *      mot-clé — ou une vue « remplacée », dont la route reste. Aucun module
 *      en trop, aucun en moins : le registre range et regroupe, il ne
 *      supprime pas. Et chaque route mène à une `<Route>` de l'édition interne.
 *   1 bis. LE REGISTRE EST EXTENSIBLE (S5). Chaque fichier du dossier est
 *      ramassé ; un module sans famille, sans action, ou avec une action que
 *      sa famille ne déclare pas est refusé ; une famille ou un module ajoutés
 *      dans un fichier d'essai arrivent au rail, au catalogue et aux routes.
 *   2. LE RAIL DU MOMENT : essentiels connus, aucun doublon d'un groupe à
 *      l'autre, plafonds tenus, suggestions qui existent et qui ne répètent
 *      pas les essentiels.
 *   3. LA RECHERCHE PAR INTENTION : « envoyer une facture » mène à
 *      Facturation, etc. — des phrases réelles, pas des noms d'écran.
 *   4. L'OUVERTURE : Accueil la première fois du jour, le dernier module ensuite.
 *   5. L'ISOLEMENT : le jumeau cliente de la couture n'importe rien de la
 *      refonte, et aucun code partagé n'importe `src/refonte/**` en direct.
 *
 *   npm run check:navigation
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (rel: string) => fs.readFileSync(path.join(racine, rel), 'utf8');
let echecs = 0;
let vus = 0;
const dit = async (nom: string, fn: () => void | Promise<void>) => {
  try {
    await fn();
    vus += 1;
    console.log(`  ✓ ${nom}`);
  } catch (err) {
    echecs += 1;
    console.error(`  ✗ ${nom}\n      ${(err as Error).message.split('\n').join('\n      ')}`);
  }
};

/**
 * `import.meta.glob` est un mot de Vite, qu'esbuild ne connaît pas : le registre
 * (`src/refonte/modules/registre.ts`) ramasse ses déclarations avec. Ici, on le
 * remplace par les imports du dossier, lus sur le disque — le même résultat
 * que Vite, fichier par fichier.
 */
const globVite: esbuild.Plugin = {
  name: 'import-meta-glob',
  setup(b) {
    b.onLoad({ filter: /[\\/]src[\\/]refonte[\\/]modules[\\/]registre\.ts$/ }, (args) => {
      const dir = path.dirname(args.path);
      const imports: string[] = [];
      const contents = fs.readFileSync(args.path, 'utf8').replace(
        /import\.meta\.glob(?:<[^>]*>)?\(\s*'\.\/([\w-]+)\/\*\.ts'[^)]*\)/g,
        (_tout, sous: string) => {
          const fichiers = fs.readdirSync(path.join(dir, sous)).filter((f) => f.endsWith('.ts')).sort();
          const champs = fichiers.map((f) => {
            const n = imports.length;
            imports.push(`import * as __glob${n} from './${sous}/${f}';`);
            return `'./${sous}/${f}': __glob${n}`;
          });
          return `{ ${champs.join(', ')} }`;
        },
      );
      return { contents: `${imports.join('\n')}\n${contents}`, loader: 'ts' };
    });
  },
};

/** Charge un bout de code des sources, construit par esbuild (alias résolus par tsconfig.json : édition interne). */
async function charger<T>(code: string): Promise<T> {
  const construit = await esbuild.build({
    plugins: [globVite],
    stdin: { contents: code, resolveDir: path.join(racine, 'scripts'), loader: 'ts' },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    charset: 'utf8',
    jsx: 'automatic',
    tsconfig: path.join(racine, 'tsconfig.json'),
    define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', __AMN_EDITION__: '"internal"', __AMN_VERSION__: '"0.0.0"' },
    logLevel: 'silent',
  });
  return (await import(
    `data:text/javascript;charset=utf-8;base64,${Buffer.from(construit.outputFiles[0].text, 'utf8').toString('base64')}`
  )) as T;
}

interface Libelle {
  fr: string;
  en: string;
}
interface Vue {
  id: string;
  route: string;
  entree: string;
  principale: boolean;
  famille: string;
  teinte: string;
  action: string;
  niveau: string;
  verbes: readonly string[];
  motsCles: readonly string[];
  en?: { verbes: readonly string[]; motsCles: readonly string[] };
  etiquette?: Libelle;
  entreeNom?: Libelle;
  nouveau?: unknown;
}
interface EntreeR {
  id: string;
  famille: string;
  amnSeulement: boolean;
  action: string;
  niveau: string;
  nom?: Libelle;
  vues: readonly Vue[];
}
interface FamilleR {
  id: string;
  teinte: string;
  nom: Libelle;
  amnSeulement: boolean;
  actions: readonly { id: string; cle: string; libelle: Libelle }[];
  entrees: readonly EntreeR[];
  remplacees: readonly { id: string; route: string; par: Libelle }[];
}
interface Registre {
  familles: readonly FamilleR[];
  entrees: readonly EntreeR[];
  vues: readonly Vue[];
  remplacees: readonly { id: string; route: string; redirection: { vers: string; assistant?: true } }[];
  fautes: readonly string[];
}
interface Fichier {
  chemin: string;
  declaration: unknown;
}
interface Item {
  key: string;
  label: string;
  to: string;
  hint: string;
}
interface Section {
  key: string;
  code: string;
  space?: string;
  items: Item[];
}

const DOSSIER_DECLARATIONS = 'src/refonte/modules/declarations';
const fichiersDeclares = fs.readdirSync(path.join(racine, DOSSIER_DECLARATIONS)).filter((f) => f.endsWith('.ts')).sort();

const m = await charger<{
  NAV_SECTIONS: Section[];
  NAV_BUSINESS: Section[];
  NAV_EN: Record<string, { label?: string }>;
  REGISTRE: readonly Vue[];
  REGISTRE_MODULES: Registre;
  FICHIERS: Fichier[];
  assembler: (f: readonly Fichier[]) => Registre;
  declarerFamille: (f: Record<string, unknown>) => unknown;
  declarerModule: (f: Record<string, unknown>) => unknown;
  vue: (id: string, route: string, verbes: string[], motsCles: string[], plus?: Record<string, unknown>) => unknown;
  redirections: (r: Registre) => { id: string; route: string; vers: string; assistant: boolean }[];
  essentielsDe: (r: Registre) => { courants: string[]; garde: string[] };
  sectionsDuRegistre: (r: Registre) => Section[];
  ecransNeufs: (r: Registre) => { id: string; route: string }[];
  FAMILLES: readonly string[];
  ESSENTIELS: readonly string[];
  ESSENTIELS_GARDE: readonly string[];
  MAX_RECENTS: number;
  MAX_SUGGESTIONS: number;
  suggestionsDuMoment: (d: Date) => string[];
  composerRail: <T extends { key: string }>(a: { catalogue: readonly T[]; epingles: readonly string[]; recents: readonly string[]; quand: Date; essentiels?: { courants: readonly string[]; garde: readonly string[] } }) => Record<'essentiels' | 'garde' | 'epingles' | 'recents' | 'maintenant', T[]>;
  chercher: (q: string, items: readonly { key: string; label: string; hint?: string }[], o?: { langue?: 'fr' | 'en' }) => { item: { key: string }; score: number; raison?: string }[];
  premiereOuvertureDuJour: (d: Date, s: Pick<Storage, 'getItem' | 'setItem'> | null) => boolean;
  DICTIONNAIRES_NAV: Record<'fr' | 'en', Record<string, string>>;
}>(
  [
    "export { NAV_SECTIONS } from '../src/edition/modules.internal';",
    "export { NAV_SECTIONS as NAV_BUSINESS } from '../src/edition/modules.business';",
    "export { NAV_EN } from '../src/edition/navLexique.internal';",
    "export { REGISTRE } from '../src/refonte/navigation/registre';",
    "export { REGISTRE_MODULES } from '../src/refonte/modules/registre';",
    "export { assembler } from '../src/refonte/modules/assembler';",
    "export { declarerFamille, declarerModule, vue } from '../src/refonte/modules/declarer';",
    "export { essentielsDe } from '../src/refonte/navigation/moment';",
    "export { sectionsDuRegistre } from '../src/refonte/modules/catalogue';",
    "export { ecransNeufs, redirections } from '../src/refonte/modules/routes';",
    ...fichiersDeclares.map((f, i) => `import __d${i} from '../${DOSSIER_DECLARATIONS}/${f}';`),
    `export const FICHIERS = [${fichiersDeclares.map((f, i) => `{ chemin: 'declarations/${f}', declaration: __d${i} }`).join(', ')}];`,
    "export { FAMILLES } from '../src/socle/familles';",
    "export { ESSENTIELS, ESSENTIELS_GARDE, MAX_RECENTS, MAX_SUGGESTIONS, suggestionsDuMoment, composerRail } from '../src/refonte/navigation/moment';",
    "export { chercher } from '../src/refonte/navigation/recherche';",
    "export { premiereOuvertureDuJour } from '../src/refonte/navigation/ouverture';",
    "export { DICTIONNAIRES_NAV } from '../src/refonte/navigation/i18n';",
  ].join('\n'),
);

const catalogue = m.NAV_SECTIONS.flatMap((s) => s.items);
const parId = new Map(m.REGISTRE.map((e) => [e.id, e]));
const R = m.REGISTRE_MODULES;

/* ── 1. Le registre et le catalogue ───────────────────────────────────────── */

console.log('\nNavigation de la refonte — le registre\n');

await dit('le registre se lit sans faute (aucun module écarté)', () => {
  assert.deepEqual(R.fautes, [], R.fautes.join('\n'));
});

await dit(`chaque module du catalogue interne est une vue du registre, avec la même route (${catalogue.length})`, () => {
  const manquants = catalogue.filter((i) => !parId.has(i.key)).map((i) => i.key);
  assert.deepEqual(manquants, [], `absents du registre : ${manquants.join(', ')}`);
  const routes = catalogue.filter((i) => parId.get(i.key)?.route !== i.to).map((i) => `${i.key} : catalogue ${i.to}, registre ${parId.get(i.key)?.route}`);
  assert.deepEqual(routes, [], routes.join('\n'));
});

await dit('le registre ne contient rien que le catalogue n’ait pas, et chaque vue une seule fois', () => {
  const cles = new Set(catalogue.map((i) => i.key));
  const enTrop = m.REGISTRE.filter((e) => !cles.has(e.id)).map((e) => e.id);
  assert.deepEqual(enTrop, [], `inconnus du catalogue : ${enTrop.join(', ')}`);
  assert.equal(parId.size, m.REGISTRE.length, 'une vue revient deux fois');
  const neufsAuCatalogue = m.REGISTRE.filter((v) => v.nouveau && !cles.has(v.id)).map((v) => v.id);
  assert.deepEqual(neufsAuCatalogue, [], `écran neuf absent du catalogue : ${neufsAuCatalogue.join(', ')}`);
});

await dit('une vue remplacée n’est plus au catalogue, et sa route renvoie ailleurs', () => {
  const cles = new Set(catalogue.map((i) => i.key));
  const fautes: string[] = [];
  const routesPrises = new Set([...m.REGISTRE.map((v) => v.route), ...catalogue.map((i) => i.to)]);
  for (const r of R.remplacees) {
    if (cles.has(r.id)) fautes.push(`${r.id} : remplacée, mais encore au catalogue`);
    if (routesPrises.has(r.route)) fautes.push(`${r.id} : sa route ${r.route} est prise par un autre module`);
  }
  assert.deepEqual(fautes, [], fautes.join('\n'));
  assert.deepEqual(
    m.redirections(R).map((x) => `${x.route} → ${x.vers}${x.assistant ? ' + ⌘J' : ''}`),
    R.remplacees.map((r) => `${r.route} → ${r.redirection.vers}${r.redirection.assistant ? ' + ⌘J' : ''}`),
  );
});

await dit('chaque vue : une famille déclarée, une teinte du socle, une action de sa famille, un niveau, un verbe, un mot-clé', () => {
  const familles = new Map(R.familles.map((f) => [f.id, f]));
  const fautes: string[] = [];
  for (const e of m.REGISTRE) {
    const f = familles.get(e.famille);
    if (!f) fautes.push(`${e.id} : famille « ${e.famille} » non déclarée`);
    if (!m.FAMILLES.includes(e.teinte)) fautes.push(`${e.id} : teinte « ${e.teinte} »`);
    if (!f?.actions.some((a) => a.cle === e.action)) fautes.push(`${e.id} : action « ${e.action} » hors de ${e.famille}`);
    if (!['essentiel', 'courant', 'avance'].includes(e.niveau)) fautes.push(`${e.id} : niveau « ${e.niveau} »`);
    if (e.verbes.length === 0 || e.verbes.some((v) => !v.trim())) fautes.push(`${e.id} : sans verbe`);
    if (e.motsCles.length === 0) fautes.push(`${e.id} : sans mot-clé`);
  }
  assert.deepEqual(fautes, [], fautes.join('\n'));
});

await dit('chaque action déclarée sert au moins une fois, et chaque nom a son fr et son en', () => {
  const servies = new Set(R.entrees.map((e) => e.action));
  const fautes: string[] = [];
  const libelle = (l: Libelle | undefined, ou: string) => {
    if (l && (!l.fr?.trim() || !l.en?.trim())) fautes.push(`${ou} : libellé fr ou en vide`);
  };
  for (const f of R.familles) {
    libelle(f.nom, f.id);
    for (const a of f.actions) {
      if (!servies.has(a.cle)) fautes.push(`${a.cle} : aucune entrée`);
      libelle(a.libelle, a.cle);
    }
    for (const e of f.entrees) {
      libelle(e.nom, e.id);
      for (const v of e.vues) libelle(v.etiquette, v.id);
    }
  }
  assert.deepEqual(fautes, [], fautes.join('\n'));
});

await dit('chaque route du registre mène à une <Route> de l’édition interne', () => {
  const tables = lire('src/edition/appRoot.internal.tsx') + lire('src/bureaux/routes.tsx');
  const declarees = new Set([...tables.matchAll(/path="([^"]+)"/g)].map((x) => x[1]));
  // Les écrans neufs montent la leur par `routesDuRegistre()` (vérifié plus bas).
  assert.match(lire('src/edition/appRoot.internal.tsx'), /\{routesDuRegistre\(\)\}/, 'appRoot.internal.tsx ne monte plus les routes du registre');
  const sansRoute = m.REGISTRE.filter((v) => !v.nouveau).filter((e) => !declarees.has(e.route)).map((e) => `${e.id} (${e.route})`);
  assert.deepEqual(sansRoute, [], `sans route : ${sansRoute.join(', ')}`);
  const doubles = R.remplacees.filter((r) => declarees.has(r.route)).map((r) => r.route);
  assert.deepEqual(doubles, [], `route écrite deux fois (à la main et par le registre) : ${doubles.join(', ')}`);
  const versRoutes = R.remplacees.filter((r) => !declarees.has(r.redirection.vers) && !m.REGISTRE.some((v) => v.route === r.redirection.vers)).map((r) => `${r.id} → ${r.redirection.vers}`);
  assert.deepEqual(versRoutes, [], `redirection vers une route inconnue : ${versRoutes.join(', ')}`);
});

await dit('les dictionnaires fr et en ont les mêmes clés, aucune vide', () => {
  const en = Object.keys(m.DICTIONNAIRES_NAV.en).sort();
  const fr = Object.keys(m.DICTIONNAIRES_NAV.fr).sort();
  assert.deepEqual(fr, en);
  const vides = [...en.filter((k) => !m.DICTIONNAIRES_NAV.en[k].trim()), ...fr.filter((k) => !m.DICTIONNAIRES_NAV.fr[k].trim())];
  assert.deepEqual(vides, []);
});

/* ── 1 bis. Le rangement (S5) ─────────────────────────────────────────────── */

console.log('\nNavigation de la refonte — le rangement\n');

const niveaux = (n: string) => R.entrees.filter((e) => e.niveau === n).length;
console.log(
  `  · ${catalogue.length} modules au catalogue, ${R.entrees.length} entrées : ` +
    `${niveaux('essentiel')} essentielles, ${niveaux('courant')} courantes, ${niveaux('avance')} avancées ; ` +
    `${R.familles.length} familles ; ${R.remplacees.length} vue(s) remplacée(s)`,
);

const entreeDe = (id: string) => R.entrees.find((e) => e.vues.some((v) => v.id === id));

/** Les regroupements validés : une entrée, ces vues, dans cet ordre (la première est la principale). */
const REGROUPEMENTS: string[][] = [
  ['agenda', 'booking'],
  ['tasks', 'priorities'],
  ['projects', 'board'],
  ['habits', 'routines'],
  ['shifts', 'leaves'],
  ['invoices', 'reminders', 'deposits'],
  ['contracts', 'subscriptions'],
  ['pipeline', 'leadScoring'],
  ['reviews', 'sentiment', 'nps'],
  ['loyalty', 'referrals'],
  ['expenses', 'expenseClaims', 'incomingInvoices'],
  ['cashForecast', 'scenarios', 'loanSim', 'taxForecast'],
  ['video', 'videoProductions'],
  ['adVisuals', 'brand'],
  ['minisite', 'portfolio'],
  ['stock', 'stockForecast'],
  ['assembly', 'interventions'],
  ['rounds', 'itineraries'],
  ['equipment', 'fleet'],
  ['dm', 'groups', 'team'],
  ['calls', 'rooms'],
  ['binder', 'media'],
  ['esign', 'remoteSign'],
  ['calculators', 'calcPro', 'converters'],
  ['writing', 'translation'],
  ['logbook', 'diary'],
  ['home', 'dashboard'],
  ['sites', 'tracker'],
  ['socMaturity', 'orgCompare'],
  ['supervision', 'customAlerts'],
  ['scanner', 'comply', 'ssl'],
  ['notes', 'pages'],
];

await dit(`les ${REGROUPEMENTS.length} regroupements validés sont des entrées à plusieurs vues`, () => {
  const fautes: string[] = [];
  for (const vues of REGROUPEMENTS) {
    const e = entreeDe(vues[0]);
    const tenues = e?.vues.map((v) => v.id) ?? [];
    if (e?.id !== vues[0] || tenues.join(',') !== vues.join(',')) fautes.push(`${vues.join('+')} : l’entrée tient ${tenues.join('+') || 'rien'}`);
  }
  assert.deepEqual(fautes, [], fautes.join('\n'));
});

await dit('le Journal : une entrée, deux types (Pro, Perso)', () => {
  const e = entreeDe('logbook');
  assert.deepEqual(e?.vues.map((v) => v.etiquette?.fr), ['Pro', 'Perso']);
});

await dit('décisions : RH dans Échanger, Événements dans Créer, Équipe dans la Messagerie, Supervisor et Cyber dans la Garde', () => {
  const famille = (id: string) => entreeDe(id)?.famille;
  for (const id of ['recruitment', 'procedures', 'training', 'certifications', 'payslips']) assert.equal(famille(id), 'echanger', id);
  assert.equal(famille('evenements'), 'creer');
  assert.equal(entreeDe('team')?.id, 'dm');
  for (const id of ['tour', 'orgs', 'generator', 'supervision', 'sites', 'tracker', 'scanner', 'ssl', 'access']) assert.equal(famille(id), 'garde', id);
});

await dit('Ajmani : plus au catalogue ni aux entrées, sa route ouvre le panneau ⌘J', () => {
  assert.ok(!catalogue.some((i) => i.key === 'gardeAjmani'), 'gardeAjmani est encore au catalogue');
  assert.ok(!entreeDe('gardeAjmani'), 'gardeAjmani est encore rangé');
  assert.deepEqual(m.redirections(R).filter((x) => x.route === '/garde/ajmani').map((x) => [x.vers, x.assistant]), [['/garde', true]]);
  assert.ok(!m.ESSENTIELS_GARDE.includes('gardeAjmani'));
});

await dit('Contrats et abonnements : une entrée d’Argent', () => {
  const e = entreeDe('contracts');
  assert.equal(e?.famille, 'argent');
  assert.deepEqual(e?.vues.map((v) => v.id), ['contracts', 'subscriptions']);
});

await dit('la Garde et la supervision : réservée à l’équipe AMN (jamais au catalogue client, jamais au Poste de travail)', () => {
  const garde = R.familles.filter((f) => f.amnSeulement);
  assert.deepEqual(garde.map((f) => f.id), ['garde']);
  const business = new Set(m.NAV_BUSINESS.flatMap((s) => s.items.map((i) => i.key)));
  const espace = new Map(m.NAV_SECTIONS.flatMap((s) => s.items.map((i) => [i.key, s.space ?? 'workspace'] as const)));
  const fautes: string[] = [];
  for (const f of garde) {
    for (const v of f.entrees.flatMap((e) => e.vues)) {
      if (business.has(v.id)) fautes.push(`${v.id} : au catalogue client`);
      if (espace.get(v.id) === 'workspace') fautes.push(`${v.id} : au Poste de travail`);
    }
  }
  assert.deepEqual(fautes, [], fautes.join('\n'));
});

await dit('le rail tient ses essentiels : seize au plus, l’Accueil d’abord', () => {
  assert.ok(m.ESSENTIELS.length + m.ESSENTIELS_GARDE.length <= 16, `${m.ESSENTIELS.length + m.ESSENTIELS_GARDE.length} essentiels`);
  assert.equal(m.ESSENTIELS[0], 'home');
});

/* ── 1 ter. Les noms et les mots (S5) ────────────────────────────────────── */

console.log('\nNavigation de la refonte — les noms et les mots\n');

const libelleCatalogue = new Map(catalogue.map((i) => [i.key, i.label]));
const nomAffiche = (e: EntreeR) => e.nom?.fr ?? libelleCatalogue.get(e.id) ?? e.id;

await dit('chaque entrée a un nom qui n’est qu’à elle, en français comme en anglais', () => {
  const fautes: string[] = [];
  for (const langue of ['fr', 'en'] as const) {
    const vus = new Map<string, string>();
    for (const e of R.entrees) {
      const nom = langue === 'fr' ? nomAffiche(e) : (e.nom?.en ?? m.NAV_EN[e.id]?.label);
      if (!nom) {
        fautes.push(`${e.id} : pas de nom ${langue}`);
        continue;
      }
      const cle = nom.toLowerCase();
      if (vus.has(cle)) fautes.push(`${e.id} et ${vus.get(cle)} s’appellent toutes deux « ${nom} » (${langue})`);
      vus.set(cle, e.id);
    }
  }
  assert.deepEqual(fautes, [], fautes.join('\n'));
});

await dit('une entrée à une seule vue garde le nom du catalogue (le rail et la palette disent la même chose)', () => {
  const fautes = R.entrees
    .filter((e) => e.vues.length === 1 && e.nom && e.nom.fr !== libelleCatalogue.get(e.id))
    .map((e) => `${e.id} : « ${e.nom?.fr} » ≠ catalogue « ${libelleCatalogue.get(e.id)} »`);
  assert.deepEqual(fautes, [], fautes.join('\n'));
});

await dit('chaque module du catalogue a un nom anglais (l’interface anglaise ne retombe pas sur le français)', () => {
  const sans = catalogue.filter((i) => !m.NAV_EN[i.key]?.label).map((i) => `${i.key} (${i.label})`);
  assert.deepEqual(sans, [], `sans nom anglais : ${sans.join(', ')}`);
});

await dit('chaque vue a ses verbes et mots-clés en anglais, au même nombre de verbes au moins', () => {
  const fautes: string[] = [];
  for (const v of m.REGISTRE) {
    if (!v.en) fautes.push(`${v.id} : pas d’anglais`);
    else if (v.en.verbes.length < Math.min(2, v.verbes.length)) fautes.push(`${v.id} : ${v.en.verbes.length} verbe(s) anglais pour ${v.verbes.length} en français`);
  }
  assert.deepEqual(fautes, [], fautes.join('\n'));
});

await dit('verbes et mots-clés bien écrits : en minuscules, sans ponctuation finale, sans doublon dans la vue', () => {
  const fautes: string[] = [];
  const verifier = (id: string, langue: string, mots: readonly string[], genre: string) => {
    const vus = new Set<string>();
    for (const mot of mots) {
      if (mot !== mot.trim() || /[.!?;:,]$/.test(mot)) fautes.push(`${id} (${langue}) ${genre} « ${mot} » : espace ou ponctuation en bout`);
      if (/^[A-ZÉÈ]/.test(mot) && !/^[A-Z]{2,}/.test(mot)) fautes.push(`${id} (${langue}) ${genre} « ${mot} » : majuscule initiale`);
      if (vus.has(mot.toLowerCase())) fautes.push(`${id} (${langue}) ${genre} « ${mot} » : en double`);
      vus.add(mot.toLowerCase());
    }
  };
  for (const v of m.REGISTRE) {
    verifier(v.id, 'fr', v.verbes, 'verbe');
    verifier(v.id, 'fr', v.motsCles, 'mot-clé');
    if (v.en) {
      verifier(v.id, 'en', v.en.verbes, 'verbe');
      verifier(v.id, 'en', v.en.motsCles, 'mot-clé');
    }
  }
  assert.deepEqual(fautes, [], fautes.join('\n'));
});

/* ── 1 quater. Le registre extensible (S5) ───────────────────────────────────── */

console.log('\nNavigation de la refonte — le registre extensible\n');

await dit(`chaque fichier de ${DOSSIER_DECLARATIONS}/ est ramassé, sans liste à tenir (${fichiersDeclares.length})`, () => {
  const parDossier = m.assembler(m.FICHIERS);
  assert.deepEqual(parDossier.fautes, []);
  assert.deepEqual(
    R.entrees.map((e) => `${e.famille}/${e.id}`),
    parDossier.entrees.map((e) => `${e.famille}/${e.id}`),
    'le registre de l’application diffère du contenu du dossier',
  );
});

const declarationOk = () =>
  m.declarerFamille({
    id: 'atelier',
    ordre: 99,
    teinte: 'creer',
    nom: { fr: 'Atelier', en: 'Workshop' },
    actions: { fabriquer: { fr: 'Fabriquer', en: 'Make' } },
    modules: [
      {
        nom: { fr: 'Gabarits', en: 'Jigs' },
        action: 'fabriquer',
        niveau: 'essentiel',
        vues: [
          m.vue('essaiGabarits', '/essai/gabarits', ['fabriquer un gabarit'], ['gabarit'], {
            nouveau: { icone: () => null, ecran: async () => ({ default: () => null }), indice: { fr: 'Des gabarits', en: 'Jigs' } },
          }),
        ],
      },
    ],
  });
const moduleSeulOk = () =>
  m.declarerModule({
    famille: 'argent',
    action: 'prevoir',
    niveau: 'avance',
    vues: [m.vue('essaiPrime', '/essai/prime', ['calculer une prime'], ['prime'])],
  });

await dit('une famille ajoutée (un fichier) arrive aux familles, aux essentiels du rail, au catalogue et aux routes', () => {
  const r = m.assembler([...m.FICHIERS, { chemin: 'declarations/zz-atelier.ts', declaration: declarationOk() }]);
  assert.deepEqual(r.fautes, []);
  assert.equal(r.familles.at(-1)?.id, 'atelier');
  assert.equal(r.entrees.at(-1)?.id, 'essaiGabarits');
  const essentiels = m.essentielsDe(r);
  assert.ok(essentiels.courants.includes('essaiGabarits'), 'absent des essentiels');
  const sections = m.sectionsDuRegistre(r);
  const item = sections.flatMap((s) => s.items).find((i) => i.key === 'essaiGabarits');
  assert.ok(item, 'absent du catalogue');
  assert.equal(item.to, '/essai/gabarits');
  assert.equal(sections.find((s) => s.items.includes(item))?.space, 'workspace');
  assert.deepEqual(m.ecransNeufs(r).map((e) => e.route), ['/essai/gabarits'], 'route non montée');
  const g = m.composerRail({ catalogue: [...catalogue, item].map((i) => ({ key: i.key })), epingles: [], recents: [], quand: new Date(2026, 9, 21, 9), essentiels });
  assert.ok(g.essentiels.some((i) => i.key === 'essaiGabarits'), 'absent du rail');
  // Le registre réel n'a aucun écran neuf : rien n'est ajouté au catalogue ni aux routes.
  assert.deepEqual(m.sectionsDuRegistre(R), []);
  assert.deepEqual(m.ecransNeufs(R), []);
});

await dit('un module ajouté seul (un fichier) rejoint sa famille, après ceux du fichier de la famille', () => {
  const r = m.assembler([...m.FICHIERS, { chemin: 'declarations/zz-prime.ts', declaration: moduleSeulOk() }]);
  assert.deepEqual(r.fautes, []);
  const argent = r.familles.find((f) => f.id === 'argent');
  assert.equal(argent?.entrees.at(-1)?.id, 'essaiPrime');
  assert.equal(argent?.entrees.at(-1)?.action, 'argent.prevoir');
});

const refuse = (nom: string, declaration: unknown, attendu: RegExp) =>
  dit(`refusé : ${nom}`, () => {
    const r = m.assembler([...m.FICHIERS, { chemin: 'declarations/zz-faux.ts', declaration }]);
    assert.ok(r.fautes.length > 0, 'aucune faute relevée');
    assert.ok(r.fautes.some((f) => attendu.test(f)), `fautes : ${r.fautes.join(' | ')}`);
    assert.ok(!r.vues.some((v) => v.id.startsWith('essai')), 'le module fautif est entré au registre');
    assert.equal(r.entrees.length, R.entrees.length, 'le reste du registre a bougé');
  });

const familleAvec = (module: Record<string, unknown>, plus: Record<string, unknown> = {}) => ({
  type: 'famille',
  id: 'atelier',
  ordre: 99,
  teinte: 'creer',
  nom: { fr: 'Atelier', en: 'Workshop' },
  actions: { fabriquer: { fr: 'Fabriquer', en: 'Make' } },
  modules: [module],
  ...plus,
});
const vueEssai = { id: 'essaiX', route: '/essai/x', verbes: ['faire un essai'], motsCles: ['essai'] };

await refuse('un module seul sans famille', { type: 'module', action: 'prevoir', niveau: 'courant', vues: [vueEssai] }, /sans famille/);
await refuse('un module seul dans une famille inconnue', { type: 'module', famille: 'cuisine', action: 'prevoir', niveau: 'courant', vues: [vueEssai] }, /sans famille/);
await refuse('un module sans action', familleAvec({ niveau: 'courant', vues: [vueEssai] }), /sans action/);
await refuse('un module seul sans action', { type: 'module', famille: 'argent', niveau: 'courant', vues: [vueEssai] }, /sans action/);
await refuse('une action que la famille ne déclare pas', familleAvec({ action: 'cuisiner', niveau: 'courant', vues: [vueEssai] }), /inconnue de sa famille/);
await refuse('une famille sans action', familleAvec({ action: 'fabriquer', niveau: 'courant', vues: [vueEssai] }, { actions: {} }), /famille sans action/);
await refuse('un niveau inconnu', familleAvec({ action: 'fabriquer', niveau: 'expert', vues: [vueEssai] }), /niveau/);
await refuse('une vue sans verbe', familleAvec({ action: 'fabriquer', niveau: 'courant', vues: [{ ...vueEssai, verbes: [] }] }), /sans verbe/);
await refuse('une vue déjà rangée ailleurs', familleAvec({ action: 'fabriquer', niveau: 'courant', vues: [{ ...vueEssai, id: 'invoices' }] }), /déjà rangée/);
await refuse('un écran neuf sans nom', familleAvec({ action: 'fabriquer', niveau: 'courant', vues: [{ ...vueEssai, nouveau: { icone: () => null, ecran: async () => ({}), indice: { fr: 'x', en: 'x' } } }] }), /nom/);
await refuse('une famille déclarée deux fois', familleAvec({ action: 'fabriquer', niveau: 'courant', vues: [vueEssai] }, { id: 'argent' }), /déjà déclarée/);
await refuse('une teinte hors du socle', familleAvec({ action: 'fabriquer', niveau: 'courant', vues: [vueEssai] }, { teinte: 'bleu' }), /teinte/);

/* ── 2. Le rail du moment ─────────────────────────────────────────────────── */

console.log('\nNavigation de la refonte — le rail du moment\n');

await dit('les essentiels (et ceux de la Garde) sont des modules du registre', () => {
  const inconnus = [...m.ESSENTIELS, ...m.ESSENTIELS_GARDE].filter((id) => !parId.has(id));
  assert.deepEqual(inconnus, []);
});

const heures = Array.from({ length: 7 * 24 }, (_, h) => new Date(2026, 9, 19 + Math.floor(h / 24), h % 24, 30));
const finDeMois = Array.from({ length: 24 }, (_, h) => new Date(2026, 9, 28, h, 0));

await dit('les suggestions existent, ne répètent pas les essentiels, et suivent l’heure', () => {
  const fautes: string[] = [];
  for (const d of [...heures, ...finDeMois]) {
    for (const id of m.suggestionsDuMoment(d)) {
      if (!parId.has(id)) fautes.push(`${d.toISOString()} : ${id} inconnu`);
      if ((m.ESSENTIELS as readonly string[]).includes(id) || (m.ESSENTIELS_GARDE as readonly string[]).includes(id)) fautes.push(`${id} est déjà un essentiel`);
    }
  }
  assert.deepEqual(fautes, [], fautes.join('\n'));
  assert.ok(m.suggestionsDuMoment(new Date(2026, 9, 23, 15, 0)).includes('weekly'), 'vendredi 15 h : la revue hebdo');
  assert.ok(m.suggestionsDuMoment(new Date(2026, 9, 21, 8, 0)).includes('priorities'), 'mercredi 8 h : les priorités');
  assert.equal(m.suggestionsDuMoment(new Date(2026, 9, 28, 10, 0))[0], 'reminders', 'le 28 : les relances d’abord');
});

await dit('le rail ne montre jamais deux fois le même module, et tient ses plafonds', () => {
  const items = catalogue.map((i) => ({ key: i.key }));
  for (const d of heures) {
    const g = m.composerRail({ catalogue: items, epingles: ['home', 'invoices', 'stock', 'calls'], recents: catalogue.map((i) => i.key).reverse(), quand: d });
    const toutes = Object.values(g).flat().map((i) => i.key);
    assert.equal(new Set(toutes).size, toutes.length, `doublon à ${d.toISOString()} : ${toutes.join(', ')}`);
    assert.ok(g.recents.length <= m.MAX_RECENTS && g.maintenant.length <= m.MAX_SUGGESTIONS);
    assert.equal(g.essentiels[0]?.key, 'home', 'l’Accueil vient en premier');
  }
});

await dit('un module fermé à l’organisation n’apparaît dans aucun groupe', () => {
  const ouverts = catalogue.filter((i) => !['invoices', 'gardeSalle', 'stock'].includes(i.key)).map((i) => ({ key: i.key }));
  const g = m.composerRail({ catalogue: ouverts, epingles: ['stock'], recents: ['invoices'], quand: new Date(2026, 9, 28, 15) });
  const toutes = Object.values(g).flat().map((i) => i.key);
  for (const ferme of ['invoices', 'gardeSalle', 'stock']) assert.ok(!toutes.includes(ferme), ferme);
});

/* ── 3. La recherche par intention ────────────────────────────────────────── */

console.log('\nNavigation de la refonte — la recherche par intention\n');

const cherchables = catalogue.map((i) => ({ key: i.key, label: i.label, hint: i.hint }));
const premier = (q: string) => m.chercher(q, cherchables)[0];

const CAS: [string, string][] = [
  ['envoyer une facture', 'invoices'],
  ['je veux envoyer une facture', 'invoices'],
  ['facture envoyer', 'invoices'],
  ['facture', 'invoices'],
  ['factures', 'invoices'],
  ['Facturation', 'invoices'],
  ['relancer un impayé', 'reminders'],
  ['impaye', 'reminders'],
  ['prendre un rendez-vous', 'agenda'],
  ['rdv', 'agenda'],
  ['ajouter un client', 'clients'],
  ['faire un devis', 'clients'],
  ['écrire à un collègue', 'dm'],
  ['poser un congé', 'leaves'],
  ['note de frais', 'expenseClaims'],
  ['fiche de paie', 'payslips'],
  ['programmer un post', 'postPlanner'],
  ['créer un QR code', 'qr'],
  ['traduire', 'translation'],
  ['mot de passe', 'vault'],
  ['écrire dans mon journal', 'diary'],
  ['voir qui est en ligne', 'team'],
  ['donner mon avis', 'gardePile'],
  ['traiter un incident', 'supervision'],
  ['tresorerie', 'cashForecast'],
];

for (const [q, attendu] of CAS) {
  await dit(`« ${q} » → ${attendu}`, () => {
    const t = premier(q);
    assert.equal(t?.item.key, attendu, `premier résultat : ${t?.item.key ?? 'aucun'}`);
  });
}

const premierEn = (q: string) => m.chercher(q, cherchables, { langue: 'en' })[0];
const CAS_EN: [string, string][] = [
  ['send an invoice', 'invoices'],
  ['I want to send an invoice', 'invoices'],
  ['invoice', 'invoices'],
  ['chase an unpaid invoice', 'reminders'],
  ['book an appointment', 'agenda'],
  ['add a customer', 'clients'],
  ['request leave', 'leaves'],
  ['expense claim', 'expenseClaims'],
  ['payslip', 'payslips'],
  ['schedule a post', 'postPlanner'],
  ['translate', 'translation'],
  ['password', 'vault'],
  ['write in my journal', 'diary'],
  ['see who is online', 'team'],
  ['handle an incident', 'supervision'],
  ['cash flow', 'cashForecast'],
  ['back up my data', 'dataPort'],
  ['change the theme', 'settings'],
];
for (const [q, attendu] of CAS_EN) {
  await dit(`en anglais : « ${q} » → ${attendu}`, () => {
    const t = premierEn(q);
    assert.equal(t?.item.key, attendu, `premier résultat : ${t?.item.key ?? 'aucun'}`);
  });
}

await dit('en français dans l’interface anglaise, et en anglais dans la française : l’autre langue trouve aussi', () => {
  assert.equal(m.chercher('envoyer une facture', cherchables, { langue: 'en' })[0]?.item.key, 'invoices');
  assert.equal(m.chercher('send an invoice', cherchables)[0]?.item.key, 'invoices');
  // …mais le verbe de l’autre langue ne s’affiche pas à côté du résultat.
  assert.equal(m.chercher('envoyer une facture', cherchables, { langue: 'en' })[0]?.raison, undefined);
  assert.equal(m.chercher('send an invoice', cherchables, { langue: 'en' })[0]?.raison, 'send an invoice');
});

const CAS_NOMS: [string, string][] = [
  ['retours clients', 'reviews'],
  ['dépenses et achats', 'expenses'],
  ['ma page publique', 'minisite'],
  ['appels et salles', 'calls'],
  ['prévisions', 'cashForecast'],
];
for (const [q, attendu] of CAS_NOMS) {
  await dit(`le nom de l’entrée : « ${q} » → ${attendu} (sa vue principale d’abord)`, () => {
    const t = premier(q);
    assert.equal(t?.item.key, attendu, `premier résultat : ${t?.item.key ?? 'aucun'}`);
  });
}

const CAS_FAUTES: [string, string][] = [
  ['facutre', 'invoices'],
  ['tresorrie', 'cashForecast'],
  ['abonement', 'subscriptions'],
  ['recrutment', 'recruitment'],
  ['relancer une facutre', 'reminders'],
];
for (const [q, attendu] of CAS_FAUTES) {
  await dit(`une faute de frappe : « ${q} » → ${attendu}`, () => {
    const t = premier(q);
    assert.equal(t?.item.key, attendu, `premier résultat : ${t?.item.key ?? 'aucun'}`);
  });
}

await dit('une faute ne rend pas n’importe quoi : les mots courts et le charabia ne trouvent rien', () => {
  assert.deepEqual(m.chercher('fcat', cherchables), [], 'quatre lettres : pas de tolérance');
  assert.deepEqual(m.chercher('qwertzuiop', cherchables), []);
});

await dit('à score égal : l’essentiel avant le courant avant l’avancé, puis la vue principale', () => {
  const niveau = new Map(R.entrees.flatMap((e) => e.vues.map((v) => [v.id, e.niveau] as const)));
  const rang = { essentiel: 0, courant: 1, avance: 2 } as Record<string, number>;
  for (const q of ['garde', 'soc', 'liste', 'perso', 'vidéo', 'photo', 'réservation', 'prix']) {
    const r = m.chercher(q, cherchables);
    for (let i = 1; i < r.length; i++) {
      if (r[i - 1].score !== r[i].score) continue;
      assert.ok(rang[niveau.get(r[i - 1].item.key) ?? 'courant'] <= rang[niveau.get(r[i].item.key) ?? 'courant'], `« ${q} » : ${r[i - 1].item.key} avant ${r[i].item.key}`);
    }
  }
});

await dit('chaque verbe de chaque vue, tapé tel quel, la trouve en premier — en français et en anglais', () => {
  const fautes: string[] = [];
  for (const langue of ['fr', 'en'] as const) {
    for (const v of m.REGISTRE) {
      for (const verbe of langue === 'fr' ? v.verbes : (v.en?.verbes ?? [])) {
        const t = m.chercher(verbe, cherchables, { langue })[0];
        if (t?.item.key !== v.id) fautes.push(`${langue} « ${verbe} » : ${t?.item.key ?? 'rien'} au lieu de ${v.id}`);
      }
    }
  }
  assert.deepEqual(fautes, [], fautes.join('\n'));
});

await dit('chaque vue du catalogue se trouve par son nom, en français et en anglais', () => {
  const fautes: string[] = [];
  for (const i of catalogue) {
    const fr = m.chercher(i.label, cherchables).map((t) => t.item.key);
    if (fr.indexOf(i.key) < 0 || fr.indexOf(i.key) > 2) fautes.push(`fr « ${i.label} » : rang ${fr.indexOf(i.key) + 1}`);
    const nomEn = m.NAV_EN[i.key]?.label;
    if (nomEn) {
      const en = m.chercher(nomEn, cherchables.map((c) => ({ ...c, label: m.NAV_EN[c.key]?.label ?? c.label })), { langue: 'en' }).map((t) => t.item.key);
      if (en.indexOf(i.key) < 0 || en.indexOf(i.key) > 2) fautes.push(`en « ${nomEn} » : rang ${en.indexOf(i.key) + 1}`);
    }
  }
  assert.deepEqual(fautes, [], fautes.join('\n'));
});

await dit('le verbe trouvé est rendu, pour l’afficher à côté', () => {
  assert.equal(premier('envoyer une facture')?.raison, 'envoyer une facture');
});

await dit('rien tapé, rien trouvé ; du charabia, rien trouvé', () => {
  assert.deepEqual(m.chercher('   ', cherchables), []);
  assert.deepEqual(m.chercher('zzqxw', cherchables), []);
});

/* ── 4. L'ouverture ───────────────────────────────────────────────────────── */

console.log('\nNavigation de la refonte — l’ouverture\n');

await dit('Accueil à la première ouverture du jour, le dernier module ensuite', () => {
  const memoire = new Map<string, string>();
  const stockage = { getItem: (k: string) => memoire.get(k) ?? null, setItem: (k: string, v: string) => void memoire.set(k, v) };
  assert.equal(m.premiereOuvertureDuJour(new Date(2026, 9, 20, 8, 0), stockage), true, 'la toute première fois');
  assert.equal(m.premiereOuvertureDuJour(new Date(2026, 9, 20, 14, 0), stockage), false, 'le même jour');
  assert.equal(m.premiereOuvertureDuJour(new Date(2026, 9, 20, 23, 59), stockage), false, 'le soir même');
  assert.equal(m.premiereOuvertureDuJour(new Date(2026, 9, 21, 0, 5), stockage), true, 'le lendemain');
});

await dit('stockage refusé : on garde l’ancien comportement (reprendre le dernier module)', () => {
  assert.equal(m.premiereOuvertureDuJour(new Date(), null), false);
  const casse = { getItem: () => { throw new Error('refusé'); }, setItem: () => undefined };
  assert.equal(m.premiereOuvertureDuJour(new Date(), casse), false);
});

/* ── 5. L'isolement ───────────────────────────────────────────────────────── */

console.log('\nNavigation de la refonte — l’isolement des éditions\n');

const imports = (src: string) => [...src.matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g)].map((x) => x[1]);

await dit('le jumeau cliente de la couture n’importe que React, et rien de la refonte ni du socle', () => {
  const src = lire('src/edition/navigation.business.tsx');
  assert.deepEqual(imports(src).filter((i) => i !== 'react'), []);
  assert.ok(!/refonte\/|socle\//.test(src.replace(/\/\*[\s\S]*?\*\//g, '')), 'chemin de la refonte cité hors commentaire');
});

await dit('aucun code partagé n’importe src/refonte/** en direct (seules les coutures .internal le peuvent)', () => {
  const fautes: string[] = [];
  // Internes par construction, sans suffixe .internal : `check:garde-refonte` (S3) vérifie que seuls
  // `appRoot.internal.tsx` et `AppLayout` (lui-même interne) les atteignent.
  const internesSansSuffixe = [path.join('src', 'bureaux'), path.join('src', 'components', 'IdleScreensaver.tsx')];
  const parcourir = (dir: string) => {
    for (const e of fs.readdirSync(path.join(racine, dir), { withFileTypes: true })) {
      const rel = path.join(dir, e.name);
      if (internesSansSuffixe.includes(rel)) continue;
      if (e.isDirectory()) {
        if (rel === path.join('src', 'refonte')) continue;
        parcourir(rel);
      } else if (/\.tsx?$/.test(e.name) && !/\.internal\.tsx?$/.test(e.name)) {
        for (const i of imports(lire(rel))) if (/(^|\/)refonte\//.test(i)) fautes.push(`${rel} importe ${i}`);
      }
    }
  };
  parcourir('src');
  assert.deepEqual(fautes, [], fautes.join('\n'));
});

await dit('l’alias @edition/navigation est déclaré pour Vite et pour les deux tsconfig', () => {
  assert.match(lire('vite.edition.ts'), /'@edition\/navigation': at\(`src\/edition\/navigation\.\$\{suffix\}\.tsx`\)/);
  assert.match(lire('tsconfig.json'), /"@edition\/navigation": \["src\/edition\/navigation\.internal\.tsx"\]/);
  assert.match(lire('tsconfig.business.json'), /"@edition\/navigation": \["src\/edition\/navigation\.business\.tsx"\]/);
});

console.log('');
if (echecs > 0) {
  console.error(`ÉCHEC — ${echecs} propriété(s) de la navigation ne tiennent pas.`);
  process.exit(1);
}
console.log(`OK — ${vus} propriétés de la navigation tiennent.`);
process.exit(0);
