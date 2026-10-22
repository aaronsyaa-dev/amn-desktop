import { AUJOURDHUI_BAC_A_SABLE as AUJ } from '../_commun/nombres';
import { doit, egal, type Test } from '../_commun/test';
import { PERSONNES } from './donnees';
import { alertes, effectifPresent, manques, registre } from './logique';

const p = (id: string) => doit(PERSONNES.find((x) => x.id === id));

export const TESTS: Test[] = [
  {
    nom: 'ordre des embauches, numéros d’ordre, stagiaire dans sa partie',
    f: () => {
      const r = registre(PERSONNES, AUJ);
      egal(r.salaries.map((l) => `${l.numero}:${l.personne.id}`), ['1:p7', '2:p1', '3:p2', '4:p3', '5:p4', '6:p5']);
      egal(r.stagiaires.map((l) => `${l.numero}:${l.personne.id}`), ['1:p6']);
    },
  },
  {
    nom: 'effectif présent au 22 octobre 2026 : 4 salariés (les sortis ne comptent pas, le stagiaire non plus)',
    f: () => egal(effectifPresent(registre(PERSONNES, AUJ)), 4),
  },
  {
    nom: 'mention manquante : la qualification de l’assistante ; pas exigée du stagiaire',
    f: () => {
      egal(manques(p('p5')), ['qualification']);
      egal(manques(p('p6')), []);
    },
  },
  {
    nom: 'travailleur étranger : type et numéro du titre exigés',
    f: () => egal(manques({ ...p('p3'), titreType: '', titreNumero: undefined }), ['titreType', 'titreNumero']),
  },
  {
    nom: 'titre qui expire le 5 décembre : alerte à moins de 60 jours ; expiré : alerte rouge ; sorti : plus d’alerte',
    f: () => {
      egal(alertes(p('p3'), AUJ), ['titreBientot']);
      egal(alertes(p('p3'), '2026-12-06'), ['titreExpire']);
      egal(alertes(p('p3'), '2026-09-01'), []);
      egal(alertes({ ...p('p3'), sortie: '2026-10-01' }, AUJ), []);
    },
  },
  {
    nom: 'conservation : cinq ans après la sortie, la ligne peut être retirée',
    f: () => {
      egal(alertes(p('p2'), AUJ), ['conservationEchue']);
      egal(alertes(p('p7'), '2026-06-30'), [], 'le jour anniversaire, pas encore');
      egal(alertes(p('p7'), '2026-07-01'), ['conservationEchue']);
    },
  },
  {
    nom: 'dates impossibles : naissance illisible, sortie avant l’entrée',
    f: () => {
      egal(manques({ ...p('p1'), dateNaissance: '1984-02-30' }), ['dateNaissance']);
      egal(manques({ ...p('p1'), sortie: '2010-01-01' }), ['sortie']);
    },
  },
];
