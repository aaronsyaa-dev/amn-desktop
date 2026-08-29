/**
 * LA DISPOSITION DU GRAPHE DE NOTES
 * ═════════════════════════════════
 *
 * Module sans React ni DOM : `scripts/check-graphe.ts` l'éprouve directement.
 *
 * ## Pourquoi écrire une simulation plutôt que prendre une bibliothèque
 *
 * Une bibliothèque de graphes pèse plus lourd que tout le module Notes, et
 * celles qui font joli animent en continu — ce qui est exactement ce qu'on ne
 * veut pas d'un écran qu'on regarde pour COMPRENDRE quelque chose. Ici la
 * disposition est calculée une fois, en un nombre fixe de tours, et le
 * résultat ne bouge plus.
 *
 * ## Déterministe, et c'est une propriété, pas un détail
 *
 * Aucun aléatoire nulle part : les positions de départ sont posées sur un
 * cercle, dans l'ordre des notes. La même carte donne donc toujours le même
 * dessin — on la rouvre le lendemain et on retrouve ses repères. Un placement
 * aléatoire redessinerait tout à chaque ouverture, et il faudrait relire le
 * graphe entier à chaque fois pour retrouver la note qu'on cherchait.
 *
 * C'est aussi ce qui rend la disposition éprouvable : un contrôle peut affirmer
 * qu'un ensemble de notes donné produit telle forme.
 */

export interface NoeudPlace {
  readonly id: string;
  /** Entre 0 et 1, prêt à multiplier par la taille du dessin. */
  readonly x: number;
  readonly y: number;
  /** Combien de liens touchent ce nœud, entrants et sortants confondus. */
  readonly degre: number;
}

interface Position {
  x: number;
  y: number;
}

/**
 * Le nombre de tours de simulation.
 *
 * Trois cents suffisent à démêler quelques centaines de nœuds — au-delà, le
 * dessin ne bouge plus assez pour qu'on le voie, et on ferait attendre pour
 * rien un écran qui doit s'ouvrir tout de suite.
 */
export const TOURS = 300;

/** La distance de repos d'un lien, dans l'espace de travail de la simulation. */
const LONGUEUR_LIEN = 1;

/**
 * Dispose les nœuds d'un graphe par une simulation force-dirigée.
 *
 * DEUX forces, et rien de plus :
 *
 *   · les nœuds se REPOUSSENT tous, ce qui les étale ;
 *   · les liens TIRENT sur leurs deux extrémités, ce qui rapproche ce qui se
 *     cite.
 *
 * ## La troisième force qui a été retirée
 *
 * Le premier jet en avait une : un rappel vers le centre, justifié par « sans
 * lui, les grappes sans lien entre elles partiraient à l'infini et sortiraient
 * du cadre ».
 *
 * C'était faux, et la mutation l'a dit : le retirer ne faisait échouer aucun
 * contrôle. En cherchant pourquoi, `normaliser` ramène de toute façon tout
 * dans le cadre — donc la raison invoquée était déjà couverte ailleurs.
 *
 * Mesuré ensuite : le rappel déplaçait bel et bien les nœuds sur les grands
 * graphes creux, jusqu'à 5,7 % du cadre. Mais aucune propriété nommable ne
 * correspondait à ce déplacement — l'hypothèse suivante (« il évite une
 * couronne creuse ») s'est révélée fausse elle aussi à la mesure : 0,644 avec,
 * 0,639 sans.
 *
 * Une force qui change le résultat sans qu'on puisse dire ce qu'elle améliore
 * est un réglage qu'on n'osera plus toucher. Elle est donc partie.
 */
export function disposer(
  noeuds: ReadonlyArray<{ id: string }>,
  arcs: ReadonlyArray<{ de: string; vers: string }>,
  tours: number = TOURS,
): NoeudPlace[] {
  const n = noeuds.length;
  if (n === 0) return [];
  if (n === 1) return [{ id: noeuds[0].id, x: 0.5, y: 0.5, degre: 0 }];

  const index = new Map(noeuds.map((x, i) => [x.id, i]));
  const degre = new Array(n).fill(0);
  const liens: Array<[number, number]> = [];
  for (const a of arcs) {
    const i = index.get(a.de);
    const j = index.get(a.vers);
    if (i === undefined || j === undefined || i === j) continue;
    liens.push([i, j]);
    degre[i] += 1;
    degre[j] += 1;
  }

  /*
    DÉPART SUR UN CERCLE, dans l'ordre des notes.

    Pas d'aléatoire : c'est ce qui rend le dessin reproductible. Le cercle
    plutôt qu'une grille parce qu'aucun nœud n'y commence au centre — un nœud
    au centre exact ne subit aucune direction de répulsion nette et y reste
    coincé, ce qui donne une étoile au lieu d'un graphe.
  */
  const p: Position[] = noeuds.map((_, i) => ({
    x: Math.cos((2 * Math.PI * i) / n),
    y: Math.sin((2 * Math.PI * i) / n),
  }));

  const repulsion = 1 / Math.sqrt(n);

  for (let tour = 0; tour < tours; tour += 1) {
    // Le pas décroît : on démêle d'abord largement, on ajuste ensuite. Sans ça
    // la simulation oscille autour de sa solution sans jamais s'y poser.
    const pas = 0.1 * (1 - tour / tours);
    const dx = new Array(n).fill(0);
    const dy = new Array(n).fill(0);

    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        let ex = p[i].x - p[j].x;
        let ey = p[i].y - p[j].y;
        let d2 = ex * ex + ey * ey;
        if (d2 < 1e-6) {
          /*
            Deux nœuds exactement superposés n'ont aucune direction pour se
            séparer, et la division exploserait. On les écarte selon leurs
            indices — donc toujours de la même façon.
          */
          ex = (i % 2 === 0 ? 1 : -1) * 1e-3;
          ey = (j % 2 === 0 ? 1 : -1) * 1e-3;
          d2 = ex * ex + ey * ey;
        }
        const f = repulsion / d2;
        dx[i] += ex * f;
        dy[i] += ey * f;
        dx[j] -= ex * f;
        dy[j] -= ey * f;
      }
    }

    for (const [i, j] of liens) {
      const ex = p[j].x - p[i].x;
      const ey = p[j].y - p[i].y;
      const d = Math.hypot(ex, ey) || 1e-3;
      const f = (d - LONGUEUR_LIEN) * 0.1;
      dx[i] += (ex / d) * f;
      dy[i] += (ey / d) * f;
      dx[j] -= (ex / d) * f;
      dy[j] -= (ey / d) * f;
    }

    for (let i = 0; i < n; i += 1) {
      p[i].x += dx[i] * pas;
      p[i].y += dy[i] * pas;
    }
  }

  return normaliser(noeuds, p, degre);
}

/**
 * Ramène la disposition dans un carré de 0 à 1, marges comprises.
 *
 * L'écran n'a pas à connaître l'échelle de la simulation, et un graphe de
 * trois notes doit occuper la vue autant qu'un graphe de cent — sinon les
 * petits carnets s'affichent comme trois points au milieu du vide.
 */
function normaliser(
  noeuds: ReadonlyArray<{ id: string }>,
  p: readonly Position[],
  degre: readonly number[],
): NoeudPlace[] {
  const xs = p.map((q) => q.x);
  const ys = p.map((q) => q.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  // Une étendue nulle (tous alignés) donnerait une division par zéro : on les
  // pose alors au milieu de cet axe plutôt que de rendre `NaN`.
  const largeur = maxX - minX || 1;
  const hauteur = maxY - minY || 1;
  const MARGE = 0.06;
  const etendue = 1 - 2 * MARGE;

  return noeuds.map((noeud, i) => ({
    id: noeud.id,
    x: maxX === minX ? 0.5 : MARGE + ((p[i].x - minX) / largeur) * etendue,
    y: maxY === minY ? 0.5 : MARGE + ((p[i].y - minY) / hauteur) * etendue,
    degre: degre[i],
  }));
}

/**
 * Le rayon à donner à un nœud, d'après son degré.
 *
 * Une note vers laquelle tout converge doit se voir tout de suite : c'est
 * l'information que le graphe apporte et qu'aucune liste ne donne. La
 * progression est en racine carrée pour que dix liens ne fassent pas un disque
 * dix fois plus large — ce serait le seul objet visible de la carte.
 */
export function rayon(degre: number, base = 5, max = 16): number {
  return Math.min(max, base + Math.sqrt(degre) * 3);
}
