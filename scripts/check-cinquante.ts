/**
 * LES FORMULES DES QUARANTE-CINQ MODULES — écrites dans le code, éprouvées ici.
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Le paquet de design pose une exigence que ni un navigateur ni un œil ne
 * tiennent seuls : « Les instruments sont la partie à ne pas approximer. Un
 * instrument dont les positions sont posées à la main au lieu d'être
 * calculées FINIRA PAR MENTIR. » `MODULES-NOUVEAUX.md` donne, pour chacun des
 * quarante-cinq, ses règles de calcul — la largeur d'une planche, l'angle d'un
 * cran, la position d'un nœud, ce qui porte l'ambre.
 *
 * Ce contrôle prend ces règles UNE PAR UNE et les éprouve contre les moteurs
 * de `src/lib/cinquante/`, sur des données qui ne sont PAS celles des
 * captures. C'est le point : un moteur qui ne marcherait que sur l'exemple du
 * cahier passerait l'œil et échouerait ici.
 *
 *   npm run check:cinquante
 */
import assert from 'node:assert/strict';

/** Une valeur qui doit exister : l’absence est déjà un défaut de la règle. */
function doit<T>(v: T | undefined | null, quoi = 'valeur attendue'): T {
  if (v === undefined || v === null) throw new Error(`${quoi} absente`);
  return v;
}
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));

async function charger<T>(entree: string): Promise<T> {
  const construit = await esbuild.build({
    entryPoints: [path.join(here, '..', entree)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    target: 'node22',
    charset: 'utf8',
  });
  return (await import(
    `data:text/javascript;charset=utf-8;base64,${Buffer.from(construit.outputFiles[0].text, 'utf8').toString('base64')}`
  )) as T;
}

let echecs = 0;
let reussis = 0;
function regle(nom: string, f: () => void) {
  try {
    f();
    reussis += 1;
  } catch (e) {
    echecs += 1;
    console.error(`  ✗ ${nom}\n      ${(e as Error).message.split('\n')[0]}`);
  }
}
const proche = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

const MAINTENANT = new Date('2026-10-02T15:30:00');
const iso = (joursAvant: number, h = 10) => {
  const d = new Date(MAINTENANT.getTime() - joursAvant * 86_400_000);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};

/* ══════════════════════════════════════════════════════════════ GUICHET ══ */
{
  const G = await charger<typeof import('../src/lib/cinquante/guichet')>('src/lib/cinquante/guichet.ts');
  console.log('Guichet');

  // ── 34a Boutique ────────────────────────────────────────────────────────
  const art = (prix: number, n = 1) => [{ produit: `p${prix}`, quantite: n, prixCents: prix }];
  const paniers = [
    ...Array.from({ length: 15 }, (_, i) => ({ id: `pa${i}`, kind: 'paiement' as const })).map((p, i) => ({
      id: p.id, kind: 'panier' as const, ouvertLe: iso(3), etape: 'paiement' as const, articles: art(1000 + i * 100),
      adresse: i % 3 === 0, arreteLe: iso(3, 8 + (i % 10)),
    })),
    { id: 'l1', kind: 'panier' as const, ouvertLe: iso(2), etape: 'livraison' as const, articles: art(4000), adresse: true, arreteLe: iso(2) },
    { id: 'ok', kind: 'panier' as const, ouvertLe: iso(1), etape: 'paye' as const, articles: art(5209), adresse: true, arreteLe: iso(1) },
    { id: 'vieux', kind: 'panier' as const, ouvertLe: iso(45), etape: 'panier' as const, articles: art(900), adresse: false, arreteLe: iso(45) },
    { id: 'v', kind: 'visites' as const, jour: iso(2).slice(0, 10), nombre: 300 },
  ];
  const pa = G.parcoursAchat(paniers, MAINTENANT);
  regle('34a · l’ambre va à l’étape qui a le plus de paniers laissés (calculée, pas fixée)', () =>
    assert.equal(pa.etapeAmbre, 'paiement'));
  const colPaiement = doit(pa.colonnes.find((c) => c.etape === 'paiement'));
  regle('34a · au-delà de 12 paniers, la pile s’arrête et annonce le reste', () => {
    assert.equal(colPaiement.pile.length, G.PILE_MAX);
    assert.equal(colPaiement.reste, 3);
  });
  regle('34a · les montants de la plaque ambre sont la somme EXACTE de la pile', () =>
    assert.equal(colPaiement.laissesCents, colPaiement.laisses.reduce((s, p) => s + G.montantPanier(p), 0)));
  regle('34a · une plaque par panier, dans l’ordre d’abandon', () => {
    const ordre = colPaiement.laisses.map((p) => p.arreteLe);
    assert.deepEqual(ordre, [...ordre].sort());
  });
  regle('34a · un panier de plus de 30 jours ne compte pas', () =>
    assert.ok(!pa.colonnes.some((c) => c.laisses.some((p) => p.id === 'vieux'))));
  regle('34a · sans panier laissé, pas d’ambre', () =>
    assert.equal(G.parcoursAchat([paniers[16]], MAINTENANT).etapeAmbre, null));

  // ── 34b Billetterie ─────────────────────────────────────────────────────
  const evt = { kind: 'evenement' as const, titre: 'x', date: '2026-10-20T14:00:00', jauge: 24, tarifs: [], ouvertureLe: iso(8) };
  const billets = Array.from({ length: 10 }, (_, i) => ({
    kind: 'billet' as const, evenementId: 'e', tarif: 't', acheteur: `a${i}`, profil: 'client' as const,
    venduLe: iso(8 - (i % 8)), montantCents: 2500, fraisCents: 50, rembourseLe: i === 9 ? iso(1) : undefined,
  }));
  const t = G.tourniquet(evt, billets, MAINTENANT);
  regle('34b · nombre de crans = jauge exacte', () => assert.equal(t.crans.length, 24));
  regle('34b · angle = 360 / jauge', () => assert.ok(proche(t.crans[1].angle, 15) && proche(t.crans[23].angle, 345)));
  regle('34b · un billet remboursé libère sa place', () => assert.equal(t.libres, 15));
  regle('34b · le libellé du moyeu tient dans la corde du cercle à sa hauteur', () => {
    const r = G.TOURNIQUET.rayonMoyeu;
    for (const y of G.TOURNIQUET.libelleY) {
      const corde = 2 * Math.sqrt(r * r - y * y);
      // « À VENDRE » : 8 caractères mono de 8,5 px (≈ 0,6 em) + 7 espacements de 1,4
      const largeur = 8 * 0.6 * 8.5 + 7 * 1.4;
      assert.ok(largeur < corde, `y=${y} : ${largeur.toFixed(1)} ≥ corde ${corde.toFixed(1)}`);
    }
    assert.deepEqual([...G.TOURNIQUET.libelleY], [22, 33]);
  });
  regle('34b · le jour même, les crans comptent les entrées et le rotor tourne d’un tiers par scan', () => {
    const jourJ = { ...evt, date: MAINTENANT.toISOString() };
    const scannes = billets.map((b, i) => ({ ...b, scanneLe: i < 4 ? iso(0) : undefined }));
    const tj = G.tourniquet(jourJ, scannes, MAINTENANT);
    assert.equal(tj.mode, 'entrees');
    assert.equal(tj.crans.filter((c) => c.plein).length, 4);
    assert.equal(tj.rotationRotor, (4 * 120) % 360);
  });
  regle('34b · la prévision vient du rythme MOYEN depuis l’ouverture', () => {
    const p = G.previsionRemplissage(evt, billets, MAINTENANT);
    // ouverte il y a 8 jours calendaires : 9 jours de vente, bornes comprises.
    assert.ok(proche(p.rythmeParJour, 9 / 9));
  });

  // ── 34c Dons ────────────────────────────────────────────────────────────
  const camp = { kind: 'campagne' as const, titre: 'c', objectifCents: 800_000, seuilCents: 500_000, clotureLe: iso(-9), paliers: [{ desCents: 0, contrepartie: 'merci' }, { desCents: 5000, contrepartie: 'bon' }] };
  const dons = Array.from({ length: 23 }, (_, i) => ({ id: `d${i}`, kind: 'contribution' as const, campagneId: 'c', nom: `n${i}`, montantCents: 3000 + i * 700, recuLe: iso(20 - i) }));
  const p = G.pont(camp, dons);
  const somme = dons.reduce((s, d) => s + d.montantCents, 0);
  regle('34c · la somme des planches égale exactement le montant collecté', () =>
    assert.ok(proche(p.planches.reduce((s, x) => s + x.largeurPct, 0), (somme / camp.objectifCents) * 100, 1e-9)));
  regle('34c · la pile du seuil est plantée à seuil / objectif', () => assert.ok(proche(p.seuilPct, 62.5)));
  regle('34c · la plaque ambre ne recouvre jamais la pile du seuil (rangées disjointes)', () =>
    assert.ok(G.PONT.plaqueHaut + G.PONT.plaqueHauteur <= G.PONT.tablier));
  regle('34c · la plaque tient sur une ligne dans la partie gauche du trou, sans sortir de la carte', () => {
    for (const k of [10, 40, 62, 70, 80, 95]) {
      const d = [{ id: 'x', kind: 'contribution' as const, campagneId: 'c', nom: 'x', montantCents: (camp.objectifCents * k) / 100, recuLe: iso(1) }];
      const q = doit(doit(G.pont(camp, d)).plaque);
      assert.ok(q.gauchePct + G.PLAQUE_PONT_PCT <= 100 + 1e-9, `collecte ${k} % : la plaque sort à ${q.gauchePct + G.PLAQUE_PONT_PCT} %`);
      if (q.dansLeTrou) assert.ok(q.gauchePct >= k, `collecte ${k} % : la plaque commence avant le trou`);
    }
  });
  regle('34c · la dernière planche arrivée est la seule en encre claire', () =>
    assert.equal(p.planches.filter((x) => x.derniere).length, 1));
  regle('34c · un tablier qui touche l’autre rive n’a plus de trou, donc plus d’ambre', () =>
    assert.equal(G.pont(camp, [{ id: 'z', kind: 'contribution', campagneId: 'c', nom: 'z', montantCents: 900_000, recuLe: iso(1) }]).plaque, null));

  // ── 34d Acompte en ligne ────────────────────────────────────────────────
  const devis = [
    { id: 'a', client: 'A', montantCents: 124_000, tauxAcompte: 0.3, envoyeLe: iso(10), signeLe: iso(6) },
    { id: 'b', client: 'B', montantCents: 60_000, tauxAcompte: 0.3, envoyeLe: iso(4), signeLe: iso(1), note: 'promis au téléphone' },
    { id: 'c', client: 'C', montantCents: 180_000, tauxAcompte: 0.3, envoyeLe: iso(12), signeLe: iso(10), acompteRecuLe: iso(10) },
    { id: 'd', client: 'D', montantCents: 52_000, tauxAcompte: 0.3, envoyeLe: iso(2) },
    { id: 'e', client: 'E', montantCents: 99_900, tauxAcompte: 0.4, envoyeLe: iso(40), signeLe: iso(30) },
  ];
  const s = G.sas(devis, MAINTENANT);
  regle('34d · le montant du libellé ambre est la somme des jetons présents dans le sas', () =>
    assert.equal(s.attenduCents, s.dansLeSas.reduce((x, d) => x + d.acompteCents, 0)));
  regle('34d · un acompte promis au téléphone ne fait pas franchir la seconde porte', () =>
    assert.ok(s.dansLeSas.some((d) => d.id === 'b')));
  regle('34d · la barre d’attente est sur une échelle de 14 jours, plafonnée', () => {
    const e = doit(s.dansLeSas.find((d) => d.id === 'e'));
    assert.equal(e.barrePct, 100);
    assert.ok(proche(doit(s.dansLeSas.find((d) => d.id === 'a')).barrePct, (G.SAS_ECHELLE_JOURS ? 6 / 14 : 0) * 100, 3));
  });

  // ── 34e Chatbot ─────────────────────────────────────────────────────────
  const dem = (n: number) => Array.from({ length: n }, (_, i) => ({ le: `2026-10-${String(3 + i).padStart(2, '0')}T10:00:00.000Z`, issue: 'faq' as const }));
  const qs = [
    { id: 'q1', kind: 'question' as const, sujet: 'tarifs' as const, texte: 'Tarif ?', reponse: '40 €', demandes: dem(7) },
    { id: 'q2', kind: 'question' as const, sujet: 'paiement' as const, texte: 'En trois fois ?', demandes: dem(9) },
    { id: 'q3', kind: 'question' as const, sujet: 'zone' as const, texte: 'À Bron ?', demandes: dem(3) },
  ];
  // Le module compte le MOIS CALENDAIRE (« · septembre ») : on se place en fin de mois.
  const f = G.faqEnCreux(qs, new Date('2026-10-28T12:00:00'));
  regle('34e · hauteur d’une tuile = 52 px + 4 px par demande', () => {
    for (const c of f.colonnes) for (const tu of c.tuiles) assert.equal(tu.hauteur, 52 + 4 * tu.fois);
  });
  regle('34e · l’ambre va au creux le plus demandé', () => assert.equal(f.creuxAmbre, 'q2'));
  regle('34e · une question répondue n’est jamais un creux', () =>
    assert.ok(f.colonnes.flatMap((c) => c.tuiles).every((tu) => tu.creux === !tu.reponse)));
  regle('34e · les cinq colonnes existent toujours, dans le même ordre', () =>
    assert.deepEqual(f.colonnes.map((c) => c.sujet), [...G.SUJETS_FAQ]));

  // ── 34f Standard ────────────────────────────────────────────────────────
  const appel = {
    kind: 'appel' as const, debutLe: iso(0, 14), dureeS: 200, appelant: 'X', issue: '',
    tours: [
      { qui: 'appelant' as const, debutS: 0, finS: 20 }, { qui: 'assistant' as const, debutS: 20, finS: 70 },
      { qui: 'appelant' as const, debutS: 70, finS: 100 }, { qui: 'assistant' as const, debutS: 100, finS: 160 },
      { qui: 'appelant' as const, debutS: 160, finS: 180 }, { qui: 'assistant' as const, debutS: 180, finS: 200 },
    ],
    engagements: [
      { seconde: 30, citation: 'a', dansLeMandat: true, note: '' },
      { seconde: 120, citation: 'b', dansLeMandat: false, note: '' },
      { seconde: 150, citation: 'c', dansLeMandat: true, note: '' },
      { seconde: 190, citation: 'd', dansLeMandat: false, note: '' },
    ],
  };
  const pr = G.promesses(appel);
  regle('34f · chaque position est seconde / durée × 100 %', () => assert.ok(proche(pr.epingles[1].gauchePct, 60)));
  regle('34f · une épingle tombe toujours dans un tour de parole de l’assistant', () =>
    assert.ok(pr.epingles.every((e) => e.dansUnTourAssistant)));
  regle('34f · les cartes sans gouttière : chaque fil finit au centre de sa carte, (2i + 1) / 2n', () =>
    pr.fils.forEach((fl, i) => assert.ok(proche(fl.vers, ((2 * i + 1) / 8) * 1000))));
  regle('34f · une seule chaîne ambre : le premier engagement hors mandat', () => {
    assert.equal(pr.epingles.filter((e) => e.ambre).length, 1);
    assert.equal(doit(pr.epingles.find((e) => e.ambre)).citation, 'b');
  });
}

console.log(`\n${reussis} règle(s) tenue(s), ${echecs} en défaut.`);
if (echecs > 0) process.exit(1);
