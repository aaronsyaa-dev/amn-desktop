/**
 * FORMES DES JEUX DE DONNÉES FICTIVES
 * ═══════════════════════════════════
 *
 * Deux règles de nommage, pour que rien ne se heurte au code existant :
 *
 *   · un champ qui existe déjà dans le dépôt GARDE son nom (`title`, `status`,
 *     `assigneeEmail`, `amountCents`…) : c'est ce que lisent les modules d'aujourd'hui ;
 *   · un champ que seule une fiche de la refonte réclame est en FRANÇAIS
 *     (`etiquettes`, `sousTaches`, `sante`…). Chacun cite sa fiche ; quand la
 *     fiche dit « à confirmer dans le code », le champ est une proposition.
 *
 * Quand un type du dépôt existe (`Client`, `Invoice`, `Quote`, `Appointment`,
 * `Expense`, `Note`, `Project`), le type d'ici en est un SUR-ENSEMBLE, et
 * `compat.ts` le vérifie à la compilation : un jeu se donne tel quel à ce qui
 * attend l'ancien type.
 *
 * Montants : toujours en centimes entiers (`...Cents`), TTC sauf mention
 * contraire dans le nom. Dates : ISO complètes pour un instant, `AAAA-MM-JJ`
 * pour un jour. Aucun secret, aucun numéro de carte, aucun IBAN complet.
 */

import type { Client, Invoice, InvoiceLine, Quote } from '../../shared/api';
import type { Appointment } from '../../state/useAppointments';
import type { Expense } from '../../state/expenseEngine';
import type { Note } from '../../state/useNotes';
import type { ProjectData } from '../../state/projectEngine';
import type { Jour, Volume } from './outils';

/* ----------------------------- Contexte ----------------------------- */

/** Les jeux qu'on peut demander, un par un ou dans le monde entier. */
export const NOMS_DES_JEUX = [
  // Base
  'equipe',
  // Ma journée
  'taches',
  'evenements',
  'projets',
  'tickets',
  'notes',
  'rappels',
  'habitudes',
  // Contacts
  'clients',
  'interlocuteurs',
  'prospects',
  'fournisseurs',
  'achats',
  'avis',
  'relances',
  'fidelite',
  // L'argent
  'devis',
  'factures',
  'paiements',
  'depenses',
  'abonnements',
  'contrats',
  'comptes',
  'mouvements',
  'enveloppes',
] as const;
export type NomDuJeu = (typeof NOMS_DES_JEUX)[number];

export interface Contexte {
  /** La graine : même graine, mêmes données. */
  graine: number;
  /** « Maintenant », en ms. Rien dans les jeux ne lit l'horloge. */
  maintenant: number;
  /** Le jour de Paris de `maintenant`. */
  aujourdhui: Jour;
  /** Le volume demandé pour chaque jeu. */
  volumes: Record<NomDuJeu, Volume>;
}

/* ------------------------------- Équipe ------------------------------- */

/** MC04 (Équipe), H19 (Membres et accès). Rôles : ceux de MC04. */
export type RoleMembre = 'Administrateur' | 'Membre' | 'Invité' | 'Partenaire';

export interface Membre {
  id: string;
  prenom: string;
  nom: string;
  nomComplet: string;
  initiales: string;
  email: string;
  role: RoleMembre;
  fonction: string;
  specialites: string[];
  statut: 'en ligne' | 'hors ligne' | 'absent';
  /** Vrai pour la personne « connectée » dans les écrans (une seule). */
  moi: boolean;
  /** Indice 0 à 7 : l'une des huit teintes d'équipe du socle (jamais un code couleur). */
  teinte: number;
  /** H19. */
  doubleAuthentification: boolean;
  derniereActiviteAt: string;
  /** MJ01 « Charge de l'équipe », MJ03 : heures disponibles par semaine. */
  heuresSemaine: number;
  /** MJ03 : la personne est en congé sur ces jours. */
  congesJours: Jour[];
}

/** Valeurs d'entreprise lues par plusieurs écrans (réglages, identité de facturation). */
export interface Entreprise {
  nom: string;
  formeJuridique: string;
  secteur: string;
  ville: string;
  adresse: string;
  email: string;
  telephone: string;
  siteWeb: string;
  /** Identité légale telle que la lit le module Facturation (`BillingIdentity`), valeurs INVALIDES par construction. */
  identite: {
    legalName: string;
    address: string;
    legalForm: string;
    siret: string;
    vatNumber: string;
    rcsCity: string;
    capital: string;
    email: string;
    phone: string;
    iban: string;
    bic: string;
    vatExempt: boolean;
    paymentTermDays: number;
    latePenaltyRate: number;
  };
  /** Réglages « à confirmer dans le code » que les fiches supposent (une valeur par défaut crédible). */
  reglages: {
    heureFinDeJournee: string;
    objectifProjetsTrimestre: number;
    objectifSignaturesMois: number;
    astreinteEmail: string;
    tauxTva: number[];
    delaiRelanceDevisJours: number;
    delaiRelanceFactureJours: number;
    delaiRelanceRendezVousJours: number;
    delaiRelanceProspectJours: number;
    budgetMensuelDepensesCents: number;
  };
}

/* ----------------------------- Ma journée ----------------------------- */

export interface SousTache {
  id: string;
  title: string;
  done: boolean;
}

/**
 * H02 (Tâches), N01, MJ01. Sur-ensemble de `SharedTask` (title, detail, status,
 * assigneeEmail, siteId, clientId, createdAt, updatedAt) ; `id` est la clé
 * d'enregistrement de la collection `tasks`.
 */
export interface Tache {
  id: string;
  title: string;
  detail: string;
  status: 'todo' | 'doing' | 'done';
  assigneeEmail: string;
  siteId: string | null;
  clientId: number | null;
  createdAt: string;
  updatedAt: string;
  /** Jour d'échéance (`AAAA-MM-JJ`) ou null. */
  echeance: Jour | null;
  /** Heure facultative `HH:MM`, ou un créneau nommé (« Ce soir »). */
  heure: string | null;
  urgent: boolean;
  etiquettes: string[];
  sousTaches: SousTache[];
  /** Personnes qui suivent la tâche sans en être responsables (H02, « Mes tâches »). */
  suiviPar: string[];
  projectId: string | null;
  /** Instant où elle a été faite (null tant qu'elle ne l'est pas). */
  faiteAt: string | null;
}

export type TypeEvenement = 'rendez-vous client' | 'réunion' | 'facturation' | 'bilan' | 'chantier' | 'personnel' | 'système';

/**
 * H01 (Calendrier), MC06, MJ03. Sur-ensemble d'`Appointment`.
 * `systeme` = événement produit par l'application (ronde de La Garde) : il ne
 * compte pas dans « n rendez-vous » (N01).
 */
export interface Evenement extends Appointment {
  type: TypeEvenement;
  /** Fin de l'événement (ISO) = début + durée, pratique pour la grille. */
  endAt: string;
  participants: string[];
  /** Famille de couleur de l'objet lié (règle de H01). */
  famille: 'jour' | 'contacts' | 'argent' | 'creer' | 'outils' | 'gris';
  factureId: string | null;
  /** MC06 : confirmé / à confirmer / manqué. */
  confirmation: 'confirmé' | 'à confirmer' | 'manqué';
  /** MC06 : salle, visio ou chez le client. */
  mode: 'salle' | 'visio' | 'chez le client' | 'téléphone';
  systeme: boolean;
}

export type StatutProjet = 'À démarrer' | 'En cours' | 'Presque fini' | 'En retard' | 'Terminé';

/** MJ01. Sur-ensemble de `ProjectData` (+ `id`, `updatedAt`). `status` suit la règle d'affichage de la fiche. */
export interface Projet extends ProjectData {
  id: string;
  updatedAt: string;
  description: string;
  icone: string;
  membres: string[];
  jalons: { id: string; title: string; jour: Jour; fait: boolean }[];
  /** Avancement saisi à la main, utilisé seulement quand le projet n'a aucune tâche liée (MJ01). */
  avancementManuel: number | null;
  termineLe: Jour | null;
  archive: boolean;
}

export type ColonneTicket = 'a-faire' | 'en-cours' | 'en-revue' | 'termine';

/** H03 (Missions et tickets, kanban). */
export interface Ticket {
  id: string;
  title: string;
  detail: string;
  colonne: ColonneTicket;
  urgent: boolean;
  clientId: number | null;
  clientNom: string | null;
  etiquette: string;
  sousTaches: { faites: number; total: number };
  assigneeEmail: string;
  echeance: Jour | null;
  termineLe: Jour | null;
  commentaires: number;
  partageClient: boolean;
  /** Ordre dans la colonne (0 = en haut), hors règle « urgents en tête ». */
  ordre: number;
  creeLe: string;
  /** Instant de la première lecture par la personne d'astreinte (carte « Urgent » de N01). */
  luAt: string | null;
}

/** MJ04. Sur-ensemble de `Note`. */
export interface NoteRapide extends Note {
  etiquette: string | null;
  visibilite: 'privée' | 'équipe' | 'personnes choisies';
  clientId: number | null;
  tacheId: string | null;
  /** Point blanc « non lue » : créée ou modifiée ailleurs depuis la dernière ouverture. */
  nonLue: boolean;
}

/** MJ05. */
export interface Rappel {
  id: string;
  title: string;
  sousTitre: string;
  pourEmail: string;
  /** Instant du rappel (ISO). */
  quandAt: string;
  fait: boolean;
  faitAt: string | null;
  /** Combien de temps avant l'heure le rappel doit se déclencher (minutes). */
  avanceeMin: number;
  lien: { type: 'client' | 'facture' | 'tache' | 'devis' | null; id: string | null };
  recurrence: null | { regle: string; actif: boolean; prochaineAt: string };
  visibilite: 'équipe' | 'privé';
  canal: 'application' | 'application et mobile' | 'courriel';
  urgent: boolean;
  creeParEmail: string;
  /** Rappel posé par l'application elle-même (sauvegarde hebdomadaire…). */
  systeme: boolean;
}

/** MJ02. Une valeur par jour de l'historique ; le jeu garde 120 jours. */
export interface Habitude {
  id: string;
  nom: string;
  description: string;
  icone: string;
  frequence: { type: 'tous les jours' | 'jours choisis' | 'fois par semaine'; jours?: number[]; fois?: number };
  mesure: { type: 'case' } | { type: 'objectif'; cible: number; unite: string };
  source: 'manuelle' | 'téléphone' | 'module';
  proprietaireEmail: string;
  debut: Jour;
  archivee: boolean;
  /** Jour → quantité faite (1 pour une case cochée). Absent = non fait. */
  historique: Record<Jour, number>;
}

/* ------------------------------ Contacts ------------------------------ */

export type StatutClientAffiche = 'Actif' | 'À relancer' | 'Impayé';

/**
 * H05, G04, T02, F10. Sur-ensemble de `Client`. Les champs `sante` et
 * `statutAffiche` sont COHÉRENTS avec les factures du monde (une facture échue
 * non réglée ⇒ « Impayé »), mais un écran doit les RECALCULER : ils sont donnés
 * ici pour comparer.
 */
export interface FicheClient extends Client {
  secteur: string;
  ville: string;
  adresse: string;
  siteWeb: string;
  responsableEmail: string;
  debutLe: Jour;
  dernierEchangeAt: string;
  sante: number;
  statutAffiche: StatutClientAffiche;
  /** Type de client (organisation ou personne, MC02). */
  nature: 'organisation' | 'personne';
  tags: string[];
}

/** MC03. */
export interface Interlocuteur {
  id: string;
  prenom: string;
  nom: string;
  nomComplet: string;
  fonction: string;
  organisationType: 'client' | 'prospect' | 'fournisseur' | 'partenaire';
  organisationId: string;
  organisationNom: string;
  email: string;
  telephone: string;
  notes: string;
  favori: boolean;
  dernierEchangeAt: string;
  /** Au moins un message entrant non lu (point de la liste). */
  nonLu: boolean;
  preference: 'courriel' | 'téléphone' | 'messagerie';
}

export type EtapeProspect = 'nouveau' | 'contacté' | 'rendez-vous' | 'devis envoyé' | 'gagné' | 'perdu';

/** H06 (Prospects) et MC01 (Pipeline) : même donnée, deux regroupements (voir `groupePipeline`). */
export interface Prospect {
  id: string;
  nom: string;
  contactNom: string;
  offre: string;
  montantCents: number | null;
  recurrence: null | 'mois' | 'an';
  etape: EtapeProspect;
  /** Probabilité 0 à 100 (H06). */
  probabilite: number;
  responsableEmail: string;
  prochaineAction: string;
  prochaineActionLe: Jour | null;
  urgent: boolean;
  checklist: { faites: number; total: number };
  creeLe: Jour;
  signeLe: Jour | null;
  perduLe: Jour | null;
  /** Client créé à la signature. */
  clientId: number | null;
}

/** H45. */
export interface Fournisseur {
  id: string;
  nom: string;
  categorie: string;
  contactNom: string;
  email: string;
  telephone: string;
  adresse: string;
  delaiAnnonceJours: number;
  note: string;
  /** Négociation enregistrée (sert à la suggestion « renégocier » de H45). */
  negociationLe: Jour | null;
}

/** H45 : historique d'achats (commandes aux fournisseurs). */
export interface Achat {
  id: string;
  fournisseurId: string;
  commandeLe: Jour;
  recuLe: Jour | null;
  article: string;
  quantite: number;
  prixUnitaireCents: number;
  totalCents: number;
  conforme: boolean;
}

/** H44. */
export interface Avis {
  id: string;
  clientId: number;
  clientNom: string;
  /** Sur 5 (échelle unique retenue pour les jeux : voir l'écart noté dans 04-ECARTS). */
  noteSur5: number;
  /** Recommandation 0 à 10, quand le client l'a donnée. */
  recommandation: number | null;
  texte: string;
  date: Jour;
  themes: string[];
  canal: 'courriel' | 'message' | 'lien public';
}

export type MotifRelance = 'devis' | 'facture' | 'rendez-vous' | 'prospect' | 'inactif';

/** MC07. Dérivées des factures échues, devis sans réponse, rendez-vous manqués, prospects en attente. */
export interface Relance {
  id: string;
  clientId: number | null;
  clientNom: string;
  motif: MotifRelance;
  objetId: string;
  objetLibelle: string;
  montantCents: number | null;
  departLe: Jour;
  etat: 'prête' | 'envoyée' | 'répondue' | 'arrêtée';
  message: string;
  nbEnvoyees: number;
  derniereEnvoiLe: Jour | null;
}

/** MC02. Calculé depuis les factures payées (1 point par euro encaissé, sur 12 mois). */
export interface CompteFidelite {
  clientId: number;
  clientNom: string;
  points: number;
  niveau: 'Bronze' | 'Argent' | 'Or';
  derniereActiviteLe: Jour;
  avantages: { id: string; libelle: string; valeurCents: number; statut: 'Offert' | 'Utilisé' | 'Expiré'; le: Jour }[];
}

/* ------------------------------- L'argent ------------------------------- */

/** H07. Sur-ensemble de `Quote` : `priceEuro` = total HT en euros ; les lignes sont en centimes HT. */
export interface Devis extends Quote {
  numero: string;
  clientNom: string;
  lignes: InvoiceLine[];
  validiteJusquau: Jour;
  vuAt: string | null;
  acceptéLe: Jour | null;
  refuséLe: Jour | null;
  /** Prestation proposée, reprise du catalogue de MA12. */
  prestation: string;
}

/**
 * G03, MA04, F30. Sur-ensemble d'`Invoice`. « En retard » n'est PAS un statut
 * stocké : c'est `issued` avec une échéance passée (voir `statutAffiche`).
 */
export interface Facture extends Invoice {
  clientNom: string;
  responsableEmail: string;
  /** Solde restant dû en centimes (0 si payée ou annulée), pour contrôler le calcul des écrans. */
  soldeCents: number;
}

/** MA03. Jamais de numéro de carte ni de clé : seulement des totaux et des références. */
export interface Paiement {
  id: string;
  factureId: string | null;
  clientId: number | null;
  clientNom: string;
  moyen: 'carte' | 'virement' | 'prélèvement' | 'chèque' | 'espèces';
  montantCents: number;
  fraisCents: number;
  etat: 'réussi' | 'en attente' | 'échoué' | 'remboursé';
  date: string;
  reference: string;
}

/** H08, MA05. Sur-ensemble d'`Expense` (montant TTC en centimes). */
export interface Depense extends Expense {
  libelle: string;
  fournisseur: string;
  tvaCents: number;
  moyenPaiement: 'carte' | 'virement' | 'prélèvement' | 'espèces';
  justificatif: { statut: 'justifié' | 'à justifier'; fichier: string | null };
  auteurEmail: string;
  /** Vrai pour une note de frais avancée par un membre (MA05). */
  noteDeFrais: boolean;
  remboursee: boolean;
}

/** MA09. */
export interface Abonnement {
  id: string;
  clientId: number;
  clientNom: string;
  plan: string;
  montantMensuelCents: number;
  depuis: Jour;
  jourPrelevement: number;
  prochainPrelevementLe: Jour | null;
  etat: 'Actif' | 'Paiement échoué' | 'En pause' | 'Résilié';
  resilieLe: Jour | null;
}

/** MA01. */
export interface Contrat {
  id: string;
  nom: string;
  clientId: number;
  clientNom: string;
  periode: 'Annuel' | 'Trimestriel' | 'Mensuel';
  valeurParPeriodeCents: number;
  debutLe: Jour;
  echeanceLe: Jour;
  reconduction: 'tacite' | 'manuelle';
  etat: 'En cours' | 'À renouveler' | 'Expiré' | 'Résilié';
}

/** MA10. L'IBAN n'est jamais complet : seuls les 4 derniers caractères, fictifs. */
export interface CompteBancaire {
  id: string;
  nom: string;
  etablissement: string;
  ibanFin: string;
  soldeCents: number;
  synchroniseLe: string;
  accesLectureSeule: boolean;
}

/** MA07, MA10. Montant signé : positif = entrée, négatif = sortie. */
export interface Mouvement {
  id: string;
  compteId: string;
  libelle: string;
  nature: string;
  categorie: string;
  date: Jour;
  montantCents: number;
  /** Réel (déjà passé en banque) ou prévu (trésorerie). */
  reel: boolean;
  rapprochement: 'rapproché' | 'à vérifier' | 'sans objet';
  lien: { type: 'facture' | 'depense' | 'abonnement' | 'paiement' | 'manuel'; id: string | null };
  recurrent: boolean;
}

/** MA06. */
export interface Enveloppe {
  id: string;
  nom: string;
  description: string;
  icone: string;
  prevuCents: number;
  responsables: string[];
  categories: string[];
  mois: string;
}

/* -------------------------------- Le monde -------------------------------- */

/** Tous les jeux, cohérents entre eux, pour un contexte donné. */
export interface Monde {
  contexte: Contexte;
  entreprise: Entreprise;
  equipe: Membre[];
  taches: Tache[];
  evenements: Evenement[];
  projets: Projet[];
  tickets: Ticket[];
  notes: NoteRapide[];
  rappels: Rappel[];
  habitudes: Habitude[];
  clients: FicheClient[];
  interlocuteurs: Interlocuteur[];
  prospects: Prospect[];
  fournisseurs: Fournisseur[];
  achats: Achat[];
  avis: Avis[];
  relances: Relance[];
  fidelite: CompteFidelite[];
  devis: Devis[];
  factures: Facture[];
  paiements: Paiement[];
  depenses: Depense[];
  abonnements: Abonnement[];
  contrats: Contrat[];
  comptes: CompteBancaire[];
  mouvements: Mouvement[];
  enveloppes: Enveloppe[];
}
