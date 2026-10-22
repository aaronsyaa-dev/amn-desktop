/**
 * Contrôle de la GARDE VISIBLE (refonte S3) — `npm run check:garde-refonte`.
 *
 * Sans réseau, sans navigateur. Il fige ce que la session S3 promet :
 *
 *   1. les huit accents d'équipe : une couleur par équipe de `EQUIPES_ORDRE`,
 *      AA sur les surfaces du socle (graphite et clair), hors de l'ambre et
 *      du rouge, assez distinctes entre elles ;
 *   2. les mots : mêmes clés en fr et en, la voix de la Garde (pas de « ! »,
 *      pas d'apostrophe droite, pas de « (s) », espaces françaises) ;
 *   3. le résumé de la nuit : douze mots au plus par phrase, quels que soient
 *      les nombres ; le ton change dès qu'il y a un problème ;
 *   4. le fil : une ligne par équipe, jamais plus ; la priorité échec > ronde
 *      > journal > repos ; le nombre de gardes vient des données ;
 *   5. le contrat des alertes critiques : le seuil, les préférences, le
 *      regroupement ;
 *   6. la carte : déterministe, sans NaN, dans son cadre ;
 *   7. l'isolement : rien de `src/refonte/garde` n'est importé hors de
 *      l'édition interne, et la salle ne charge rien du réseau.
 *
 *   npm run check:garde-refonte
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
const lire = (f: string) => fs.readFileSync(path.join(racine, f), 'utf8');

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
  return (await import(`data:text/javascript;charset=utf-8;base64,${Buffer.from(construit.outputFiles[0].text, 'utf8').toString('base64')}`)) as T;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const M = await charger<any>(
  [
    "export * from '../src/refonte/garde/equipes';",
    "export * from '../src/refonte/garde/i18n';",
    "export * from '../src/refonte/garde/resume';",
    "export * from '../src/refonte/garde/fil';",
    "export * from '../src/refonte/garde/alertes';",
    "export * as carte from '../src/refonte/garde/carte';",
  ].join('\n'),
);

/* ── 1. Les accents ──────────────────────────────────────────────────────── */
console.log('Garde visible — accents d’équipe\n');

type Rvb = [number, number, number];
const rvb = (hex: string): Rvb => [0, 2, 4].map((i) => Number.parseInt(hex.replace('#', '').slice(i, i + 2), 16)) as Rvb;
const canal = (c: number) => {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]: Rvb) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
const rapport = (a: Rvb, b: Rvb) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const poser = (c: Rvb, fond: Rvb, alpha: number): Rvb => c.map((v, i) => Math.round(v * alpha + fond[i] * (1 - alpha))) as Rvb;
const teinte = ([r, g, b]: Rvb) => {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const mx = Math.max(R, G, B);
  const mn = Math.min(R, G, B);
  const d = mx - mn;
  if (d === 0) return { h: 0, s: 0 };
  const h = mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return { h: (h * 60 + 360) % 360, s: d / (1 - Math.abs(mx + mn - 1)) };
};

const feuille = lire('src/index.css');
const debutSocle = feuille.indexOf('LE SOCLE DE LA REFONTE (S0)');
function surfaces(selecteur: string): Rvb[] {
  const i = feuille.indexOf(selecteur, debutSocle);
  const corps = feuille.slice(feuille.indexOf('{', i) + 1, feuille.indexOf('}', i));
  return ['fond', 'creux', 'surface', 'eleve', 'survol'].map((s) => {
    const m = new RegExp(`--color-socle-${s}:\\s*(#[0-9a-f]{6})`, 'i').exec(corps);
    assert.ok(m, `surface socle-${s} introuvable sous ${selecteur}`);
    return rvb(m[1]);
  });
}
const SOMBRE = [...surfaces('@theme'), rvb('#060606')];
const CLAIR = surfaces(":root[data-theme='clair']");
const ordre = [...lire('src/lib/garde.ts').matchAll(/EQUIPES_ORDRE = \[([^\]]+)\]/g)][0][1].match(/'([a-z]+)'/g)?.map((x) => x.slice(1, -1)) ?? [];

await dit('une couleur par équipe de EQUIPES_ORDRE, ni plus ni moins', () => {
  assert.deepEqual(Object.keys(M.ACCENTS_EQUIPE).sort(), [...ordre].sort());
});
for (const [theme, fonds] of [['sombre', SOMBRE], ['clair', CLAIR]] as const) {
  await dit(`${theme} : base ≥ 3:1 et texte ≥ 4,5:1 sur chaque surface, et sur le fond léger à 14 %`, () => {
    for (const [cle, a] of Object.entries<any>(M.ACCENTS_EQUIPE)) {
      const { base, texte } = a[theme];
      for (const f of fonds) {
        assert.ok(rapport(rvb(base), f) >= 3, `${cle} base ${base} : ${rapport(rvb(base), f).toFixed(2)}:1`);
        assert.ok(rapport(rvb(texte), f) >= 4.5, `${cle} texte ${texte} : ${rapport(rvb(texte), f).toFixed(2)}:1`);
        const fondLeger = poser(rvb(base), f, 0.14);
        assert.ok(rapport(rvb(texte), fondLeger) >= 4.5, `${cle} texte sur fond léger : ${rapport(rvb(texte), fondLeger).toFixed(2)}:1`);
      }
    }
  });
}
await dit('aucun accent dans l’ambre (20–55°) ni dans le rouge du critique', () => {
  for (const [cle, a] of Object.entries<any>(M.ACCENTS_EQUIPE)) {
    for (const theme of ['sombre', 'clair']) {
      for (const c of [a[theme].base, a[theme].texte]) {
        const { h, s } = teinte(rvb(c));
        if (s < 0.12) continue;
        assert.ok(h < 20 || h > 55, `${cle} ${c} : ${h.toFixed(0)}°, dans l’ambre`);
        assert.ok(h >= 20 && h <= 345, `${cle} ${c} : ${h.toFixed(0)}°, dans le rouge`);
      }
    }
  }
});
await dit('les accents se distinguent : teintes écartées d’au moins 25°, une seule neutre', () => {
  // La couleur n'est jamais seule : le nom de l'équipe l'accompagne partout.
  for (const theme of ['sombre', 'clair']) {
    const t = Object.entries<any>(M.ACCENTS_EQUIPE).map(([cle, a]) => ({ cle, ...teinte(rvb(a[theme].base)) }));
    const neutres = t.filter((x) => x.s < 0.2);
    assert.ok(neutres.length <= 1, `${theme} : plusieurs teintes neutres (${neutres.map((x) => x.cle).join(', ')})`);
    const vives = t.filter((x) => x.s >= 0.2);
    for (let i = 0; i < vives.length; i += 1) {
      for (let j = i + 1; j < vives.length; j += 1) {
        const d = Math.abs(vives[i].h - vives[j].h);
        const ecart = Math.min(d, 360 - d);
        assert.ok(ecart >= 25, `${vives[i].cle} / ${vives[j].cle} (${theme}) : ${ecart.toFixed(0)}°`);
      }
    }
  }
});

/* ── 2. Les mots ─────────────────────────────────────────────────────────── */
console.log('\nGarde visible — les mots\n');

const D = M.DICTIONNAIRES_GARDE as Record<'fr' | 'en', Record<string, string>>;
function parole(ou: string, texte: string, langue: 'fr' | 'en') {
  assert.ok(texte.trim(), `${ou} : vide`);
  assert.ok(!/!/.test(texte), `${ou} : point d’exclamation`);
  assert.ok(!/'/.test(texte), `${ou} : apostrophe droite`);
  assert.ok(!/\((s|e|es|ne)\)/.test(texte), `${ou} : « (s) » de paresse`);
  if (langue === 'fr') assert.ok(!/ [?!;:]/.test(texte), `${ou} : espace simple avant ? ! ; :`);
}
await dit('mêmes clés en fr et en, aucune vide, la voix de la Garde', () => {
  assert.deepEqual(Object.keys(D.fr).sort(), Object.keys(D.en).sort());
  for (const l of ['fr', 'en'] as const) for (const [k, v] of Object.entries(D[l])) parole(`${l} ${k}`, v, l);
});
await dit('chaque équipe a son nom dans les deux langues', () => {
  for (const e of ordre) for (const l of ['fr', 'en'] as const) assert.ok(D[l][`equipe.${e}`], `equipe.${e} (${l})`);
});
await dit('aucune clé de la refonte S3 dans les dictionnaires communs', () => {
  for (const l of ['fr', 'en']) assert.ok(!/'refonte\.s3\./.test(lire(`src/i18n/${l}.ts`)), `src/i18n/${l}.ts`);
});

/* ── 3. Le résumé ────────────────────────────────────────────────────────── */
console.log('\nGarde visible — le résumé de la nuit\n');

const vide = { rondes: 0, regles: 0, remontes: 0, ratees: 0, critiquesOuverts: 0, dossiersOuverts: 0, gardesEnEchec: 0 };
await dit('douze mots au plus par phrase, pour tous les nombres, dans les deux langues', () => {
  for (const l of ['fr', 'en'] as const) {
    for (const n of [0, 1, 2, 12, 999, 123456]) {
      const r = M.resumerNuit({ rondes: n, regles: n, remontes: n, ratees: n, critiquesOuverts: n, dossiersOuverts: n * 2, gardesEnEchec: n }, l);
      for (const p of r.phrases) assert.ok(M.motsDe(p.texte) <= 12, `${l} n=${n} « ${p.texte} » : ${M.motsDe(p.texte)} mots`);
    }
  }
});
await dit('nuit sans problème : ton calme, ouverture calme, « rien n’attend »', () => {
  const r = M.resumerNuit({ ...vide, rondes: 40, regles: 3 }, 'fr');
  assert.equal(r.ton, 'calme');
  assert.equal(r.phrases[0].texte, D.fr['resume.ouverture.calme']);
  assert.ok(r.phrases.some((p: any) => p.cle === 'rien'));
});
await dit('un critique ouvert : ton critique, en tête, plus de « nuit calme »', () => {
  const r = M.resumerNuit({ ...vide, rondes: 40, critiquesOuverts: 1, dossiersOuverts: 3 }, 'fr');
  assert.equal(r.ton, 'critique');
  assert.equal(r.phrases[0].texte, D.fr['resume.ouverture.critique']);
  assert.equal(r.phrases[1].cle, 'critique');
  assert.ok(!r.phrases.some((p: any) => p.texte === D.fr['resume.ouverture.calme']));
  assert.ok(r.phrases.find((p: any) => p.cle === 'decision').texte.startsWith('2 '), 'les dossiers non critiques sont comptés à part');
});
await dit('une garde en échec ou aucune ronde : ton sérieux', () => {
  assert.equal(M.resumerNuit({ ...vide, rondes: 12, gardesEnEchec: 1 }, 'fr').ton, 'serieux');
  assert.equal(M.resumerNuit({ ...vide, rondes: 0 }, 'fr').ton, 'serieux');
  assert.ok(!M.resumerNuit({ ...vide, rondes: null }, 'fr').phrases.some((p: any) => p.cle === 'rondes'), 'rondes inconnues : on ne dit rien');
});
await dit('les pluriels : un, plusieurs', () => {
  assert.equal(M.compte('fr', 'resume.decision', 1), D.fr['resume.decision.1']);
  assert.equal(M.compte('fr', 'resume.decision', 4), '4 dossiers attendent une décision.');
  assert.equal(M.compte('en', 'resume.rondes', 0), D.en['resume.rondes.0']);
});
await dit('la fenêtre de nuit : du silence d’hier à la fin du silence', () => {
  const { debut, fin } = M.fenetreDeNuit({ de: 22, a: 7 }, new Date(2026, 9, 20, 9, 30));
  assert.equal(debut.getHours(), 22);
  assert.equal(debut.getDate(), 19);
  assert.equal(fin.getHours(), 7);
  const enCours = M.fenetreDeNuit({ de: 22, a: 7 }, new Date(2026, 9, 20, 3, 0));
  assert.equal(enCours.fin.getHours(), 3);
});

/* ── 4. Le fil ───────────────────────────────────────────────────────────── */
console.log('\nGarde visible — le fil d’activité\n');

const agent = (key: string, equipe: string, etat: string, phrase = '', actif = true) => ({ key, equipe, nom: key, role: '', everyMs: 60_000, etat, phrase, actif, echecs: 0, derniereRondeAt: '2026-10-20T03:00:00Z', prochaineRondeAt: null, parametres: {}, couloir: {}, geleOrgs: [] });
const entree = (equipe: string, at: string, pourquoi: string) => ({ id: at, agent: `${equipe}.x`, equipe, orgId: null, ressource: null, action: 'a', pourquoi, regle: null, resultat: 'regle', detail: null, rondeId: null, mauvais: false, mauvaisNote: null, mauvaisPar: null, correction: null, createdAt: at });
await dit('une ligne par équipe, dans l’ordre, plus une équipe inconnue du poste', () => {
  const l = M.filParEquipe({ ordre, equipes: [{ key: 'nouvelle', nom: 'Garde nouvelle', chef: { nom: '', role: '' }, agents: [] }], agents: [], journal: [] }, 'fr');
  assert.deepEqual(l.map((x: any) => x.equipe), [...ordre, 'nouvelle']);
  assert.ok(l.every((x: any) => x.etat === 'repos' && x.gardes === 0));
});
await dit('priorité : échec, puis ronde, puis journal ; le nombre de gardes vient des données', () => {
  const agents = [agent('sites.a', 'sites', 'ronde', 'Relève les certificats.'), agent('sites.b', 'sites', 'echec'), agent('securite.a', 'securite', 'ronde', 'Lit les connexions.'), agent('comptes.a', 'comptes', 'repos'), agent('comptes.b', 'comptes', 'repos'), agent('comptes.c', 'comptes', 'repos')];
  const journal = [entree('comptes', '2026-10-20T02:00:00Z', 'Ancien.'), entree('comptes', '2026-10-20T04:00:00Z', 'Relance envoyée au bon moment.')];
  const l = M.filParEquipe({ ordre, equipes: [], agents, journal }, 'fr');
  const par = (k: string) => l.find((x: any) => x.equipe === k);
  assert.equal(par('sites').etat, 'echec');
  assert.equal(par('sites').gardes, 2);
  assert.equal(par('securite').texte, 'Lit les connexions.');
  assert.equal(par('comptes').texte, 'Relance envoyée au bon moment.');
  assert.equal(par('comptes').gardes, 3);
  assert.equal(par('registre').etat, 'repos');
});
await dit('une tentative suspecte du poste va à la Sécurité, sans écraser une ronde', () => {
  const l = M.filParEquipe({ ordre, equipes: [], agents: [], journal: [], suspecteAt: '2026-10-20T05:00:00Z' }, 'fr');
  assert.equal(l.find((x: any) => x.equipe === 'securite').texte, D.fr['fil.suspecte']);
  const l2 = M.filParEquipe({ ordre, equipes: [], agents: [agent('securite.a', 'securite', 'ronde', 'Lit.')], journal: [], suspecteAt: '2026-10-20T05:00:00Z' }, 'fr');
  assert.equal(l2.find((x: any) => x.equipe === 'securite').texte, 'Lit.');
});

/* ── 5. Les alertes critiques ────────────────────────────────────────────── */
console.log('\nGarde visible — le contrat des alertes critiques\n');

await dit('le seuil : seul le critique passe', () => {
  const s = M.SEUILS_CRITIQUES_DEFAUT;
  assert.equal(M.estCritique({ type: 'incident-critique', incidentId: 'i', siteId: 's', severite: 'critical', premierDeLIncident: true }), true);
  assert.equal(M.estCritique({ type: 'incident-critique', incidentId: 'i', siteId: 's', severite: 'critical', premierDeLIncident: false }), false, 'une alerte par incident, pas par signal');
  assert.equal(M.estCritique({ type: 'incident-critique', incidentId: 'i', siteId: 's', severite: 'high', premierDeLIncident: true }), false);
  assert.equal(M.estCritique({ type: 'escalade', incidentId: 'i', siteId: 's', prisPar: 'x' }), false);
  assert.equal(M.estCritique({ type: 'site-muet', siteId: 's', muetDepuisMinutes: s.siteMuetMinutes - 1 }), false);
  assert.equal(M.estCritique({ type: 'site-muet', siteId: 's', muetDepuisMinutes: s.siteMuetMinutes }), true);
  assert.equal(M.estCritique({ type: 'garde-en-echec', agent: 'a', equipe: 'sites', echecsConsecutifs: s.gardeEchecsConsecutifs }), true);
  assert.equal(M.estCritique({ type: 'remontee-critique', remonteeId: 'r', equipe: 'sites', gravite: 'haute' }), false);
});
await dit('les préférences : défaut complet, champs inconnus ignorés, e-mail douteux refusé', () => {
  const p = M.normaliserPreferences({ canaux: { email: false, sms: true }, types: { 'site-muet': false }, email: 'pas une adresse' });
  assert.deepEqual(p.canaux, { notification: true, email: false });
  assert.equal(p.types['site-muet'], false);
  assert.equal(p.types.escalade, true);
  assert.equal(p.email, null);
  assert.deepEqual(M.normaliserPreferences(null), M.PREFERENCES_ALERTES_DEFAUT);
});
await dit('les canaux : rien sous le seuil, rien pour un type coupé', () => {
  const muet = { type: 'site-muet', siteId: 's', muetDepuisMinutes: 60 };
  assert.deepEqual(M.canauxPour(muet, M.PREFERENCES_ALERTES_DEFAUT), ['notification', 'email']);
  assert.deepEqual(M.canauxPour(muet, M.normaliserPreferences({ types: { 'site-muet': false } })), []);
  assert.deepEqual(M.canauxPour({ ...muet, muetDepuisMinutes: 1 }, M.PREFERENCES_ALERTES_DEFAUT), []);
  assert.equal(M.cleDAlerte(muet), 'site-muet:s');
  assert.equal(M.TYPES_ALERTE_CRITIQUE.length, Object.keys(M.PREFERENCES_ALERTES_DEFAUT.types).length);
});

/* ── 6. La carte ─────────────────────────────────────────────────────────── */
console.log('\nGarde visible — la carte\n');

await dit('les sites : même place à chaque fois, dans le cadre, sans NaN', () => {
  const C = M.carte;
  const sites = Array.from({ length: 150 }, (_, i) => ({ id: `s${i}`, name: `Site ${String(i).padStart(3, '0')}` }));
  const a = C.placesDesSites(sites);
  const b = C.placesDesSites([...sites].reverse());
  assert.deepEqual(a.map((x: any) => [x.site.id, x.p]), b.map((x: any) => [x.site.id, x.p]));
  for (const { p } of a) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= C.LARGEUR && p.y >= 0 && p.y <= C.HAUTEUR, JSON.stringify(p));
});
await dit('les quartiers et les gardes : sans NaN, pour 1 à 12 équipes et 0 à 6 gardes', () => {
  const C = M.carte;
  for (let n = 1; n <= 12; n += 1) {
    for (let i = 0; i < n; i += 1) {
      const q = C.quartier(i, n);
      assert.ok(!/NaN/.test(C.cheminQuartier(q.debut, q.fin)));
      for (let g = 0; g <= 6; g += 1) for (const p of C.pointsDAgents(g, q.debut, q.fin)) assert.ok(Number.isFinite(p.x + p.y));
      const lien = C.cheminLien(q.milieu, i, C.polaire(300, q.milieu + 170));
      assert.ok(!/NaN/.test(lien), lien);
    }
  }
});

/* ── 7. L'isolement ──────────────────────────────────────────────────────── */
console.log('\nGarde visible — isolement et sobriété\n');

function fichiers(d: string): string[] {
  return fs.readdirSync(path.join(racine, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? fichiers(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []));
}
const tous = fichiers('src');
const importeurs = (motif: RegExp) => tous.filter((f) => motif.test(lire(f)));

await dit('src/refonte/garde n’est importé que depuis l’édition interne', () => {
  const autorises = (f: string) => f.startsWith('src/refonte/garde/') || f.startsWith('src/bureaux/') || f === 'src/components/IdleScreensaver.tsx';
  for (const f of importeurs(/from '[./]*\/?refonte\/garde\//)) assert.ok(autorises(f), `${f} importe src/refonte/garde`);
  for (const f of importeurs(/from '\.\/IdleScreensaver'|from '.*\/IdleScreensaver'/)) assert.equal(f, 'src/components/AppLayout.tsx', `${f} importe IdleScreensaver`);
  for (const f of importeurs(/from '\.\.\/components\/AppLayout'|from '\.\/AppLayout'/)) assert.ok(f.endsWith('.internal.tsx'), `${f} importe AppLayout`);
  for (const f of importeurs(/from '\.\.\/bureaux\/routes'|from '\.\/routes'/).filter((f) => !f.startsWith('src/bureaux/'))) assert.ok(f.endsWith('.internal.tsx') || f === 'src/components/AppLayout.tsx', `${f} importe les routes des bureaux`);
  const sansCommentaires = (f: string) => lire(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const f of tous.filter((x) => /\.business\.tsx?$/.test(x) || x.startsWith('src/business/'))) assert.ok(!/refonte\/garde|IdleScreensaver|bureaux\/routes/.test(sansCommentaires(f)), `${f}`);
});
await dit('la Garde visible ne charge rien du réseau pour s’afficher', () => {
  for (const f of fichiers('src/refonte/garde')) {
    const s = lire(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/https?:\/\//.test(s), `${f} : une URL`);
    assert.ok(!/<img|<image|fetch\(|new Image|XMLHttpRequest/.test(s), `${f} : une ressource distante`);
    assert.ok(!/from '(three|leaflet|mapbox-gl|maplibre-gl|d3[^']*)'/.test(s), `${f} : une librairie lourde`);
  }
});
await dit('la salle respecte le réglage Mouvement : elle ne respire qu’en « complet »', () => {
  for (const f of ['src/refonte/garde/SalleDeSituation.tsx', 'src/refonte/garde/FilDActivite.tsx']) {
    const s = lire(f);
    assert.ok(/useMouvement\(\) === 'complet'/.test(s), `${f} ne lit pas useMouvement`);
    for (const m of s.matchAll(/sv-souffle-(calme|tendu)|CLASSE_SOUFFLE :/g)) {
      const avant = s.slice(Math.max(0, (m.index ?? 0) - 120), m.index);
      assert.ok(/anime/.test(avant), `${f} : une respiration hors de la condition « anime »`);
    }
  }
});

console.log('');
if (echecs) {
  console.error(`ÉCHEC — ${echecs} propriété(s) de la Garde visible ne tiennent pas.`);
  process.exit(1);
}
console.log(`OK — ${vus} propriétés de la Garde visible tiennent.`);
