/**
 * LES SEPT FAMILLES DE LA REFONTE — provisoires.
 *
 * Des identifiants stables, en minuscules, qui ne se confondent pas avec les
 * codes à deux lettres du rail actuel (`PI`, `CR`… voir `src/lib/teintes.ts`) :
 * les deux systèmes cohabitent tant que la navigation n'a pas été refaite.
 *
 * Les couleurs vivent dans `src/index.css` (`--color-fam-<id>` et ses
 * variantes), les noms affichés dans `src/socle/i18n.ts`. Ce fichier ne
 * connaît ni l'une ni l'autre.
 */
export const FAMILLES = ['jour', 'contacts', 'ecrire', 'argent', 'echanger', 'creer', 'outils'] as const;

export type Famille = (typeof FAMILLES)[number];

export function estFamille(valeur: unknown): valeur is Famille {
  return typeof valeur === 'string' && (FAMILLES as readonly string[]).includes(valeur);
}
