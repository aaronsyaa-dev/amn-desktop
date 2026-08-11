import React, { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronsLeft, ChevronsRight, LayoutGrid, LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useActivity } from '../state/ActivityContext';
import { Logo, LogoMark } from '../components/Logo';
import { AppLauncher } from '../components/AppLauncher';
import { NAV_ITEMS, type NavItem } from '../data/navigation';
import { useNavFavorites } from '../state/useNavFavorites';

const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 224;
const TRANSITION = { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const };

/**
 * Barre latérale de l'édition Business.
 *
 * Même comportement que celle de l'édition interne — bande épinglée courte,
 * lanceur pour le reste, repli sur icônes, tiroir sur mobile — sans le
 * survol du parc de sites, qui n'existe pas ici. C'est un fichier séparé
 * plutôt qu'une barre latérale commune truffée de conditions : la version
 * interne importe `RemoteSitesContext` et `SitePanelContext`, et il suffirait
 * de l'importer pour que tout le parc revienne dans le bundle livré.
 *
 * Le lanceur, lui, est bien le composant commun : il ne lit que
 * `NAV_SECTIONS`, déjà résolu à l'édition construite.
 */
export function BusinessSidebar({
  mobileOpen = false,
  onClose,
}: {
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const [isExpandedDesktop, setIsExpanded] = useState(false);
  const [isLauncherOpen, setLauncherOpen] = useState(false);
  const { favorites } = useNavFavorites();
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { unseen } = useActivity();

  const isExpanded = isExpandedDesktop || mobileOpen;

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  const handleNavClick = () => {
    setLauncherOpen(false);
    onClose?.();
  };

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

  const pinned: NavItem[] = favorites
    .map((key) => NAV_ITEMS.find((item) => item.key === key))
    .filter((item): item is NavItem => Boolean(item));

  const handleSignOut = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      {/* Voile du tiroir mobile. */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-[2px] md:hidden"
            aria-hidden
          />
        )}
      </AnimatePresence>

      <motion.aside
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        initial={false}
        animate={{ width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH }}
        transition={TRANSITION}
        className={`fixed inset-y-0 left-0 z-[91] flex h-full flex-col border-r border-border bg-surface transition-transform md:relative md:z-auto md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 flex-shrink-0 items-center justify-center border-b border-border px-3">
          {isExpanded ? <Logo height={22} /> : <LogoMark size={22} />}
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          <button
            type="button"
            onClick={() => setLauncherOpen(true)}
            title="Tous les modules"
            className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors md:min-h-0 ${
              isLauncherOpen
                ? 'bg-accent-muted text-text-primary'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            }`}
          >
            <LayoutGrid size={18} strokeWidth={1.75} className="flex-shrink-0" />
            {isExpanded && <span className="truncate">Tous les modules</span>}
          </button>

          {pinned.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <Link
                key={item.key}
                to={item.to}
                onClick={handleNavClick}
                title={item.label}
                className={`relative flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors md:min-h-0 ${
                  active
                    ? 'bg-accent-muted text-text-primary'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                }`}
              >
                <Icon size={18} strokeWidth={1.75} />
                {isExpanded && <span className="truncate">{item.label}</span>}
                {(unseen[item.to] ?? 0) > 0 && (
                  <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex flex-col gap-1 border-t border-border p-2">
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            aria-label={isExpandedDesktop ? 'Replier la barre' : 'Déplier la barre'}
            className="hidden items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary md:flex"
          >
            {isExpandedDesktop ? (
              <ChevronsLeft size={18} strokeWidth={1.75} />
            ) : (
              <ChevronsRight size={18} strokeWidth={1.75} />
            )}
            {isExpanded && <span>Replier</span>}
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-danger md:min-h-0"
          >
            <LogOut size={18} strokeWidth={1.75} />
            {isExpanded && <span>Se déconnecter</span>}
          </button>
        </div>
      </motion.aside>

      <AppLauncher open={isLauncherOpen} onClose={() => setLauncherOpen(false)} />
    </>
  );
}
