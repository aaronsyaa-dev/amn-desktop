import { egal, vrai, type Test } from '../_commun/test';
import { ANNEE_EXEMPLE, PUISSANCE_EXEMPLE, TRAJETS } from './donnees';
import { BAREME_2025, PUISSANCES, SEUIL_1, SEUIL_2, bilan, indemniteAnnuelle, kmDuTrajet, repartirAuProrata, tranche, verifierTrajet } from './logique';

const somme = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0);

export const TESTS: Test[] = [
  {
    nom: 'un aller-retour compte double',
    f: () => {
      egal(kmDuTrajet({ km: 36.5, allerRetour: true }), 73);
      egal(kmDuTrajet({ km: 61.7, allerRetour: false }), 61.7);
    },
  },
  {
    nom: 'exemple 5 CV : 1 227,1 km, tranche 1, 1 227,1 × 0,636 = 780,44 €',
    f: () => {
      const b = bilan(TRAJETS, ANNEE_EXEMPLE, PUISSANCE_EXEMPLE, false);
      egal(b.kmTotal, 1227.1);
      egal(b.tranche, 1);
      egal(b.indemnite, 78_044);
    },
  },
  {
    nom: 'la part de chaque trajet et de chaque mois retombe exactement sur le total',
    f: () => {
      const b = bilan(TRAJETS, ANNEE_EXEMPLE, '7', true);
      egal(somme(b.parTrajet.map((p) => p.montant)), b.indemnite);
      egal(somme(b.parMois.map((m) => m.montant)), b.indemnite);
      egal(b.parMois.map((m) => m.mois)[0], '2026-01');
      egal(Math.round(somme(b.parMois.map((m) => m.km)) * 10) / 10, b.kmTotal);
    },
  },
  {
    nom: 'tranche 2 : 10 000 km en 5 CV = 10 000 × 0,357 + 1 395 = 4 965 €',
    f: () => {
      egal(tranche(10_000), 2);
      egal(indemniteAnnuelle(10_000, '5', false), 496_500);
    },
  },
  {
    nom: 'tranche 3 : 25 000 km en 5 CV = 25 000 × 0,427 = 10 675 €',
    f: () => egal(indemniteAnnuelle(25_000, '5', false), 1_067_500),
  },
  {
    nom: 'électrique : majoration de 20 % (4 965 € → 5 958 €)',
    f: () => egal(indemniteAnnuelle(10_000, '5', true), 595_800),
  },
  {
    nom: 'aux bornes : 5 000 km est encore en tranche 1, 20 000 en tranche 2',
    f: () => {
      egal(tranche(SEUIL_1), 1);
      egal(tranche(SEUIL_1 + 0.1), 2);
      egal(tranche(SEUIL_2), 2);
      egal(tranche(SEUIL_2 + 0.1), 3);
    },
  },
  {
    nom: 'continuité aux bornes : le barème officiel n’est pas parfaitement continu, mais ne baisse jamais (écart ≤ 1 %)',
    f: () => {
      for (const p of PUISSANCES) {
        const t = BAREME_2025.tranches[p];
        for (const s of [SEUIL_1, SEUIL_2]) {
          const avant = s === SEUIL_1 ? (s * t.a) / 10 : (s * t.b) / 10 + t.c;
          const apres = s === SEUIL_1 ? (s * t.b) / 10 + t.c : (s * t.e) / 10;
          vrai(Math.abs(apres - avant) <= avant / 100, `${p} CV à ${s} km : ${avant} c contre ${apres} c`);
          vrai(indemniteAnnuelle(s + 1, p, false) >= indemniteAnnuelle(s, p, false), `${p} CV : l’indemnité baisse après ${s} km`);
        }
      }
    },
  },
  {
    nom: 'répartition au prorata, au centime : 1,00 € en trois = 34 + 33 + 33',
    f: () => {
      egal(repartirAuProrata(100, [1, 1, 1]), [34, 33, 33]);
      egal(repartirAuProrata(1_001, [2, 1, 1]), [501, 250, 250]);
      egal(repartirAuProrata(500, [0, 0]), [0, 0]);
    },
  },
  {
    nom: 'saisies refusées : km nuls, date impossible, motif vide, lieux manquants',
    f: () => {
      const ok = { date: '2026-02-10', motif: 'Chantier', depart: 'A', arrivee: 'B', km: 12, allerRetour: false };
      egal(verifierTrajet(ok), []);
      egal(verifierTrajet({ ...ok, km: 0 }), ['km']);
      egal(verifierTrajet({ ...ok, km: Number.NaN }), ['km']);
      egal(verifierTrajet({ ...ok, date: '2026-02-30' }), ['date']);
      egal(verifierTrajet({ ...ok, motif: '  ', arrivee: '' }), ['motif', 'lieux']);
      egal(indemniteAnnuelle(0, '3', false), 0);
    },
  },
  {
    nom: 'le bilan ne retient que l’année demandée et les trajets valides',
    f: () => {
      const autres = [
        ...TRAJETS,
        { id: 'x', date: '2025-12-31', motif: 'Ancien', depart: 'A', arrivee: 'B', km: 500, allerRetour: false },
        { id: 'y', date: '2026-03-01', motif: '', depart: 'A', arrivee: 'B', km: 500, allerRetour: false },
      ];
      egal(bilan(autres, 2026, '5', false).kmTotal, 1227.1);
      egal(bilan([], 2026, '5', false).indemnite, 0);
    },
  },
];
