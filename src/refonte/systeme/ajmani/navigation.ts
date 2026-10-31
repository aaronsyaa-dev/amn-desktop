/**
 * LE PARCOURS AU CLAVIER DE LA PALETTE — logique pure, sans React.
 *
 * Le focus part du champ (`-1`). ↓ descend d'une cible à la suivante : les lignes de la réponse, puis les
 * boutons de la proposition, puis les lignes « OU LANCEZ » ; ↑ remonte ; ← → passent d'un bouton à l'autre ;
 * Tab fait le même parcours que ↓ (Maj+Tab que ↑) et ne sort jamais de la palette : après la dernière cible,
 * on revient au champ. Une cible désactivée (« Réservé aux administrateurs », hors ligne) est sautée.
 */

/** `lien` : « Effacer l'historique », atteignable au clavier comme le reste, après les lignes de la réponse. */
export type ZoneCible = 'reponse' | 'lien' | 'bouton' | 'lancer';

export interface Cible {
  zone: ZoneCible;
  id: string;
  desactivee?: boolean;
}

export type Direction = 'bas' | 'haut' | 'gauche' | 'droite';

/** Le champ de saisie. */
export const CHAMP = -1;

/** Rend le nouvel indice (`-1` : le champ) après une touche. */
export function deplacer(cibles: readonly Cible[], courant: number, direction: Direction): number {
  const libre = (i: number) => i >= 0 && i < cibles.length && !cibles[i].desactivee;
  if (direction === 'gauche' || direction === 'droite') {
    if (!libre(courant) || cibles[courant].zone !== 'bouton') return courant;
    const pas = direction === 'droite' ? 1 : -1;
    for (let i = courant + pas; i >= 0 && i < cibles.length; i += pas) {
      if (cibles[i].zone === 'bouton' && libre(i)) return i;
      if (cibles[i].zone !== 'bouton') break;
    }
    return courant;
  }
  const pas = direction === 'bas' ? 1 : -1;
  let i = courant + pas;
  while (i >= 0 && i < cibles.length && cibles[i].desactivee) i += pas;
  if (i >= 0 && i < cibles.length) return i;
  // Au bout du parcours : on retombe sur le champ ; du champ vers le haut, on repart par la fin.
  if (courant === CHAMP && direction === 'haut') {
    for (let j = cibles.length - 1; j >= 0; j -= 1) if (libre(j)) return j;
  }
  return CHAMP;
}

/** Après un changement de la liste des cibles, l'indice retenu reste valide (sinon on revient au champ). */
export function indiceValide(cibles: readonly Cible[], courant: number): number {
  return courant >= 0 && courant < cibles.length && !cibles[courant].desactivee ? courant : CHAMP;
}
