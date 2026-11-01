import type { Famille } from '../../../socle/familles';
import type { EtatPastille, TonGraphique } from '../../../socle/ui';

/**
 * LES DONNÉES D'EXEMPLE DE LA PAGE DE DÉMONSTRATION DU SOCLE — FICTIVES et GÉNÉRIQUES.
 *
 * Aucun nom propre, aucune donnée réelle : des libellés comme « Projet A » ou « Personne 1 ». Rien ici ne vient
 * d'une maquette ni d'une base. `check:systeme-demo` refuse les noms de la maquette et les données qui y
 * ressembleraient.
 *
 * Seules deux choses dépendent de l'heure : `evenementsDeLaSemaine` (la semaine courante) et `nomsDesJours`
 * (la langue). Les deux sont des fonctions pures : la date de référence arrive en argument.
 */

/** Huit personnes : « Personne 1 » à « Personne 6 » couvrent les six teintes d'avatar. */
export const PERSONNES: string[] = Array.from({ length: 8 }, (_, i) => `Personne ${i + 1}`);

/** Des clients ou organisations (avatars carrés). */
export const ORGANISATIONS: string[] = ['Client A', 'Client B', 'Client C', 'Client D'];

/* ── Le tableau : une ligne par type de cellule ─────────────────────────────────────────────────────────────── */

export interface LigneExemple {
  id: string;
  nom: string;
  sousTitre: string;
  type: string;
  etat: EtatPastille;
  /** De 0 à 1. */
  avancement: number;
  responsables: string[];
  montant: number;
  /** L'état qui colore le montant, s'il y en a un. */
  etatMontant?: EtatPastille;
  categorie: { libelle: string; famille: Famille };
  echeance: Date;
  fait: boolean;
  canal: string;
  actif: boolean;
}

export const LIGNES_TABLEAU: LigneExemple[] = [
  { id: 'l1', nom: 'Projet A', sousTitre: 'Client A', type: 'Mission', etat: 'succes', avancement: 1, responsables: ['Personne 1'], montant: 4200, categorie: { libelle: 'Conseil', famille: 'contacts' }, echeance: new Date(2026, 10, 4), fait: true, canal: 'Courriel', actif: true },
  { id: 'l2', nom: 'Projet B', sousTitre: 'Client B', type: 'Contrat', etat: 'info', avancement: 0.72, responsables: ['Personne 2', 'Personne 3'], montant: 1250, categorie: { libelle: 'Étude', famille: 'ecrire' }, echeance: new Date(2026, 10, 12), fait: false, canal: 'Appel', actif: true },
  { id: 'l3', nom: 'Projet C', sousTitre: 'Client C', type: 'Mission', etat: 'attention', avancement: 0.48, responsables: ['Personne 4'], montant: 860.5, etatMontant: 'attention', categorie: { libelle: 'Atelier', famille: 'creer' }, echeance: new Date(2026, 10, 18), fait: false, canal: 'Message', actif: false },
  { id: 'l4', nom: 'Projet D', sousTitre: 'Client D', type: 'Étude', etat: 'critique', avancement: 0.21, responsables: ['Personne 5', 'Personne 6', 'Personne 7', 'Personne 8'], montant: 3100, etatMontant: 'critique', categorie: { libelle: 'Suivi', famille: 'jour' }, echeance: new Date(2026, 9, 28), fait: false, canal: 'Courriel', actif: true },
  { id: 'l5', nom: 'Projet E', sousTitre: 'Client A', type: 'Contrat', etat: 'neutre', avancement: 0, responsables: ['Personne 3'], montant: 0, categorie: { libelle: 'Brouillon', famille: 'outils' }, echeance: new Date(2026, 11, 2), fait: false, canal: 'Appel', actif: false },
  { id: 'l6', nom: 'Projet F', sousTitre: 'Client B', type: 'Mission', etat: 'succes', avancement: 0.9, responsables: ['Personne 1', 'Personne 2'], montant: 5400, etatMontant: 'succes', categorie: { libelle: 'Conseil', famille: 'contacts' }, echeance: new Date(2026, 10, 25), fait: true, canal: 'Message', actif: true },
];

/* ── Le kanban : trois colonnes ──────────────────────────────────────────────────────────────────────────── */

export interface TicketExemple {
  id: string;
  titre: string;
  urgent?: boolean;
  tags: { libelle: string; famille?: Famille }[];
  progression?: { fait: number; total: number };
  responsables: string[];
  /** Un nombre de jours depuis la référence (négatif : en retard). */
  echeanceEnJours?: number;
  commentaires?: number;
}

export interface ColonneExemple {
  cle: 'afaire' | 'encours' | 'termine';
  accent: Famille | EtatPastille;
  limite?: number;
  tickets: TicketExemple[];
}

export const COLONNES_KANBAN: ColonneExemple[] = [
  {
    cle: 'afaire',
    accent: 'info',
    tickets: [
      { id: 't1', titre: 'Tâche A', tags: [{ libelle: 'Étude', famille: 'ecrire' }], responsables: ['Personne 1'], echeanceEnJours: 5, commentaires: 2 },
      { id: 't2', titre: 'Tâche B', urgent: true, tags: [{ libelle: 'Suivi', famille: 'jour' }], progression: { fait: 0, total: 4 }, responsables: ['Personne 2'], echeanceEnJours: -1 },
    ],
  },
  {
    cle: 'encours',
    accent: 'attention',
    limite: 3,
    tickets: [
      { id: 't3', titre: 'Tâche C', tags: [{ libelle: 'Atelier', famille: 'creer' }], progression: { fait: 2, total: 5 }, responsables: ['Personne 3', 'Personne 4'], echeanceEnJours: 2, commentaires: 5 },
      { id: 't4', titre: 'Tâche D', tags: [{ libelle: 'Conseil', famille: 'contacts' }], progression: { fait: 3, total: 4 }, responsables: ['Personne 1'], echeanceEnJours: 7 },
      { id: 't5', titre: 'Tâche E', urgent: true, tags: [{ libelle: 'Suivi', famille: 'jour' }, { libelle: 'Étude', famille: 'ecrire' }], progression: { fait: 1, total: 6 }, responsables: ['Personne 2'], echeanceEnJours: 0, commentaires: 1 },
    ],
  },
  {
    cle: 'termine',
    accent: 'succes',
    tickets: [{ id: 't6', titre: 'Tâche F', tags: [{ libelle: 'Conseil', famille: 'contacts' }], progression: { fait: 5, total: 5 }, responsables: ['Personne 5'] }],
  },
];

/* ── La grille de cartes : six modules ──────────────────────────────────────────────────────────────────── */

export interface ModuleExemple {
  id: string;
  titre: string;
  famille: Famille;
  progression: number;
  personnes: string[];
  etat: EtatPastille;
}

export const MODULES: ModuleExemple[] = [
  { id: 'm1', titre: 'Module A', famille: 'jour', progression: 0.82, personnes: ['Personne 1', 'Personne 2'], etat: 'succes' },
  { id: 'm2', titre: 'Module B', famille: 'contacts', progression: 0.64, personnes: ['Personne 3'], etat: 'info' },
  { id: 'm3', titre: 'Module C', famille: 'ecrire', progression: 0.4, personnes: ['Personne 2', 'Personne 4', 'Personne 5'], etat: 'attention' },
  { id: 'm4', titre: 'Module D', famille: 'argent', progression: 0.91, personnes: ['Personne 6'], etat: 'succes' },
  { id: 'm5', titre: 'Module E', famille: 'echanger', progression: 0.28, personnes: ['Personne 1', 'Personne 3', 'Personne 7', 'Personne 8'], etat: 'critique' },
  { id: 'm6', titre: 'Module F', famille: 'creer', progression: 0.55, personnes: ['Personne 4'], etat: 'neutre' },
];

/* ── Le scindé : une liste, un détail ───────────────────────────────────────────────────────────────────── */

export interface MessageExemple {
  id: string;
  titre: string;
  heure: string;
  nonLu: boolean;
}

export const MESSAGES: MessageExemple[] = [
  { id: 'c1', titre: 'Message A', heure: '09:12', nonLu: true },
  { id: 'c2', titre: 'Message B', heure: '08:40', nonLu: true },
  { id: 'c3', titre: 'Message C', heure: 'Hier', nonLu: false },
  { id: 'c4', titre: 'Message D', heure: 'Hier', nonLu: false },
  { id: 'c5', titre: 'Message E', heure: 'Lun.', nonLu: false },
];

/* ── La chronologie ─────────────────────────────────────────────────────────────────────────────────────── */

export interface MomentExemple {
  id: string;
  heure: string;
  titre: string;
  detail: string;
  famille?: Famille;
  etat?: EtatPastille;
}

export const MOMENTS: MomentExemple[] = [
  { id: 'h1', heure: '09:00', titre: 'Événement A', detail: 'Personne 1 · Client A', famille: 'jour' },
  { id: 'h2', heure: '11:30', titre: 'Événement B', detail: 'Personne 2', famille: 'echanger' },
  { id: 'h3', heure: '14:00', titre: 'Événement C', detail: 'Client B', etat: 'critique' },
  { id: 'h4', heure: '16:45', titre: 'Événement D', detail: 'Personne 3', etat: 'succes' },
];

/* ── La semaine courante : cinq événements générés par rapport à la date de référence ──────────────────────── */

export interface EvenementExemple {
  id: string;
  titre: string;
  detail: string;
  debut: Date;
  fin: Date;
  famille: Famille;
}

/** Le lundi (à minuit, heure locale) de la semaine qui contient `reference`. */
export function lundiDe(reference: Date): Date {
  const decalage = (reference.getDay() + 6) % 7;
  return new Date(reference.getFullYear(), reference.getMonth(), reference.getDate() - decalage);
}

/**
 * Cinq événements dans la semaine de `reference` : deux aujourd'hui (l'un chevauche l'autre, pour montrer le côte à
 * côte), puis trois autres jours de la même semaine. Les jours sont pris modulo 7 depuis le lundi, donc jamais
 * hors de la semaine affichée, quel que soit le jour où l'on ouvre la page.
 */
export function evenementsDeLaSemaine(reference: Date): { debut: Date; evenements: EvenementExemple[] } {
  const lundi = lundiDe(reference);
  const aujourdhui = (reference.getDay() + 6) % 7;
  const a = (jour: number, heure: number, minute = 0): Date => new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + (((jour % 7) + 7) % 7), heure, minute);
  const evenements: EvenementExemple[] = [
    { id: 'e1', titre: 'Événement A', detail: 'Salle 1', debut: a(aujourdhui, 9), fin: a(aujourdhui, 10, 30), famille: 'jour' },
    { id: 'e2', titre: 'Événement B', detail: 'Client A', debut: a(aujourdhui, 10), fin: a(aujourdhui, 11), famille: 'contacts' },
    { id: 'e3', titre: 'Événement C', detail: 'Personne 1', debut: a(aujourdhui + 1, 14), fin: a(aujourdhui + 1, 15, 30), famille: 'echanger' },
    { id: 'e4', titre: 'Événement D', detail: 'Salle 2', debut: a(aujourdhui + 2, 11), fin: a(aujourdhui + 2, 12), famille: 'creer' },
    { id: 'e5', titre: 'Événement E', detail: 'Client B', debut: a(aujourdhui + 5, 16), fin: a(aujourdhui + 5, 17, 30), famille: 'argent' },
  ];
  return { debut: lundi, evenements };
}

/** Les sept jours d'une série, du lundi au dimanche : nom entier (lecteurs d'écran) et initiale. */
export function nomsDesJours(locale: string): { nom: string; initiale: string }[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: 'long' });
  return Array.from({ length: 7 }, (_, i) => {
    const nom = format.format(new Date(2024, 0, 1 + i));
    return { nom, initiale: nom.charAt(0).toLocaleUpperCase(locale) };
  });
}

/* ── Les graphiques ─────────────────────────────────────────────────────────────────────────────────────── */

const MOIS = ['Sem. 1', 'Sem. 2', 'Sem. 3', 'Sem. 4', 'Sem. 5', 'Sem. 6', 'Sem. 7', 'Sem. 8', 'Sem. 9', 'Sem. 10', 'Sem. 11', 'Sem. 12'];
const SERIE_1 = [1200, 1850, 1600, 2300, 2100, 2750, 2500, 3100, 2900, 3400, 3250, 3900];
const SERIE_2 = [900, 1100, 1500, 1400, 1800, 1700, 2200, 2000, 2600, 2400, 2800, 3000];

export const COURBE = MOIS.map((etiquette, i) => ({ etiquette, valeur: SERIE_1[i] }));
export const COURBE_SECONDE: number[] = SERIE_2;
export const COURBE_UN_POINT = [{ etiquette: 'Sem. 1', valeur: 1800 }];

export const BARRES = [
  { etiquette: 'Lun.', valeur: 14 },
  { etiquette: 'Mar.', valeur: 22 },
  { etiquette: 'Mer.', valeur: 18 },
  { etiquette: 'Jeu.', valeur: 31 },
  { etiquette: 'Ven.', valeur: 26 },
  { etiquette: 'Sam.', valeur: 0 },
  { etiquette: 'Dim.', valeur: 9 },
];

export interface PartExemple {
  cle: 'a' | 'b' | 'c' | 'd';
  valeur: number;
  ton: TonGraphique;
}

export const PARTS_DONUT: PartExemple[] = [
  { cle: 'a', valeur: 4200, ton: 'info' },
  { cle: 'b', valeur: 2600, ton: 'argent' },
  { cle: 'c', valeur: 1700, ton: 'creer' },
  { cle: 'd', valeur: 900, ton: 'ecrire' },
];

export const TENDANCE: number[] = [12, 14, 13, 17, 16, 19, 18, 22, 21, 25, 24, 28];
export const TENDANCE_BAISSE: number[] = [28, 26, 27, 23, 24, 20, 21, 17, 18, 14, 15, 11];

/* ── Les indicateurs ────────────────────────────────────────────────────────────────────────────────────── */

export const SEUILS_SANTE: number[] = [0.82, 0.55, 0.3];
