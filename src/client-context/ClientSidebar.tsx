import React, { useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays,
  CheckSquare,
  Contact,
  FileText,
  Images,
  LayoutDashboard,
  LogOut,
  NotebookPen,
  Settings,
  ShieldCheck,
} from 'lucide-react';
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
const CLIENT_MODULES = [
  { key: 'home', label: 'Accueil', to: '/', icon: LayoutDashboard },
  { key: 'agenda', label: 'Calendrier', to: '/agenda', icon: CalendarDays },
  { key: 'clients', label: 'Clients', to: '/clients', icon: Contact },
  { key: 'tasks', label: 'Tâches', to: '/tasks', icon: CheckSquare },
  { key: 'notes', label: 'Notes', to: '/notes', icon: NotebookPen },
  { key: 'reports', label: 'Rapports', to: '/reports', icon: FileText },
  { key: 'media', label: 'Médias', to: '/media', icon: Images },
  { key: 'settings', label: 'Paramètres', to: '/settings', icon: Settings },
] as const;

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

        <nav className="sidebar-scroll flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3">
          {CLIENT_MODULES.map((item) => {
            const active = isActive(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                to={item.to}
                onClick={onClose}
                className={`group relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-1.5 text-sm transition-colors duration-200 ${
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
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-border px-3 pt-2">
          <Link
            to="/administration"
            onClick={onClose}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-200 ${
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
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary"
          >
            <LogOut size={19} strokeWidth={1.75} />
            <span className="select-none whitespace-nowrap">Quitter le contexte</span>
          </button>
        </div>
      </aside>
    </>
  );
}
