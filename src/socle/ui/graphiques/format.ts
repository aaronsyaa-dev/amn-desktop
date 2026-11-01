/**
 * LA MISE EN FORME FRANÇAISE DES CHIFFRES — pures fonctions, sans React.
 *
 * Règle A5 des écarts de maquettes : virgule décimale, espace insécable avant
 * `%` et `€`, séparateur de milliers insécable et fin. Jamais « 92% », jamais
 * « 3.8 », jamais un milliers qui se coupe en bout de ligne.
 *
 * Pourquoi pas `formatCents` de `src/lib/money.ts` : il parle en centimes et
 * laisse `Intl` choisir les espaces, donc le résultat suit la version d'ICU de
 * la machine (l'insécable ordinaire hier, l'insécable fine aujourd'hui). Ici
 * les espaces sont écrits une fois pour toutes ; `check:socle-graphiques`
 * vérifie que les deux disent la même chose sur des montants entiers.
 *
 * Les trois fonctions rendent « — » pour une valeur qui n'est pas un nombre
 * fini : un tiret se lit, un « NaN » ou un « Infinity » s'affiche fièrement.
 */

/** Espace insécable : devant `%` et `€`. */
export const ESPACE_INSECABLE = ' ';
/** Espace insécable fine : entre les milliers. */
export const ESPACE_FINE = ' ';
/** Ce qu'on affiche à la place d'un nombre qui n'en est pas un. */
export const TIRET_ABSENT = '—';

export interface OptionsNombre {
  /** Décimales au plus (défaut 2). */
  decimales?: number;
  /** Décimales au moins (défaut 0). */
  decimalesMin?: number;
}

const formateurs = new Map<string, Intl.NumberFormat>();

function formateur(max: number, min: number): Intl.NumberFormat {
  const cle = `${min}:${max}`;
  let f = formateurs.get(cle);
  if (!f) {
    f = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: true });
    formateurs.set(cle, f);
  }
  return f;
}

const entier = (n: number | undefined, defaut: number, borneMax: number): number =>
  n === undefined || !Number.isFinite(n) ? defaut : Math.min(borneMax, Math.max(0, Math.trunc(n)));

/** « 1 234,5 » — milliers en insécable fine, virgule décimale. */
export function formaterNombre(valeur: number, options: OptionsNombre = {}): string {
  if (typeof valeur !== 'number' || !Number.isFinite(valeur)) return TIRET_ABSENT;
  const max = entier(options.decimales, 2, 10);
  const min = Math.min(entier(options.decimalesMin, 0, 10), max);
  // Quelle que soit la version d'ICU, tous les blancs deviennent l'insécable fine.
  const texte = formateur(max, min).format(valeur).replace(/[\s\u00a0\u202f]/g, ESPACE_FINE);
  // Un petit négatif arrondi à zéro ne s'écrit pas « -0 ».
  return /^-0(,0*)?$/.test(texte) ? texte.slice(1) : texte;
}

/**
 * « 78 % » — prend un nombre DÉJÀ en pour cent (78, pas 0,78) et colle un
 * insécable devant le symbole.
 */
export function formaterPourcent(valeur: number, options: OptionsNombre = {}): string {
  if (typeof valeur !== 'number' || !Number.isFinite(valeur)) return TIRET_ABSENT;
  return `${formaterNombre(valeur, { decimales: 1, ...options })}${ESPACE_INSECABLE}%`;
}

/**
 * « 3 840 € » — prend des EUROS (pas des centimes). Sans décimales quand le
 * montant est rond, avec deux sinon (« 1 234,50 € »), sauf si `decimales` fixe
 * le nombre exact de décimales.
 */
export function formaterEuro(valeur: number, options: { decimales?: number } = {}): string {
  if (typeof valeur !== 'number' || !Number.isFinite(valeur)) return TIRET_ABSENT;
  const fixe = options.decimales;
  const rond = Math.abs(valeur - Math.round(valeur)) < 0.005;
  const decimales = fixe === undefined ? (rond ? 0 : 2) : fixe;
  return `${formaterNombre(valeur, { decimales, decimalesMin: decimales })}${ESPACE_INSECABLE}€`;
}
