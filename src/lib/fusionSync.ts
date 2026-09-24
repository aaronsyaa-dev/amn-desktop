/**
 * LA FUSION D'UN LOT DE FICHES REÇUES — linéaire, pas quadratique (simulation S2, 24 septembre 2026).
 *
 * Avant : `for (const r of lot) map = mergeRecord(map, r)`, où chaque appel
 * recopiait TOUTE la collection (`{ ...map, [id]: fiche }`). Pour une
 * organisation d'un an (17 285 messages de groupe), la première synchro
 * faisait ~150 millions de copies de propriétés : le poste gelait 145 s après
 * la connexion. Mesuré au profileur (une seule fonction, 64,6 s en propre).
 *
 * Maintenant : une seule copie par lot, puis les fiches s'y posent une à une.
 * Le RÉSULTAT est identique fiche par fiche et dans le même ordre d'application
 * — la plus récente (`updatedAt`) gagne, à égalité la dernière reçue — ce que
 * `scripts/check-fusion-sync.ts` vérifie contre l'ancienne fonction sur des
 * milliers de lots aléatoires. Même contrat de retour : si rien ne change, la
 * carte d'origine est rendue telle quelle (même référence).
 */
export interface FicheSync {
  id: string;
  updatedAt: string;
}

export function fusionnerLot<T extends FicheSync>(carte: Record<string, T>, lot: readonly T[]): Record<string, T> {
  let suivante: Record<string, T> | null = null;
  for (const fiche of lot) {
    const actuelle = (suivante ?? carte)[fiche.id];
    if (actuelle && actuelle.updatedAt > fiche.updatedAt) continue;
    if (!suivante) suivante = { ...carte };
    suivante[fiche.id] = fiche;
  }
  return suivante ?? carte;
}

/** L'ancienne fusion, fiche par fiche — gardée pour la preuve d'équivalence, jamais appelée par le produit. */
export function fusionnerFicheAncienne<T extends FicheSync>(carte: Record<string, T>, fiche: T): Record<string, T> {
  const existante = carte[fiche.id];
  if (existante && existante.updatedAt > fiche.updatedAt) return carte;
  return { ...carte, [fiche.id]: fiche };
}
