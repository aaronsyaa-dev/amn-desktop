import { doit, egal, vrai, type Test } from '../_commun/test';
import { BONS_EXEMPLE } from './donnees';
import { ALPHABET, codeValide, emettre, encaisser, etat, finDeValidite, genererCode, normaliserCode, solde, totaux, type Bon, type Encaissement } from './logique';

const AUJ = '2026-10-22';
const ok = (r: ReturnType<typeof encaisser>): Encaissement => {
  vrai(!('erreur' in r), `encaissement refusé : ${'erreur' in r ? r.erreur : ''}`);
  return r as Encaissement;
};
const refus = (r: ReturnType<typeof encaisser>) => ('erreur' in r ? r.erreur : null);

export const TESTS: Test[] = [
  {
    nom: 'le code : 8 signes XXXX-XXXX, sans 0, O, 1 ni I, le même pour le même numéro',
    f: () => {
      const c = genererCode(1000);
      vrai(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(c), c);
      vrai(!/[01OI]/.test(c), `caractère ambigu dans ${c}`);
      egal(genererCode(1000), c);
      vrai(codeValide(c), 'le code généré est valide');
      egal(ALPHABET.length, 32);
    },
  },
  {
    nom: 'dix mille numéros, dix mille codes différents, tous valides',
    f: () => {
      const vus = new Set<string>();
      for (let n = 0; n < 10_000; n += 1) {
        const c = genererCode(n);
        vrai(codeValide(c), `${n} → ${c} invalide`);
        vus.add(c);
      }
      egal(vus.size, 10_000);
    },
  },
  {
    nom: 'la clé détecte toute faute de frappe sur un caractère',
    f: () => {
      for (const n of [0, 7, 1003, 99_999]) {
        const brut = normaliserCode(genererCode(n));
        for (let i = 0; i < brut.length; i += 1)
          for (const ch of ALPHABET) {
            if (ch === brut[i]) continue;
            const faux = brut.slice(0, i) + ch + brut.slice(i + 1);
            vrai(!codeValide(faux), `${brut} → ${faux} accepté à tort`);
          }
      }
    },
  },
  {
    nom: 'la saisie est tolérante à la casse, aux espaces et aux tirets, pas aux signes ambigus',
    f: () => {
      const c = genererCode(1001);
      vrai(codeValide(c.toLowerCase().replace('-', ' ')), 'minuscules et espace');
      vrai(!codeValide(c.replace(/[A-Z2-9]$/, 'O')), 'un O final est refusé');
      vrai(!codeValide('ABC'), 'trop court');
    },
  },
  {
    nom: 'émettre : valable jusqu’à la veille, 12 mois plus tard ; fin de mois correcte',
    f: () => {
      const r = emettre({ beneficiaire: ' Alex ', montant: 5_000, emission: '2026-10-22', moisValidite: 12, numero: 2000 }, BONS_EXEMPLE);
      vrai('bon' in r, 'bon émis');
      const bon = (r as { bon: Bon }).bon;
      egal(bon.valableJusquau, '2027-10-21');
      egal(bon.beneficiaire, 'Alex');
      egal(solde(bon), 5_000);
      const fev = emettre({ beneficiaire: 'B', montant: 100, emission: '2026-01-31', moisValidite: 1, numero: 2001 }, []);
      egal((fev as { bon: Bon }).bon.valableJusquau, '2026-02-28', 'un 31 janvier vaut jusqu’au dernier jour de février');
      egal(finDeValidite('2026-01-28', 1), '2026-02-27');
      egal(finDeValidite('2027-02-28', 12), '2028-02-27', 'année bissextile : la veille du 28');
    },
  },
  {
    nom: 'émettre : saisies refusées et doublon de numéro',
    f: () => {
      const r = emettre({ beneficiaire: '', montant: -5, emission: '2026-02-30', moisValidite: 0, numero: 3000 }, []);
      egal('erreurs' in r ? r.erreurs : [], ['beneficiaire', 'montant', 'date', 'validite']);
      const d = emettre({ beneficiaire: 'X', montant: 100, emission: '2026-10-22', moisValidite: 12, numero: 1000 }, BONS_EXEMPLE);
      egal('erreurs' in d ? d.erreurs : [], ['doublon']);
      const c = emettre({ beneficiaire: 'X', montant: 12.5, emission: '2026-10-22', moisValidite: 12, numero: 3001 }, []);
      egal('erreurs' in c ? c.erreurs : [], ['montant'], 'un montant non entier en centimes est refusé');
    },
  },
  {
    nom: 'encaisser en plusieurs fois ; un achat plus cher prend tout le solde, jamais plus',
    f: () => {
      const code = BONS_EXEMPLE[1].code; // 80 €
      const a = ok(encaisser(BONS_EXEMPLE, code, 2_500, AUJ));
      egal([a.utilise, a.resteAPayer, solde(a.bon)], [2_500, 0, 5_500]);
      const apres = BONS_EXEMPLE.map((b) => (b.code === code ? a.bon : b));
      const b = ok(encaisser(apres, code, 9_000, AUJ));
      egal([b.utilise, b.resteAPayer, solde(b.bon)], [5_500, 3_500, 0]);
      egal(etat(b.bon, AUJ), 'epuise');
      egal(refus(encaisser(apres.map((x) => (x.code === code ? b.bon : x)), code, 100, AUJ)), 'epuise');
    },
  },
  {
    nom: 'encaisser : refus si code faux, inconnu, expiré, montant ou date impossibles',
    f: () => {
      const expire = BONS_EXEMPLE[0].code; // valable jusqu’au 2026-09-13
      egal(refus(encaisser(BONS_EXEMPLE, expire, 500, AUJ)), 'expire');
      egal(etat(BONS_EXEMPLE[0], '2026-09-13'), 'actif', 'le dernier jour compte encore');
      egal(refus(encaisser(BONS_EXEMPLE, 'ABCD-EFGH', 500, AUJ)), 'codeInvalide');
      egal(refus(encaisser(BONS_EXEMPLE, genererCode(55_555), 500, AUJ)), 'inconnu');
      egal(refus(encaisser(BONS_EXEMPLE, BONS_EXEMPLE[1].code, 0, AUJ)), 'montant');
      egal(refus(encaisser(BONS_EXEMPLE, BONS_EXEMPLE[1].code, 100, '2025-01-01')), 'date', 'avant l’émission');
    },
  },
  {
    nom: 'totaux de l’exemple : 320 € émis, 107 € encaissés, 195 € d’encours, 18 € expirés',
    f: () => {
      const t = totaux(BONS_EXEMPLE, AUJ);
      egal([t.emis, t.encaisse, t.encours, t.expiresNonUtilises], [32_000, 10_700, 19_500, 1_800]);
      egal(t.nombre, { actif: 3, epuise: 1, expire: 1 });
      egal(t.emis, t.encaisse + t.encours + t.expiresNonUtilises, 'rien ne se perd');
      doit(BONS_EXEMPLE.find((b) => etat(b, AUJ) === 'epuise'));
    },
  },
];
