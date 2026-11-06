/**
 * MR02 · MA PAGE PUBLIQUE — logique pure (statut des sections, publication, visites, avis).
 *
 * Règles de la fiche MR02, rubrique 6 (la plupart sont des Propositions à valider).
 * Adresse, certificat et accès d'hébergement ne passent jamais ici (réglages H18).
 */

import { ajouterJours, ecartJours, MOIS_LONGS, type Jour, type Langue } from './commun';

export type StatutSection = 'En ligne' | 'Modifiée' | 'À vérifier' | 'Brouillon';

export interface SectionEntree {
  id: string;
  titre: string;
  /** Version publiée ; `null` si jamais publiée. */
  versionEnLigne: number | null;
  versionTravail: number;
  /** Changements à tester ou à relire avant publication (ex. un formulaire). */
  aVerifier?: boolean;
  /** Changements pas prêts. */
  brouillon?: boolean;
  /** Nature du contenu : sert à rédiger « Avant de publier ». */
  nature?: 'formulaire' | 'avis' | 'tarifs' | 'texte';
}

/**
 * En ligne : version publiée à jour. Modifiée : changements prêts, en attente.
 * À vérifier : à tester ou relire. Brouillon : changements pas prêts, ou jamais publiée.
 * La version publiée d'une section modifiée reste visible tant qu'on n'a pas publié.
 */
export function statutDeSection(s: SectionEntree): StatutSection {
  if (s.brouillon || s.versionEnLigne === null) return 'Brouillon';
  if (s.versionTravail === s.versionEnLigne) return 'En ligne';
  return s.aVerifier ? 'À vérifier' : 'Modifiée';
}

/** « 3 changements en attente » : sections Modifiée, À vérifier ou Brouillon (une section jamais publiée vide ne compte pas si elle n'a aucun contenu de travail). */
export function changementsEnAttente(sections: readonly SectionEntree[]): SectionEntree[] {
  return sections.filter((s) => statutDeSection(s) !== 'En ligne');
}

/** Ordre de lecture des sections par glisser : on renvoie l'ordre déplacé sans toucher aux autres. */
export function deplacerSection<T>(liste: readonly T[], de: number, vers: number): T[] {
  if (de < 0 || de >= liste.length || vers < 0 || vers >= liste.length || de === vers) return [...liste];
  const copie = [...liste];
  const [x] = copie.splice(de, 1);
  copie.splice(vers, 0, x);
  return copie;
}

export interface ControlePublication {
  id: string;
  sectionId: string;
  motif: 'tester-formulaire' | 'accord-avis' | 'verifier-tarifs' | 'relire';
}

/**
 * « Avant de publier » (Proposition) : 3 contrôles au plus, générés à partir des
 * changements en attente (À vérifier d'abord). Cochés à la main, rappelés dans la
 * fenêtre de confirmation, jamais bloquants.
 */
export function controlesAvantPublication(sections: readonly SectionEntree[], max = 3): ControlePublication[] {
  const ordre: Record<StatutSection, number> = { 'À vérifier': 0, Modifiée: 1, Brouillon: 2, 'En ligne': 3 };
  const motifDe = (s: SectionEntree): ControlePublication['motif'] =>
    s.nature === 'formulaire' ? 'tester-formulaire' : s.nature === 'avis' ? 'accord-avis' : s.nature === 'tarifs' ? 'verifier-tarifs' : 'relire';
  return changementsEnAttente(sections)
    .sort((a, b) => ordre[statutDeSection(a)] - ordre[statutDeSection(b)])
    .slice(0, max)
    .map((s) => ({ id: `ctrl-${s.id}`, sectionId: s.id, motif: motifDe(s) }));
}

export interface DroitsPage { ecrire: boolean; publier: boolean; enLigne: boolean }

/** « Publier les changements » / « Demander la publication » (sans droit de publier) / désactivé avec sa raison. */
export function actionDePublication(
  d: DroitsPage,
  sections: readonly SectionEntree[],
): { action: 'publier' | 'demander' | 'aucune'; actif: boolean; raison: 'tout-est-a-jour' | 'hors-ligne' | 'lecture' | null } {
  if (!d.ecrire) return { action: 'aucune', actif: false, raison: 'lecture' };
  if (changementsEnAttente(sections).length === 0) return { action: d.publier ? 'publier' : 'demander', actif: false, raison: 'tout-est-a-jour' };
  if (!d.enLigne) return { action: d.publier ? 'publier' : 'demander', actif: false, raison: 'hors-ligne' };
  return { action: d.publier ? 'publier' : 'demander', actif: true, raison: null };
}

/** « Synchronisé » si l'aperçu reflète la dernière modification (délai visé < 1 s). */
export function apercuSynchronise(derniereModificationMs: number, dernierRenduMs: number): boolean {
  return dernierRenduMs >= derniereModificationMs;
}

/* -------- Visites, 7 jours -------- */

export interface VisiteDuJour { jour: Jour; visites: number }

export interface BilanVisites {
  total7j: number;
  precedent7j: number;
  /** Écart avec les 7 jours précédents, en % entier ; `null` si la période précédente est vide. */
  variationPct: number | null;
  /** Indice (0–6) du jour le plus haut de la période, à mettre en valeur. */
  jourLePlusHaut: number | null;
  /** Les 7 jours, du plus ancien au plus récent (jours sans mesure = 0). */
  jours: VisiteDuJour[];
}

const sommeSurFenetre = (parJour: Map<Jour, number>, finIncluse: Jour, n: number): number => {
  let s = 0;
  for (let k = 0; k < n; k += 1) s += parJour.get(ajouterJours(finIncluse, -k)) ?? 0;
  return s;
};

/** Visites des 7 derniers jours (aujourd'hui compris) et écart avec les 7 précédents. Sans traceur personnel : on ne reçoit que des comptes. */
export function bilanDesVisites(serie: readonly VisiteDuJour[], aujourdhui: Jour): BilanVisites {
  const parJour = new Map(serie.map((v) => [v.jour, v.visites]));
  const jours = Array.from({ length: 7 }, (_, k) => {
    const jour = ajouterJours(aujourdhui, -(6 - k));
    return { jour, visites: parJour.get(jour) ?? 0 };
  });
  const total = jours.reduce((s, j) => s + j.visites, 0);
  const precedent = sommeSurFenetre(parJour, ajouterJours(aujourdhui, -7), 7);
  const max = Math.max(...jours.map((j) => j.visites));
  return {
    total7j: total,
    precedent7j: precedent,
    variationPct: precedent > 0 ? Math.round(((total - precedent) / precedent) * 100) : null,
    jourLePlusHaut: max > 0 ? jours.findIndex((j) => j.visites === max) : null,
    jours,
  };
}

/**
 * « record depuis juin » : cette période de 7 jours est la meilleure depuis le mois où
 * une période au moins aussi bonne s'est terminée pour la dernière fois (Proposition).
 * `null` s'il n'y a pas assez d'historique ou si la période actuelle n'est pas un record.
 * `{ mois: null }` : meilleure période de tout l'historique connu.
 */
export function recordDepuis(serie: readonly VisiteDuJour[], aujourdhui: Jour, langue: Langue = 'fr'): { mois: string | null } | null {
  if (serie.length === 0) return null;
  const parJour = new Map(serie.map((v) => [v.jour, v.visites]));
  const debut = serie.map((v) => v.jour).sort()[0];
  const actuel = sommeSurFenetre(parJour, aujourdhui, 7);
  if (actuel === 0) return null;
  const premierJourComplet = ajouterJours(debut, 6);
  for (let fin = ajouterJours(aujourdhui, -1); fin >= premierJourComplet; fin = ajouterJours(fin, -1)) {
    if (sommeSurFenetre(parJour, fin, 7) >= actuel) {
      // Une période qui chevauche l'actuelle ne compte pas comme « avant » : on part de la fin la plus récente qui ne la touche plus.
      if (ecartJours(fin, aujourdhui) < 7) continue;
      return { mois: MOIS_LONGS[langue][Number(fin.slice(5, 7)) - 1] };
    }
  }
  return ecartJours(debut, aujourdhui) >= 13 ? { mois: null } : null;
}

/* -------- Avis -------- */

export interface AvisEntree {
  id: string;
  /** Nom complet du client (jamais affiché tel quel). */
  nomClient: string;
  note: number;
  texte: string;
  entreprise?: string | null;
  /** Accord du client pour afficher son avis. */
  accordClient: boolean;
  /** Accord pour afficher son entreprise. */
  accordEntreprise?: boolean;
  /** Ajouté dans la version de travail. */
  nouveau?: boolean;
}

/** « Sophie Martin » → « Sophie M. ». Un seul mot : tel quel. Jamais d'adresse ni de téléphone. */
export function auteurPublic(nomComplet: string): string {
  const mots = nomComplet.trim().split(/\s+/).filter(Boolean);
  if (mots.length <= 1) return mots[0] ?? '';
  const initiale = mots[mots.length - 1][0].toUpperCase();
  return `${mots[0]} ${initiale}.`;
}

export interface AvisPublic { id: string; auteur: string; note: number; texte: string; entreprise: string | null; nouveau: boolean }

/** Un avis n'est affiché qu'avec l'accord du client : prénom + initiale, note, texte, entreprise si acceptée. */
export function avisAffichables(avis: readonly AvisEntree[]): AvisPublic[] {
  return avis
    .filter((a) => a.accordClient)
    .map((a) => ({
      id: a.id,
      auteur: auteurPublic(a.nomClient),
      note: Math.min(5, Math.max(1, Math.round(a.note))),
      texte: a.texte,
      entreprise: a.accordEntreprise && a.entreprise ? a.entreprise : null,
      nouveau: !!a.nouveau,
    }));
}

/** Avis en attente d'accord : pour la suggestion « demander l'accord du client ». */
export const avisSansAccord = (avis: readonly AvisEntree[]): AvisEntree[] => avis.filter((a) => !a.accordClient);
