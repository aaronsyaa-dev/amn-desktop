/**
 * Contrôle d'AJMANI ET DE L'ACCUEIL DE LA REFONTE (S2 recadrée) — sans navigateur, sans réseau.
 *
 *   0. LE VOUVOIEMENT : aucun « tu », « ton », « ta », « tes », « toi », « t’ » dans
 *      les textes français de la zone (décision de Harun, 2026-10-22).
 *   1. LA PAROLE : chaque situation existe en fr et en en, avec au moins deux
 *      variantes par registre écrit ; 12 mots au plus par phrase, deux phrases
 *      au plus ; les mêmes paramètres dans les deux langues ; les alertes
 *      n'ont que le registre sérieux ; pas de morale ; pas de corps (Ajmani
 *      n'est plus un personnage : ni antenne, ni écran-visage, ni bras).
 *   2. LE CHOIX : le registre est un plafond ; jamais deux fois de suite la
 *      même variante ; astuces 2 par jour, jamais une masquée ; toasts
 *      bornés ; le message de l'Accueil tient la journée ; un stockage abîmé
 *      ne casse rien.
 *   3. L'ACCUEIL : les tuiles n'existent que si leur donnée existe ; le fil
 *      « Aujourd'hui » (cases réelles, retouches du poste, responsables) ;
 *      le seul bouton blanc ; l'activité de l'équipe et ses jalons ; la série.
 *   4. LE NOIR ET GRIS : les jetons du socle redéfinis par `ambiance.css`
 *      gardent les contrastes du socle ; le lancement reste court.
 *   5. PLUS DE PERSONNAGE NI DE BARRE LATÉRALE (une seule navigation, celle de S1) : aucune brique de dessin ne revient dans la zone.
 *   6. LES ÉDITIONS : aucun fichier partagé n'importe `src/refonte/accueil/**`, le
 *      jumeau cliente de la couture n'importe rien de la refonte.
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
const T = await charger<any>('src/refonte/accueil/tuiles.ts');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const A = await charger<any>('src/refonte/accueil/activite.ts');
const { remplir, nomsDeParametres } = await charger<{
  remplir: (m: string, p?: Record<string, string | number>, l?: 'fr' | 'en') => string;
  nomsDeParametres: (m: string) => string[];
}>('src/refonte/accueil/modele.ts');
const { etatDeLAccueil, raccourciAssistant } = await charger<{
  etatDeLAccueil: (s: { ready: boolean; pullFailed: boolean }) => string;
  raccourciAssistant: (p: string) => string;
}>('src/refonte/accueil/etat.ts');
const { DICTIONNAIRES_ACCUEIL } = await charger<{ DICTIONNAIRES_ACCUEIL: Record<'fr' | 'en', Record<string, string>> }>('src/refonte/accueil/i18n.ts');
const { dureeLancement } = await charger<{ dureeLancement: (p: boolean, m: boolean, n: string) => number }>('src/refonte/accueil/dureeLancement.ts');

/* ── 1. La parole ─────────────────────────────────────────────────────────── */
console.log('\nAjmani — la parole\n');

const REGISTRES: Registre[] = ['serieux', 'chill', 'taquin'];
const params = nomsDeParametres;
/* Le pire cas d'un paramètre : un nom composé, un module de quatre mots, des nombres à deux chiffres. */
const PIRE = { n: 12, nom: 'Claire Dupuis', jours: 40, faits: 12, restants: 12, raccourci: 'Ctrl+J' };
const pire = (langue: 'fr' | 'en') => ({ ...PIRE, module: langue === 'fr' ? 'le journal de bord' : 'the weekly review' });

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
          const phrases = P.phrasesDe(remplir(replique, pire(langue), langue));
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

await dit('le français vouvoie : aucun tu, ton, ta, tes, toi, t’ dans la bibliothèque ni dans les mots de l’Accueil', () => {
  const tutoiement = /(?<![\p{L}])(tu|toi|ton|ta|tes|te)(?![\p{L}])|(?<![\p{L}])t['’](?=\p{L})/iu;
  const impératifs = /(?<![\p{L}])(Ajoute|Prévois|Fais|Choisis|Coche|Appuie|Maintiens|Profite|Modifie|Pose|Dis|Viens|Regarde|Pense|Va|Marre de taper)(?![\p{L}])/u;
  // « mon ton », « le ton d’Ajmani » : la tonalité, pas le pronom.
  const sansTonalite = (t: string) => t.replace(/(mon|le|du|son|ce|au) ton(?![\p{L}])/giu, '$1 TONALITE').replace('Marre de taper ?', '');
  const fautes: string[] = [];
  for (const s of P.SITUATIONS) {
    for (const r of REGISTRES) {
      for (const replique of P.BIBLIOTHEQUE.fr[s][r] ?? []) {
        if (tutoiement.test(sansTonalite(replique)) || impératifs.test(sansTonalite(replique))) fautes.push(`phrases fr/${s}/${r} : « ${replique} »`);
      }
    }
  }
  for (const [cle, texte] of Object.entries(DICTIONNAIRES_ACCUEIL.fr)) if (tutoiement.test(sansTonalite(texte)) || impératifs.test(sansTonalite(texte))) fautes.push(`i18n fr/${cle} : « ${texte} »`);
  assert.deepEqual(fautes, []);
});

await dit('les mots de l’Accueil : mêmes paramètres en français et en anglais, aucune clé orpheline', () => {
  const { fr, en } = DICTIONNAIRES_ACCUEIL;
  assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort());
  for (const cle of Object.keys(en)) assert.deepEqual(nomsDeParametres(fr[cle]), nomsDeParametres(en[cle]), cle);
});

await dit('le pluriel s’accorde : « 1 jour », « 2 jours » ; 0 est singulier en français, pluriel en anglais', () => {
  assert.equal(remplir('{n#jour|jours}', { n: 1 }), '1 jour');
  assert.equal(remplir('{n#jour|jours}', { n: 0 }), '0 jour');
  assert.equal(remplir('{n#jour|jours}', { n: 2 }), '2 jours');
  assert.equal(remplir('{n#day|days}', { n: 0 }, 'en'), '0 days');
  assert.equal(remplir('{n#day|days}', { n: 1 }, 'en'), '1 day');
  assert.equal(remplir('Il reste {n#chose faite|choses faites}', { n: 3 }), 'Il reste 3 choses faites');
  assert.equal(remplir('{inconnu#a|b}', {}), '{inconnu#a|b}', 'un paramètre manquant reste visible');
  const relance = P.BIBLIOTHEQUE.fr.relance.serieux.map((m: string) => remplir(m, { nom: 'Dupont', jours: 1 }));
  assert.ok(relance.every((t: string) => /\b1 jour\b/.test(t) && !/1 jours/.test(t)), relance.join(' | '));
});

await dit('le raccourci suit la plateforme : ⌘J sur Mac, Ctrl+J ailleurs', () => {
  assert.equal(raccourciAssistant('MacIntel'), '⌘J');
  assert.equal(raccourciAssistant('iPhone'), '⌘J');
  assert.equal(raccourciAssistant('Win32'), 'Ctrl+J');
  assert.equal(raccourciAssistant('Linux x86_64'), 'Ctrl+J');
  assert.equal(raccourciAssistant(''), 'Ctrl+J');
});

await dit('pas de corps : Ajmani n’est plus un personnage', () => {
  const corps = /\b(antenne|antenna|télé|TV|pixels?|bras|arms|danse|dance|ma tête|my head|mon visage|my face)\b/i;
  for (const langue of ['fr', 'en'] as const) {
    for (const s of P.SITUATIONS) {
      for (const r of REGISTRES) for (const replique of P.BIBLIOTHEQUE[langue][s][r] ?? []) assert.ok(!corps.test(replique), `${langue}/${s} : « ${replique} »`);
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

await dit('toasts : 90 s au moins entre deux, 4 par jour au plus', () => {
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

await dit('le message de l’Accueil tient la journée et la scène', () => {
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

/* ── 3. L'Accueil ─────────────────────────────────────────────────────────── */
console.log('\nAccueil — scènes, tuiles, Aujourd’hui, activité\n');

const base = { heure: 10, compteVide: false, alerte: null, rdvAVenir: 0, premierRdv: null, relance: null, faitsAujourdhui: 0, restants: 0, module: 'les routines' };

await dit('le message suit le moment : neuf, alerte, soir, matin, calme', () => {
  assert.equal(S.choisirScene({ ...base, compteVide: true, alerte: { type: 'site' } }).scene, 'neuf');
  const alerte = S.choisirScene({ ...base, heure: 20, alerte: { type: 'facture', jours: 40 } });
  assert.equal(alerte.scene, 'alerte');
  assert.equal(alerte.situation, 'alerte.facture');
  assert.equal(S.choisirScene({ ...base, heure: 18, faitsAujourdhui: 3 }).situation, 'soir.recap');
  assert.equal(S.choisirScene({ ...base, heure: 23 }).situation, 'tard');
  assert.equal(S.choisirScene({ ...base, heure: 9, rdvAVenir: 2, premierRdv: 'Claire' }).situation, 'matin.rdv');
  assert.equal(S.choisirScene({ ...base, heure: 9, rdvAVenir: 1, premierRdv: 'Claire' }).situation, 'matin.rdv1');
  assert.equal(S.choisirScene({ ...base, heure: 14 }).situation, 'calme.module');
  assert.equal(S.choisirScene({ ...base, heure: 14, relance: { nom: 'Dupont', jours: 12 } }).situation, 'relance');
  assert.equal(S.choisirScene({ ...base, heure: 14, module: null }).situation, 'calme.rien');
  assert.ok(!('emotion' in alerte) && !('geste' in alerte), 'plus d’émotion ni de geste : il n’y a plus de personnage');
});

const maintenant = new Date(2026, 9, 22, 10, 0, 0);
const facture = (o: Record<string, unknown>) => ({ kind: 'invoice', status: 'issued', paidAt: '', brutCents: 0, duCents: 0, enRetard: false, ...o });

await dit('pas de donnée, pas de tuile : jamais un zéro inventé', () => {
  assert.deepEqual(T.calculerTuiles({ pret: false, maintenant, factures: [facture({ status: 'paid', paidAt: '2026-10-02', brutCents: 100 })], taches: [{ status: 'todo' }], objectif: 'X' }), [], 'avant la synchronisation, rien');
  assert.deepEqual(T.calculerTuiles({ pret: true, maintenant, factures: [], taches: [], objectif: null }), [], 'compte vide, aucune tuile');
  assert.deepEqual(
    T.calculerTuiles({ pret: true, maintenant, factures: [facture({ status: 'draft' }), facture({ kind: 'creditNote', status: 'issued' })], taches: [], objectif: '   ' }),
    [],
    'un brouillon, un avoir ou un objectif vide ne font pas une tuile',
  );
});

await dit('les tuiles disent les vrais chiffres', () => {
  const tuiles = T.calculerTuiles({
    pret: true,
    maintenant,
    factures: [
      facture({ status: 'paid', paidAt: '2026-10-03', brutCents: 120000 }),
      facture({ status: 'paid', paidAt: '2026-09-20', brutCents: 100000 }),
      facture({ status: 'issued', brutCents: 50000, duCents: 50000, enRetard: true }),
      facture({ status: 'issued', brutCents: 30000, duCents: 30000 }),
      facture({ status: 'issued', brutCents: 9000, duCents: 0 }),
    ],
    taches: [{ status: 'todo' }, { status: 'doing' }, { status: 'done', updatedAt: '2026-10-20T09:00:00Z' }, { status: 'done', updatedAt: '2026-10-10T09:00:00Z' }],
    objectif: 'Signer deux devis',
  });
  const par = Object.fromEntries(tuiles.map((t: { cle: string }) => [t.cle, t]));
  assert.deepEqual(Object.keys(par), ['ca', 'attente', 'equipe', 'objectif']);
  assert.equal(par.ca.cents, 120000);
  assert.equal(par.ca.moisPrecedentCents, 100000);
  assert.equal(T.evolution(120000, 100000), 20);
  assert.equal(T.evolution(120000, null), null);
  assert.deepEqual([par.attente.nombre, par.attente.cents, par.attente.enRetard], [2, 80000, 1]);
  assert.deepEqual([par.equipe.ouvertes, par.equipe.enCours, par.equipe.faitesSemaine], [2, 1, 1]);
  assert.equal(par.objectif.texte, 'Signer deux devis');
  assert.equal(T.lundiDe(maintenant), '2026-10-19');
});

await dit('la série : jours consécutifs, depuis aujourd’hui ou hier ; moins de 2, pas de pastille', () => {
  assert.equal(T.meilleureSerie([{ ticks: ['2026-10-22', '2026-10-21', '2026-10-20'] }, { ticks: ['2026-10-21'] }], maintenant), 3);
  assert.equal(T.meilleureSerie([{ ticks: ['2026-10-21', '2026-10-20'] }], maintenant), 2, 'aujourd’hui pas encore coché');
  assert.equal(T.meilleureSerie([{ ticks: ['2026-10-22'] }], maintenant), 0);
  assert.equal(T.meilleureSerie([], maintenant), 0);
});

const lib = { enCours: 'en cours', aFaire: 'à faire', faite: 'faite', etapeClient: 'Client', etapeRdv: 'Rdv', etapeVisite: 'Visite' };
const sources = {
  moi: 'aaron@exemple.test',
  priorites: [
    { email: 'mohamed@exemple.test', id: 'p2', label: 'Appeler le notaire', fait: false },
    { email: 'aaron@exemple.test', id: 'p1', label: 'Finir le devis', fait: true },
  ],
  rdv: [
    { id: 'b', titre: 'Point', quand: '2026-10-22T14:00:00Z', heure: '14:00', fait: false },
    { id: 'a', titre: 'Café', quand: '2026-10-22T09:00:00Z', heure: '09:00', fait: true },
  ],
  taches: [
    { id: 't1', titre: 'Écrire', statut: 'todo', responsable: null },
    { id: 't2', titre: 'Relire', statut: 'doing', responsable: 'riyad@exemple.test' },
  ],
  etapes: null,
};

await dit('Aujourd’hui : priorités (les miennes d’abord), rendez-vous par heure, tâches en cours d’abord', () => {
  const fil = F.construireFil(sources, lib);
  assert.deepEqual(
    fil.map((l: { cle: string }) => l.cle),
    ['priorite:aaron@exemple.test:p1', 'priorite:mohamed@exemple.test:p2', 'rdv:a', 'rdv:b', 'tache:t2', 'tache:t1'],
  );
  const parCle = Object.fromEntries(fil.map((l: { cle: string }) => [l.cle, l]));
  assert.equal(parCle['priorite:aaron@exemple.test:p1'].case, 'donnee', 'ma priorité se coche dans la donnée');
  assert.equal(parCle['priorite:mohamed@exemple.test:p2'].case, 'lecture', 'celle d’un autre se lit');
  assert.equal(parCle['tache:t2'].case, 'donnee');
  assert.equal(parCle['tache:t2'].responsable, 'riyad@exemple.test');
  assert.equal(parCle['rdv:a'].responsable, null, 'un rendez-vous n’a pas de responsable enregistré : on n’en invente pas');
});

await dit('Aujourd’hui : « x sur y », fait en bas, masqué compté, ajout à soi, retouches d’hier ignorées', () => {
  const fil = F.construireFil(sources, lib);
  let r = F.retouchesVides('2026-10-22');
  r = F.masquer(r, '2026-10-22', 'tache:t1');
  r = F.ajouter(r, '2026-10-22', '  Appeler   le comptable ', 'x');
  r = F.basculerFait(r, '2026-10-22', 'perso:x');
  const { visibles, masquees, faits } = F.appliquerRetouches(fil, r, '2026-10-22', 'aaron@exemple.test');
  assert.equal(masquees, 1);
  assert.equal(visibles.length, 6);
  assert.equal(faits, 3, 'ma priorité faite, le café passé, ma ligne cochée');
  assert.ok(visibles.slice(-faits).every((l: { fait: boolean }) => l.fait), 'ce qui est fait descend en bas');
  const perso = visibles.find((l: { cle: string }) => l.cle === 'perso:x');
  assert.equal(perso.titre, 'Appeler le comptable');
  assert.equal(perso.case, 'poste');
  const demain = F.appliquerRetouches(fil, r, '2026-10-23', 'aaron@exemple.test');
  assert.equal(demain.masquees, 0);
  assert.equal(F.ajouter(r, '2026-10-22', '   ', 'y').ajouts.length, 1, 'un ajout vide est refusé');
  assert.equal(F.ajouter(r, '2026-10-22', 'x'.repeat(141), 'z').ajouts.length, 1, 'un ajout trop long est refusé');
});

await dit('compte vide : les trois étapes, avec leur état réel', () => {
  const fil = F.construireFil({ moi: 'a@b.c', priorites: [], rdv: [], taches: [], etapes: { client: true, rdv: false, visite: false } }, lib);
  assert.deepEqual(fil.map((l: { cle: string; fait: boolean }) => [l.cle, l.fait]), [['etape:client', true], ['etape:rdv', false], ['etape:visite', false]]);
});

await dit('le seul bouton blanc : le point critique, sinon la pire facture, sinon la prochaine chose à faire, sinon les priorités', () => {
  const fil = F.appliquerRetouches(F.construireFil(sources, lib), F.retouchesVides('j'), 'j', 'aaron@exemple.test').visibles;
  const retard = [{ nom: 'Dupont', jours: 3 }, { nom: 'Martin', jours: 40 }];
  assert.deepEqual(F.actionPrincipale({ titre: 'Site tombé', vers: '/sites' }, retard, fil), { cle: 'alerte', titre: 'Site tombé', vers: '/sites' });
  assert.deepEqual(F.actionPrincipale(null, retard, fil), { cle: 'relancer', nom: 'Martin', vers: '/relances' });
  assert.deepEqual(F.actionPrincipale(null, [], fil), { cle: 'ouvrir', titre: 'Appeler le notaire', vers: '/priorites' });
  assert.deepEqual(F.actionPrincipale(null, [], []), { cle: 'priorites', vers: '/priorites' });
  const premierJour = F.construireFil({ moi: 'a@b.c', priorites: [], rdv: [], taches: [], etapes: { client: false, rdv: false, visite: false } }, lib);
  assert.deepEqual(F.actionPrincipale(null, [], premierJour), { cle: 'commencer', titre: 'Client', vers: '/clients' }, 'le premier jour : on commence par l’étape suivante');
});

await dit('l’Accueil ne dit rien avant que les données aient répondu : chargement, hors ligne, prêt', () => {
  assert.equal(etatDeLAccueil({ ready: false, pullFailed: false }), 'chargement');
  assert.equal(etatDeLAccueil({ ready: false, pullFailed: true }), 'chargement');
  assert.equal(etatDeLAccueil({ ready: true, pullFailed: true }), 'hors-ligne');
  assert.equal(etatDeLAccueil({ ready: true, pullFailed: false }), 'pret');
  const src = fs.readFileSync(path.join(racine, 'src/refonte/accueil/AccueilVivant.tsx'), 'utf8');
  assert.ok(/a\.complet \? repliqueDuJour/.test(src), 'le message n’est choisi que lorsque tout a répondu');
  assert.ok(/!a\.complet \|\|/.test(src), 'aucune astuce avant');
  const hook = fs.readFileSync(path.join(racine, 'src/refonte/accueil/useAccueil.ts'), 'utf8');
  assert.ok(/pret: etat === 'pret'/.test(hook), 'pas de tuile calculée hors ligne');
  assert.ok(/compteVide = etat === 'pret'/.test(hook), 'un compte n’est « vide » que si la synchronisation a répondu');
});

await dit('un seul bouton primaire (blanc plein) dans tout l’Accueil', () => {
  const src = fs.readFileSync(path.join(racine, 'src/refonte/accueil/AccueilVivant.tsx'), 'utf8');
  assert.equal((src.match(/variante="primaire"/g) ?? []).length, 1);
});

await dit('l’activité de l’équipe : journal, modifications et jalons, du plus récent au plus ancien', () => {
  const fil = A.filDActivite(
    {
      evenements: [{ key: 'e1', routeKey: '/tasks', noun: 'Tâche', text: 'Relire le devis', actorEmail: 'riyad@exemple.test', at: '2026-10-22T08:00:00Z' }],
      journal: [
        { id: 'j1', text: 'On ferme le lundi', kind: 'decision', byEmail: 'aaron@exemple.test', at: '2026-10-21T17:00:00Z' },
        { id: 'j2', text: '   ', kind: 'note', byEmail: 'x', at: '2026-10-22T09:00:00Z' },
      ],
      encaissements: [{ id: 'f1', numero: 'F-2026-012', paidAt: '2026-10-22' }],
      clients: [{ id: 'c1', nom: 'Atelier Moreau', createdAt: '2026-10-20T10:00:00Z' }],
      familleDeRoute: () => 'jour',
    },
    { modif: (n: string, t: string) => `${n} : ${t}`, encaissee: (n: string) => `Facture ${n} encaissée`, client: (n: string) => `Nouveau client : ${n}` },
  );
  assert.deepEqual(
    fil.map((l: { cle: string; type: string }) => [l.cle, l.type]),
    [['evt:e1', 'modif'], ['paye:f1', 'jalon'], ['journal:j1', 'jalon'], ['client:c1', 'jalon']],
  );
  assert.equal(A.filDActivite({ evenements: [], journal: [], encaissements: [], clients: [], familleDeRoute: () => 'jour' }, { modif: () => '', encaissee: () => '', client: () => '' }).length, 0, 'rien de réel, rien affiché');
});

/* ── 4. Le noir et gris ───────────────────────────────────────────────────── */
console.log('\nAccueil — fond noir et gris, lancement\n');

function lum(hex: string): number {
  const v = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const ambiance = fs.readFileSync(path.join(racine, 'src/refonte/accueil/ambiance.css'), 'utf8');
const jeton = (nom: string) => {
  const m = ambiance.match(new RegExp(`--color-${nom}:\\s*(#[0-9a-fA-F]{6})`));
  assert.ok(m, `--color-${nom} absent de ambiance.css`);
  return m[1];
};

await dit('les valeurs validées par Harun', () => {
  assert.equal(jeton('socle-fond').toLowerCase(), '#0c0c0d');
  assert.equal(jeton('bg').toLowerCase(), '#0c0c0d');
  assert.equal(jeton('socle-surface').toLowerCase(), '#131314');
  assert.equal(jeton('socle-eleve').toLowerCase(), '#161617');
  assert.equal(jeton('socle-bord').toLowerCase(), '#232325');
  assert.equal(jeton('socle-texte').toLowerCase(), '#ededed');
  assert.equal(jeton('socle-texte-doux').toLowerCase(), '#8a8a8e');
});

await dit('les contrastes du socle tiennent sur le noir et gris', () => {
  const surfaces = ['socle-fond', 'socle-creux', 'socle-surface', 'socle-eleve', 'socle-survol'].map(jeton);
  for (const s of surfaces) {
    for (const encre of ['socle-texte', 'socle-texte-doux', 'socle-texte-discret']) assert.ok(ratio(jeton(encre), s) >= 4.5, `${encre} sur ${s} : ${ratio(jeton(encre), s).toFixed(2)}`);
    assert.ok(ratio(jeton('socle-bord-fort'), s) >= 3, `bord-fort sur ${s}`);
    assert.ok(ratio(jeton('socle-focus'), s) >= 3, `focus sur ${s}`);
  }
  assert.ok(ratio(jeton('socle-primaire-encre'), jeton('socle-primaire')) >= 4.5, 'encre du bouton blanc');
  assert.ok(ratio(jeton('socle-primaire-encre'), jeton('socle-primaire-survol')) >= 4.5, 'encre du bouton blanc au survol');
  // Les points de famille, sur ces surfaces : ≥ 3:1 (un trait, WCAG 1.4.11).
  const feuille = fs.readFileSync(path.join(racine, 'src/index.css'), 'utf8');
  for (const f of ['jour', 'contacts', 'ecrire', 'argent', 'echanger', 'creer', 'outils']) {
    const m = feuille.match(new RegExp(`--color-fam-${f}:\\s*(#[0-9a-fA-F]{6})`));
    assert.ok(m, `famille ${f}`);
    for (const s of surfaces) assert.ok(ratio(m[1], s) >= 3, `point ${f} sur ${s}`);
  }
});

await dit('l’ambiance ne vit que côté interne : ni index.css ni le jumeau cliente ne la chargent', () => {
  assert.ok(!fs.readFileSync(path.join(racine, 'src/index.css'), 'utf8').includes("data-ambiance"), 'index.css (partagé) ne doit pas porter l’ambiance');
  const business = fs.readFileSync(path.join(racine, 'src/edition/vivant.business.tsx'), 'utf8');
  assert.ok(!/ambiance\.css|@fontsource\/inter/.test(business));
});

await dit('Inter sur toute l’édition interne, chiffres tabulaires ; JetBrains Mono ne bouge pas ; rien dans la feuille partagée', () => {
  assert.ok(/--font-sans:\s*'Inter'/.test(ambiance), '--font-sans doit valoir Inter sous data-ambiance');
  assert.ok(/body\s*\{[^}]*font-variant-numeric:\s*tabular-nums/.test(ambiance));
  assert.ok(!/--font-mono/.test(ambiance));
  const composant = fs.readFileSync(path.join(racine, 'src/refonte/accueil/Ambiance.tsx'), 'utf8');
  for (const poids of ['400', '500', '600', '700']) assert.ok(composant.includes(`@fontsource/inter/${poids}.css`), `Inter ${poids} manquant`);
  assert.ok(!/fontsource\/inter/.test(fs.readFileSync(path.join(racine, 'src/index.css'), 'utf8')), 'index.css (partagé) ne charge pas Inter');
});

await dit('le lancement : environ 1 s la première fois, plus court ensuite, passable', () => {
  assert.ok(dureeLancement(true, false, 'complet') >= 800 && dureeLancement(true, false, 'complet') <= 1200);
  assert.ok(dureeLancement(false, false, 'complet') < dureeLancement(true, false, 'complet'));
  assert.ok(dureeLancement(true, true, 'complet') <= dureeLancement(true, false, 'complet'));
  assert.ok(dureeLancement(true, false, 'aucun') <= 400);
  const src = fs.readFileSync(path.join(racine, 'src/refonte/accueil/Lancement.tsx'), 'utf8');
  assert.ok(/onClick=\{\(\) => setVisible\(false\)\}/.test(src) && /'keydown'/.test(src), 'un clic ou une touche le passe');
  assert.ok(/useFermetureEchap\(visible,/.test(src), 'Échap le ferme par la pile des calques');
});

/* ── 5. Plus de personnage ────────────────────────────────────────────────── */
console.log('\nAccueil — aucun personnage\n');

function fichiers(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(path.join(racine, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...fichiers(rel));
    else if (/\.(tsx?|css)$/.test(e.name)) out.push(rel);
  }
  return out;
}

await dit('aucune brique de personnage dans la zone de l’Accueil', () => {
  const zone = fichiers('src/refonte/accueil').map((f) => f.split(path.sep).join('/'));
  for (const interdit of ['briques/', 'Ajmani.tsx', 'expressions.ts', 'regard.ts', 'useVie.ts']) assert.ok(!zone.some((f) => f.includes(interdit)), `${interdit} est revenu`);
  for (const f of zone) {
    const src = fs.readFileSync(path.join(racine, f), 'utf8');
    assert.ok(!/AjmaniPetit|TeteTele|<svg/.test(src), `${f} dessine encore un personnage`);
  }
});

await dit('une seule navigation : plus de barre latérale dans l’Accueil', () => {
  const src = fs.readFileSync(path.join(racine, 'src/refonte/accueil/AccueilVivant.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/<aside|BarreFamilles|ROUTE_TOUS_LES_MODULES|useRegards/.test(src), 'la barre latérale est revenue');
  const hook = fs.readFileSync(path.join(racine, 'src/refonte/accueil/useAccueil.ts'), 'utf8');
  assert.ok(!/useRegards|FAMILLES|enLigne/.test(hook), 'le hook calcule encore ce que la navigation de S1 doit porter');
});

/* ── 6. Les éditions ──────────────────────────────────────────────────────── */
console.log('\nAccueil — séparation des éditions\n');

const importsDe = (src: string) => [...src.matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g)].map((m) => m[1] ?? m[2]);

// Restreint à la zone S2 : `src/bureaux/**` et `IdleScreensaver.tsx` sont internes sans suffixe
// (STATUT.md, « Isolement des éditions ») ; `check:navigation` et `check:garde-refonte` les tiennent.
await dit('aucun fichier partagé n’importe src/refonte/accueil/** (seuls les fichiers .internal le peuvent)', () => {
  const fautes: string[] = [];
  for (const f of fichiers('src')) {
    const n = f.split(path.sep).join('/');
    if (n.startsWith('src/refonte/') || /\.internal\.tsx?$/.test(n) || n.endsWith('.css')) continue;
    for (const i of importsDe(fs.readFileSync(path.join(racine, f), 'utf8'))) if (/(^|\/)refonte\/accueil(\/|$)/.test(i)) fautes.push(`${n} importe ${i}`);
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
