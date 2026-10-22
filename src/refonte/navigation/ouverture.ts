/**
 * OÙ L'APPLICATION S'OUVRE — l'Accueil le matin, puis là où l'on en était.
 *
 * Avant : le poste rouvrait toujours le dernier onglet (`amn.lastTab`, voir
 * `src/lib/memoireOnglet.ts`). Désormais, dans l'édition interne :
 *
 *   · la PREMIÈRE ouverture de la journée (jour local du poste) arrive sur
 *     l'Accueil, qui est fait pour commencer une journée ;
 *   · les suivantes, le même jour, reprennent le dernier module ouvert.
 *
 * Une « ouverture », c'est le montage de la coquille du poste (`AppLayout`) :
 * le lancement de l'application, un rechargement, un retour d'une session de
 * support. Un lien profond (autre chose que `/`) n'est jamais détourné.
 *
 * Stockage refusé (navigation privée) : on garde l'ancien comportement, on
 * reprend le dernier onglet. L'édition cliente ne lit pas ce fichier : sa
 * couture répond toujours « reprendre ».
 */
export const CLE_OUVERTURE = 'amn.refonte.ouverture';

/** `AAAA-MM-JJ` dans le fuseau du poste. */
export function jourLocal(quand: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${quand.getFullYear()}-${p(quand.getMonth() + 1)}-${p(quand.getDate())}`;
}

/** Vrai à la première ouverture du jour ; note l'ouverture dans tous les cas. */
export function premiereOuvertureDuJour(
  quand: Date,
  stockage: Pick<Storage, 'getItem' | 'setItem'> | null,
): boolean {
  if (!stockage) return false;
  try {
    const avant = stockage.getItem(CLE_OUVERTURE);
    const aujourdhui = jourLocal(quand);
    stockage.setItem(CLE_OUVERTURE, aujourdhui);
    return avant !== aujourdhui;
  } catch {
    return false;
  }
}

/** Faut-il reprendre le dernier onglet à cette ouverture ? Non le premier matin. */
export function restaurerDernierOnglet(): boolean {
  let stockage: Storage | null = null;
  try {
    stockage = window.localStorage;
  } catch {
    stockage = null;
  }
  return !premiereOuvertureDuJour(new Date(), stockage);
}
