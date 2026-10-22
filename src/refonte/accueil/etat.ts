/**
 * DANS QUEL ÉTAT EST L'ACCUEIL — chargement, hors ligne, ou prêt.
 *
 * Un Accueil qui n'a pas encore ses données ne doit RIEN affirmer : ni
 * « rien de prévu aujourd'hui », ni « agenda libre ». Une liste vide veut dire
 * « rien » seulement quand la synchronisation a répondu.
 *
 *   chargement — la synchronisation n'a pas encore répondu : des gabarits,
 *                aucun message, aucun compteur ;
 *   hors-ligne — le dernier chargement a échoué : on le dit, et l'on ne montre
 *                que ce que le poste a déjà (il peut être incomplet) ;
 *   prêt       — on peut parler.
 */
export type EtatAccueil = 'chargement' | 'hors-ligne' | 'pret';

export function etatDeLAccueil(s: { ready: boolean; pullFailed: boolean }): EtatAccueil {
  if (!s.ready) return 'chargement';
  return s.pullFailed ? 'hors-ligne' : 'pret';
}

/** Le raccourci qui ouvre l'assistant : ⌘J sur Mac, Ctrl+J ailleurs. */
export function raccourciAssistant(plateforme: string = typeof navigator === 'undefined' ? '' : navigator.platform): string {
  return /mac|iphone|ipad/i.test(plateforme) ? '⌘J' : 'Ctrl+J';
}
