import { egal, vrai, type Test } from '../_commun/test';
import { IMMOS_EXEMPLE } from './donnees';
import { dateCloture, dotationsExercice, exerciceDe, jours360, petitMateriel, planAmortissement, verifier, type Immobilisation } from './logique';

const SCIE = IMMOS_EXEMPLE[0]; // 12 000 €, 5 ans, en service le 1er avril 2026
const immo = (valeur: number, miseEnService: string, dureeAnnees: number): Immobilisation => ({ id: 't', designation: 'test', valeur, miseEnService, dureeAnnees });

export const TESTS: Test[] = [
  {
    nom: 'jours en 30 / 360, date de mise en service comprise',
    f: () => {
      egal(jours360('2026-04-01', '2026-12-31'), 270);
      egal(jours360('2026-03-15', '2026-12-31'), 286);
      egal(jours360('2026-01-01', '2026-12-31'), 360);
      egal(jours360('2026-12-31', '2026-12-31'), 1);
      egal(jours360('2026-07-01', '2027-06-30'), 360, 'un exercice décalé fait 360 jours');
      egal(jours360('2027-03-01', '2028-02-29'), 360, 'février bissextile : son dernier jour compte 30');
    },
  },
  {
    nom: 'scie à 12 000 € sur 5 ans au 1er avril : 1 800 €, 4 × 2 400 €, puis 600 €',
    f: () => {
      const p = planAmortissement(SCIE);
      egal(
        p.map((l) => [l.exercice, l.jours, l.dotation]),
        [
          [2026, 270, 180_000],
          [2027, 360, 240_000],
          [2028, 360, 240_000],
          [2029, 360, 240_000],
          [2030, 360, 240_000],
          [2031, 90, 60_000],
        ],
      );
      egal(p[p.length - 1].vnc, 0);
    },
  },
  {
    nom: 'arrondis : 1 000 € sur 3 ans au 1er janvier, la dernière annuité prend le reste exact',
    f: () => {
      const p = planAmortissement(immo(100_000, '2026-01-01', 3));
      egal(
        p.map((l) => l.dotation),
        [33_333, 33_334, 33_333],
      );
      egal(p.length, 3, 'mis en service le 1er jour de l’exercice : pas d’annuité de reste');
    },
  },
  {
    nom: 'toujours : somme des dotations = valeur, dotations positives, durée ou durée + 1 exercices',
    f: () => {
      const dates = ['2026-01-01', '2026-02-28', '2026-03-31', '2026-06-17', '2026-12-31', '2024-02-29'];
      for (const valeur of [1, 99, 42_000, 145_000, 2_850_000, 987_654_321])
        for (const duree of [1, 3, 7, 10])
          for (const d of dates)
            for (const mois of [12, 6, 2]) {
              const p = planAmortissement(immo(valeur, d, duree), mois);
              const somme = p.reduce((s, l) => s + l.dotation, 0);
              vrai(somme === valeur, `${valeur} ${d} ${duree} ans clôture ${mois} : somme ${somme}`);
              vrai(
                p.every((l) => l.dotation >= 0 && l.vnc >= 0),
                `dotation négative ${valeur} ${d}`,
              );
              vrai(p.length === duree || p.length === duree + 1, `${p.length} exercices pour ${duree} ans`);
              egal(
                p.reduce((s, l) => s + l.jours, 0),
                360 * duree,
                'les jours font la durée',
              );
            }
    },
  },
  {
    nom: 'clôture au 30 juin : exercice nommé par son année de clôture, premier exercice de 90 jours',
    f: () => {
      egal(dateCloture(2028, 2), '2028-02-29');
      egal(exerciceDe('2026-04-01', 6), 2026);
      egal(exerciceDe('2026-07-01', 6), 2027);
      const p = planAmortissement(SCIE, 6);
      egal([p[0].cloture, p[0].jours, p[0].dotation], ['2026-06-30', 90, 60_000]);
      egal(p[p.length - 1].dotation, 180_000);
    },
  },
  {
    nom: 'exercice 2026 de l’atelier : total des dotations et valeur nette',
    f: () => {
      const d = dotationsExercice(IMMOS_EXEMPLE, 2026);
      egal(
        d.lignes.map((l) => l.dotation),
        [180_000, 712_500, 45_782, 8_983],
      );
      egal(d.total, 947_265);
      const avant = dotationsExercice(IMMOS_EXEMPLE, 2025);
      egal(avant.total, 209_792, 'en 2025, seul le fourgon est en service');
      egal(
        avant.lignes.map((l) => l.pasEncore),
        [true, false, true, true],
      );
      egal(dotationsExercice(IMMOS_EXEMPLE, 2040).total, 0, 'tout est amorti');
    },
  },
  {
    nom: 'saisies refusées, plan vide',
    f: () => {
      egal(verifier({ designation: '', valeur: 0, miseEnService: '2026-13-01', dureeAnnees: 0 }), ['designation', 'valeur', 'date', 'duree']);
      egal(verifier({ designation: 'x', valeur: 12.5, miseEnService: '2026-01-01', dureeAnnees: 2.5 }), ['valeur', 'duree']);
      egal(planAmortissement(immo(-100, '2026-01-01', 3)), []);
      egal(planAmortissement(SCIE, 13), []);
    },
  },
  {
    nom: 'petit matériel : jusqu’à 500 € HT inclus',
    f: () => {
      vrai(petitMateriel({ valeur: 50_000 }), '500 € pile');
      vrai(!petitMateriel({ valeur: 50_001 }), '500,01 €');
      vrai(petitMateriel(IMMOS_EXEMPLE[3]), 'l’aspirateur de l’exemple');
    },
  },
];
