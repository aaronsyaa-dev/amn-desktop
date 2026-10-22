import { doit, egal, vrai, type Test } from '../_commun/test';
import { OFFRES, POIDS } from './donnees';
import { comparer, verifier, POIDS_PAR_DEFAUT, type Offre } from './logique';

const classement = (r: ReturnType<typeof comparer>) => doit(r).map((n) => `${n.offre.id}:${n.total}`);

export const TESTS: Test[] = [
  {
    nom: 'exemple : Zinc Lumière 75,2 devant Express 74, Plateau 66,4, Martin 64,1',
    f: () => egal(classement(comparer(OFFRES, POIDS)), ['c:75.2', 'd:74', 'a:66.4', 'b:64.1']),
  },
  {
    nom: 'notes par critère : prix mini / prix, délai (mini + 1) / (délai + 1), garantie / maxi',
    f: () => {
      const a = doit(doit(comparer(OFFRES, POIDS)).find((n) => n.offre.id === 'a'));
      egal(a.notes, { prix: 64.6, delai: 32.6, garantie: 100, qualite: 80, acompte: 70 });
      egal(a.ecartAuMoinsCher, 1_360_000);
    },
  },
  {
    nom: 'l’offre à 24 800 € est signalée anormalement basse, pas les autres',
    f: () => {
      const r = doit(comparer(OFFRES, POIDS));
      egal(r.filter((n) => n.anormalementBasse).map((n) => n.offre.id), ['d']);
      egal(doit(r.find((n) => n.offre.id === 'd')).sousLaMoyennePct, 36);
      egal(doit(comparer(OFFRES, POIDS, 40)).filter((n) => n.anormalementBasse).length, 0, 'seuil à 40 %');
    },
  },
  {
    nom: 'tout le poids sur le prix : le moins cher gagne',
    f: () => egal(doit(comparer(OFFRES, { prix: 1, delai: 0, garantie: 0, qualite: 0, acompte: 0 }))[0].offre.id, 'd'),
  },
  {
    nom: 'égalité de note : le moins cher d’abord',
    f: () => {
      const base: Offre = { id: 'x', fournisseur: 'Y', prixHT: 100_000, delaiJours: 10, garantieMois: 12, qualite: 3, acomptePct: 0 };
      const r = doit(comparer([{ ...base, id: 'x', fournisseur: 'Zèbre' }, { ...base, id: 'y', fournisseur: 'Abeille' }], { ...POIDS_PAR_DEFAUT, prix: 0 }));
      egal(r.map((n) => n.offre.fournisseur), ['Abeille', 'Zèbre'], 'à prix égal, ordre alphabétique');
      egal(r.map((n) => n.rang), [1, 2]);
    },
  },
  {
    nom: 'garanties toutes à zéro et délais immédiats : pas de division par zéro',
    f: () => {
      const r = doit(comparer(OFFRES.map((o) => ({ ...o, garantieMois: 0, delaiJours: 0 })), POIDS));
      vrai(r.every((n) => n.notes.garantie === 100 && n.notes.delai === 100 && Number.isFinite(n.total)), 'notes finies');
    },
  },
  {
    nom: 'saisies refusées : une seule offre, poids nuls, prix nul, note hors échelle',
    f: () => {
      egal(verifier(OFFRES.slice(0, 1), POIDS), ['nombre']);
      egal(verifier(OFFRES, { prix: 0, delai: 0, garantie: 0, qualite: 0, acompte: 0 }), ['poids']);
      egal(verifier([{ ...OFFRES[0], prixHT: 0, qualite: 6 }, OFFRES[1]], POIDS), [{ offre: 'a', fautes: ['prix', 'qualite'] }]);
      egal(comparer([...OFFRES, OFFRES[0], OFFRES[1]], POIDS), null, 'six offres');
    },
  },
];
