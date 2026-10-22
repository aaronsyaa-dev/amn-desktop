import { doit, egal, vrai, type Test } from '../_commun/test';
import { COURANT, HISTORIQUE, MARCHE } from './donnees';
import { calculerSituation, totalHT, totalTTC, verifierAvancements, verifierMarche, type Avancements } from './logique';

const TOUT: Avancements = Object.fromEntries(MARCHE.lots.map((l) => [l.id, 100]));

export const TESTS: Test[] = [
  {
    nom: 'le marché : 37 000 € HT, 41 138 € TTC (TVA par taux)',
    f: () => {
      egal(totalHT(MARCHE.lots), 3_700_000);
      egal(totalTTC(MARCHE.lots), 4_113_800);
    },
  },
  {
    nom: 'situation n° 3 : 6 700 € HT, 7 370 € TTC, retenue 368,50 €, acompte repris 905,40 €, net 6 096,10 €',
    f: () => {
      const r = doit(calculerSituation(MARCHE, HISTORIQUE, COURANT));
      egal(r.numero, 3);
      egal(r.periodeHT, 670_000);
      egal(r.tva, 67_000);
      egal(r.periodeTTC, 737_000);
      egal(r.retenue, 36_850);
      egal(r.deductionAcompte, 90_540);
      egal(r.netAPayer, 609_610);
      egal(r.cumulHT, 2_518_000);
      egal(r.avancementGlobal, 68.1);
      egal(r.lignes.find((l) => l.id === 'elec')?.periodeHT, 296_000);
    },
  },
  {
    nom: 'retenue cumulée des trois situations : 334,40 + 669,40 + 368,50 = 1 372,30 €',
    f: () => egal(doit(calculerSituation(MARCHE, HISTORIQUE, COURANT)).retenueCumulee, 137_230),
  },
  {
    nom: 'TVA ventilée par taux : seuls les taux présents dans le marché',
    f: () => {
      const r = doit(calculerSituation(MARCHE, HISTORIQUE, COURANT));
      egal(
        r.parTaux.map((t) => t.taux),
        [20, 10, 5.5],
      );
      egal(r.parTaux.find((t) => t.taux === 10), { taux: 10, ht: 670_000, tva: 67_000 });
      const seul10 = doit(calculerSituation({ ...MARCHE, lots: MARCHE.lots.filter((l) => l.tauxTva === 10) }, [], { demol: 50 }));
      egal(seul10.parTaux.length, 1);
    },
  },
  {
    nom: 'chantier fini : la somme des situations fait le marché, l’acompte est repris en entier, la retenue reste sous 5 %',
    f: () => {
      const r1 = doit(calculerSituation(MARCHE, [], HISTORIQUE[0]));
      const r2 = doit(calculerSituation(MARCHE, HISTORIQUE.slice(0, 1), HISTORIQUE[1]));
      const r3 = doit(calculerSituation(MARCHE, HISTORIQUE, COURANT));
      const r4 = doit(calculerSituation(MARCHE, [...HISTORIQUE, COURANT], TOUT));
      const toutes = [r1, r2, r3, r4];
      egal(
        toutes.reduce((s, r) => s + r.periodeHT, 0),
        3_700_000,
      );
      egal(
        toutes.reduce((s, r) => s + r.deductionAcompte, 0),
        MARCHE.acompteTTC,
      );
      vrai(r4.retenueCumulee <= Math.round(totalTTC(MARCHE.lots) * 0.05) + toutes.length, 'retenue cumulée ≤ 5 % du TTC du marché (à l’arrondi près)');
      egal(r4.avancementGlobal, 100);
    },
  },
  {
    nom: 'un avancement qui recule, dépasse 100 % ou ne se lit pas est refusé',
    f: () => {
      egal(verifierAvancements(MARCHE.lots, HISTORIQUE[1], { ...COURANT, platre: 60 }), { platre: 'recule' });
      egal(verifierAvancements(MARCHE.lots, HISTORIQUE[1], { ...COURANT, elec: 101 }), { elec: 'depasse' });
      egal(verifierAvancements(MARCHE.lots, HISTORIQUE[1], { ...COURANT, peint: Number.NaN }), { peint: 'illisible' });
      egal(calculerSituation(MARCHE, HISTORIQUE, { ...COURANT, platre: 60 }), null);
    },
  },
  {
    nom: 'retenue au-dessus du plafond légal de 5 %, acompte plus grand que le marché, lot à zéro : refusés',
    f: () => {
      egal(verifierMarche({ ...MARCHE, tauxRetenue: 5.5 }), ['retenue']);
      egal(verifierMarche({ ...MARCHE, acompteTTC: 4_113_801 }), ['acompte']);
      egal(verifierMarche({ ...MARCHE, lots: [{ ...MARCHE.lots[0], montantHT: 0 }] }), ['lotMontant']);
      egal(verifierMarche({ ...MARCHE, tauxRetenue: 0, acompteTTC: 0 }), []);
      egal(calculerSituation({ ...MARCHE, tauxRetenue: 6 }, HISTORIQUE, COURANT), null);
    },
  },
  {
    nom: 'aucun avancement depuis la dernière situation : tout à zéro, pas de net négatif',
    f: () => {
      const r = doit(calculerSituation(MARCHE, HISTORIQUE, HISTORIQUE[1]));
      egal([r.periodeHT, r.retenue, r.deductionAcompte, r.netAPayer], [0, 0, 0, 0]);
    },
  },
];
