import { useEffect, useRef } from 'react';
import { inscrireCalque } from './pileCalques';

/**
 * ÉCHAP FERME LE CALQUE DU DESSUS — ET LUI SEUL
 * ═════════════════════════════════════════════
 *
 * ## Ce que ça répare
 *
 * Vingt calques de l'application — formulaires en modale, panneaux, tiroirs,
 * menus — se fermaient au clic sur leur fond et **ne répondaient pas à Échap**.
 * Neuf autres l'écoutaient déjà : la convention existait dans un tiers du
 * produit et manquait dans les deux autres tiers.
 *
 * Mesuré au navigateur avant correctif, en ouvrant chaque calque atteignable
 * et en appuyant sur Échap : neuf calques sur l'édition cliente, **zéro** ne
 * se fermait.
 *
 * À la souris on clique à côté, et on ne voit rien. Au clavier il faut tabuler
 * jusqu'à la croix — à travers tous les champs du formulaire, et quand elle
 * existe. C'est le geste le plus universel de toute interface, et celui qu'on
 * fait par réflexe après s'être trompé de bouton.
 *
 * ## Ce fichier ne fait que BRANCHER
 *
 * La règle — « un appui, un calque, dans l'ordre inverse de l'ouverture » —
 * vit dans `pileCalques.ts`, sans React, donc éprouvable hors application.
 * C'est une propriété d'exécution : aucun contrôle statique ne peut la voir,
 * et elle a survécu à une mutation du garde-fou de clavier avant d'être
 * séparée.
 *
 * ## Le piège qui rendrait la pile fausse
 *
 * `fermer` est presque toujours une lambda écrite dans le JSX, donc une
 * fonction NEUVE à chaque rendu. La mettre dans les dépendances de l'effet
 * ferait, à chaque rendu du parent, un désarmement suivi d'un réarmement — et
 * le calque remonterait au sommet de la pile alors qu'il n'est pas le dernier
 * ouvert. Échap fermerait alors celui du dessous.
 *
 * D'où la référence : l'effet ne dépend que de `ouvert`, et lit toujours la
 * version courante de `fermer` au moment de l'appui.
 */
export function useFermetureEchap(ouvert: boolean, fermer: () => void): void {
  const dernier = useRef(fermer);
  dernier.current = fermer;

  useEffect(() => {
    if (!ouvert) return undefined;
    // Une identité stable tant que le calque reste ouvert, quel que soit le
    // nombre de rendus du parent — c'est elle qui tient la place dans la pile.
    return inscrireCalque(() => dernier.current());
  }, [ouvert]);
}
