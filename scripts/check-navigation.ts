/**
 * Contrôle de la NAVIGATION DE LA REFONTE (S1) — `npm run check:navigation`.
 *
 * Sans navigateur, sans build, sans réseau. Il tient ce qu'un `grep` ou une
 * capture ne voient pas :
 *
 *   1. LE REGISTRE ET LE CATALOGUE S'ACCORDENT. Chaque module du catalogue
 *      interne (`modules.internal.ts`) a sa ligne dans
 *      `src/refonte/navigation/registre.ts`, avec la MÊME route, une famille
 *      du socle, une action de cette famille, au moins un verbe et un mot-clé.
 *      Aucun module en trop, aucun en moins : le registre range, il ne
 *      supprime pas. Et chaque route mène à une `<Route>` de l'édition interne.
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

/** Charge un bout de code des sources, construit par esbuild (alias résolus par tsconfig.json : édition interne). */
async function charger<T>(code: string): Promise<T> {
  const construit = await esbuild.build({
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

interface Entree {
  id: string;
  route: string;
  famille: string;
  action: string;
  verbes: readonly string[];
  motsCles: readonly string[];
  aValider?: true;
  pourquoi?: string;
}
interface Item {
  key: string;
  label: string;
  to: string;
  hint: string;
}

const m = await charger<{
  NAV_SECTIONS: { key: string; items: Item[] }[];
  REGISTRE: readonly Entree[];
  ACTIONS: Record<string, readonly string[]>;
  FAMILLES: readonly string[];
  ESSENTIELS: readonly string[];
  ESSENTIELS_GARDE: readonly string[];
  MAX_RECENTS: number;
  MAX_SUGGESTIONS: number;
  suggestionsDuMoment: (d: Date) => string[];
  composerRail: <T extends { key: string }>(a: { catalogue: readonly T[]; epingles: readonly string[]; recents: readonly string[]; quand: Date }) => Record<'essentiels' | 'garde' | 'epingles' | 'recents' | 'maintenant', T[]>;
  chercher: (q: string, items: readonly { key: string; label: string; hint?: string }[]) => { item: { key: string }; score: number; raison?: string }[];
  premiereOuvertureDuJour: (d: Date, s: Pick<Storage, 'getItem' | 'setItem'> | null) => boolean;
  DICTIONNAIRES_NAV: Record<'fr' | 'en', Record<string, string>>;
}>(
  [
    "export { NAV_SECTIONS } from '../src/edition/modules.internal';",
    "export { REGISTRE, ACTIONS } from '../src/refonte/navigation/registre';",
    "export { FAMILLES } from '../src/socle/familles';",
    "export { ESSENTIELS, ESSENTIELS_GARDE, MAX_RECENTS, MAX_SUGGESTIONS, suggestionsDuMoment, composerRail } from '../src/refonte/navigation/moment';",
    "export { chercher } from '../src/refonte/navigation/recherche';",
    "export { premiereOuvertureDuJour } from '../src/refonte/navigation/ouverture';",
    "export { DICTIONNAIRES_NAV } from '../src/refonte/navigation/i18n';",
  ].join('\n'),
);

const catalogue = m.NAV_SECTIONS.flatMap((s) => s.items);
const parId = new Map(m.REGISTRE.map((e) => [e.id, e]));

/* ── 1. Le registre et le catalogue ───────────────────────────────────────── */

console.log('\nNavigation de la refonte — le registre\n');

await dit(`chaque module du catalogue interne est au registre, avec la même route (${catalogue.length})`, () => {
  const manquants = catalogue.filter((i) => !parId.has(i.key)).map((i) => i.key);
  assert.deepEqual(manquants, [], `absents du registre : ${manquants.join(', ')}`);
  const routes = catalogue.filter((i) => parId.get(i.key)?.route !== i.to).map((i) => `${i.key} : catalogue ${i.to}, registre ${parId.get(i.key)?.route}`);
  assert.deepEqual(routes, [], routes.join('\n'));
});

await dit('le registre ne contient rien que le catalogue n’ait pas, et chaque id une seule fois', () => {
  const cles = new Set(catalogue.map((i) => i.key));
  const enTrop = m.REGISTRE.filter((e) => !cles.has(e.id)).map((e) => e.id);
  assert.deepEqual(enTrop, [], `inconnus du catalogue : ${enTrop.join(', ')}`);
  assert.equal(parId.size, m.REGISTRE.length, 'un identifiant revient deux fois');
});

await dit('chaque ligne : une famille du socle, une action de cette famille, un verbe, un mot-clé', () => {
  const fautes: string[] = [];
  for (const e of m.REGISTRE) {
    if (!m.FAMILLES.includes(e.famille)) fautes.push(`${e.id} : famille « ${e.famille} »`);
    const [f, a] = e.action.split('.');
    if (f !== e.famille || !(m.ACTIONS[f] ?? []).includes(a)) fautes.push(`${e.id} : action « ${e.action} » hors de ${e.famille}`);
    if (e.verbes.length === 0 || e.verbes.some((v) => !v.trim())) fautes.push(`${e.id} : sans verbe`);
    if (e.motsCles.length === 0) fautes.push(`${e.id} : sans mot-clé`);
    if (e.aValider && !e.pourquoi) fautes.push(`${e.id} : « à valider » sans dire pourquoi`);
  }
  assert.deepEqual(fautes, [], fautes.join('\n'));
});

await dit('chaque action déclarée sert au moins une fois, et a son libellé fr et en', () => {
  const servies = new Set(m.REGISTRE.map((e) => e.action));
  const fautes: string[] = [];
  for (const [f, actions] of Object.entries(m.ACTIONS)) {
    for (const a of actions) {
      const cle = `${f}.${a}`;
      if (!servies.has(cle)) fautes.push(`${cle} : aucune ligne`);
      for (const langue of ['fr', 'en'] as const) if (!m.DICTIONNAIRES_NAV[langue][`action.${cle}`]?.trim()) fautes.push(`${cle} : pas de libellé ${langue}`);
    }
  }
  assert.deepEqual(fautes, [], fautes.join('\n'));
});

await dit('chaque route du registre mène à une <Route> de l’édition interne', () => {
  const tables = lire('src/edition/appRoot.internal.tsx') + lire('src/bureaux/routes.tsx');
  const declarees = new Set([...tables.matchAll(/path="([^"]+)"/g)].map((x) => x[1]));
  const sansRoute = m.REGISTRE.filter((e) => !declarees.has(e.route)).map((e) => `${e.id} (${e.route})`);
  assert.deepEqual(sansRoute, [], `sans route : ${sansRoute.join(', ')}`);
});

await dit('les dictionnaires fr et en ont les mêmes clés, aucune vide', () => {
  const en = Object.keys(m.DICTIONNAIRES_NAV.en).sort();
  const fr = Object.keys(m.DICTIONNAIRES_NAV.fr).sort();
  assert.deepEqual(fr, en);
  const vides = [...en.filter((k) => !m.DICTIONNAIRES_NAV.en[k].trim()), ...fr.filter((k) => !m.DICTIONNAIRES_NAV.fr[k].trim())];
  assert.deepEqual(vides, []);
});

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
  ['parler à ajmani', 'gardeAjmani'],
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
