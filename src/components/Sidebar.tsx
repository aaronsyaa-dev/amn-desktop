import React, { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BadgeCheck,
  BookOpen,
  ChevronsLeft,
  ChevronsRight,
  CheckSquare,
  Contact,
  FileText,
  Globe,
  Images,
  LayoutDashboard,
  Lock,
  LockKeyhole,
  LogOut,
  NotebookPen,
  Radar,
  Scale,
  ScanLine,
  Settings,
  Users,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useRemoteSites } from '../state/RemoteSitesContext';
import { useActivity } from '../state/ActivityContext';
import { StatusBadge } from './StatusBadge';
import { Logo, LogoMark } from './Logo';
import { useSitePanel } from './site-panel/SitePanelContext';

const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 224;
const TRANSITION = { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const };

interface NavItem {
  key: string;
  label: string;
  to: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}

/**
 * The sidebar is grouped rather than listed. With eleven workspace tabs and a
 * growing product line, one flat column reads as a wall of icons and gets
 * visibly cramped every time a product ships — so the nav is split into three
 * named sections that each answer a different question: what am I working on,
 * what do we sell, what runs the app.
 */
interface NavSection {
  key: string;
  /** Shown as a quiet caption when expanded; a hairline rule when collapsed. */
  label: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    key: 'travail',
    label: 'Travail',
    items: [
      { key: 'home', label: 'Accueil', to: '/', icon: LayoutDashboard },
      { key: 'sites', label: 'Sites', to: '/sites', icon: Globe },
      { key: 'team', label: 'Équipe', to: '/team', icon: Users },
      { key: 'tasks', label: 'Tâches', to: '/tasks', icon: CheckSquare },
      { key: 'clients', label: 'Clients', to: '/clients', icon: Contact },
      { key: 'decisions', label: 'Décisions', to: '/decisions', icon: Scale },
      { key: 'knowledge', label: 'Connaissances', to: '/knowledge', icon: BookOpen },
      { key: 'notes', label: 'Notes', to: '/notes', icon: NotebookPen },
      { key: 'media', label: 'Médias', to: '/media', icon: Images },
      { key: 'reports', label: 'Rapports', to: '/reports', icon: FileText },
    ],
  },
  {
    key: 'produits',
    label: 'Produits',
    items: [
      { key: 'tracker', label: 'Trackers', to: '/tracker', icon: Radar },
      { key: 'scanner', label: 'Scanner', to: '/scanner', icon: ScanLine },
      { key: 'comply', label: 'Comply', to: '/comply', icon: BadgeCheck },
      { key: 'ssl', label: 'SSL Monitor', to: '/ssl', icon: LockKeyhole },
    ],
  },
  {
    key: 'systeme',
    label: 'Système',
    items: [
      { key: 'settings', label: 'Paramètres', to: '/settings', icon: Settings },
      { key: 'vault', label: 'Coffre-fort', to: '/vault', icon: Lock },
    ],
  },
];

export function Sidebar({
  mobileOpen = false,
  onClose,
}: {
  /** Whether the mobile overlay drawer is open (< md only). */
  mobileOpen?: boolean;
  /** Close the mobile drawer (nav click, backdrop tap, swipe-left). */
  onClose?: () => void;
}) {
  const [isExpandedDesktop, setIsExpanded] = useState(false);
  const [isSitesFlyoutOpen, setIsSitesFlyoutOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { openSite } = useSitePanel();
  const { sites } = useRemoteSites();
  const { unseen } = useActivity();

  // On mobile the drawer always shows the full (labelled) sidebar; on desktop
  // the collapse toggle controls it. Deriving it here keeps every render site
  // below working unchanged for both platforms.
  const isExpanded = isExpandedDesktop || mobileOpen;

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  // Every nav item — Sites included — navigates to its screen. The Sites
  // "registre" lives at /sites (with the "Nouveau site" button), so clicking
  // Sites must land there; the quick site-list flyout is opened separately via
  // the chevron, never by hijacking the main click.
  const handleNavClick = () => {
    setIsSitesFlyoutOpen(false);
    onClose?.(); // close the mobile drawer after navigating
  };

  // Swipe-left on the open drawer closes it (mobile only).
  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null || !mobileOpen) return;
    const dx = (e.changedTouches[0]?.clientX ?? start) - start;
    if (dx < -45) onClose?.();
  };

  // One nav row. Shared by both sections (workspace + produits) so the badge,
  // active indicator and collapsed/expanded behaviour stay identical.
  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.to);
    const Icon = item.icon;
    const count = unseen[item.to] ?? 0;
    const badge = count > 99 ? '99+' : String(count);
    return (
      <Link
        key={item.key}
        to={item.to}
        onClick={handleNavClick}
        title={!isExpanded ? item.label : undefined}
        aria-label={item.label}
        className={`group relative flex items-center gap-3 overflow-hidden rounded-lg py-1.5 text-sm transition-colors duration-200 ${
          isExpanded ? 'px-3' : 'justify-center px-0'
        } ${
          active
            ? 'text-text-primary'
            : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
        }`}
      >
        {/* The active state is a single surface that *slides* from the previous
            item rather than a flat background that blinks on. Two shared-layout
            elements — the tint and the left bar — travel together, which is the
            whole micro-interaction: the eye follows the selection instead of
            re-finding it. */}
        {active && (
          <>
            <motion.span
              layoutId="sidebar-active-surface"
              className="absolute inset-0 rounded-lg bg-accent-muted"
              transition={TRANSITION}
              aria-hidden
            />
            <motion.span
              layoutId="sidebar-active-indicator"
              className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent"
              transition={TRANSITION}
              aria-hidden
            />
          </>
        )}
        <span
          className={`relative transition-transform duration-200 ${
            active ? 'scale-105' : 'group-hover:scale-105'
          }`}
        >
          <Icon size={20} strokeWidth={1.75} />
        </span>
        {isExpanded && (
          <span className="relative select-none whitespace-nowrap">
            {item.label}
          </span>
        )}
        {/* Unseen-activity badge (A3.3): additions/changes by the other
            operator since this tab was last opened. */}
        {count > 0 &&
          (isExpanded ? (
            <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-semibold leading-none text-bg">
              {badge}
            </span>
          ) : (
            <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[9px] font-semibold leading-none text-bg">
              {badge}
            </span>
          ))}
        {item.key === 'sites' && isExpanded && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Voir la liste rapide des sites"
            onClick={(event) => {
              // Toggle the quick-list flyout without navigating away.
              event.preventDefault();
              event.stopPropagation();
              setIsSitesFlyoutOpen((open) => !open);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                event.stopPropagation();
                setIsSitesFlyoutOpen((open) => !open);
              }
            }}
            className={`ml-auto -my-1 flex select-none items-center rounded px-1 py-1 text-xs text-text-muted transition-transform duration-200 hover:text-text-primary ${
              isSitesFlyoutOpen ? 'rotate-90' : ''
            }`}
          >
            ›
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile backdrop behind the drawer (< md only). */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="nav-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] md:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        animate={{ width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
        transition={TRANSITION}
        className={`fixed inset-y-0 left-0 z-50 flex h-full flex-shrink-0 flex-col border-r border-border bg-[#0d0d0d] py-4 transition-transform duration-300 md:relative md:z-30 md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0`}
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <div className="mb-2 flex h-9 items-center px-4">
          <AnimatePresence mode="wait" initial={false}>
            {isExpanded ? (
              <motion.div
                key="wordmark"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <Logo height={36} showTagline showAppName />
              </motion.div>
            ) : (
              <motion.div
                key="mark"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <LogoMark size={34} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* The nav scrolls only when the window is genuinely too short. The
            native scrollbar is hidden and replaced by a mask that fades the
            first/last rows out, so a short window looks deliberate instead of
            showing a grey gutter down the middle of the chrome. */}
        <nav className="sidebar-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3">
          {NAV_SECTIONS.map((section) => (
            <div key={section.key} className="flex flex-col gap-1">
              {/* The caption is what separates the groups. Collapsed, it would
                  be unreadable at 72px, so it degrades to a hairline rule that
                  keeps the same rhythm. */}
              <div className="mb-0.5 px-1">
                {isExpanded ? (
                  <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-text-muted">
                    {section.label}
                  </p>
                ) : (
                  <span className="mx-auto block h-px w-6 bg-border" aria-hidden />
                )}
              </div>
              {section.items.map(renderNavItem)}
            </div>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-border px-3 pt-2">
          <button
            type="button"
            onClick={logout}
            title={!isExpanded ? 'Déconnexion' : undefined}
            aria-label="Déconnexion"
            className={`flex items-center gap-3 rounded-lg py-2 text-sm text-text-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary ${
              isExpanded ? 'px-3' : 'justify-center px-0'
            }`}
          >
            <LogOut size={20} strokeWidth={1.75} />
            {isExpanded && (
              <span className="select-none whitespace-nowrap">Déconnexion</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className={`hidden items-center gap-3 rounded-lg py-2 text-sm text-text-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary md:flex ${
              isExpanded ? 'px-3' : 'justify-center px-0'
            }`}
            aria-label={isExpanded ? 'Réduire le menu' : 'Étendre le menu'}
          >
            {isExpanded ? (
              <ChevronsLeft size={20} strokeWidth={1.75} />
            ) : (
              <ChevronsRight size={20} strokeWidth={1.75} />
            )}
          </button>
        </div>
      </motion.aside>

      <AnimatePresence>
        {isSitesFlyoutOpen && (
          <React.Fragment>
            <motion.div
              key="sites-flyout-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-20"
              onClick={() => setIsSitesFlyoutOpen(false)}
            />
            <motion.div
              key="sites-flyout"
              initial={{ x: -16, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -16, opacity: 0 }}
              transition={TRANSITION}
              className="fixed top-0 z-30 h-full w-64 border-r border-border bg-surface py-4 elev-2"
              style={{ left: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
            >
              <p className="px-4 pb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Sites surveillés
              </p>
              <div className="flex flex-col gap-0.5 px-2">
                {sites.length === 0 ? (
                  <div className="px-3 py-4">
                    <p className="text-sm text-text-muted">Aucun site enregistré pour l’instant.</p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsSitesFlyoutOpen(false);
                        navigate('/sites');
                      }}
                      className="mt-3 w-full bg-accent px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
                    >
                      Ouvrir le registre des sites
                    </button>
                  </div>
                ) : (
                  sites.map((site) => (
                    <button
                      key={site.id}
                      type="button"
                      onClick={() => {
                        setIsSitesFlyoutOpen(false);
                        if (location.pathname !== '/sites') navigate('/sites');
                        openSite(site.id);
                      }}
                      className="flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-text-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary"
                    >
                      <span className="truncate">{site.name}</span>
                      <StatusBadge status={site.status} />
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </React.Fragment>
        )}
      </AnimatePresence>
    </>
  );
}
