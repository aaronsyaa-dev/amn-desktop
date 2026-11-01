#!/usr/bin/env node
/**
 * TESTS INDÉPENDANTS DES MODULES D'ARGENT DE L'ATELIER (F1).
 *
 * Les tests de F1 (`src/ateliers/*\/tests.ts`) sont écrits par la même session
 * que la logique : ils partagent ses hypothèses. Ceux-ci recalculent avec un
 * oracle écrit à part, en ENTIERS (BigInt), sans nombre à virgule : un
 * flottant qui tombe à 0,4999999 au lieu de 0,5 donne un centime de travers,
 * invisible à l'écran et à toute relecture.
 *
 * Ils ne modifient rien : le code de F1 est empaqueté en mémoire (esbuild).
 *
 *   F1_ROOT=<dossier d'un checkout de claude/refonte-atelier-f1> node tests/f1/argent.test.mjs
 *
 * Sans F1_ROOT : le dépôt courant (utile une fois F1 fusionné). Sort 1 au
 * premier module en défaut, après avoir tout lancé.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(ICI, '..', '..');
const F1 = path.resolve(process.env.F1_ROOT ?? REPO);
const require = createRequire(path.join(REPO, 'package.json'));
const esbuild = require('esbuild');

if (!fs.existsSync(path.join(F1, 'src', 'ateliers', 'echeancier', 'logique.ts'))) {
  console.error(`Pas d'atelier dans ${F1} (src/ateliers/echeancier/logique.ts introuvable) : renseignez F1_ROOT.`);
  process.exit(2);
}

const MODULES = ['echeancier', 'penalites', 'indemnitesKm', 'amortissements', 'situations', 'tauxHoraire'];
const entree = MODULES.filter((m) => fs.existsSync(path.join(F1, 'src', 'ateliers', m, 'logique.ts')))
  .map((m) => `export * as ${m} from './src/ateliers/${m}/logique.ts';`)
  .concat(`export * as nombres from './src/ateliers/_commun/nombres.ts';`)
  .join('\n');
const sortie = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'f1-argent-')), 'f1.mjs');
await esbuild.build({ stdin: { contents: entree, resolveDir: F1, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile: sortie, logLevel: 'error' });
const f1 = await import(pathToFileURL(sortie).href);

/* ── mini-lanceur : tout est lancé, les défauts sont comptés ─────────────── */
const defauts = [];
let verifies = 0;
const groupes = [];
function groupe(nom, corps) {
  const avant = defauts.length, v0 = verifies;
  try { corps(); } catch (e) { defauts.push(`${nom} : exception ${e?.message ?? e}`); }
  const n = defauts.length - avant;
  groupes.push({ nom, n, v: verifies - v0 });
  console.log(`${n === 0 ? '✓' : '✗'} ${nom} — ${verifies - v0} vérification(s)${n ? `, ${n} défaut(s)` : ''}`);
}
function egal(reel, attendu, message) {
  verifies += 1;
  if (!Object.is(reel, attendu)) { if (defauts.length < 400) defauts.push(`${message} : obtenu ${reel}, attendu ${attendu}`); else defauts.length === 400 && defauts.push('… (défauts suivants tus)'); }
}
function vrai(cond, message) { egal(Boolean(cond), true, message); }

/** Quotient entier arrondi à la demie vers le haut, pour num >= 0 et den > 0. */
const demiHaut = (num, den) => (2n * num + den) / (2n * den);

/* ── 1. Pénalités de retard : intérêts = montant × taux × jours / 36 500 ─── */
groupe('penalites : intérêts au centime exact (BigInt)', () => {
  const montants = [1, 7, 99, 100, 12_345, 99_999, 123_456, 1_000_000, 4_999_999];
  const taux = [0.01, 0.5, 1, 2.15, 3.15, 6.45, 10, 12.25, 13.15, 15.5, 20, 100]; // en %, 2 décimales
  const jours = [1, 2, 7, 15, 30, 31, 45, 60, 90, 180, 365, 366, 400];
  for (const m of montants) for (const t of taux) for (const j of jours) {
    // taux × 100 : entier exact (tous les taux ci-dessus ont 2 décimales au plus)
    const tCent = BigInt(Math.round(t * 100));
    const attendu = Number(demiHaut(BigInt(m) * tCent * BigInt(j), 10_000n * 365n));
    egal(f1.penalites.interets(m, t, j), attendu, `interets(${m}, ${t} %, ${j} j)`);
  }
});

groupe('penalites : jours nuls ou négatifs, taux appliqué, plancher', () => {
  egal(f1.penalites.interets(100_000, 15, 0), 0, 'interets à 0 jour');
  egal(f1.penalites.interets(100_000, 15, -3), 0, 'interets à jours négatifs');
  const p = { dateCalcul: '2026-10-22', tauxBce: 2.15, tauxLegal: 3.15 };
  const pro = f1.penalites.tauxApplique('pro', p);
  egal(pro.taux, 12.15, 'pro sans contrat : BCE + 10 points'); // 2,15 + 10 = 12,15 ≥ plancher 9,45
  egal(pro.base, 'bce', 'pro sans contrat : base bce');
  const bas = f1.penalites.tauxApplique('pro', { ...p, tauxContractuel: 5 });
  egal(bas.taux, 9.45, 'contrat sous le plancher : 3 × taux légal'); // 3 × 3,15
  egal(bas.base, 'plancher', 'contrat sous le plancher : base plancher');
  const part = f1.penalites.tauxApplique('particulier', p);
  egal(part.taux, 3.15, 'particulier : taux légal');
});

groupe('penalites : indemnité de 40 € et mise en demeure', () => {
  const p = { dateCalcul: '2026-10-22', tauxBce: 2.15, tauxLegal: 3.15 };
  const fact = (id, debiteur, echeance, montantTTC = 100_000) => ({ id, debiteur, echeance, montantTTC });
  // Pro : 40 € par facture en retard, intérêts dès le lendemain de l'échéance.
  const r = f1.penalites.calculerPenalites({ id: 'd', type: 'pro' }, [fact('a', 'd', '2026-10-01'), fact('b', 'd', '2026-10-21'), fact('c', 'd', '2026-10-22'), fact('e', 'd', '2026-11-01')], p);
  egal(r.indemnites, 8_000, 'pro : deux factures en retard (1 et 21 oct.) = 80 €');
  egal(r.lignes.find((l) => l.facture.id === 'a').joursRetard, 21, 'retard du 1er au 22 octobre = 21 jours');
  egal(r.lignes.find((l) => l.facture.id === 'c').joursRetard, 0, 'échéance du jour : pas encore en retard');
  egal(r.total, r.principal + r.interets + r.indemnites, 'total = principal + intérêts + indemnités');
  // Particulier sans mise en demeure : rien n'a couru, pas d'indemnité.
  const s = f1.penalites.calculerPenalites({ id: 'x', type: 'particulier' }, [fact('a', 'x', '2026-09-01')], p);
  egal(s.interets, 0, 'particulier sans mise en demeure : 0 intérêt');
  egal(s.indemnites, 0, 'particulier : jamais d’indemnité de 40 €');
  // Particulier avec mise en demeure : intérêts à partir de la lettre, pas de l'échéance.
  const m = f1.penalites.calculerPenalites({ id: 'x', type: 'particulier', dateMiseEnDemeure: '2026-10-12' }, [fact('a', 'x', '2026-09-01')], p);
  egal(m.lignes[0].joursInterets, 10, 'particulier : 10 jours depuis la mise en demeure du 12');
  // Paramètres fautifs : refus net.
  egal(f1.penalites.calculerPenalites({ id: 'd', type: 'pro' }, [], { ...p, tauxBce: -1 }), null, 'taux BCE négatif refusé');
  egal(f1.penalites.calculerPenalites({ id: 'd', type: 'pro' }, [], { ...p, dateCalcul: '2026-02-30' }), null, 'date impossible refusée');
});

/* ── 2. Paiement en plusieurs fois ────────────────────────────────────────── */
groupe('echeancier : la somme des échéances vaut exactement le reste', () => {
  for (let reste = 1; reste <= 3000; reste += 1) {
    for (let n = 2; n <= 12; n += 1) {
      const m = f1.echeancier.montants(reste, n);
      egal(m.length, n, `montants(${reste}, ${n}) : nombre`);
      egal(m.reduce((a, b) => a + b, 0), reste, `montants(${reste}, ${n}) : somme`);
      const autres = m.slice(1);
      vrai(autres.every((x) => x === autres[0]), `montants(${reste}, ${n}) : les suivantes sont égales`);
      vrai(m[0] >= autres[0] && m[0] - autres[0] <= n - 1, `montants(${reste}, ${n}) : la première absorbe au plus n−1 centimes`);
    }
  }
});

groupe('echeancier : dates sans glissement, états, refus', () => {
  const base = { id: 'e', client: 'C', reference: 'F-1', objet: 'o', montantTTC: 120_000, acompte: 20_000, nombre: 4, premiereDate: '2026-01-31', payees: [] };
  const dates = f1.echeancier.echeances(base, '2026-01-01').map((x) => x.date);
  egal(dates.join(), '2026-01-31,2026-02-28,2026-03-31,2026-04-30', '31 janvier : 28 février puis retour au 31 (pas de glissement)');
  const bis = f1.echeancier.echeances({ ...base, premiereDate: '2028-01-31' }, '2028-01-01').map((x) => x.date);
  egal(bis[1], '2028-02-29', 'année bissextile : 29 février');
  const etats = f1.echeancier.echeances({ ...base, premiereDate: '2026-10-22', payees: [0] }, '2026-11-23');
  egal(etats[0].etat, 'payee', 'rang 0 payé');
  egal(etats[1].etat, 'enRetard', 'échéance du 22 novembre non payée, le 23 : en retard');
  egal(etats[1].retard, 1, 'un jour de retard');
  const jour = f1.echeancier.echeances({ ...base, premiereDate: '2026-10-22' }, '2026-10-22');
  egal(jour[0].etat, 'aVenir', 'le jour même : à venir');
  egal(f1.echeancier.echeances({ ...base, nombre: 1 }, '2026-01-01'), null, 'un seul paiement : refusé');
  egal(f1.echeancier.echeances({ ...base, nombre: 13 }, '2026-01-01'), null, '13 paiements : refusé');
  egal(f1.echeancier.echeances({ ...base, acompte: 120_000 }, '2026-01-01'), null, 'acompte = montant : refusé');
  egal(f1.echeancier.echeances({ ...base, montantTTC: 1_001, acompte: 1_000, nombre: 4 }, '2026-01-01'), null, 'reste inférieur au nombre d’échéances : refusé');
  egal(f1.echeancier.echeances({ ...base, montantTTC: 100.5 }, '2026-01-01'), null, 'montant non entier refusé');
});

/* ── 3. Indemnités kilométriques (barème voiture, publié par l'administration) ─ */
groupe('indemnitesKm : barème 2024 recalculé en entiers', () => {
  // Barème des voitures (revenus 2024, reconduit du précédent) — saisi à part, de mémoire du texte
  // publié ; NON re-vérifié en ligne ici (F1 signale lui-même « à vérifier pour 2026 »).
  // millièmes d'euro par km : [≤5000, 5001-20000, >20000] ; fixe de la 2e tranche en centimes.
  const B = { 3: [529, 316, 106_500, 370], 4: [606, 340, 133_000, 407], 5: [636, 357, 139_500, 427], 6: [665, 374, 145_700, 447], 7: [697, 394, 151_500, 470] };
  const kms = [1, 100, 1_234, 4_999, 5_000, 5_001, 10_000, 12_345, 19_999, 20_000, 20_001, 35_000, 60_000];
  for (const [cv, [a, b, c, e]] of Object.entries(B)) for (const km of kms) for (const elec of [false, true]) {
    // brut en centimes, fraction exacte (num/den) puis majoration de 20 % si électrique.
    let num, den = 10n;
    const K = BigInt(km);
    if (km <= 5000) num = K * BigInt(a);
    else if (km <= 20_000) num = K * BigInt(b) + BigInt(c) * 10n;
    else num = K * BigInt(e);
    if (elec) { num *= 120n; den *= 100n; }
    egal(f1.indemnitesKm.indemniteAnnuelle(km, cv, elec), Number(demiHaut(num, den)), `indemniteAnnuelle(${km} km, ${cv} CV, électrique ${elec})`);
  }
  egal(f1.indemnitesKm.indemniteAnnuelle(0, '5', false), 0, '0 km : 0');
  egal(f1.indemnitesKm.indemniteAnnuelle(-5, '5', false), 0, 'km négatifs : 0');
  egal(f1.indemnitesKm.indemniteAnnuelle(Number.NaN, '5', false), 0, 'NaN : 0');
  egal(f1.indemnitesKm.tranche(5_000), 1, '5 000 km : 1re tranche');
  egal(f1.indemnitesKm.tranche(5_001), 2, '5 001 km : 2e tranche');
  egal(f1.indemnitesKm.tranche(20_000), 2, '20 000 km : 2e tranche');
  egal(f1.indemnitesKm.tranche(20_001), 3, '20 001 km : 3e tranche');
});

groupe('indemnitesKm : répartition au prorata = total exact', () => {
  const cas = [[100_000, [1, 1, 1]], [100_001, [3, 3, 3]], [7, [1, 1, 1, 1, 1]], [123_457, [10.5, 20.25, 3]], [1, [5, 5]], [999_999, [1, 2, 3, 4, 5, 6]]];
  for (const [total, poids] of cas) {
    const parts = f1.indemnitesKm.repartirAuProrata(total, poids);
    egal(parts.reduce((x, y) => x + y, 0), total, `repartirAuProrata(${total}, [${poids}]) : somme`);
    vrai(parts.every((p) => Number.isInteger(p) && p >= 0), `repartirAuProrata(${total}, [${poids}]) : entiers positifs`);
  }
  egal(f1.indemnitesKm.repartirAuProrata(100, [0, 0]).join(), '0,0', 'poids nuls : zéros');
});

/* ── 4. Amortissements ────────────────────────────────────────────────────── */
groupe('amortissements : somme des dotations = valeur, jamais négative', () => {
  const valeurs = [1, 99, 50_000, 123_457, 999_999, 12_345_678];
  const durees = [1, 2, 3, 5, 7, 10];
  const dates = ['2026-01-01', '2026-01-31', '2026-02-28', '2026-03-15', '2026-06-30', '2026-12-31', '2028-02-29'];
  const clotures = [12, 6, 3, 1];
  for (const valeur of valeurs) for (const dureeAnnees of durees) for (const miseEnService of dates) for (const mc of clotures) {
    const immo = { id: 'i', designation: 'x', valeur, miseEnService, dureeAnnees };
    const plan = f1.amortissements.planAmortissement(immo, mc);
    const ctx = `${valeur} c., ${dureeAnnees} an(s), service ${miseEnService}, clôture mois ${mc}`;
    vrai(plan.length >= 1, `plan non vide (${ctx})`);
    egal(plan.reduce((s, l) => s + l.dotation, 0), valeur, `somme des dotations (${ctx})`);
    vrai(plan.every((l) => l.dotation >= 0), `dotations positives (${ctx})`);
    egal(plan.at(-1).vnc, 0, `valeur nette finale nulle (${ctx})`);
    vrai(plan.every((l, i) => i === 0 || l.cumul >= plan[i - 1].cumul), `cumul croissant (${ctx})`);
    egal(plan.reduce((s, l) => s + l.jours, 0), 360 * dureeAnnees, `jours cumulés = 360 × durée (${ctx})`);
  }
});

groupe('amortissements : 30/360 et refus', () => {
  egal(f1.amortissements.jours360('2026-01-01', '2026-12-31'), 360, 'année pleine = 360 jours');
  egal(f1.amortissements.jours360('2026-02-01', '2026-02-28'), 30, 'février entier = 30 jours');
  egal(f1.amortissements.jours360('2026-07-01', '2026-12-31'), 180, 'second semestre = 180 jours');
  egal(f1.amortissements.exerciceDe('2026-12-31', 12), 2026, 'exercice du 31 décembre');
  egal(f1.amortissements.exerciceDe('2026-07-01', 6), 2027, 'clôture en juin : juillet appartient à l’exercice suivant');
  egal(f1.amortissements.planAmortissement({ id: 'i', designation: 'x', valeur: 0, miseEnService: '2026-01-01', dureeAnnees: 5 }, 12).length, 0, 'valeur nulle : pas de plan');
  egal(f1.amortissements.planAmortissement({ id: 'i', designation: 'x', valeur: 100_000, miseEnService: '2026-02-30', dureeAnnees: 5 }, 12).length, 0, 'date impossible : pas de plan');
  egal(f1.amortissements.planAmortissement({ id: 'i', designation: 'x', valeur: 100_000, miseEnService: '2026-01-01', dureeAnnees: 5 }, 13).length, 0, 'mois de clôture 13 : pas de plan');
});

/* ── 5. Outils communs ────────────────────────────────────────────────────── */
groupe('nombres : arrondi demi-haut, saisies illisibles, répartition', () => {
  egal(f1.nombres.arrondiCentime(0.5), 1, 'arrondi de 0,5');
  egal(f1.nombres.arrondiCentime(1.5), 2, 'arrondi de 1,5');
  egal(f1.nombres.arrondiCentime(-0.5), -1, 'arrondi de −0,5 (symétrique)');
  egal(f1.nombres.arrondiCentime(2.4999), 2, 'arrondi de 2,4999');
  egal(f1.nombres.versCentimes('12,5'), 1250, 'versCentimes("12,5")');
  egal(f1.nombres.versCentimes('1 234,56'), 123_456, 'versCentimes avec espace');
  // Toute saisie à deux décimales doit rendre exactement ses centimes (pas de 0,01 € perdu par un flottant).
  for (let c = 0; c <= 200_000; c += 1) {
    const euros = `${Math.floor(c / 100)},${String(c % 100).padStart(2, '0')}`;
    if (f1.nombres.versCentimes(euros) !== c) { egal(f1.nombres.versCentimes(euros), c, `versCentimes("${euros}")`); }
  }
  verifies += 1;
  vrai(Number.isNaN(f1.nombres.versCentimes('abc')), 'saisie illisible : NaN');
  for (const [total, n] of [[100, 3], [101, 3], [-100, 3], [7, 12], [0, 5]]) {
    const parts = f1.nombres.repartir(total, n);
    egal(parts.reduce((a, b) => a + b, 0), total, `repartir(${total}, ${n}) : somme`);
  }
  egal(f1.nombres.repartir(100, 0).length, 0, 'repartir en 0 parts : vide');
});

groupe('nombres : dates', () => {
  egal(f1.nombres.ajouterMois('2026-01-31', 1), '2026-02-28', '31 janvier + 1 mois');
  egal(f1.nombres.ajouterMois('2028-01-31', 1), '2028-02-29', '31 janvier 2028 + 1 mois');
  egal(f1.nombres.ajouterMois('2026-03-31', -1), '2026-02-28', '31 mars − 1 mois');
  egal(f1.nombres.ajouterMois('2026-11-30', 3), '2027-02-28', '30 novembre + 3 mois');
  egal(f1.nombres.ajouterMois('2026-12-15', 1), '2027-01-15', 'passage d’année');
  egal(f1.nombres.joursEntre('2026-10-22', '2026-10-23'), 1, 'un jour');
  egal(f1.nombres.joursEntre('2026-03-28', '2026-03-30'), 2, 'passage à l’heure d’été : 2 jours, pas 1,96');
  egal(f1.nombres.joursEntre('2026-10-24', '2026-10-26'), 2, 'passage à l’heure d’hiver : 2 jours');
  for (const d of ['2026-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '26-01-01', '2026-1-1', '']) {
    egal(f1.nombres.estDateIso(d), false, `date refusée : « ${d} »`);
  }
  for (const d of ['2026-02-28', '2028-02-29', '2026-12-31', '2000-02-29']) egal(f1.nombres.estDateIso(d), true, `date acceptée : ${d}`);
  egal(f1.nombres.estDateIso('1900-02-29'), false, '1900 n’est pas bissextile');
});

/* ── Rapport ──────────────────────────────────────────────────────────────── */
console.log(`\n${verifies} vérification(s) dans ${groupes.length} groupe(s) — ${defauts.length} défaut(s).`);
if (defauts.length) {
  console.log('\nDéfauts :');
  for (const d of defauts.slice(0, 60)) console.log(`  ✗ ${d}`);
  if (defauts.length > 60) console.log(`  … et ${defauts.length - 60} autres`);
}
fs.rmSync(path.dirname(sortie), { recursive: true, force: true });
process.exit(defauts.length ? 1 : 0);
