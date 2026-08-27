import React, { useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calculator,
  CalendarDays,
  CheckSquare,
  Contact,
  FileText,
  FolderKanban,
  Images,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  NotebookPen,
  ReceiptEuro,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Timer,
  Wallet,
} from 'lucide-react';
import type { NavItem } from '../data/navigation';
import { isModuleEnabled } from '../data/spaces';
import { useOrgContext } from '../state/OrgContextContext';
import { OrgAvatar } from '../components/org-rail/OrgAvatar';
import { OrgSwitchButton } from '../components/org-rail/OrgSwitchButton';

const TRANSITION = { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const };

/**
 * La navigation d'un contexte client.
 *
 * Elle liste exactement les modules de l'édition Business — ni plus, ni moins.
 * C'est le point : l'opérateur doit voir ce que voit la cliente, pas une
 * version « interne » de son application. Y ajouter le moindre écran d'AMN
 * DevSec ferait de ce contexte un espace hybride qui n'existe chez personne, et
 * rendrait le support faux.
 *
 * La seule entrée qui n'est pas la sienne est « Administration », visuellement
 * détachée en bas : ce sont les gestes d'AMN DevSec SUR son organisation, et
 * ils n'ont rien à faire au milieu de ses écrans à elle.
 */
const CLIENT_MODULES: NavItem[] = [
  { key: 'home', label: 'Accueil', to: '/', icon: LayoutDashboard, hint: 'Sa journée' },
  { key: 'agenda', label: 'Agenda', to: '/agenda', icon: CalendarDays, hint: 'Rendez-vous' },
  { key: 'clients', label: 'Clients', to: '/clients', icon: Contact, hint: 'Fiches et devis' },
  { key: 'invoices', label: 'Facturation', to: '/facturation', icon: ReceiptEuro, hint: 'Factures et encaissements' },
  { key: 'projects', label: 'Projets', to: '/projets', icon: FolderKanban, hint: 'Ce qui avance, et ce qui bloque' },
  { key: 'tasks', label: 'Tâches', to: '/tasks', icon: CheckSquare, hint: 'Ce qu’il reste à faire' },
  { key: 'expenses', label: 'Dépenses', to: '/depenses', icon: Wallet, hint: 'Frais et justificatifs' },
  { key: 'time', label: 'Temps', to: '/temps', icon: Timer, hint: 'Chronomètre et temps passé' },
  { key: 'calculators', label: 'Calculateurs', to: '/calculateurs', icon: Calculator, hint: 'Prix, marges, répartition' },
  { key: 'orders', label: 'Commandes', to: '/commandes', icon: ShoppingBag, hint: 'Reçues du site' },
  { key: 'notes', label: 'Notes', to: '/notes', icon: NotebookPen, hint: 'Bloc-notes' },
  { key: 'pages', label: 'Pages', to: '/pages', icon: LayoutTemplate, hint: 'Fiches et supports partagés' },
  { key: 'reports', label: 'Rapports', to: '/reports', icon: FileText, hint: 'Comptes-rendus' },
  { key: 'media', label: 'Médias', to: '/media', icon: Images, hint: 'Photos et fichiers' },
  { key: 'settings', label: 'Paramètres', to: '/settings', icon: Settings, hint: 'Profil' },
];

/**
 * Le même catalogue, pour la barre du pouce (voir MobileBottomNav). Exporté
 * plutôt que recopié : deux listes de modules clientes finiraient par diverger,
 * et la barre basse annoncerait des écrans que le tiroir ne montre pas.
 */
export const CLIENT_NAV_ITEMS = CLIENT_MODULES;

/**
 * Le même rangement que sa barre à elle (REFONTE).
 *
 * L'édition Business groupe ses modules (Pilotage, Clients & revenus,
 * Production, Documents, Système) ; cette barre-ci doit montrer la MÊME chose,
 * puisque tout l'intérêt du contexte de support est de voir son application
 * telle qu'elle est chez elle. Les groupes sont redéclarés plutôt qu'importés :
 * `@edition/modules` est résolu à la compilation, et dans un build interne il
 * rend le catalogue interne — importer d'ici afficherait nos sections à nous.
 *
 * Le regroupement est déclaré par CLÉS, jamais par recopie des entrées : un
 * module ajouté au catalogue et oublié ici n'est pas perdu, il tombe dans le
 * dernier groupe (voir `clientSections`). Une barre qui perd silencieusement un
 * écran est exactement le défaut que `scripts/check-modules.mjs` a été écrit
 * pour attraper.
 */
export const CLIENT_SECTIONS: Array<{ label: string; keys: string[] }> = [
  { label: 'Pilotage', keys: ['home', 'agenda', 'projects', 'tasks'] },
  { label: 'Clients & revenus', keys: ['clients', 'invoices', 'orders'] },
  { label: 'Production', keys: ['time', 'expenses', 'calculators'] },
  { label: 'Documents', keys: ['notes', 'pages', 'reports', 'media'] },
  { label: 'Système', keys: ['settings'] },
];

/**
 * Les modules réellement ouverts à cette cliente (BLOC E).
 *
 * Calculé à l'affichage plutôt que figé : le support doit voir SON application
 * telle qu'elle est chez elle. Montrer un module qu'on lui a fermé donnerait
 * un contexte hybride qui n'existe nulle part, et rendrait le support faux —
 * la même raison qui interdit d'ajouter ici nos écrans internes.
 */
function clientModules(): NavItem[] {
  return CLIENT_MODULES.filter((item) => isModuleEnabled(item.key));
}

/**
 * Les modules ouverts, rangés par groupe. Un groupe vidé de tous ses modules
 * disparaît — un intitulé seul dirait « il y a autre chose, mais pas pour
 * vous ». Ce qu'aucun groupe ne réclame atterrit dans le dernier plutôt que de
 * disparaître : perdre un écran en silence serait pire que le mal ranger.
 */
function clientSections(): Array<{ label: string; items: NavItem[] }> {
  const open = clientModules();
  const claimed = new Set(CLIENT_SECTIONS.flatMap((s) => s.keys));
  // L'ordre du GROUPE, pas celui du catalogue. `CLIENT_MODULES` liste les
  // modules dans un ordre hérité (Dépenses avant Temps) ; l'édition Business,
  // elle, les présente dans l'ordre de ses sections. Filtrer le catalogue
  // rendait donc « Dépenses, Temps » ici et « Temps, Dépenses » chez elle —
  // deux fois la même liste, jamais dans le même ordre, ce qui est exactement
  // ce que ce contexte existe pour éviter.
  const sections = CLIENT_SECTIONS.map((section) => ({
    label: section.label,
    items: section.keys
      .map((key) => open.find((item) => item.key === key))
      .filter((item): item is NavItem => Boolean(item)),
  }));
  const orphans = open.filter((item) => !claimed.has(item.key));
  if (orphans.length > 0) {
    const last = sections[sections.length - 1];
    last.items = [...last.items, ...orphans];
  }
  return sections.filter((section) => section.items.length > 0);
}

export function ClientSidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const location = useLocation();
  const { support, leaveOrganization } = useOrgContext();

  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null || !mobileOpen) return;
    if ((e.changedTouches[0]?.clientX ?? start) - start < -45) onClose?.();
  };

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  return (
    <>
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="client-nav-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] md:hidden"
          />
        )}
      </AnimatePresence>

      <aside
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-56 flex-shrink-0 flex-col border-r border-border bg-[#0d0d0d] py-4 transition-transform duration-300 md:relative md:z-30 md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile : le rail est masqué, cette ligne le remplace. */}
        <div className="px-3 md:hidden">
          <OrgSwitchButton onNavigate={onClose} />
        </div>

        <div className="mb-3 hidden items-center gap-2.5 px-4 md:flex">
          <OrgAvatar
            name={support?.orgName ?? ''}
            logoDataUrl={support?.logoDataUrl}
            size={32}
            rounded="rounded-xl"
          />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold leading-tight text-text-primary">
              {support?.orgName}
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-text-muted">
              AMN Business
            </p>
          </div>
        </div>

        <nav className="sidebar-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3">
          {clientSections().map((section) => (
            <div key={section.label} className="flex flex-col gap-0.5">
              <p className="eyebrow px-3 pb-1.5">{section.label}</p>
              {section.items.map((item) => {
                const active = isActive(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    to={item.to}
                    onClick={onClose}
                    className={`group relative flex min-h-11 items-center gap-3 overflow-hidden rounded-lg px-3 py-1.5 text-sm transition-colors duration-200 md:min-h-0 ${
                      active
                        ? 'text-text-primary'
                        : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="client-nav-active"
                        className="absolute inset-0 rounded-lg bg-accent-muted"
                        transition={TRANSITION}
                        aria-hidden
                      />
                    )}
                    <span className="relative">
                      <Icon size={19} strokeWidth={1.75} />
                    </span>
                    <span className="relative select-none whitespace-nowrap">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-border px-3 pt-2">
          <Link
            to="/administration"
            onClick={onClose}
            className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-200 md:min-h-0 ${
              isActive('/administration')
                ? 'bg-accent-muted text-text-primary'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            }`}
          >
            <ShieldCheck size={19} strokeWidth={1.75} />
            <span className="select-none whitespace-nowrap">Administration</span>
          </Link>
          <button
            type="button"
            onClick={() => void leaveOrganization()}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary md:min-h-0"
          >
            <LogOut size={19} strokeWidth={1.75} />
            <span className="select-none whitespace-nowrap">Quitter le contexte</span>
          </button>
        </div>
      </aside>
    </>
  );
}
