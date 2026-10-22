import type { Famille } from '../../socle/familles';

/**
 * LE MANIFESTE D'UN MODULE D'ATELIER (F1).
 * ═════════════════════════════════════════
 *
 * Même forme qu'une ligne du registre de S1 (`src/refonte/navigation/registre.ts`) :
 * `id`, `route`, `famille`, `action` (`famille.action`), `verbes`, `motsCles`,
 * `aValider` / `pourquoi`. Le jour où Harun retient un module, sa ligne se
 * recopie telle quelle dans le registre, `niveau` en plus.
 *
 * Ce fichier n'importe PAS le registre : un fichier hors `.internal` qui citerait
 * `refonte/` ferait échouer `check:navigation`. C'est le vérificateur
 * (`src/ateliers/verifier.mjs`) qui confronte chaque manifeste au registre :
 * action connue de la famille, id et route libres.
 *
 * LE NIVEAU, aligné sur le registre de S5 (`src/refonte/modules/declarer.ts`) :
 *
 *   essentiel — sert à presque toutes les petites entreprises, sans réglage ;
 *   courant   — sert à beaucoup, avec quelques réglages à faire une fois ;
 *   avance    — un métier précis ou une notion comptable / juridique à connaître.
 */
export const NIVEAUX = ['essentiel', 'courant', 'avance'] as const;
export type Niveau = (typeof NIVEAUX)[number];

export interface ManifesteAtelier {
  /** Clé du futur module dans le catalogue, en camelCase, égale au nom du dossier. */
  id: string;
  /** Route proposée ; rien ne la monte tant que Harun n'a pas choisi. */
  route: string;
  famille: Famille;
  /** `famille.action`, une action de `ACTIONS[famille]` du registre de S1 (vérifié). */
  action: `${Famille}.${string}`;
  /** Ce qu'on veut faire, à l'infinitif : « facturer une situation de travaux ». */
  verbes: readonly string[];
  /** Ce qu'on pourrait taper d'autre. */
  motsCles: readonly string[];
  niveau: Niveau;
  /** Le nom affiché, en français (l'anglais vit dans le `i18n.ts` du module). */
  nom: string;
  /** Pour qui, en une ligne : « artisans du bâtiment ». */
  pourQui: string;
  aValider?: true;
  pourquoi?: string;
}

export function manifeste<M extends ManifesteAtelier>(m: M): M {
  return m;
}
