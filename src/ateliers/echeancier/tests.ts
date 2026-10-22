import { AUJOURDHUI_BAC_A_SABLE } from '../_commun/nombres';
import { doit, egal, vrai, type Test } from '../_commun/test';
import { ECHEANCIERS } from './donnees';
import { ajusterPayees, basculerPayee, echeances, montants, synthese, verifier, type Echeancier } from './logique';

const [E1, E2, E3] = ECHEANCIERS;
const somme = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0);

export const TESTS: Test[] = [
  {
    nom: 'la première échéance absorbe les centimes, les suivantes sont égales',
    f: () => {
      egal(montants(336_000, 4), [84_000, 84_000, 84_000, 84_000]);
      egal(montants(735_125, 3), [245_043, 245_041, 245_041]);
      egal(montants(100_000, 12), [8_337, ...Array.from({ length: 11 }, () => 8_333)]);
    },
  },
  {
    nom: 'la somme des échéances vaut exactement le reste, pour 2 à 12 échéances',
    f: () => {
      for (const reste of [12, 99, 100_001, 735_125, 999_999_999])
        for (let n = 2; n <= 12; n += 1) {
          const m = montants(reste, n);
          egal(somme(m), reste, `${reste} en ${n}`);
          vrai(m[0] - m[1] >= 0 && m[0] - m[1] < n, `écart de la première borné (${reste} en ${n})`);
        }
    },
  },
  {
    nom: 'fin de mois : 31 août → 30 septembre → 31 octobre → 30 novembre',
    f: () => {
      egal(doit(echeances(E1, AUJOURDHUI_BAC_A_SABLE)).map((x) => x.date), ['2026-08-31', '2026-09-30', '2026-10-31', '2026-11-30']);
      const janvier: Echeancier = { ...E3, premiereDate: '2027-01-31', nombre: 3 };
      egal(doit(echeances(janvier, AUJOURDHUI_BAC_A_SABLE)).map((x) => x.date), ['2027-01-31', '2027-02-28', '2027-03-31']);
    },
  },
  {
    nom: 'états au 22 octobre 2026 : payée, en retard (7 jours), à venir',
    f: () => {
      egal(doit(echeances(E1, AUJOURDHUI_BAC_A_SABLE)).map((x) => x.etat), ['payee', 'payee', 'aVenir', 'aVenir']);
      const e2 = doit(echeances(E2, AUJOURDHUI_BAC_A_SABLE));
      egal(e2.map((x) => x.etat), ['payee', 'enRetard', 'aVenir']);
      egal(e2[1].retard, 7);
    },
  },
  {
    nom: 'une échéance du jour est à venir, en retard dès le lendemain',
    f: () => {
      const e: Echeancier = { ...E3, premiereDate: '2026-10-22', nombre: 2 };
      egal(doit(echeances(e, '2026-10-22'))[0].etat, 'aVenir');
      const demain = doit(echeances(e, '2026-10-23'))[0];
      egal([demain.etat, demain.retard], ['enRetard', 1]);
    },
  },
  {
    nom: 'synthèse : encaissé (acompte compris) + reste dû = TTC, prochaine échéance, retard',
    f: () => {
      const s1 = doit(synthese(E1, AUJOURDHUI_BAC_A_SABLE));
      egal([s1.encaisse, s1.resteDu, s1.enRetard], [312_000, 168_000, 0]);
      egal(s1.prochaine?.date, '2026-10-31');
      const s2 = doit(synthese(E2, AUJOURDHUI_BAC_A_SABLE));
      egal([s2.enRetard, s2.nbEnRetard, s2.encaisse + s2.resteDu], [245_041, 1, E2.montantTTC]);
    },
  },
  {
    nom: 'marquer payée puis annuler ; soldé quand tout est payé',
    f: () => {
      const a = basculerPayee(E2, 1);
      egal(a.payees, [0, 1]);
      egal(basculerPayee(a, 1).payees, [0]);
      const tout = basculerPayee(a, 2);
      const s = doit(synthese(tout, AUJOURDHUI_BAC_A_SABLE));
      egal([s.solde, s.resteDu, s.prochaine], [true, 0, undefined]);
    },
  },
  {
    nom: 'moins d’échéances : les rangs disparus ne restent pas « payés »',
    f: () => egal(ajusterPayees({ ...E1, payees: [0, 1, 3], nombre: 3 }).payees, [0, 1]),
  },
  {
    nom: 'saisies refusées, sans échéancier',
    f: () => {
      egal(verifier({ ...E1, montantTTC: 0 }), ['montant']);
      egal(verifier({ ...E1, acompte: 480_000 }), ['acompte']);
      egal(verifier({ ...E1, acompte: -1 }), ['acompte']);
      egal(verifier({ ...E1, nombre: 1 }), ['nombre']);
      egal(verifier({ ...E1, nombre: 13 }), ['nombre']);
      egal(verifier({ ...E1, nombre: 2.5 }), ['nombre']);
      egal(verifier({ ...E1, premiereDate: '2026-02-29' }), ['date']);
      egal(verifier({ ...E1, montantTTC: 5, acompte: 0, nombre: 6 }), ['tropPetit']);
      egal(echeances({ ...E1, montantTTC: Number.NaN }, AUJOURDHUI_BAC_A_SABLE), null);
    },
  },
];
