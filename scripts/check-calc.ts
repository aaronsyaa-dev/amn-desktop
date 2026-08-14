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
interface Profile {
  id: string;
  label: string;
  description: string;
  inputs: { key: string; label: string; kind: Kind; defaultValue: number; help?: string }[];
  steps: { key: string; label: string; kind: Kind; formula: string; output?: boolean; help?: string }[];
}
interface Result {
  scope: Record<string, number>;
  lines: { key: string; label: string; kind: Kind; value: number; output: boolean }[];
  errors: { key: string; message: string }[];
}
interface EngineModule {
  evaluateFormula(formula: string, scope: Record<string, number>): number;
  evaluateProfile(profile: Profile, values?: Record<string, number>): Result;
  validateProfile(profile: Profile): string[];
  outputsOf(result: Result): Result['lines'];
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

const { evaluateFormula, evaluateProfile, validateProfile, outputsOf, tokenize } =
  await loadFromSrc<EngineModule>('src/state/calcEngine.ts');
const { CALC_PROFILES, DEFAULT_CALC_PROFILE_ID, calcProfileById } =
  await loadFromSrc<ProfilesModule>('src/state/calcProfiles.ts');
const { distributeCents, monthlySummary, recentMonths, monthOfDay } =
  await loadFromSrc<SplitModule>('src/state/monthlySplit.ts');

/**
 * Le profil, ou un échec net.
 *
 * Un profil renommé ne doit pas faire remonter « impossible de lire "steps" de
 * undefined » depuis le fond d'un test : le nom manquant est l'information.
 */
function profileOf(id: string): Profile {
  const found = calcProfileById(id);
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
  for (const profile of CALC_PROFILES) {
    const problems = validateProfile(profile);
    assert.deepEqual(problems, [], `${profile.id} : ${problems.join(' · ')}`);
  }
});

check('chaque profil a une identité et des libellés utilisables', () => {
  const ids = new Set<string>();
  for (const profile of CALC_PROFILES) {
    assert.ok(profile.id && !ids.has(profile.id), `id manquant ou en double : ${profile.id}`);
    ids.add(profile.id);
    assert.ok(profile.label.length > 0, `${profile.id} sans libellé`);
    assert.ok(profile.description.length > 20, `${profile.id} : description trop courte`);
    for (const input of profile.inputs) assert.ok(input.label.length > 0, `${profile.id}/${input.key}`);
    for (const step of profile.steps) assert.ok(step.label.length > 0, `${profile.id}/${step.key}`);
  }
  assert.ok(calcProfileById(DEFAULT_CALC_PROFILE_ID), 'le profil par défaut existe');
  assert.equal(calcProfileById('inexistant'), undefined);
});

check('tout profil se déroule sur ses valeurs par défaut, sans erreur', () => {
  // Un profil dont les valeurs par défaut plantent accueillerait l'utilisateur
  // par un écran d'erreurs à la première ouverture.
  for (const profile of CALC_PROFILES) {
    const result = evaluateProfile(profile);
    assert.deepEqual(result.errors, [], `${profile.id} : ${JSON.stringify(result.errors)}`);
    assert.ok(outputsOf(result).length > 0, `${profile.id} sans sortie`);
    for (const line of result.lines) {
      assert.ok(Number.isFinite(line.value), `${profile.id}/${line.key} → ${line.value}`);
    }
  }
});

check('aucun profil ne casse quand TOUTES les entrées sont à zéro', () => {
  // Le cas réel : un formulaire fraîchement vidé. Il doit rendre des chiffres
  // ou des erreurs nommées, jamais un NaN ni une exception qui remonte.
  for (const profile of CALC_PROFILES) {
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
  assert.ok(Math.abs(r.scope.seuilEntrees - 89.887) < 0.01, String(r.scope.seuilEntrees));
  assert.equal(r.scope.margeSalleComble, 2225 * 200 - 200000);
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

/* --------------------------------------------------------------------------- */

function roundish(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} contrôle(s) en échec :`);
  for (const name of failures) console.error(`  - ${name}`);
  process.exit(1);
}
console.log(`\nMoteur de calcul : tous les contrôles passent (${CALC_PROFILES.length} profils validés).`);
