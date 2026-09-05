/** Ce que la Garde rend au poste (miroir des objets de amn-api/src/garde/store.js). */
export type GardeEtatAgent = 'repos' | 'ronde' | 'trouve' | 'echec';
export type GardeGravite = 'critique' | 'haute' | 'normale';

export interface GardeAgent {
  key: string;
  equipe: string;
  nom: string;
  role: string;
  everyMs: number;
  etat: GardeEtatAgent;
  phrase: string;
  actif: boolean;
  echecs: number;
  derniereRondeAt: string | null;
  prochaineRondeAt: string | null;
  parametres: Record<string, Record<string, unknown>> & { __curseurs?: Record<string, unknown> };
  couloir: Record<string, Record<string, { min: number; max: number }>>;
  geleOrgs: string[];
}
export interface GardeRegle {
  description: string;
  parametres: Record<string, unknown>;
  apprend: boolean;
  rejouable?: boolean;
}
export interface GardeDefinitionAgent {
  key: string;
  nom: string;
  role: string;
  prises: { lit: string[]; modifie: string[]; demande: string[] };
  regles: Record<string, GardeRegle>;
}
export interface GardeEquipe {
  key: string;
  nom: string;
  chef: { nom: string; role: string };
  agents: GardeDefinitionAgent[];
}
export interface GardePouls {
  niveau: 'calme' | 'attention' | 'critique';
  phrase: string;
  compte: { ouvertes: number; critiques: number; hautes: number; normales: number; decidees: number; resolues: number };
  agents: number;
  enEchec: string[];
  absence: GardeAbsence | null;
  at: string;
}
export interface GardeAbsence {
  depuis: string;
  jusqua: string | null;
  par: string;
  mandat: { decideSeul: string[]; gele: string[]; escalade: string };
}
export interface GardeSalle {
  equipes: GardeEquipe[];
  agents: GardeAgent[];
  pouls: GardePouls;
  absence: GardeAbsence | null;
  priorite: { texte: string; par: string; at: string; jusqua: string } | null;
  reglages: { heureTour: number };
  lexique: string;
}
export interface GardeJournalEntree {
  id: string;
  agent: string;
  equipe: string;
  orgId: string | null;
  ressource: string | null;
  action: string;
  pourquoi: string;
  regle: string | null;
  resultat: 'regle' | 'remonte' | 'refuse' | 'echec';
  detail: Record<string, unknown> | null;
  rondeId: string | null;
  mauvais: boolean;
  mauvaisNote: string | null;
  mauvaisPar: string | null;
  correction: { type: string; texte: string; at: string; par: string } | null;
  createdAt: string;
}
export interface GardeRonde {
  id: string;
  agent: string;
  debut: string;
  fin: string | null;
  dureeMs: number | null;
  lus: number;
  regles: number;
  remontes: number;
  resume: string;
  erreur: string | null;
}
export interface GardeRemontee {
  id: string;
  cle: string;
  agent: string;
  equipe: string;
  orgId: string | null;
  gravite: GardeGravite;
  titre: string;
  contexte: string;
  options: string[];
  recommandation: string | null;
  preuves: unknown[];
  etat: 'ouverte' | 'decidee' | 'resolue' | 'ignoree';
  decision: string | null;
  decideePar: string | null;
  tacheId: string | null;
  compte: number;
  differee: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface GardeMessage {
  id: string;
  agent: string;
  canal: 'bureau' | 'commune' | 'pile';
  texte: string;
  preuves: string[];
  lu: boolean;
  createdAt: string;
}
export interface GardeProposition {
  id: string;
  agent: string;
  regle: string;
  parametre: string;
  valeurActuelle: number;
  valeurProposee: number;
  preuve: { stats?: { total: number; mauvais: number }; etSi?: { avant: number | null; apres: number | null; phrase?: string; note?: string } } | null;
  etat: 'proposee' | 'appliquee' | 'refusee';
  createdAt: string;
}
export interface GardeOrdreReponse {
  ordre: { id: string; etat: string; texte: string };
  intention: string | null;
  params: Record<string, unknown> | null;
  reponse: string;
  question?: string;
  confirmation?: string;
  remontees?: GardeRemontee[];
  releve?: GardeReleve;
  reponses?: GardeMessage[];
}
export interface GardeReleve {
  at: string;
  jour: string;
  texte: string;
  lignes: string[];
  compte: GardePouls['compte'];
  totaux: { regles: number; remontes: number; echecs: number };
}
export interface GardeCalendrierItem {
  at: string;
  agent: string;
  equipe: string;
  quoi: string;
  periode: number | null;
  orgId?: string;
}
export interface GardeBureau {
  equipe: { key: string; nom: string; chef: { nom: string; role: string } };
  agents: GardeAgent[];
  comptes: Record<string, number>;
  remontees: GardeRemontee[];
  messages: GardeMessage[];
  journal: GardeJournalEntree[];
  propositions: GardeProposition[];
}
