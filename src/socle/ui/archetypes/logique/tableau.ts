/**
 * LE TABLEAU, SANS REACT — tri stable, `aria-sort`, recherche, regroupement.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Mode d'emploi : `trierLignes(lignes, tri, valeur)` rend une copie triée (jamais d'effet de bord) ; deux lignes
 * égales gardent leur ordre d'origine. `prochainTri(tri, cle)` fait tourner « sans tri → croissant → décroissant →
 * sans tri » et `ariaSort(cle, tri)` dit la valeur de `aria-sort` de chaque colonne. Les valeurs vides vont
 * toujours en bas, dans les deux sens. Le module n'importe rien : `check:socle-archetypes` le charge tel quel.
 */

export type Sens = 'asc' | 'desc';
export interface TriTableau {
  cle: string;
  sens: Sens;
}
export type ValeurTri = string | number | boolean | Date | null | undefined;
export type AriaSort = 'ascending' | 'descending' | 'none';

export function ariaSort(cle: string, tri: TriTableau | null): AriaSort {
  if (!tri || tri.cle !== cle) return 'none';
  return tri.sens === 'asc' ? 'ascending' : 'descending';
}

/** Un clic sur l'en-tête : sans tri → croissant → décroissant → sans tri. Une autre colonne repart du croissant. */
export function prochainTri(tri: TriTableau | null, cle: string): TriTableau | null {
  if (!tri || tri.cle !== cle) return { cle, sens: 'asc' };
  return tri.sens === 'asc' ? { cle, sens: 'desc' } : null;
}

const collateurs = new Map<string, Intl.Collator>();
function collateur(locale: string): Intl.Collator {
  let c = collateurs.get(locale);
  if (!c) {
    c = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
    collateurs.set(locale, c);
  }
  return c;
}

export const estVide = (v: ValeurTri): v is null | undefined => v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) || v === '';

/** Compare deux valeurs non vides : nombres et dates par valeur, texte à l'usage de la langue (accents ignorés, « 2 » avant « 10 »). */
export function comparerValeurs(a: ValeurTri, b: ValeurTri, locale = 'fr-FR'): number {
  if (a instanceof Date || b instanceof Date) return (a instanceof Date ? a.getTime() : Number(a)) - (b instanceof Date ? b.getTime() : Number(b));
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return collateur(locale).compare(String(a), String(b));
}

/** Une copie triée de `lignes`. Stable : à valeurs égales, l'ordre d'origine est gardé ; les valeurs vides restent en bas. */
export function trierLignes<L>(lignes: readonly L[], tri: TriTableau | null, valeur: (ligne: L, cle: string) => ValeurTri, locale = 'fr-FR'): L[] {
  if (!tri) return [...lignes];
  const sens = tri.sens === 'asc' ? 1 : -1;
  return lignes
    .map((ligne, rang) => ({ ligne, rang, v: valeur(ligne, tri.cle) }))
    .sort((x, y) => {
      const vx = estVide(x.v);
      const vy = estVide(y.v);
      if (vx || vy) return vx && vy ? x.rang - y.rang : vx ? 1 : -1;
      return comparerValeurs(x.v, y.v, locale) * sens || x.rang - y.rang;
    })
    .map((x) => x.ligne);
}

/** Minuscules sans accents : « Éléonore » se trouve en tapant « eleo ». */
export function normaliserTexte(texte: string): string {
  return texte.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Les lignes dont le texte contient tous les mots tapés (dans n'importe quel ordre). Rien de tapé : tout. */
export function filtrerLignes<L>(lignes: readonly L[], saisie: string, texteDe: (ligne: L) => string): L[] {
  const mots = normaliserTexte(saisie).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return [...lignes];
  return lignes.filter((l) => {
    const t = normaliserTexte(texteDe(l));
    return mots.every((m) => t.includes(m));
  });
}

export interface Groupe<L> {
  cle: string;
  lignes: L[];
}

/**
 * Regroupe en gardant l'ordre : les groupes dans l'ordre de leur première ligne (ou celui de `ordre` pour ceux qui y
 * figurent, en tête), et dans chaque groupe l'ordre des lignes reçues — donc le tri déjà appliqué.
 */
export function regrouperLignes<L>(lignes: readonly L[], cleGroupe: (ligne: L) => string, ordre: readonly string[] = []): Groupe<L>[] {
  const parCle = new Map<string, L[]>();
  for (const l of lignes) {
    const k = cleGroupe(l);
    const liste = parCle.get(k);
    if (liste) liste.push(l);
    else parCle.set(k, [l]);
  }
  const connus = ordre.filter((k) => parCle.has(k));
  const autres = [...parCle.keys()].filter((k) => !connus.includes(k));
  return [...connus, ...autres].map((cle) => ({ cle, lignes: parCle.get(cle) as L[] }));
}
