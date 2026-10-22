import { assembler, type FichierDeclaration, type Registre, type VueRegistre } from './assembler';

/**
 * LE REGISTRE DES MODULES — ce que `declarations/` déclare, ramassé seul.
 *
 * Vite lit le dossier à la construction (`import.meta.glob`, chargement
 * immédiat) : un fichier ajouté entre au registre sans qu'aucune liste soit
 * tenue à la main. Hors de Vite (les contrôles Node qui construisent le code
 * avec esbuild), `import.meta.glob` n'existe pas : le registre est alors vide,
 * sauf pour `check:navigation`, qui le remplace par le contenu du dossier.
 */
function lireDeclarations(): FichierDeclaration[] {
  try {
    const fichiers = import.meta.glob<{ default: unknown }>('./declarations/*.ts', { eager: true });
    return Object.entries(fichiers).map(([chemin, m]) => ({ chemin: chemin.replace(/^\.\//, ''), declaration: m.default }));
  } catch {
    return [];
  }
}

export const REGISTRE_MODULES: Registre = assembler(lireDeclarations());

const PAR_VUE: ReadonlyMap<string, VueRegistre> = new Map(REGISTRE_MODULES.vues.map((v) => [v.id, v]));

/** La vue d'une clé du catalogue (son entrée, sa famille, ses verbes), ou `undefined`. */
export function vueDuRegistre(id: string): VueRegistre | undefined {
  return PAR_VUE.get(id);
}
