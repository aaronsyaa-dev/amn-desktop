/**
 * Les enregistrements des bureaux — la forme des collections ouvertes pour
 * eux côté amn-api (voir src/routes/collections.js). Ce sont des objets JSON
 * synchronisés comme tous les autres ; ce fichier n'en fixe que la forme
 * lue par les écrans, et chaque champ y est facultatif quand un poste plus
 * ancien a pu écrire sans lui.
 */

/** Le dossier interne d'une cliente (collection `orgDossier`, clé = son id). */
export interface DossierOrg {
  /** Les notes libres de la première version du dossier — gardées telles quelles. */
  body?: string;
  updatedBy?: string;
  ville?: string;
  metier?: string;
  groupe?: string;
  contact?: { nom?: string; role?: string; email?: string; tel?: string };
  notes?: { id: string; texte: string; par: string; at: string }[];
  echanges?: { id: string; sens: 'recu' | 'envoye'; resume: string; par: string; at: string }[];
  /** L'état d'un module POUR ELLE SEULE (cahier 12, `46e`). */
  modules?: Record<string, EtatModuleSeule>;
}

export interface EtatModuleSeule {
  etat: 'pause' | 'epinglee' | 'alternative';
  /** Version épinglée (« v3.1 »), ou module proposé en alternative. */
  version?: string;
  alternative?: string;
  raison?: string;
  par: string;
  depuis: string;
}

/** `suivis` : qui suit quoi. Clé : `org:<id>`, `support:<id>`, `dossier:<id>`… */
export interface Suivi {
  par?: string;
  at?: string;
  relache?: boolean;
}

/** `parcReleves` : le relevé du jour (clé AAAA-MM-JJ), une ligne par organisation. */
export interface ReleveParc {
  jour: string;
  at: string;
  orgs: Record<string, { poids: number; points: Record<string, number>; score?: number | null; actif?: boolean; suivi?: string; silenceJ?: number | null; enPanne?: boolean }>;
}

/** `parcRegles` : une automatisation de Supervisor (`46d`). */
export interface RegleParc {
  sujet: string;
  condition: string;
  duree: number;
  action: string;
  pourQui: string;
  sauf: string;
  active: boolean;
  nom?: string;
  creePar?: string;
  creeLe?: string;
}

/** `parcDeclenchements` : ce qu'une règle a fait (clé règle:org:jour). */
export interface DeclenchementParc {
  regleId: string;
  orgId: string;
  jour: string;
  at: string;
  tacheId?: string | null;
  quoi: string;
  /** Ce que le déclenchement est devenu. */
  suite?: 'fait' | 'en cours' | 'sans suite';
}

/** `parcoursBugs` : le bug d'une seule cliente (`46g`). */
export interface ParcoursBug {
  orgId: string;
  module: string;
  titre: string;
  cause?: string;
  gravite: 'critique' | 'haute' | 'moyenne' | 'faible';
  /** Les sept stations, dans l'ordre ; la date de chacune quand elle est faite. */
  stations: Partial<Record<StationBug, string>>;
  /** Le mode de protection choisi à la troisième station. */
  protection?: 'pause' | 'epinglee';
  version?: string;
  message?: string;
  touchees?: number;
  suiviPar?: string;
  ouvertLe: string;
  incidentId?: string | null;
}

export type StationBug = 'signalement' | 'fiche' | 'protection' | 'message' | 'correction' | 'reactivation' | 'cloture';
export const STATIONS_BUG: { cle: StationBug; nom: string }[] = [
  { cle: 'signalement', nom: 'Signalement' },
  { cle: 'fiche', nom: 'Fiche incident' },
  { cle: 'protection', nom: 'Pause ou version épinglée' },
  { cle: 'message', nom: 'Message à la cliente' },
  { cle: 'correction', nom: 'Correction' },
  { cle: 'reactivation', nom: 'Réactivation' },
  { cle: 'cloture', nom: 'Clôture' },
];

/* ═══ CYBER — cahier 13 ═══════════════════════════════════════════════ */

/** Les huit contrôles de la matrice (`47a`), dans l'ordre des colonnes. */
export type ControleCle = 'certificats' | 'courriel' | 'mfa' | 'sauvegardes' | 'mises_a_jour' | 'exposition' | 'fuites' | 'journalisation';
export type EtatControle = 'conforme' | 'partiel' | 'non_conforme' | 'critique';
/** D'où vient ce qu'on sait d'un actif ou d'un contrôle : le relevé de nuit, le desktop de la cliente, ou quelqu'un qui l'a déclaré. */
export type SourceRelevee = 'releve' | 'desktop' | 'declare';

/** `postureControles` (clé = id de l'organisation) : ses contrôles relevés. */
export interface ControlesOrg {
  controles: Partial<Record<ControleCle, { etat: EtatControle; source: SourceRelevee; at: string; par?: string; note?: string }>>;
}

export type FamilleActif = 'domaine' | 'site' | 'certificat' | 'compte' | 'poste' | 'sauvegarde';
/** `inventaire` : un actif d'une cliente (`47d`), et son échéance s'il en a une (`47e`). */
export interface Actif {
  orgId: string;
  famille: FamilleActif;
  nom: string;
  source: SourceRelevee;
  /** AAAA-MM-JJ. */
  echeance?: string | null;
  /** Ce que l'échéance renouvelle : la ligne de la frise des 90 jours. */
  echeanceType?: 'certificat' | 'domaine' | 'licence' | 'renouvellement' | null;
  renouvelleSeul?: boolean;
  /** Un défaut connu, écrit tel quel (« DMARC absent »). */
  defaut?: string | null;
  at: string;
  par?: string;
}

/** `incidentsFiches` (clé = id de l'incident) : ce que l'équipe a fait, et ce qu'elle doit faire (`47c`). */
export interface FicheIncident {
  orgId?: string | null;
  actions?: { id: string; at: string; quoi: string; par: string }[];
  prochaine?: { quoi: string; avant: string; par?: string | null } | null;
  elements?: string[];
  notes?: { id: string; texte: string; par: string; at: string }[];
  cloture?: { id: string; texte: string; fait: boolean }[];
}

/** `playbooks` : une procédure (`47g`). Une copie pour une cliente garde la trace de son original. */
export interface Playbook {
  nom: string;
  description?: string;
  etapes: { id: string; texte: string; si?: string | null }[];
  pourOrg?: string | null;
  origine?: string | null;
  creePar?: string;
  at?: string;
}
/** `playbookRuns` : un emploi d'un playbook. */
export interface PlaybookRun {
  playbookId: string;
  orgId?: string | null;
  incidentId?: string | null;
  lancePar: string;
  lanceLe: string;
  /** id d'étape → date où elle a été cochée. */
  faites: Record<string, string>;
  closLe?: string | null;
}

/** `carnet` : une note du carnet de bord (`47i`) — jamais sans lien. */
export interface NoteCarnet {
  texte: string;
  liens: { type: 'incident' | 'cliente' | 'actif' | 'campagne'; id: string; label: string }[];
  question?: boolean;
  resolue?: boolean;
  par: string;
  at: string;
}

/** `rapportsPosture` : le rapport mensuel d'une cliente (`47h`), tel qu'il est parti. */
export interface RapportPosture {
  orgId: string;
  mois: string;
  score: number | null;
  courbe: (number | null)[];
  aFaire: string[];
  echeance?: { quoi: string; date: string } | null;
  envoyeLe?: string | null;
  par?: string;
}

/** `rotationsSecrets` : un secret technique d'une cliente et sa période de rotation. Jamais la valeur. */
export interface Secret {
  orgId: string;
  nom: string;
  type: string;
  derniereRotation: string | null;
  periodeJours: number;
  par?: string;
}

/**
 * `hameconnages` : le SUIVI d'un exercice de sensibilisation mené chez une
 * cliente, avec son accord. Le produit n'envoie aucun courriel piégé : il
 * planifie, consigne les chiffres rapportés et garde le bilan.
 */
export interface Hameconnage {
  orgId: string;
  titre: string;
  date: string;
  accordPar: string;
  cibles: number;
  cliques: number | null;
  signales: number | null;
  notes?: string;
  par: string;
}

/** `exercicesCrise` : une panne simulée, pas à pas. */
export interface ExerciceCrise {
  orgId?: string | null;
  scenario: string;
  date: string;
  etapes: { id: string; texte: string; faiteLe?: string | null; qui?: string | null }[];
  bilan?: string;
  par: string;
}

/* ═══ STUDIO — cahier 14 ══════════════════════════════════════════════ */

/** `studioPieces` : une pièce projet (une porte, une fenêtre de la façade). */
export interface PieceStudio {
  numero: number;
  orgId?: string | null;
  orgNom: string;
  /** Ce qu'on y construit (« site vitrine, 6 pages »). */
  quoi: string;
  siteId?: string | null;
  url?: string | null;
  enLigneLe?: string | null;
  /** Une version suivante est en préparation. */
  chantier?: boolean;
  /** Une demande de validation ouverte côté cliente : la pièce est « attente client ». */
  validation?: { question: string; ouverteLe: string; fermeeLe?: string | null } | null;
  retours?: { id: string; texte: string; page?: string | null; at: string; par?: string | null; traiteLe?: string | null }[];
  croquis?: { id: string; titre: string; genre: 'maquette' | 'croquis' | 'capture' | 'inspiration'; image?: string | null; legende?: string; rot?: number; punaises?: { n: number; x: number; y: number; texte: string; decision?: boolean; trancheeLe?: string | null }[] }[];
  prompts?: { id: string; nom: string; versions: { v: number; texte: string; resultat?: string; enLigne?: boolean; at: string; par?: string }[] }[];
  notes?: { id: string; texte: string; par: string; at: string }[];
  /** Les relevés hebdomadaires (lundi AAAA-MM-JJ) de l'analytique (`48c`). */
  mesures?: { semaine: string; visites: number; conversions: number; p75: number; dispo: number; erreurs: number; jours?: number[] }[];
  /** La cause d'une dégradation, quand on l'a trouvée. */
  causes?: Record<string, string>;
  livraison?: {
    version: string;
    points: { id: string; texte: string; bloquant: boolean; coche: boolean }[];
    misesEnLigne?: { version: string; at: string; par: string }[];
  };
  /** Budget de performance : poids par page, en Ko, contre un plafond. */
  budget?: { plafondKo: number; pages: { page: string; ko: number }[] };
  /** Recette visuelle : ce qui a bougé entre deux captures. */
  recettes?: { id: string; page: string; avant?: string | null; apres?: string | null; ecarts: string[]; at: string; validee?: boolean }[];
  /** Accessibilité : les manques relevés. */
  accessibilite?: { id: string; critere: 'contraste' | 'alternative' | 'clavier' | 'titres' | 'formulaires'; page: string; texte: string; corrige?: boolean }[];
}

/* ═══ STRATÉGIE — cahier 14 ═══════════════════════════════════════════ */

export type EtapeCampagne = 'idee' | 'scenario' | 'production' | 'publiee' | 'close';
/** `campagnes` : une campagne (`49a`), et son storyboard (`49b`). */
export interface Campagne {
  titre: string;
  etape: EtapeCampagne;
  resultat?: string | null;
  bloquee?: { raison: string; depuis: string } | null;
  programmeeLe?: string | null;
  publieeLe?: string | null;
  /** Les prospects qu'elle cible (ids de `prospects`) — un fil sur le mur. */
  prospects?: string[];
  /** Semaine après semaine, depuis sa publication. */
  courbe?: number[];
  rapporte?: string | null;
  plans?: { id: string; duree: number; visuel?: string | null; quoi: string }[];
  creePar?: string;
  at?: string;
}
/** `publications` : le calendrier éditorial (`49c`). */
export interface Publication {
  jour: string;
  canal: 'LI' | 'IG' | 'FB' | 'YT' | 'TT';
  titre: string;
  etat: 'publiee' | 'programmee' | 'a_valider';
  campagneId?: string | null;
  par?: string;
}
/** `strategieMur` : une pièce punaisée sur le mur (`45d`), et les chiffres en notes. */
export interface PieceMur {
  type: 'campagne' | 'prospect' | 'chiffre';
  refId?: string | null;
  x: number;
  y: number;
  rot: number;
  valeur?: string;
  libelle?: string;
  campagneId?: string | null;
}
/** `temoignages` : la banque de témoignages. */
export interface Temoignage {
  orgId?: string | null;
  auteur: string;
  texte: string;
  accord: 'oui' | 'non' | 'en_attente';
  campagnes?: string[];
  at: string;
}
/**
 * Un prospect, tel que le lit Stratégie : la fiche du module Prospects, plus
 * la prochaine étape et l'historique des échanges. Les champs ajoutés sont
 * facultatifs : une fiche écrite par le module Prospects reste lisible.
 */
export interface ProspectStrategie {
  name: string;
  company: string;
  valueCents: number;
  stage: 'contact' | 'qualifie' | 'proposition' | 'gagne' | 'perdu';
  note: string;
  source?: string;
  createdAt: string;
  movedAt: string;
  ville?: string | null;
  prochaine?: { quoi: string; at: string; appel?: boolean } | null;
  echanges?: { id: string; type: 'envoi' | 'ouverture' | 'page' | 'appel' | 'rdv' | 'note'; texte: string; at: string }[];
  campagneId?: string | null;
}
