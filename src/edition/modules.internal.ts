import {
  BadgeCheck,
  BookOpen,
  CheckSquare,
  Contact,
  FileText,
  Globe,
  Images,
  LayoutDashboard,
  Lock,
  LockKeyhole,
  NotebookPen,
  Radar,
  Scale,
  ScanLine,
  Settings,
  Users,
} from 'lucide-react';
import type { NavSection } from '../data/navigation';
import type { ActivityTab } from '../state/ActivityContext';

/**
 * Les modules d'AMN Desktop — l'édition interne d'AMN DevSec.
 *
 * Cette liste alimente deux surfaces : la barre latérale épinglée et la grille
 * du lanceur. C'est aussi elle qui décide, module par module, ce qui existe
 * dans un build : l'édition Business résout `@edition/modules` vers
 * `modules.business.ts`, et rien de ce qui suit n'y est compilé.
 */
/** Ce qu'un poste tout neuf épingle — les cinq écrans réellement ouverts chaque jour. */
export const DEFAULT_FAVORITES = ['home', 'sites', 'team', 'tasks', 'tracker'] as const;

export const NAV_SECTIONS: NavSection[] = [
  {
    key: 'travail',
    label: 'Travail',
    items: [
      { key: 'home', label: 'Accueil', to: '/', icon: LayoutDashboard, hint: 'Le QG du jour' },
      { key: 'sites', label: 'Sites', to: '/sites', icon: Globe, hint: 'Registre des sites clients' },
      { key: 'team', label: 'Équipe', to: '/team', icon: Users, hint: 'Messagerie et présence' },
      { key: 'tasks', label: 'Tâches', to: '/tasks', icon: CheckSquare, hint: 'Travail partagé' },
      { key: 'clients', label: 'Clients', to: '/clients', icon: Contact, hint: 'Fiches et devis' },
      { key: 'decisions', label: 'Décisions', to: '/decisions', icon: Scale, hint: 'Journal des arbitrages' },
      { key: 'knowledge', label: 'Connaissances', to: '/knowledge', icon: BookOpen, hint: 'Base interne' },
      { key: 'notes', label: 'Notes', to: '/notes', icon: NotebookPen, hint: 'Bloc-notes' },
      { key: 'media', label: 'Médias', to: '/media', icon: Images, hint: 'Bibliothèque' },
      { key: 'reports', label: 'Rapports', to: '/reports', icon: FileText, hint: 'Livrables clients' },
    ],
  },
  {
    key: 'produits',
    label: 'Produits',
    items: [
      { key: 'tracker', label: 'Trackers', to: '/tracker', icon: Radar, hint: 'Supervision temps réel' },
      { key: 'scanner', label: 'Scanner', to: '/scanner', icon: ScanLine, hint: 'Analyse de vulnérabilités' },
      { key: 'comply', label: 'Comply', to: '/comply', icon: BadgeCheck, hint: 'Conformité RGPD' },
      { key: 'ssl', label: 'SSL Monitor', to: '/ssl', icon: LockKeyhole, hint: 'Certificats TLS' },
    ],
  },
  {
    key: 'systeme',
    label: 'Système',
    items: [
      { key: 'settings', label: 'Paramètres', to: '/settings', icon: Settings, hint: 'Profil et notifications' },
      { key: 'vault', label: 'Coffre-fort', to: '/vault', icon: Lock, hint: 'Clés et accès' },
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
];


/**
 * Correspondance chemin → « pièce » d'animation (voir lib/transitions.ts).
 * Le préfixe le plus long d'abord : `/tracker/site/:id` doit tomber sur la
 * même entrée que `/tracker`, pas sur le défaut.
 */
export const PAGE_ROOMS: [string, string][] = [
  ['/sites', 'registre'],
  ['/team', 'fil'],
  ['/tasks', 'tableau'],
  ['/clients', 'fiches'],
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
