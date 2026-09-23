/**
 * LE DEVIS DEPUIS UN BRIEF — fusion « Devis générés par IA à partir d'un
 * brief » → Devis (`13a`), chantier des cinquante.
 *
 * Le brief est découpé en phrases ; chaque phrase est rapprochée du catalogue
 * RÉEL de l'organisation — ses devis passés, les lignes de ses factures, ses
 * kits, ses forfaits — et devient une ligne du devis qui garde le lien vers
 * la phrase qui l'a produite. Une phrase qui ne correspond à rien reste « à
 * chiffrer » : aucun prix n'est inventé.
 *
 * ARBITRAGE : pas de modèle de langage ici. Le produit n'en appelle aucun
 * pour les devis (le « cerveau » d'Ajmani est hors ligne sans clé) ; un
 * rapprochement déterministe sur le catalogue de la cliente donne des prix
 * qu'elle a déjà pratiqués, et se vérifie ligne à ligne.
 */

export interface EntreeCatalogue {
  libelle: string;
  prixCents: number;
  /** D'où vient le prix : « devis », « facture », « kit », « forfait ». */
  source: string;
}

export interface LigneDepuisBrief {
  phrase: string;
  entree: EntreeCatalogue | null;
  quantite: number;
  /** Le prix de la ligne (quantité comprise), `null` quand rien ne correspond. */
  prixCents: number | null;
}

const MOTS_VIDES = new Set(
  'le la les un une des de du d l et ou a au aux en dans sur pour par avec sans chez nous vous il elle on ce cet cette ces son sa ses leur leurs qui que quoi est sont faire fait merci bonjour aussi plus tres bien tout tous toute toutes chaque notre votre nos vos mon ma mes'.split(' '),
);

export const norme = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ');

/** Les mots qui portent le sens, au singulier approximatif (on retire un « s » ou un « x » final). */
export const motsPleins = (s: string) =>
  norme(s)
    .split(/\s+/)
    .filter((m) => m.length > 2 && !MOTS_VIDES.has(m) && !/^\d+$/.test(m))
    .map((m) => (m.length > 4 ? m.replace(/[sx]$/, '') : m));

export function phrasesDuBrief(brief: string): string[] {
  return brief
    .split(/(?<=[.!?;])\s+|\n+/u)
    .map((p) => p.trim().replace(/^[-•·*]\s*/, ''))
    .filter((p) => motsPleins(p).length > 0);
}

/** « 3 passages », « deux heures » : la quantité dite dans la phrase, 1 sinon. */
const EN_LETTRES: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, douze: 12 };
export function quantiteDe(phrase: string): number {
  const m = norme(phrase).match(/\b(\d{1,3}|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|douze)\s+(fois|passages?|heures?|h|interventions?|visites?|jours?|seances?)\b/);
  if (!m) return 1;
  return /^\d+$/.test(m[1]) ? Number(m[1]) : EN_LETTRES[m[1]] ?? 1;
}

/**
 * Le rapprochement d'une phrase : l'entrée du catalogue qui partage la plus
 * grande part de ses mots pleins avec la phrase (au moins un, et au moins la
 * moitié des mots de l'entrée). À égalité, le prix le plus souvent pratiqué
 * — l'entrée la plus récente de la liste, qui arrive triée.
 */
export function rapprocher(phrase: string, catalogue: EntreeCatalogue[]): EntreeCatalogue | null {
  const mots = new Set(motsPleins(phrase));
  let meilleur: { e: EntreeCatalogue; score: number } | null = null;
  for (const e of catalogue) {
    const siens = [...new Set(motsPleins(e.libelle))];
    if (!siens.length) continue;
    const communs = siens.filter((m) => mots.has(m)).length;
    const score = communs / siens.length;
    if (communs >= 1 && score >= 0.5 && (!meilleur || score > meilleur.score)) meilleur = { e, score };
  }
  return meilleur?.e ?? null;
}

export function lignesDepuisBrief(brief: string, catalogue: EntreeCatalogue[]): LigneDepuisBrief[] {
  return phrasesDuBrief(brief).map((phrase) => {
    const entree = rapprocher(phrase, catalogue);
    const quantite = quantiteDe(phrase);
    return { phrase, entree, quantite, prixCents: entree ? entree.prixCents * quantite : null };
  });
}
