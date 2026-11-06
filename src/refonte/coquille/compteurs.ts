import { useMemo } from 'react';
import { verifierDeclaration, type DeclarationCompteurs } from './declarerCompteurs';

/**
 * LES COMPTEURS DE LA BARRE LATÉRALE — ramassés seuls, dans un ordre stable.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Vite lit `src/refonte/compteurs/*.ts` à la construction (`import.meta.glob`,
 * chargement immédiat) : un fichier ajouté entre sans qu'aucune liste soit
 * tenue à la main. Hors de Vite (contrôles Node construits avec esbuild),
 * `import.meta.glob` n'existe pas : la liste est vide, sauf pour les contrôles
 * qui la remplacent par le contenu du dossier (`check:socle-coquille`) et
 * pour les aperçus (`scripts/apercu/construire.ts`, qui réécrit le glob).
 *
 * La liste est figée au chargement et triée par chemin : `useCompteursDeclares`
 * appelle chaque hook dans le même ordre à chaque rendu, ce qui est la règle
 * des hooks. Une déclaration mal formée est écartée (`ecartes`), les autres
 * s'affichent.
 */

export interface FichierCompteurs {
  chemin: string;
  declaration: unknown;
}

export interface CompteursRamasses {
  /** Les déclarations valides, dans l'ordre des chemins (stable). */
  declarations: (DeclarationCompteurs & { chemin: string })[];
  /** Les fichiers écartés, avec la raison. */
  ecartes: { chemin: string; raison: string }[];
}

/** Trie, vérifie, écarte : pur. */
export function ramasserCompteurs(fichiers: FichierCompteurs[]): CompteursRamasses {
  const declarations: CompteursRamasses['declarations'] = [];
  const ecartes: CompteursRamasses['ecartes'] = [];
  for (const f of [...fichiers].sort((a, b) => a.chemin.localeCompare(b.chemin))) {
    const raison = verifierDeclaration(f.declaration);
    if (raison) ecartes.push({ chemin: f.chemin, raison });
    else {
      const d = f.declaration as DeclarationCompteurs;
      declarations.push({ chemin: f.chemin, famille: d.famille, useCompteurs: d.useCompteurs });
    }
  }
  return { declarations, ecartes };
}

/** Additionne les compteurs de plusieurs déclarations, adresse par adresse ; une valeur qui n'est pas un nombre fini ne compte pas. Pur. */
export function fusionnerCompteurs(parts: Record<string, number>[]): Record<string, number> {
  const total: Record<string, number> = {};
  for (const part of parts) {
    for (const [adresse, n] of Object.entries(part)) {
      if (!Number.isFinite(n)) continue;
      total[adresse] = (total[adresse] ?? 0) + n;
    }
  }
  return total;
}

function lireDeclarations(): FichierCompteurs[] {
  try {
    const fichiers = import.meta.glob<{ default: unknown }>('../compteurs/*.ts', { eager: true });
    // Vite écrit `../compteurs/jour.ts`, le réécrivain des aperçus `./../compteurs/jour.ts` : le même nom, `compteurs/jour.ts`.
    return Object.entries(fichiers).map(([chemin, m]) => ({ chemin: chemin.replace(/^\.\//, '').replace(/^\.\.\//, ''), declaration: m.default }));
  } catch {
    return [];
  }
}

export const COMPTEURS_DECLARES: CompteursRamasses = ramasserCompteurs(lireDeclarations());

/**
 * Les compteurs d'une liste de déclarations, fusionnés par adresse. La liste doit être la même d'un rendu à
 * l'autre (figée au chargement) : chaque hook est alors appelé à chaque rendu, dans le même ordre.
 */
export function useCompteursDe(declarations: readonly DeclarationCompteurs[]): Record<string, number> {
  const parts: Record<string, number>[] = [];
  for (const d of declarations) parts.push(d.useCompteurs());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => fusionnerCompteurs(parts), parts);
}

/** Tous les compteurs déclarés, fusionnés par adresse : la source des pastilles de la barre latérale. */
export function useCompteursDeclares(): Record<string, number> {
  return useCompteursDe(COMPTEURS_DECLARES.declarations);
}
