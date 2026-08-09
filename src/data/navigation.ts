import type React from 'react';
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

/**
 * The application's modules, in one place (BLOC C).
 *
 * They used to be declared inside Sidebar.tsx, which meant every new product
 * made the sidebar one row taller — it had started to scroll. The same list now
 * feeds two surfaces: the short pinned strip in the sidebar, and the launcher's
 * grid, which is where growth actually goes.
 */

export interface NavItem {
  key: string;
  label: string;
  to: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  /** One line, shown in the launcher grid only. */
  hint: string;
}

export interface NavSection {
  key: string;
  label: string;
  items: NavItem[];
}

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

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export function navItemByKey(key: string): NavItem | undefined {
  return NAV_ITEMS.find((i) => i.key === key);
}
