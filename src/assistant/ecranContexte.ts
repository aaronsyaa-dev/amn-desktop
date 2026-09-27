import { useEffect } from 'react';
import type { GardeContexte } from '../shared/garde';
import { bureauDuChemin, ongletDuChemin } from '../bureaux/catalogue';
import { ESPACES } from '../bureaux/jetons';

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

/*
  L'ÉCRAN, toujours — pas seulement quand une fiche est ouverte. Sans lui, « sur quel écran je
  suis ? », « à quoi sert cette page ? » ou « comment j'ajoute un site ici ? » n'avaient aucun
  sens pour Ajmani. Le bureau et l'onglet viennent du catalogue des bureaux ; le titre de la page
  (son premier h1) précise l'écran exact. Rien d'autre : pas de contenu, pas de saisie.
*/
function ecranActuel(): string | null {
  if (typeof window === 'undefined') return null;
  const chemin = window.location.hash.replace(/^#/, '').split('?')[0] || '/';
  const bureau = bureauDuChemin(chemin);
  const espace = ESPACES.find((e) => e.key === (bureau ?? 'poste'))?.nom ?? 'Poste de travail';
  const onglet = bureau ? ongletDuChemin(bureau, chemin)?.ecran.nom : null;
  const titre = (typeof document !== 'undefined' ? document.querySelector('main h1, h1')?.textContent : null)?.replace(/\s+/g, ' ').trim().slice(0, 70) || null;
  return [espace, onglet, titre && titre !== onglet ? titre : null].filter(Boolean).join(' · ') + ` (${chemin})`;
}

export function contexteActuel(): GardeContexte | undefined {
  const focus = lireFocus();
  const ecran = ecranActuel();
  return focus || ecran ? { focus, ecran } : undefined;
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
