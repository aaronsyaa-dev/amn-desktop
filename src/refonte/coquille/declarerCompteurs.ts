import { FAMILLES, type Famille } from '../../socle/familles';

/**
 * DÉCLARER UN COMPTEUR DE LA BARRE LATÉRALE — ce qu'un lot écrit.
 * ═══════════════════════════════════════════════════════════════
 *
 * Les pastilles de la barre latérale (« ce qui attend », par adresse de
 * module) ne sont plus calculées en dur dans la coquille : chaque lot déclare
 * les siennes dans UN fichier, `src/refonte/compteurs/<famille>.ts` :
 *
 *   import { declarerCompteurs } from '../coquille/declarerCompteurs';
 *   function useCompteurs(): Record<string, number> {
 *     const articles = useCollection<Article>('stock');
 *     return useMemo(() => ({ '/stock': articlesASurveiller(articles).length }), [articles]);
 *   }
 *   export default declarerCompteurs({ famille: 'creer', useCompteurs });
 *
 * `useCompteurs` est un HOOK (il lit les accès existants) qui rend les
 * compteurs par adresse de vue (`to` du catalogue, « /stock ») ; une adresse
 * absente ou à zéro n'affiche rien. La coquille ramasse les fichiers du
 * dossier seule (`compteurs.ts`), comme le registre des modules (S5) : rien à
 * inscrire ailleurs. Deux déclarations sur la même adresse s'additionnent :
 * déclarez une adresse une seule fois.
 *
 * Une déclaration mal formée (sans famille connue, sans hook) est écartée sans
 * rien casser : les autres compteurs s'affichent (`check:socle-coquille`).
 */

/** Qui déclare : une des sept familles, La Garde ou Cyber. */
export type FamilleCompteurs = Famille | 'garde' | 'cyber';

export interface DeclarationCompteurs {
  famille: FamilleCompteurs;
  /** Un hook : les compteurs par adresse de vue. Un objet mémorisé (`useMemo`) évite les recalculs de la barre. */
  useCompteurs: () => Record<string, number>;
}

const FAMILLES_COMPTEURS: ReadonlySet<string> = new Set<string>([...FAMILLES, 'garde', 'cyber']);

/** L'identité, typée : ce que le fichier d'un lot exporte par défaut. */
export function declarerCompteurs(d: DeclarationCompteurs): DeclarationCompteurs {
  return d;
}

/** La raison pour laquelle une valeur n'est pas une déclaration, ou `null` si elle en est une. */
export function verifierDeclaration(valeur: unknown): string | null {
  if (!valeur || typeof valeur !== 'object') return 'pas d’export par défaut (attendu : declarerCompteurs({ famille, useCompteurs }))';
  const d = valeur as Partial<DeclarationCompteurs>;
  if (typeof d.famille !== 'string' || !FAMILLES_COMPTEURS.has(d.famille)) return `famille inconnue : ${String(d.famille)}`;
  if (typeof d.useCompteurs !== 'function') return 'useCompteurs n’est pas une fonction';
  return null;
}
