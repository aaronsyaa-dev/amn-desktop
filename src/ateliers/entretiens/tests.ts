import { egal, leve, type Test } from '../_commun/test';
import { AUJOURDHUI_BAC_A_SABLE as AUJ } from '../_commun/nombres';
import { PARC } from './donnees';
import { aPlanifier, compter, etatVisite, marquerFaites, prochaineVisite, verifierInstallation } from './logique';

const visite = (derniereVisite: string, periodiciteMois = 12) => ({ derniereVisite, periodiciteMois });

export const TESTS: Test[] = [
  {
    nom: 'prochaine visite : dernière + périodicité, un 31 qui n’existe pas devient le dernier du mois',
    f: () => {
      egal(prochaineVisite(visite('2025-09-15')), '2026-09-15');
      egal(prochaineVisite(visite('2026-01-31', 9)), '2026-10-31');
      egal(prochaineVisite(visite('2025-08-31', 6)), '2026-02-28');
      egal(prochaineVisite(visite('2027-08-31', 6)), '2028-02-29');
    },
  },
  {
    nom: 'états au 22 octobre 2026 : 4 en retard, 4 ce mois-ci, 2 dans les 30 jours, 2 à jour',
    f: () => egal(compter(PARC, AUJ), { retard: 4, ceMois: 4, bientot: 2, aJour: 2 }),
  },
  {
    nom: 'bornes : échéance aujourd’hui = ce mois-ci, hier = en retard, J+30 = bientôt, J+31 = à jour',
    f: () => {
      egal(etatVisite(visite('2025-10-22'), AUJ), 'ceMois');
      egal(etatVisite(visite('2025-10-21'), AUJ), 'retard');
      egal(etatVisite(visite('2025-11-21'), AUJ), 'bientot');
      egal(etatVisite(visite('2025-11-22'), AUJ), 'aJour');
      egal(etatVisite(visite('2026-01-10'), '2026-12-15'), 'bientot', 'passage d’année');
    },
  },
  {
    nom: 'à planifier : par commune (ordre alphabétique), la plus en retard d’abord',
    f: () => {
      egal(
        aPlanifier(PARC, AUJ).map((g) => [g.commune, g.installations.map((i) => i.id)]),
        [
          ['Bron', ['i10', 'i01', 'i05']],
          ['Vénissieux', ['i12']],
          ['Villeurbanne', ['i03', 'i08', 'i11', 'i02']],
        ],
      );
    },
  },
  {
    nom: 'marquer faites : seules les installations choisies changent, et sortent de la liste à planifier',
    f: () => {
      const apres = marquerFaites(PARC, new Set(['i10', 'i01']), AUJ);
      egal(apres.find((i) => i.id === 'i10')?.derniereVisite, AUJ);
      egal(apres.find((i) => i.id === 'i05')?.derniereVisite, '2025-10-30');
      egal(compter(apres, AUJ), { retard: 2, ceMois: 4, bientot: 2, aJour: 4 });
      egal(PARC.find((i) => i.id === 'i10')?.derniereVisite, '2024-10-01', 'la liste d’origine n’est pas modifiée');
      leve(() => marquerFaites(PARC, new Set(['i01']), '22/10/2026'), 'date illisible');
    },
  },
  {
    nom: 'saisies refusées : client et commune vides, date impossible ou future, périodicité hors 1–120 mois',
    f: () => {
      const ok = { client: 'Mme Test', type: 'vmc' as const, commune: 'Bron', derniereVisite: '2026-01-15', periodiciteMois: 12 };
      egal(verifierInstallation(ok, AUJ), []);
      egal(verifierInstallation({ ...ok, client: ' ', commune: '' }, AUJ), ['client', 'commune']);
      egal(verifierInstallation({ ...ok, derniereVisite: '2026-02-30' }, AUJ), ['date']);
      egal(verifierInstallation({ ...ok, derniereVisite: '2026-10-23' }, AUJ), ['dateFuture']);
      egal(verifierInstallation({ ...ok, periodiciteMois: 0 }, AUJ), ['periodicite']);
      egal(verifierInstallation({ ...ok, periodiciteMois: 1.5 }, AUJ), ['periodicite']);
      egal(verifierInstallation({ ...ok, periodiciteMois: 121 }, AUJ), ['periodicite']);
    },
  },
];
