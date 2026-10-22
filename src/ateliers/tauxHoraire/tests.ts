import { doit, egal, vrai, type Test } from '../_commun/test';
import { EXEMPLE } from './donnees';
import { calculerTaux, joursTravailles, verifier } from './logique';

export const TESTS: Test[] = [
  {
    nom: 'jours travaillés : 5 × (52 − 5) − 8 − 5 = 222',
    f: () => egal(joursTravailles(EXEMPLE), 222),
  },
  {
    nom: 'exemple au réel : 67 980 € de CA, 62,50 € de l’heure, 306,25 € la journée',
    f: () => {
      const r = doit(calculerTaux(EXEMPLE));
      egal(r.heuresFacturables, 1087.8);
      egal(r.cotisations, 1_620_000);
      egal(r.caNecessaire, 6_798_000);
      egal(r.tauxHoraire, 6_250);
      egal(r.prixJournee, 30_625);
    },
  },
  {
    nom: 'le taux s’arrondit au centime supérieur, jamais en dessous',
    f: () => {
      const r = doit(calculerTaux(EXEMPLE));
      vrai(r.tauxHoraire * r.heuresFacturables >= r.caNecessaire, 'le taux couvre le CA nécessaire');
      vrai((r.tauxHoraire - 1) * r.heuresFacturables < r.caNecessaire, 'un centime de moins ne le couvre plus');
    },
  },
  {
    nom: 'comparaison au tarif actuel : il manque 17,50 € par heure, 19 036,50 € sur l’année',
    f: () => {
      const r = doit(calculerTaux(EXEMPLE));
      egal(r.manqueParHeure, 1_750);
      egal(r.manqueSurAnnee, 1_903_650);
    },
  },
  {
    nom: 'en micro, les cotisations portent sur le chiffre d’affaires',
    f: () => {
      const r = doit(calculerTaux({ ...EXEMPLE, regime: 'micro', revenuAnnuel: 3_000_000, chargesFixes: 600_000, tauxCotisations: 22, margeSecurite: 0, tarifActuel: undefined }));
      egal(r.caNecessaire, 4_615_385);
      egal(r.cotisations, 1_015_385);
      vrai(Math.abs(r.caNecessaire - r.cotisations - 3_600_000) <= 1, 'CA − cotisations = revenu + charges');
      egal(r.manqueParHeure, undefined);
    },
  },
  {
    nom: 'saisies impossibles refusées, sans résultat',
    f: () => {
      egal(verifier({ ...EXEMPLE, partFacturable: 0 }), ['partFacturable']);
      egal(verifier({ ...EXEMPLE, regime: 'micro', tauxCotisations: 100 }), ['cotisations']);
      egal(verifier({ ...EXEMPLE, revenuAnnuel: Number.NaN }), ['revenu']);
      egal(verifier({ ...EXEMPLE, semainesConges: 51, feriesChomes: 10 }), ['aucuneHeure']);
      egal(calculerTaux({ ...EXEMPLE, heuresParJour: 0 }), null);
    },
  },
  {
    nom: 'plus de congés ⇒ taux plus élevé (monotonie)',
    f: () => {
      const a = doit(calculerTaux(EXEMPLE)).tauxHoraire;
      const b = doit(calculerTaux({ ...EXEMPLE, semainesConges: 7 })).tauxHoraire;
      vrai(b > a, `${b} > ${a}`);
    },
  },
];
