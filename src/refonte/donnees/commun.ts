/**
 * AIDES COMMUNES AUX GÉNÉRATEURS DE LA SUITE.
 *
 * Rien ici ne lit l'horloge ni ne tire au hasard sans graine : tout vient du
 * `Contexte` et d'un `Hasard` fourni.
 */

import { ajouterJours, graineDe, hasard, instantParis, iso, type Hasard, type Jour } from './outils';
import type { FicheClient, Membre } from './types';

export const nomClient = (c: FicheClient): string => c.company || c.name;

/** L'instant ISO où il est `hhmm` à Paris le `jour`. */
export const quand = (jour: Jour, hhmm = '09:00'): string => iso(instantParis(jour, hhmm));

/** Comme `quand`, mais jamais après `maintenant` : un horodatage « de passé » ne tombe pas dans le futur. */
export const quandPasse = (maintenant: number, jour: Jour, hhmm = '09:00'): string => iso(Math.min(instantParis(jour, hhmm), maintenant - 60_000));

export const heure = (h: number, m = 0): string => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

/** Les personnes qui travaillent dans l'entreprise (pas les partenaires extérieurs). */
export const salaries = (equipe: readonly Membre[]): Membre[] => equipe.filter((m) => m.role !== 'Partenaire' && m.role !== 'Invité');

/** `fa-0007` : un identifiant lisible et stable. */
export const cle = (prefixe: string, n: number, largeur = 4): string => `${prefixe}-${String(n).padStart(largeur, '0')}`;

/** Les `n` premiers entiers de 1 à n passés à `f`. */
export const fabriquer = <T,>(n: number, f: (i: number) => T): T[] => Array.from({ length: Math.max(0, n) }, (_, k) => f(k + 1));

/** Une ligne d'aperçu : la première ligne du texte, coupée avec « … ». */
export function apercu(texte: string, max = 70): string {
  const ligne = texte.split('\n')[0].trim();
  return ligne.length <= max ? ligne : `${ligne.slice(0, max - 1).trimEnd()}…`;
}

/** Un âge en jours plutôt récent (loi en puissance) : 0 est le plus probable, `max` le plus rare. */
export const ageRecent = (h: Hasard, max: number, forme = 1.7): number => Math.floor(h.reel() ** forme * (max + 1));

/** Huit caractères hexadécimaux : le début d'une empreinte, comme l'écran l'affiche (jamais l'empreinte entière). */
export function empreinteCourte(h: Hasard): string {
  return Array.from({ length: 8 }, () => '0123456789abcdef'[h.entier(0, 15)]).join('');
}

/** Un hasard propre à un jeu, indépendant des autres. */
export const hasardDe = (graine: number, nom: string): Hasard => hasard(graineDe(graine, nom));

/** Cycle garanti : chaque valeur de la liste apparaît avant qu'aucune ne se répète (varie l'ordre, jamais la présence). */
export function cycle<T>(h: Hasard, valeurs: readonly T[], n: number): T[] {
  const sortie: T[] = [];
  while (sortie.length < n) sortie.push(...h.melanger(valeurs));
  return sortie.slice(0, n);
}

export const finDeMois = (jour: Jour): Jour => {
  const [a, m] = jour.split('-').map(Number);
  return ajouterJours(`${m === 12 ? a + 1 : a}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`, -1);
};

/** Mois précédent `AAAA-MM`, `n` mois en arrière. */
export function moisAvant(jour: Jour, n: number): string {
  const [a, m] = jour.split('-').map(Number);
  const t = a * 12 + (m - 1) - n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
}
