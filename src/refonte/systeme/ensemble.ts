/**
 * LA VUE D'ENSEMBLE D'UNE FAMILLE — où mène la première ligne de chaque famille de la barre latérale.
 *
 * Toute famille sauf Ma journée commence par « Vue d'ensemble » (01-SOCLE-DESIGN §3). Ma journée a son
 * Accueil, et La Garde sa salle (`/garde`). Les autres n'ont, aujourd'hui, ni page propre ni route : le lot
 * qui construit la page d'accueil de la famille (F10 à F60) la déclare ici, et en attendant une page générique
 * (`PageEnsembleFamille`) dresse la liste de ses modules — jamais un lien mort, jamais « introuvable ».
 */

/** Les familles qui ont déjà une page d'accueil propre, et son adresse. */
const ACCUEILS_PROPRES: Readonly<Record<string, string>> = {
  jour: '/',
  garde: '/garde',
};

export const PREFIXE_ENSEMBLE = '/ensemble';

/** L'adresse de la vue d'ensemble d'une famille (identifiant du registre : `jour`, `contacts`, `garde`…). */
export function routeEnsemble(idFamille: string): string {
  return ACCUEILS_PROPRES[idFamille] ?? `${PREFIXE_ENSEMBLE}/${encodeURIComponent(idFamille)}`;
}

/** Vrai quand la vue d'ensemble de la famille est la page générique (donc à remplacer par celle de son lot). */
export function ensembleGenerique(idFamille: string): boolean {
  return !(idFamille in ACCUEILS_PROPRES);
}
