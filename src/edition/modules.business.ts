import {
  Calculator,
  CalendarDays,
  ShoppingBag,
  CheckSquare,
  Contact,
  FileText,
  Images,
  LayoutDashboard,
  LayoutTemplate,
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
  /*
    LES MÊMES GROUPES QUE L'ÉDITION INTERNE, ET C'EST VOULU (REFONTE)
    ─────────────────────────────────────────────────────────────────
    « Activité » comptait douze entrées : la même liste plate que côté interne,
    avec le même défaut — à douze lignes, l'œil ne reconnaît plus de forme.

    Le découpage reprend celui de l'édition interne (Pilotage, Clients &
    revenus, Production, Documents, Système), non par facilité mais parce que
    la parité EST l'exigence : une cliente ne doit pas recevoir une version
    dégradée de ce qu'Aaron a sous les yeux. Ce qui diffère ici, ce sont les
    modules disponibles — pas le soin apporté à leur rangement.

    Les groupes qui n'ont pas d'objet pour quelqu'un qui travaille seul ne sont
    pas montrés vides : « Collectif » n'existe pas dans cette édition, il ne
    s'affiche donc nulle part. Une section vide dirait « il y a autre chose,
    mais pas pour vous ».
  */
  {
    key: 'pilotage',
    label: 'Pilotage',
    items: [
      { key: 'home', label: 'Accueil', to: '/', icon: LayoutDashboard, hint: 'Votre journée' },
      { key: 'agenda', label: 'Agenda', to: '/agenda', icon: CalendarDays, hint: 'Rendez-vous et disponibilités' },
      { key: 'projects', label: 'Projets', to: '/projets', icon: FolderKanban, hint: 'Ce qui avance, et ce qui bloque' },
      { key: 'tasks', label: 'Tâches', to: '/tasks', icon: CheckSquare, hint: 'Ce qu’il reste à faire' },
    ],
  },
  {
    key: 'commerce',
    label: 'Clients & revenus',
    // La chaîne complète d'un euro dans son ordre réel : une fiche, un devis
    // qui devient une facture, et les commandes qui arrivent du site sans que
    // personne les ait saisies. Pour une boutique, c'est l'écran du matin.
    items: [
      { key: 'clients', label: 'Clients', to: '/clients', icon: Contact, hint: 'Fiches et devis' },
      { key: 'invoices', label: 'Facturation', to: '/facturation', icon: ReceiptEuro, hint: 'Factures et encaissements' },
      { key: 'orders', label: 'Commandes', to: '/commandes', icon: ShoppingBag, hint: 'Reçues du site' },
    ],
  },
  {
    key: 'production',
    label: 'Production',
    // Les deux faces de ce qu'une prestation coûte — ce qu'on sort, ce qu'on y
    // passe — et l'outil qui en tire un prix. Les calculateurs agrègent
    // précisément les deux autres.
    items: [
      { key: 'time', label: 'Temps', to: '/temps', icon: Timer, hint: 'Chronomètre et temps passé' },
      { key: 'expenses', label: 'Dépenses', to: '/depenses', icon: Wallet, hint: 'Ce que vous sortez, avec les reçus' },
      { key: 'calculators', label: 'Calculateurs', to: '/calculateurs', icon: Calculator, hint: 'Prix, marges, répartition' },
    ],
  },
  {
    key: 'documents',
    label: 'Documents',
    items: [
      { key: 'notes', label: 'Notes', to: '/notes', icon: NotebookPen, hint: 'Bloc-notes' },
      // Voisin des Notes, et distinct d'elles : une note est un jet personnel,
      // une page est un support qu'on tient à jour et que d'autres relisent.
      { key: 'pages', label: 'Pages', to: '/pages', icon: LayoutTemplate, hint: 'Fiches et supports partagés' },
      { key: 'reports', label: 'Rapports', to: '/reports', icon: FileText, hint: 'Comptes-rendus' },
      { key: 'media', label: 'Médias', to: '/media', icon: Images, hint: 'Photos et fichiers' },
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
  // Une page est écrite à plusieurs : c'est justement le module où « quelqu'un
  // a changé quelque chose depuis l'autre appareil » mérite d'être signalé.
  { routeKey: '/pages', collection: 'pages', noun: 'Page' },
  { routeKey: '/media', collection: 'media', noun: 'Média' },
  // Une dépense saisie sur le téléphone doit se signaler sur le poste — c'est
  // le cas d'usage même du module : on photographie le reçu dehors, on
  // retrouve la dépense en rentrant. Le temps n'y figure pas : un chronomètre
  // en cours ferait clignoter une pastille en permanence.
  { routeKey: '/depenses', collection: 'expenses', noun: 'Dépense' },
  // Le cas le plus fort de cette liste : une commande arrive du site, personne
  // ne l'a écrite, donc personne ne l'attend. La pastille est le seul signal.
  { routeKey: '/commandes', collection: 'orders', noun: 'Commande' },
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
  ['/calculateurs', 'analyse'],
  ['/commandes', 'fiches'],
  ['/notes', 'journal'],
  ['/pages', 'journal'],
  ['/media', 'base'],
  ['/reports', 'livrables'],
  ['/settings', 'reglages'],
  ['/vault', 'coffre'],
];
