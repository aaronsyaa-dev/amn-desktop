import type { SyncedCollection } from '../shared/api';
import { langueActive } from '../i18n';

/**
 * LE POINT DE DÉPART PAR PROFIL — « certaines personnes ne savent pas comment
 * s'organiser : le produit doit les aider à le faire ».
 *
 * Un profil de départ n'est pas une formule ni un rôle : c'est une façon
 * d'entrer. Il pose les modules épinglés, allège ceux qui n'ont rien à faire
 * dans la barre de cette personne, choisit un Accueil, et donne TROIS OU
 * QUATRE PREMIERS PAS concrets — chacun relié à un module, et coché par les
 * données réelles (une tâche existe, un client existe), jamais à la main.
 *
 * Les listes vivent dans `@edition/guide` : l'édition cliente n'embarque pas
 * le profil « supervision », et l'édition interne n'a pas à proposer
 * « collégienne ». Les textes sont bilingues en place plutôt que dans le
 * dictionnaire : un profil est une pièce entière, pas dix clés éparses.
 */
export interface Bilingue {
  fr: string;
  en: string;
}

/** Comment un premier pas se coche : par une collection non vide, un module ouvert, ou un nombre de membres. */
export type Preuve =
  | { collection: SyncedCollection; min?: number }
  | { moduleOuvert: string }
  | { membres: number };

export interface PremierPas {
  id: string;
  titre: Bilingue;
  /** Où ce pas se fait. */
  to: string;
  /** Le module dont il dépend : sans lui dans l'organisation, le pas n'est pas proposé. */
  module: string;
  fait: Preuve;
}

export interface ProfilDepart {
  id: string;
  label: Bilingue;
  phrase: Bilingue;
  /** Les modules épinglés, dans l'ordre ; ceux que l'organisation n'a pas sont ignorés. */
  epingles: string[];
  /** Les modules allégés (retirés de la barre, jamais fermés). */
  alleges?: string[];
  /** L'Accueil choisi (code de variante) ; absent = on ne touche pas. */
  accueil?: string;
  /** Le panneau liste les familles par leur nom (pour qui ne lit pas encore les codes du rail). */
  indexFamilles?: boolean;
  premiersPas: PremierPas[];
}

export const texte = (b: Bilingue): string => (langueActive() === 'en' ? b.en : b.fr);

/* ── Les pas que plusieurs profils partagent ── */
export const PAS = {
  tache: { id: 'tache', titre: { fr: 'Noter une première tâche', en: 'Write down a first task' }, to: '/tasks', module: 'tasks', fait: { collection: 'tasks' } },
  rdv: { id: 'rdv', titre: { fr: 'Poser un premier rendez-vous', en: 'Book a first appointment' }, to: '/agenda', module: 'agenda', fait: { collection: 'appointments' } },
  client: { id: 'client', titre: { fr: 'Créer la fiche d’un premier client', en: 'Create a first client record' }, to: '/clients', module: 'clients', fait: { collection: 'clients' } },
  devis: { id: 'devis', titre: { fr: 'Faire un premier devis', en: 'Write a first quote' }, to: '/facturation/devis', module: 'invoices', fait: { collection: 'quotes' } },
  projet: { id: 'projet', titre: { fr: 'Ouvrir un premier projet', en: 'Open a first project' }, to: '/projets', module: 'projects', fait: { collection: 'projects' } },
  note: { id: 'note', titre: { fr: 'Écrire une note', en: 'Write a note' }, to: '/notes', module: 'notes', fait: { collection: 'notes' } },
  depense: { id: 'depense', titre: { fr: 'Noter une dépense', en: 'Log an expense' }, to: '/depenses', module: 'expenses', fait: { collection: 'expenses' } },
  membre: { id: 'membre', titre: { fr: 'Inviter une personne de l’équipe', en: 'Invite a teammate' }, to: '/membres', module: 'members', fait: { membres: 2 } },
  habitude: { id: 'habitude', titre: { fr: 'Choisir une habitude à tenir', en: 'Pick a habit to keep' }, to: '/personnel/habitudes', module: 'habits', fait: { moduleOuvert: 'habits' } },
  objectifs: { id: 'objectifs', titre: { fr: 'Poser trois objectifs pour la saison', en: 'Set three goals for the season' }, to: '/objectifs-resultats', module: 'okr', fait: { collection: 'okrs' } },
  reunion: { id: 'reunion', titre: { fr: 'Préparer une première réunion', en: 'Prepare a first meeting' }, to: '/reunions', module: 'meetings', fait: { collection: 'meetings' } },
  tableau: { id: 'tableau', titre: { fr: 'Regarder le tableau de bord', en: 'Look at the dashboard' }, to: '/tableau-de-bord', module: 'dashboard', fait: { moduleOuvert: 'dashboard' } },
  accueils: { id: 'accueils', titre: { fr: 'Choisir votre Accueil dans Paramètres', en: 'Choose your Home in Settings' }, to: '/settings', module: 'settings', fait: { moduleOuvert: 'settings' } },
} satisfies Record<string, PremierPas>;

/** Une page de la présentation du produit, à la première connexion (U4). */
export interface PagePresentation {
  sur: Bilingue;
  titre: Bilingue;
  texte: Bilingue;
  /** Le petit dessin de la page, construit avec les briques du système. */
  dessin: 'coquille' | 'journee' | 'familles' | 'equipe' | 'coffre' | 'aide' | 'supervision';
}
