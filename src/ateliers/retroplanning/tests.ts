import { AUJOURDHUI_BAC_A_SABLE } from '../_commun/nombres';
import { doit, egal, vrai, type Test } from '../_commun/test';
import { CALENDRIER, ETAPES, LIVRAISON, TAMPON } from './donnees';
import { estOuvre, joursFeries, jourDeSemaine, ouvresEntre, paques, planifier, verifier } from './logique';

const plan = () => doit(planifier(LIVRAISON, TAMPON, ETAPES, CALENDRIER, AUJOURDHUI_BAC_A_SABLE));

export const TESTS: Test[] = [
  {
    nom: 'Pâques : 20 avril 2025, 5 avril 2026, 28 mars 2027',
    f: () => egal([paques(2025), paques(2026), paques(2027)], ['2025-04-20', '2026-04-05', '2027-03-28']),
  },
  {
    nom: 'onze fériés en 2026, dont l’Ascension le 14 mai et le lundi de Pentecôte le 25 mai',
    f: () => {
      const f = joursFeries(2026);
      egal(f.length, 11);
      vrai(f.includes('2026-04-06') && f.includes('2026-05-14') && f.includes('2026-05-25'), f.join(', '));
    },
  },
  {
    nom: 'le 22 octobre 2026 est un jeudi ; le 11 novembre n’est pas ouvré, sauf sans fériés',
    f: () => {
      egal(jourDeSemaine('2026-10-22'), 4);
      egal(estOuvre('2026-11-11', CALENDRIER), false);
      egal(estOuvre('2026-11-11', { ...CALENDRIER, feries: false }), true);
      egal(estOuvre('2026-11-14', { ...CALENDRIER, samediOuvre: true }), true);
    },
  },
  {
    nom: 'exemple : tampon du 16 au 18 décembre, pose du 9 au 14, démarrage le 27 octobre',
    f: () => {
      const p = plan();
      egal(p.tampon, { debut: '2026-12-16', fin: '2026-12-18' });
      egal(
        p.etapes.map((e) => `${e.id} ${e.debut}→${e.fin}`),
        [
          'releve 2026-10-27→2026-10-29',
          'validation 2026-10-30→2026-11-05',
          'commande 2026-11-06→2026-11-09',
          'fournisseur 2026-11-10→2026-11-24',
          'fabrication 2026-11-25→2026-12-08',
          'pose 2026-12-09→2026-12-14',
          'reception 2026-12-15→2026-12-15',
        ],
      );
      egal(p.demarrage, '2026-10-27');
    },
  },
  {
    nom: 'marge : trois jours ouvrés (22, 23 et 26 octobre) avant le démarrage',
    f: () => {
      egal(plan().marge, 3);
      egal(ouvresEntre('2026-10-27', '2026-10-22', CALENDRIER), -3, 'dans l’autre sens');
    },
  },
  {
    nom: 'promis trop tôt : marge négative',
    f: () => vrai(doit(planifier('2026-11-20', TAMPON, ETAPES, CALENDRIER, AUJOURDHUI_BAC_A_SABLE)).marge < 0, 'retard attendu'),
  },
  {
    nom: 'livraison un dimanche : ramenée au vendredi ; étapes bout à bout sans chevauchement',
    f: () => {
      const p = doit(planifier('2026-12-20', 0, ETAPES, CALENDRIER, AUJOURDHUI_BAC_A_SABLE));
      egal(p.etapes[p.etapes.length - 1].fin, '2026-12-18');
      for (let i = 1; i < p.etapes.length; i += 1) vrai(p.etapes[i].debut > p.etapes[i - 1].fin, `${p.etapes[i].id} chevauche`);
    },
  },
  {
    nom: 'saisies refusées : date illisible, durée nulle, aucune étape',
    f: () => {
      egal(verifier('2026-02-30', 0, ETAPES, AUJOURDHUI_BAC_A_SABLE), ['livraison']);
      egal(verifier(LIVRAISON, 0, [{ ...ETAPES[0], duree: 0 }], AUJOURDHUI_BAC_A_SABLE), [{ etape: 'releve', faute: 'duree' }]);
      egal(verifier(LIVRAISON, -1, [], AUJOURDHUI_BAC_A_SABLE), ['tampon', 'aucuneEtape']);
      egal(planifier(LIVRAISON, 0, [], CALENDRIER, AUJOURDHUI_BAC_A_SABLE), null);
    },
  },
];
