import { doit, egal, vrai, type Test } from '../_commun/test';
import { DEBITEURS, FACTURES, PARAMETRES } from './donnees';
import { calculerPenalites, interets, tauxApplique, verifierParametres, type Debiteur } from './logique';

const debiteur = (id: string): Debiteur => doit(DEBITEURS.find((d) => d.id === id));

export const TESTS: Test[] = [
  {
    nom: 'taux : BCE + 10 points à défaut de contrat ; contrat au-dessus du plancher retenu ; plancher de 3 × le taux légal',
    f: () => {
      egal(tauxApplique('pro', PARAMETRES), { taux: 12.15, base: 'bce' });
      egal(tauxApplique('pro', { ...PARAMETRES, tauxContractuel: 15 }), { taux: 15, base: 'contractuel' });
      egal(tauxApplique('pro', { ...PARAMETRES, tauxContractuel: 5 }), { taux: 9.45, base: 'plancher' });
      egal(tauxApplique('particulier', { ...PARAMETRES, tauxContractuel: 15 }), { taux: 3.15, base: 'legal' });
    },
  },
  {
    nom: 'Alpha : 83 et 37 jours de retard, 79,57 € et 17,87 € d’intérêts, 2 × 40 €, total 4 508,24 €',
    f: () => {
      const r = doit(calculerPenalites(debiteur('alpha'), FACTURES, PARAMETRES));
      egal(
        r.lignes.map((l) => [l.facture.numero, l.joursRetard, l.interets, l.indemnite]),
        [
          ['F-2026-0112', 83, 7_957, 4_000],
          ['F-2026-0140', 37, 1_787, 4_000],
          ['F-2026-0171', 0, 0, 0],
        ],
      );
      egal([r.principal, r.interets, r.indemnites, r.total], [433_080, 9_744, 8_000, 450_824]);
    },
  },
  {
    nom: 'une facture pas encore échue ne compte ni dans le principal, ni en intérêts, ni en indemnité',
    f: () => {
      const r = doit(calculerPenalites(debiteur('alpha'), FACTURES, { ...PARAMETRES, dateCalcul: '2026-07-31' }));
      egal([r.principal, r.total], [0, 0]);
      const lendemain = doit(calculerPenalites(debiteur('alpha'), FACTURES, { ...PARAMETRES, dateCalcul: '2026-08-01' }));
      egal(lendemain.lignes[0].joursRetard, 1);
      egal(lendemain.indemnites, 4_000);
    },
  },
  {
    nom: 'particulier : taux légal, intérêts depuis la mise en demeure (42 jours, 4,35 €), pas d’indemnité',
    f: () => {
      const r = doit(calculerPenalites(debiteur('part'), FACTURES, PARAMETRES));
      egal(r.lignes[0].depart, '2026-09-10');
      egal(r.lignes[0].joursInterets, 42);
      egal(r.lignes[0].interets, 435);
      egal(r.indemnites, 0);
      egal(r.total, 120_435);
      const sansMiseEnDemeure = doit(calculerPenalites({ ...debiteur('part'), dateMiseEnDemeure: undefined }, FACTURES, PARAMETRES));
      egal([sansMiseEnDemeure.lignes[0].depart, sansMiseEnDemeure.interets], [null, 0]);
    },
  },
  {
    nom: 'une mise en demeure envoyée avant l’échéance ne fait courir les intérêts qu’à partir de l’échéance',
    f: () => {
      const r = doit(calculerPenalites({ ...debiteur('part'), dateMiseEnDemeure: '2026-08-01' }, FACTURES, PARAMETRES));
      egal(r.lignes[0].depart, '2026-08-20');
    },
  },
  {
    nom: 'intérêts : montant × taux × jours / 365, au centime ; zéro jour, zéro intérêt',
    f: () => {
      egal(interets(624_000, 12.15, 114), 23_680);
      egal(interets(100_000, 10, 365), 10_000);
      egal(interets(100_000, 10, 0), 0);
      egal(interets(100_000, 10, -3), 0);
    },
  },
  {
    nom: 'paramètres impossibles refusés, sans résultat',
    f: () => {
      egal(verifierParametres({ ...PARAMETRES, dateCalcul: '2026-02-30' }), ['dateCalcul']);
      egal(verifierParametres({ ...PARAMETRES, tauxContractuel: -1 }), ['tauxContractuel']);
      egal(verifierParametres({ ...PARAMETRES, tauxBce: Number.NaN, tauxLegal: 80 }), ['tauxBce', 'tauxLegal']);
      egal(calculerPenalites(debiteur('alpha'), FACTURES, { ...PARAMETRES, tauxLegal: Number.NaN }), null);
      egal(calculerPenalites({ ...debiteur('part'), dateMiseEnDemeure: 'hier' }, FACTURES, PARAMETRES), null);
    },
  },
  {
    nom: 'une facture illisible (montant nul, échéance fausse) est écartée, pas comptée',
    f: () => {
      const avec = [...FACTURES, { id: 'x', debiteur: 'beta', numero: 'X', montantTTC: 0, echeance: '2026-01-01' }, { id: 'y', debiteur: 'beta', numero: 'Y', montantTTC: 5_000, echeance: '2026-13-01' }];
      const r = doit(calculerPenalites(debiteur('beta'), avec, PARAMETRES));
      egal(r.lignes.length, 1);
      vrai(r.total === 624_000 + 23_680 + 4_000, `total ${r.total}`);
    },
  },
];
