import {
  CalendarDays,
  CheckSquare,
  Contact,
  FileText,
  Images,
  LayoutDashboard,
  Lock,
  NotebookPen,
  FolderKanban,
  ReceiptEuro,
  Settings,
  Timer,
  Wallet,
} from 'lucide-react';
import type { NavSection } from '../data/navigation';
import type { ActivityTab } from '../state/ActivityContext';

/**
 * Les modules d'AMN Business — l'édition livrée aux organisations clientes.
 *
 * Ce n'est pas la liste interne amputée : c'est la liste d'un outil de gestion
 * d'activité pour quelqu'un qui travaille seul. Le calendrier passe en
 * deuxième position parce que c'est le module qui sera ouvert tous les jours,
 * avant même les fiches clients.
 *
 * Ce qui n'y figure pas n'y figure pas non plus dans le bundle :
 *   - Sites, Trackers, Scanner, Comply, SSL Monitor — produits exclusifs
 *     d'AMN DevSec ;
 *   - Équipe, Décisions, Connaissances — outils de collaboration, sans objet
 *     pour une personne seule.
 *
 * Il n'y a donc pas de section « Produits » ici : une section vide dans le
 * lanceur dirait « il y a autre chose, mais pas pour vous », ce qui est
 * exactement l'impression à éviter.
 */
/**
 * Ce qu'une installation toute neuve épingle. L'agenda d'abord : c'est le
 * module de tous les jours, et il doit être à un clic dès la première ouverture.
 */
export const DEFAULT_FAVORITES = ['home', 'agenda', 'clients', 'invoices', 'tasks'] as const;

export const NAV_SECTIONS: NavSection[] = [
  {
    key: 'travail',
    label: 'Activité',
    items: [
      { key: 'home', label: 'Accueil', to: '/', icon: LayoutDashboard, hint: 'Votre journée' },
      { key: 'agenda', label: 'Agenda', to: '/agenda', icon: CalendarDays, hint: 'Rendez-vous et disponibilités' },
      { key: 'clients', label: 'Clients', to: '/clients', icon: Contact, hint: 'Fiches et devis' },
      // Juste après Clients, parce que c'est la suite du même geste : on
      // propose un devis, puis on facture. Épinglé par défaut — savoir qui
      // doit de l'argent est quotidien, pas occasionnel.
      { key: 'invoices', label: 'Facturation', to: '/facturation', icon: ReceiptEuro, hint: 'Factures et encaissements' },
      // Les projets juste après la facturation : c'est le point de
      // rattachement de tout le reste, pas un module de plus.
      { key: 'projects', label: 'Projets', to: '/projets', icon: FolderKanban, hint: 'Ce qui avance, et ce qui bloque' },
      { key: 'tasks', label: 'Tâches', to: '/tasks', icon: CheckSquare, hint: 'Ce qu’il reste à faire' },
      // Dépenses et Temps encadrent les tâches : ce sont les deux faces de ce
      // qu'une prestation coûte réellement — ce qu'on sort, et ce qu'on y
      // passe. Les séparer dans deux coins de la navigation reviendrait à
      // dire qu'ils n'ont rien à voir l'un avec l'autre.
      { key: 'expenses', label: 'Dépenses', to: '/depenses', icon: Wallet, hint: 'Ce que vous sortez, avec les reçus' },
      { key: 'time', label: 'Temps', to: '/temps', icon: Timer, hint: 'Chronomètre et temps passé' },
      { key: 'notes', label: 'Notes', to: '/notes', icon: NotebookPen, hint: 'Bloc-notes' },
      { key: 'media', label: 'Médias', to: '/media', icon: Images, hint: 'Photos et fichiers' },
      { key: 'reports', label: 'Rapports', to: '/reports', icon: FileText, hint: 'Comptes-rendus' },
    ],
  },
  {
    key: 'systeme',
    label: 'Système',
    items: [
      { key: 'settings', label: 'Paramètres', to: '/settings', icon: Settings, hint: 'Profil et notifications' },
      { key: 'vault', label: 'Coffre-fort', to: '/vault', icon: Lock, hint: 'Mots de passe et accès' },
    ],
  },
];

/**
 * Pas d'assistant dans cette édition : la chaîne vide ne peut correspondre à
 * aucun auteur d'enregistrement, donc le filtre d'activité la traverse sans
 * rien exclure.
 */
export const AJMANI_EMAIL = '';

/**
 * Onglets suivis pour les pastilles « non vu ».
 *
 * Utile même à une seule personne : la synchronisation entre son ordinateur et
 * son téléphone fait bien apparaître, d'un appareil à l'autre, ce qu'elle a
 * ajouté depuis l'autre.
 */
export const ACTIVITY_TABS: ActivityTab[] = [
  { routeKey: '/agenda', collection: 'appointments', noun: 'Rendez-vous' },
  { routeKey: '/tasks', collection: 'tasks', noun: 'Tâche' },
  { routeKey: '/clients', collection: 'clients', noun: 'Client' },
  { routeKey: '/notes', collection: 'notes', noun: 'Note' },
  { routeKey: '/media', collection: 'media', noun: 'Média' },
  // Une dépense saisie sur le téléphone doit se signaler sur le poste — c'est
  // le cas d'usage même du module : on photographie le reçu dehors, on
  // retrouve la dépense en rentrant. Le temps n'y figure pas : un chronomètre
  // en cours ferait clignoter une pastille en permanence.
  { routeKey: '/depenses', collection: 'expenses', noun: 'Dépense' },
];


/** Correspondance chemin → « pièce » d'animation (voir lib/transitions.ts). */
export const PAGE_ROOMS: [string, string][] = [
  ['/agenda', 'registre'],
  ['/tasks', 'tableau'],
  ['/clients', 'fiches'],
  ['/facturation', 'fiches'],
  ['/projets', 'tableau'],
  ['/depenses', 'fiches'],
  ['/temps', 'registre'],
  ['/notes', 'journal'],
  ['/media', 'base'],
  ['/reports', 'livrables'],
  ['/settings', 'reglages'],
  ['/vault', 'coffre'],
];
