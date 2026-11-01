/**
 * LES ÉTATS DE LA PALETTE ET SES DÉLAIS — logique pure, sans React.
 *
 * La palette ne clignote pas : une proposition n'est préparée qu'après 250 ms sans frappe ; le squelette de
 * réflexion n'apparaît que si l'attente dépasse 150 ms, puis reste au moins 400 ms. Un premier Échap annule
 * une requête en cours, un second ferme.
 */
import type { Genre, Reponse } from './intentions';

export const DELAI_PROPOSITION_MS = 250;
export const DELAI_SQUELETTE_MS = 150;
export const DUREE_MIN_SQUELETTE_MS = 400;
export const DUREE_OUVERTURE_MS = 160;
export const DUREE_FERMETURE_MS = 120;

export type EtatPalette =
  | 'repos' // champ vide
  | 'saisie' // une proposition (ou un résultat) est affichée
  | 'reflexion' // une requête attend : squelettes
  | 'rien-trouve'
  | 'non-comprise'
  | 'deja-fait'
  | 'refus'
  | 'droits'
  | 'erreur';

export interface EntreeEtat {
  texte: string;
  reponse: Reponse | null;
  enCours: boolean;
  erreur: boolean;
}

/** L'état que la palette affiche — la source de l'attribut `data-etat`, et des contrôles. */
export function etatAffiche(e: EntreeEtat): EtatPalette {
  if (e.erreur) return 'erreur';
  if (e.enCours) return 'reflexion';
  if (!e.texte.trim() || !e.reponse) return 'repos';
  const genre: Genre = e.reponse.genre;
  if (genre === 'rien-trouve' || genre === 'non-comprise' || genre === 'deja-fait' || genre === 'refus' || genre === 'droits') return genre;
  return 'saisie';
}

/** Que fait Échap ? Une requête en cours d'abord (elle s'annule), la palette ensuite. */
export function decisionEchap(requeteEnCours: boolean): 'annuler-requete' | 'fermer' {
  return requeteEnCours ? 'annuler-requete' : 'fermer';
}

/**
 * Le squelette de réflexion : combien de temps garder le squelette affiché.
 * `0` si on ne l'a jamais montré (la réponse est arrivée avant 150 ms) ; sinon ce qui manque pour atteindre 400 ms.
 */
export function attenteAvantReponse(montreDepuis: number | null, maintenant: number): number {
  if (montreDepuis === null) return 0;
  return Math.max(0, DUREE_MIN_SQUELETTE_MS - (maintenant - montreDepuis));
}
