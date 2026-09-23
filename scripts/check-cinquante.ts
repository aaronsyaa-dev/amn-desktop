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

console.log(`\n${reussis} règle(s) tenue(s), ${echecs} en défaut.`);
if (echecs > 0) process.exit(1);
