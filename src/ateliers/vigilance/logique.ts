import { ajouterJours, ajouterMois, estDateIso, joursEntre, type Centimes } from '../_commun/nombres';

/**
 * OBLIGATION DE VIGILANCE — qui, parmi mes sous-traitants, m'a remis des pièces
 * à jour, et qui faut-il relancer.
 *
 * Les règles, prudemment (sources dans docs/atelier/modules/vigilance.md) :
 *
 *   · L'obligation porte sur les contrats d'au moins 5 000 € HT (art. L8222-1
 *     et D8222-1 du Code du travail). Le seuil reste un paramètre.
 *   · Attestation de vigilance URSSAF : à la conclusion du contrat puis tous les
 *     six mois jusqu'à la fin de son exécution (art. D8222-5). Elle vaut donc
 *     six mois à compter de sa date ; le module la tient pour valide jusqu'à la
 *     veille du même jour, six mois plus tard.
 *   · Justificatif d'immatriculation (extrait Kbis, carte du répertoire des
 *     métiers…) : exigé par D8222-5 ; l'usage d'un extrait de moins de trois
 *     mois est une PRATIQUE COURANTE, pas un délai lu dans le texte. La durée
 *     est un paramètre (3 mois par défaut).
 *   · Attestation d'assurance (RC pro, décennale pour les travaux de bâtiment,
 *     art. L241-1 du Code des assurances) : valide jusqu'à sa date de fin,
 *     incluse. Elle ne relève pas de la vigilance URSSAF : une assurance
 *     manquante ou expirée fait « relancer », pas « bloquer ».
 *
 * État d'une pièce : manquante, expirée, expire sous 30 jours, valide.
 * État d'un sous-traitant soumis à l'obligation :
 *   bloquant   — URSSAF ou immatriculation manquante ou expirée ;
 *   a relancer — une pièce expire sous 30 jours, ou l'assurance manque ou a expiré ;
 *   a jour     — sinon.
 * Sous le seuil : non concerné (les pièces restent affichées, pour information).
 */
export type TypePiece = 'urssaf' | 'immatriculation' | 'assurance';
export const TYPES_PIECES: readonly TypePiece[] = ['urssaf', 'immatriculation', 'assurance'];

export interface SousTraitant {
  id: string;
  nom: string;
  metier: string;
  contact: string;
  /** Montant HT du contrat en cours, en centimes. */
  montantContrat: Centimes;
  /** Date de délivrance (urssaf, immatriculation) ou date de fin de validité (assurance) ; absente = pièce non remise. */
  pieces: Partial<Record<TypePiece, string>>;
}

export interface Reglage {
  /** Seuil d'obligation, HT, en centimes (5 000 € par défaut). */
  seuil: Centimes;
  /** Durée de validité retenue pour l'extrait d'immatriculation, en mois. */
  moisImmatriculation: number;
  /** Fenêtre d'alerte avant expiration, en jours. */
  joursAlerte: number;
}

export const REGLAGE_PAR_DEFAUT: Reglage = { seuil: 500_000, moisImmatriculation: 3, joursAlerte: 30 };

export type EtatPiece = 'manquante' | 'expiree' | 'bientot' | 'valide' | 'illisible';

export interface Piece {
  type: TypePiece;
  etat: EtatPiece;
  /** Dernier jour de validité, si la pièce est lisible. */
  finValidite?: string;
  /** Jours restants jusqu'à la fin de validité (négatif si expirée). */
  joursRestants?: number;
}

export function finValidite(type: TypePiece, date: string, r: Reglage): string {
  if (type === 'assurance') return date;
  const mois = type === 'urssaf' ? 6 : r.moisImmatriculation;
  return ajouterJours(ajouterMois(date, mois), -1);
}

export function etatPiece(type: TypePiece, date: string | undefined, aujourdhui: string, r: Reglage): Piece {
  if (date === undefined || date === '') return { type, etat: 'manquante' };
  // Une date de délivrance dans le futur est une erreur de saisie, pas une pièce valide.
  if (!estDateIso(date) || (type !== 'assurance' && joursEntre(aujourdhui, date) > 0)) return { type, etat: 'illisible' };
  const fin = finValidite(type, date, r);
  const joursRestants = joursEntre(aujourdhui, fin);
  const etat: EtatPiece = joursRestants < 0 ? 'expiree' : joursRestants <= r.joursAlerte ? 'bientot' : 'valide';
  return { type, etat, finValidite: fin, joursRestants };
}

export type EtatSousTraitant = 'nonConcerne' | 'bloquant' | 'aRelancer' | 'aJour';

export interface Bilan {
  sousTraitant: SousTraitant;
  concerne: boolean;
  etat: EtatSousTraitant;
  pieces: Piece[];
  /** Les pièces à redemander : manquantes, illisibles, expirées ou bientôt expirées. */
  aDemander: TypePiece[];
}

const hors = (p: Piece) => p.etat === 'manquante' || p.etat === 'expiree' || p.etat === 'illisible';

export function bilan(s: SousTraitant, aujourdhui: string, r: Reglage): Bilan {
  const pieces = TYPES_PIECES.map((t) => etatPiece(t, s.pieces[t], aujourdhui, r));
  const aDemander = pieces.filter((p) => p.etat !== 'valide').map((p) => p.type);
  const concerne = s.montantContrat >= r.seuil;
  let etat: EtatSousTraitant;
  if (!concerne) etat = 'nonConcerne';
  else if (pieces.some((p) => p.type !== 'assurance' && hors(p))) etat = 'bloquant';
  else if (aDemander.length > 0) etat = 'aRelancer';
  else etat = 'aJour';
  return { sousTraitant: s, concerne, etat, pieces, aDemander };
}

const ORDRE: Record<EtatSousTraitant, number> = { bloquant: 0, aRelancer: 1, aJour: 2, nonConcerne: 3 };

/** Les bilans, du plus urgent au plus tranquille, puis par nom. */
export function bilans(liste: readonly SousTraitant[], aujourdhui: string, r: Reglage): Bilan[] {
  return liste.map((s) => bilan(s, aujourdhui, r)).sort((a, b) => ORDRE[a.etat] - ORDRE[b.etat] || a.sousTraitant.nom.localeCompare(b.sousTraitant.nom, 'fr'));
}

/** Les relances à faire : sous-traitants concernés qui ont au moins une pièce à redemander. */
export function relances(b: readonly Bilan[]): Bilan[] {
  return b.filter((x) => x.concerne && x.aDemander.length > 0);
}

export type ErreurReglage = 'seuil' | 'mois' | 'alerte';

export function verifierReglage(r: Reglage): ErreurReglage[] {
  const f: ErreurReglage[] = [];
  if (!Number.isFinite(r.seuil) || r.seuil < 0) f.push('seuil');
  if (!Number.isInteger(r.moisImmatriculation) || r.moisImmatriculation < 1 || r.moisImmatriculation > 24) f.push('mois');
  if (!Number.isInteger(r.joursAlerte) || r.joursAlerte < 0 || r.joursAlerte > 365) f.push('alerte');
  return f;
}
