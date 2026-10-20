/**
 * Contrôle d'AJMANI ET DE L'ACCUEIL VIVANT (refonte S2) — sans navigateur, sans réseau.
 *
 *   1. LA PAROLE : chaque situation existe en fr et en en, avec au moins deux
 *      variantes par registre écrit ; 12 mots au plus par phrase, deux phrases
 *      au plus ; les mêmes paramètres dans les deux langues ; les alertes
 *      n'ont que le registre sérieux ; pas de morale.
 *   2. LE CHOIX : le registre est un plafond ; jamais deux fois de suite la
 *      même variante ; astuces 2 par jour, jamais une masquée ; réactions
 *      bornées ; la réplique de l'Accueil tient la journée ; un stockage
 *      abîmé ne casse rien.
 *   3. LES SCÈNES ET LE FIL : priorités, retouches du jour, ajouts refusés.
 *   4. LE DESSIN : chaque émotion a sa pose, des tracés interpolables, l'ambre
 *      réservé à l'alerte ; le regard borné, le clignement entre 3 et 6 s ;
 *      chaque émotion se rend hors navigateur, en mouvement « aucun ».
 *   5. LES ÉDITIONS : aucun fichier partagé n'importe `src/refonte/**`, le
 *      jumeau cliente de la couture n'importe rien d'Ajmani.
 *
 *   npm run check:ajmani
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

async function charger<T>(entree: string | { code: string }): Promise<T> {
  const construit = await esbuild.build({
    ...(typeof entree === 'string'
      ? { entryPoints: [path.join(racine, entree)] }
      : { stdin: { contents: entree.code, resolveDir: path.join(racine, 'scripts'), loader: 'tsx' as const } }),
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

/* Un hasard rejouable : les contrôles ne dépendent pas de la chance. */
function hasardFixe(graine = 7): () => number {
  let x = graine;
  return () => {
    x = (x * 16807) % 2147483647;
    return (x - 1) / 2147483646;
  };
}

type Registre = 'serieux' | 'chill' | 'taquin';
type Variantes = { serieux: readonly string[]; chill?: readonly string[]; taquin?: readonly string[] };
const P = await charger<{
  BIBLIOTHEQUE: Record<'fr' | 'en', Record<string, Variantes>>;
  SITUATIONS: string[];
  SITUATIONS_SERIEUSES: readonly string[];
  ASTUCES: readonly string[];
  compterMots: (s: string) => number;
  phrasesDe: (s: string) => string[];
  registreEffectif: (r: Registre, s: string, v: Variantes) => Registre;
}>('src/refonte/accueil/ajmani/phrases.ts');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Q = await charger<any>('src/refonte/accueil/ajmani/parole.ts');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const S = await charger<any>('src/refonte/accueil/scenes.ts');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const F = await charger<any>('src/refonte/accueil/filDuJour.ts');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const E = await charger<any>('src/refonte/accueil/ajmani/expressions.ts');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = await charger<any>('src/refonte/accueil/ajmani/regard.ts');
const { dureeLancement } = await charger<{ dureeLancement: (p: boolean, m: boolean, n: string) => number }>('src/refonte/accueil/dureeLancement.ts');

/* ── 1. La parole ─────────────────────────────────────────────────────────── */
console.log('\nAjmani — la parole\n');

const REGISTRES: Registre[] = ['serieux', 'chill', 'taquin'];
const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

await dit('chaque situation existe en fr et en en, avec 2 variantes au moins par registre écrit', () => {
  for (const langue of ['fr', 'en'] as const) {
    for (const s of P.SITUATIONS) {
      const v = P.BIBLIOTHEQUE[langue][s];
      assert.ok(v, `${langue} : situation « ${s} » absente`);
      for (const r of REGISTRES) {
        const liste = v[r];
        if (r === 'serieux') assert.ok(liste && liste.length >= 2, `${langue}/${s}/sérieux : moins de 2 variantes`);
        else if (liste) assert.ok(liste.length >= 2, `${langue}/${s}/${r} : moins de 2 variantes`);
      }
    }
  }
});

await dit('12 mots au plus par phrase, deux phrases au plus, et pas deux variantes identiques', () => {
  const fautes: string[] = [];
  for (const langue of ['fr', 'en'] as const) {
    for (const s of P.SITUATIONS) {
      for (const r of REGISTRES) {
        const liste = P.BIBLIOTHEQUE[langue][s][r] ?? [];
        if (new Set(liste).size !== liste.length) fautes.push(`${langue}/${s}/${r} : deux variantes identiques`);
        for (const replique of liste) {
          const phrases = P.phrasesDe(replique);
          if (phrases.length > 2) fautes.push(`${langue}/${s}/${r} : « ${replique} » a ${phrases.length} phrases`);
          for (const p of phrases) if (P.compterMots(p) > 12) fautes.push(`${langue}/${s}/${r} : « ${p} » a ${P.compterMots(p)} mots`);
        }
      }
    }
  }
  assert.deepEqual(fautes, []);
});

await dit('les paramètres sont les mêmes dans les deux langues, pour chaque variante', () => {
  for (const s of P.SITUATIONS) {
    const attendus = new Set(REGISTRES.flatMap((r) => (P.BIBLIOTHEQUE.en[s][r] ?? []).flatMap(params)));
    for (const langue of ['fr', 'en'] as const) {
      for (const r of REGISTRES) {
        for (const replique of P.BIBLIOTHEQUE[langue][s][r] ?? []) {
          for (const p of params(replique)) assert.ok(attendus.has(p), `${langue}/${s} : paramètre {${p}} inconnu de l'anglais`);
        }
      }
    }
  }
});

await dit('les alertes n’ont que le registre sérieux', () => {
  for (const langue of ['fr', 'en'] as const) {
    for (const s of P.SITUATIONS_SERIEUSES) {
      const v = P.BIBLIOTHEQUE[langue][s];
      assert.ok(!v.chill && !v.taquin, `${langue}/${s} porte un registre non sérieux`);
    }
  }
});

await dit('pas de morale ni de culpabilisation', () => {
  const morale = /\b(tu dois|tu devrais|il faut que|aurais dû|honte|you should|you must|should have|shame)\b/i;
  for (const langue of ['fr', 'en'] as const) {
    for (const s of P.SITUATIONS) {
      for (const r of REGISTRES) for (const replique of P.BIBLIOTHEQUE[langue][s][r] ?? []) assert.ok(!morale.test(replique), `${langue}/${s} : « ${replique} »`);
    }
  }
});

/* ── 2. Le choix ──────────────────────────────────────────────────────────── */
console.log('\nAjmani — quand et quoi dire\n');

await dit('le registre est un plafond, et l’alerte force le sérieux', () => {
  const v = P.BIBLIOTHEQUE.fr.relance;
  assert.equal(P.registreEffectif('serieux', 'relance', v), 'serieux');
  assert.equal(P.registreEffectif('chill', 'relance', v), 'chill');
  assert.equal(P.registreEffectif('taquin', 'relance', v), 'taquin');
  for (const s of P.SITUATIONS_SERIEUSES) assert.equal(P.registreEffectif('taquin', s, P.BIBLIOTHEQUE.fr[s]), 'serieux');
  const h = hasardFixe(3);
  let etat = Q.etatVide();
  for (let i = 0; i < 40; i++) {
    const r = Q.choisir(etat, 'fr', 'relance', 'chill', { nom: 'X', jours: 3 }, h);
    assert.notEqual(r.replique.registre, 'taquin', 'en Chill, jamais taquin');
    etat = r.etat;
  }
});

await dit('jamais deux fois de suite la même phrase, et toutes les variantes finissent par venir', () => {
  for (const s of ['matin.rdv', 'fete.facture', 'alerte.site']) {
    const h = hasardFixe(11);
    let etat = Q.etatVide();
    let avant = '';
    const vues = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const r = Q.choisir(etat, 'fr', s, 'chill', { n: 2, nom: 'Claire' }, h);
      assert.notEqual(r.replique.texte, avant, `${s} : « ${avant} » répétée`);
      avant = r.replique.texte;
      vues.add(r.replique.texte);
      etat = r.etat;
    }
    const total = (P.BIBLIOTHEQUE.fr[s][s.startsWith('alerte') ? 'serieux' : 'chill'] ?? []).length;
    assert.equal(vues.size, total, `${s} : ${vues.size} variantes vues sur ${total}`);
  }
});

await dit('astuces : deux par jour au plus, jamais une masquée, le compte repart le lendemain', () => {
  let etat = Q.etatVide();
  const a1 = Q.astuceDuMoment(etat, '2026-10-20');
  assert.ok(a1);
  etat = Q.noterAstuce(etat, '2026-10-20', a1);
  const a2 = Q.astuceDuMoment(etat, '2026-10-20');
  assert.ok(a2 && a2 !== a1);
  etat = Q.noterAstuce(etat, '2026-10-20', a2);
  assert.equal(Q.astuceDuMoment(etat, '2026-10-20'), null, 'une troisième astuce le même jour');
  etat = Q.masquerAstuce(etat, a1);
  for (let j = 21; j < 28; j++) {
    const a = Q.astuceDuMoment(etat, `2026-10-${j}`);
    assert.notEqual(a, a1, 'une astuce masquée revient');
  }
  for (const a of P.ASTUCES) etat = Q.masquerAstuce(etat, a);
  assert.equal(Q.astuceDuMoment(etat, '2026-11-01'), null);
});

await dit('réactions : 90 s au moins entre deux, 4 par jour au plus', () => {
  let etat = Q.etatVide();
  const t0 = Date.UTC(2026, 9, 20, 9);
  assert.equal(Q.peutReagir(etat, t0, 'j'), true);
  etat = Q.noterReaction(etat, t0, 'j');
  assert.equal(Q.peutReagir(etat, t0 + 30_000, 'j'), false);
  let t = t0;
  for (let i = 0; i < 3; i++) {
    t += 91_000;
    assert.equal(Q.peutReagir(etat, t, 'j'), true);
    etat = Q.noterReaction(etat, t, 'j');
  }
  assert.equal(Q.peutReagir(etat, t + 200_000, 'j'), false, 'une cinquième réaction le même jour');
  assert.equal(Q.peutReagir(etat, t + 200_000, 'j2'), true);
});

await dit('la réplique de l’Accueil tient la journée et la scène', () => {
  let etat = Q.etatVide();
  const a = Q.repliqueDuJour(etat, '2026-10-20', 'matin', 'fr', 'matin.libre', 'chill', {}, hasardFixe(5));
  etat = a.etat;
  for (let i = 0; i < 5; i++) {
    const b = Q.repliqueDuJour(etat, '2026-10-20', 'matin', 'fr', 'matin.libre', 'chill', {}, hasardFixe(i + 20));
    assert.equal(b.texte, a.texte);
    assert.equal(b.etat, etat, 'relire la réplique ne doit rien écrire');
  }
  const lendemain = Q.repliqueDuJour(etat, '2026-10-21', 'matin', 'fr', 'matin.libre', 'chill', {}, hasardFixe(5));
  assert.notEqual(lendemain.texte, a.texte, 'le lendemain, une autre variante');
  assert.ok(Object.keys(lendemain.etat.repliques).every((k: string) => k.startsWith('2026-10-21|')), 'les répliques de la veille sont oubliées');
});

await dit('un stockage abîmé redevient un état vide', () => {
  for (const brut of [null, '', '{', 'null', '[]', '{"dites":5,"masquees":"x"}']) {
    const e = Q.relireEtat(brut);
    assert.ok(Array.isArray(e.masquees) && typeof e.dites === 'object' && e.dites !== null);
  }
});

/* ── 3. Les scènes et le fil ──────────────────────────────────────────────── */
console.log('\nAccueil — scènes et fil du jour\n');

const base = { heure: 10, compteVide: false, alerte: null, rdvAVenir: 0, premierRdv: null, relance: null, faitsAujourdhui: 0, restants: 0, module: 'les routines' };

await dit('l’ordre des scènes : neuf, alerte, soir, matin, calme', () => {
  assert.equal(S.choisirScene({ ...base, compteVide: true, alerte: { type: 'site' } }).scene, 'neuf');
  const alerte = S.choisirScene({ ...base, heure: 20, alerte: { type: 'facture', jours: 40 } });
  assert.equal(alerte.scene, 'alerte');
  assert.equal(alerte.emotion, 'alerte');
  assert.equal(alerte.situation, 'alerte.facture');
  assert.equal(S.choisirScene({ ...base, heure: 18, faitsAujourdhui: 3 }).scene, 'soir');
  assert.equal(S.choisirScene({ ...base, heure: 9, rdvAVenir: 2, premierRdv: 'Claire' }).situation, 'matin.rdv');
  assert.equal(S.choisirScene({ ...base, heure: 9, rdvAVenir: 1, premierRdv: 'Claire' }).situation, 'matin.rdv1');
  assert.equal(S.choisirScene({ ...base, heure: 14 }).situation, 'calme.module');
  assert.equal(S.choisirScene({ ...base, heure: 14, relance: { nom: 'Dupont', jours: 12 } }).situation, 'relance');
  assert.equal(S.choisirScene({ ...base, heure: 14, module: null }).situation, 'calme.rien');
});

await dit('tard le soir il est fatigué, sauf en alerte', () => {
  assert.equal(S.choisirScene({ ...base, heure: 22, faitsAujourdhui: 2 }).emotion, 'fatigue');
  assert.equal(S.choisirScene({ ...base, heure: 23 }).situation, 'tard');
  assert.equal(S.choisirScene({ ...base, heure: 23, alerte: { type: 'site' } }).emotion, 'alerte');
});

const lib = { relancer: (n: string) => `Relancer ${n}`, retard: (j: number) => `${j} j`, enCours: 'en cours', aFaire: 'à faire' };
const sources = {
  alertes: [{ cle: 'incident:1', titre: 'Site tombé', detail: '5 min', vers: '/sites' }],
  rdv: [
    { id: 'b', titre: 'Point', quand: '2026-10-20T14:00:00Z', heure: '14:00' },
    { id: 'a', titre: 'Café', quand: '2026-10-20T09:00:00Z', heure: '09:00' },
  ],
  factures: [
    { id: 'f1', nom: 'Dupont', jours: 3 },
    { id: 'f2', nom: 'Martin', jours: 12 },
  ],
  taches: [
    { id: 1, titre: 'Écrire', enCours: false },
    { id: 2, titre: 'Relire', enCours: true },
  ],
};

await dit('le fil automatique : alertes, rendez-vous par heure, relances par retard, tâches en cours d’abord', () => {
  const fil = F.construireFil(sources, lib);
  assert.deepEqual(
    fil.map((l: { cle: string }) => l.cle),
    ['alerte:incident:1', 'rdv:a', 'rdv:b', 'facture:f2', 'facture:f1', 'tache:2', 'tache:1'],
  );
});

await dit('les retouches : fait en bas, masqué compté, ajout à soi, et celles d’hier ignorées', () => {
  const fil = F.construireFil(sources, lib);
  let r = F.retouchesVides('2026-10-20');
  r = F.basculerFait(r, '2026-10-20', 'rdv:a');
  r = F.masquer(r, '2026-10-20', 'tache:1');
  r = F.ajouter(r, '2026-10-20', '  Appeler   le comptable ', 'x');
  const { visibles, masquees } = F.appliquerRetouches(fil, r, '2026-10-20');
  assert.equal(masquees, 1);
  assert.equal(visibles[visibles.length - 1].cle, 'rdv:a');
  assert.equal(visibles[visibles.length - 1].fait, true);
  assert.ok(visibles.some((l: { titre: string }) => l.titre === 'Appeler le comptable'));
  assert.equal(F.troisChoses(visibles).length, 3);
  const demain = F.appliquerRetouches(fil, r, '2026-10-21');
  assert.equal(demain.masquees, 0);
  assert.ok(demain.visibles.every((l: { fait: boolean }) => !l.fait));
  assert.equal(F.ajouter(r, '2026-10-20', '   ', 'y').ajouts.length, 1, 'un ajout vide est refusé');
  assert.equal(F.ajouter(r, '2026-10-20', 'x'.repeat(141), 'z').ajouts.length, 1, 'un ajout trop long est refusé');
});

/* ── 4. Le dessin ─────────────────────────────────────────────────────────── */
console.log('\nAjmani — le dessin\n');

const forme = (d: string) => d.replace(/-?\d+(\.\d+)?/g, '#');

await dit('dix émotions, chacune une pose ; l’ambre réservé à l’alerte', () => {
  assert.equal(E.EMOTIONS.length, 10);
  for (const e of E.EMOTIONS) {
    assert.ok(E.POSES[e], `pose « ${e} » absente`);
    assert.equal(E.POSES[e].lumiere === 'ambre', e === 'alerte', `${e} : lumière ${E.POSES[e].lumiere}`);
  }
});

await dit('les tracés des yeux et de la bouche gardent la même forme d’une pose à l’autre (interpolables)', () => {
  const formes = new Set<string>();
  const bouches = new Set<string>();
  for (const e of E.EMOTIONS) {
    const p = E.POSES[e];
    for (const pp of [p, E.poseCligne(p)]) {
      formes.add(forme(E.decoupeOeil(E.OEIL.gaucheX, pp.oeilG, pp.pente, -1, pp.echelleYeux)));
      formes.add(forme(E.decoupeOeil(E.OEIL.droitX, pp.oeilD, pp.pente, 1, pp.echelleYeux)));
    }
    bouches.add(forme(E.traceBouche(p.bouche)));
  }
  assert.equal(formes.size, 1, [...formes].join('\n'));
  assert.equal(bouches.size, 1, [...bouches].join('\n'));
});

await dit('l’ambre du visage est celui du signal (src/index.css)', async () => {
  const { TEINTES_AJMANI } = await charger<{ TEINTES_AJMANI: { visageAlerte: string } }>('src/refonte/accueil/ajmani/briques/commun.ts');
  const m = fs.readFileSync(path.join(racine, 'src/index.css'), 'utf8').match(/--color-signal:\s*(#[0-9a-fA-F]{6})/);
  assert.ok(m, '--color-signal introuvable');
  assert.equal(TEINTES_AJMANI.visageAlerte.toLowerCase(), m[1].toLowerCase());
});

await dit('un œil fermé ne laisse rien voir', () => {
  const d: string = E.decoupeOeil(80, { haut: 0.5, bas: 0.5 }, 0, -1, 1);
  const ys = [...d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[2]));
  assert.ok(Math.max(...ys) - Math.min(...ys) < 0.5, d);
});

await dit('le regard reste dans l’écran, le clignement tombe entre 3 et 6 s', () => {
  for (const [sx, sy] of [[0, 0], [5000, 0], [-5000, 9000], [100, 101], [Number.NaN, 3]]) {
    const d = R.decalageRegard({ x: 100, y: 100 }, { x: sx, y: sy });
    assert.ok(Math.abs(d.x) <= R.REGARD_MAX.x && Math.abs(d.y) <= R.REGARD_MAX.y, JSON.stringify(d));
  }
  for (const h of [0, 0.5, 0.9999, 1, -1]) {
    const ms = R.delaiClignement(() => h);
    assert.ok(ms >= 3000 && ms < 6000, String(ms));
  }
});

await dit('le lancement : ~2 s la première fois, moins d’1 s ensuite, plus court si modeste ou réduit', () => {
  assert.ok(dureeLancement(true, false, 'complet') >= 1800 && dureeLancement(true, false, 'complet') <= 2200);
  assert.ok(dureeLancement(false, false, 'complet') < 1000);
  assert.ok(dureeLancement(true, true, 'complet') < dureeLancement(true, false, 'complet'));
  assert.ok(dureeLancement(true, false, 'reduit') <= 1000);
  assert.ok(dureeLancement(true, false, 'aucun') <= 500);
});

await dit('chaque émotion se rend hors navigateur ; décoratif sans titre, image avec', async () => {
  const { rendre } = await charger<{ rendre: (props: Record<string, unknown>) => string }>({
    code: [
      "import { createElement as h } from 'react';",
      "import { renderToStaticMarkup } from 'react-dom/server.browser';",
      "import { Ajmani } from '../src/refonte/accueil/ajmani/Ajmani';",
      'export const rendre = (props) => renderToStaticMarkup(h(Ajmani, props));',
    ].join('\n'),
  });
  for (const e of E.EMOTIONS) {
    const html = rendre({ emotion: e, mouvement: 'aucun' });
    assert.ok(html.startsWith('<svg') && html.includes('aria-hidden="true"'), `${e} : ${html.slice(0, 80)}`);
    assert.ok(!html.includes('tabindex'), `${e} : le dessin ne doit pas être focalisable`);
  }
  const titre = rendre({ emotion: 'content', titre: 'Ajmani', mouvement: 'aucun', cadrage: 'tete' });
  assert.ok(titre.includes('role="img"') && titre.includes('aria-label="Ajmani"'));
});

/* ── 5. Les éditions ──────────────────────────────────────────────────────── */
console.log('\nAccueil vivant — séparation des éditions\n');

function fichiers(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(path.join(racine, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...fichiers(rel));
    else if (/\.tsx?$/.test(e.name)) out.push(rel);
  }
  return out;
}
const importsDe = (src: string) => [...src.matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);

await dit('aucun fichier partagé n’importe src/refonte/** (seuls les fichiers .internal le peuvent)', () => {
  const fautes: string[] = [];
  for (const f of fichiers('src')) {
    const n = f.split(path.sep).join('/');
    if (n.startsWith('src/refonte/') || /\.internal\.tsx?$/.test(n)) continue;
    for (const i of importsDe(fs.readFileSync(path.join(racine, f), 'utf8'))) if (/(^|\/)refonte\//.test(i)) fautes.push(`${n} importe ${i}`);
  }
  assert.deepEqual(fautes, []);
});

await dit('le jumeau cliente de la couture n’importe ni Ajmani, ni le socle, ni la refonte', () => {
  for (const f of ['src/edition/vivant.business.tsx', 'src/edition/socle.business.tsx']) {
    const src = fs.readFileSync(path.join(racine, f), 'utf8');
    for (const i of importsDe(src)) assert.ok(!/refonte|socle\/|ajmani/i.test(i), `${f} importe ${i}`);
    assert.ok(!/Ajmani/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), `${f} cite Ajmani dans son code`);
  }
});

await dit('les émissions partagées passent par la couture, jamais par le bus directement', () => {
  for (const f of ['src/state/useInvoices.ts', 'src/state/useClients.ts']) {
    const imp = importsDe(fs.readFileSync(path.join(racine, f), 'utf8'));
    assert.ok(imp.includes('@edition/socle'), `${f} n'importe pas @edition/socle`);
    assert.ok(!imp.some((i) => /socle\/moments/.test(i)), `${f} importe le bus directement`);
  }
});

console.log(`\n${echecs ? `✗ ${echecs} échec(s)` : '✓'} check:ajmani — ${vus} contrôles passés.\n`);
process.exit(echecs ? 1 : 0);
