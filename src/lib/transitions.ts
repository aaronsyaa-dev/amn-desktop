import type { Variants } from 'framer-motion';
import { PAGE_ROOMS } from '@edition/modules';

/**
 * Shared motion vocabulary. Each screen owns a "room-change" entrance (a
 * distinct direction/feel per tab) plus an internal stagger so its sections
 * cascade in rather than appearing all at once. Kept quick — presence, not
 * theatrics.
 */

export const EASE = [0.16, 1, 0.3, 1] as const;

/** Per-route page entrance. The direction differs so tabs feel like rooms. */
export const pageVariants: Record<string, Variants> = {
  'accueil': {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
  },
  'registre': {
    initial: { opacity: 0, x: 18 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: EASE } },
    exit: { opacity: 0, x: -12, transition: { duration: 0.15 } },
  },
  'fil': {
    initial: { opacity: 0, scale: 0.985 },
    animate: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: EASE } },
    exit: { opacity: 0, scale: 0.99, transition: { duration: 0.15 } },
  },
  'fiches': {
    initial: { opacity: 0, x: -18 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: EASE } },
    exit: { opacity: 0, x: 12, transition: { duration: 0.15 } },
  },
  'supervision': {
    initial: { opacity: 0, y: -14 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
    exit: { opacity: 0, y: 10, transition: { duration: 0.15 } },
  },
  'analyse': {
    initial: { opacity: 0, y: -14 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: EASE } },
    exit: { opacity: 0, y: 10, transition: { duration: 0.15 } },
  },
  'tableau': {
    initial: { opacity: 0, y: 16, scale: 0.99 },
    animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.3, ease: EASE } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.15 } },
  },
  'journal': {
    initial: { opacity: 0, x: 20, scale: 0.99 },
    animate: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.32, ease: EASE } },
    exit: { opacity: 0, x: -14, transition: { duration: 0.15 } },
  },
  'base': {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: EASE } },
    exit: { opacity: 0, x: 14, transition: { duration: 0.15 } },
  },
  'livrables': {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: EASE } },
    exit: { opacity: 0, x: 14, transition: { duration: 0.15 } },
  },
  'reglages': {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
  },
  'coffre': {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
  },
};

/**
 * Entrée de page pour une route.
 *
 * La correspondance route → « pièce » vit dans `@edition/modules` : garder ici
 * une liste de chemins codés en dur remettait `/tracker`, `/scanner` et
 * `/decisions` dans le bundle Business, pour des écrans qui n'y existent pas.
 * Les variantes elles-mêmes sont nommées par leur ressenti, pas par le module
 * qui les utilise.
 */
export function variantsForPath(pathname: string): Variants {
  for (const [prefix, room] of PAGE_ROOMS) {
    if (pathname.startsWith(prefix)) return pageVariants[room] ?? pageVariants.accueil;
  }
  return pageVariants.accueil;
}

/** Container that cascades its direct <StaggerItem> children. */
export const staggerContainer: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
};

/*
  LES LISTES LONGUES NE S'ANIMENT QUE PAR LEUR TÊTE (simulation S2, un an d'historique).

  Chaque élément animé en cascade s'inscrit auprès de son parent, qui retrie
  ses enfants par position dans le document : un coût quadratique. Mesuré sur
  1 745 factures : l'écran Facturation mettait 166 s à s'afficher, dont une
  tâche bloquante de 146,7 s (compareDocumentPosition). Et la cascade elle-même
  (0,06 s par ligne) aurait duré 104 s. Au-delà des trente premières lignes, un
  élément de liste n'hérite plus de l'animation : il apparaît, c'est tout.
*/
export const RANGS_ANIMES = 30;
export function animationDeRang(rang: number): { variants: Variants } | { inherit: false } {
  return rang < RANGS_ANIMES ? { variants: staggerItem } : { inherit: false };
}

/** Combien de lignes une liste affiche d'un coup ; « Afficher plus » ajoute le même nombre. */
export const LIGNES_PAR_PAGE = 200;
