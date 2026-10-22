import { doit, egal, type Test } from '../_commun/test';
import { AUJOURDHUI_BAC_A_SABLE as AUJ } from '../_commun/nombres';
import { SOUS_TRAITANTS } from './donnees';
import { bilan, bilans, etatPiece, finValidite, relances, REGLAGE_PAR_DEFAUT as R, verifierReglage } from './logique';

const s = (id: string) => doit(SOUS_TRAITANTS.find((x) => x.id === id));

export const TESTS: Test[] = [
  {
    nom: 'fin de validité : URSSAF six mois moins un jour, immatriculation trois mois, assurance à sa date de fin',
    f: () => {
      egal(finValidite('urssaf', '2026-07-01', R), '2026-12-31');
      egal(finValidite('urssaf', '2026-08-31', R), '2027-02-27');
      egal(finValidite('immatriculation', '2026-10-01', R), '2026-12-31');
      egal(finValidite('immatriculation', '2026-10-01', { ...R, moisImmatriculation: 1 }), '2026-10-31');
      egal(finValidite('assurance', '2027-03-31', R), '2027-03-31');
    },
  },
  {
    nom: 'état d’une pièce aux bornes : 31 jours valide, 30 bientôt, 0 bientôt (dernier jour), −1 expirée',
    f: () => {
      egal(etatPiece('assurance', '2026-11-22', AUJ, R).etat, 'valide');
      egal(etatPiece('assurance', '2026-11-21', AUJ, R).etat, 'bientot');
      egal(etatPiece('assurance', AUJ, AUJ, R).etat, 'bientot');
      egal(etatPiece('assurance', '2026-10-21', AUJ, R), { type: 'assurance', etat: 'expiree', finValidite: '2026-10-21', joursRestants: -1 });
      egal(etatPiece('urssaf', undefined, AUJ, R).etat, 'manquante');
    },
  },
  {
    nom: 'saisies refusées : date illisible, attestation datée dans le futur, réglages hors bornes',
    f: () => {
      egal(etatPiece('urssaf', '2026-02-30', AUJ, R).etat, 'illisible');
      egal(etatPiece('urssaf', '2026-10-23', AUJ, R).etat, 'illisible');
      egal(etatPiece('urssaf', AUJ, AUJ, R).etat, 'valide');
      egal(verifierReglage(R), []);
      egal(verifierReglage({ seuil: -1, moisImmatriculation: 0, joursAlerte: 2.5 }), ['seuil', 'mois', 'alerte']);
      egal(verifierReglage({ ...R, seuil: Number.NaN }), ['seuil']);
    },
  },
  {
    nom: 'état des sous-traitants de l’exemple : à jour, à relancer, deux bloquants, un non concerné',
    f: () => {
      egal(bilan(s('s1'), AUJ, R).etat, 'aJour');
      egal(bilan(s('s2'), AUJ, R).etat, 'aRelancer');
      egal(bilan(s('s2'), AUJ, R).aDemander, ['urssaf', 'immatriculation']);
      egal(bilan(s('s3'), AUJ, R).etat, 'bloquant');
      egal(bilan(s('s3'), AUJ, R).aDemander, ['urssaf', 'assurance']);
      egal(bilan(s('s4'), AUJ, R).etat, 'bloquant');
      egal(bilan(s('s5'), AUJ, R).etat, 'nonConcerne');
    },
  },
  {
    nom: 'seuil : 5 000 € HT pile est concerné, un centime de moins ne l’est pas ; le seuil se règle',
    f: () => {
      egal(bilan({ ...s('s5'), montantContrat: 500_000 }, AUJ, R).concerne, true);
      egal(bilan({ ...s('s5'), montantContrat: 499_999 }, AUJ, R).concerne, false);
      egal(bilan(s('s5'), AUJ, { ...R, seuil: 200_000 }).etat, 'bloquant');
    },
  },
  {
    nom: 'une assurance seule manquante fait relancer, jamais bloquer',
    f: () => {
      egal(bilan({ ...s('s1'), pieces: { urssaf: '2026-07-01', immatriculation: '2026-09-15' } }, AUJ, R).etat, 'aRelancer');
    },
  },
  {
    nom: 'tri du plus urgent au plus tranquille, et relances des seuls concernés',
    f: () => {
      const b = bilans(SOUS_TRAITANTS, AUJ, R);
      egal(b.map((x) => x.sousTraitant.id), ['s3', 's4', 's2', 's1', 's5']);
      egal(relances(b).map((x) => x.sousTraitant.id), ['s3', 's4', 's2']);
    },
  },
];
