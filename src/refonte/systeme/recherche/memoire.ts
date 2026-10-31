import { TAILLE_RECENTS, TYPES_RESULTAT, type TypeResultat } from './moteur';

/**
 * LA MÉMOIRE DE LA RECHERCHE — ce qu'on a ouvert, sur ce poste, pour cette personne.
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * Deux listes dans le `localStorage`, rien dans la synchronisation :
 *
 *   amn.recherche.recents.<email>      les 5 derniers éléments ouverts : clé, type, route ;
 *   amn.recherche.frequences.<email>   combien de fois chaque clé a été ouverte (au plus 100 clés).
 *
 * Jamais de contenu : pas de titre, pas de texte, pas de nom. La clé suffit — la
 * palette retrouve le libellé dans l'index, ce qui veut dire qu'un élément qu'on
 * n'a plus le droit de voir (ou qui a été supprimé) ne revient pas par la mémoire.
 *
 * Pur : le stockage est passé en argument, les fonctions rendent de nouvelles valeurs.
 */

export interface Recent {
  cle: string;
  type: TypeResultat;
  route: string;
}

export type Frequences = Record<string, number>;

export const PREFIXE_RECENTS = 'amn.recherche.recents';
export const PREFIXE_FREQUENCES = 'amn.recherche.frequences';
const MAX_FREQUENCES = 100;
const MAX_CLE = 120;

export const cleRecents = (email: string): string => `${PREFIXE_RECENTS}.${email || 'anonyme'}`;
export const cleFrequences = (email: string): string => `${PREFIXE_FREQUENCES}.${email || 'anonyme'}`;

type Stockage = Pick<Storage, 'getItem' | 'setItem'>;

function lireJson(stockage: Stockage | null, cle: string): unknown {
  try {
    const brut = stockage?.getItem(cle);
    return brut ? JSON.parse(brut) : null;
  } catch {
    return null;
  }
}

function ecrireJson(stockage: Stockage | null, cle: string, valeur: unknown): void {
  try {
    stockage?.setItem(cle, JSON.stringify(valeur));
  } catch {
    /* stockage refusé ou plein : la mémoire ne vaut que pour cette session */
  }
}

const estType = (v: unknown): v is TypeResultat => typeof v === 'string' && (TYPES_RESULTAT as readonly string[]).includes(v);

/** Relit la liste en la VALIDANT : ce qui n'a pas la forme attendue est écarté, jamais réparé. */
export function lireRecents(stockage: Stockage | null, email: string): Recent[] {
  const brut = lireJson(stockage, cleRecents(email));
  if (!Array.isArray(brut)) return [];
  const vus = new Set<string>();
  const sortie: Recent[] = [];
  for (const r of brut) {
    if (!r || typeof r !== 'object') continue;
    const { cle, type, route } = r as Record<string, unknown>;
    if (typeof cle !== 'string' || cle.length > MAX_CLE || typeof route !== 'string' || !route.startsWith('/') || !estType(type) || vus.has(cle)) continue;
    vus.add(cle);
    sortie.push({ cle, type, route });
    if (sortie.length >= TAILLE_RECENTS) break;
  }
  return sortie;
}

/** Ajoute un élément en tête (sans doublon) et garde les 5 derniers. */
export function ajouterRecent(courants: readonly Recent[], nouveau: Recent): Recent[] {
  return [nouveau, ...courants.filter((r) => r.cle !== nouveau.cle)].slice(0, TAILLE_RECENTS);
}

export function ecrireRecents(stockage: Stockage | null, email: string, recents: readonly Recent[]): void {
  ecrireJson(stockage, cleRecents(email), recents.map(({ cle, type, route }) => ({ cle, type, route })));
}

export function lireFrequences(stockage: Stockage | null, email: string): Frequences {
  const brut = lireJson(stockage, cleFrequences(email));
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return {};
  const sortie: Frequences = {};
  for (const [cle, n] of Object.entries(brut as Record<string, unknown>)) {
    if (cle.length <= MAX_CLE && typeof n === 'number' && Number.isFinite(n) && n > 0) sortie[cle] = Math.min(Math.floor(n), 100000);
  }
  return sortie;
}

/** Une ouverture de plus ; au-delà de 100 clés, on oublie celles qu'on a le moins ouvertes. */
export function compterOuverture(courantes: Readonly<Frequences>, cle: string): Frequences {
  const suivantes: Frequences = { ...courantes, [cle]: (courantes[cle] ?? 0) + 1 };
  const cles = Object.keys(suivantes);
  if (cles.length <= MAX_FREQUENCES) return suivantes;
  const gardees = cles.sort((a, b) => suivantes[b] - suivantes[a] || (a === cle ? -1 : b === cle ? 1 : 0)).slice(0, MAX_FREQUENCES);
  return Object.fromEntries(gardees.map((k) => [k, suivantes[k]]));
}

export function ecrireFrequences(stockage: Stockage | null, email: string, frequences: Readonly<Frequences>): void {
  ecrireJson(stockage, cleFrequences(email), frequences);
}
