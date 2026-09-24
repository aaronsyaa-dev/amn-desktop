/**
 * LES ACCUEILS NE TRAVERSENT PAS LES ÉDITIONS
 * ═══════════════════════════════════════════
 *
 * Le chantier de design a déjà buté deux fois sur des données codées en dur
 * qui passaient d'une édition à l'autre. Les vingt Accueils (ACCUEILS.md) en
 * sont la tentation parfaite : dix variantes de chaque côté, écrites dans le
 * même dossier, qui partagent des outils. Ce contrôle relit les SOURCES :
 *
 *   · `src/accueils/client/**` n'importe rien de `interne/`, et inversement ;
 *   · le registre Business n'importe aucune variante interne, et n'inscrit
 *     que `2a` et `40a` → `40j` ; le registre interne, que `2a` et `42a` →
 *     `42j` ;
 *   · le code partagé (`src/accueils/*.ts[x]` à la racine) n'importe aucune
 *     des deux familles.
 *
 * `check:business` relit, lui, le PAQUET construit : les deux se complètent —
 * l'un attrape l'import, l'autre ce qui aurait pu passer autrement.
 *
 *   npm run check:accueils
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lire = (p) => fs.readFileSync(path.join(racine, p), 'utf8');
const imports = (src) => [...src.matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
const fautes = [];

function dossier(rel) {
  const d = path.join(racine, rel);
  return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => /\.tsx?$/.test(f)).map((f) => path.join(rel, f)) : [];
}

for (const f of dossier('src/accueils/client')) for (const i of imports(lire(f))) if (/interne\//.test(i) || /accueils\.internal/.test(i)) fautes.push(`${f} importe ${i}`);
for (const f of dossier('src/accueils/interne')) for (const i of imports(lire(f))) if (/client\//.test(i) || /\/business\//.test(i) || /accueils\.business/.test(i)) fautes.push(`${f} importe ${i}`);
for (const f of dossier('src/accueils')) for (const i of imports(lire(f))) if (/(^|\/)(client|interne)\//.test(i)) fautes.push(`${f} (partagé) importe ${i}`);

/* Le guide : les profils de départ suivent la même règle que les Accueils. */
for (const [f, interdit] of [['src/edition/guide.business.ts', /supervision|garde|tour|orgs/], ['src/edition/guide.internal.ts', /etudes|coll[ée]gien/]]) {
  const src = lire(f);
  for (const i of imports(src)) if (/interne\/|client\/|accueils\./.test(i)) fautes.push(`${f} importe ${i}`);
  if (f.endsWith('business.ts') && /'(supervision|tour|gardeSalle|gardePile|orgs)'/.test(src)) fautes.push(`${f} cite un module interne`);
  void interdit;
}

const codes = (src) => [...src.matchAll(/code:\s*'([^']+)'/g)].map((m) => m[1]);
const business = lire('src/edition/accueils.business.tsx');
const interne = lire('src/edition/accueils.internal.tsx');
for (const i of imports(business)) if (/interne\//.test(i)) fautes.push(`registre Business importe ${i}`);
for (const i of imports(interne)) if (/accueils\/client\//.test(i) || /\/business\//.test(i)) fautes.push(`registre interne importe ${i}`);
const attenduB = ['2a', ...'abcdefghij'.split('').map((l) => `40${l}`)];
const attenduI = ['2a', ...'abcdefghij'.split('').map((l) => `42${l}`)];
const cb = codes(business);
const ci = codes(interne);
if (JSON.stringify(cb) !== JSON.stringify(attenduB)) fautes.push(`registre Business : ${cb.join(', ')} — attendu ${attenduB.join(', ')}`);
if (JSON.stringify(ci) !== JSON.stringify(attenduI)) fautes.push(`registre interne : ${ci.join(', ')} — attendu ${attenduI.join(', ')}`);

if (fautes.length) {
  console.error('✗ check:accueils — un Accueil traverse les éditions :');
  for (const f of fautes) console.error(`   · ${f}`);
  process.exit(1);
}
console.log(`✓ check:accueils — ${cb.length} Accueils Business, ${ci.length} internes, aucun import croisé.`);
