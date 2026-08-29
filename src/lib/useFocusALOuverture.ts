import { useEffect, useRef } from 'react';

/**
 * LE FOCUS ENTRE DANS LA FENÊTRE QUI VIENT DE S'OUVRIR.
 *
 * Une fenêtre qui s'ouvre sans prendre le focus laisse la personne au clavier
 * DERRIÈRE le voile : elle tabule dans une page qu'elle ne voit plus, sur des
 * liens qu'elle peut activer d'un appui sur Entrée, et rien ne lui dit où elle
 * est. Le piège de `pileCalques.ts` ne peut pas la rattraper — il retient le
 * focus une fois qu'il est entré, il ne l'y fait pas entrer.
 *
 * Le délai de soixante millisecondes n'est pas une superstition : la fenêtre
 * arrive avec une transition d'entrée, et un `focus()` posé sur un élément
 * encore à `opacity: 0` est ignoré par certains navigateurs. Soixante
 * millisecondes passent après la première image, avant que qui que ce soit ait
 * eu le temps d'appuyer sur une touche.
 *
 * Le conteneur doit porter `tabIndex={-1}` : sans lui il n'est pas focusable,
 * et l'appel ne fait rien. Il porte aussi `outline-none`, parce qu'on ne veut
 * pas d'un anneau autour de toute la fenêtre — l'anneau, c'est pour ce qu'on
 * vise, et ici on ne fait qu'entrer.
 *
 * Rend la `ref` à poser sur le conteneur. S'il y a un champ à remplir, un
 * `autoFocus` dessus est encore mieux : on entre directement là où l'on va
 * écrire. Ce crochet est pour les fenêtres qui n'en ont pas.
 */
export function useFocusALOuverture<T extends HTMLElement = HTMLDivElement>(actif = true) {
  const cible = useRef<T | null>(null);
  useEffect(() => {
    if (!actif) return;
    const t = window.setTimeout(() => cible.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [actif]);
  return cible;
}
