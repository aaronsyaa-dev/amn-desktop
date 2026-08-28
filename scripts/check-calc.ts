/**
 * Contrôle du moteur de calcul et de TOUS les profils déclarés.
 *
 * Deux raisons d'être, et la seconde est la plus importante.
 *
 * La première : une calculatrice fausse ne plante pas. Elle rend un prix
 * crédible et faux de trois euros, l'erreur part chez le client, et elle ne se
 * découvre qu'à la fin du mois sur un bénéfice qui ne tombe pas juste.
 *
 * La seconde : ce contrôle valide `CALC_PROFILES` **sans rien savoir des
 * métiers**. C'est la vérification de la promesse du BLOC A — un nouveau
 * calculateur se déclare en données, et s'il est mal déclaré (formule qui
 * nomme une entrée inexistante, cycle, clé en double), ça se voit ici plutôt
 * que le jour où quelqu'un ouvre l'écran.
 *
 *   npm run check:calc
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));

async function loadFromSrc<T>(entry: string): Promise<T> {
  const built = await esbuild.build({
    entryPoints: [path.join(here, '..', entry)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    target: 'node22',
    charset: 'utf8',
  });
  return (await import(
    `data:text/javascript;charset=utf-8;base64,${Buffer.from(built.outputFiles[0].text, 'utf8').toString('base64')}`
  )) as T;
}

type Kind = 'money' | 'percent' | 'number';
interface Input {
  key: string;
  label: string;
  kind: Kind;
  defaultValue: number;
  help?: string;
}
interface Step {
  key: string;
  label: string;
  kind: Kind;
  formula: string;
  output?: boolean;
  headline?: boolean;
  help?: string;
}
interface RowBlock {
  label: string;
  addLabel: string;
  nameLabel?: string;
  help?: string;
  inputs: Input[];
  steps: Step[];
  defaultRows?: number;
}
interface Profile {
  id: string;
  label: string;
  description: string;
  rows?: RowBlock;
  inputs: Input[];
  steps: Step[];
}
interface Line {
  key: string;
  label: string;
  kind: Kind;
  value: number;
  output: boolean;
  headline: boolean;
}
interface RowResult {
  index: number;
  lines: Line[];
  scope: Record<string, number>;
  errors: { key: string; message: string }[];
}
interface Result {
  scope: Record<string, number>;
  lines: Line[];
  rows: RowResult[];
  errors: { key: string; message: string }[];
}
interface EngineModule {
  evaluateFormula(formula: string, scope: Record<string, number>): number;
  evaluateProfile(
    profile: Profile,
    values?: Record<string, number>,
    rowValues?: Record<string, number>[],
  ): Result;
  validateProfile(profile: Profile): string[];
  outputsOf(result: Result): Line[];
  totalKey(key: string): string;
  tokenize(formula: string): unknown[];
  CalcError: new (message: string) => Error;
}
interface SplitModule {
  distributeCents(total: number, weights: number[]): number[];
  monthlySummary(input: {
    month: string;
    partners: string[];
    invoices: { paidAt: string; status: string; grossCents: number }[];
    expenses: { spentAt: string; amountCents: number }[];
    work: { who: string; day: string; durationMs: number }[];
    mode: 'equal' | 'weighted';
  }): {
    month: string;
    revenueCents: number;
    expensesCents: number;
    profitCents: number;
    mode: 'equal' | 'weighted';
    fellBackToEqual: boolean;
    shares: { who: string; workedMs: number; weight: number; amountCents: number }[];
  };
  recentMonths(count?: number, now?: Date): string[];
  monthOfDay(day: string): string;
}
interface ProfilesModule {
  CALC_PROFILES: Profile[];
  DEFAULT_CALC_PROFILE_ID: string;
  calcProfileById(id: string): Profile | undefined;
}
interface PersonalProfilesModule {
  PERSONAL_CALC_PROFILES: Profile[];
  DEFAULT_PERSONAL_PROFILE_ID: string;
  personalProfileById(id: string): Profile | undefined;
}

const { evaluateFormula, evaluateProfile, validateProfile, outputsOf, tokenize, totalKey } =
  await loadFromSrc<EngineModule>('src/state/calcEngine.ts');
const { CALC_PROFILES, DEFAULT_CALC_PROFILE_ID, calcProfileById } =
  await loadFromSrc<ProfilesModule>('src/state/calcProfiles.ts');
const { distributeCents, monthlySummary, recentMonths, monthOfDay } =
  await loadFromSrc<SplitModule>('src/state/monthlySplit.ts');
const { PERSONAL_CALC_PROFILES, DEFAULT_PERSONAL_PROFILE_ID, personalProfileById } =
  await loadFromSrc<PersonalProfilesModule>('src/state/personalProfiles.ts');

/*
  Les contrôles génériques portent sur TOUS les profils déclarés, métier ET
  personnels (BLOC 2). Les profils personnels s'affichent ailleurs — c'est le
  seul motif du fichier séparé — mais ils sont déroulés par le même moteur, et
  un profil qui plante à l'ouverture plante de la même façon des deux côtés.
  N'éprouver que `CALC_PROFILES` laisserait la moitié récente sans filet.
*/
const TOUS_PROFILS: Profile[] = [...CALC_PROFILES, ...PERSONAL_CALC_PROFILES];

/**
 * Le profil, ou un échec net.
 *
 * Un profil renommé ne doit pas faire remonter « impossible de lire "steps" de
 * undefined » depuis le fond d'un test : le nom manquant est l'information.
 */
function profileOf(id: string): Profile {
  const found = calcProfileById(id) ?? personalProfileById(id);
  if (!found) throw new Error(`Profil introuvable : ${id}`);
  return found;
}

const failures: string[] = [];
function check(name: string, run: () => void) {
  try {
    run();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push(name);
    console.error(`  ÉCHEC ${name}`);
    console.error(`         ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
  }
}

const throws = (fn: () => unknown, why: string) => {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  assert.ok(threw, why);
};

/* ============================== L'arithmétique ============================= */

check('les quatre opérations et la priorité', () => {
  assert.equal(evaluateFormula('2 + 3', {}), 5);
  assert.equal(evaluateFormula('2 + 3 * 4', {}), 14, 'la multiplication passe avant');
  assert.equal(evaluateFormula('(2 + 3) * 4', {}), 20);
  assert.equal(evaluateFormula('10 / 4', {}), 2.5);
  assert.equal(evaluateFormula('10 - 2 - 3', {}), 5, 'la soustraction est associative à gauche');
  assert.equal(evaluateFormula('100 / 10 / 2', {}), 5, 'la division aussi');
});

check('le moins unaire s’écrit naturellement', () => {
  assert.equal(evaluateFormula('-5', {}), -5);
  assert.equal(evaluateFormula('3 * -2', {}), -6);
  assert.equal(evaluateFormula('-(2 + 3)', {}), -5);
  assert.equal(evaluateFormula('10 - -5', {}), 15);
  assert.equal(evaluateFormula('max(-3, -7)', {}), -3);
});

check('les valeurs nommées viennent de la portée', () => {
  assert.equal(evaluateFormula('cout * 2', { cout: 21 }), 42);
  assert.equal(evaluateFormula('a / b', { a: 10, b: 4 }), 2.5);
  throws(() => evaluateFormula('inconnu + 1', {}), 'une valeur inconnue doit lever');
});

check('les fonctions admises, et elles seules', () => {
  assert.equal(evaluateFormula('min(3, 7)', {}), 3);
  assert.equal(evaluateFormula('max(3, 7)', {}), 7);
  assert.equal(evaluateFormula('abs(0 - 8)', {}), 8);
  assert.equal(evaluateFormula('round(2.5)', {}), 3, 'arrondi commercial : 0,5 s’éloigne de zéro');
  assert.equal(evaluateFormula('round(-2.5)', {}), -3);
  // `ceil` sert aux grandeurs qui se COMPTENT : un seuil en billets ne
  // s'arrondit pas au plus proche, il monte. Sur un entier exact il ne bouge
  // pas — c'est la moitié du contrat, et celle qu'un `x + 1` casserait.
  assert.equal(evaluateFormula('ceil(2.01)', {}), 3);
  assert.equal(evaluateFormula('ceil(2)', {}), 2, 'un entier exact ne doit pas monter');
  assert.equal(evaluateFormula('ceil(-2.5)', {}), -2);
  assert.equal(evaluateFormula('floor(2.99)', {}), 2);
  assert.equal(evaluateFormula('floor(2)', {}), 2);
  assert.equal(evaluateFormula('floor(-2.5)', {}), -3);
  throws(() => evaluateFormula('sqrt(4)', {}), 'une fonction inconnue doit lever');
});

check('AUCUNE exécution de code : le texte hostile est refusé', () => {
  /*
    Le contrôle qui justifie de ne pas utiliser `eval`. Une formule est du
    texte, et l'objectif est qu'elle puisse un jour venir d'une configuration
    éditée dans l'application — donc d'un utilisateur.
  */
  for (const hostile of [
    'process.exit(1)',
    'globalThis.fetch("http://x")',
    '(() => 1)()',
    'a["b"]',
    '1; alert(1)',
    'constructor.constructor("return 1")()',
    '__proto__',
    '`${1}`',
  ]) {
    throws(() => evaluateFormula(hostile, {}), `« ${hostile} » ne doit pas passer`);
  }
  // `__proto__` est refusé comme identifiant inconnu et non comme caractère
  // interdit : on vérifie qu'il ne rend surtout pas un objet.
  throws(() => evaluateFormula('__proto__', {}), 'accès au prototype');
});

check('les formules mal formées lèvent, elles ne rendent pas NaN', () => {
  // Un NaN se propage en silence jusqu'à un prix affiché « NaN € », sans dire
  // quelle étape l'a produit.
  for (const bad of ['2 +', '* 3', '(2 + 3', '2 + 3)', '', '   ', 'min()']) {
    throws(() => evaluateFormula(bad, {}), `« ${bad} » doit lever`);
  }
});

check('la division par zéro est refusée AU MOMENT de la division', () => {
  /*
    Refuser à la division, et pas seulement en constatant un résultat non fini
    à la fin. La nuance a l'air théorique ; elle ne l'est pas.

    Sans la garde, `10 / 0` vaut `Infinity`, et le contrôle final de finitude
    l'attrape — on croit donc être couvert. Mais `min(10 / 0, 5)` vaut 5 :
    fini, plausible, et FAUX. L'infini a été absorbé en chemin et le calcul
    rend tranquillement un mauvais chiffre.
  */
  const message = (fn: () => unknown): string => {
    try {
      fn();
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
    return '';
  };
  assert.match(message(() => evaluateFormula('10 / 0', {})), /Division par zéro/);
  assert.match(message(() => evaluateFormula('10 / (5 - 5)', {})), /Division par zéro/);
  assert.match(message(() => evaluateFormula('a / b', { a: 1, b: 0 })), /Division par zéro/);

  // Le cas qui compte : l'infini absorbé par une fonction.
  throws(() => evaluateFormula('min(10 / 0, 5)', {}), 'un infini absorbé par min() passe !');
  throws(() => evaluateFormula('max(0 - 10 / 0, 5)', {}), 'un infini absorbé par max() passe !');
  throws(() => evaluateFormula('abs(10 / 0) * 0', {}), 'un infini neutralisé par une multiplication passe !');

  // Et la parade légitime, elle, fonctionne.
  assert.equal(evaluateFormula('10 / max(0, 1)', {}), 10);
});

check('tokenize refuse les caractères hors arithmétique', () => {
  assert.ok(Array.isArray(tokenize('a + 1')));
  for (const bad of ['a & b', 'a | b', 'a % b', 'a ^ b', 'a ? b : c', 'a["x"]']) {
    throws(() => tokenize(bad), `« ${bad} »`);
  }
});

/* ============================== Les profils =============================== */

check('TOUS les profils déclarés sont valides', () => {
  assert.ok(CALC_PROFILES.length >= 4, 'au moins quatre métiers déclarés');
  assert.ok(PERSONAL_CALC_PROFILES.length >= 1, 'au moins un calculateur personnel déclaré');
  for (const profile of TOUS_PROFILS) {
    const problems = validateProfile(profile);
    assert.deepEqual(problems, [], `${profile.id} : ${problems.join(' · ')}`);
  }
});

check('chaque profil a une identité et des libellés utilisables', () => {
  const ids = new Set<string>();
  for (const profile of TOUS_PROFILS) {
    assert.ok(profile.id && !ids.has(profile.id), `id manquant ou en double : ${profile.id}`);
    ids.add(profile.id);
    assert.ok(profile.label.length > 0, `${profile.id} sans libellé`);
    assert.ok(profile.description.length > 20, `${profile.id} : description trop courte`);
    for (const input of profile.inputs) assert.ok(input.label.length > 0, `${profile.id}/${input.key}`);
    for (const step of profile.steps) assert.ok(step.label.length > 0, `${profile.id}/${step.key}`);
  }
  assert.ok(calcProfileById(DEFAULT_CALC_PROFILE_ID), 'le profil par défaut existe');
  assert.equal(calcProfileById('inexistant'), undefined);
  assert.ok(personalProfileById(DEFAULT_PERSONAL_PROFILE_ID), 'le profil personnel par défaut existe');
  assert.equal(personalProfileById('inexistant'), undefined);
  // Les deux catalogues sont DISJOINTS : un profil personnel qui remonterait
  // dans le module Calculateurs afficherait un budget de fin de mois dans
  // l'écran de travail d'une cliente.
  for (const profile of PERSONAL_CALC_PROFILES) {
    assert.equal(calcProfileById(profile.id), undefined, `${profile.id} fuit dans CALC_PROFILES`);
  }
  for (const profile of CALC_PROFILES) {
    assert.equal(personalProfileById(profile.id), undefined, `${profile.id} fuit dans les profils personnels`);
  }
});

check('tout profil se déroule sur ses valeurs par défaut, sans erreur', () => {
  // Un profil dont les valeurs par défaut plantent accueillerait l'utilisateur
  // par un écran d'erreurs à la première ouverture.
  for (const profile of TOUS_PROFILS) {
    const result = evaluateProfile(profile);
    assert.deepEqual(result.errors, [], `${profile.id} : ${JSON.stringify(result.errors)}`);
    assert.ok(outputsOf(result).length > 0, `${profile.id} sans sortie`);
    for (const line of result.lines) {
      assert.ok(Number.isFinite(line.value), `${profile.id}/${line.key} → ${line.value}`);
    }
  }
});

check('TÊTE : chaque calculateur livré nomme LE chiffre qu’on vient chercher', () => {
  /*
    LE DÉFAUT QUE CE CONTRÔLE FERME

    L'écran met en avant la PREMIÈRE sortie — plus grande, filet d'accent — et
    cette liste suivait l'ordre des étapes, c'est-à-dire l'ordre du CALCUL.
    Or cet ordre est imposé par les dépendances : le prix client ne peut pas
    être calculé avant les charges qui entrent dedans. Résultat, « Prix
    client » ouvrait sur les charges sociales et « Rentabilité d'un
    événement » sur les coûts fixes — alors que le commentaire de ce profil
    dit en toutes lettres que le chiffre qui compte est le nombre d'entrées.

    Un chiffre juste, affiché à la place d'un autre, se lit comme une réponse.
    Personne ne signale ce genre d'erreur : on lit le gros chiffre.
  */
  for (const profile of TOUS_PROFILS) {
    const tetes = profile.steps.filter((step) => step.headline);
    assert.equal(
      tetes.length,
      1,
      `${profile.id} : ${tetes.length} étape(s) en tête — un calculateur livré doit nommer sa réponse`,
    );
    assert.ok(tetes[0].output, `${profile.id}/${tetes[0].key} : en tête mais pas déclarée comme sortie`);

    // Et le moteur la rend bien en premier : c'est de cette position que
    // l'écran tire la mise en avant.
    const sorties = outputsOf(evaluateProfile(profile));
    assert.equal(
      sorties[0].key,
      tetes[0].key,
      `${profile.id} : ${sorties[0].key} est affiché en tête à la place de ${tetes[0].key}`,
    );
  }
});

check('TÊTE : la réponse attendue, calculateur par calculateur', () => {
  /*
    Le contrôle précédent exige UNE tête ; celui-ci exige LA BONNE. Sans lui,
    marquer n'importe quelle étape suffirait à passer au vert.

    Chaque ligne est justifiée par la description du profil lui-même — ce sont
    les mêmes mots, et c'est voulu : si la tête et la description divergent un
    jour, l'une des deux est fausse et il faut choisir sciemment.
  */
  const attendu: [string, string, string][] = [
    ['ecommerce-prix-client', 'prixClient', 'la description promet « le prix à afficher »'],
    ['ecommerce-panier', 'prixPanier', '« le prix à demander pour l’ensemble »'],
    ['evenementiel-rentabilite', 'seuilEntrees', '« combien d’entrées vendues avant que… »'],
    ['groupe-cagnotte', 'partRestante', '« ce qu’il reste à demander à chacun » — la relance'],
    ['startup-repartition', 'partFinale', 'la part du fondateur, seule question posée'],
    ['personnel-budget-avant-paie', 'reelDisponible', '« ce qu’il reste vraiment » avant la paie'],
  ];
  for (const [id, cle, pourquoi] of attendu) {
    const profile = TOUS_PROFILS.find((p) => p.id === id);
    assert.ok(profile, `profil disparu : ${id}`);
    const tete = profile.steps.find((step) => step.headline);
    assert.equal(tete?.key, cle, `${id} : la tête devrait être ${cle} — ${pourquoi}`);
  }
});

check('TÊTE : le moteur refuse deux têtes, et une tête qui n’est pas une sortie', () => {
  // La validation, pas seulement la convention : deux têtes valent zéro tête,
  // puisque l'écran en prendrait une au hasard de l'ordre de déclaration.
  const base = {
    id: 'essai-tete',
    label: 'Essai',
    description: 'Un profil d’essai, uniquement pour éprouver la validation des têtes.',
    inputs: [{ key: 'a', label: 'A', kind: 'number' as Kind, defaultValue: 2 }],
  };

  const deux = validateProfile({
    ...base,
    steps: [
      { key: 'x', label: 'X', kind: 'number', formula: 'a * 2', output: true, headline: true },
      { key: 'y', label: 'Y', kind: 'number', formula: 'a * 3', output: true, headline: true },
    ],
  });
  assert.ok(
    deux.some((p) => p.includes('plusieurs étapes en tête')),
    `deux têtes acceptées : ${JSON.stringify(deux)}`,
  );

  const intermediaire = validateProfile({
    ...base,
    steps: [
      { key: 'x', label: 'X', kind: 'number', formula: 'a * 2', headline: true },
      { key: 'y', label: 'Y', kind: 'number', formula: 'x + 1', output: true },
    ],
  });
  assert.ok(
    intermediaire.some((p) => p.includes('pas déclarée comme sortie')),
    `une tête invisible acceptée : ${JSON.stringify(intermediaire)}`,
  );

  // Et le cas sain passe, sinon les deux assertions ci-dessus ne prouvent rien.
  assert.deepEqual(
    validateProfile({
      ...base,
      steps: [
        { key: 'x', label: 'X', kind: 'number', formula: 'a * 2' },
        { key: 'y', label: 'Y', kind: 'number', formula: 'x + 1', output: true, headline: true },
      ],
    }),
    [],
  );
});

check('aucun profil ne casse quand TOUTES les entrées sont à zéro', () => {
  // Le cas réel : un formulaire fraîchement vidé. Il doit rendre des chiffres
  // ou des erreurs nommées, jamais un NaN ni une exception qui remonte.
  for (const profile of TOUS_PROFILS) {
    const zeros = Object.fromEntries(profile.inputs.map((i) => [i.key, 0]));
    const result = evaluateProfile(profile, zeros);
    for (const line of result.lines) {
      assert.ok(Number.isFinite(line.value), `${profile.id}/${line.key} → ${line.value}`);
    }
    for (const err of result.errors) {
      assert.ok(err.message.length > 0, `${profile.id}/${err.key} : erreur sans message`);
    }
  }
});

check('une entrée absente retombe sur sa valeur par défaut', () => {
  const profile = profileOf('ecommerce-prix-client');
  const withDefaults = evaluateProfile(profile);
  const withEmpty = evaluateProfile(profile, { coutFournisseur: Number.NaN });
  assert.equal(withEmpty.scope.coutFournisseur, withDefaults.scope.coutFournisseur);
});

/* ==================== Le calculateur prix client (BLOC B) ================== */

check('PRIX CLIENT : cas connu, vérifié à la main', () => {
  const profile = profileOf('ecommerce-prix-client');
  /*
    La veste à 45 € de l'énoncé. Marge visée 20 €, URSSAF 22 %, Stripe 1,5 %
    + 0,25 €, pas de livraison sortante.

      marge avant charges = 2000 / (1 - 0,22) = 2564,10… → 2564 centimes
      charges             = 2564 - 2000       = 564
      net à encaisser     = 4500 + 0 + 2564   = 7064
      prix client         = (7064 + 25) / (1 - 0,015) = 7196,95… → 7197
      frais de paiement   = 7197 - 7064       = 133
      part par associé    = 2000 / 3          = 666,66… → 667
  */
  const r = evaluateProfile(profile, {
    coutFournisseur: 4500,
    fraisLivraison: 0,
    margeVisee: 2000,
    tauxCharges: 22,
    tauxTransaction: 1.5,
    fixeTransaction: 25,
    associes: 3,
  });
  assert.deepEqual(r.errors, []);
  assert.equal(r.scope.margeBrute, 2564);
  assert.equal(r.scope.charges, 564);
  assert.equal(r.scope.aEncaisser, 7064);
  assert.equal(r.scope.prixClient, 7197);
  assert.equal(r.scope.fraisPaiement, 133);
  assert.equal(r.scope.partAssocie, 667);
});

check('PRIX CLIENT : le prix couvre RÉELLEMENT tout, une fois encaissé', () => {
  /*
    L'invariant qui compte, et la raison d'être de l'ordre des divisions.

    On repart du prix calculé et on refait le chemin dans l'autre sens, comme
    le ferait la banque : Stripe prélève sur le prix, le fournisseur est payé,
    les charges portent sur la marge. Ce qui reste doit être la marge visée.

    Une erreur d'ordre (retrancher les frais avant de connaître le prix) donne
    un prix crédible et faux de plusieurs euros — invisible autrement.
  */
  const profile = profileOf('ecommerce-prix-client');
  for (const [cout, marge, charges, taux, fixe] of [
    [4500, 2000, 22, 1.5, 25],
    [1200, 500, 22, 1.5, 25],
    [25000, 8000, 45, 2.9, 30],
    [999, 100, 0, 0, 0],
  ]) {
    const r = evaluateProfile(profile, {
      coutFournisseur: cout,
      fraisLivraison: 0,
      margeVisee: marge,
      tauxCharges: charges,
      tauxTransaction: taux,
      fixeTransaction: fixe,
      associes: 3,
    });
    const prix = r.scope.prixClient;
    const encaisse = prix - (prix * taux) / 100 - fixe; // ce que Stripe reverse
    const apresFournisseur = encaisse - cout;
    const resteApresCharges = apresFournisseur * (1 - charges / 100);
    // Tolérance de deux centimes : chaque étape « money » est arrondie une fois,
    // exactement comme une ligne de facture.
    assert.ok(
      Math.abs(resteApresCharges - marge) <= 2,
      `cout=${cout} marge=${marge} charges=${charges}% → il reste ${resteApresCharges.toFixed(2)} au lieu de ${marge}`,
    );
  }
});

check('FOURCHETTE : les trois bornes sortent de la MÊME chaîne que le prix visé', () => {
  /*
    Les formules du plancher, du bas et du haut répètent en entier la chaîne de
    `prixClient` — le moteur n'a pas de fonctions, et une règle de trois sur le
    prix visé serait FAUSSE : les frais fixes par transaction ne sont pas
    proportionnels à la marge.

    Cette répétition est le risque : trois formules qui doivent rester
    d'accord. On donne donc `margeVisee` à la formule du bas et on exige
    exactement le prix suggéré. Une divergence future — un terme oublié dans
    une seule des trois — tombe ici.
  */
  const profile = profileOf('ecommerce-prix-client');
  for (const [cout, livraison, marge, charges, taux, fixe] of [
    [4500, 0, 2000, 22, 1.5, 25],
    [1200, 350, 500, 22, 1.5, 25],
    [25000, 0, 8000, 45, 2.9, 30],
    [999, 0, 100, 0, 0, 0],
  ]) {
    const commun = {
      coutFournisseur: cout,
      fraisLivraison: livraison,
      margeVisee: marge,
      tauxCharges: charges,
      tauxTransaction: taux,
      fixeTransaction: fixe,
      associes: 3,
    };
    const r = evaluateProfile(profile, { ...commun, margeBasse: marge, margeHaute: marge });
    assert.deepEqual(r.errors, []);
    assert.equal(
      r.scope.prixBas,
      r.scope.prixClient,
      `à marge égale, le bas de fourchette doit valoir le prix suggéré (cout=${cout})`,
    );
    assert.equal(r.scope.prixHaut, r.scope.prixClient, 'idem pour le haut');
  }
});

check('PRIX PLANCHER : à ce prix il ne reste RIEN, et pas moins que rien', () => {
  /*
    La définition, vérifiée en refaisant le chemin comme la banque : Stripe
    prélève, le fournisseur et la livraison sont payés — il doit rester zéro.

    C'est le seul chiffre de cet écran qui soit une limite : une remise
    consentie au téléphone se compare à lui, pas au prix affiché.
  */
  const profile = profileOf('ecommerce-prix-client');
  for (const [cout, livraison, taux, fixe] of [
    [4500, 0, 1.5, 25],
    [1200, 350, 2.9, 30],
    [25000, 1200, 1.5, 25],
    [999, 0, 0, 0],
  ]) {
    const r = evaluateProfile(profile, {
      coutFournisseur: cout,
      fraisLivraison: livraison,
      margeVisee: 2000,
      tauxCharges: 22,
      tauxTransaction: taux,
      fixeTransaction: fixe,
      associes: 3,
      margeBasse: 1000,
      margeHaute: 3000,
    });
    const plancher = r.scope.prixPlancher;
    const encaisse = plancher - (plancher * taux) / 100 - fixe;
    const reste = encaisse - cout - livraison;
    assert.ok(
      Math.abs(reste) <= 2,
      `cout=${cout} livraison=${livraison} → il reste ${reste.toFixed(2)} au prix plancher, au lieu de 0`,
    );
  }
});

check('FOURCHETTE : plancher < bas < visé < haut, toujours', () => {
  /*
    L'ordre EST le message. Un plancher au-dessus du prix bas, ou un haut
    au-dessous du visé, se lit comme une erreur de saisie et fait perdre
    confiance dans les quatre chiffres à la fois.
  */
  const profile = profileOf('ecommerce-prix-client');
  for (const [basse, visee, haute] of [
    [1000, 2000, 3000],
    [1, 2, 3],
    [5000, 5001, 5002],
    [0, 100, 20000],
  ]) {
    const r = evaluateProfile(profile, {
      coutFournisseur: 4500,
      fraisLivraison: 0,
      margeVisee: visee,
      margeBasse: basse,
      margeHaute: haute,
      tauxCharges: 22,
      tauxTransaction: 1.5,
      fixeTransaction: 25,
      associes: 3,
    });
    const { prixPlancher, prixBas, prixClient, prixHaut } = r.scope;
    assert.ok(
      prixPlancher <= prixBas && prixBas <= prixClient && prixClient <= prixHaut,
      `marges ${basse}/${visee}/${haute} → ${prixPlancher} / ${prixBas} / ${prixClient} / ${prixHaut}`,
    );
  }
});

check('PRIX CLIENT : le prix monte quand un coût monte', () => {
  // Monotonie : une calculatrice qui baisserait le prix quand le coût augmente
  // serait fausse d'une façon qu'aucun cas connu isolé n'attraperait.
  const profile = profileOf('ecommerce-prix-client');
  const base = { fraisLivraison: 0, margeVisee: 2000, tauxCharges: 22, tauxTransaction: 1.5, fixeTransaction: 25, associes: 3 };
  let previous = 0;
  for (const cout of [1000, 2000, 4500, 10000, 50000]) {
    const prix = evaluateProfile(profile, { ...base, coutFournisseur: cout }).scope.prixClient;
    assert.ok(prix > previous, `le prix baisse alors que le coût monte (${cout})`);
    assert.ok(prix > cout, 'le prix passe sous le coût fournisseur');
    previous = prix;
  }
});

check('PRIX CLIENT : plus d’associés ne change pas le prix, seulement les parts', () => {
  const profile = profileOf('ecommerce-prix-client');
  const base = { coutFournisseur: 4500, fraisLivraison: 0, margeVisee: 3000, tauxCharges: 22, tauxTransaction: 1.5, fixeTransaction: 25 };
  const a = evaluateProfile(profile, { ...base, associes: 2 });
  const b = evaluateProfile(profile, { ...base, associes: 3 });
  assert.equal(a.scope.prixClient, b.scope.prixClient, 'le nombre d’associés ne doit pas bouger le prix');
  assert.equal(a.scope.partAssocie, 1500);
  assert.equal(b.scope.partAssocie, 1000);
  // Zéro associé ne doit pas diviser par zéro.
  const zero = evaluateProfile(profile, { ...base, associes: 0 });
  assert.deepEqual(zero.errors, []);
  assert.equal(zero.scope.partAssocie, 3000);
});

/* ======================== Les autres métiers (BLOC C) ===================== */

/* ------------------------- Le panier à plusieurs lignes ------------------- */

check('PANIER : le chemin de l’argent, refait comme la banque', () => {
  /*
    L'invariant qui tient tout le profil : une fois la plateforme prélevée,
    la livraison payée, chaque fournisseur payé et les charges de CHAQUE ligne
    versées à SON taux, il doit rester exactement la somme des marges visées.

    Refait à la main, comme un relevé — c'est la seule vérification qui ne
    puisse pas se tromper de la même façon que le profil.
  */
  const profile = profileOf('ecommerce-panier');
  const paniers: { livraison: number; taux: number; fixe: number; lignes: number[][] }[] = [
    // [coût unitaire, quantité, marge visée, taux de charges]
    { livraison: 0, taux: 1.5, fixe: 25, lignes: [[4500, 3, 2000, 22], [12000, 1, 6000, 45]] },
    { livraison: 890, taux: 2.9, fixe: 30, lignes: [[999, 10, 300, 22]] },
    {
      livraison: 1500,
      taux: 1.5,
      fixe: 25,
      lignes: [
        [4500, 2, 2000, 22],
        [700, 12, 150, 0],
        [25000, 1, 9000, 45],
        [100, 1, 0, 22],
      ],
    },
    { livraison: 0, taux: 0, fixe: 0, lignes: [[1000, 1, 1000, 50]] },
  ];

  for (const panier of paniers) {
    const rows = panier.lignes.map(([coutUnitaire, quantite, margeUnitaire, tauxChargesLigne]) => ({
      coutUnitaire,
      quantite,
      margeUnitaire,
      tauxChargesLigne,
    }));
    const r = evaluateProfile(
      profile,
      { fraisLivraison: panier.livraison, tauxTransaction: panier.taux, fixeTransaction: panier.fixe },
      rows,
    );
    assert.deepEqual(r.errors, [], JSON.stringify(r.errors));
    for (const row of r.rows) assert.deepEqual(row.errors, [], `ligne ${row.index} : ${JSON.stringify(row.errors)}`);

    const prix = r.scope.prixPanier;
    // 1. La plateforme se sert : part variable, puis part fixe — UNE fois.
    let reste = prix - (prix * panier.taux) / 100 - panier.fixe;
    // 2. On expédie la commande.
    reste -= panier.livraison;
    // 3. On paie chaque fournisseur.
    for (const [coutUnitaire, quantite] of panier.lignes) reste -= coutUnitaire * quantite;
    // 4. Chaque ligne cotise à SON taux, sur SA marge.
    for (const [, quantite, margeUnitaire, tauxCharges] of panier.lignes) {
      const brute = margeUnitaire / (1 - tauxCharges / 100);
      reste -= (brute - margeUnitaire) * quantite;
    }
    // 5. Ce qui reste est la marge visée, à l'arrondi près.
    const visee = panier.lignes.reduce((sum, [, quantite, marge]) => sum + marge * quantite, 0);
    // Chaque étape « money » arrondit une fois, par ligne : la tolérance suit
    // le nombre de lignes plutôt qu'un chiffre magique.
    const tolerance = 2 + 2 * panier.lignes.length;
    assert.ok(
      Math.abs(reste - visee) <= tolerance,
      `il reste ${reste.toFixed(2)} au lieu de ${visee} (${panier.lignes.length} ligne(s))`,
    );
  }
});

check('PANIER : la QUANTITÉ n’amplifie pas l’arrondi', () => {
  /*
    LE DÉFAUT QUE CE CONTRÔLE FERME, trouvé par le contrôle précédent.

    Chaque étape « money » arrondit au centime. Une première version calculait
    la marge brute PAR UNITÉ puis multipliait par la quantité : l'arrondi de
    l'unité était multiplié lui aussi. Sur une marge de 3 € à 22 % de charges,
    l'unité arrondit de 0,385 centime — invisible à l'unité, 3,85 € faux à mille
    exemplaires. Personne ne l'aurait vu : le prix reste crédible.

    L'écart doit donc rester borné par le nombre de LIGNES, jamais par les
    quantités. On éprouve la même marge à cinq échelles séparées par des ordres
    de grandeur, avec un taux qui ne tombe pas rond exprès.
  */
  const profile = profileOf('ecommerce-panier');
  for (const quantite of [1, 10, 100, 1000, 7777]) {
    const r = evaluateProfile(
      profile,
      { fraisLivraison: 0, tauxTransaction: 1.5, fixeTransaction: 25 },
      [{ coutUnitaire: 999, quantite, margeUnitaire: 300, tauxChargesLigne: 22 }],
    );
    assert.deepEqual(r.errors, []);
    const prix = r.scope.prixPanier;
    const reste = prix - (prix * 1.5) / 100 - 25 - 999 * quantite;
    const brute = (300 * quantite) / (1 - 0.22);
    const net = reste - (brute - 300 * quantite);
    assert.ok(
      Math.abs(net - 300 * quantite) <= 4,
      `à ${quantite} exemplaires l’écart vaut ${(net - 300 * quantite).toFixed(2)} centimes — l’arrondi suit la quantité`,
    );
  }
});

check('PANIER : les frais fixes se prennent UNE FOIS, pas une par ligne', () => {
  /*
    LA RAISON D'ÊTRE DU PROFIL, éprouvée directement.

    Calculer cinq articles séparément et additionner ajoute cinq parts fixes :
    le panier ressort trop cher, d'autant plus qu'il a de lignes. C'est
    l'erreur que fait n'importe qui avec le calculateur à un article, et elle
    est invisible — le total a l'air juste.

    Cinq lignes identiques, comparées à cinq fois le prix d'un article seul :
    l'écart doit valoir exactement les QUATRE parts fixes en trop, remontées
    par le taux variable comme n'importe quel autre montant.
  */
  const panier = profileOf('ecommerce-panier');
  const article = profileOf('ecommerce-prix-client');
  const taux = 1.5;
  const fixe = 25;
  const ligne = { coutUnitaire: 4500, quantite: 1, margeUnitaire: 2000, tauxChargesLigne: 22 };

  const cinq = evaluateProfile(
    panier,
    { fraisLivraison: 0, tauxTransaction: taux, fixeTransaction: fixe },
    Array.from({ length: 5 }, () => ({ ...ligne })),
  );
  const seul = evaluateProfile(article, {
    coutFournisseur: 4500,
    fraisLivraison: 0,
    margeVisee: 2000,
    tauxCharges: 22,
    tauxTransaction: taux,
    fixeTransaction: fixe,
  });

  const naif = seul.scope.prixClient * 5;
  const economie = naif - cinq.scope.prixPanier;
  const attendu = (4 * fixe) / (1 - taux / 100);
  assert.ok(
    Math.abs(economie - attendu) <= 5,
    `l’écart vaut ${economie.toFixed(2)} au lieu de ${attendu.toFixed(2)} — la part fixe est comptée plusieurs fois`,
  );
  assert.ok(economie > 0, 'le panier devrait coûter MOINS que cinq articles calculés séparément');

  // Et une ligne de quantité 5 doit donner le même prix que cinq lignes de 1 :
  // le découpage du panier ne doit rien changer au total.
  const groupee = evaluateProfile(
    panier,
    { fraisLivraison: 0, tauxTransaction: taux, fixeTransaction: fixe },
    [{ ...ligne, quantite: 5 }],
  );
  assert.ok(
    Math.abs(groupee.scope.prixPanier - cinq.scope.prixPanier) <= 5,
    `regrouper les lignes change le prix : ${groupee.scope.prixPanier} vs ${cinq.scope.prixPanier}`,
  );
});

check('PANIER : chaque ligne cotise à SON taux, et ça CHANGE le résultat', () => {
  /*
    La seconde raison d'être. Un taux unique appliqué au total est faux dès que
    le panier mélange un produit revendu et une prestation.

    La seconde assertion est celle qui compte : sans elle, le contrôle
    passerait aussi bien avec un taux moyen, et ne prouverait donc rien.
  */
  const profile = profileOf('ecommerce-panier');
  const lignes = [
    { coutUnitaire: 4500, quantite: 2, margeUnitaire: 2000, tauxChargesLigne: 22 },
    { coutUnitaire: 25000, quantite: 1, margeUnitaire: 9000, tauxChargesLigne: 45 },
  ];
  const r = evaluateProfile(profile, {}, lignes);
  assert.deepEqual(r.errors, []);

  const attendu = lignes.reduce((sum, l) => {
    const brute = l.margeUnitaire / (1 - l.tauxChargesLigne / 100);
    return sum + roundish((brute - l.margeUnitaire) * l.quantite);
  }, 0);
  assert.ok(
    Math.abs(r.scope.chargesPanier - attendu) <= 2,
    `charges ${r.scope.chargesPanier} au lieu de ${attendu}`,
  );

  // Un taux moyen (33,5 %) sur la marge totale donnerait un autre chiffre :
  // la ventilation par ligne n'est donc pas décorative.
  const margeTotale = lignes.reduce((sum, l) => sum + l.margeUnitaire * l.quantite, 0);
  const moyen = margeTotale / (1 - 0.335) - margeTotale;
  assert.ok(
    Math.abs(moyen - attendu) > 100,
    'un taux moyen donnerait le même résultat : ce contrôle ne prouve rien',
  );
});

check('PANIER : une ligne en échec ne laisse PAS passer un total incomplet', () => {
  /*
    Le piège que ce comportement évite : sommer les lignes qui ont marché.
    Le total serait parfaitement crédible, plus petit que la réalité, et
    personne n'aurait de raison de le mettre en doute.

    Un taux de charges à 100 % divise par zéro — c'est une saisie que rien
    n'interdit à l'écran, et c'est le cas réel.
  */
  const profile = profileOf('ecommerce-panier');
  const r = evaluateProfile(profile, {}, [
    { coutUnitaire: 4500, quantite: 1, margeUnitaire: 2000, tauxChargesLigne: 22 },
    { coutUnitaire: 4500, quantite: 1, margeUnitaire: 2000, tauxChargesLigne: 100 },
  ]);

  assert.deepEqual(r.rows[0].errors, [], 'la première ligne, elle, doit passer');
  assert.ok(r.rows[1].errors.length > 0, 'la seconde ligne doit échouer');
  assert.ok(
    r.rows[1].errors[0].message.startsWith('Ligne 2'),
    `l’erreur doit nommer sa ligne : ${r.rows[1].errors[0].message}`,
  );

  // Le total refusé, et tout ce qui en dépend refusé à son tour.
  assert.equal(r.scope.total_netLigne, undefined, 'un total partiel est entré dans la portée');
  assert.equal(r.scope.prixPanier, undefined, 'un prix a été calculé sur un panier incomplet');
  const cles = r.errors.map((e) => e.key);
  assert.ok(cles.includes('total_netLigne'), JSON.stringify(r.errors));
  assert.ok(cles.includes('prixPanier'), JSON.stringify(r.errors));

  // Et le coût, lui, se totalise quand même : `coutLigne` ne dépend pas de la
  // ligne fautive. Une erreur ne doit pas emporter ce qu'elle ne touche pas.
  assert.equal(r.scope.total_coutLigne, 9000);
});

check('PANIER : sans lignes fournies, l’écran s’ouvre sur un panier qui tient debout', () => {
  // À la première ouverture, personne n'a rien saisi. Le profil doit rendre
  // ses `defaultRows` lignes remplies des valeurs par défaut, et un prix.
  const profile = profileOf('ecommerce-panier');
  const r = evaluateProfile(profile);
  assert.deepEqual(r.errors, []);
  assert.equal(r.rows.length, 2, 'defaultRows n’est pas respecté');
  for (const row of r.rows) assert.deepEqual(row.errors, []);
  assert.ok(r.scope.prixPanier > 0);
  assert.equal(r.scope.nbLignes, 2);
});

check('LIGNES : une colonne ne fuit pas d’une ligne à la suivante', () => {
  /*
    Chaque ligne part d'une COPIE de la portée globale. Sans cette copie, une
    colonne laissée vide sur la ligne 2 hériterait de la ligne 1 : le résultat
    dépendrait de l'ordre de saisie, ce qui est la pire sorte de bug — il ne se
    reproduit pas quand on le cherche.
  */
  const profile = profileOf('ecommerce-panier');
  const r = evaluateProfile(profile, {}, [
    { coutUnitaire: 90000, quantite: 1, margeUnitaire: 1, tauxChargesLigne: 0 },
    {}, // rien de saisi : les valeurs par défaut des colonnes, et elles seules
  ]);
  assert.deepEqual(r.errors, []);
  assert.equal(r.rows[1].scope.coutUnitaire, 4500, 'la ligne 2 a hérité du coût de la ligne 1');
  assert.equal(r.rows[1].scope.margeUnitaire, 2000);
  assert.equal(r.rows[1].scope.tauxChargesLigne, 22);
});

check('LIGNES : une étape de ligne voit les entrées globales, jamais les étapes globales', () => {
  /*
    C'est la limite assumée du modèle : les lignes sont déroulées AVANT les
    étapes globales, donc une ligne ne peut pas nommer un calcul global. La
    déclarer ici, c'est s'assurer qu'elle est refusée à la validation plutôt
    que découverte comme un « Valeur inconnue » à l'écran.
  */
  const base = {
    id: 'essai-lignes',
    label: 'Essai',
    description: 'Un profil d’essai, uniquement pour éprouver la portée des lignes.',
    inputs: [{ key: 'tva', label: 'TVA', kind: 'percent' as Kind, defaultValue: 20 }],
  };
  const colonnes = [{ key: 'ht', label: 'HT', kind: 'money' as Kind, defaultValue: 1000 }];

  // Une entrée globale vue depuis une ligne : accepté, et calculé juste.
  const bon = {
    ...base,
    rows: {
      label: 'Lignes',
      addLabel: 'Ajouter',
      inputs: colonnes,
      steps: [{ key: 'ttc', label: 'TTC', kind: 'money' as Kind, formula: 'ht * (1 + tva / 100)', output: true }],
    },
    steps: [{ key: 'total', label: 'Total', kind: 'money' as Kind, formula: 'total_ttc', output: true, headline: true }],
  };
  assert.deepEqual(validateProfile(bon), []);
  const r = evaluateProfile(bon, {}, [{ ht: 1000 }, { ht: 2500 }]);
  assert.deepEqual(r.errors, []);
  assert.equal(r.rows[0].scope.ttc, 1200);
  assert.equal(r.rows[1].scope.ttc, 3000);
  assert.equal(r.scope.total, 1200 + 3000);

  // Une étape GLOBALE vue depuis une ligne : refusée, avec la raison.
  const mauvais = {
    ...base,
    rows: {
      label: 'Lignes',
      addLabel: 'Ajouter',
      inputs: colonnes,
      steps: [{ key: 'ttc', label: 'TTC', kind: 'money' as Kind, formula: 'ht * coefficient', output: true }],
    },
    steps: [
      { key: 'coefficient', label: 'Coefficient', kind: 'number' as Kind, formula: '1 + tva / 100' },
      { key: 'total', label: 'Total', kind: 'money' as Kind, formula: 'total_ttc', output: true, headline: true },
    ],
  };
  const problemes = validateProfile(mauvais);
  assert.ok(
    problemes.some((p) => p.includes('coefficient') && p.includes('(ligne)')),
    `une ligne nommant une étape globale a été acceptée : ${JSON.stringify(problemes)}`,
  );
});

check('LIGNES : une colonne ne peut pas masquer une entrée globale', () => {
  // Elle l'écraserait dans la portée de la ligne — sans le dire, et seulement
  // là. Les deux valeurs porteraient le même nom et n'auraient pas la même
  // valeur selon l'endroit où on les lit.
  const problemes = validateProfile({
    id: 'essai-masque',
    label: 'Essai',
    description: 'Un profil d’essai, uniquement pour éprouver le masquage de portée.',
    inputs: [{ key: 'taux', label: 'Taux', kind: 'percent', defaultValue: 20 }],
    rows: {
      label: 'Lignes',
      addLabel: 'Ajouter',
      inputs: [{ key: 'taux', label: 'Taux de la ligne', kind: 'percent', defaultValue: 5 }],
      steps: [{ key: 'x', label: 'X', kind: 'number', formula: 'taux * 2', output: true }],
    },
    steps: [{ key: 'y', label: 'Y', kind: 'number', formula: 'nbLignes', output: true, headline: true }],
  });
  assert.ok(
    problemes.some((p) => p.includes('déjà pris par une entrée globale')),
    JSON.stringify(problemes),
  );
});

check('LIGNES : ne se totalise que ce dont la somme veut dire quelque chose', () => {
  /*
    DEUX REFUS, ET ILS N'ONT PAS LA MÊME FORCE.

    Un TAUX ne se totalise jamais : 22 % et 45 % ne font pas 67 %. C'est une
    règle du moteur, rien ne la lève.

    Une COLONNE SAISIE ne se totalise que si le profil le dit. « Quantité » se
    totalise ; « Coût unitaire » non — 45 € et 45 € n'en font pas 90, ils font
    deux articles à 45 €. Le moteur ne peut pas trancher depuis la nature de
    la colonne : les deux sont des nombres, l'un est un compte et l'autre un
    prix. C'est donc le profil qui le dit, et le pied du tableau n'affiche que
    ce qu'il a déclaré.

    Le message doit dire POURQUOI, sinon l'auteur du profil contourne au lieu
    de comprendre.
  */
  const base = {
    id: 'essai-totaux',
    label: 'Essai',
    description: 'Un profil d’essai, uniquement pour éprouver ce qui se totalise.',
    inputs: [],
    steps: [{ key: 'somme', label: 'Somme', kind: 'number' as Kind, formula: 'total_remise', output: true, headline: true }],
  };

  // Un taux : refusé, et « sum » n'y change rien.
  for (const sum of [undefined, true]) {
    const problemes = validateProfile({
      ...base,
      rows: {
        label: 'Lignes',
        addLabel: 'Ajouter',
        inputs: [{ key: 'remise', label: 'Remise', kind: 'percent', defaultValue: 10, sum }],
        steps: [],
      },
    });
    assert.ok(
      problemes.some((p) => p.includes('ne se totalise pas')),
      `sum=${String(sum)} : ${JSON.stringify(problemes)}`,
    );
  }

  // Une colonne ordinaire non déclarée : refusée aussi.
  const sansDeclaration = validateProfile({
    ...base,
    rows: {
      label: 'Lignes',
      addLabel: 'Ajouter',
      inputs: [{ key: 'remise', label: 'Remise', kind: 'money', defaultValue: 10 }],
      steps: [],
    },
  });
  assert.ok(
    sansDeclaration.some((p) => p.includes('ne se totalise pas')),
    JSON.stringify(sansDeclaration),
  );

  // La même, déclarée : acceptée, et le total tombe juste.
  const declaree = {
    ...base,
    rows: {
      label: 'Lignes',
      addLabel: 'Ajouter',
      inputs: [{ key: 'remise', label: 'Remise', kind: 'money' as Kind, defaultValue: 10, sum: true }],
      steps: [],
    },
  };
  assert.deepEqual(validateProfile(declaree), []);
  assert.equal(evaluateProfile(declaree, {}, [{ remise: 300 }, { remise: 450 }]).scope.somme, 750);

  // Et sur le profil livré, à l'exécution.
  const panier = evaluateProfile(profileOf('ecommerce-panier'));
  assert.equal(panier.scope[totalKey('tauxChargesLigne')], undefined, 'la somme de deux taux est dans la portée');
  assert.equal(panier.scope[totalKey('coutUnitaire')], undefined, 'la somme de deux prix unitaires est dans la portée');
  assert.ok(panier.scope[totalKey('quantite')] > 0, 'la quantité, elle, doit se totaliser');
  assert.ok(panier.scope[totalKey('coutLigne')] > 0, 'une étape de ligne se totalise toujours');
});

check('LIGNES : un profil SANS bloc de lignes se comporte exactement comme avant', () => {
  // La non-régression : les quatre profils historiques n'ont pas de lignes, et
  // rien de ce qui les concerne ne doit avoir changé.
  for (const profile of TOUS_PROFILS.filter((p) => !p.rows)) {
    const r = evaluateProfile(profile);
    assert.deepEqual(r.rows, [], `${profile.id} rend des lignes alors qu’il n’en déclare pas`);
    assert.equal(r.scope.nbLignes, undefined, `${profile.id} : nbLignes ne devrait pas exister`);
  }
});

check('ÉVÉNEMENTIEL : le seuil de rentabilité tombe juste', () => {
  const profile = profileOf('evenementiel-rentabilite');
  /*
    Coûts fixes 2 000 €, billet 25 €, commission 5 %, coût par entrée 1,50 €.
      recette nette = 2500 - 125 - 150 = 2225 centimes
      seuil         = 200000 / 2225    = 89,88… entrées
  */
  const r = evaluateProfile(profile, {
    coutLieu: 120000,
    coutPrestataires: 50000,
    coutCommunication: 30000,
    coutParEntree: 150,
    prixBillet: 2500,
    commissionBilletterie: 5,
    capacite: 200,
  });
  assert.deepEqual(r.errors, []);
  assert.equal(r.scope.coutsFixes, 200000);
  assert.equal(r.scope.recetteNetteBillet, 2225);
  // 200 000 / 2 225 = 89,887 entrées. On en annonce 90 : à 89 entrées vendues
  // il manque encore 1 975 centimes, et un seuil qu'on atteint en étant
  // toujours à perte n'est pas un seuil.
  assert.equal(r.scope.seuilEntrees, 90, String(r.scope.seuilEntrees));
  assert.ok(2225 * 89 < 200000, 'à 89 entrées, l’événement perd encore — le seuil ne peut pas être 89');
  assert.ok(2225 * 90 >= 200000, 'à 90 entrées, l’équilibre est atteint');
  assert.equal(r.scope.margeSalleComble, 2225 * 200 - 200000);
});

check('ÉVÉNEMENTIEL : le seuil est un NOMBRE D’ENTRÉES, jamais une fraction', () => {
  /*
    On ne vend pas 0,37 billet. Le seuil affiché doit être le premier nombre
    ENTIER d'entrées à partir duquel l'événement ne perd plus d'argent — donc
    toujours l'entier supérieur, jamais l'arrondi au plus proche.

    Éprouvé sur des coûts qui tombent juste et sur d'autres qui ne tombent pas
    juste : un entier exact ne doit pas grimper d'une unité au passage.
  */
  const profile = profileOf('evenementiel-rentabilite');
  for (const coutLieu of [100000, 100001, 122500, 200000, 222500, 222501]) {
    const r = evaluateProfile(profile, {
      coutLieu,
      coutPrestataires: 0,
      coutCommunication: 0,
      coutParEntree: 150,
      prixBillet: 2500,
      commissionBilletterie: 5,
      capacite: 1000,
    });
    assert.deepEqual(r.errors, []);
    const seuil = r.scope.seuilEntrees;
    assert.equal(seuil, Math.trunc(seuil), `seuil fractionnaire : ${seuil} (coûts ${coutLieu})`);
    const recette = r.scope.recetteNetteBillet;
    // Le contrat, dans les deux sens : à ce nombre-là on y est, un de moins
    // et on n'y est pas. La seconde moitié est celle qu'un `ceil` remplacé
    // par `round` casse, et la première celle qu'un `+ 1` gratuit casserait.
    assert.ok(recette * seuil >= coutLieu, `à ${seuil} entrées on perd encore (coûts ${coutLieu})`);
    assert.ok(
      recette * (seuil - 1) < coutLieu,
      `${seuil} entrées, mais ${seuil - 1} suffisaient déjà (coûts ${coutLieu})`,
    );
  }
});

check('ÉVÉNEMENTIEL : un billet vendu à perte ne produit pas l’infini', () => {
  // Billet moins cher que le coût par entrée : la recette nette est négative.
  // Le seuil doit rester un nombre fini, à côté duquel l'écran montre la
  // recette négative qui l'explique.
  const profile = profileOf('evenementiel-rentabilite');
  const r = evaluateProfile(profile, { prixBillet: 100, coutParEntree: 500, commissionBilletterie: 5 });
  assert.deepEqual(r.errors, []);
  assert.ok(Number.isFinite(r.scope.seuilEntrees));
  assert.ok(r.scope.recetteNetteBillet < 0, 'la perte par billet doit se voir');
});

check('CAGNOTTE : les frais de plateforme sont pris en compte', () => {
  const profile = profileOf('groupe-cagnotte');
  const r = evaluateProfile(profile, {
    objectif: 100000,
    dejaCollecte: 0,
    participants: 20,
    ontDejaPaye: 0,
    fraisPlateforme: 5,
  });
  // Collecter 1 000 € tout rond laisserait 950 € après frais : il faut viser
  // 1 000 / 0,95 = 1 052,63 €.
  assert.equal(r.scope.objectifBrut, 105263);
  assert.equal(r.scope.restant, 105263);
  assert.equal(r.scope.partRestante, roundish(105263 / 20));
  assert.ok(Math.abs(r.scope.avancement - 0) < 0.001);
});

check('CAGNOTTE : objectif atteint → reste zéro, pas un négatif', () => {
  const profile = profileOf('groupe-cagnotte');
  const r = evaluateProfile(profile, {
    objectif: 100000,
    dejaCollecte: 200000,
    participants: 20,
    ontDejaPaye: 20,
    fraisPlateforme: 5,
  });
  assert.equal(r.scope.restant, 0, 'un reste négatif se lirait comme une dette');
  assert.equal(r.scope.restantsAPayer, 0);
  assert.equal(r.scope.partRestante, 0);
});

check('STARTUP : la répartition pondérée tombe juste', () => {
  const profile = profileOf('startup-repartition');
  /*
    Apport 5 000 sur 15 000 → 33,33 % du capital.
    12 mois sur 30 → 40 % du temps.
    Poids 40/60 → (33,33*40 + 40*60) / 100 = 37,33 %
  */
  const r = evaluateProfile(profile, {
    apportMoi: 500000,
    apportTotal: 1500000,
    moisMoi: 12,
    moisTotal: 30,
    poidsCapital: 40,
    poidsTemps: 60,
  });
  assert.deepEqual(r.errors, []);
  assert.ok(Math.abs(r.scope.partCapital - 33.333) < 0.01);
  assert.equal(r.scope.partTemps, 40);
  assert.ok(Math.abs(r.scope.partFinale - 37.333) < 0.01, String(r.scope.partFinale));
});

check('STARTUP : des poids qui ne font pas 100 sont normalisés', () => {
  const profile = profileOf('startup-repartition');
  const base = { apportMoi: 500000, apportTotal: 1000000, moisMoi: 10, moisTotal: 10 };
  // 50 % du capital, 100 % du temps. Poids 1/1 → 75 %. Poids 10/10 → 75 % aussi.
  const a = evaluateProfile(profile, { ...base, poidsCapital: 1, poidsTemps: 1 });
  const b = evaluateProfile(profile, { ...base, poidsCapital: 10, poidsTemps: 10 });
  assert.ok(Math.abs(a.scope.partFinale - 75) < 0.001, String(a.scope.partFinale));
  assert.ok(Math.abs(a.scope.partFinale - b.scope.partFinale) < 0.001, 'l’échelle des poids ne doit pas compter');
});

/* ================== La promesse : déclarer sans coder ===================== */

check('un calculateur INÉDIT se déclare en données et fonctionne', () => {
  /*
    Le test de la généricité. Ce profil n'existe nulle part dans le produit :
    il est écrit ici, à l'instant, sans qu'une seule ligne du moteur ne le
    connaisse. S'il tourne, la promesse du BLOC A tient.
  */
  const inedit = {
    id: 'test-freelance',
    label: 'Taux journalier',
    description: 'Le taux à facturer pour atteindre un revenu net visé sur l’année.',
    inputs: [
      { key: 'netVise', label: 'Net annuel visé', kind: 'money' as const, defaultValue: 3600000 },
      { key: 'joursFactures', label: 'Jours facturés', kind: 'number' as const, defaultValue: 180 },
      { key: 'charges', label: 'Charges', kind: 'percent' as const, defaultValue: 45 },
      { key: 'fraisFixes', label: 'Frais fixes annuels', kind: 'money' as const, defaultValue: 600000 },
    ],
    steps: [
      { key: 'brutNecessaire', label: 'CA nécessaire', kind: 'money' as const, formula: 'netVise / (1 - charges / 100) + fraisFixes', output: true },
      { key: 'tjm', label: 'Taux journalier', kind: 'money' as const, formula: 'brutNecessaire / max(joursFactures, 1)', output: true },
    ],
  };
  assert.deepEqual(validateProfile(inedit), []);
  const r = evaluateProfile(inedit);
  assert.deepEqual(r.errors, []);
  // 36 000 / 0,55 = 65 454,54… + 6 000 = 71 454,54 → /180 = 397,0 €
  assert.equal(r.scope.brutNecessaire, 7145455);
  assert.equal(r.scope.tjm, 39697);
  assert.equal(outputsOf(r).length, 2);
});

check('un profil MAL déclaré est refusé, avec la raison', () => {
  const bad = {
    id: 'casse',
    label: 'Cassé',
    description: 'Un profil volontairement incohérent, pour vérifier les refus.',
    inputs: [{ key: 'a', label: 'A', kind: 'number' as const, defaultValue: 1 }],
    steps: [
      // Nomme une étape qui vient APRÈS : la seule façon d'écrire un cycle.
      { key: 'x', label: 'X', kind: 'number' as const, formula: 'a + y', output: true },
      { key: 'y', label: 'Y', kind: 'number' as const, formula: 'a * 2' },
      // Clé en double.
      { key: 'x', label: 'X bis', kind: 'number' as const, formula: 'a' },
      // Formule invalide.
      { key: 'z', label: 'Z', kind: 'number' as const, formula: 'a +' },
    ],
  };
  const problems = validateProfile(bad);
  assert.ok(problems.some((p) => p.includes('y')), 'le cycle n’est pas détecté');
  assert.ok(problems.some((p) => p.includes('double')), 'la clé en double n’est pas détectée');
  assert.ok(problems.some((p) => p.startsWith('z')), 'la formule invalide n’est pas détectée');
});

check('un profil sans sortie est refusé', () => {
  const problems = validateProfile({
    id: 'muet',
    label: 'Muet',
    description: 'Un profil qui calcule sans jamais rien afficher.',
    inputs: [{ key: 'a', label: 'A', kind: 'number', defaultValue: 1 }],
    steps: [{ key: 'b', label: 'B', kind: 'number', formula: 'a * 2' }],
  });
  assert.ok(problems.some((p) => p.includes('sortie')), JSON.stringify(problems));
});

check('une étape en échec ne fait pas tomber les autres', () => {
  const profile = {
    id: 'partiel',
    label: 'Partiel',
    description: 'Une étape fautive au milieu, les autres doivent survivre.',
    inputs: [{ key: 'a', label: 'A', kind: 'number' as const, defaultValue: 10 }],
    steps: [
      { key: 'ok1', label: 'OK 1', kind: 'number' as const, formula: 'a * 2', output: true },
      { key: 'boom', label: 'Boom', kind: 'number' as const, formula: 'a / 0' },
      { key: 'ok2', label: 'OK 2', kind: 'number' as const, formula: 'ok1 + 1', output: true },
      // Dépend de l'étape en échec : doit échouer proprement, pas rendre NaN.
      { key: 'suite', label: 'Suite', kind: 'number' as const, formula: 'boom + 1', output: true },
    ],
  };
  const r = evaluateProfile(profile);
  assert.equal(r.scope.ok1, 20);
  assert.equal(r.scope.ok2, 21, 'une étape saine après l’échec doit tourner');
  assert.equal(r.errors.length, 2, JSON.stringify(r.errors));
  assert.ok(r.errors.some((e) => e.key === 'boom'));
  assert.ok(r.errors.some((e) => e.key === 'suite'));
  assert.ok(!('suite' in r.scope), 'une étape en échec ne doit rien laisser dans la portée');
});

check('l’argent est arrondi au centime À CHAQUE étape', () => {
  const profile = {
    id: 'arrondi',
    label: 'Arrondi',
    description: 'Vérifie que le détail affiché et son total ne divergent pas.',
    inputs: [{ key: 'a', label: 'A', kind: 'money' as const, defaultValue: 1000 }],
    steps: [
      { key: 'tiers', label: 'Tiers', kind: 'money' as const, formula: 'a / 3', output: true },
      { key: 'triple', label: 'Triple du tiers', kind: 'money' as const, formula: 'tiers * 3', output: true },
      { key: 'exact', label: 'Sans arrondi', kind: 'number' as const, formula: 'a / 3' },
    ],
  };
  const r = evaluateProfile(profile);
  assert.equal(r.scope.tiers, 333, '1000 / 3 → 333 centimes');
  // 333 * 3 = 999 et non 1000 : c'est la bonne réponse, celle qui correspond à
  // ce qui est AFFICHÉ. Un arrondi repoussé à la fin afficherait 3,33 € trois
  // fois pour un total de 10,00 €.
  assert.equal(r.scope.triple, 999);
  assert.ok(Math.abs(r.scope.exact - 333.333) < 0.01, 'un pas `number` n’est pas arrondi');
});

/* ==================== Synthèse mensuelle et répartition =================== */

check('RÉPARTITION : aucun centime perdu ni inventé', () => {
  /*
    Le contrôle qui compte. 100 centimes entre trois donnent 33/33/33 et un
    centime s'évapore ; sur douze mois, les comptes ne tombent plus juste et
    personne ne sait pourquoi.
  */
  for (const [total, weights] of [
    [100, [1, 1, 1]],
    [10000, [1, 1, 1]],
    [7, [1, 1, 1, 1, 1]],
    [1, [1, 1]],
    [123457, [3, 2, 1]],
    [999999, [7, 11, 13]],
    [-100, [1, 1, 1]],
  ] as [number, number[]][]) {
    const parts = distributeCents(total, weights);
    assert.equal(parts.reduce((a, b) => a + b, 0), total, `total=${total} poids=${weights}`);
    assert.ok(parts.every((p) => Number.isInteger(p)), 'des centimes non entiers');
  }
});

check('RÉPARTITION : les écarts restent d’un centime au plus', () => {
  const parts = distributeCents(100, [1, 1, 1]);
  assert.equal(Math.max(...parts) - Math.min(...parts), 1, JSON.stringify(parts));
  assert.deepEqual([...parts].sort((a, b) => b - a), [34, 33, 33]);
});

check('RÉPARTITION : des poids nuls ne divisent pas par zéro', () => {
  assert.deepEqual(distributeCents(1000, [0, 0, 0]), [0, 0, 0]);
  assert.deepEqual(distributeCents(1000, []), []);
  assert.deepEqual(distributeCents(0, [1, 1]), [0, 0]);
});

check('MOIS : les factures et dépenses du mois, et rien d’autre', () => {
  const summary = monthlySummary({
    month: '2026-03',
    partners: ['a@x.test', 'b@x.test'],
    invoices: [
      { paidAt: '2026-03-05', status: 'paid', grossCents: 120000 },
      { paidAt: '2026-03-28', status: 'paid', grossCents: 30000 },
      // Autre mois : ignorée.
      { paidAt: '2026-02-28', status: 'paid', grossCents: 999999 },
      // Émise mais pas encaissée : elle n'est pas du bénéfice.
      { paidAt: '', status: 'issued', grossCents: 500000 },
    ],
    expenses: [
      { spentAt: '2026-03-02', amountCents: 20000 },
      { spentAt: '2026-04-01', amountCents: 777777 },
    ],
    work: [],
    mode: 'equal',
  });
  assert.equal(summary.revenueCents, 150000);
  assert.equal(summary.expensesCents, 20000);
  assert.equal(summary.profitCents, 130000);
  assert.equal(summary.shares.length, 2);
  assert.equal(summary.shares[0].amountCents + summary.shares[1].amountCents, 130000);
});

check('MOIS : la pondération suit le temps réellement enregistré', () => {
  const summary = monthlySummary({
    month: '2026-03',
    partners: ['a@x.test', 'b@x.test', 'c@x.test'],
    invoices: [{ paidAt: '2026-03-10', status: 'paid', grossCents: 600000 }],
    expenses: [],
    work: [
      { who: 'a@x.test', day: '2026-03-01', durationMs: 3 * 3600_000 },
      { who: 'b@x.test', day: '2026-03-02', durationMs: 2 * 3600_000 },
      { who: 'c@x.test', day: '2026-03-03', durationMs: 1 * 3600_000 },
      // Hors mois : ne pondère pas.
      { who: 'c@x.test', day: '2026-02-15', durationMs: 100 * 3600_000 },
      // Quelqu'un qui n'est pas associé : ne pondère rien non plus.
      { who: 'intrus@x.test', day: '2026-03-04', durationMs: 50 * 3600_000 },
    ],
    mode: 'weighted',
  });
  assert.equal(summary.mode, 'weighted');
  assert.equal(summary.fellBackToEqual, false);
  // 3/2/1 sur six heures → 300 000 / 200 000 / 100 000.
  assert.deepEqual(summary.shares.map((s) => s.amountCents), [300000, 200000, 100000]);
  assert.equal(summary.shares.reduce((a, s) => a + s.amountCents, 0), 600000);
});

check('MOIS : pondération demandée sans aucun temps → équitable, ET c’est DIT', () => {
  /*
    Le piège. Une répartition annoncée « pondérée » qui est en fait équitable,
    sans le signaler, se découvre au moment du virement — quand quelqu'un qui a
    travaillé trois fois plus touche la même chose.
  */
  const summary = monthlySummary({
    month: '2026-03',
    partners: ['a@x.test', 'b@x.test'],
    invoices: [{ paidAt: '2026-03-10', status: 'paid', grossCents: 100000 }],
    expenses: [],
    work: [],
    mode: 'weighted',
  });
  assert.equal(summary.fellBackToEqual, true, 'le repli n’est pas signalé');
  assert.equal(summary.mode, 'equal');
  assert.deepEqual(summary.shares.map((s) => s.amountCents), [50000, 50000]);
});

check('MOIS : un associé sans temps apparaît quand même, à zéro', () => {
  const summary = monthlySummary({
    month: '2026-03',
    partners: ['a@x.test', 'absent@x.test'],
    invoices: [{ paidAt: '2026-03-10', status: 'paid', grossCents: 100000 }],
    expenses: [],
    work: [{ who: 'a@x.test', day: '2026-03-01', durationMs: 3600_000 }],
    mode: 'weighted',
  });
  // Il doit être VISIBLE à zéro plutôt qu'absent : une ligne manquante se lit
  // comme un oubli, un zéro se lit comme une information.
  assert.equal(summary.shares.length, 2);
  assert.equal(summary.shares[1].who, 'absent@x.test');
  assert.equal(summary.shares[1].amountCents, 0);
  assert.equal(summary.shares[0].amountCents, 100000);
});

check('MOIS : un mois déficitaire se répartit aussi', () => {
  // Un mauvais mois est une information, pas une erreur : la perte se partage
  // comme le bénéfice, et le total doit rester exact.
  const summary = monthlySummary({
    month: '2026-03',
    partners: ['a@x.test', 'b@x.test', 'c@x.test'],
    invoices: [{ paidAt: '2026-03-10', status: 'paid', grossCents: 10000 }],
    expenses: [{ spentAt: '2026-03-05', amountCents: 40000 }],
    work: [],
    mode: 'equal',
  });
  assert.equal(summary.profitCents, -30000);
  assert.equal(summary.shares.reduce((a, s) => a + s.amountCents, 0), -30000);
});

check('MOIS : sans associé déclaré, rien n’explose', () => {
  const summary = monthlySummary({
    month: '2026-03',
    partners: [],
    invoices: [{ paidAt: '2026-03-10', status: 'paid', grossCents: 100000 }],
    expenses: [],
    work: [],
    mode: 'equal',
  });
  assert.deepEqual(summary.shares, []);
  assert.equal(summary.profitCents, 100000);
});

check('les douze derniers mois se suivent, changement d’année compris', () => {
  const months = recentMonths(14, new Date('2026-02-15T12:00:00Z'));
  assert.equal(months[0], '2026-02');
  assert.equal(months[1], '2026-01');
  assert.equal(months[2], '2025-12', 'le passage d’année');
  // Quatorze mois avant février 2026 : janvier 2025.
  assert.equal(months[13], '2025-01');
  assert.equal(new Set(months).size, 14, 'aucun mois en double');
  assert.equal(monthOfDay('2026-03-14'), '2026-03');
  assert.equal(monthOfDay(''), '');
});

/* ================= Le budget avant la paie (BLOC 2, personnel) ============= */

check('BUDGET : cas connu, vérifié à la main', () => {
  const profile = profileOf('personnel-budget-avant-paie');
  /*
    842,50 € sur le compte, 120 € de remboursement attendu, 615 € de
    prélèvements encore à passer, 100 € qu'on veut voir le jour de la paie,
    douze jours à tenir.

      reste vraiment = 84250 + 12000 - 61500 = 34750
      manque         = max(-34750, 0)        = 0
      dépensable     = max(34750 - 10000, 0) = 24750
      par jour       = 24750 / 12 = 2062,5   → 2063 (arrondi au centime)
      par semaine    = min(2063 × 7, 24750)  = 14441
  */
  const result = evaluateProfile(profile, {
    solde: 84250, aVenir: 12000, prelevements: 61500, matelas: 10000, jours: 12,
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.scope.reelDisponible, 34750);
  assert.equal(result.scope.manque, 0);
  assert.equal(result.scope.depensable, 24750);
  assert.equal(result.scope.parJour, 2063);
  assert.equal(result.scope.parSemaine, 14441);
});

check('BUDGET : dans le rouge, le « par jour » ne devient JAMAIS négatif', () => {
  /*
    Le défaut que ce contrôle existe pour empêcher : 50 € sur le compte, 300 €
    de prélèvements à venir. Une soustraction nue rendrait « -50 € par jour »,
    un chiffre qui se lit comme un budget alors qu'il décrit une dette. Le
    manque doit être dit comme un manque, et le dépensable rester à zéro.
  */
  const profile = profileOf('personnel-budget-avant-paie');
  const result = evaluateProfile(profile, {
    solde: 5000, aVenir: 0, prelevements: 30000, matelas: 0, jours: 5,
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.scope.reelDisponible, -25000);
  assert.equal(result.scope.manque, 25000, 'le manque est nommé');
  assert.equal(result.scope.depensable, 0);
  assert.equal(result.scope.parJour, 0, 'jamais un budget quotidien négatif');
  assert.equal(result.scope.parSemaine, 0);
});

check('BUDGET : le jour de la paie, zéro jour ne divise pas par zéro', () => {
  const profile = profileOf('personnel-budget-avant-paie');
  const result = evaluateProfile(profile, {
    solde: 20000, aVenir: 0, prelevements: 0, matelas: 0, jours: 0,
  });
  assert.deepEqual(result.errors, []);
  assert.ok(Number.isFinite(result.scope.parJour), 'pas d’infini');
  assert.equal(result.scope.parJour, 20000, 'ce qu’il reste EST ce qu’il reste');
});

check('BUDGET : la semaine ne dépasse pas ce qu’il reste', () => {
  // Quatre jours à tenir : une semaine n'en vaut pas sept, sinon l'écran
  // autorise à dépenser deux fois ce qui existe.
  const profile = profileOf('personnel-budget-avant-paie');
  const result = evaluateProfile(profile, {
    solde: 40000, aVenir: 0, prelevements: 0, matelas: 0, jours: 4,
  });
  assert.equal(result.scope.depensable, 40000);
  assert.equal(result.scope.parJour, 10000);
  assert.equal(result.scope.parSemaine, 40000, 'plafonné au dépensable');
});

/* --------------------------------------------------------------------------- */

/* --------------------------------------------------------------------------- */

function roundish(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} contrôle(s) en échec :`);
  for (const name of failures) console.error(`  - ${name}`);
  process.exit(1);
}
console.log(
  `\nMoteur de calcul : tous les contrôles passent ` +
    `(${CALC_PROFILES.length} profils métier, ${PERSONAL_CALC_PROFILES.length} personnel${PERSONAL_CALC_PROFILES.length > 1 ? 's' : ''}).`,
);
