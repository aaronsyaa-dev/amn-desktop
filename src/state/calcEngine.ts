import { roundHalfAwayFromZero } from '../lib/money';

/**
 * Moteur de calcul paramétrable — la fondation du générateur (BLOC A).
 *
 * ## Le problème qu'il résout
 *
 * Chaque métier a « sa » calculatrice : un prix client en e-commerce, un seuil
 * de rentabilité en événementiel, une répartition de parts dans une startup.
 * Les coder une par une donne trois écrans qui font la même chose avec des
 * noms différents, et un quatrième métier demande un quatrième écran.
 *
 * Ici, un calculateur est une **donnée** : des entrées nommées, des étapes de
 * calcul, des sorties. Le moteur ne connaît aucun métier. En ajouter un est un
 * travail de configuration — c'est le test de la généricité, et c'est aussi ce
 * qui permet de le vérifier : `npm run check:calc` valide TOUS les profils
 * déclarés, sans rien savoir d'eux.
 *
 * Même principe que `projectEngine.ts`, où un profil métier est déjà une
 * configuration et non du code.
 *
 * ## Pourquoi pas `eval`
 *
 * Une formule est du texte, et le but est qu'elle puisse un jour venir d'une
 * configuration éditée dans l'application. `eval` ou `new Function` en ferait
 * une exécution de code arbitraire dans le rendu — la porte grande ouverte, et
 * pour un gain nul : l'arithmétique dont on a besoin tient dans une centaine
 * de lignes lisibles.
 *
 * ## L'ordre plutôt qu'un graphe
 *
 * Une étape ne voit QUE les entrées et les étapes qui la précèdent. Les cycles
 * sont donc impossibles par construction — pas de détection de dépendance
 * circulaire à écrire, donc pas de détection à déboguer. C'est la
 * simplification qui garde ce fichier court.
 */

/* --------------------------------- Domaine -------------------------------- */

/**
 * La nature d'une valeur. Elle décide de deux choses, et de deux seulement :
 * comment on l'affiche, et si le résultat est arrondi au centime.
 */
export type CalcKind = 'money' | 'percent' | 'number';

export interface CalcInput {
  key: string;
  label: string;
  kind: CalcKind;
  /** Valeur de départ. En centimes pour `money`, en points pour `percent`. */
  defaultValue: number;
  /** Une phrase qui dit d'où vient ce chiffre — jamais un simple synonyme du libellé. */
  help?: string;
}

export interface CalcStep {
  key: string;
  label: string;
  /** Arithmétique sur les entrées et les étapes PRÉCÉDENTES. Voir `evaluate`. */
  formula: string;
  kind: CalcKind;
  /** Affichée comme résultat. Une étape non marquée reste un intermédiaire. */
  output?: boolean;
  help?: string;
}

export interface CalcProfile {
  id: string;
  label: string;
  /** Ce que ce calculateur répond, en une phrase. */
  description: string;
  inputs: CalcInput[];
  steps: CalcStep[];
}

/* ------------------------------ L'évaluateur ------------------------------- */

type Token =
  | { t: 'num'; v: number }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string }
  | { t: 'fn'; v: string }
  | { t: 'paren'; v: '(' | ')' }
  | { t: 'comma' };

/** Les seules fonctions admises. Volontairement peu : voir l'en-tête du fichier. */
const FUNCTIONS: Record<string, (args: number[]) => number> = {
  min: (a) => Math.min(...a),
  max: (a) => Math.max(...a),
  abs: (a) => Math.abs(a[0]),
  round: (a) => roundHalfAwayFromZero(a[0]),
};

/**
 * Combien d'arguments chaque fonction consomme.
 *
 * Déclaré plutôt que deviné : c'est ce qui permet de vérifier la FORME d'une
 * formule sans l'exécuter (voir `assertWellFormed`).
 */
const ARITY: Record<string, number> = { min: 2, max: 2, abs: 1, round: 1 };

const PRECEDENCE: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };

export class CalcError extends Error {}

/**
 * Dépile le sommet de la pile de l'algorithme de tri.
 *
 * Chaque appel est déjà gardé par un `stack.length` — le jet est théoriquement
 * inatteignable. Il existe pour ne pas écrire d'assertion non-nulle : si un jour
 * une garde saute à la relecture, l'erreur porte un nom au lieu de laisser un
 * `undefined` traverser silencieusement l'évaluateur.
 */
function popTop(stack: Token[]): Token {
  const top = stack.pop();
  if (!top) throw new CalcError('Expression malformée');
  return top;
}

/** Découpe une formule. Rejette tout caractère hors de l'arithmétique admise. */
export function tokenize(formula: string): Token[] {
  const src = String(formula ?? '');
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const match = /^[0-9]*\.?[0-9]+/.exec(src.slice(i));
      if (!match) throw new CalcError(`Nombre invalide dans « ${formula} »`);
      out.push({ t: 'num', v: Number(match[0]) });
      i += match[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
      if (!match) throw new CalcError(`Identifiant invalide dans « ${formula} »`);
      const name = match[0];
      i += name.length;
      // Un identifiant suivi d'une parenthèse est un appel de fonction.
      if (src.slice(i).trimStart().startsWith('(')) {
        if (!FUNCTIONS[name]) throw new CalcError(`Fonction inconnue : ${name}`);
        out.push({ t: 'fn', v: name });
      } else {
        out.push({ t: 'id', v: name });
      }
      continue;
    }
    if (c === '(' || c === ')') {
      out.push({ t: 'paren', v: c });
      i += 1;
      continue;
    }
    if (c === ',') {
      out.push({ t: 'comma' });
      i += 1;
      continue;
    }
    if (PRECEDENCE[c] !== undefined) {
      out.push({ t: 'op', v: c });
      i += 1;
      continue;
    }
    throw new CalcError(`Caractère interdit « ${c} » dans « ${formula} »`);
  }
  return out;
}

/**
 * Notation polonaise inverse, par l'algorithme de la gare de triage.
 *
 * Le moins UNAIRE est traité ici, à la lecture : `-x` et `3 * -2` sont des
 * écritures naturelles, et les refuser obligerait à écrire `0 - x` dans chaque
 * profil.
 */
export function toRpn(tokens: Token[]): Token[] {
  const out: Token[] = [];
  const stack: Token[] = [];
  let previous: Token | null = null;

  for (const token of tokens) {
    const unary =
      token.t === 'op' &&
      token.v === '-' &&
      (previous === null ||
        previous.t === 'op' ||
        previous.t === 'comma' ||
        (previous.t === 'paren' && previous.v === '('));

    if (token.t === 'num' || token.t === 'id') {
      out.push(token);
    } else if (unary) {
      // `-x` devient `0 - x` : une seule règle à comprendre au lieu d'un
      // opérateur unaire à faire vivre dans tout l'évaluateur.
      out.push({ t: 'num', v: 0 });
      stack.push({ t: 'op', v: '-' });
    } else if (token.t === 'fn') {
      stack.push(token);
    } else if (token.t === 'comma') {
      while (stack.length && !(stack[stack.length - 1].t === 'paren')) out.push(popTop(stack));
      if (!stack.length) throw new CalcError('Virgule hors d’un appel de fonction');
    } else if (token.t === 'op') {
      while (stack.length) {
        const top = stack[stack.length - 1];
        if (top.t === 'op' && PRECEDENCE[top.v] >= PRECEDENCE[token.v]) out.push(popTop(stack));
        else break;
      }
      stack.push(token);
    } else if (token.v === '(') {
      stack.push(token);
    } else {
      while (stack.length && !(stack[stack.length - 1].t === 'paren')) out.push(popTop(stack));
      if (!stack.length) throw new CalcError('Parenthèse fermante sans ouvrante');
      stack.pop();
      if (stack.length && stack[stack.length - 1].t === 'fn') out.push(popTop(stack));
    }
    previous = token;
  }

  while (stack.length) {
    const top = popTop(stack);
    if (top.t === 'paren') throw new CalcError('Parenthèse ouvrante jamais fermée');
    out.push(top);
  }
  return out;
}

/**
 * Vérifie la FORME d'une expression, sans l'évaluer.
 *
 * Simule la profondeur de pile : chaque valeur en empile une, chaque opérateur
 * en consomme deux et en rend une. Une expression correcte finit à exactement
 * une valeur.
 *
 * Nécessaire parce que « a + » est parfaitement TOKENISABLE : sans ce
 * contrôle, une formule tronquée passait la validation d'un profil et
 * n'échouait qu'à l'ouverture de l'écran, chez l'utilisateur.
 */
function assertWellFormed(rpn: Token[], formula: string): void {
  let depth = 0;
  for (const token of rpn) {
    if (token.t === 'num' || token.t === 'id') {
      depth += 1;
    } else if (token.t === 'fn') {
      const need = ARITY[token.v] ?? 1;
      if (depth < need) throw new CalcError(`Arguments manquants pour ${token.v}() dans « ${formula} »`);
      depth -= need - 1;
    } else if (token.t === 'op') {
      if (depth < 2) throw new CalcError(`Formule incomplète : « ${formula} »`);
      depth -= 1;
    }
  }
  if (depth !== 1) throw new CalcError(`Formule mal formée : « ${formula} »`);
}

/** La forme compilée d'une formule : RPN vérifié. */
export function compileFormula(formula: string): Token[] {
  const rpn = toRpn(tokenize(formula));
  assertWellFormed(rpn, formula);
  return rpn;
}

/**
 * Évalue une formule dans une portée donnée.
 *
 * Lève une `CalcError` nommée plutôt que de rendre `NaN` : un `NaN` se propage
 * silencieusement jusqu'à un prix affiché « NaN € », et personne ne sait
 * quelle étape l'a produit.
 */
export function evaluateFormula(formula: string, scope: Record<string, number>): number {
  const rpn = compileFormula(formula);
  const stack: number[] = [];

  for (const token of rpn) {
    if (token.t === 'num') {
      stack.push(token.v);
    } else if (token.t === 'id') {
      if (!(token.v in scope)) throw new CalcError(`Valeur inconnue : ${token.v}`);
      stack.push(scope[token.v]);
    } else if (token.t === 'fn') {
      // Les fonctions admises prennent au plus deux arguments ; on dépile ce
      // qui reste, ce qui suffit tant que la liste reste courte.
      const args = stack.splice(-(ARITY[token.v] ?? 1));
      if (args.length === 0) throw new CalcError(`Argument manquant pour ${token.v}()`);
      stack.push(FUNCTIONS[token.v](args));
    } else if (token.t === 'op') {
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) throw new CalcError(`Formule incomplète : « ${formula} »`);
      if (token.v === '+') stack.push(a + b);
      else if (token.v === '-') stack.push(a - b);
      else if (token.v === '*') stack.push(a * b);
      else {
        // Division par zéro : refusée en clair. `Infinity` traverserait tout le
        // calcul et ressortirait en « ∞ € » sans indiquer l'étape fautive.
        if (b === 0) throw new CalcError(`Division par zéro dans « ${formula} »`);
        stack.push(a / b);
      }
    }
  }

  if (stack.length !== 1) throw new CalcError(`Formule mal formée : « ${formula} »`);
  const result = stack[0];
  if (!Number.isFinite(result)) throw new CalcError(`Résultat non calculable : « ${formula} »`);
  return result;
}

/* ------------------------------ Les profils -------------------------------- */

export interface CalcLine {
  key: string;
  label: string;
  kind: CalcKind;
  value: number;
  output: boolean;
  help?: string;
}

export interface CalcResult {
  /** Toutes les valeurs calculées, entrées comprises. */
  scope: Record<string, number>;
  /** Les étapes, dans l'ordre de déclaration. */
  lines: CalcLine[];
  /** Ce qui n'a pas pu être calculé, avec la raison. Jamais silencieux. */
  errors: { key: string; message: string }[];
}

/**
 * Déroule un profil.
 *
 * Une étape en échec n'interrompt pas les suivantes : elle est signalée et
 * retirée de la portée, ce qui fait échouer proprement celles qui en dépendent
 * — plutôt que de laisser un calcul entier disparaître à cause d'une case vide.
 */
export function evaluateProfile(
  profile: CalcProfile,
  values: Record<string, number> = {},
): CalcResult {
  const scope: Record<string, number> = {};
  const errors: { key: string; message: string }[] = [];

  for (const input of profile.inputs) {
    const raw = values[input.key];
    scope[input.key] = Number.isFinite(raw) ? raw : input.defaultValue;
  }

  const lines: CalcLine[] = [];
  for (const step of profile.steps) {
    try {
      const raw = evaluateFormula(step.formula, scope);
      // L'argent est arrondi au centime À CHAQUE étape, comme une ligne de
      // facture (voir `lineAmounts` dans money.ts) : arrondir seulement à la
      // fin ferait diverger le détail affiché de son total.
      const value = step.kind === 'money' ? roundHalfAwayFromZero(raw) : raw;
      scope[step.key] = value;
      lines.push({
        key: step.key,
        label: step.label,
        kind: step.kind,
        value,
        output: Boolean(step.output),
        help: step.help,
      });
    } catch (err) {
      errors.push({ key: step.key, message: err instanceof Error ? err.message : String(err) });
    }
  }

  return { scope, lines, errors };
}

/**
 * Valide un profil SANS l'exécuter.
 *
 * C'est ce qui rend la promesse « déclarer un calculateur sans toucher au
 * moteur » vérifiable : le contrôle passe tous les profils là-dedans, donc une
 * formule qui référence une entrée inexistante se voit à la seconde où elle
 * est écrite, pas le jour où quelqu'un ouvre l'écran.
 */
export function validateProfile(profile: CalcProfile): string[] {
  const problems: string[] = [];
  const known = new Set<string>();

  for (const input of profile.inputs) {
    if (known.has(input.key)) problems.push(`Entrée en double : ${input.key}`);
    known.add(input.key);
  }

  for (const step of profile.steps) {
    if (known.has(step.key)) problems.push(`Clé en double : ${step.key}`);
    let tokens: Token[];
    try {
      tokens = tokenize(step.formula);
      // `compileFormula` et non `toRpn` seul : « a + » est tokenisable et
      // se réorganise sans broncher — seule la vérification de forme l'attrape.
      compileFormula(step.formula);
    } catch (err) {
      problems.push(`${step.key} : ${err instanceof Error ? err.message : String(err)}`);
      known.add(step.key);
      continue;
    }
    for (const token of tokens) {
      if (token.t === 'id' && !known.has(token.v)) {
        // Une étape ne voit que ce qui la précède : nommer une étape ultérieure
        // est la seule façon d'écrire un cycle, et c'est refusé ici.
        problems.push(`${step.key} : « ${token.v} » n’est pas défini avant cette étape`);
      }
    }
    known.add(step.key);
  }

  if (!profile.steps.some((s) => s.output)) {
    problems.push(`${profile.id} : aucune étape marquée comme sortie`);
  }
  return problems;
}

/** Les seules lignes à montrer en tête : les résultats. */
export function outputsOf(result: CalcResult): CalcLine[] {
  return result.lines.filter((line) => line.output);
}
