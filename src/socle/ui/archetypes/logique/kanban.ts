/**
 * LE KANBAN, SANS REACT — déplacer un ticket d'une colonne à l'autre, sans souris.
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Mode d'emploi : `deplacerElement(colonnes, cleElement, cle, vers, index?)` rend les colonnes après le
 * déplacement (une copie) et dit pourquoi il a été refusé s'il l'est (`limite` : la colonne est pleine ;
 * `inconnu` ; `identique` : rien ne change). C'est la fonction que l'appelant met dans son `onDeplacer` ; le menu
 * « Déplacer vers… » et le glisser-déposer de la souris passent tous deux par `Kanban`, qui n'appelle `onDeplacer`
 * que pour un déplacement permis. `indexDepot` dit à quel rang tombe un ticket lâché à la hauteur `y`.
 */

export interface ColonneLogique<T> {
  cle: string;
  elements: T[];
  /** Le nombre maximal d'éléments (limite de travaux en cours) ; absent = sans limite. */
  limite?: number;
}

export type RaisonRefus = 'limite' | 'inconnu' | 'identique';

export interface ResultatDeplacement<T> {
  colonnes: ColonneLogique<T>[];
  deplace: boolean;
  raison?: RaisonRefus;
}

/** Une colonne peut-elle recevoir un élément de plus ? Dans sa propre colonne, un élément ne fait que changer de rang. */
export function peutAccueillir(colonne: { elements: readonly unknown[]; limite?: number }, dejaDedans: boolean): boolean {
  if (dejaDedans || colonne.limite == null) return true;
  return colonne.elements.length < colonne.limite;
}

export function deplacerElement<T>(colonnes: readonly ColonneLogique<T>[], cleElement: (e: T) => string, cle: string, vers: string, index?: number): ResultatDeplacement<T> {
  const copie = colonnes.map((c) => ({ ...c, elements: [...c.elements] }));
  const source = copie.find((c) => c.elements.some((e) => cleElement(e) === cle));
  const cible = copie.find((c) => c.cle === vers);
  if (!source || !cible) return { colonnes: copie, deplace: false, raison: 'inconnu' };
  const dejaDedans = source === cible;
  if (!peutAccueillir(cible, dejaDedans)) return { colonnes: copie, deplace: false, raison: 'limite' };
  const ancien = source.elements.findIndex((e) => cleElement(e) === cle);
  const [element] = source.elements.splice(ancien, 1);
  let rang = index == null ? cible.elements.length : Math.max(0, Math.min(index, cible.elements.length + (dejaDedans ? 1 : 0)));
  // Retirer un élément placé avant le point d'insertion décale celui-ci d'un cran.
  if (dejaDedans && index != null && ancien < rang) rang -= 1;
  rang = Math.max(0, Math.min(rang, cible.elements.length));
  if (dejaDedans && rang === ancien) {
    source.elements.splice(ancien, 0, element);
    return { colonnes: copie, deplace: false, raison: 'identique' };
  }
  cible.elements.splice(rang, 0, element);
  return { colonnes: copie, deplace: true };
}

/** Où le ticket peut aller depuis sa colonne : les autres colonnes, avec « pleine » quand elles ne le peuvent pas. */
export function destinations<T>(colonnes: readonly ColonneLogique<T>[], cleElement: (e: T) => string, cle: string): { cle: string; pleine: boolean }[] {
  const depuis = colonnes.find((c) => c.elements.some((e) => cleElement(e) === cle));
  return colonnes.filter((c) => c !== depuis).map((c) => ({ cle: c.cle, pleine: !peutAccueillir(c, false) }));
}

/** Le rang d'un dépôt à la hauteur `y` : le nombre de tickets dont le milieu est au-dessus. */
export function indexDepot(milieux: readonly number[], y: number): number {
  let n = 0;
  for (const m of milieux) if (m < y) n += 1;
  return n;
}
