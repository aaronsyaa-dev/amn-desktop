import type React from 'react';
import { systemeDemandeMoins, useMouvement, type NiveauMouvement } from './mouvement';

/**
 * LA COUCHE DE MOUVEMENT, CÔTÉ CODE — les petits outils autour de `src/socle/mouvement.css` (§0.2).
 *
 * Le mouvement vit dans la feuille : un attribut `data-mvt="<nom>"` (ou `data-mvt-survol`) sur
 * l'élément, et la feuille fait le reste, y compris couper en mouvement réduit. Ce fichier ne fait
 * que poser ces attributs proprement et donner les mêmes cotes à qui anime avec framer-motion :
 *
 *   <Carte {...entreeCarte(i)}>…</Carte>            → entre au rang i (45 ms × i, 14 cartes au plus)
 *   <div data-mvt="cascade">{cartes}</div>          → chaque enfant entre à son tour, sans rien compter
 *   <li {...arriveeLigne()}>…</li>                   → une ligne qui arrive glisse de 8 px depuis la gauche
 *   <rect data-mvt="pousse" style={styleRang(i)} />  → une barre pousse à son tour
 *
 * Le réglage lui-même (complet, réduit, aucun) reste dans `mouvement.ts` ; `useMouvementVivant()`
 * dit ce qui est permis en tenant compte du système, pour le code qui doit décider en JavaScript.
 */

/** Les cotes du §0.2, en millisecondes (et en pixels pour les distances). `check:socle-vivant` les compare à `mouvement.css`. */
export const COTES_MOUVEMENT = {
  entree: { duree: 500, montee: 6, decalage: 45, max: 14 },
  progression: { duree: 900, depart: 200 },
  anneau: { duree: 1100, depart: 250 },
  barres: { duree: 700, decalageMin: 22, decalageMax: 40 },
  courbe: { trace: 1300, pointFinal: 1200 },
  voyant: { duree: 2200 },
  flux: { min: 1200, max: 2200, defaut: 1600 },
  balayage: { duree: 6500 },
  curseur: { duree: 1100 },
  arrivee: { duree: 450, glisse: 8 },
  survol: { duree: 160 },
  fonduCourt: { duree: 200 },
} as const;

/** `cubic-bezier(.2,.7,.2,1)`, pour framer-motion (`transition.ease`). */
export const COURBE_MOUVEMENT = [0.2, 0.7, 0.2, 1] as const;

/** Les noms que comprend `data-mvt`. */
export type AnimationMouvement =
  | 'entree'
  | 'cascade'
  | 'arrivee'
  | 'fondu'
  | 'remplit'
  | 'anneau'
  | 'arc'
  | 'pousse'
  | 'trace'
  | 'aire'
  | 'point-final'
  | 'onde'
  | 'flux'
  | 'balayage'
  | 'curseur';

/** Les noms que comprend `data-mvt-survol`. */
export type SurvolMouvement = 'carte' | 'bouton' | 'ligne' | 'noeud';

/**
 * Les trois classes que les fiches nomment à l'anglaise (LOT-06), et l'attribut dont chacune partage la règle dans
 * `mouvement.css` (`:is([data-mvt='entree'], .amn-grow)`) : `check:socle-vivant` compare les deux. Même coupure.
 */
export const CLASSES_MOUVEMENT = { 'amn-grow': 'entree', 'amn-slide': 'arrivee', 'amn-bar': 'pousse' } as const satisfies Record<string, AnimationMouvement>;
export type ClasseMouvement = keyof typeof CLASSES_MOUVEMENT;

type StyleRang = React.CSSProperties & { '--sc-mvt-rang'?: number };

/** Le rang d'entrée, borné de 0 à 13 : au-delà de la 14e carte, plus de décalage supplémentaire. */
export function rangMouvement(rang: number): number {
  if (!Number.isFinite(rang)) return 0;
  return Math.min(COTES_MOUVEMENT.entree.max - 1, Math.max(0, Math.floor(rang)));
}

/** Le style qui porte le rang (`--sc-mvt-rang`), à fusionner avec un style existant. */
export function styleRang(rang: number, style?: React.CSSProperties): StyleRang {
  return { ...style, '--sc-mvt-rang': rangMouvement(rang) };
}

/** Les attributs d'une carte qui entre au chargement de l'écran, à son rang. */
export function entreeCarte(rang = 0, style?: React.CSSProperties): { 'data-mvt': 'entree'; style: StyleRang } {
  return { 'data-mvt': 'entree', style: styleRang(rang, style) };
}

/** Les attributs d'une ligne qui arrive (un nouvel élément dans une liste, un journal). */
export function arriveeLigne(): { 'data-mvt': 'arrivee' } {
  return { 'data-mvt': 'arrivee' };
}

/**
 * Le décalage entre deux barres, de 22 à 40 ms selon leur nombre : la vague dure à peu près
 * 280 ms quel que soit le graphique (7 barres → 40 ms, 13 et plus → 22 ms).
 */
export function decalageBarres(n: number): number {
  const { decalageMin, decalageMax } = COTES_MOUVEMENT.barres;
  if (!Number.isFinite(n) || n <= 1) return decalageMax;
  return Math.min(decalageMax, Math.max(decalageMin, Math.round(280 / n)));
}

/** La durée d'un flux, ramenée dans 1,2 à 2,2 s (1,6 s par défaut). */
export function dureeFlux(ms?: number): number {
  const { min, max, defaut } = COTES_MOUVEMENT.flux;
  if (ms === undefined || !Number.isFinite(ms)) return defaut;
  return Math.min(max, Math.max(min, Math.round(ms)));
}

/**
 * Ce que la couche fait vraiment en ce moment : « complet », « reduit » (fondus courts seulement) ou
 * « aucun ». Le système l'emporte quand il demande moins d'animations — c'est ce que fait la feuille.
 */
export function niveauVivant(niveau: NiveauMouvement, systemeReduit: boolean): NiveauMouvement {
  return systemeReduit ? 'aucun' : niveau;
}

/** Le niveau en vigueur pour la couche, relu quand le réglage change. Pour le code qui anime en JavaScript. */
export function useMouvementVivant(): NiveauMouvement {
  const niveau = useMouvement();
  return niveauVivant(niveau, systemeDemandeMoins());
}

/**
 * L'entrée d'une carte pour framer-motion (`<motion.div {...entreeMotion(i, niveau)}>`), aux mêmes cotes
 * que `data-mvt="entree"` : montée de 6 px en « complet », fondu court en « reduit », rien en « aucun ».
 */
export function entreeMotion(rang: number, niveau: NiveauMouvement) {
  if (niveau === 'aucun') return { initial: false as const };
  const { duree, montee, decalage } = COTES_MOUVEMENT.entree;
  if (niveau === 'reduit') {
    return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: COTES_MOUVEMENT.fonduCourt.duree / 1000, ease: 'easeOut' as const } };
  }
  return {
    initial: { opacity: 0, y: montee },
    animate: { opacity: 1, y: 0 },
    transition: { duration: duree / 1000, delay: (rangMouvement(rang) * decalage) / 1000, ease: COURBE_MOUVEMENT },
  };
}
