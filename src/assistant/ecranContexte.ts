import { useEffect } from 'react';
import type { GardeContexte } from '../shared/garde';

/**
 * LE CONTEXTE DE L'ÉCRAN — ce qu'Ajmani sait sans qu'on le lui dise (Ajmani partout, Bloc 1).
 *
 * « Résume-moi ce client » depuis la fiche d'AllStore doit fonctionner sans le nommer. Pour ça,
 * l'écran qui montre UNE fiche (un client, une tâche, un projet…) l'annonce ici en montant, et le
 * retire en démontant — jamais un texte libre, jamais une donnée qui ne soit pas déjà celle
 * affichée à l'écran. `AssistantContext` lit `lireFocus()` au moment d'envoyer un message ; c'est
 * tout ce module fait, sans dépendre de React lui-même côté lecture.
 *
 * Une pile, pas une valeur unique : une fiche peut s'ouvrir DANS un panneau pendant qu'une liste
 * reste affichée derrière (Clients : la liste à gauche, la fiche à droite). Le focus le plus
 * récemment posé est celui qui compte — le sommet de la pile.
 */
export interface FocusEcran {
  type: string;
  id: string;
  label: string;
}

let pile: FocusEcran[] = [];

export function lireFocus(): FocusEcran | null {
  return pile.length ? pile[pile.length - 1] : null;
}

export function contexteActuel(): GardeContexte | undefined {
  const focus = lireFocus();
  return focus ? { focus } : undefined;
}

/** Une fiche à l'écran annonce son focus tant qu'elle est montée ; il disparaît avec elle. */
export function useAjmaniFocus(focus: FocusEcran | null): void {
  useEffect(() => {
    if (!focus) return undefined;
    pile.push(focus);
    return () => {
      pile = pile.filter((f) => f !== focus);
    };
    // `focus` est reconstruit à chaque rendu par l'appelant : on ne compare que ses champs utiles,
    // pour ne pas ouvrir puis refermer le focus à chaque frappe dans un champ voisin de la fiche.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.type, focus?.id, focus?.label]);
}
