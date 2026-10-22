import { doit, egal, vrai, type Test } from '../_commun/test';
import { AUJOURDHUI_BAC_A_SABLE as AUJ } from '../_commun/nombres';
import { ENTREPRISE, RISQUES, UNITES } from './donnees';
import { criticite, enRetard, miseAJour, niveau, planDAction, synthese, trier, verifierRisque, type Risque } from './logique';

const base = doit(RISQUES.find((x) => x.id === 'r1'));

export const TESTS: Test[] = [
  {
    nom: 'criticité = gravité × probabilité, niveaux aux bornes (3 faible, 4 moyen, 6 moyen, 8 élevé, 9 élevé, 12 critique)',
    f: () => {
      egal(criticite({ gravite: 4, probabilite: 3 }), 12);
      egal([1, 2, 3, 4, 6, 8, 9, 12, 16].map(niveau), ['faible', 'faible', 'faible', 'moyen', 'moyen', 'eleve', 'eleve', 'critique', 'critique']);
    },
  },
  {
    nom: 'tri : criticité décroissante, puis échéance la plus proche, sans échéance en dernier',
    f: () => {
      const ids = trier(RISQUES).map((x) => x.id);
      egal(ids.slice(0, 3), ['r2', 'r4', 'r1']);
      egal(ids.at(-1), 'r7');
      const a: Risque = { ...base, id: 'a', echeance: '' };
      const b: Risque = { ...base, id: 'b', echeance: '2030-01-01' };
      egal(trier([a, b]).map((x) => x.id), ['b', 'a']);
    },
  },
  {
    nom: 'retard : échéance passée et action non faite ; le jour même n’est pas en retard ; faite n’est jamais en retard',
    f: () => {
      egal(enRetard({ ...base, echeance: '2026-10-21' }, AUJ), true);
      egal(enRetard({ ...base, echeance: AUJ }, AUJ), false);
      egal(enRetard({ ...base, echeance: '2026-01-01', faite: true }, AUJ), false);
      egal(enRetard({ ...base, actionPrevue: '', echeance: '2026-01-01' }, AUJ), false);
    },
  },
  {
    nom: 'synthèse de l’exemple : 9 risques, 2 actions en retard, 1 risque élevé sans action',
    f: () => {
      const s = synthese(RISQUES, AUJ);
      egal(s.total, 9);
      egal(s.parNiveau, { faible: 1, moyen: 1, eleve: 4, critique: 3 });
      egal(s.actionsEnRetard, 2);
      egal(s.actionsOuvertes, 6);
      egal(s.sansAction, 1);
    },
  },
  {
    nom: 'mise à jour : 387 jours ⇒ en retard à 14 salariés, conseillée à 5, à jour à 365 jours pile',
    f: () => {
      egal(miseAJour(ENTREPRISE.derniereMiseAJour, 14, AUJ), { etat: 'enRetard', joursDepuis: 387, obligatoire: true });
      egal(miseAJour(ENTREPRISE.derniereMiseAJour, 5, AUJ).etat, 'conseillee');
      egal(miseAJour('2025-10-22', 11, AUJ).etat, 'aJour');
      egal(miseAJour('2025-10-21', 11, AUJ).etat, 'enRetard');
    },
  },
  {
    nom: 'plan d’action : seulement les actions ouvertes, triées, avec l’unité et le retard',
    f: () => {
      const p = planDAction(RISQUES, UNITES, AUJ);
      egal(p.length, 6);
      egal(p[0].risque.id, 'r2');
      egal(p[0].unite, 'Atelier de fabrication');
      vrai(p[0].retard, 'r2 est en retard');
      vrai(!p.some((l) => l.risque.id === 'r6' || l.risque.id === 'r7'), 'ni action faite ni risque sans action');
    },
  },
  {
    nom: 'saisies refusées : unité inconnue, danger vide, cote hors 1–4 ou décimale, date illisible, action sans échéance',
    f: () => {
      egal(verifierRisque(base, UNITES), []);
      egal(verifierRisque({ ...base, uniteId: 'cave', danger: ' ' }, UNITES), ['unite', 'danger']);
      egal(verifierRisque({ ...base, gravite: 5, probabilite: 2.5 }, UNITES), ['gravite', 'probabilite']);
      egal(verifierRisque({ ...base, echeance: '2026-02-30' }, UNITES), ['echeance']);
      egal(verifierRisque({ ...base, echeance: '' }, UNITES), ['actionSansEcheance']);
      egal(verifierRisque({ ...base, actionPrevue: '', echeance: '' }, UNITES), []);
    },
  },
];
