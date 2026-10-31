/**
 * LE CLAVIER ENTRE LES LIGNES, LES CARTES ET LES TICKETS — sans React.
 * ═════════════════════════════════════════════════════════════════════
 *
 * Mode d'emploi : chaque fonction reçoit où l'on est (un index, ou une colonne et un index) et la touche pressée
 * (`event.key`), et rend où aller — ou `null` si la touche n'est pas de son ressort (on ne fait alors pas de
 * `preventDefault`). Elles ne bouclent pas : on s'arrête au bord, ce qui laisse Tab sortir de la liste.
 * `deplacerDansGrille` sert à la grille de cartes ; `deplacerLineaire` aux lignes du tableau et à la liste
 * du scindé ; `voisinKanban` aux tickets. Le module n'importe rien.
 */

/** ↑ ↓ Début Fin PageHaut PageBas dans une liste de `total` éléments. */
export function deplacerLineaire(index: number, total: number, touche: string, pas = 10): number | null {
  if (total <= 0) return null;
  const dernier = total - 1;
  switch (touche) {
    case 'ArrowDown':
      return Math.min(index + 1, dernier);
    case 'ArrowUp':
      return Math.max(index - 1, 0);
    case 'Home':
      return 0;
    case 'End':
      return dernier;
    case 'PageDown':
      return Math.min(index + pas, dernier);
    case 'PageUp':
      return Math.max(index - pas, 0);
    default:
      return null;
  }
}

/** Combien de colonnes une grille affiche : les éléments de la première rangée partagent le même `top`. */
export function compterColonnes(tops: readonly number[], tolerance = 2): number {
  if (tops.length === 0) return 1;
  let n = 1;
  while (n < tops.length && Math.abs(tops[n] - tops[0]) <= tolerance) n += 1;
  return n;
}

/**
 * ← → ↑ ↓ dans une grille de `colonnes` colonnes remplie rangée après rangée. ↓ depuis une colonne qui n'existe pas
 * sur la dernière rangée (incomplète) va au dernier élément ; Début / Fin vont au bord de la rangée, avec Ctrl au
 * tout premier / tout dernier.
 */
export function deplacerDansGrille(index: number, total: number, colonnes: number, touche: string, ctrl = false): number | null {
  if (total <= 0) return null;
  const cols = Math.max(1, Math.floor(colonnes));
  const dernier = total - 1;
  const rangee = Math.floor(index / cols);
  const derniereRangee = Math.floor(dernier / cols);
  switch (touche) {
    case 'ArrowRight':
      return Math.min(index + 1, dernier);
    case 'ArrowLeft':
      return Math.max(index - 1, 0);
    case 'ArrowDown':
      if (index + cols <= dernier) return index + cols;
      return rangee < derniereRangee ? dernier : index;
    case 'ArrowUp':
      return index - cols >= 0 ? index - cols : index;
    case 'Home':
      return ctrl ? 0 : rangee * cols;
    case 'End':
      return ctrl ? dernier : Math.min(rangee * cols + cols - 1, dernier);
    default:
      return null;
  }
}

/** La place d'un élément dans une grille : sa rangée et sa colonne (à partir de 0). */
export function positionDansGrille(index: number, colonnes: number): { rangee: number; colonne: number } {
  const cols = Math.max(1, Math.floor(colonnes));
  return { rangee: Math.floor(index / cols), colonne: index % cols };
}

/** Les éléments rangés par rangées de `colonnes` : la dernière peut être incomplète. */
export function repartirEnRangees<T>(elements: readonly T[], colonnes: number): T[][] {
  const cols = Math.max(1, Math.floor(colonnes));
  const rangees: T[][] = [];
  for (let i = 0; i < elements.length; i += cols) rangees.push(elements.slice(i, i + cols));
  return rangees;
}

/**
 * Le nombre de colonnes d'une grille de cartes : `souhaitees` à partir de `seuil` px de large de fenêtre (1280),
 * deux en dessous (ou une, si on n'en voulait qu'une).
 */
export function nombreDeColonnes(souhaitees: number, largeurFenetre: number, seuil = 1280): number {
  const n = Math.max(1, Math.floor(souhaitees) || 1);
  return largeurFenetre >= seuil ? n : Math.min(n, 2);
}

export interface PositionKanban {
  colonne: number;
  index: number;
}

/**
 * Entre les tickets d'un tableau : ↑ ↓ dans la colonne, ← → vers la colonne voisine qui a des tickets (au même rang,
 * ou le dernier si elle en a moins). `tailles` = le nombre de tickets de chaque colonne, dans l'ordre d'affichage.
 */
export function voisinKanban(tailles: readonly number[], pos: PositionKanban, touche: string): PositionKanban | null {
  const taille = tailles[pos.colonne] ?? 0;
  switch (touche) {
    case 'ArrowDown':
      return { colonne: pos.colonne, index: Math.min(pos.index + 1, Math.max(0, taille - 1)) };
    case 'ArrowUp':
      return { colonne: pos.colonne, index: Math.max(pos.index - 1, 0) };
    case 'Home':
      return { colonne: pos.colonne, index: 0 };
    case 'End':
      return { colonne: pos.colonne, index: Math.max(0, taille - 1) };
    case 'ArrowRight':
    case 'ArrowLeft': {
      const pas = touche === 'ArrowRight' ? 1 : -1;
      for (let c = pos.colonne + pas; c >= 0 && c < tailles.length; c += pas) {
        if (tailles[c] > 0) return { colonne: c, index: Math.min(pos.index, tailles[c] - 1) };
      }
      return pos;
    }
    default:
      return null;
  }
}
