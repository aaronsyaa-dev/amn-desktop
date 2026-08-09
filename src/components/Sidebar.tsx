import React, { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronsLeft,
  ChevronsRight,
  LayoutGrid,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useRemoteSites } from '../state/RemoteSitesContext';
import { useActivity } from '../state/ActivityContext';
import { StatusBadge } from './StatusBadge';
import { Logo, LogoMark } from './Logo';
import { useSitePanel } from './site-panel/SitePanelContext';
import { AppLauncher } from './AppLauncher';
import { NAV_ITEMS, type NavItem } from '../data/navigation';
import { useNavFavorites } from '../state/useNavFavorites';

const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 224;
const TRANSITION = { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const };

/**
 * The sidebar no longer lists every screen (BLOC C). It shows a short pinned
 * strip plus a launcher: that is what stops it from growing a row taller with
 * every product shipped — its height no longer depends on how many modules
 * exist. The full grid lives in AppLauncher.
 */
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
  const [isLauncherOpen, setLauncherOpen] = useState(false);
  const { favorites } = useNavFavorites();
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
    setLauncherOpen(false);
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

  // The pinned modules, in the catalogue's own order so the strip never
  // reshuffles itself under the cursor. An unknown key (a module removed since
  // the choice was made) is dropped rather than rendered as a dead row.
  const pinnedItems: NavItem[] = NAV_ITEMS.filter((item) => favorites.includes(item.key));

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
        {/* Pinned strip. Fixed by choice, not by catalogue size: adding a
            module adds a tile to the launcher, never a row here. */}
        <nav className="sidebar-scroll flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3">
          {pinnedItems.map(renderNavItem)}

          <button
            type="button"
            onClick={() => setLauncherOpen(true)}
            title={!isExpanded ? 'Tous les modules' : undefined}
            aria-label="Tous les modules"
            aria-haspopup="dialog"
            aria-expanded={isLauncherOpen}
            className={`group mt-1 flex items-center gap-3 rounded-lg py-1.5 text-sm text-text-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary ${
              isExpanded ? 'px-3' : 'justify-center px-0'
            }`}
          >
            <span className="relative transition-transform duration-200 group-hover:scale-105">
              <LayoutGrid size={20} strokeWidth={1.75} />
            </span>
            {isExpanded && (
              <span className="select-none whitespace-nowrap">Tous les modules</span>
            )}
          </button>
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

      <AppLauncher open={isLauncherOpen} onClose={() => setLauncherOpen(false)} />

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
