/**
 * Contrôle de la LOGIQUE DE « CRÉER ET PRODUIRE » (LOT-06) — `npm run check:creer`.
 *
 * Sans réseau, sans navigateur. Les calculs des 15 écrans (`src/refonte/creer/`) sont
 * exercés hors interface, d'abord sur des cas écrits à la main (les règles des fiches v3,
 * rubrique 6, avec les ordres de grandeur des maquettes), puis sur les jeux fictifs de SIM
 * (`src/refonte/donnees/`, volumes « peu », « normal » et « beaucoup »).
 *
 *   npm run check:creer
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
    'commun', 'stock', 'chantiers', 'marque', 'video', 'pagePublique', 'tournees', 'materiel', 'catalogue',
    'reservations', 'commandes', 'boutique', 'flotte', 'photos', 'qualite', 'ligneDeProduction',
  ].map((f) => `export * as ${f} from '../src/refonte/creer/${f}';`).join('\n') +
    "\nexport * as mots from '../src/refonte/creer/i18n';\nexport * as monde from '../src/refonte/donnees';",
);
const { commun: C, stock: S, chantiers: H, marque: MQ, video: V, pagePublique: P, tournees: T, materiel: MA, catalogue: CA, reservations: R, commandes: CM, boutique: B, flotte: FL, photos: PH, qualite: Q, ligneDeProduction: L, mots, monde: D } = M;

const NBSP = ' ';

/* ── Communs ─────────────────────────────────────────────────────────────── */
console.log('Créer et produire — communs\n');

await dit('les jours : écarts, mois, semaine ISO (30 oct. 2026 = semaine 44)', () => {
  assert.equal(C.ecartJours('2026-10-30', '2026-11-05'), 6);
  assert.equal(C.ajouterJours('2026-10-30', 3), '2026-11-02');
  assert.equal(C.ajouterMois('2026-01-31', 1), '2026-02-28');
  assert.equal(C.ajouterMois('2026-11-15', 2), '2027-01-15');
  assert.equal(C.semaineIso('2026-10-30').semaine, 44);
  assert.equal(C.semaineIso('2027-01-01').semaine, 53);
  assert.equal(C.lundiDe('2026-10-30'), '2026-10-26');
  assert.equal(C.jourDeSemaine('2026-10-30'), 4);
});
await dit('les semaines citées par numéro seul passent le cap de l’année', () => {
  assert.equal(C.semainesDepuis(44, '2026-10-30'), 0);
  assert.equal(C.semainesDepuis(40, '2026-10-30'), 4);
  assert.equal(C.semainesDepuis(2, '2026-12-28'), -2); // semaine 53 de 2026 : la semaine 2 citée est celle de janvier, dans deux semaines
});
await dit('les heures de Paris tiennent compte de l’heure d’été et d’hiver', () => {
  assert.equal(C.minutesParis('2026-10-30T09:15:00.000Z'), 10 * 60 + 15); // CET (+1) depuis le 25 oct.
  assert.equal(C.minutesParis('2026-10-20T08:00:00.000Z'), 10 * 60); // CEST (+2)
  assert.equal(C.jourParis('2026-10-29T23:30:00.000Z'), '2026-10-30');
});
await dit('les durées : « 2 h », « 2 h 30 », « 1 h 15 », « 45 min »', () => {
  assert.equal(C.formaterDuree(120), `2${NBSP}h`);
  assert.equal(C.formaterDuree(150), `2${NBSP}h${NBSP}30`);
  assert.equal(C.formaterDuree(75), `1${NBSP}h${NBSP}15`);
  assert.equal(C.formaterDuree(45), `45${NBSP}min`);
  assert.equal(C.hhmmDe(570), '09:30');
  assert.equal(C.minutesDe('09:30'), 570);
});
await dit('les libellés de dates sont français et stables', () => {
  assert.equal(C.jourEtMois('2026-11-04'), `4${NBSP}nov.`);
  assert.equal(C.jourCourtEtNumero('2026-11-05'), 'jeu. 5');
  assert.equal(C.capitale('janv.'), 'Janv.');
});

/* ── H15 Stock ───────────────────────────────────────────────────────────── */
console.log('\nH15 · Stock\n');

const art = (id: string, q: number, seuil: number, extra: Record<string, unknown> = {}) => ({
  id, nom: id, seuilAlerte: seuil, prixAchatCents: 1000, emplacement: 'Entrepôt', fournisseurId: 'f1',
  mouvements: [{ le: '2026-01-05', delta: q, motif: 'Réception' }], ...extra,
});

await dit('la quantité est la somme des mouvements, par emplacement', () => {
  const a = { ...art('a', 0, 10), mouvements: [{ le: '2026-01-01', delta: 30, motif: 'Réception' }, { le: '2026-01-02', delta: -8, motif: 'Vente', emplacement: 'Camionnette 1' }] };
  assert.equal(S.quantiteEnStock(a), 22);
  assert.equal(S.quantiteEnStock(a, 'Camionnette 1'), -8);
  assert.equal(S.quantiteEnStock(a, 'Entrepôt'), 30);
});
await dit('le niveau cible vaut 2 × seuil par défaut ; le seuil est à mi-tube, pas à la cible', () => {
  assert.equal(S.niveauCible({ seuilAlerte: 10 }), 20);
  assert.equal(S.niveauCible({ seuilAlerte: 10, niveauCible: 50 }), 50);
  assert.equal(S.niveauCible({ seuilAlerte: 0 }), 1);
  assert.equal(S.reperSeuil({ seuilAlerte: 10 }), 0.5);
  assert.equal(S.remplissage(40, 20), 1);
  assert.equal(S.remplissage(-3, 20), 0);
  assert.equal(S.remplissage(5, 20), 0.25);
});
await dit('les états : rupture, sous le seuil (ambre, ou rouge à 25 % du seuil), en stock', () => {
  assert.deepEqual(S.etatDuStock(0, 10), { etat: 'rupture', ton: 'rouge' });
  assert.deepEqual(S.etatDuStock(-2, 10), { etat: 'rupture', ton: 'rouge' });
  assert.deepEqual(S.etatDuStock(2, 10), { etat: 'sous-seuil', ton: 'rouge' });
  assert.deepEqual(S.etatDuStock(2.5, 10), { etat: 'sous-seuil', ton: 'rouge' });
  assert.deepEqual(S.etatDuStock(3, 10), { etat: 'sous-seuil', ton: 'ambre' });
  assert.deepEqual(S.etatDuStock(10, 10), { etat: 'sous-seuil', ton: 'ambre' });
  assert.deepEqual(S.etatDuStock(11, 10), { etat: 'en-stock', ton: 'neutre' });
});
await dit('à surveiller = sous le seuil ou en rupture ; valorisation = Σ quantité × prix d’achat', () => {
  const liste = [art('a', 4, 10), art('b', 50, 10), art('c', 0, 5)];
  assert.deepEqual(S.articlesASurveiller(liste).map((x: any) => x.id), ['a', 'c']);
  assert.equal(S.valorisationCents(liste), (4 + 50 + 0) * 1000);
  assert.deepEqual(S.emplacements([art('a', 1, 1), { ...art('b', 1, 1), emplacement: 'Camionnette 1' }]), ['Entrepôt', 'Camionnette 1']);
});
await dit('l’ordre des jauges : sous le seuil d’abord, le plus critique à gauche', () => {
  const liste = [art('zebre', 50, 10), art('b', 4, 10), art('c', 1, 10), art('alpha', 60, 10)];
  assert.deepEqual(S.ordreDesJauges(liste).map((x: any) => x.id), ['c', 'b', 'alpha', 'zebre']);
});
await dit('en route : quantités non reçues et date la plus proche ; sous le seuil sans commande', () => {
  const a = art('a', 4, 10);
  const livraisons = [{ articleId: 'a', quantite: 24, le: '2026-11-03' }, { articleId: 'a', quantite: 6, le: '2026-11-10' }, { articleId: 'z', quantite: 9, le: '2026-11-03' }];
  assert.deepEqual(S.enRoute(a, livraisons), { quantite: 30, le: '2026-11-03' });
  assert.deepEqual(S.enRoute(art('q', 1, 2), livraisons), { quantite: 0, le: null });
  assert.deepEqual(S.sousSeuilSansCommande([a, art('b', 2, 10)], livraisons).map((x: any) => x.id), ['b']);
});
await dit('la consommation : sorties des 30 derniers jours, hors inventaire ; sans sortie, pas d’historique', () => {
  const a = { ...art('a', 0, 10), mouvements: [
    { le: '2026-01-01', delta: 100, motif: 'Réception' },
    { le: '2026-10-10', delta: -15, motif: 'Vente' },
    { le: '2026-10-20', delta: -15, motif: 'Perte' },
    { le: '2026-10-25', delta: -50, motif: 'Inventaire' },
    { le: '2026-08-01', delta: -40, motif: 'Vente' },
  ] };
  assert.equal(S.consommationJournaliere(a, '2026-10-30'), 1); // 30 / 30
  assert.equal(S.consommationJournaliere(art('b', 5, 1), '2026-10-30'), null);
});
await dit('la projection : rupture, évitée par une livraison, aucune, sans historique', () => {
  const sorties = (q: number, parJour: number) => ({ ...art('a', 0, 5), mouvements: [{ le: '2026-01-01', delta: q + 30 * parJour, motif: 'Réception' }, { le: '2026-10-15', delta: -30 * parJour, motif: 'Vente' }] });
  // 12 en stock, 2 par jour : rupture au 6e jour
  const p1 = S.projeterRupture(sorties(12, 2), [], '2026-10-30');
  assert.equal(p1.statut, 'rupture');
  assert.equal(p1.dansJours, 6);
  assert.equal(p1.jourRupture, '2026-11-05');
  // une livraison de 40 le 3 nov. évite la rupture dans les 14 jours
  const p2 = S.projeterRupture(sorties(12, 2), [{ articleId: 'a', quantite: 40, le: '2026-11-03' }], '2026-10-30');
  assert.equal(p2.statut, 'evitee');
  assert.equal(p2.jourRupture, '2026-11-05');
  assert.equal(p2.livraisonLe, '2026-11-03');
  // une livraison trop petite ne suffit pas : la rupture est repoussée mais reste
  const p3 = S.projeterRupture(sorties(12, 2), [{ articleId: 'a', quantite: 4, le: '2026-11-03' }], '2026-10-30');
  assert.equal(p3.statut, 'rupture');
  assert.equal(p3.dansJours, 8);
  // beaucoup de stock : aucune rupture
  assert.equal(S.projeterRupture(sorties(500, 2), [], '2026-10-30').statut, 'aucune');
  assert.equal(S.projeterRupture(art('x', 3, 1), [], '2026-10-30').statut, 'sans-historique');
});
await dit('« ruptures à venir » : non évitées d’abord, 3 couloirs puis « voir les autres »', () => {
  const mk = (id: string, q: number) => ({ ...art(id, 0, 5), mouvements: [{ le: '2026-01-01', delta: q + 30, motif: 'Réception' }, { le: '2026-10-15', delta: -30, motif: 'Vente' }] });
  const arts = [mk('a', 3), mk('b', 5), mk('c', 7), mk('d', 9), mk('e', 400)];
  const r = S.rupturesAVenir(arts, [{ articleId: 'c', quantite: 100, le: '2026-11-02' }], '2026-10-30');
  assert.deepEqual(r.aCommander.map((p: any) => p.articleId), ['a', 'b', 'd']);
  assert.equal(r.visibles.length, 3);
  assert.equal(r.visibles[0].articleId, 'a');
  assert.equal(r.restants, 1);
  assert.equal(r.aucune, false);
  assert.equal(S.rupturesAVenir([mk('z', 900)], [], '2026-10-30').aucune, true);
});
await dit('les mouvements : stock négatif refusé, correction par mouvement inverse, une seule alerte', () => {
  const a = art('a', 4, 10);
  assert.deepEqual(S.verifierMouvement(a, -5), { ok: false, raison: 'stock-negatif', disponible: 4 });
  assert.deepEqual(S.verifierMouvement(a, -4), { ok: true });
  assert.deepEqual(S.mouvementInverse({ le: '2026-10-01', delta: -3, motif: 'Vente' }, '2026-10-02'), { le: '2026-10-02', delta: 3, motif: 'Inventaire' });
  assert.equal(S.franchitLeSeuil(12, 9, 10), true);
  assert.equal(S.franchitLeSeuil(9, 7, 10), false); // déjà dessous : pas de seconde alerte
  assert.equal(S.franchitLeSeuil(12, 11, 10), false);
});
await dit('la commande groupée : par fournisseur, un article de plus si cela évite les frais de port', () => {
  const fournisseurs = [{ id: 'f1', nom: 'Rexel', francoCents: 35000, fraisPortCents: 1500 }];
  const a = { ...art('a', 2, 10), prixAchatCents: 1200 }; // cible 20, il manque 18
  const proche = { ...art('b', 12, 10), prixAchatCents: 2000 }; // 12 ≤ 15, cible 20, il manque 8
  const loin = { ...art('c', 50, 10), prixAchatCents: 100 };
  const g = S.commandeGroupee([a, proche, loin], fournisseurs, [], '2026-10-30');
  assert.equal(g.length, 1);
  assert.equal(g[0].lignes.find((l: any) => l.articleId === 'a').quantite, 18);
  assert.equal(g[0].articleAjoute, 'b');
  assert.equal(g[0].economieCents, 1500);
  assert.equal(g[0].totalCents, 18 * 1200 + 8 * 2000);
  // sans franco : pas d'ajout
  const sans = S.commandeGroupee([a, proche], [{ id: 'f1', nom: 'Rexel' }], [], '2026-10-30');
  assert.equal(sans[0].articleAjoute, null);
  assert.equal(sans[0].economieCents, 0);
  assert.equal(S.quantiteACommander(a, [{ articleId: 'a', quantite: 5, le: '2026-11-03' }]), 13);
});

/* ── H16 Chantiers ───────────────────────────────────────────────────────── */
console.log('\nH16 · Chantiers\n');

const chantier = (extra: Record<string, unknown> = {}) => ({
  id: 'c1', nom: 'Dupont Rénovation', debutLe: '2026-10-05', finPrevueLe: '2026-12-18', budgetCents: 22_600_00, depenseCents: 14_100_00,
  etapes: [
    { nom: 'Dépose', semaine: 41, faite: true, poids: 25 },
    { nom: 'Câblage', semaine: 42, faite: true, poids: 25 },
    { nom: 'Pose', semaine: 44, faite: false, poids: 20, partRealisee: 0.4 },
    { nom: 'Contrôle', semaine: 46, faite: false, poids: 15 },
    { nom: 'Réception', semaine: 48, faite: false, poids: 15 },
  ], ...extra,
});

await dit('l’avancement est pondéré : 58 % avec 2 étapes sur 5 faites et la 3e à 40 %', () => {
  assert.equal(H.avancement(chantier()), 58);
  assert.equal(H.avancement(chantier({ etapes: [] , avancementSaisi: 33 })), 33);
  assert.equal(H.avancement(chantier({ etapes: chantier().etapes.map((e: any) => ({ ...e, faite: true })) })), 100);
  // sans poids : tous égaux
  assert.equal(H.avancement({ ...chantier(), etapes: [{ nom: 'a', semaine: 1, faite: true }, { nom: 'b', semaine: 2, faite: false }] }), 50);
});
await dit('le budget consommé et le rythme : en phase (< 5 points), à surveiller, à démarrer, sans budget', () => {
  assert.equal(H.budgetConsomme(chantier()), 62);
  assert.equal(H.rythme(chantier()), 'en-phase'); // 62 − 58 = 4
  assert.equal(H.rythme(chantier({ depenseCents: 15_000_00 })), 'a-surveiller'); // 66 − 58 = 8
  assert.equal(H.rythme(chantier({ etapes: [{ nom: 'a', semaine: 44, faite: false, poids: 1 }], depenseCents: 0 })), 'a-demarrer');
  assert.equal(H.rythme(chantier({ budgetCents: 0 })), 'sans-budget');
  assert.equal(H.budgetConsomme(chantier({ budgetCents: 0 })), null);
  assert.equal(H.budgetEnAmbre(chantier({ depenseCents: 21_000_00 })), true);
  assert.equal(H.budgetEnAmbre(chantier()), false);
});
await dit('le statut : en cours, en retard (fin dépassée ou étape hors de sa semaine), à venir, terminé', () => {
  assert.equal(H.statutDuChantier(chantier(), '2026-10-30'), 'En cours');
  assert.equal(H.statutDuChantier(chantier({ finPrevueLe: '2026-10-20' }), '2026-10-30'), 'En retard');
  assert.equal(H.statutDuChantier(chantier(), '2026-11-16'), 'En retard'); // étape « Pose » prévue semaine 44, nous sommes en semaine 47
  assert.equal(H.statutDuChantier(chantier({ debutLe: '2026-12-01', etapes: [{ nom: 'a', semaine: 49, faite: false }] }), '2026-10-30'), 'À venir');
  assert.equal(H.statutDuChantier(chantier({ etapes: chantier().etapes.map((e: any) => ({ ...e, faite: true })) }), '2026-10-30'), 'Terminé');
});
await dit('le sous-titre et le compteur : « 4 en cours et 1 à démarrer » ; à surveiller', () => {
  const liste = [chantier(), chantier({ id: 'c2' }), chantier({ id: 'c3', depenseCents: 20_000_00 }), chantier({ id: 'c4', finPrevueLe: '2026-10-01' }), chantier({ id: 'c5', debutLe: '2026-12-01', etapes: [{ nom: 'x', semaine: 49, faite: false }], depenseCents: 0 })];
  const r = H.resumeDesChantiers(liste, '2026-10-30');
  assert.deepEqual(r, { enCours: 4, aDemarrer: 1, termines: 0, aSurveiller: 2 });
  assert.deepEqual(H.chantiersASurveiller(liste, '2026-10-30').map((c: any) => c.id), ['c3', 'c4']);
  assert.equal(H.chantierParDefaut(liste, '2026-10-30').id, 'c3');
  assert.equal(H.chantierParDefaut([], '2026-10-30'), null);
});
await dit('le dépensé : dépenses rattachées + sorties de stock chantier + heures', () => {
  assert.equal(H.depenseDuChantier({ depensesCents: [10000, 5000], sortiesStock: [{ quantite: -3, prixAchatCents: 1000 }], heuresCents: 2000 }), 20000);
  assert.equal(H.depenseDuChantier({}), 0);
});
await dit('le bilan de la semaine, les interventions et les livraisons', () => {
  const liste = [chantier(), chantier({ id: 'c2', etapes: [{ nom: 'a', semaine: 44, faite: true }, { nom: 'b', semaine: 44, faite: false }, { nom: 'c', semaine: 50, faite: false }] })];
  assert.deepEqual(H.bilanDeLaSemaine(liste, '2026-10-30'), { prevues: 3, bouclees: 1, toutesALHeure: true });
  assert.equal(H.bilanDeLaSemaine(liste, '2026-11-16').toutesALHeure, false);
  const interv = [
    { id: 'i1', chantierId: 'c1', jour: '2026-11-02', debut: '08:00', libelle: 'Pose des prises' },
    { id: 'i2', chantierId: 'c1', jour: '2026-11-09', debut: '08:00', libelle: 'Contrôle' },
    { id: 'i3', chantierId: 'c2', jour: '2026-10-30', debut: '14:00', libelle: 'Repérage' },
  ];
  const liv = [{ chantierId: 'c1', jour: '2026-11-03', libelle: 'Rexel et Legrand' }];
  assert.equal(H.prochaineIntervention('c1', interv, '2026-10-30').id, 'i1');
  assert.equal(H.prochaineIntervention('zz', interv, '2026-10-30'), null);
  assert.equal(H.livraisonEnRetardSurIntervention(interv[0], liv)?.libelle, 'Rexel et Legrand'); // livrée le 3, l'intervention est le 2
  assert.equal(H.livraisonEnRetardSurIntervention(interv[1], liv), null);
  const agenda = H.agendaDeLaSemaine(interv, liv, '2026-10-30');
  assert.deepEqual(agenda.map((j: any) => j.jour), ['2026-10-30', '2026-11-02', '2026-11-03']);
  assert.equal(agenda.flatMap((j: any) => j.lignes).length, 3);
  assert.deepEqual(H.libelleEtape('Mise en service de la baie'), { court: 'Mise en servi…', tronque: true });
  assert.deepEqual(H.libelleEtape('Dépose'), { court: 'Dépose', tronque: false });
});

/* ── H17 Visuels et marque ───────────────────────────────────────────────── */
console.log('\nH17 · Visuels et marque\n');

const marque = (extra: Record<string, unknown> = {}) => ({
  logos: [{ variante: 'fond noir', format: 'SVG' }, { variante: 'fond clair', format: 'SVG' }],
  palette: [{ nom: 'A', hex: '#8fbf7a', part: 50 }, { nom: 'B', hex: '#0c0c0d', part: 30 }, { nom: 'C', hex: '#ededed', part: 20 }],
  typographie: { famille: 'Inter', graisses: [400, 600] }, modelesVisuels: [{ nom: 'Carré', format: 'Carré' }], reglesAEviter: ['Ne pas déformer le logo'], ...extra,
});

await dit('les chapitres : contenu minimal, ce qui manque, kit exportable', () => {
  assert.equal(MQ.chapitresComplets(marque()), 5);
  const vide = marque({ logos: [], palette: [], typographie: null, modelesVisuels: [], reglesAEviter: [] });
  assert.equal(MQ.chapitresComplets(vide), 0);
  assert.deepEqual(MQ.etatDesChapitres(vide).map((c: any) => c.manque), ['logo', 'couleurs', 'police', 'modele', 'regle']);
  assert.equal(MQ.kitExportable(vide), false);
  assert.equal(MQ.kitExportable(marque()), true);
  assert.equal(MQ.progressionDuLivre(marque({ reglesAEviter: [] })), 80);
  assert.equal(MQ.chapitresComplets(marque({ palette: marque().palette.slice(0, 2) })), 4);
});
await dit('les codes de couleur sont en majuscules, zéro conservé', () => {
  assert.equal(MQ.hexNormalise('#0c0c0d'), '#0C0C0D');
  assert.equal(MQ.hexNormalise('8fbf7a'), '#8FBF7A');
  assert.equal(MQ.hexNormalise('#12'), null);
});
await dit('les parts de couleur totalisent toujours 100 ; sous 9 %, pas d’étiquette', () => {
  const parts = MQ.partsDeCouleurs([{ nom: 'a', hex: '#111111', part: 33 }, { nom: 'b', hex: '#222222', part: 33 }, { nom: 'c', hex: '#333333', part: 34 }, { nom: 'd', hex: '#444444', part: 8 }]);
  assert.equal(parts.reduce((s: number, p: any) => s + p.part, 0), 100);
  assert.equal(parts[3].etiquette, false);
  assert.equal(parts[0].etiquette, true);
  const egales = MQ.partsDeCouleurs([{ nom: 'a', hex: '#111111' }, { nom: 'b', hex: '#222222' }, { nom: 'c', hex: '#333333' }]);
  assert.equal(egales.reduce((s: number, p: any) => s + p.part, 0), 100);
  assert.deepEqual(MQ.partsDeCouleurs([]), []);
  assert.equal(MQ.colonnesDePalette(6), 3);
  assert.equal(MQ.colonnesDePalette(7), 4);
});
await dit('le contrôle à l’export avertit sans jamais bloquer', () => {
  const ok = MQ.controleExport({ couleurs: ['#8FBF7A'], logo: { largeur: 200, hauteur: 100, largeurOrigine: 400, hauteurOrigine: 200, rotationDeg: 0, effets: [], margePx: 60, hauteurSymbolePx: 100 } }, marque());
  assert.deepEqual(ok, { bloquant: false, avertissements: [] });
  const mal = MQ.controleExport({ couleurs: ['#ff00ff'], logo: { largeur: 300, hauteur: 100, largeurOrigine: 400, hauteurOrigine: 200, rotationDeg: 15, effets: ['ombre'], margePx: 10, hauteurSymbolePx: 100 } }, marque());
  assert.equal(mal.bloquant, false);
  assert.deepEqual([...mal.avertissements].sort(), ['couleur-hors-palette', 'logo-deforme', 'logo-effet', 'logo-pivote', 'marge-non-respectee']);
  assert.equal(MQ.zoneDeProtection(80), 40);
});

/* ── MR01 Vidéo ──────────────────────────────────────────────────────────── */
console.log('\nMR01 · Vidéo\n');

await dit('les étapes et l’avancement : 100 % seulement à « Publiée »', () => {
  assert.equal(V.etapeNormalisee('Tournage'), 'Enregistrement');
  assert.equal(V.etapeNormalisee('Montage'), 'Montage');
  assert.equal(V.avancementVideo({ id: 'v', titre: 't', etape: 'Relecture', avancement: 100 }), 99);
  assert.equal(V.avancementVideo({ id: 'v', titre: 't', etape: 'Publiée', avancement: 40 }), 100);
  const vs = [{ id: '1', titre: 'a', etape: 'Montage', avancement: 50 }, { id: '2', titre: 'b', etape: 'Idée', avancement: 0 }, { id: '3', titre: 'c', etape: 'Publiée', avancement: 100 }, { id: '4', titre: 'd', etape: 'Relecture', avancement: 90 }];
  assert.deepEqual(V.videosEnCours(vs).map((v: any) => v.id), ['1', '4']);
});
await dit('la ligne d’état : vues avec espace insécable, prochaine action datée, étape', () => {
  assert.equal(V.vuesLibelle(12400), `12 400${NBSP}vues`);
  assert.equal(V.vuesLibelle(1), `1${NBSP}vue`);
  assert.deepEqual(V.ligneEtat({ id: 'v', titre: 't', etape: 'Publiée', avancement: 100, vues: 12400 }), { type: 'vues', vues: 12400 });
  assert.deepEqual(V.ligneEtat({ id: 'v', titre: 't', etape: 'Idée', avancement: 0, prevueLe: '2026-11-03' }), { type: 'prochaine', etape: 'Idée', le: '2026-11-03' });
  assert.deepEqual(V.ligneEtat({ id: 'v', titre: 't', etape: 'Montage', avancement: 40, prevueLe: '2026-11-03' }), { type: 'etape', etape: 'Montage' });
});
await dit('le sous-titre : « presque prête » dès 80 %, retours à traiter', () => {
  const retours = [{ id: 'r1', auteur: 'a', t: 10, texte: 'x', etat: 'À traiter' }, { id: 'r2', auteur: 'b', t: 40, texte: 'y', etat: 'Traité' }];
  assert.deepEqual(V.sousTitreDePage({ id: 'v', titre: 't', etape: 'Relecture', avancement: 85 }, retours), { etat: { type: 'presque-prete' }, retoursATraiter: 1 });
  assert.deepEqual(V.sousTitreDePage({ id: 'v', titre: 't', etape: 'Montage', avancement: 55 }, []).etat, { type: 'en-etape', etape: 'Montage' });
  assert.deepEqual(V.compteRelecture(retours), { traites: 1, total: 2 });
  assert.deepEqual(V.marqueursDeRegle(retours).map((m: any) => m.ton), ['orange', 'vert']);
});
await dit('la frise : fenêtres de zoom bornées, positions, plan sous la tête de lecture', () => {
  assert.deepEqual(V.fenetreVisible('tout', 50, 120), { debut: 0, fin: 120 });
  assert.deepEqual(V.fenetreVisible('30s', 60, 120), { debut: 45, fin: 75 });
  assert.deepEqual(V.fenetreVisible('30s', 2, 120), { debut: 0, fin: 30 });
  assert.deepEqual(V.fenetreVisible('10s', 119, 120), { debut: 110, fin: 120 });
  assert.deepEqual(V.fenetreVisible('30s', 10, 20), { debut: 0, fin: 20 });
  assert.equal(V.positionPx(60, { debut: 0, fin: 120 }, 600), 300);
  const plans = [{ id: 'p1', debut: 0, fin: 10 }, { id: 'p2', debut: 10, fin: 25 }];
  assert.equal(V.planSousLaTete(plans, 10).id, 'p2');
  assert.equal(V.planSousLaTete(plans, 25), null);
  assert.equal(V.codeTemporel(84), '01:24');
  assert.equal(V.niveauMusiqueEffectif(-12, true), -22);
  assert.equal(V.niveauMusiqueEffectif(-12, false), -12);
});
await dit('« enregistré à l’instant » puis relatif ; série « une vidéo par semaine » sans reproche', () => {
  assert.deepEqual(V.enregistreIl(1000, 30_000), { type: 'instant' });
  assert.deepEqual(V.enregistreIl(0, 2 * 60_000 + 5), { type: 'minutes', n: 2 });
  assert.deepEqual(V.enregistreIl(0, 3 * 3_600_000), { type: 'heures', n: 3 });
  const s = V.serieUneVideoParSemaine(['2026-10-12', '2026-10-21', '2026-09-30'], '2026-10-30');
  assert.equal(s.cases.length, 6);
  assert.equal(s.cases[5].debut, '2026-10-26');
  assert.equal(s.cases[5].enCours, true);
  assert.equal(s.cases[5].cochee, false); // la semaine en cours n'est pas manquée : elle est « en cours »
  assert.equal(s.faites, 3);
  assert.equal(V.serieUneVideoParSemaine([], '2026-10-30').faites, 0);
  assert.deepEqual(V.publicationPossible({ ecrire: true, publier: true, enLigne: false }), { ok: false, raison: 'hors-ligne' });
  assert.deepEqual(V.publicationPossible({ ecrire: true, publier: false, enLigne: true }), { ok: false, raison: 'droit' });
  assert.deepEqual(V.publicationPossible({ ecrire: true, publier: true, enLigne: true }), { ok: true });
  assert.ok(V.TOUJOURS_PRIVE.includes('rushes') && !V.PUBLIC_APRES_CONFIRMATION.includes('rushes'));
});

/* ── MR02 Page publique ──────────────────────────────────────────────────── */
console.log('\nMR02 · Ma page publique\n');

const sec = (id: string, extra: Record<string, unknown> = {}) => ({ id, titre: id, versionEnLigne: 3, versionTravail: 3, ...extra });
await dit('le statut des sections : en ligne, modifiée, à vérifier, brouillon', () => {
  assert.equal(P.statutDeSection(sec('a')), 'En ligne');
  assert.equal(P.statutDeSection(sec('a', { versionTravail: 4 })), 'Modifiée');
  assert.equal(P.statutDeSection(sec('a', { versionTravail: 4, aVerifier: true })), 'À vérifier');
  assert.equal(P.statutDeSection(sec('a', { versionTravail: 4, brouillon: true })), 'Brouillon');
  assert.equal(P.statutDeSection(sec('a', { versionEnLigne: null, versionTravail: 1 })), 'Brouillon');
});
await dit('changements en attente, contrôles « avant de publier » (3 au plus), action de publication', () => {
  const liste = [sec('a'), sec('b', { versionTravail: 4, nature: 'avis' }), sec('c', { versionTravail: 4, aVerifier: true, nature: 'formulaire' }), sec('d', { versionEnLigne: null, versionTravail: 1 }), sec('e', { versionTravail: 5, nature: 'tarifs' })];
  assert.equal(P.changementsEnAttente(liste).length, 4);
  const ctrl = P.controlesAvantPublication(liste);
  assert.equal(ctrl.length, 3);
  assert.deepEqual(ctrl.map((c: any) => c.motif), ['tester-formulaire', 'accord-avis', 'verifier-tarifs']);
  assert.deepEqual(P.controlesAvantPublication([sec('a')]), []);
  assert.deepEqual(P.actionDePublication({ ecrire: true, publier: true, enLigne: true }, liste), { action: 'publier', actif: true, raison: null });
  assert.deepEqual(P.actionDePublication({ ecrire: true, publier: false, enLigne: true }, liste), { action: 'demander', actif: true, raison: null });
  assert.deepEqual(P.actionDePublication({ ecrire: true, publier: true, enLigne: false }, liste), { action: 'publier', actif: false, raison: 'hors-ligne' });
  assert.deepEqual(P.actionDePublication({ ecrire: true, publier: true, enLigne: true }, [sec('a')]), { action: 'publier', actif: false, raison: 'tout-est-a-jour' });
  assert.deepEqual(P.actionDePublication({ ecrire: false, publier: true, enLigne: true }, liste), { action: 'aucune', actif: false, raison: 'lecture' });
  assert.deepEqual(P.deplacerSection(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(P.deplacerSection(['a', 'b'], 5, 0), ['a', 'b']);
  assert.equal(P.apercuSynchronise(1000, 1500), true);
  assert.equal(P.apercuSynchronise(2000, 1500), false);
});
await dit('les visites sur 7 jours : total, variation, jour le plus haut, record depuis', () => {
  const jours = (debut: string, valeurs: number[]) => valeurs.map((visites, i) => ({ jour: C.ajouterJours(debut, i), visites }));
  // 7 jours précédents : 100 au total ; 7 derniers : 112 au total
  const serie = [...jours('2026-10-17', [10, 20, 10, 20, 10, 20, 10]), ...jours('2026-10-24', [10, 12, 14, 30, 16, 18, 12])];
  const b = P.bilanDesVisites(serie, '2026-10-30');
  assert.equal(b.total7j, 112);
  assert.equal(b.precedent7j, 100);
  assert.equal(b.variationPct, 12);
  assert.equal(b.jourLePlusHaut, 3);
  assert.equal(b.jours.length, 7);
  assert.equal(P.bilanDesVisites([], '2026-10-30').variationPct, null);
  assert.equal(P.bilanDesVisites([], '2026-10-30').jourLePlusHaut, null);
  // record : la meilleure période depuis qu'une aussi bonne s'est terminée en juin
  const histo = [...jours('2026-06-01', Array(14).fill(30)), ...jours('2026-06-15', Array(100).fill(5)), ...jours('2026-09-23', Array(31).fill(10)), ...jours('2026-10-24', Array(7).fill(20))];
  const rec = P.recordDepuis(histo, '2026-10-30');
  assert.equal(rec.mois, 'juin');
  assert.equal(P.recordDepuis([], '2026-10-30'), null);
  const montee = jours('2026-10-01', Array.from({ length: 30 }, (_, i) => i + 1));
  assert.deepEqual(P.recordDepuis(montee, '2026-10-30'), { mois: null });
});
await dit('les avis : seulement avec l’accord du client, prénom + initiale, jamais de contact', () => {
  assert.equal(P.auteurPublic('Sophie Martin'), 'Sophie M.');
  assert.equal(P.auteurPublic('  léo  bernard '), 'léo B.');
  assert.equal(P.auteurPublic('Madonna'), 'Madonna');
  const avis = [
    { id: '1', nomClient: 'Sophie Martin', note: 5, texte: 'Super', accordClient: true, entreprise: 'Boulangerie', accordEntreprise: true, nouveau: true },
    { id: '2', nomClient: 'Léo Bernard', note: 4, texte: 'Bien', accordClient: true, entreprise: 'Atelier', accordEntreprise: false },
    { id: '3', nomClient: 'Claire Roux', note: 5, texte: 'Top', accordClient: false },
  ];
  const aff = P.avisAffichables(avis);
  assert.equal(aff.length, 2);
  assert.equal(aff[0].entreprise, 'Boulangerie');
  assert.equal(aff[1].entreprise, null);
  assert.ok(!JSON.stringify(aff).includes('Martin'));
  assert.deepEqual(P.avisSansAccord(avis).map((a: any) => a.id), ['3']);
});

/* ── MR03 Tournées ───────────────────────────────────────────────────────── */
console.log('\nMR03 · Tournées\n');

const et = (id: string, trajetMin: number, dureeMin: number, extra: Record<string, unknown> = {}) => ({ id, lieu: id, trajetMin, trajetKm: trajetMin / 2, dureeMin, etat: 'À faire', ...extra });
await dit('les heures d’arrivée : départ + trajets + durées ; une heure fixée est gardée (attente) ou subie (retard)', () => {
  const r = T.calculerHeures('08:00', [et('a', 20, 45), et('b', 15, 60, { heureFixee: '10:00' }), et('c', 30, 30, { heureFixee: '10:30' })]);
  // a : 08:20 → 09:05 · b : 09:20, attend jusqu'à 10:00 → 11:00 · c : 11:30 alors qu'il est fixé à 10:30
  assert.deepEqual(r.map((x: any) => x.arriveeEstimee), ['08:20', '10:00', '11:30']);
  assert.deepEqual(r.map((x: any) => x.attenteMin), [0, 40, 0]);
  assert.deepEqual(r.map((x: any) => x.retardMin), [0, 0, 60]);
  assert.deepEqual(r.map((x: any) => x.departEstime), ['09:05', '11:00', '12:00']);
  assert.equal(T.calculerHeures('08:00', [et('x', 10, 10, { adresseAVerifier: true }), et('y', 10, 10)]).length, 1);
});
await dit('le résumé est calculé : distance, route, sur place (5 h 30), retard et sa couleur', () => {
  const etapes = T.calculerHeures('08:00', [et('a', 20, 45), et('b', 30, 60), et('c', 10, 90), et('d', 15, 60), et('e', 25, 75)]);
  const prevues = { a: '08:20', b: '09:35', c: '10:45', d: '12:30', e: '13:55' };
  const r = T.resumerTournee(etapes, prevues);
  assert.equal(r.surPlaceMin, 330);
  assert.equal(C.formaterDuree(r.surPlaceMin), `5${NBSP}h${NBSP}30`);
  assert.equal(r.routeMin, 100);
  assert.equal(r.distanceKm, 50);
  assert.equal(r.retardMin, 0);
  assert.equal(r.ton, 'vert');
  const retour = T.resumerTournee(etapes, prevues, { km: 8, min: 12 });
  assert.equal(retour.routeMin, 112);
  assert.equal(retour.distanceKm, 58);
  const retardee = T.resumerTournee(etapes, { ...prevues, c: '10:30' });
  assert.equal(retardee.retardMin, 15);
  assert.equal(retardee.ton, 'orange');
  assert.equal(T.tonDuRetard(0), 'vert');
  assert.equal(T.tonDuRetard(15), 'orange');
  assert.equal(T.tonDuRetard(16), 'rouge');
  // une étape terminée ne compte plus dans le retard
  const faits = etapes.map((e: any) => ({ ...e, etatNorm: 'Terminé' }));
  assert.equal(T.resumerTournee(faits, { ...prevues, c: '09:00' }).retardMin, 0);
});
await dit('le gain de l’optimisation, « arrivée dans 18 min », prévenir 30 min avant', () => {
  assert.deepEqual(T.gainDeLOptimisation({ km: 60, min: 140 }, { km: 48, min: 115 }), { km: 12, min: 25 });
  assert.equal(T.gainDeLOptimisation({ km: 48, min: 115 }, { km: 48, min: 115 }), null);
  assert.equal(T.gainDeLOptimisation({ km: 40, min: 100 }, { km: 50, min: 120 }), null);
  assert.equal(T.minutesAvantArrivee('11:00', '10:42'), 18);
  assert.equal(T.minutesAvantArrivee('10:00', '10:42'), 0);
  assert.equal(T.momentDePrevenir('11:00'), '10:30');
});
await dit('les états : une seule étape en route à la fois, dans l’ordre', () => {
  const e0 = [et('a', 1, 1), et('b', 1, 1)];
  const p = T.appliquerAction(e0, 'a', 'partir');
  assert.equal(p.ok, true);
  assert.deepEqual(T.appliquerAction(p.etapes, 'b', 'partir'), { ok: false, raison: 'deja-en-route' });
  assert.deepEqual(T.appliquerAction(e0, 'a', 'arriver'), { ok: false, raison: 'ordre' });
  const arrive = T.appliquerAction(p.etapes, 'a', 'arriver');
  assert.equal(arrive.etapes[0].etat, 'Sur place');
  const fini = T.appliquerAction(arrive.etapes, 'a', 'terminer');
  assert.equal(fini.etapes[0].etat, 'Terminé');
  assert.deepEqual(T.appliquerAction(e0, 'zz', 'partir'), { ok: false, raison: 'inconnue' });
  assert.equal(T.etatDeLaTournee([]), 'vide');
  assert.equal(T.etatDeLaTournee(e0), 'pas-commencee');
  assert.equal(T.etatDeLaTournee(p.etapes), 'en-cours');
  assert.equal(T.etatDeLaTournee(e0.map((e: any) => ({ ...e, etat: 'Fait' }))), 'bouclee');
  assert.equal(T.etatNormalise('Reportée'), 'À venir');
  assert.equal(T.etatNormalise('Fait'), 'Terminé');
});
await dit('le plan : segments fait / en route / à venir / retour, et position interpolée', () => {
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 0 }];
  const segs = T.segmentsDuTrajet(pts, ['Terminé', 'En route', 'À venir'], true);
  assert.deepEqual(segs.map((s: any) => s.trait), ['fait', 'en-route', 'a-venir', 'retour']);
  assert.deepEqual(T.segmentsDuTrajet(pts, ['À venir', 'À venir', 'À venir'], false).map((s: any) => s.trait), ['a-venir', 'a-venir', 'a-venir']);
  assert.deepEqual(T.positionDuVehicule({ x: 0, y: 0 }, { x: 10, y: 20 }, 600, 20, 610), { x: 5, y: 10 });
  assert.deepEqual(T.positionDuVehicule({ x: 0, y: 0 }, { x: 10, y: 20 }, 600, 20, 500), { x: 0, y: 0 });
  assert.deepEqual(T.positionDuVehicule({ x: 0, y: 0 }, { x: 10, y: 20 }, 600, 20, 900), { x: 10, y: 20 });
  assert.equal(T.controlesAvantDepart({ materielPrevu: true, prochainClient: 'x' }).length, 3);
  assert.equal(T.controlesAvantDepart({ materielPrevu: false, prochainClient: null }).length, 1);
});

/* ── MR04 Matériel ───────────────────────────────────────────────────────── */
console.log('\nMR04 · Matériel\n');

const eq = (id: string, extra: Record<string, unknown> = {}) => ({ id, nom: id, etat: 'Bon', affectation: { type: 'lieu', libelle: 'Atelier' }, ...extra });
await dit('le statut (où est-il) et l’état (comment va-t-il) sont deux informations', () => {
  assert.equal(MA.statutDeLEquipement(eq('a')), 'Disponible');
  assert.equal(MA.statutDeLEquipement(eq('a', { affectation: { type: 'personne', libelle: 'Aaron' } })), 'En prêt');
  assert.equal(MA.statutDeLEquipement(eq('a', { horsService: true, affectation: { type: 'personne', libelle: 'Aaron' } })), 'Hors service');
  assert.equal(MA.statutDeLEquipement(eq('a', { etat: 'En panne' })), 'Hors service');
  assert.equal(MA.peutEtrePrete(eq('a', { etat: 'En panne' })), false);
  assert.equal(MA.peutEtrePrete(eq('a', { etat: 'À vérifier' })), true); // disponible mais à vérifier
});
await dit('la jauge à 5 segments : neuf 5, bon 4 (5 si contrôlé il y a moins de 30 jours), à vérifier 2, à réviser 1', () => {
  assert.deepEqual(MA.jaugeDEtat({ etat: 'Neuf' }, '2026-10-30'), { segments: 5, ton: 'vert' });
  assert.deepEqual(MA.jaugeDEtat({ etat: 'Bon' }, '2026-10-30'), { segments: 4, ton: 'vert' });
  assert.deepEqual(MA.jaugeDEtat({ etat: 'Bon', dernierControleLe: '2026-10-10' }, '2026-10-30'), { segments: 5, ton: 'vert' });
  assert.deepEqual(MA.jaugeDEtat({ etat: 'Bon', dernierControleLe: '2026-09-10' }, '2026-10-30'), { segments: 4, ton: 'vert' });
  assert.deepEqual(MA.jaugeDEtat({ etat: 'À vérifier' }, '2026-10-30'), { segments: 2, ton: 'orange' });
  assert.deepEqual(MA.jaugeDEtat({ etat: 'À réviser' }, '2026-10-30'), { segments: 1, ton: 'rouge' });
});
await dit('le prochain entretien : retard, dans n jours (≤ 30), mois abrégé au-delà', () => {
  assert.deepEqual(MA.libelleEntretien('2026-10-20', '2026-10-30'), { type: 'retard', jours: 10 });
  assert.deepEqual(MA.libelleEntretien('2026-11-10', '2026-10-30'), { type: 'dans', jours: 11 });
  assert.deepEqual(MA.libelleEntretien('2026-11-29', '2026-10-30'), { type: 'dans', jours: 30 });
  assert.deepEqual(MA.libelleEntretien('2027-01-18', '2026-10-30'), { type: 'mois', mois: 'Janv.', annee: 2027 });
  assert.deepEqual(MA.libelleEntretien(null, '2026-10-30'), { type: 'aucun' });
  assert.equal(MA.echeanceEntretien({ dernierEntretienLe: '2026-04-30', periodiciteMois: 6 }), '2026-10-30');
  assert.equal(MA.echeanceEntretien({ prochainEntretienLe: '2027-01-18', dernierEntretienLe: '2026-04-30', periodiciteMois: 6 }), '2027-01-18');
  const fait = MA.enregistrerEntretien(eq('a', { periodiciteMois: 12, prochainEntretienLe: '2026-10-01' }), '2026-10-30');
  assert.equal(fait.dernierEntretienLe, '2026-10-30');
  assert.equal(fait.prochainEntretienLe, '2027-10-30');
});
await dit('le résumé du parc : un équipement dans un seul segment (42 + 3 + 1 = 46), puces, entretiens du mois', () => {
  const parc = [
    ...Array.from({ length: 42 }, (_, i) => eq(`b${i}`, { affectation: i < 12 ? { type: 'personne', libelle: 'P' } : { type: 'lieu', libelle: 'L' }, prochainEntretienLe: '2027-03-01' })),
    ...Array.from({ length: 2 }, (_, i) => eq(`v${i}`, { etat: 'À vérifier', prochainEntretienLe: '2026-10-15' })),
    eq('r1', { etat: 'À réviser', prochainEntretienLe: '2026-10-10' }),
    eq('h1', { horsService: true, etat: 'À réviser' }),
    ...Array.from({ length: 4 }, (_, i) => eq(`x${i}`, { reforme: true })),
  ];
  const r = MA.resumerLeParc(parc, '2026-10-30');
  assert.equal(r.total, 46);
  assert.deepEqual(r.segments, { bonEtat: 42, aVerifier: 3, horsService: 1 });
  assert.equal(r.segments.bonEtat + r.segments.aVerifier + r.segments.horsService, r.total);
  assert.equal(r.enPret, 12);
  assert.equal(r.reformes, 4);
  assert.equal(r.aEntretenir, 3);
  assert.equal(MA.filtrerParPuce(parc, 'tous', '2026-10-30').length, 46);
  assert.equal(MA.filtrerParPuce(parc, 'reformes', '2026-10-30').length, 4);
  assert.equal(MA.filtrerParPuce(parc, 'a-entretenir', '2026-10-30').length, 3);
  const ordre = MA.ordreDesFiches(parc.filter((e: any) => !e.reforme), '2026-10-30');
  assert.equal(ordre[0].id, 'h1'); // hors service d'abord
  assert.deepEqual(ordre.slice(1, 4).map((e: any) => e.id).sort(), ['r1', 'v0', 'v1']); // puis les retards
  const mois = MA.entretiensDuMois(parc, '2026-10-30', 3);
  assert.equal(mois.visibles.length, 3);
  assert.equal(mois.autres, 0);
  assert.equal(MA.entretiensDuMois(parc, '2026-10-30', 2).autres, 1);
});
await dit('le talon : « Aaron (vous) » pour soi ; mouvements du jour, 5 visibles', () => {
  const t = MA.talonDe(eq('a', { affectation: { type: 'personne', libelle: 'Aaron', depuisLe: '2026-10-29', retourPrevuLe: '2026-10-31' } }), 'aaron');
  assert.deepEqual(t, { type: 'personne', nom: 'Aaron', vous: true, depuis: '2026-10-29', retour: '2026-10-31' });
  assert.deepEqual(MA.talonDe(eq('a'), 'aaron'), { type: 'lieu', nom: 'Atelier' });
  const j = MA.mouvementsDuJour(['10:00', '08:00', '09:00', '11:00', '07:00', '12:00'].map((heure) => ({ heure })));
  assert.deepEqual(j.visibles.map((x: any) => x.heure), ['07:00', '08:00', '09:00', '10:00', '11:00']);
  assert.equal(j.defilement, true);
});

/* ── MR05 Catalogue ──────────────────────────────────────────────────────── */
console.log('\nMR05 · Catalogue produits\n');

const pr = (id: string, extra: Record<string, unknown> = {}) => ({ id, nom: id, description: 'd', prixHtCents: 89000, type: 'produit en stock', quantite: 8, niveauConseille: 10, seuilAlerte: 2, photos: 1, etat: 'actif', ...extra });
await dit('prix TTC (890 € HT → 1 068 €), marge (302 sur 890 = 34 %), prix affiché', () => {
  assert.equal(CA.prixTtcCents(89000), 106800);
  assert.equal(CA.prixTtcCents(1000, 5.5), 1055);
  assert.deepEqual(CA.margeDuProduit(pr('a', { prixAchatHtCents: 58800 })), { cents: 30200, pourcent: 34 });
  assert.equal(CA.margeDuProduit(pr('a')), null);
  assert.deepEqual(CA.prixAffiche(pr('a')), { euros: 890, suffixe: 'HT' });
  assert.deepEqual(CA.prixAffiche(pr('a', { type: 'abonnement', prixHtCents: 24000 })), { euros: 240, suffixe: 'par-an' });
});
await dit('la couleur du stock est la même partout : rouge, orange, vert, bleu pour un service', () => {
  assert.equal(CA.tonDuStock(pr('a', { quantite: 2, niveauConseille: 8, seuilAlerte: 2 })), 'rouge'); // ≤ seuil
  assert.equal(CA.tonDuStock(pr('a', { quantite: 2, niveauConseille: 10, seuilAlerte: 1 })), 'rouge'); // 20 % < 30 %
  assert.equal(CA.tonDuStock(pr('a', { quantite: 5, niveauConseille: 10, seuilAlerte: 1 })), 'orange');
  assert.equal(CA.tonDuStock(pr('a', { quantite: 8, niveauConseille: 10, seuilAlerte: 1 })), 'vert');
  assert.equal(CA.tonDuStock(pr('a', { type: 'service', quantite: null })), 'bleu');
  assert.deepEqual(CA.jaugeDuStock(pr('a', { quantite: 5, niveauConseille: 10, seuilAlerte: 2 })), { remplissage: 0.5, repere: 0.2 });
  assert.equal(CA.estStockBas(pr('a', { quantite: 1, seuilAlerte: 2 })), true);
  assert.equal(CA.estStockBas(pr('a', { type: 'service' })), false);
});
await dit('fiches complètes (7 sur 8 : il manque une photo), vedette de la semaine, ventes sur 6 semaines, ordre', () => {
  const liste = [...Array.from({ length: 7 }, (_, i) => pr(`p${i}`)), pr('p7', { photos: 0 }), pr('arch', { etat: 'archivé', photos: 0 })];
  assert.deepEqual(CA.fichesCompletes(liste), { completes: 7, total: 8 });
  assert.equal(CA.ficheComplete(pr('s', { type: 'service', quantite: null })), true);
  assert.equal(CA.ficheComplete(pr('s', { quantite: null })), false);
  const ventes = [
    { produitId: 'p1', quantite: 2, prixHtCents: 100, le: '2026-10-27' },
    { produitId: 'p2', quantite: 3, prixHtCents: 100, le: '2026-10-28' },
    { produitId: 'p3', quantite: 3, prixHtCents: 900, le: '2026-10-29' }, // égalité sur la quantité : le plus gros chiffre d'affaires
    { produitId: 'p0', quantite: 9, prixHtCents: 900, le: '2026-10-20' }, // semaine précédente
    { produitId: 'arch', quantite: 20, prixHtCents: 900, le: '2026-10-29' }, // archivé : ignoré
  ];
  assert.deepEqual(CA.produitVedette(liste, ventes, '2026-10-30'), { produitId: 'p3', vendus: 3 });
  assert.equal(CA.produitVedette(liste, [], '2026-10-30'), null);
  const six = CA.ventesSurSixSemaines('p0', ventes, '2026-10-30');
  assert.equal(six.length, 6);
  assert.equal(six[4].vendus, 9);
  assert.equal(six[5].vendus, 0);
  const faible = pr('p7', { quantite: 1, seuilAlerte: 2 });
  assert.deepEqual(CA.ordreDeLaMosaique([pr('a'), faible, pr('v'), pr('arch', { etat: 'archivé' })], 'v').map((p: any) => p.id), ['v', 'p7', 'a']);
});

/* ── MR06 Réservations ───────────────────────────────────────────────────── */
console.log('\nMR06 · Réservations\n');

const salle = { id: 's1', nom: 'Salle', type: 'salle', ouverture: { jours: [1, 2, 3, 4, 5], debut: '08:00', fin: '18:00' } };
// 2026-10-30 est un vendredi, heure d'hiver (UTC+1) : 09:00 Paris = 08:00Z
const rv = (id: string, de: string, a: string, statut = 'confirmée', ressourceId = 's1') => ({ id, ressourceId, debutAt: `2026-10-30T${de}:00Z`, finAt: `2026-10-30T${a}:00Z`, statut });
await dit('aucun doublon : intervalles ouverts à la fin, 9:00–11:00 et 11:00–12:00 sont compatibles', () => {
  assert.equal(R.seChevauchent({ debut: 9, fin: 11 }, { debut: 11, fin: 12 }), false);
  assert.equal(R.seChevauchent({ debut: 9, fin: 11 }, { debut: 10, fin: 12 }), true);
  const existantes = [rv('a', '08:00', '10:00')];
  assert.equal(R.verifierSansDoublon(rv('n', '10:00', '11:00'), existantes).length, 0);
  assert.equal(R.verifierSansDoublon(rv('n', '09:00', '11:00'), existantes).length, 1);
  assert.equal(R.verifierSansDoublon(rv('n', '09:00', '11:00', 'confirmée', 's2'), existantes).length, 0);
  assert.equal(R.verifierSansDoublon(rv('a', '08:00', '10:00'), existantes).length, 0); // elle-même
  assert.equal(R.verifierSansDoublon(rv('n', '09:00', '11:00'), [rv('x', '08:00', '10:00', 'annulée')]).length, 0);
});
await dit('un conflit est une demande qui chevauche une réservation confirmée ; jamais résolu seul', () => {
  const liste = [rv('a', '08:00', '10:00'), rv('d', '09:00', '11:00', 'en attente'), rv('e', '12:00', '13:00', 'en attente')];
  const c = R.conflitsEnAttente(liste);
  assert.equal(c.length, 1);
  assert.equal(c[0].demande.id, 'd');
  assert.deepEqual(c[0].avec.map((r: any) => r.id), ['a']);
});
await dit('les créneaux libres : plages réservables, au moins 1 h, calculés en heure de Paris', () => {
  // confirmées 09:00–11:00 Paris (08:00Z–10:00Z) et 13:00–14:00 Paris
  const liste = [rv('a', '08:00', '10:00'), rv('b', '12:00', '13:00')];
  const libres = R.creneauxLibres(salle, liste, '2026-10-30');
  assert.deepEqual(libres.map((c: any) => [c.debut, c.fin, c.dureeMin]), [[480, 540, 60], [660, 780, 120], [840, 1080, 240]]);
  assert.equal(R.creneauxLibres(salle, liste, '2026-10-31').length, 0); // samedi : fermé
  assert.deepEqual(R.creneauxLibres(salle, liste, '2026-11-02').map((c: any) => [c.debut, c.fin]), [[480, 1080]]); // lundi : libre toute la plage
  assert.equal(R.creneauxLibres(salle, liste, '2026-11-01').length, 0);
  assert.equal(R.creneauxLibres({ ...salle, indisponible: true }, liste, '2026-10-30').length, 0);
  const resume = R.resumeDesCreneaux([salle], liste, '2026-10-30');
  assert.equal(resume.nombre, 2); // 2 h et 4 h
  assert.equal(resume.plusLong.dureeMin, 240);
  assert.equal(C.formaterDuree(resume.plusLong.dureeMin), `4${NBSP}h`);
});
await dit('l’occupation du jour, de la semaine, les demi-journées creuses, « sans doublon depuis »', () => {
  const liste = [rv('a', '07:00', '17:00')]; // 08:00–18:00 Paris : 100 % du vendredi
  assert.equal(R.occupationDuJour([salle], liste, '2026-10-30'), 100);
  assert.equal(R.occupationDuJour([salle], [], '2026-10-30'), 0);
  assert.equal(R.occupationDuJour([salle], liste, '2026-10-31'), null);
  const sem = R.occupationDeLaSemaine([salle], liste, '2026-10-26');
  assert.equal(sem.semaine, 20); // 1 jour plein sur 5
  assert.equal(sem.parJour[4].pct, 100);
  assert.equal(sem.parJour[0].pct, 0);
  const creuses = R.demiJourneesCreuses([salle], liste, '2026-10-26');
  assert.ok(creuses.every((x: any) => x.jour !== '2026-10-30'));
  assert.equal(creuses.length, 8);
  assert.equal(R.joursSansDoublon(['2026-09-01', '2026-09-18'], '2026-10-30'), 42);
  assert.equal(R.joursSansDoublon([], '2026-10-30'), null);
  assert.equal(R.positionMaintenant(8 * 60 + 90), 0.15);
  assert.equal(R.positionMaintenant(7 * 60), null);
  const toutes = [salle, { id: 'v', nom: 'Berlingo', type: 'véhicule', ouverture: salle.ouverture }, { id: 'm', nom: 'Perceuse', type: 'matériel', ouverture: salle.ouverture }];
  assert.equal(R.filtrerRessources(toutes, 'tout').length, 3);
  assert.deepEqual(R.filtrerRessources(toutes, 'vehicules').map((r: any) => r.id), ['v']);
});

/* ── MR07 Commandes ──────────────────────────────────────────────────────── */
console.log('\nMR07 · Commandes\n');

const cm = (id: string, statut: string, extra: Record<string, unknown> = {}) => ({ id, numero: `#${id}`, statut, creeLe: '2026-10-28', ...extra });
await dit('les statuts du module actuel et de la fiche se rangent dans les mêmes 4 étapes', () => {
  const att: Record<string, string | null> = { new: 'recues', confirmed: 'recues', preparing: 'preparation', shipped: 'expediees', delivered: 'livrees', cancelled: null,
    'À préparer': 'recues', 'En préparation': 'preparation', Prête: 'expediees', 'Prête au retrait': 'expediees', Remise: 'livrees' };
  for (const [s, e] of Object.entries(att)) assert.equal(CM.etapeDeLaBande({ statut: s }), e, s);
  assert.equal(CM.etapeDeLaBande({ statut: 'new', annulee: true }), null);
  assert.deepEqual(CM.STATUTS_SUIVANTS.shipped, ['delivered']);
  assert.deepEqual(CM.STATUTS_SUIVANTS.delivered, []);
});
await dit('urgente (à la main ou échéance dépassée sans expédition) ; à expédier aujourd’hui', () => {
  assert.equal(CM.estUrgente(cm('a', 'new', { urgente: true }), '2026-10-30'), true);
  assert.equal(CM.estUrgente(cm('a', 'preparing', { echeanceLe: '2026-10-29' }), '2026-10-30'), true);
  assert.equal(CM.estUrgente(cm('a', 'shipped', { echeanceLe: '2026-10-29' }), '2026-10-30'), false); // déjà expédiée
  assert.equal(CM.estUrgente(cm('a', 'delivered', { urgente: true }), '2026-10-30'), false);
  assert.equal(CM.aExpedierAujourdhui(cm('a', 'new', { echeanceLe: '2026-10-30', remise: 'Colis' }), '2026-10-30'), true);
  assert.equal(CM.aExpedierAujourdhui(cm('a', 'new', { echeanceLe: '2026-10-30', remise: 'Retrait' }), '2026-10-30'), false);
});
await dit('les compteurs : 4 + 4 + 3 = 11 en cours, 58 livrées, +11 par rapport au même nombre de jours', () => {
  const now = Date.parse('2026-10-30T09:42:00Z'); // 10:42 à Paris
  const liste: any[] = [];
  for (let i = 0; i < 4; i += 1) liste.push(cm(`r${i}`, 'new', { creeAt: i === 0 ? '2026-10-30T09:38:00Z' : '2026-10-29T10:00:00Z', echeanceLe: '2026-10-30', remise: 'Colis' }));
  for (let i = 0; i < 4; i += 1) liste.push(cm(`p${i}`, 'preparing'));
  for (let i = 0; i < 3; i += 1) liste.push(cm(`e${i}`, 'shipped'));
  for (let i = 0; i < 58; i += 1) liste.push(cm(`l${i}`, 'delivered', { livreeLe: `2026-10-${String(1 + (i % 29)).padStart(2, '0')}` }));
  for (let i = 0; i < 47; i += 1) liste.push(cm(`m${i}`, 'delivered', { livreeLe: `2026-09-${String(1 + (i % 28)).padStart(2, '0')}` }));
  liste.push(cm('annulee', 'cancelled'));
  const k = CM.compter(liste, '2026-10-30', now);
  assert.equal(k.recues, 4);
  assert.equal(k.enPreparation, 4);
  assert.equal(k.expediees, 3);
  assert.equal(k.enCours, 11);
  assert.equal(k.livreesCeMois, 58);
  assert.equal(k.evolutionLivrees, 11);
  assert.equal(k.aExpedier, 4);
  assert.deepEqual(k.recentes, { nombre: 1, ilYaMin: 4 });
});
await dit('le tri : échéance croissante, urgentes en tête à égalité, expédiées en fin ; échéance affichée', () => {
  const liste = [cm('z', 'new', { echeanceLe: '2026-11-04' }), cm('y', 'new', { echeanceLe: '2026-10-30' }), cm('x', 'new', { echeanceLe: '2026-10-30', urgente: true }), cm('w', 'shipped', { echeanceLe: '2026-10-29' }), cm('v', 'delivered')];
  assert.deepEqual(CM.trierEnCours(liste, '2026-10-30').map((c: any) => c.id), ['x', 'y', 'z', 'w']);
  assert.deepEqual(CM.echeanceAffichee({ echeanceLe: '2026-10-30', echeanceHeure: '16:00' }, '2026-10-30'), { echeance: { type: 'aujourdhui', heure: '16:00' }, orange: true });
  assert.deepEqual(CM.echeanceAffichee({ echeanceLe: '2026-10-31' }, '2026-10-30').echeance, { type: 'demain' });
  assert.deepEqual(CM.echeanceAffichee({ echeanceLe: '2026-11-02' }, '2026-10-30').echeance, { type: 'jour', libelle: 'lun.' });
  assert.deepEqual(CM.echeanceAffichee({ echeanceLe: '2026-11-04' }, '2026-10-30').echeance, { type: 'jour', libelle: 'mer.' }); // dans les 6 jours : jour abrégé
  assert.deepEqual(CM.echeanceAffichee({ echeanceLe: '2026-11-07' }, '2026-10-30').echeance, { type: 'date', libelle: `7${NBSP}nov.` });
  assert.deepEqual(CM.echeanceAffichee({}, '2026-10-30').echeance, { type: 'aucune' });
});
await dit('les jetons : 3 par étape, les plus urgents d’abord, « + n autres »', () => {
  const liste = [cm('a', 'new', { echeanceLe: '2026-11-04' }), cm('b', 'new', { echeanceLe: '2026-11-03' }), cm('c', 'new', { urgente: true, echeanceLe: '2026-11-09' }), cm('d', 'new', { echeanceLe: '2026-11-01' }), cm('e', 'new', { echeanceLe: '2026-11-02' })];
  const j = CM.jetonsDeLEtape(liste, 'recues', '2026-10-30');
  assert.deepEqual(j.visibles.map((c: any) => c.id), ['c', 'd', 'e']);
  assert.equal(j.autres, 2);
});
await dit('le palier : prochain multiple de 10 au-dessus du record, jamais de reproche', () => {
  assert.deepEqual(CM.palierDeLivraisons(58, 52), { palier: 60, restant: 2, atteint: false });
  assert.deepEqual(CM.palierDeLivraisons(60, 52), { palier: 60, restant: 0, atteint: true });
  assert.deepEqual(CM.palierDeLivraisons(5, 0), { palier: 10, restant: 5, atteint: false });
  assert.equal(CM.palierDeLivraisons(40, 60).palier, 70);
});
await dit('le suivi pas à pas : « payée » seulement en ligne, retrait → « prête au retrait », retour d’une étape, jamais depuis « livrée »', () => {
  assert.deepEqual(CM.suiviDeLaCommande(cm('a', 'preparing', { paiementEnLigne: true, paye: true })).map((s: any) => [s.etape, s.fait]),
    [['recue', true], ['payee', true], ['preparation', true], ['expediee', false], ['livree', false]]);
  assert.deepEqual(CM.suiviDeLaCommande(cm('a', 'shipped', { remise: 'Retrait' })).map((s: any) => s.etape), ['recue', 'preparation', 'prete-au-retrait', 'livree']);
  assert.deepEqual(CM.retourPossible(cm('a', 'preparing')), { possible: true, versEtape: 'recues', confirmation: true });
  assert.deepEqual(CM.retourPossible(cm('a', 'shipped')), { possible: true, versEtape: 'preparation', confirmation: true });
  assert.equal(CM.retourPossible(cm('a', 'delivered')).possible, false);
  assert.equal(CM.retourPossible(cm('a', 'new')).possible, false);
  assert.equal(CM.totalHtCents([{ quantite: 2, prixHtCents: 1000 }, { quantite: 1, prixHtCents: 500 }]), 2500);
});

/* ── MR08 Boutique ───────────────────────────────────────────────────────── */
console.log('\nMR08 · Boutique en ligne\n');

await dit('visiteurs en direct : sessions des 5 dernières minutes, les plus avancées d’abord, 5 au plus', () => {
  const now = 1_000_000_000;
  const s = (id: string, etape: string, ilYa: number) => ({ id, etape, derniereActiviteMs: now - ilYa * 60_000, page: '/p' });
  const v = B.visiteursEnDirect([s('a', 'regarde', 1), s('b', 'paiement', 2), s('c', 'panier', 4), s('d', 'produit', 6), s('e', 'regarde', 0), s('f', 'regarde', 3), s('g', 'produit', 1), s('h', 'regarde', 2)], now);
  assert.equal(v.nombre, 7);
  assert.deepEqual(v.lignes.map((x: any) => x.id), ['b', 'c', 'g', 'e', 'a']);
  assert.equal(B.appareilDeLEcran(390), 'telephone');
  assert.equal(B.appareilDeLEcran(1024), 'tablette');
  assert.equal(B.appareilDeLEcran(1440), 'ordinateur');
  assert.equal(B.appareilDeLEcran(undefined), 'ordinateur');
});
await dit('la semaine : CA hors remboursées, panier moyen arrondi à l’euro (274 €), variation sur les mêmes jours', () => {
  const cmd = (le: string, euros: number, extra: Record<string, unknown> = {}) => ({ payeeLe: le, totalCents: euros * 100, ...extra });
  const sem = [...Array.from({ length: 13 }, (_, i) => cmd(i % 2 ? '2026-10-27' : '2026-10-29', 274)), cmd('2026-10-30', 278), cmd('2026-10-28', 900, { remboursee: true })];
  const avant = [cmd('2026-10-19', 1000), cmd('2026-10-21', 1000), cmd('2026-10-22', 500), cmd('2026-10-24', 9999)]; // le 24 est hors des mêmes jours (lundi → vendredi)
  // 13 × 274 + 278 = 3 840 € sur 14 commandes
  const b = B.bilanDeLaSemaine([...sem, ...avant], '2026-10-30');
  assert.equal(b.chiffreAffairesCents, 384000);
  assert.equal(b.commandes, 14);
  assert.equal(b.panierMoyenCents, 27400);
  assert.equal(b.variationCaPct, 54); // 3 840 contre 2 500
  assert.equal(b.variationCommandes, 11);
  assert.equal(B.bilanDeLaSemaine([], '2026-10-30').panierMoyenCents, 0);
  assert.equal(B.bilanDeLaSemaine(sem, '2026-10-30').variationCaPct, null);
});
await dit('ce qui se vend : 5 produits au plus, barre = quantité ÷ plus forte', () => {
  const l = (p: string, q: number) => ({ produitId: p, nom: p, quantite: q });
  const v = B.ceQuiSeVend([{ payeeLe: '2026-10-29', totalCents: 1, lignes: [l('a', 8), l('b', 4), l('c', 2), l('d', 1), l('e', 1), l('f', 1)] }, { payeeLe: '2026-10-20', totalCents: 1, lignes: [l('z', 99)] }], '2026-10-30');
  assert.equal(v.length, 5);
  assert.deepEqual(v.map((x: any) => x.produitId), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(v.map((x: any) => x.barre), [1, 0.5, 0.25, 0.125, 0.125]);
});
await dit('l’entonnoir : taux de passage arrondis, écart le plus fort signalé, bande en racine', () => {
  const e = B.construireEntonnoir({ visites: 2000, fichesVues: 800, ajoutsPanier: 120, paiementsCommences: 60, commandesPayees: 56 });
  assert.deepEqual(e.etapes.map((x: any) => x.taux), [null, 40, 15, 50, 93]);
  assert.equal(e.ecartLePlusFort, 'ajoutsPanier');
  assert.equal(B.construireEntonnoir({ visites: 0, fichesVues: 0, ajoutsPanier: 0, paiementsCommences: 0, commandesPayees: 0 }).ecartLePlusFort, null);
  assert.equal(B.hauteurDeBande(2000, 2000, 100), 100);
  assert.equal(B.hauteurDeBande(500, 2000, 100), 50); // √0,25
  assert.ok(B.hauteurDeBande(56, 2000, 100) >= 3);
  assert.equal(B.hauteurDeBande(0, 2000, 100), 0);
});
await dit('paniers abandonnés (19 − 14 = 5), objectif du trimestre, état de la boutique', () => {
  const now = 1_000_000_000_000;
  const paniers = [
    ...Array.from({ length: 14 }, (_, i) => ({ id: `c${i}`, derniereActiviteMs: now - 30 * 3_600_000, converti: true })),
    ...Array.from({ length: 5 }, (_, i) => ({ id: `a${i}`, derniereActiviteMs: now - 30 * 3_600_000, converti: false, contactAutorise: i < 2, adresseConnue: i < 3 })),
    { id: 'recent', derniereActiviteMs: now - 3_600_000, converti: false },
  ];
  assert.deepEqual(B.paniersAbandonnes(paniers, now), { abandonnes: 5, contactables: 2 });
  const cmds = [{ payeeLe: '2026-10-05', totalCents: 4_000_00 }, { payeeLe: '2026-10-28', totalCents: 3_840_00 }, { payeeLe: '2026-07-02', totalCents: 9_999_00 }];
  const o = B.avancementObjectif({ montantCents: 12_000_00, debut: '2026-10-01', fin: '2026-12-31' }, cmds, '2026-10-30');
  assert.equal(o.caCents, 7_840_00);
  assert.equal(o.pct, 65);
  assert.equal(o.resteCents, 4_160_00);
  assert.equal(o.semainesRestantes, 2); // 4 160 ÷ 3 840 (CA de la semaine en cours) = 1,08 → 2
  assert.equal(B.avancementObjectif({ montantCents: 12_000_00, debut: '2026-10-01', fin: '2026-12-31' }, [], '2026-10-30').semainesRestantes, null);
  assert.equal(B.etatDeLaBoutique({ active: true }), 'ouverte');
  assert.equal(B.etatDeLaBoutique({ active: true, enPause: true }), 'en-pause');
  assert.equal(B.etatDeLaBoutique({ active: false }), 'fermee');
});

/* ── MR09 Flotte ─────────────────────────────────────────────────────────── */
console.log('\nMR09 · Flotte de véhicules\n');

await dit('la jauge : vert ≥ 50 %, orange de 25 à 49 %, rouge dessous, bleu en charge ; autonomie à 10 km', () => {
  assert.equal(FL.tonDeLaJauge(50), 'vert');
  assert.equal(FL.tonDeLaJauge(49), 'orange');
  assert.equal(FL.tonDeLaJauge(25), 'orange');
  assert.equal(FL.tonDeLaJauge(24), 'rouge');
  assert.equal(FL.tonDeLaJauge(10, true), 'bleu');
  assert.equal(FL.autonomieKm(60, 680), 410);
  assert.equal(FL.autonomieKm(100, 653), 650);
  assert.equal(FL.autonomieKm(150, 500), 500);
  assert.deepEqual(FL.chiffresDuCompteur(48213), [0, 4, 8, 2, 1, 3]);
  assert.deepEqual(FL.chiffresDuCompteur(1234567), [2, 3, 4, 5, 6, 7]);
});
await dit('l’état : en tournée seulement si une tournée ou une réservation est en cours ; le garage prime', () => {
  assert.equal(FL.etatNormalise('À l’atelier'), 'Au garage');
  assert.equal(FL.etatDuVehicule('Disponible', true), 'En tournée');
  assert.equal(FL.etatDuVehicule('Au garage', true), 'Au garage');
  assert.equal(FL.etatDuVehicule('Disponible', false), 'Disponible');
});
await dit('l’échéance : barre = part écoulée (800 km restants sur 5 000 → 84 %), couleurs, date estimée « ≈ »', () => {
  const vidange = { nom: 'Vidange', nature: 'km', intervalle: 5000, dernierKm: 40000 };
  const e = FL.calculerEcheance(vidange, 44200, 20, '2026-10-30');
  assert.equal(e.kmRestants, 800);
  assert.equal(e.partEcoulee, 84);
  assert.equal(e.estimee, true);
  assert.equal(e.joursRestants, 40);
  assert.equal(e.le, '2026-12-09');
  assert.equal(e.ton, 'orange'); // < 1 000 km
  assert.equal(FL.calculerEcheance(vidange, 40500, 20, '2026-10-30').ton, 'vert');
  assert.equal(FL.calculerEcheance(vidange, 45100, 20, '2026-10-30').ton, 'rouge'); // dépassée
  const ct = FL.calculerEcheance({ nom: 'Contrôle technique', nature: 'jours', intervalle: 730, le: '2026-11-18' }, 0, 0, '2026-10-30');
  assert.equal(ct.joursRestants, 19);
  assert.equal(ct.ton, 'rouge'); // moins de 30 jours
  assert.equal(ct.estimee, false);
  assert.equal(FL.calculerEcheance({ nom: 'x', nature: 'jours', intervalle: 365 }, 0, 0, '2026-10-30'), null);
  assert.equal(FL.calculerEcheance({ nom: 'x', nature: 'km', intervalle: 5000 }, 0, 0, '2026-10-30'), null);
  assert.equal(FL.echeanceProche([vidange, { nom: 'CT', nature: 'jours', intervalle: 730, le: '2026-11-18' }], 44200, 20, '2026-10-30').nom, 'CT');
  assert.ok(Math.abs(FL.kmParJour(412 * 30 / 7) - 412 / 7) < 1e-9);
});
await dit('la frise sur 6 mois : échéances triées, au kilomètre datées « ≈ », une ligne flotte', () => {
  const f = FL.friseDEntretien([
    { id: 'v1', nom: 'Berlingo', kmActuel: 44200, kmSur30Jours: 600, echeances: [{ nom: 'Vidange', nature: 'km', intervalle: 5000, dernierKm: 40000 }, { nom: 'Contrôle technique', nature: 'jours', intervalle: 730, le: '2026-11-18' }, { nom: 'Assurance', nature: 'jours', intervalle: 365, le: '2027-09-01' }] },
    { id: 'v2', nom: 'e-Partner', kmActuel: 10000, kmSur30Jours: 900, echeances: [{ nom: 'Révision', nature: 'jours', intervalle: 365, le: '2027-02-15' }] },
  ], '2026-10-30');
  assert.deepEqual(f.parVehicule.get('v1').map((p: any) => p.nom), ['Contrôle technique', 'Vidange']); // l'assurance est au-delà de 6 mois
  assert.equal(f.parVehicule.get('v1')[1].estimee, true);
  assert.deepEqual(f.flotte.map((p: any) => p.nom), ['Contrôle technique', 'Vidange', 'Révision']);
});
await dit('le sous-titre (km du mois, carburant) et « avant le prochain trajet »', () => {
  const jours = [{ jour: '2026-10-05', km: 1000, carburantCents: 15000 }, { jour: '2026-10-20', km: 1140, carburantCents: 16000 }, { jour: '2026-09-10', km: 900, carburantCents: 20000 }, { jour: '2026-08-28', km: 900, carburantCents: 99999 }];
  assert.deepEqual(FL.bilanDuMois(jours, '2026-10-30'), { kmDuMois: 2140, variationCarburantPct: 55 }); // 31 000 contre 20 000, sur les 30 premiers jours de septembre
  assert.equal(FL.bilanDuMois([], '2026-10-30').variationCarburantPct, null);
  assert.deepEqual(FL.controlesAvantTrajet('thermique').map((c: any) => c.motif), ['carburant', 'pneus', 'papiers']);
  assert.deepEqual(FL.controlesAvantTrajet('electrique').map((c: any) => c.motif), ['charge', 'pneus', 'papiers']);
});

/* ── MR10 Photos de chantier ─────────────────────────────────────────────── */
console.log('\nMR10 · Photos de chantier\n');

const ph = (id: string, phase: string, le: string, extra: Record<string, unknown> = {}) => ({ id, phase, le, ...extra });
await dit('comptes par phase (7 + 21 + 8 = 36), détail de ligne, complétude et couleurs', () => {
  const photos = [...Array.from({ length: 7 }, (_, i) => ph(`a${i}`, 'Avant', '2026-10-01')), ...Array.from({ length: 21 }, (_, i) => ph(`p${i}`, 'Pendant', `2026-10-${String(2 + (i % 10)).padStart(2, '0')}`)), ...Array.from({ length: 8 }, (_, i) => ph(`z${i}`, 'Après', '2026-10-17'))];
  assert.deepEqual(PH.comptesParPhase(photos), { Avant: 7, Pendant: 21, Après: 8, total: 36 });
  assert.deepEqual(PH.detailDeLigne({ id: 'd', photos }), { type: 'photos', photos: 36, jours: 12 }); // 10 jours de travaux + avant + après
  assert.deepEqual(PH.detailDeLigne({ id: 'd', photos: [ph('a', 'Avant', '2026-10-01')] }), { type: 'avant-seulement' });
  assert.deepEqual(PH.detailDeLigne({ id: 'd', photos: [], debutPrevuLe: '2026-11-12' }), { type: 'debut-prevu', le: '2026-11-12' });
  assert.deepEqual(PH.completude({ id: 'd', photos, signatureClient: true }), { fournis: 3, attendus: 3, pct: 100, ton: 'vert', manque: [] });
  assert.deepEqual(PH.completude({ id: 'd', photos }).manque, ['signature']);
  assert.equal(PH.completude({ id: 'd', photos }).pct, 67);
  assert.equal(PH.completude({ id: 'd', photos }).ton, 'bleu');
  assert.equal(PH.completude({ id: 'd', photos: [ph('a', 'Avant', '2026-10-01')] }).pct, 33);
  assert.equal(PH.completude({ id: 'd', photos: [ph('a', 'Pendant', '2026-10-01')] }).ton, 'orange'); // des photos, mais aucun élément attendu
  assert.equal(PH.completude({ id: 'd', photos: [] }).ton, 'pointille');
  assert.equal(PH.estIrreprochable({ id: 'd', photos, signatureClient: true }), true);
});
await dit('la planche : jours récents d’abord, 8 vignettes dont la dernière dit « +5 » (restantes, elle-même comprise)', () => {
  const photos = [...Array.from({ length: 12 }, (_, i) => ph(`j${i}`, 'Pendant', '2026-10-17')), ph('x', 'Avant', '2026-10-01'), ph('y', 'Avant', '2026-10-01'), ph('z', 'Après', '2026-10-01')];
  const pl = PH.planchePhotosParJour(photos);
  assert.deepEqual(pl.map((j: any) => j.jour), ['2026-10-17', '2026-10-01']);
  assert.equal(pl[0].vignettes.length, 8);
  assert.equal(pl[0].plus, 5); // 12 − 7 : les 7 premières vignettes + une vignette « +5 »
  assert.equal(pl[0].total, 12);
  assert.equal(pl[0].phaseDominante, 'Pendant');
  assert.equal(pl[1].plus, 0);
  assert.equal(pl[1].phaseDominante, 'Avant');
  assert.deepEqual(PH.planchePhotosParJour([]), []);
});
await dit('la comparaison : appariement par lieu et orientation, « même cadrage », jours de travaux', () => {
  const avant = ph('av', 'Avant', '2026-10-01', { lieu: 'Salon', orientationDeg: 350 });
  const apres = [ph('ap1', 'Après', '2026-10-17', { lieu: 'Cuisine', orientationDeg: 350 }), ph('ap2', 'Après', '2026-10-17', { lieu: 'Salon', orientationDeg: 90 }), ph('ap3', 'Après', '2026-10-17', { lieu: 'Salon', orientationDeg: 5 })];
  assert.equal(PH.apparier(avant, apres).id, 'ap3'); // 350° et 5° : 15° d'écart, à travers zéro
  assert.equal(PH.ecartOrientation(350, 5), 15);
  assert.equal(PH.memeCadrage(avant, apres[2]), false);
  assert.equal(PH.memeCadrage(avant, ph('ap4', 'Après', '2026-10-17', { orientationDeg: 355 })), true);
  assert.equal(PH.memeCadrage(ph('a', 'Avant', '2026-10-01'), apres[2]), false);
  assert.equal(PH.apparier(ph('a', 'Avant', '2026-10-01'), apres), null); // sans lieu : choix manuel
  assert.equal(PH.apparier(ph('a', 'Avant', '2026-10-01', { lieu: 'Garage' }), apres), null);
  assert.equal(PH.joursDeTravaux([ph('p', 'Pendant', '2026-10-02'), ph('p2', 'Pendant', '2026-10-05'), ph('z', 'Après', '2026-10-18')]), 16);
  assert.equal(PH.joursDeTravaux([ph('a', 'Avant', '2026-10-01')]), null);
});
await dit('le partage client : lien à durée limitée, sans lieu ni auteur', () => {
  const r = PH.partagerAuClient([ph('a', 'Avant', '2026-10-01', { lieu: 'Salon', auteurEmail: 'x@exemple.test', orientationDeg: 5 })], '2026-10-30');
  assert.deepEqual(r.photos, [{ id: 'a', phase: 'Avant', le: '2026-10-01' }]);
  assert.equal(r.expireLe, '2026-11-13');
  assert.ok(!JSON.stringify(r).includes('Salon') && !JSON.stringify(r).includes('exemple'));
});

/* ── MR11 Qualité ────────────────────────────────────────────────────────── */
console.log('\nMR11 · Qualité et contrôles\n');

const controle = (conformes: number, non: number, aVerifier: number, extra: Record<string, unknown> = {}) => {
  const n = conformes + non + aVerifier;
  const ids = Array.from({ length: n }, (_, i) => `p${i}`);
  return { id: 'c1', pointsIds: ids, le: '2026-10-29', resultats: ids.slice(0, conformes + non).map((id, i) => ({ pointId: id, conforme: i < conformes })), ...extra };
};
await dit('compteurs 17 + 2 + 3 = 22 ; conformité 77 % provisoire, définitive à la signature', () => {
  const c = controle(17, 2, 3);
  assert.deepEqual(Q.compterLesPoints(c), { conformes: 17, nonConformes: 2, sansObjet: 0, aVerifier: 3, total: 22 });
  assert.deepEqual(Q.conformiteDuControle(c), { pct: 77, provisoire: true, ton: 'orange' });
  assert.deepEqual(Q.conformiteDuControle({ ...c, signeLe: '2026-10-30' }), { pct: 77, provisoire: false, ton: 'orange' });
  assert.deepEqual(Q.peutSigner(c), { ok: false, restants: 3 });
  assert.deepEqual(Q.peutSigner(controle(20, 2, 0)), { ok: true, restants: 0 }); // les écarts peuvent rester ouverts
  assert.equal(Q.peutSigner(controle(20, 2, 0, { signeLe: '2026-10-30' })).ok, false); // déjà signé
});
await dit('« sans objet » sort du calcul ; couleurs vert ≥ 90, orange 70–89, rouge dessous', () => {
  const c = { id: 'c', le: '2026-10-29', pointsIds: ['a', 'b', 'c', 'd'], resultats: [{ pointId: 'a', conforme: true }, { pointId: 'b', conforme: true }, { pointId: 'c', sansObjet: true }, { pointId: 'd', conforme: false }] };
  assert.equal(Q.conformiteDuControle(c).pct, 67); // 2 / 3
  assert.equal(Q.tonDeConformite(90), 'vert');
  assert.equal(Q.tonDeConformite(89), 'orange');
  assert.equal(Q.tonDeConformite(70), 'orange');
  assert.equal(Q.tonDeConformite(69), 'rouge');
  assert.equal(Q.verdictDuPoint(undefined), 'a-verifier');
  assert.equal(Q.verdictDuPoint({ pointId: 'x', conforme: null }), 'a-verifier');
  assert.equal(Q.conformiteDuControle({ id: 'v', le: '2026-10-29', pointsIds: [], resultats: [] }).pct, 0);
});
await dit('conformité du mois : moyenne des contrôles signés, « validés du premier coup »', () => {
  const liste = [
    controle(10, 0, 0, { id: 'a', le: '2026-10-29', signeLe: '2026-10-29' }),
    controle(9, 1, 0, { id: 'b', le: '2026-10-20', signeLe: '2026-10-20' }),
    controle(5, 5, 0, { id: 'c', le: '2026-10-10' }), // non signé : hors moyenne
    controle(10, 0, 0, { id: 'd', le: '2026-09-29', signeLe: '2026-09-29' }), // autre mois
  ];
  const m = Q.conformiteDuMois(liste, { b: 1 }, '2026-10-30');
  assert.deepEqual(m, { pct: 95, signes: 2, premierCoup: 1 });
  assert.deepEqual(Q.conformiteDuMois([], {}, '2026-10-30'), { pct: null, signes: 0, premierCoup: 0 });
  assert.deepEqual(Q.controlesDuMois(liste, '2026-10-30').map((c: any) => c.id), ['a', 'b', 'c']);
});
await dit('Pareto : tous les écarts du mois (clos compris), cumul, seuil de 80 %, première barre rouge puis orange', () => {
  const e = (cause: string, n: number, le = '2026-10-15') => Array.from({ length: n }, (_, i) => ({ id: `${cause}${i}`, cause, releveLe: le, lieu: i % 2 ? 'Roux' : 'Léo' }));
  const ecarts = [...e('Câblage', 7), ...e('Étiquetage', 4), ...e('Propreté', 3), ...e('Documentation', 2), ...e('Autre', 1), ...e('Hors mois', 9, '2026-09-30')];
  const p = Q.pareto(ecarts, '2026-10-30');
  assert.equal(p.total, 17);
  assert.deepEqual(p.barres.map((b: any) => b.cause), ['Câblage', 'Étiquetage', 'Propreté', 'Documentation', 'Autre']);
  assert.deepEqual(p.barres.map((b: any) => b.cumulPct), [41, 65, 82, 94, 100]);
  assert.deepEqual(p.barres.map((b: any) => b.ton), ['rouge', 'orange', 'orange', null, null]); // colorées jusqu'au premier cumul ≥ 80 %
  assert.equal(p.causesDominantes, 3);
  assert.equal(p.partDominantesPct, 82);
  assert.deepEqual(Q.pareto([], '2026-10-30'), { barres: [], total: 0, causesDominantes: 0, partDominantesPct: 0 });
  const lieux = Q.ouIlsArrivent(ecarts, '2026-10-30');
  assert.equal(lieux.length, 2); // deux lieux dans le mois
  const plus = Q.ouIlsArrivent([...e('x', 1).map((x: any) => ({ ...x, lieu: 'A' })), ...e('y', 1).map((x: any) => ({ ...x, lieu: 'B' })), ...e('z', 1).map((x: any) => ({ ...x, lieu: 'C' })), ...e('w', 2).map((x: any) => ({ ...x, lieu: 'D' }))], '2026-10-30', 3);
  assert.equal(plus.length, 4);
  assert.deepEqual(plus[3], { lieu: '', nombre: 1 });
  assert.equal(plus[0].lieu, 'D');
});

/* ── F50 Ligne de production ─────────────────────────────────────────────── */
console.log('\nF50 · Vue d’ensemble\n');

const el = (id: string, couloir: string, poste: string, urgence = 0, extra: Record<string, unknown> = {}) => ({ id, couloir, poste, titre: id, detail: '', avancement: 50, alerte: false, urgence, lien: { module: 'chantiers', id }, personnes: [], ...extra });
await dit('les postes : un chantier n’est qu’à un poste (le plus avancé non terminé)', () => {
  const c = chantier();
  assert.equal(L.posteDuChantier(c, [], '2026-10-30'), 'realiser');
  assert.equal(L.posteDuChantier(c, [{ chantierId: 'c1', nom: 'Câblage baie Roux', nonConformes: 2 }], '2026-10-30'), 'controler');
  assert.equal(L.posteDuChantier(chantier({ etapes: [{ nom: 'Dépose', semaine: 44, faite: true }, { nom: 'Réception', semaine: 44, faite: false }] }), [], '2026-10-30'), 'livrer');
  assert.equal(L.posteDuChantier(chantier({ debutLe: '2026-11-05', etapes: [{ nom: 'Repérage', semaine: 45, faite: false }] }), [], '2026-10-30'), 'preparer');
  assert.equal(L.posteDuChantier(chantier({ etapes: chantier().etapes.map((e: any) => ({ ...e, faite: true })) }), [], '2026-10-30'), 'livre');
});
await dit('commandes et contenus : correspondance des postes', () => {
  assert.equal(L.posteDeLaCommande(cm('a', 'new')), 'preparer');
  assert.equal(L.posteDeLaCommande(cm('a', 'preparing')), 'realiser');
  assert.equal(L.posteDeLaCommande(cm('a', 'preparing'), true), 'controler');
  assert.equal(L.posteDeLaCommande(cm('a', 'shipped')), 'livrer');
  assert.equal(L.posteDeLaCommande(cm('a', 'delivered')), 'livre');
  assert.equal(L.posteDeLaCommande(cm('a', 'cancelled')), null);
  const aTraiter = [{ id: 'r', auteur: 'a', t: 1, texte: 'x', etat: 'À traiter' }];
  assert.equal(L.posteDuContenu({ id: 'v', titre: 't', etape: 'Idée', avancement: 0 }, []), 'preparer');
  assert.equal(L.posteDuContenu({ id: 'v', titre: 't', etape: 'Tournage', avancement: 0 }, []), 'preparer');
  assert.equal(L.posteDuContenu({ id: 'v', titre: 't', etape: 'Sous-titrage', avancement: 55 }, []), 'realiser');
  assert.equal(L.posteDuContenu({ id: 'v', titre: 't', etape: 'Relecture', avancement: 90 }, aTraiter), 'controler');
  assert.equal(L.posteDuContenu({ id: 'v', titre: 't', etape: 'Relecture', avancement: 90 }, []), 'livrer');
  assert.equal(L.posteDuContenu({ id: 'v', titre: 't', etape: 'Publiée', avancement: 100 }, []), 'livre');
});
await dit('la ligne : comptes des postes = somme des couloirs, « Tout 19 » = non livrés, 2 jetons au plus puis regroupement', () => {
  const elements = [
    el('c1', 'chantiers', 'preparer'), el('c2', 'chantiers', 'realiser'), el('c3', 'chantiers', 'realiser'), el('c4', 'chantiers', 'controler', 2, { alerte: true }), el('c5', 'chantiers', 'livrer'), el('c6', 'chantiers', 'livre'), el('c7', 'chantiers', 'livre'),
    ...Array.from({ length: 4 }, (_, i) => el(`m${i}`, 'commandes', 'preparer', i === 3 ? 2 : 0)), ...Array.from({ length: 4 }, (_, i) => el(`n${i}`, 'commandes', 'realiser')), ...Array.from({ length: 3 }, (_, i) => el(`o${i}`, 'commandes', 'livrer')), ...Array.from({ length: 58 }, (_, i) => el(`l${i}`, 'commandes', 'livre')),
    el('v1', 'contenus', 'preparer'), el('v2', 'contenus', 'realiser'), el('v3', 'contenus', 'controler', 2, { alerte: true }), el('v4', 'contenus', 'livre'), el('v5', 'contenus', 'livre'),
  ];
  const ligne = L.construireLigne(elements);
  assert.deepEqual(ligne.postes.map((p: any) => p.compte), [6, 7, 2, 4, 62]);
  assert.equal(ligne.toutEnCours, 19);
  assert.equal(ligne.arret, false);
  assert.equal(ligne.postes[2].aReprendre, 2);
  assert.equal(ligne.postes[2].enDifficulte, true);
  assert.equal(ligne.postes[0].enDifficulte, false);
  const cmd = ligne.couloirs.find((c: any) => c.id === 'commandes');
  assert.equal(cmd.enCours, 11);
  assert.equal(cmd.livres, 58);
  assert.equal(cmd.cellules.preparer.length, 1);
  assert.equal(cmd.cellules.preparer[0].type, 'groupe');
  assert.equal(cmd.cellules.preparer[0].nombre, 4);
  assert.equal(cmd.cellules.preparer[0].plusUrgent.id, 'm3');
  assert.equal(cmd.cellules.controler.length, 0);
  const chantiers = ligne.couloirs.find((c: any) => c.id === 'chantiers');
  assert.equal(chantiers.enCours, 5);
  assert.equal(chantiers.cellules.realiser.length, 2);
  assert.equal(chantiers.hauteur, 2);
  assert.equal(L.filtrerCouloir(ligne, 'contenus').length, 1);
  assert.equal(L.filtrerCouloir(ligne, 'tout').length, 3);
});
await dit('un métier sans commandes : le couloir disparaît ; ligne à l’arrêt sans rien en cours', () => {
  const elements = [el('c1', 'chantiers', 'realiser'), el('m1', 'commandes', 'preparer')];
  const sans = L.construireLigne(elements, ['chantiers', 'contenus']);
  assert.deepEqual(sans.couloirs.map((c: any) => c.id), ['chantiers', 'contenus']);
  assert.equal(sans.toutEnCours, 1);
  const arret = L.construireLigne([el('c1', 'chantiers', 'livre')]);
  assert.equal(arret.arret, true);
  assert.equal(arret.postes[4].compte, 1);
  assert.equal(L.construireLigne([]).arret, true);
});
await dit('les éléments viennent des modules ; le contrôle garde son nom (pas un second chantier)', () => {
  const sources = {
    chantiers: [chantier({ equipe: ['m@exemple.test'] }), chantier({ id: 'c2', nom: 'Atelier Marbre', depenseCents: 21_000_00 })],
    controlesOuverts: [{ chantierId: 'c1', nom: 'Câblage baie Roux', nonConformes: 2 }],
    commandes: [cm('1047', 'new', { urgente: true }), cm('1044', 'preparing')],
    videos: [{ id: 'v1', titre: 'Présentation', etape: 'Relecture', avancement: 90 }],
    retoursParVideo: { v1: [{ id: 'r', auteur: 'a', t: 1, texte: 'x', etat: 'À traiter' }] },
    aujourdhui: '2026-10-30',
  };
  const els = L.elementsDeProduction(sources);
  assert.equal(els.length, 5);
  const c1 = els.find((e: any) => e.id === 'chantier:c1');
  assert.equal(c1.poste, 'controler');
  assert.equal(c1.controle, 'Câblage baie Roux');
  assert.equal(c1.titre, 'Dupont Rénovation');
  assert.equal(c1.alerte, true);
  assert.equal(els.filter((e: any) => e.titre === 'Câblage baie Roux').length, 0);
  assert.equal(els.find((e: any) => e.id === 'chantier:c2').alerte, true); // budget ≥ 90 %
  assert.equal(els.find((e: any) => e.id === 'commande:1047').alerte, true);
  assert.equal(els.find((e: any) => e.id === 'video:v1').poste, 'controler');
});
await dit('livraisons à l’heure de la semaine, palier, suggestion à partir de 3 articles, 16 modules en 4 groupes', () => {
  const liv = [{ couloir: 'commandes', promiseLe: '2026-10-29', livreeLe: '2026-10-29' }, { couloir: 'chantiers', promiseLe: '2026-10-30', livreeLe: '2026-10-28' }, { couloir: 'commandes', promiseLe: '2026-10-27', livreeLe: '2026-10-28' }, { couloir: 'commandes', promiseLe: '2026-10-20', livreeLe: '2026-10-20' }, { couloir: 'contenus', promiseLe: '2026-10-30', livreeLe: '2026-10-30' }];
  assert.equal(L.livraisonsALHeure(liv, '2026-10-30'), 2);
  assert.deepEqual(L.palierDesCommandes(58, 52), { palier: 60, restant: 2, atteint: false });
  assert.equal(L.articlesPourLaSuggestion(['a', 'b']).length, 0);
  assert.equal(L.articlesPourLaSuggestion(['a', 'b', 'c', 'd']).length, 4);
  assert.equal(L.SEIZE_MODULES.length, 16);
  assert.deepEqual([...new Set(L.SEIZE_MODULES.map((m: any) => m.groupe))], ['fabriquer', 'livrer', 'stocker', 'montrer']);
  assert.equal(new Set(L.SEIZE_MODULES.map((m: any) => m.id)).size, 16);
  const tuiles = L.tuilesDesModules(new Set(['chantiers', 'stock']));
  assert.equal(tuiles.filter((t: any) => t.active).length, 2);
});

/* ── Les mots ────────────────────────────────────────────────────────────── */
console.log('\nLes mots\n');

await dit('français et anglais ont les mêmes clés ; le français suit la typographie du dépôt', () => {
  const { en, fr } = mots.dictionnaires;
  assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort());
  for (const [k, v] of Object.entries(fr as Record<string, string>)) {
    assert.ok(!v.includes("'"), `apostrophe droite : ${k} → ${v}`);
    assert.ok(!v.includes('!'), `point d’exclamation : ${k}`);
    assert.ok(!/\(s\)/.test(v), `« (s) » : ${k}`);
    assert.ok(!/\d%|\d€/.test(v), `chiffre collé à % ou € : ${k}`);
    assert.ok(v.trim().length > 0, `vide : ${k}`);
  }
  for (const k of Object.keys(en)) {
    const a = ((en as Record<string, string>)[k].match(/\{\w+\}/g) ?? []).sort().join();
    const b = ((fr as Record<string, string>)[k].match(/\{\w+\}/g) ?? []).sort().join();
    assert.equal(a, b, `paramètres différents : ${k}`);
  }
  for (const k of Object.keys(en)) if (k.endsWith('.n')) assert.ok(`${k.slice(0, -2)}.1` in en, `pas de singulier pour ${k}`);
});
await dit('les comptes : 0 et 1 au singulier en français, 1 seulement en anglais', () => {
  assert.equal(mots.compte('fr', 'chantiers.enCours', 0), 'Aucun chantier en cours');
  assert.equal(mots.compte('fr', 'chantiers.enCours', 1), '1 chantier en cours');
  assert.equal(mots.compte('fr', 'chantiers.enCours', 4), '4 chantiers en cours');
  assert.equal(mots.compte('en', 'chantiers.enCours', 4), '4 sites in progress');
  assert.equal(mots.compte('fr', 'photos.n', 0), '0 photo');
  assert.equal(mots.compte('en', 'photos.n', 0), '0 photos');
  assert.equal(mots.compte('fr', 'stock.surveiller', 0), 'Rien sous le seuil');
  assert.equal(mots.traduire('fr', 'stock.negatif', { n: 4 }), 'Il n’en reste que 4. Corrigez la quantité ou faites un inventaire.');
  assert.equal(mots.traduire('fr', 'ligne.travaux.n', { n: 19, moment: 'ce matin' }), '19 travaux sur la ligne ce matin');
  assert.equal(mots.compte('fr', 'qualite.pareto', 3, { pct: 82 }), '3 causes font 82 % des écarts');
  assert.equal(mots.compte('fr', 'video.relecture', 1, { t: 1, total: 3 }), '1 sur 3 traité');
});

/* ── Sur les jeux fictifs de SIM ─────────────────────────────────────────── */
console.log('\nSur les jeux fictifs (volumes peu, normal, beaucoup)\n');

const entiers = (...xs: number[]) => xs.every((x) => Number.isFinite(x));
for (const volume of ['peu', 'normal', 'beaucoup'] as const) {
  const monde = D.construireMonde({ volume });
  const jour: string = monde.contexte.aujourdhui;
  const maintenant: number = monde.contexte.maintenant;

  await dit(`[${volume}] H15 : la quantité des mouvements = celle du jeu, aucun NaN, ordre stable`, () => {
    const arts = monde.articles;
    for (const a of arts) {
      assert.equal(S.quantiteEnStock(a), D.quantiteEnStock(a), a.id);
      const q = S.quantiteEnStock(a);
      assert.ok(entiers(S.remplissage(q, S.niveauCible(a)), S.reperSeuil(a)));
      assert.ok(S.reperSeuil(a) <= 1);
    }
    assert.deepEqual(S.ordreDesJauges(arts).map((a: any) => a.id), S.ordreDesJauges([...arts].reverse()).map((a: any) => a.id));
    const surv = S.articlesASurveiller(arts);
    assert.ok(surv.every((a: any) => S.quantiteEnStock(a) <= a.seuilAlerte));
    assert.ok(entiers(S.valorisationCents(arts)));
    const r = S.rupturesAVenir(arts, [], jour);
    assert.ok(r.visibles.length <= 3);
    assert.equal(r.visibles.length + r.restants, S.rupturesAVenir(arts, [], jour, Infinity).visibles.length);
    // une commande groupée ne commande jamais un article en trop et n'a pas de quantité absurde
    for (const g of S.commandeGroupee(arts, monde.fournisseurs.map((f: any) => ({ id: f.id, nom: f.nom ?? f.name })), [], jour)) {
      assert.ok(g.lignes.every((l: any) => l.quantite >= 1 && Number.isInteger(l.quantite)));
    }
  });

  await dit(`[${volume}] H16 : avancement, budget et statut des chantiers sont cohérents`, () => {
    for (const c of monde.chantiers) {
      const av = H.avancement(c);
      assert.ok(av >= 0 && av <= 100, c.id);
      const st = H.statutDuChantier(c, jour);
      assert.ok(['À venir', 'En cours', 'En retard', 'Terminé'].includes(st));
      if (c.etapes.every((e: any) => e.faite)) assert.equal(av, 100);
      if (c.etapes.every((e: any) => !e.faite)) assert.equal(av, 0);
      assert.ok(['en-phase', 'a-surveiller', 'a-demarrer', 'sans-budget'].includes(H.rythme(c)));
    }
    const r = H.resumeDesChantiers(monde.chantiers, jour);
    assert.equal(r.enCours + r.aDemarrer + r.termines, monde.chantiers.length);
  });

  await dit(`[${volume}] H17 : la marque d’exemple est complète sauf les règles à éviter (champ à ajouter)`, () => {
    for (const m of monde.marque) {
      const chap = MQ.etatDesChapitres(m);
      assert.equal(chap.length, 5);
      assert.ok(chap.filter((c: any) => c.id !== 'a-eviter').every((c: any) => c.complet), 'logo, couleurs, police et modèles');
      assert.equal(MQ.partsDeCouleurs(m.palette).reduce((s: number, p: any) => s + p.part, 0), 100);
      assert.ok(m.palette.every((c: any) => MQ.hexNormalise(c.hex) !== null));
    }
  });

  await dit(`[${volume}] MR01 : étapes reconnues, séries sans NaN`, () => {
    for (const v of monde.videos) {
      assert.ok(['Idée', 'Enregistrement', 'Montage', 'Sous-titrage', 'Relecture', 'Publiée'].includes(V.etapeNormalisee(v.etape)));
      const a = V.avancementVideo(v);
      assert.ok(a >= 0 && a <= 100);
      if (V.etapeNormalisee(v.etape) === 'Publiée') assert.equal(a, 100);
      else assert.ok(a < 100);
      assert.ok(['vues', 'prochaine', 'etape'].includes(V.ligneEtat(v).type));
    }
    const s = V.serieUneVideoParSemaine(monde.videos.filter((v: any) => v.lienPublication).map((v: any) => v.prevueLe), jour);
    assert.equal(s.cases.length, 6);
    assert.ok(s.faites >= 0 && s.faites <= 6);
  });

  await dit(`[${volume}] MR02 : statuts des pages, visites`, () => {
    const sections = monde.pagesPubliques.map((p: any) => ({ id: p.id, titre: p.titre, versionEnLigne: p.versionEnLigne, versionTravail: p.versionTravail, brouillon: p.statut === 'Brouillon' }));
    for (const s of sections) assert.ok(['En ligne', 'Modifiée', 'À vérifier', 'Brouillon'].includes(P.statutDeSection(s)));
    for (const p of monde.pagesPubliques) {
      const s = sections.find((x: any) => x.id === p.id);
      if (p.statut === 'Publiée') assert.equal(P.statutDeSection(s), 'En ligne', p.id);
      if (p.statut === 'Modifications non publiées') assert.equal(P.statutDeSection(s), 'Modifiée', p.id);
      if (p.statut === 'Brouillon') assert.equal(P.statutDeSection(s), 'Brouillon', p.id);
    }
    assert.equal(P.changementsEnAttente(sections).length, monde.pagesPubliques.filter((p: any) => p.statut !== 'Publiée').length);
    assert.ok(P.controlesAvantPublication(sections).length <= 3);
  });

  await dit(`[${volume}] MR03 : une tournée du jour se calcule, les heures croissent`, () => {
    const etapes = monde.etapesTournee.filter((e: any) => e.jour === jour).sort((a: any, b: any) => a.ordre - b.ordre);
    const entrees = etapes.map((e: any) => ({ id: e.id, lieu: e.lieu, trajetMin: 15, trajetKm: 7, dureeMin: e.dureeMin, etat: e.etat, heureFixee: e.heureFixee ? e.arriveePrevue : null }));
    const calc = T.calculerHeures('08:00', entrees);
    let precedent = -1;
    for (const c of calc) {
      const m = C.minutesDe(c.arriveeEstimee);
      assert.ok(m >= precedent, 'les heures ne reculent jamais');
      precedent = m;
    }
    if (calc.length) {
      const r = T.resumerTournee(calc, Object.fromEntries(etapes.map((e: any) => [e.id, e.arriveePrevue])));
      assert.equal(r.surPlaceMin, etapes.reduce((s: number, e: any) => s + e.dureeMin, 0));
      assert.ok(entiers(r.distanceKm, r.routeMin, r.retardMin));
    }
    assert.ok(['vide', 'pas-commencee', 'en-cours', 'bouclee'].includes(T.etatDeLaTournee(entrees)));
  });

  await dit(`[${volume}] MR04 : le parc se partage sans doublon ni oubli`, () => {
    const eqs = monde.equipements.map((e: any) => ({ id: e.id, nom: e.nom, etat: e.etat, affectation: e.affectation, prochainEntretienLe: e.prochainEntretienLe, periodiciteMois: e.periodiciteMois, reforme: e.statut === 'Au rebut' }));
    const r = MA.resumerLeParc(eqs, jour);
    assert.equal(r.segments.bonEtat + r.segments.aVerifier + r.segments.horsService, r.total);
    assert.equal(r.total + r.reformes, eqs.length);
    assert.equal(MA.filtrerParPuce(eqs, 'tous', jour).length, r.total);
    for (const e of eqs) { const j = MA.jaugeDEtat(e, jour); assert.ok(j.segments >= 1 && j.segments <= 5); }
  });

  await dit(`[${volume}] MR05 : prix TTC et stock des produits`, () => {
    const prods = monde.produits.map((p: any) => ({ id: p.id, nom: p.nom, description: p.description, prixHtCents: p.prixCents, type: p.type, quantite: p.quantite, niveauConseille: p.niveauCible, seuilAlerte: p.seuilAlerte, photos: 0, etat: p.etat }));
    for (const p of prods) {
      assert.ok(CA.prixTtcCents(p.prixHtCents) >= p.prixHtCents);
      assert.ok(['rouge', 'orange', 'vert', 'bleu'].includes(CA.tonDuStock(p)));
      if (p.type !== 'produit en stock') assert.equal(CA.tonDuStock(p), 'bleu');
    }
    const fc = CA.fichesCompletes(prods);
    assert.equal(fc.total, prods.filter((p: any) => p.etat === 'actif').length);
    assert.equal(fc.completes, 0, 'aucune photo dans les jeux fictifs : champ à ajouter');
  });

  await dit(`[${volume}] MR06 : aucun doublon confirmé dans les jeux, créneaux dans les plages`, () => {
    const ress = monde.ressources;
    const confirmees = monde.reservations.filter((r: any) => r.statut === 'confirmée');
    for (const r of confirmees) assert.equal(R.verifierSansDoublon(r, confirmees).length, 0, `doublon sur ${r.id}`);
    for (const r of ress) for (const c of R.creneauxLibres(r, monde.reservations, jour)) {
      assert.ok(c.debut >= 8 * 60 && c.fin <= 18 * 60 && c.dureeMin >= 60);
    }
    const occ = R.occupationDuJour(ress, monde.reservations, jour);
    assert.ok(occ === null || (occ >= 0 && occ <= 100));
  });

  await dit(`[${volume}] MR07 : les compteurs recoupent le jeu`, () => {
    const cmds = monde.commandes.map((c: any) => ({ id: c.id, numero: c.numero, statut: c.preparation, remise: c.remise, creeLe: c.creeLe, echeanceLe: c.prevueLe, urgente: c.urgente, livreeLe: c.preparation === 'Remise' ? c.prevueLe : null }));
    const k = CM.compter(cmds, jour, maintenant);
    assert.equal(k.enCours, k.recues + k.enPreparation + k.expediees);
    assert.equal(k.enCours, cmds.filter((c: any) => c.statut !== 'Remise').length);
    assert.ok(k.urgentes >= cmds.filter((c: any) => c.urgente && c.statut !== 'Remise').length);
    assert.equal(CM.trierEnCours(cmds, jour).length, k.enCours);
    const p = CM.palierDeLivraisons(k.livreesCeMois, 0);
    assert.equal(p.atteint, k.livreesCeMois >= p.palier);
    assert.equal(p.restant, Math.max(0, p.palier - k.livreesCeMois));
  });

  await dit(`[${volume}] MR09 : véhicules, échéances sans NaN`, () => {
    for (const v of monde.vehicules) {
      const e = FL.echeanceProche([
        { nom: 'Entretien', nature: v.prochainEntretien.km ? 'km' : 'jours', intervalle: 15000, aKm: v.prochainEntretien.km, le: v.prochainEntretien.le },
        { nom: 'Assurance', nature: 'jours', intervalle: 365, le: v.assuranceLe },
        { nom: 'Contrôle technique', nature: 'jours', intervalle: 730, le: v.controleTechniqueLe },
      ], v.kilometrage, 20, jour);
      assert.ok(e && entiers(e.partEcoulee, e.joursRestants) && e.partEcoulee >= 0 && e.partEcoulee <= 100);
      assert.ok(['Disponible', 'En tournée', 'Au garage', 'Hors service'].includes(FL.etatNormalise(v.etat)));
    }
  });

  await dit(`[${volume}] MR10 : dossiers photos, complétude`, () => {
    for (const d of monde.dossiersPhotos) {
      const entree = { id: d.id, photos: d.photos, demarre: d.demarre, debutPrevuLe: d.debutPrevuLe };
      const c = PH.completude(entree);
      assert.ok(c.pct >= 0 && c.pct <= 100);
      const k = PH.comptesParPhase(d.photos);
      assert.equal(k.Avant + k.Pendant + k.Après, d.photos.length);
      assert.ok(PH.planchePhotosParJour(d.photos).every((j: any) => j.vignettes.length <= 8));
      if (d.photos.length === 0) assert.equal(c.ton, 'pointille');
    }
  });

  await dit(`[${volume}] MR11 : contrôles, écarts, Pareto`, () => {
    const modeles = new Map(monde.modelesControle.map((m: any) => [m.id, m]));
    const controles = monde.controles.map((c: any) => ({ id: c.id, pointsIds: (modeles.get(c.modeleId) as any).points.map((p: any) => p.id), resultats: c.resultats, le: c.le, signeLe: c.statut === 'Terminé' ? c.le : null }));
    for (const c of controles) {
      const k = Q.compterLesPoints(c);
      assert.equal(k.conformes + k.nonConformes + k.sansObjet + k.aVerifier, k.total);
      const conf = Q.conformiteDuControle(c);
      assert.ok(conf.pct >= 0 && conf.pct <= 100);
    }
    const ecarts = monde.ecarts.map((e: any) => ({ id: e.id, cause: e.libelle, releveLe: jour, lieu: e.chantierId }));
    const p = Q.pareto(ecarts, jour);
    assert.equal(p.total, ecarts.length);
    assert.equal(p.barres.reduce((s: number, b: any) => s + b.nombre, 0), ecarts.length);
    if (p.barres.length) assert.equal(p.barres[p.barres.length - 1].cumulPct, 100);
  });

  await dit(`[${volume}] F50 : la ligne se construit à partir des jeux, les comptes se recoupent`, () => {
    const modeles = new Map(monde.modelesControle.map((m: any) => [m.id, m]));
    const ouverts = monde.controles.filter((c: any) => c.statut !== 'Terminé' && c.chantierId).filter((c: any) => monde.ecarts.some((e: any) => e.controleId === c.id && e.etat === 'ouvert'))
      .map((c: any) => ({ chantierId: c.chantierId, nom: (modeles.get(c.modeleId) as any).nom, nonConformes: 1 }));
    const els = L.elementsDeProduction({
      chantiers: monde.chantiers, controlesOuverts: ouverts,
      commandes: monde.commandes.map((c: any) => ({ id: c.id, numero: c.numero, statut: c.preparation, creeLe: c.creeLe, echeanceLe: c.prevueLe, urgente: c.urgente, livreeLe: c.preparation === 'Remise' ? c.prevueLe : null })),
      videos: monde.videos, retoursParVideo: {}, aujourdhui: jour,
    });
    const ligne = L.construireLigne(els);
    assert.equal(ligne.postes.reduce((s: number, p: any) => s + p.compte, 0), els.length);
    assert.equal(ligne.toutEnCours, els.filter((e: any) => e.poste !== 'livre').length);
    assert.equal(ligne.couloirs.reduce((s: number, c: any) => s + c.enCours, 0), ligne.toutEnCours);
    assert.equal(new Set(els.map((e: any) => e.id)).size, els.length, 'un élément n’est qu’à un poste');
    for (const c of ligne.couloirs) for (const p of L.POSTES) assert.ok(c.cellules[p].length <= 2);
  });
}

await dit('les jeux fictifs « vide » donnent des écrans vides, jamais d’erreur', () => {
  const monde = D.construireMonde({ volume: 'vide' });
  assert.equal(S.rupturesAVenir(monde.articles, [], monde.contexte.aujourdhui).aucune, true);
  assert.equal(H.resumeDesChantiers(monde.chantiers, monde.contexte.aujourdhui).enCours, 0);
  assert.equal(H.chantierParDefaut(monde.chantiers, monde.contexte.aujourdhui), null);
  assert.equal(L.construireLigne([]).arret, true);
  assert.deepEqual(CA.fichesCompletes([]), { completes: 0, total: 0 });
  assert.equal(CM.compter([], monde.contexte.aujourdhui, monde.contexte.maintenant).enCours, 0);
  assert.equal(Q.pareto([], monde.contexte.aujourdhui).total, 0);
});

/* ── Isolement ───────────────────────────────────────────────────────────── */
console.log('\nIsolement\n');

const lire = (f: string) => fs.readFileSync(path.join(racine, f), 'utf8');
const sources = fs.readdirSync(path.join(racine, 'src/refonte/creer')).filter((f) => f.endsWith('.ts'));

await dit('la logique ne contient ni React, ni brique visuelle du socle, ni donnée de maquette', () => {
  for (const f of sources) {
    const s = lire(`src/refonte/creer/${f}`);
    assert.ok(!/from 'react'|from "react"/.test(s), `${f} importe React`);
    assert.ok(!/socle\/ui(?!\/graphiques\/format)/.test(s.replace(/\/\*[\s\S]*?\*\//g, '')), `${f} importe une brique visuelle`);
    assert.ok(!/refonte\/donnees/.test(s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), `${f} importe les jeux fictifs`);
    for (const nom of ['Dupont', 'Roux', 'Medina', 'Rexel', 'Legrand', 'AMN DevSec', 'Horizon', 'Atelier Marbre']) {
      assert.ok(!s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').includes(nom), `${f} contient « ${nom} » en dur`);
    }
    assert.ok(!/Date\.now\(\)|new Date\(\)|performance\.now/.test(s), `${f} lit l’horloge`);
  }
});
await dit('aucun fichier partagé avec l’édition cliente n’importe src/refonte/creer', () => {
  const sortie: string[] = [];
  const parcourir = (d: string) => {
    for (const e of fs.readdirSync(path.join(racine, d), { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) { if (!['refonte', 'socle', 'node_modules'].includes(e.name) || d !== 'src') parcourir(p); continue; }
      if (!/\.(ts|tsx)$/.test(e.name)) continue;
      if (/\.internal\.|\.business\./.test(e.name)) continue;
      if (/refonte\/creer/.test(lire(p))) sortie.push(p);
    }
  };
  parcourir('src');
  assert.deepEqual(sortie.filter((p) => !p.startsWith('src/refonte/') && !p.startsWith('src/socle/')), []);
});

console.log('');
if (echecs) {
  console.error(`ÉCHEC — ${echecs} propriété(s) de « Créer et produire » ne tiennent pas.`);
  process.exit(1);
}
console.log(`OK — ${vus} propriétés de « Créer et produire » tiennent.`);
