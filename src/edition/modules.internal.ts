import {
  BadgeCheck,
  BookOpen,
  Building2,
  Calculator,
  CalendarDays,
  CheckSquare,
  Contact,
  FileText,
  Globe,
  History,
  Images,
  LayoutDashboard,
  Lock,
  LockKeyhole,
  MonitorDot,
  NotebookPen,
  Radar,
  FolderKanban,
  ReceiptEuro,
  Scale,
  ScanLine,
  Settings,
  Timer,
  Users,
  Wallet,
} from 'lucide-react';
import type { NavSection } from '../data/navigation';
import type { ActivityTab } from '../state/ActivityContext';

/**
 * Les modules d'AMN Desktop — l'édition interne d'AMN DevSec.
 *
 * Cette liste alimente la barre latérale, le lanceur et la palette de
 * commandes. C'est aussi elle qui décide, module par module, ce qui existe dans
 * un build : l'édition Business résout `@edition/modules` vers
 * `modules.business.ts`, et rien de ce qui suit n'y est compilé.
 *
 * Depuis la refonte, chaque section porte son ESPACE (voir src/data/spaces.ts).
 * Une seule barre latérale plate mélangeait le travail quotidien et les
 * produits de cybersécurité : à deux personnes et quatre produits ça tenait, à
 * l'échelle de « plein de clients » plus rien ne se distinguait. Les deux
 * espaces ne cachent rien l'un de l'autre — ils répondent à deux questions
 * différentes, et on choisit laquelle on se pose.
 *
 * Les chemins n'ont PAS bougé. Déplacer `/tracker` sous `/tour/tracker` aurait
 * cassé les liens profonds, la mémoire d'onglet, les pastilles d'activité et
 * les entrées de la palette pour un gain purement cosmétique : l'espace est une
 * propriété du module, pas un préfixe d'URL.
 */
/** Ce qu'un poste tout neuf épingle — les cinq écrans réellement ouverts chaque jour. */
export const DEFAULT_FAVORITES = ['home', 'agenda', 'team', 'tasks', 'clients'] as const;

export const NAV_SECTIONS: NavSection[] = [
  {
    key: 'travail',
    label: 'Travail',
    space: 'workspace',
    items: [
      { key: 'home', label: 'Accueil', to: '/', icon: LayoutDashboard, hint: 'Le QG du jour' },
      { key: 'tasks', label: 'Tâches', to: '/tasks', icon: CheckSquare, hint: 'Travail partagé' },
      { key: 'notes', label: 'Notes', to: '/notes', icon: NotebookPen, hint: 'Bloc-notes' },
      { key: 'clients', label: 'Clients', to: '/clients', icon: Contact, hint: 'Fiches et devis' },
      // Même module que chez les clientes : nous facturons aussi nos
      // prestations, et un devis accepté doit pouvoir devenir une facture ici
      // sans ressaisie. Rien dans cet écran n'est spécifique à une édition.
      { key: 'invoices', label: 'Facturation', to: '/facturation', icon: ReceiptEuro, hint: 'Factures et encaissements' },
      // Les projets juste après la facturation : c'est le point de
      // rattachement de tout le reste, pas un module de plus.
      { key: 'projects', label: 'Projets', to: '/projets', icon: FolderKanban, hint: 'Ce qui avance, et ce qui bloque' },
      // Mêmes modules que chez les clientes, et pour la même raison que
      // Facturation : nous avons aussi des frais et du temps à suivre, et un
      // module qu'on n'utilise pas soi-même est un module qu'on livre mal.
      { key: 'expenses', label: 'Dépenses', to: '/depenses', icon: Wallet, hint: 'Frais et justificatifs' },
      { key: 'time', label: 'Temps', to: '/temps', icon: Timer, hint: 'Chronomètre et temps passé' },
      // Les calculateurs métier : un moteur, des profils déclarés en données.
      // Placés après Dépenses et Temps parce qu'ils s'appuient dessus — la
      // synthèse du mois agrège la facturation, les frais et le temps.
      { key: 'calculators', label: 'Calculateurs', to: '/calculateurs', icon: Calculator, hint: 'Prix, marges, répartition' },
      { key: 'sites', label: 'Sites', to: '/sites', icon: Globe, hint: 'Registre des sites clients' },
      { key: 'team', label: 'Équipe', to: '/team', icon: Users, hint: 'Messagerie et présence' },
      { key: 'reports', label: 'Rapports', to: '/reports', icon: FileText, hint: 'Livrables clients' },
      { key: 'media', label: 'Médias', to: '/media', icon: Images, hint: 'Bibliothèque' },
      // Le calendrier a été construit pour les clientes ; il manquait ici, où
      // les rendez-vous se prennent aussi. Même écran, même collection.
      { key: 'agenda', label: 'Calendrier', to: '/agenda', icon: CalendarDays, hint: 'Rendez-vous et disponibilités' },
    ],
  },
  {
    key: 'memoire',
    label: 'Mémoire',
    space: 'workspace',
    items: [
      { key: 'decisions', label: 'Décisions', to: '/decisions', icon: Scale, hint: 'Journal des arbitrages' },
      { key: 'knowledge', label: 'Connaissances', to: '/knowledge', icon: BookOpen, hint: 'Base interne' },
    ],
  },
  {
    key: 'systeme',
    label: 'Système',
    space: 'workspace',
    items: [
      { key: 'settings', label: 'Paramètres', to: '/settings', icon: Settings, hint: 'Profil et notifications' },
      { key: 'vault', label: 'Coffre-fort', to: '/vault', icon: Lock, hint: 'Clés et accès' },
    ],
  },
  {
    key: 'tour',
    label: 'Tour de contrôle',
    space: 'control',
    items: [
      { key: 'tour', label: 'Vue d’ensemble', to: '/tour', icon: MonitorDot, hint: 'Le mur du SOC' },
      { key: 'orgs', label: 'Organisations', to: '/tour/organisations', icon: Building2, hint: 'Toutes les clientes gérées' },
      { key: 'access', label: 'Journal d’accès', to: '/tour/journal', icon: History, hint: 'Qui est entré chez qui' },
    ],
  },
  {
    key: 'produits',
    label: 'Produits',
    space: 'control',
    items: [
      { key: 'tracker', label: 'Trackers', to: '/tracker', icon: Radar, hint: 'Supervision temps réel' },
      { key: 'scanner', label: 'Scanner', to: '/scanner', icon: ScanLine, hint: 'Analyse de vulnérabilités' },
      { key: 'comply', label: 'Comply', to: '/comply', icon: BadgeCheck, hint: 'Conformité RGPD' },
      { key: 'ssl', label: 'SSL Monitor', to: '/ssl', icon: LockKeyhole, hint: 'Certificats TLS' },
    ],
  },
];

/**
 * Identité réservée de l'assistant dans le chat d'équipe. Les enregistrements
 * qu'il écrit ne comptent pas comme « activité de l'autre opérateur ».
 */
export const AJMANI_EMAIL = 'ajmani@amn-devsec.com';

/** Onglets dont la collection est partagée et où « l'autre a ajouté » a du sens. */
export const ACTIVITY_TABS: ActivityTab[] = [
  { routeKey: '/team', collection: 'messages', noun: 'Message' },
  { routeKey: '/tasks', collection: 'tasks', noun: 'Tâche' },
  { routeKey: '/decisions', collection: 'decisions', noun: 'Décision' },
  { routeKey: '/knowledge', collection: 'knowledge', noun: 'Connaissance' },
  { routeKey: '/notes', collection: 'notes', noun: 'Note' },
  // Le calendrier entre dans le Poste de travail : un rendez-vous ajouté par
  // l'un doit se signaler à l'autre, exactement comme une tâche.
  { routeKey: '/agenda', collection: 'appointments', noun: 'Rendez-vous' },
];


/**
 * Correspondance chemin → « pièce » d'animation (voir lib/transitions.ts).
 * Le préfixe le plus long d'abord : `/tracker/site/:id` doit tomber sur la
 * même entrée que `/tracker`, pas sur le défaut.
 */
export const PAGE_ROOMS: [string, string][] = [
  // Les trois écrans de la Tour de contrôle partagent l'entrée « supervision » :
  // on y arrive par le haut, comme sur un mur d'écrans qui s'allume.
  ['/tour', 'supervision'],
  ['/agenda', 'registre'],
  ['/sites', 'registre'],
  ['/team', 'fil'],
  ['/tasks', 'tableau'],
  ['/clients', 'fiches'],
  ['/facturation', 'fiches'],
  ['/projets', 'tableau'],
  ['/depenses', 'fiches'],
  ['/temps', 'registre'],
  ['/calculateurs', 'analyse'],
  ['/tracker', 'supervision'],
  ['/scanner', 'analyse'],
  ['/comply', 'analyse'],
  // SSL Monitor est un écran produit comme les deux autres — même entrée.
  ['/ssl', 'analyse'],
  ['/decisions', 'journal'],
  ['/knowledge', 'base'],
  ['/reports', 'livrables'],
  ['/settings', 'reglages'],
  ['/vault', 'coffre'],
];
