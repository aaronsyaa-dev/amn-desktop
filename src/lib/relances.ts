/**
 * LES RELANCES GRADUÉES — le ton doit monter avec le retard, jamais rester plat.
 *
 * Avant ce chantier, `RemindersScreen` proposait le MÊME message poli quelle que soit
 * l'ancienneté du retard : un rappel de trois jours et un silence de quatre mois
 * recevaient la même formule. Une vraie relance progresse par paliers — c'est ce que
 * fait n'importe quel service de recouvrement, et c'est ce que ce module calcule :
 * quel palier une facture a atteint, et si le ton doit changer depuis la dernière
 * relance envoyée (reprendre le même palier après l'avoir déjà dit une fois n'aide
 * personne ; ne pas savoir qu'il faut monter d'un cran non plus).
 *
 * Les seuils (7 / 21 / 45 jours) suivent l'usage commercial français : un rappel dans
 * la première semaine, une relance ferme au bout de trois semaines, une mise en
 * demeure formelle passé quarante-cinq jours — le dernier palier avant contentieux
 * ou recouvrement, que ce module NE déclenche jamais lui-même (aucun envoi
 * automatique, voir l'en-tête de `RemindersScreen`).
 */

import type { CleTraduction } from '../i18n';

export type PalierRelance = 'rappel' | 'ferme' | 'mise-en-demeure' | 'dernier-avis';

const SEUILS: Array<{ palier: PalierRelance; auDela: number }> = [
  { palier: 'dernier-avis', auDela: 45 },
  { palier: 'mise-en-demeure', auDela: 21 },
  { palier: 'ferme', auDela: 7 },
  { palier: 'rappel', auDela: 0 },
];

/** Le palier qu'un nombre de jours de retard atteint — jamais un texte libre. */
export function paliereDe(joursRetard: number): PalierRelance {
  const trouve = SEUILS.find((s) => joursRetard > s.auDela);
  return trouve?.palier ?? 'rappel';
}

/**
 * L'ÉCHELLE, du plus doux au plus dur, avec le retard à partir duquel chaque
 * palier s'applique.
 *
 * `paliereDe` compare en STRICT supérieur : le palier « ferme » commence donc
 * au huitième jour de retard, pas au septième. L'écran affiche ce seuil tel
 * quel — il ne le recalcule pas, sous peine de dire « dès 7 j » à côté d'une
 * facture de 7 jours encore marquée « rappel ».
 */
export const ECHELLE: ReadonlyArray<{ palier: PalierRelance; auDela: number }> = [...SEUILS].reverse();

/** L'ordre des paliers, du plus doux au plus dur — pour comparer, pas pour afficher. */
const ORDRE: PalierRelance[] = ['rappel', 'ferme', 'mise-en-demeure', 'dernier-avis'];

/** Rang du palier (0 = le plus doux). Sert à détecter une montée de ton. */
export function rangPalier(p: PalierRelance): number {
  return ORDRE.indexOf(p);
}

/**
 * Le ton a-t-il monté depuis la dernière relance envoyée ?
 *
 * `null` en dernier palier connu = jamais relancée : ce n'est pas une montée, c'est
 * un premier envoi, et l'écran doit le dire différemment (« à relancer », pas
 * « le ton doit monter »).
 */
export function toneAMonte(dernierPalierEnvoye: PalierRelance | null, palierActuel: PalierRelance): boolean {
  if (dernierPalierEnvoye === null) return false;
  return rangPalier(palierActuel) > rangPalier(dernierPalierEnvoye);
}

/**
 * La clé i18n du message de ce palier — jamais le texte lui-même : le ton doit
 * exister en français ET en anglais (voir `src/i18n/{fr,en}.ts`), et seul l'écran,
 * qui connaît la langue courante, peut appeler `t()` dessus.
 */
export function cleMessagePalier(palier: PalierRelance): CleTraduction {
  switch (palier) {
    case 'rappel':
      return 'relances.message'; // la clé qui existait déjà avant ce chantier, ton inchangé
    case 'ferme':
      return 'relances.message.ferme';
    case 'mise-en-demeure':
      return 'relances.message.miseEnDemeure';
    case 'dernier-avis':
      return 'relances.message.dernierAvis';
  }
}

export const CLE_LIBELLE_PALIER: Record<PalierRelance, CleTraduction> = {
  rappel: 'relances.palier.rappel',
  ferme: 'relances.palier.ferme',
  'mise-en-demeure': 'relances.palier.miseEnDemeure',
  'dernier-avis': 'relances.palier.dernierAvis',
};
