import { matchPath } from 'react-router-dom';
import type { DeclarationSubstitutions, Substitution } from './declarer';

/**
 * LE REGISTRE DES SUBSTITUTIONS — ce que `declarations/` déclare, ramassé seul.
 *
 * Même modèle que le registre des modules (`src/refonte/modules/registre.ts`) :
 * Vite lit le dossier à la construction (`import.meta.glob`, chargement
 * immédiat). Hors de Vite (les contrôles Node construits avec esbuild),
 * `import.meta.glob` n'existe pas : le registre est alors vide, sauf pour
 * `check:substitutions`, qui le remplace par le contenu du dossier.
 *
 * Un fichier vide, ou sans export par défaut, ne déclare rien ; une
 * déclaration mal formée ou une route déclarée deux fois est une faute,
 * notée dans `fautes` (le contrôle la refuse) et ignorée à l'exécution : le
 * mécanisme ne tombe jamais pour un fichier de déclaration.
 */
export interface FichierSubstitutions {
  chemin: string;
  declaration: unknown;
}

export interface SubstitutionEnregistree extends Substitution {
  lot: string;
  /** Le fichier qui l'a déclarée, pour les messages du contrôle. */
  source: string;
}

export interface RegistreSubstitutions {
  substitutions: readonly SubstitutionEnregistree[];
  fautes: readonly string[];
}

const SUPPORT = new Set(['identique', 'aucune']);

function fauteDeSubstitution(s: unknown, ou: string): string | null {
  if (!s || typeof s !== 'object') return `${ou} : une substitution n'est pas un objet`;
  const { route, module, composant, support, toujours } = s as Record<string, unknown>;
  if (typeof route !== 'string' || !route.startsWith('/')) return `${ou} : route manquante ou qui ne commence pas par « / »`;
  if (module !== undefined && (typeof module !== 'string' || module === '')) return `${ou} › ${route} : module vide`;
  if (!composant || (typeof composant !== 'function' && typeof composant !== 'object')) return `${ou} › ${route} : composant manquant`;
  if (support !== undefined && !SUPPORT.has(support as string)) return `${ou} › ${route} : support doit être « identique » ou « aucune »`;
  if (toujours !== undefined && typeof toujours !== 'boolean') return `${ou} › ${route} : toujours doit être un booléen`;
  return null;
}

/** Assemble les fichiers ramassés en un registre ; pur, pour que le contrôle le déroule avec ses propres fichiers. */
export function assemblerSubstitutions(fichiers: readonly FichierSubstitutions[]): RegistreSubstitutions {
  const substitutions: SubstitutionEnregistree[] = [];
  const fautes: string[] = [];
  const parRoute = new Map<string, string>();
  for (const { chemin, declaration } of fichiers) {
    // Un fichier vide, ou qui n'exporte rien par défaut, ne déclare rien (un fichier sans export arrive comme
    // un objet sans clé selon l'empaqueteur).
    if (declaration === undefined || declaration === null) continue;
    if (typeof declaration === 'object' && Object.keys(declaration as object).length === 0) continue;
    const d = declaration as Partial<DeclarationSubstitutions>;
    if (typeof d !== 'object' || typeof d.lot !== 'string' || d.lot === '' || !Array.isArray(d.substitutions)) {
      fautes.push(`${chemin} : l'export par défaut n'est pas une déclaration (declarerSubstitutions(lot, [...]))`);
      continue;
    }
    for (const s of d.substitutions) {
      const faute = fauteDeSubstitution(s, chemin);
      if (faute) {
        fautes.push(faute);
        continue;
      }
      const deja = parRoute.get(s.route);
      if (deja) {
        fautes.push(`${chemin} › ${s.route} : route déjà substituée par ${deja}`);
        continue;
      }
      parRoute.set(s.route, chemin);
      substitutions.push({ ...s, lot: d.lot, source: chemin });
    }
  }
  return { substitutions, fautes };
}

function lireDeclarations(): FichierSubstitutions[] {
  try {
    const fichiers = import.meta.glob<{ default: unknown }>('./declarations/*.tsx', { eager: true });
    return Object.entries(fichiers).map(([chemin, m]) => ({ chemin: chemin.replace(/^\.\//, ''), declaration: m?.default }));
  } catch {
    return [];
  }
}

export const REGISTRE_SUBSTITUTIONS: RegistreSubstitutions = assemblerSubstitutions(lireDeclarations());

/** Où l'on est : en session de support cliente ou non, nouvelle coquille allumée ou non. */
export interface ContexteSubstitution {
  support: boolean;
  coquille: boolean;
}

/**
 * La substitution du chemin courant, ou `undefined` (l'écran d'origine).
 *
 * Une route exacte l'emporte sur une route paramétrée ; entre routes paramétrées, la plus précise
 * (le plus de segments fixes) l'emporte. Coquille éteinte, seul un substitut `toujours` est rendu ;
 * en session de support, seul un substitut `support: 'identique'`.
 */
export function trouverSubstitution(
  pathname: string,
  contexte: ContexteSubstitution,
  registre: RegistreSubstitutions = REGISTRE_SUBSTITUTIONS,
): SubstitutionEnregistree | undefined {
  let meilleure: SubstitutionEnregistree | undefined;
  let score = -1;
  for (const s of registre.substitutions) {
    if (s.route === pathname) {
      meilleure = s;
      break;
    }
    if (!matchPath({ path: s.route, end: true }, pathname)) continue;
    const fixes = s.route.split('/').filter((seg) => seg !== '' && !seg.startsWith(':') && seg !== '*').length;
    if (fixes > score) {
      score = fixes;
      meilleure = s;
    }
  }
  if (!meilleure) return undefined;
  if (contexte.support && meilleure.support !== 'identique') return undefined;
  if (!contexte.coquille && meilleure.toujours !== true) return undefined;
  return meilleure;
}
