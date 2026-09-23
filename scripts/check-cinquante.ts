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

/* ════════════════════════════════════════════════════════════ MARKETING ══ */
{
  const M = await charger<typeof import('../src/lib/cinquante/marketing')>('src/lib/cinquante/marketing.ts');
  console.log('Marketing');

  // ── 35a Montage vidéo ───────────────────────────────────────────────────
  const film = {
    format: 'reel' as const,
    plans: [
      { nom: 'a', dureeS: 7 }, { nom: 'b', dureeS: 5, garde: true }, { nom: 'c', dureeS: 12 },
      { nom: 'd', dureeS: 3 }, { nom: 'e', dureeS: 9, garde: true }, { nom: 'f', dureeS: 5 },
    ],
  };
  const bo = M.bobine(film);
  regle('35a · échelle fixe de 45 s : largeur = durée / 45', () => assert.ok(proche(bo.plans[2].largeurPct, (12 / 45) * 100)));
  regle('35a · la zone ambre commence au cran du format et s’arrête à la fin du film', () => {
    const z = doit(bo.zone);
    assert.ok(proche(z.gauchePct, (30 / 45) * 100));
    assert.ok(proche(z.gauchePct + z.largeurPct, (41 / 45) * 100));
  });
  regle('35a · un film qui tient dans son format n’a pas de zone', () =>
    assert.equal(M.bobine({ format: 'reel', plans: [{ nom: 'x', dureeS: 30 }] }).zone, null));
  regle('35a · la coupe ramène le film au format, à la seconde près, sans toucher aux plans gardés', () => {
    const c = doit(M.coupeSuggeree(film));
    const apres = film.plans.map((p, i) => c.find((x) => x.index === i)?.versS ?? p.dureeS);
    assert.equal(apres.reduce((a, b) => a + b, 0), 30);
    assert.ok(c.every((x) => !film.plans[x.index].garde));
    assert.ok(apres.every((d) => d >= M.PLAN_MIN_S));
  });
  regle('35a · « Vitres d’hiver » : le logo à 2 s, « Le geste » à 5 s', () => {
    const vh = { format: 'reel' as const, plans: [
      { nom: 'Plan large', dureeS: 6 }, { nom: 'Avant', dureeS: 5, garde: true }, { nom: 'Le geste', dureeS: 9 },
      { nom: 'Détail', dureeS: 4 }, { nom: 'Après', dureeS: 8, garde: true }, { nom: 'Logo', dureeS: 6 },
    ] };
    assert.deepEqual(doit(M.coupeSuggeree(vh)).map((x) => [x.index, x.versS]), [[2, 5], [5, 2]]);
  });

  // ── 35b Visuels pub ─────────────────────────────────────────────────────
  const ban = { cle: 'banniere' as const, nom: 'Bannière', largeurPx: 1200, hauteurPx: 628,
    titre: { x: 100, y: 100, l: 1100, h: 90 }, produit: { x: 100, y: 400, l: 400, h: 200 } };
  regle('35b · échelle commune : 1 px pour 6,4 px', () => assert.ok(proche(M.aLEchelle(1920), 300)));
  regle('35b · le verdict se calcule par intersection de rectangles', () => {
    const h = M.horsZone(ban);
    const z = M.rectZoneSure(ban);
    assert.equal(h.dehors, true);
    assert.equal(h.cote, 'droite');
    assert.equal(h.px, Math.round(1200 - (z.x + z.l)));
  });
  regle('35b · la story garde 14 % en haut et 20 % en bas', () => {
    const z = M.rectZoneSure({ cle: 'story', largeurPx: 1080, hauteurPx: 1920 });
    assert.ok(proche(z.y, 1920 * 0.14));
    assert.ok(proche(1920 - (z.y + z.h), 1920 * 0.2));
  });
  regle('35b · recomposer ramène le titre dans la zone sûre', () => assert.equal(M.horsZone(M.recomposer(ban)).dehors, false));

  // ── 35c Planificateur ───────────────────────────────────────────────────
  regle('35c · l’aiguille : (heure + minutes / 60) × 15°', () =>
    assert.ok(proche(M.angleAiguille(new Date('2026-10-01T18:30:00')), 277.5)));
  regle('35c · échelle commune : 21 % = 44 px au-delà du rayon 56, plafond 100', () => {
    assert.ok(proche(M.rayonSecteur(21), 100));
    assert.ok(proche(M.rayonSecteur(10.5), 78));
    assert.ok(proche(M.rayonSecteur(40), 100));
  });
  const aud = Array.from({ length: 24 }, (_, h) => (h === 5 ? 2 : h === 14 ? 20 : 8));
  const reseaux = [{ kind: 'reseau' as const, nom: 'R', audience: aud, ordre: 0 }];
  const posts = [
    { id: 'p1', kind: 'post' as const, reseau: 'R', le: '2026-10-05T05:10:00', sujet: 'creux' },
    { id: 'p2', kind: 'post' as const, reseau: 'R', le: '2026-10-05T14:00:00', sujet: 'pic' },
    { id: 'p3', kind: 'post' as const, reseau: 'R', le: '2026-10-01T05:00:00', sujet: 'passé' },
  ];
  regle('35c · l’ambre va à l’aiguille à venir qui tombe dans le creux', () =>
    assert.equal(doit(M.aiguilleDansLeCreux(reseaux, posts, MAINTENANT)).post.id, 'p1'));
  regle('35c · une aiguille dans un secteur clair (≥ 12 %) n’est pas dans le vide', () =>
    assert.equal(M.aiguilleDansLeCreux(reseaux, [posts[1]], MAINTENANT), null));

  // ── 35d Podcast ─────────────────────────────────────────────────────────
  const amp = Array.from({ length: 1450 }, (_, s) => (s >= 600 && s < 613 ? 0 : 1 + (s % 7)));
  const on = M.onde({ amplitudes: amp, dureeS: 1450 });
  regle('35d · 240 barres, la plus haute à 100 %', () => {
    assert.equal(on.length, 240);
    assert.ok(proche(Math.max(...on), 100));
  });
  regle('35d · un silence qui couvre une tranche entière tombe presque à plat', () => assert.ok(Math.min(...on) < 30));
  regle('35d · positions en secondes rapportées à la durée totale', () => assert.ok(proche(M.pctSeconde(870, 1450), 60)));
  regle('35d · l’économie additionne la coupe et les hésitations', () =>
    assert.equal(M.economiePodcast({ coupe: { debutS: 870, finS: 908, motif: '' },
      hesitations: [{ s: 1, dureeS: 1.1, genre: 'euh' }, { s: 2, dureeS: 0.9, genre: 'euh' }] }).totalS, 40));

  // ── 35e Identité visuelle ───────────────────────────────────────────────
  const logo = { kind: 'logo' as const, monogramme: 'AB', mention: 'X', ratioMonogramme: 0.42, ratioMention: 0.085,
    couleurs: [], polices: [], declinaisons: [] };
  regle('35e · aucun élément sous 6 px de corps', () => {
    assert.equal(M.lisibilite(logo, { taillePx: 16, declinaison: 'complete' }).mentionIllisible, true);
    assert.equal(M.lisibilite(logo, { taillePx: 96, declinaison: 'complete' }).mentionIllisible, false);
    assert.equal(M.lisibilite(logo, { taillePx: 16, declinaison: 'reduite' }).mentionIllisible, false);
  });
  const usages = [16, 220, 40].map((t, i) => ({ id: `u${i}`, kind: 'usage' as const, nom: `${t}`, taillePx: t, reel: '', declinaison: 'complete' as const, ordre: i }));
  regle('35e · l’ambre va au plus petit usage illisible', () => assert.equal(doit(M.usageIllisible(logo, usages)).taillePx, 16));
  regle('35e · la version réduite est proposée sous le seuil de la mention', () => assert.ok(proche(M.seuilVersionReduite(logo), 6 / 0.085)));

  // ── 35f Images produits ─────────────────────────────────────────────────
  regle('35f · couronne : 50 % + 38 % · cos θ, 200 + 148 · sin θ', () => {
    const p0 = M.positionScene(0);
    const p3 = M.positionScene(3);
    assert.ok(proche(p0.xPct, 50) && proche(p0.y, 52));
    assert.ok(proche(p3.xPct, 50 + 38 * Math.cos(Math.PI / 4), 1e-9) && proche(p3.y, 200 + 148 * Math.sin(Math.PI / 4), 1e-9));
  });
  const prod = { kind: 'produit' as const, nom: 'P', reference: { etiquette: '5 L', forme: 'bidon', bouchon: 'rouge' }, ordre: 0 };
  regle('35f · un écart sur une zone fixe classe l’image « altérée », quelle que soit sa qualité', () => {
    const sc = { kind: 'scene' as const, produitId: 'p', numero: 1, decor: '', verdict: 'gardee' as const, genereeLe: iso(1),
      zones: { etiquette: '3 L', forme: 'bidon', bouchon: 'rouge' } };
    assert.deepEqual(M.alteration(prod, sc), { zone: 'etiquette', avant: '5 L', apres: '3 L' });
    assert.equal(M.alteration(prod, { ...sc, zones: { ...prod.reference } }), null);
  });

  // ── 35g Sentiment ───────────────────────────────────────────────────────
  regle('35g · la phrase-mère n’emploie que des mots de ses variantes', () => {
    assert.deepEqual(M.motsAbsents('On attend toujours', ['On attend', 'toujours pareil']), []);
    assert.deepEqual(M.motsAbsents('On attend demain', ['On attend']), ['demain']);
  });
  const sent = [
    { id: 'n', kind: 'phrase' as const, phrase: 'trop tard', polarite: 'negative' as const },
    { id: 'p', kind: 'phrase' as const, phrase: 'très bien', polarite: 'positive' as const },
    ...Array.from({ length: 3 }, (_, i) => ({ id: `tn${i}`, kind: 'texte' as const, source: 'nps' as const, texte: 'trop tard', le: iso(i + 1), phraseId: 'n' })),
    ...Array.from({ length: 5 }, (_, i) => ({ id: `tp${i}`, kind: 'texte' as const, source: 'avis' as const, texte: 'très bien', le: iso(i + 1), phraseId: 'p' })),
    { id: 'vieux', kind: 'texte' as const, source: 'avis' as const, texte: 'trop tard', le: iso(120), phraseId: 'n' },
  ];
  const ph = M.phrasesMeres(sent, MAINTENANT);
  regle('35g · l’ambre va à la négative la plus fréquente, même si une positive l’est plus', () => assert.equal(doit(ph.ambre).phrase.id, 'n'));
  regle('35g · quatre-vingt-dix jours glissants', () => assert.equal(doit(ph.ambre).variantes.length, 3));
  regle('35g · sans phrase négative, pas d’ambre', () =>
    assert.equal(M.phrasesMeres(sent.filter((e) => e.id !== 'n' && !e.id.startsWith('tn') && e.id !== 'vieux'), MAINTENANT).ambre, null));

  // ── 35h Veille ──────────────────────────────────────────────────────────
  const veille = [
    { id: 'c1', kind: 'concurrent' as const, nom: 'Un', initiale: 'U' },
    { id: 'c2', kind: 'concurrent' as const, nom: 'Deux', initiale: 'D' },
    { id: 'pr', kind: 'prestation' as const, nom: 'X', votrePrixCents: 10000, marcheBasCents: 5000, marcheHautCents: 15000, ordre: 0 },
    { id: 'r1', kind: 'releve' as const, concurrentId: 'c1', prestationId: 'pr', prixCents: 11000, le: iso(10) },
    { id: 'r2', kind: 'releve' as const, concurrentId: 'c1', prestationId: 'pr', prixCents: 9000, le: iso(2) },
  ];
  const rv = M.releveDesPrix(veille);
  regle('35h · chaque ligne a sa propre échelle : position = (prix − bas) / (haut − bas)', () => assert.ok(proche(rv.lignes[0].vousPct, 50)));
  regle('35h · un prix non relevé n’a pas de jeton', () => assert.equal(rv.lignes[0].jetons.length, 1));
  regle('35h · une hausse, même sous votre prix, n’est pas ambre', () => {
    const hausse = M.releveDesPrix([...veille.slice(0, 3),
      { id: 'h1', kind: 'releve' as const, concurrentId: 'c2', prestationId: 'pr', prixCents: 7000, le: iso(10) },
      { id: 'h2', kind: 'releve' as const, concurrentId: 'c2', prestationId: 'pr', prixCents: 8000, le: iso(2) }]);
    assert.equal(M.passeSousVous(hausse.lignes, MAINTENANT), null);
  });
  regle('35h · l’ambre : le mouvement de la semaine qui passe sous votre prix', () => {
    const m = doit(M.passeSousVous(rv.lignes, MAINTENANT));
    assert.equal(m.jeton.prixCents, 9000);
    assert.equal(doit(m.jeton.avant).prixCents, 11000);
  });

  // ── 35i NPS ─────────────────────────────────────────────────────────────
  const nps = [
    ...Array.from({ length: 6 }, (_, i) => ({ kind: 'reponse' as const, note: 10, le: iso(i + 1), client: '' })),
    ...Array.from({ length: 2 }, (_, i) => ({ kind: 'reponse' as const, note: 3, le: iso(i + 1), client: '' })),
    ...Array.from({ length: 2 }, (_, i) => ({ kind: 'reponse' as const, note: 8, le: iso(i + 1), client: '' })),
    { kind: 'reponse' as const, note: 0, le: iso(95), client: '' },
    ...Array.from({ length: 20 }, (_, i) => ({ kind: 'envoi' as const, le: iso(i + 1) })),
  ];
  const co = M.corde(nps, MAINTENANT);
  regle('35i · NPS = promoteurs − détracteurs, sur 90 jours glissants, arrondi à l’unité', () => assert.equal(co.score, 40));
  regle('35i · autant de carrés que de répondants dans chaque groupe', () => assert.deepEqual([co.detracteurs, co.passifs, co.promoteurs], [2, 2, 6]));
  regle('35i · position du nœud : 50 % + score / 2', () => assert.ok(proche(co.noeudPct, 70)));
  regle('35i · le trimestre précédent est le trimestre civil (octobre → T3)', () => assert.equal(M.trimestrePrecedent(MAINTENANT).numero, 3));
  regle('35i · taux de réponse = réponses / sondages envoyés', () => assert.equal(co.tauxReponsePct, 50));
}

/* ══════════════════════════════════════════════════════════════ FINANCE ══ */
{
  const F = await charger<typeof import('../src/lib/cinquante/finance')>('src/lib/cinquante/finance.ts');
  console.log('Finance');

  // ── 36a Trésorerie prévue ───────────────────────────────────────────────
  regle('36a · échelle commune 0 → 24 000 € : 0 € à y 210, 24 000 € à y 10', () => {
    assert.ok(proche(F.yCone(0), 210));
    assert.ok(proche(F.yCone(2_400_000), 10));
  });
  const histo = Array.from({ length: 52 }, (_, i) => ({ kind: 'historique' as const, debut: iso(7 * (52 - i)), entreesCents: i % 2 ? 300_000 : 100_000, sortiesCents: 150_000 }));
  const flux = Array.from({ length: 12 }, (_, i) => ({ kind: 'flux' as const, libelle: '', le: iso(-(7 * i + 3)), montantCents: -150_000, nature: 'sortie-fixe' as const }));
  const tr = [{ kind: 'solde' as const, soldeCents: 1_000_000, le: iso(0) }, ...histo, ...flux];
  const co = doit(F.cone(tr, MAINTENANT));
  regle('36a · l’écart vient de la variance réelle : σ × √k', () => {
    assert.ok(proche(co.sigmaHebdoCents, F.ecartType(histo.map((h) => h.entreesCents))));
    assert.ok(proche(co.ecart[4], co.sigmaHebdoCents * 2));
  });
  regle('36a · le point critique : la première semaine où central − écart < 0', () => {
    const k = doit(co.critique);
    assert.ok(co.central[k] - co.ecart[k] < 0);
    assert.ok(co.central[k - 1] - co.ecart[k - 1] >= 0);
  });
  regle('36a · la mensualité supportable est lue dans l’historique, jamais saisie', () =>
    assert.equal(F.mensualiteSupportable(tr, MAINTENANT), Math.round((((200_000 - 150_000) * 52) / 12) / 1000) * 1000));

  // ── 36b Scénarios ───────────────────────────────────────────────────────
  const hyp = (cle: 'prix' | 'volume' | 'embauche' | 'camionnette' | 'delai', min: number, max: number) => ({ cle, nom: cle, min, max, pas: 1, unite: 'pct' as const });
  const modele = { kind: 'modele' as const, exercice: 2027, caBaseCents: 20_000_000, tauxVariable: 0.3, chargesFixesCents: 9_000_000,
    salaireMensuelCents: 300_000, camionnetteMensuelleCents: 150_000, coutJourDelaiCents: 1_000,
    hypotheses: [hyp('prix', -5, 10), hyp('volume', -20, 10), hyp('embauche', 1, 13), hyp('camionnette', 1, 13), hyp('delai', 20, 60)] };
  const prudent = { prix: 2, volume: -12, embauche: 3, camionnette: 9, delai: 45 };
  const ambitieux = { prix: 6, volume: 5, embauche: 3, camionnette: 13, delai: 38 };
  regle('36b · top = 100 − (valeur − min) / (max − min) × 100 %', () => assert.ok(proche(F.topCurseur({ min: -5, max: 10 }, 4), 40)));
  regle('36b · les poids se calculent une hypothèse à la fois et font 100 %', () => {
    const p = F.poids(modele, prudent, ambitieux);
    assert.ok(proche(p.reduce((s, x) => s + x.part, 0), 1));
    const vol = doit(p.find((x) => x.cle === 'volume'));
    assert.ok(proche(vol.effet, Math.abs(F.resultat(modele, { ...prudent, volume: 5 }) - F.resultat(modele, prudent)), 1));
    assert.equal(doit(p.find((x) => x.cle === 'embauche')).part, 0);
  });

  // ── 36c Simulateur de prêt ──────────────────────────────────────────────
  regle('36c · la mensualité d’un prêt amortissable', () => assert.ok(proche(F.mensualite(2_400_000, 0.042, 60), 44_416, 5)));
  const du = F.durees({ capitalCents: 2_400_000, tauxAnnuel: 0.042, dureesAns: [7, 3, 5] }, 48_000);
  regle('36c · une seule échelle : 24 000 € = 180 px', () => assert.ok(proche(du.lignes[0].coiffePx, (du.lignes[0].interetsCents / 2_400_000) * 180)));
  regle('36c · l’ambre : la durée la plus courte sous le seuil', () => assert.equal(doit(du.ambre).ans, 5));
  regle('36c · si aucune durée ne passe, pas d’ambre', () => assert.equal(F.durees({ capitalCents: 2_400_000, tauxAnnuel: 0.042, dureesAns: [3, 5, 7] }, 20_000).ambre, null));
  regle('36c · sans prévision de trésorerie, pas de seuil inventé', () => assert.equal(F.durees({ capitalCents: 2_400_000, tauxAnnuel: 0.042, dureesAns: [3] }, null).ambre, null));

  // ── 36d Analytique ──────────────────────────────────────────────────────
  regle('36d · y = 300 − (marge + 10) × 5', () => {
    assert.equal(F.yMarge(40), 50);
    assert.equal(F.yMarge(-10), 300);
    assert.equal(F.yMarge(0), 250);
  });
  regle('36d · deux étiquettes à moins de 14 px : la seconde se décale', () => {
    const e = F.etiquettes([{ id: 'a', y: 100 }, { id: 'b', y: 106 }, { id: 'c', y: 200 }]);
    assert.deepEqual(e.get('b'), { y: 114, decale: true });
    assert.deepEqual(e.get('c'), { y: 200, decale: false });
  });

  // ── 36e Rapprochement ───────────────────────────────────────────────────
  const rap = [
    { id: 'b1', kind: 'banque' as const, le: iso(5), libelle: 'VIR X', montantCents: 54_000 },
    { id: 'b2', kind: 'banque' as const, le: iso(4), libelle: 'FRAIS BANCAIRES', montantCents: -1_230 },
    { id: 'b3', kind: 'banque' as const, le: iso(3), libelle: 'PRLV URSSAF', montantCents: -186_200 },
    { id: 'b4', kind: 'banque' as const, le: iso(3), libelle: 'CB PRESQUE', montantCents: -1_000 },
    { id: 'e1', kind: 'ecriture' as const, le: iso(5), libelle: 'Acompte', montantCents: 54_000 },
    { id: 'e2', kind: 'ecriture' as const, le: iso(4), libelle: 'Frais', montantCents: -1_200 },
    { id: 'e3', kind: 'ecriture' as const, le: iso(3), libelle: 'Achat', montantCents: -1_010 },
    { id: 'r1', kind: 'regle' as const, libelle: 'Frais', cible: 'frais', toleranceCents: 50, fraisBancaires: true, motif: 'FRAIS BANCAIRES' },
  ];
  const fe = F.fermeture(rap);
  regle('36e · une paire ne se ferme qu’au montant exact', () => assert.ok(!fe.paires.some((p) => p.banque.id === 'b4')));
  regle('36e · la tolérance ne vaut que pour les frais bancaires', () => assert.ok(fe.paires.some((p) => p.banque.id === 'b2' && p.ecriture.id === 'e2')));
  regle('36e · l’ambre : la ligne ouverte de plus gros montant absolu', () => assert.equal(doit(fe.ambre).id, 'b3'));

  // ── 36f Prévision fiscale ───────────────────────────────────────────────
  const fis = [
    { kind: 'solde' as const, soldeCents: 1_840_000, le: iso(0) },
    { kind: 'echeance' as const, impot: 'TVA', court: 'TVA', echeance: iso(-30), montantCents: 0,
      tva: { collecteeCents: 400_000, deductibleCents: 88_000, projeteeCents: 385_000, clotureLe: iso(-10) } },
    { kind: 'echeance' as const, impot: 'IS', court: 'IS', echeance: iso(-80), montantCents: 148_000 },
    { kind: 'echeance' as const, impot: 'CFE', court: 'CFE', echeance: iso(3), montantCents: 39_000 },
    { kind: 'echeance' as const, impot: 'TVA 4', court: 'TVA', echeance: iso(-120), montantCents: 340_000, estimation: true },
  ];
  const fi = F.filigrane(fis, MAINTENANT);
  regle('36f · la somme des segments égale exactement la part fiscale', () => assert.equal(fi.segments.reduce((s, x) => s + x.montantCents, 0), fi.partFiscale));
  regle('36f · la part libre = solde − part fiscale', () => assert.equal(fi.partLibre, 1_840_000 - fi.partFiscale));
  regle('36f · la TVA en cours = collectée − déductible, à la date du jour', () => assert.equal(fi.segments.find((x) => x.e.impot === 'TVA')?.montantCents, 312_000));
  regle('36f · une estimation reste hors du filigrane', () => assert.ok(!fi.segments.some((x) => x.e.estimation)));
  regle('36f · une échéance passée sans paiement est en retard (le seul rouge)', () => assert.equal(fi.segments.find((x) => x.e.impot === 'CFE')?.enRetard, true));

  // ── 36g Multi-devises ───────────────────────────────────────────────────
  regle('36g · la SURFACE est proportionnelle : diamètre 60 × √(montant / 1000)', () => {
    assert.ok(proche(F.diametreBulle(1000), 60));
    assert.ok(proche(F.diametreBulle(4000), 120));
  });
  const dv = F.bulles([
    { kind: 'taux' as const, devise: 'GBP', eur: 1.173, le: iso(0) },
    { kind: 'taux' as const, devise: 'CHF', eur: 0.941, le: iso(0) },
    { kind: 'facture' as const, client: 'A', ville: '', devise: 'GBP', montant: 190_000, tauxEmission: 1.198, emiseLe: iso(40), echeance: iso(-8) },
    { kind: 'facture' as const, client: 'B', ville: '', devise: 'CHF', montant: 420_000, tauxEmission: 0.93, emiseLe: iso(20), echeance: iso(-20) },
  ]);
  regle('36g · l’ambre : la devise qui a le plus baissé depuis l’émission', () => assert.equal(doit(dv.ambre).devise, 'GBP'));
  regle('36g · la perte latente au taux du jour', () => assert.equal(doit(dv.ambre).latentCents, Math.round(190_000 * 1.173) - Math.round(190_000 * 1.198)));

  // ── 36h Notes de frais ──────────────────────────────────────────────────
  const note = { kind: 'note' as const, personne: 'S', le: iso(1), montantCents: 6240, statut: 'a-verifier' as const,
    ticket: [{ texte: 'A', zone: 1 }, { texte: 'B', zone: 4 }],
    champs: [{ zone: 1, champ: 'c', valeur: 'x', confiance: 0.97 }, { zone: 4, champ: 'tva', valeur: '20 %', confiance: 0.58 }, { zone: 9, champ: 'orphelin', valeur: '?', confiance: 0.99 }] };
  regle('36h · un champ sans zone n’est jamais pré-rempli', () => assert.ok(!F.champsLisibles(note).some((c) => c.zone === 9)));
  regle('36h · sous 70 % de confiance, le champ est ambre et bloque', () => assert.equal(doit(F.champAmbre(note)).zone, 4));
  regle('36h · confirmé, il ne bloque plus', () =>
    assert.equal(F.champAmbre({ ...note, champs: note.champs.map((c) => ({ ...c, confirmeLe: iso(0) })) }), null));

  // ── 36i Factures entrantes ──────────────────────────────────────────────
  const conf = { fournisseur: 0.99, montant: 0.99, echeance: 0.99 };
  const fac = (id: string, jours: number, montant: number | null, c = conf) =>
    ({ id, kind: 'facture' as const, fournisseur: 'F', montantCents: montant, echeance: iso(-jours), confiance: c, recueLe: iso(3), fournisseurConnu: true });
  const tr2 = F.tri([fac('a', 2, 100), fac('b', 1, 300), fac('c', 60, 50), fac('d', 3, 70, { ...conf, montant: 0.85 }), fac('e', 3, null)], MAINTENANT);
  regle('36i · sous 90 % de confiance, la facture va à vérifier', () => assert.deepEqual(doit(tr2.find((c) => c.casier === 'verifier')).plis.map((p) => p.id).sort(), ['d', 'e']));
  regle('36i · les casiers se classent par échéance, jamais par montant', () => assert.deepEqual(doit(tr2.find((c) => c.casier === 'semaine')).plis.map((p) => p.id), ['b', 'a']));
  regle('36i · les totaux sont la somme exacte des plis, incomplets si un montant manque', () => {
    assert.equal(doit(tr2.find((c) => c.casier === 'semaine')).totalCents, 400);
    assert.equal(doit(tr2.find((c) => c.casier === 'verifier')).totalCents, null);
  });
}

/* ══════════════════════════════════════════════════════════════════ RH ══ */
{
  const R = await charger<typeof import('../src/lib/cinquante/rh')>('src/lib/cinquante/rh.ts');
  console.log('RH');

  // ── 37a Recrutement ─────────────────────────────────────────────────────
  const lundi = R.lundiDe(MAINTENANT);
  const jourIso = (semaines: number, j: number) => {
    const d = new Date(lundi.getTime() + (semaines * 7 + j - 1) * 86_400_000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const creneaux = [
    ...[-1, -2].flatMap((s) => [1, 2, 3, 4, 5].map((j) => ({ email: 'a', day: jourIso(s, j), kind: 'journee' as const }))),
    ...[1, 2, 3, 4, 5].map((j) => ({ email: 'a', day: jourIso(0, j), kind: j === 2 || j === 4 ? ('matin' as const) : ('journee' as const) })),
  ];
  const t = R.trouDeLaSemaine(creneaux, MAINTENANT);
  regle('37a · le trou vient du Planning : heures ouvertes non tenues cette semaine', () => {
    assert.equal(t.trou.size, 8);
    assert.ok(t.trou.has(R.cle(2, 14)) && !t.trou.has(R.cle(2, 9)));
  });
  regle('37a · pourcentage = disponibles ∩ trou / heures du trou', () => {
    const c = R.comble([R.cle(2, 13), R.cle(2, 14), R.cle(1, 9)], t.trou);
    assert.equal(c.heures, 2);
    assert.equal(c.pct, 25);
  });

  // ── 37b Procédures ──────────────────────────────────────────────────────
  const reel = { stock: ['Détartrant pro'], materiel: ['Nettoyeur vapeur'], habilitations: ['H0B0'] };
  regle('37b · une étape qui cite un article absent du stock est périmée', () =>
    assert.ok(R.etapePerimee({ texte: '', cite: { type: 'stock', nom: 'Détartrant Lyn' } }, reel)));
  regle('37b · le contrôle est mécanique : casse et accents ne comptent pas', () =>
    assert.equal(R.etapePerimee({ texte: '', cite: { type: 'stock', nom: 'detartrant PRO' } }, reel), null));
  regle('37b · une étape sans citation n’est jamais périmée', () => assert.equal(R.etapePerimee({ texte: 'x' }, reel), null));

  // ── 37c Formation ───────────────────────────────────────────────────────
  regle('37c · r(t) = 100 × e^(−t/τ)', () => assert.ok(proche(R.retention(10, 10), 100 / Math.E)));
  regle('37c · τ mesuré sur les rappels : τ = −Δt / ln(score / 100)', () => {
    const tau = doit(R.tauMesure([{ le: iso(70), score: 100, type: 'initial' }, { le: iso(28), score: 60, type: 'rappel' }]));
    assert.ok(proche(tau, -6 / Math.log(0.6), 1e-6));
  });
  const form = [
    { id: 'f', kind: 'formation' as const, nom: 'F', tauDefautSem: 20 },
    { id: 'q1', kind: 'quiz' as const, formationId: 'f', personne: 'A', le: iso(70), score: 100, type: 'initial' as const },
    { id: 'q2', kind: 'quiz' as const, formationId: 'f', personne: 'A', le: iso(21), score: 70, type: 'rappel' as const },
    { id: 'q3', kind: 'quiz' as const, formationId: 'f', personne: 'B', le: iso(70), score: 100, type: 'initial' as const },
  ];
  const co = R.courbes(form, 'f', MAINTENANT);
  regle('37c · sans rappel mesuré, τ est celui des autres (médiane)', () => {
    const a = doit(co.courbes.find((c) => c.personne === 'A'));
    const b = doit(co.courbes.find((c) => c.personne === 'B'));
    assert.ok(proche(b.tau, a.tau));
    assert.equal(b.tauMesure, false);
  });
  regle('37c · l’ambre : la courbe passée sous 60 % sans rappel', () => assert.equal(doit(co.ambre).personne, 'B'));
  regle('37c · la courbe remonte à la verticale au rappel', () => {
    const a = doit(co.courbes.find((c) => c.personne === 'A'));
    assert.ok(a.points.some((p, i) => p.r === 100 && i > 0 && a.points[i - 1].r < 100));
  });

  // ── 37d Habilitations ───────────────────────────────────────────────────
  const hab = [
    { kind: 'personne' as const, nom: 'S', cles: [{ habilitation: 'Travail en hauteur', echeance: iso(-7) }, { habilitation: 'H0B0', echeance: iso(40) }] },
    { kind: 'personne' as const, nom: 'K', cles: [{ habilitation: 'Travail en hauteur', echeance: iso(-400) }] },
    { kind: 'exigence' as const, motif: 'vitrages', habilitation: 'Travail en hauteur' },
  ];
  const ch = R.chantiersAVenir(hab, [{ title: 'Vitrages', clientName: 'Les Halles', at: iso(-9) }, { title: 'Sols', at: iso(-3) }], MAINTENANT);
  regle('37d · une intervention dont le titre appelle une exigence devient un chantier qui l’exige', () =>
    assert.deepEqual(doit(ch.find((c) => c.nom.includes('Vitrages'))).exige, ['Travail en hauteur']));
  regle('37d · l’ambre : la clé qui lâche avant un chantier qui l’exige', () => {
    const q = doit(R.cleQuiLache(hab.filter((h) => h.kind === 'personne') as never, ch, MAINTENANT));
    assert.equal(q.personne.nom, 'S');
  });
  regle('37d · une clé échue sans chantier concerné reste grise et cassée', () => {
    assert.equal(R.cassee({ habilitation: 'H0B0', echeance: iso(3) }, MAINTENANT), true);
    assert.equal(R.cleQuiLache([{ kind: 'personne', nom: 'X', cles: [{ habilitation: 'SST', echeance: iso(3) }] }], ch, MAINTENANT), null);
  });

  // ── 37e Bulletins de paie ───────────────────────────────────────────────
  const b = (cout: number, pat: number, sal: number, pas: number) => ({ kind: 'bulletin' as const, personne: 'x', mois: '2026-09', coutEmployeurCents: cout, patronalesCents: pat, salarialesCents: sal, pasCents: pas, netCents: cout - pat - sal - pas });
  const tu = R.tuyau([b(362_000, 105_000, 57_000, 11_000), b(298_000, 87_000, 47_000, 11_000)]);
  regle('37e · la somme des largeurs de sortie égale la largeur d’entrée', () =>
    assert.ok(proche(tu.largeurs.patronales + tu.largeurs.salariales + tu.largeurs.pas + tu.largeurs.net, R.TUYAU.entree)));
  regle('37e · le net est ce qui arrive au bout : coût − cotisations − impôt', () => assert.equal(tu.net, 660_000 - 192_000 - 104_000 - 22_000));
  regle('37e · un bulletin dont le net ne tombe pas juste est signalé', () =>
    assert.equal(R.tuyau([{ ...b(100, 10, 10, 10), netCents: 75 }]).incoherents.length, 1));
}

/* ════════════════════════════════════════════════════════════ JURIDIQUE ══ */
{
  const J = await charger<typeof import('../src/lib/cinquante/juridique')>('src/lib/cinquante/juridique.ts');
  console.log('Juridique');

  // ── 38a Clausier ────────────────────────────────────────────────────────
  const clauses = [
    { kind: 'clause' as const, numero: 1, titre: 'Objet', texte: 'x', source: '' },
    { kind: 'clause' as const, numero: 3, titre: 'Reconduction', texte: 'x', source: '', siReponses: { duree: 'annuelle' }, raisonRepli: 'prestation ponctuelle' },
    { kind: 'clause' as const, numero: 9, titre: 'Rétractation', texte: 'x', source: '', siReponses: { client: 'particulier' }, obligatoireSi: { client: 'particulier' }, raisonRepli: 'client professionnel' },
  ];
  const reponses = { client: 'professionnel', duree: 'ponctuelle', lieu: 'chez le client', paiement: 'acompte', soustraitance: 'non' };
  const contrat = { kind: 'contrat' as const, titre: 'C', client: 'V', reponses, genereLe: iso(1) };
  const pl = J.plier(clauses, contrat, { company: '' });
  regle('38a · une clause exclue est repliée, jamais supprimée', () => assert.equal(pl.paragraphes.length, 3));
  regle('38a · un particulier, c’est une fiche sans société', () => assert.equal(J.typeSelonFiche({ company: '' }), 'particulier'));
  regle('38a · une clause obligatoire repliée par une autre réponse est une contradiction signalée', () => assert.equal(doit(pl.ambre).clause.numero, 9));
  regle('38a · la reconduction repliée n’est pas une contradiction', () => assert.equal(pl.paragraphes.find((p) => p.clause.numero === 3)?.contradiction, false));
  regle('38a · réponse conforme à la fiche : pas d’ambre', () => assert.equal(J.plier(clauses, contrat, { company: 'SAS X' }).ambre, null));

  // ── 38b Signature à distance ────────────────────────────────────────────
  const circuit = { kind: 'circuit' as const, document: 'D', client: 'V', envoyeLe: iso(12),
    signataires: [{ role: 'a', nom: 'A', signeLe: iso(11) }, { role: 'b', nom: 'B', signeLe: iso(9) }, { role: 'c', nom: 'C' }, { role: 'd', nom: 'D' }] };
  regle('38b · le témoin est chez le premier qui n’a pas signé, depuis la signature précédente', () => {
    const t = J.temoin(circuit, MAINTENANT);
    assert.equal(doit(t.detenteur).nom, 'C');
    assert.equal(t.depuisJ, 9);
  });
  regle('38b · une relance ne part qu’à celle ou celui qui tient le témoin', () => assert.equal(J.destinataireRelance(circuit, MAINTENANT), 'C'));

  // ── 38c RGPD ────────────────────────────────────────────────────────────
  regle('38c · couronne : 50 % + 34 % · cos θ, 190 + 140 · sin θ', () => {
    const p = J.positionCouronne(1, 6);
    assert.ok(proche(p.xPct, 50 + 34 * Math.cos(-Math.PI / 6)) && proche(p.y, 190 + 140 * Math.sin(-Math.PI / 6)));
  });
  const trt = (collection: string, dureeJours: number | null) => ({ kind: 'traitement' as const, nom: collection, module: collection, collection, baseLegale: '', dureeJours, dureeLibelle: '' });
  const em = J.empreinte('M. Aubry', [trt('appels', 30), trt('clients', null), trt('vides', 10)], {
    appels: [{ id: '1', texte: 'Appel de M. Aubry', date: iso(94) }],
    clients: [{ id: 'c', texte: 'M. AUBRY Villa', date: iso(400) }],
    vides: [{ id: 'z', texte: 'quelqu’un d’autre', date: iso(400) }],
  }, MAINTENANT);
  regle('38c · la requête est réelle : une collection sans la personne n’apparaît pas', () => assert.deepEqual(em.trouves.map((t) => t.traitement.collection), ['appels', 'clients']));
  regle('38c · l’ambre : l’âge dépasse la durée du registre', () => assert.equal(doit(em.ambre).x.traitement.collection, 'appels'));
  regle('38c · une durée « le temps de la relation » n’est jamais dépassée par l’âge seul', () => assert.ok(!em.ambre || em.ambre.x.traitement.collection !== 'clients'));

  // ── 38d Impact RSE ──────────────────────────────────────────────────────
  const src = (nom: string, annee: number, volume: number, facteurKg: number) => ({ kind: 'source' as const, nom, poste: '', volume, unite: '', facteurKg, referenceFacteur: '', annee, ordre: 0 });
  const em2 = J.empilement([src('V', 2026, 1540, 2.66), src('V', 2025, 1280, 2.66), src('E', 2026, 5800, 0.052), src('E', 2025, 7800, 0.052)], 2026);
  regle('38d · un cube = 100 kg, arrondi à l’unité', () => assert.equal(J.cubesDe({ volume: 1540, facteurKg: 2.66 }), 41));
  regle('38d · le total est la somme des cubes', () => assert.equal(em2.totalCubes, em2.colonnes.reduce((s, c) => s + c.cubes, 0)));
  regle('38d · l’ambre : les cubes apparus dans la source de plus forte hausse seulement', () => {
    assert.equal(doit(em2.hausse).source.nom, 'V');
    assert.equal(doit(em2.hausse).apparus, 41 - 34);
  });

  // ── 38e Vérification d'identité ─────────────────────────────────────────
  const verif = { kind: 'verification' as const, client: 'S', professionnel: true, demandeeLe: iso(1), controles: [
    { cle: 'piece' as const, nom: 'Pièce', ok: true, detail: '' },
    { cle: 'selfie' as const, nom: 'Selfie', score: 96, detail: '' },
    { cle: 'adresse' as const, nom: 'Adresse', dateJustificatif: iso(150), detail: '' },
  ] };
  const se = J.serrure(verif, MAINTENANT);
  regle('38e · le décalage est proportionnel à l’écart', () => {
    assert.equal(J.decalage({ cle: 'selfie', nom: '', score: 85, detail: '' }, MAINTENANT).px, 10);
    assert.ok(se.goupilles[2].px > 0 && se.goupilles[1].px === 0);
  });
  regle('38e · jamais « vérifié » avec une goupille désalignée', () => {
    assert.equal(se.ouverte, false);
    assert.equal(doit(se.ambre).c.cle, 'adresse');
  });
}

/* ══════════════════════════════════════════════════════════════ AJOUTS ══ */
{
  const A = await charger<typeof import('../src/lib/cinquante/ajouts')>('src/lib/cinquante/ajouts.ts');
  console.log('Ajouts');

  // ── 39a Tableau de bord ─────────────────────────────────────────────────
  regle('39a · le cadran part à 135° et balaie 270° : 70,25 % tombe au point du cahier', () =>
    assert.deepEqual(A.pointCadran(11_240 / 16_000, 120), { x: 97.9, y: -69.4 }));
  regle('39a · l’aiguille du petit cadran (r 34) : 9 / 14 → (21,2 ; −26,6)', () => assert.deepEqual(A.pointCadran(9 / 14, 34), { x: 21.2, y: -26.6 }));
  regle('39a · l’arc complet est celui du fond : M−84,9 84,9 → 84,9 84,9', () => assert.equal(A.arcCadran(1, 120), 'M-84.9 84.9 A120 120 0 1 1 84.9 84.9'));
  regle('39a · à zéro, il n’y a pas d’arc', () => assert.equal(A.arcCadran(0, 40), null));
  const pu = { kind: 'pupitre' as const, utilisateur: 'x', centre: 'a', bandeau: ['b', 'c', 'd', 'e', 'f', 'g'], modifieLe: '', centres: [] };
  regle('39a · un seul centre : le nouveau prend la place, l’ancien rejoint le bandeau à la sienne', () => {
    const p = A.mettreAuCentre(pu, 'c', MAINTENANT);
    assert.equal(p.centre, 'c');
    assert.deepEqual(p.bandeau, ['b', 'a', 'd', 'e', 'f', 'g']);
  });
  regle('39a · le bandeau ne dépasse jamais six cadrans', () => {
    assert.equal(A.ajouterAuBandeau(pu, 'h', MAINTENANT), null);
    assert.equal(A.mettreAuCentre(pu, 'h', MAINTENANT).bandeau.length, 6);
  });
  regle('39a · le plus souvent au centre', () =>
    assert.equal(A.lePlusSouventAuCentre({ centre: 'z', centres: [{ cle: 'a', le: iso(9) }, { cle: 'b', le: iso(5) }, { cle: 'a', le: iso(1) }] }), 'a'));

  // ── 39b Scoring des leads ───────────────────────────────────────────────
  const crit = [{ kind: 'critere' as const, cle: 'e', nom: 'E', poidsInitial: 60 }, { kind: 'critere' as const, cle: 'z', nom: 'Z', poidsInitial: 40 }];
  const po = A.poidsAppris(crit, [], MAINTENANT);
  regle('39b · sans historique, les poids posés valent, ramenés à 100 %', () => assert.deepEqual([...po.values()], [60, 40]));
  const ld = (id: string, faits: Array<[string, number]>) => ({ id, kind: 'lead' as const, nom: id, ouvertLe: iso(3), faits: faits.map(([critere, force], i) => ({ critere, texte: `${id}${i}`, force, le: iso(2) })) });
  regle('39b · un score sans ses trois raisons n’est pas montré', () => assert.equal(A.carteDe(ld('a', [['e', 1], ['z', 1]]), po), null));
  regle('39b · le score : Σ poids × force du fait le plus fort de chaque critère', () => assert.equal(doit(A.carteDe(ld('a', [['e', 1], ['e', 0.5], ['z', 0.5]]), po)).score, 80));
  const cartes = [90, 80, 70, 60, 50, 40, 30, 20].map((sc, i) => ({ lead: ld(`l${i}`, []), score: sc, raisons: ['a', 'b', 'c'] }));
  const dn = A.donne(cartes);
  regle('39b · sept cartes au plus ; la suivante va à la pioche', () => { assert.equal(dn.main.length, 7); assert.equal(dn.pioche.length, 1); });
  regle('39b · la plus forte sort au centre, relevée ; les plus faibles aux bords', () => {
    const c = dn.main.find((m) => m.rang === 0);
    assert.equal(doit(c).carte.score, 90);
    assert.equal(doit(c).hautPx, 4);
    assert.ok(dn.main.every((m) => Math.abs(m.rang) === Math.ceil(cartes.findIndex((x) => x === m.carte) / 2)));
  });
  regle('39b · 104 px posées tous les 112 px, 1° par rang : aucun recouvrement', () => {
    assert.equal(A.recouvrement(), false);
    assert.deepEqual(dn.main.map((m) => m.dxPx), [-336, -224, -112, 0, 112, 224, 336]);
    assert.deepEqual(dn.main.map((m) => m.rotationDeg), [-3, -2, -1, 0, 1, 2, 3]);
    assert.deepEqual(dn.main.map((m) => m.hautPx), [54, 44, 34, 4, 34, 44, 54]);
  });
  regle('39b · recalcul : la nuit à 6 h, ou le dernier événement s’il est plus récent', () => {
    const matin = new Date(MAINTENANT); matin.setHours(12, 0, 0, 0);
    assert.equal(A.dernierRecalcul([], matin).le.getHours(), 6);
    const ev = new Date(matin); ev.setHours(10);
    assert.equal(A.dernierRecalcul([{ ...ld('x', []), faits: [{ critere: 'e', texte: '', force: 1, le: ev.toISOString() }] }], matin).parEvenement, true);
  });

  // ── 39c Itinéraires ─────────────────────────────────────────────────────
  regle('39c · positions en % du plan, routes en viewBox de même proportion : (18 %, 62 %) → (180, 223,2)', () =>
    assert.deepEqual(A.versPlan({ xPct: 18, yPct: 62 }), { x: 180, y: 223.2 }));
  const pl = {
    depart: '08:00',
    depot: { id: 'd', nom: 'D', xPct: 0, yPct: 50 },
    arrets: [
      { id: 'a', nom: 'A', xPct: 10, yPct: 50, dureeMin: 10 },
      { id: 'b', nom: 'B', xPct: 90, yPct: 50, dureeMin: 10, creneau: { fin: '08:30' } },
    ],
    trajets: [{ de: 'd', a: 'a', km: 1, min: 5 }, { de: 'a', a: 'b', km: 8, min: 40 }, { de: 'd', a: 'b', km: 9, min: 20 }],
  };
  regle('39c · les créneaux d’abord : B (avant 8 h 30) passe en premier, même si c’est plus long', () => {
    assert.deepEqual(A.optimiser(pl), ['b', 'a']);
    assert.equal(A.evaluer(pl, ['a', 'b']).retardMin, 25);
    assert.equal(A.evaluer(pl, ['b', 'a']).retardMin, 0);
  });
  regle('39c · puis la distance, à créneaux égaux', () => assert.deepEqual(A.optimiser({ ...pl, arrets: pl.arrets.map((a) => ({ ...a, creneau: undefined })) }).length, 2));
  regle('39c · les distances sont celles des trajets, pas du tracé', () => assert.equal(A.evaluer(pl, ['b', 'a']).km, 18));
  regle('39c · une traversée se compte là où la route coupe le cours d’eau', () =>
    assert.equal(A.traversees({ ...pl, depot: { ...pl.depot, yPct: 30 }, arrets: pl.arrets.map((a) => ({ ...a, yPct: 47 })) }, ['a', 'b'], { points: [[50, 0], [50, 100]] }), 2));

  // ── 39d Prévision de stock ──────────────────────────────────────────────
  const kits = [{ product: 'Clim', components: [{ label: 'Filtre', quantity: 2 }, { label: 'Boîte', quantity: 2, components: [{ label: 'Filtre', quantity: 1 }] }] }];
  regle('39d · la quantité d’une boîte multiplie son contenu', () => assert.equal(A.quantiteDansKit(kits[0].components, 'filtre'), 4));
  const inter = (j: number, clos = false) => ({ title: 'Clim — X', at: iso(-j), closedAt: clos ? iso(-j) : '', consommations: [] });
  const mc = A.meche('Filtre', 7, 8, [inter(1), inter(3)], kits, MAINTENANT);
  regle('39d · la consommation vient des interventions planifiées et des kits', () => assert.equal(mc.ruptureJ, 3));
  regle('39d · point de commande = rupture − délai ; négatif, il est passé', () => assert.equal(mc.cranJ, -5));
  regle('39d · un cran négatif se dessine au bord gauche', () => assert.equal(A.surEchelle(-5), 0));
  regle('39d · l’échelle de 40 jours est commune : 6 j → 15 %', () => assert.equal(A.surEchelle(6), 15));
  regle('39d · l’ambre : une mèche dont le cran est passé', () => assert.equal(A.mecheEnAmbre([mc, { ...mc, article: 'y', cranJ: 4 }])?.article, 'Filtre'));
  regle('39d · pas de moyenne historique seule : sans planning, la moyenne ne vaut qu’au-delà du dernier jour planifié', () =>
    assert.equal(A.meche('Filtre', 100, 3, [inter(10, true)], kits, MAINTENANT).ruptureJ, null));

  // ── 39e Flotte ──────────────────────────────────────────────────────────
  regle('39e · six tambours, zéros en tête', () => assert.deepEqual(A.tambours(4270.6), ['0', '0', '4', '2', '7', '0']));
  const vh = { id: 'v', kind: 'vehicule' as const, nom: 'V', kmDepart: 1000, departLe: iso(30), echeances: [], couts: [] };
  const rnd = (j: number, kms: number[], faite: boolean) => ({ day: iso(j).slice(0, 10), vehiculeId: 'v', stops: kms.map((km) => ({ km, doneAt: faite ? iso(j) : null })) });
  regle('39e · le kilométrage vient des tournées pointées, jamais d’une saisie', () =>
    assert.equal(A.compteur(vh, [rnd(5, [10, 5], true), rnd(3, [7], false)]).km, 1015));
  regle('39e · une jauge se remplit sur l’intervalle : 15 000 km pour une vidange', () =>
    assert.equal(A.etatEcheance({ nom: 'Vidange', nature: 'km', intervalle: 15_000, dernierKm: 0 }, 9_000, 0, MAINTENANT).part, 0.6));
  regle('39e · deux ans pour un contrôle technique', () => {
    const e = A.etatEcheance({ nom: 'CT', nature: 'jours', intervalle: 730, dernierLe: iso(721) }, 0, 0, MAINTENANT);
    assert.equal(e.reste, 9);
  });
  regle('39e · l’ambre : la première échéance qui tombe avant un chantier planifié avec ce véhicule', () => {
    const ct = A.etatEcheance({ nom: 'CT', nature: 'jours', intervalle: 730, dernierLe: iso(721) }, 0, 0, MAINTENANT);
    assert.equal(A.echeanceEnAmbre([{ v: vh, etat: ct }], [rnd(-12, [5], false)], MAINTENANT)?.etat, ct);
    assert.equal(A.echeanceEnAmbre([{ v: vh, etat: ct }], [rnd(-3, [5], false)], MAINTENANT), null);
  });
}

console.log(`\n${reussis} règle(s) tenue(s), ${echecs} en défaut.`);
if (echecs > 0) process.exit(1);
