import React, { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  LayoutGrid,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useRemoteSites } from '../state/RemoteSitesContext';
import { useActivity } from '../state/ActivityContext';
import { StatusBadge } from './StatusBadge';
import { useSitePanel } from './site-panel/SitePanelContext';
import { AppLauncher } from './AppLauncher';
import { OrgSwitchButton } from './org-rail/OrgSwitchButton';
import { NAV_ITEMS, type NavItem } from '../data/navigation';
import { SPACES, itemsForSpace, spaceByKey, spaceForPath } from '../data/spaces';
import { useNavFavorites } from '../state/useNavFavorites';

const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 224;
const TRANSITION = { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const };

/**
 * La navigation de l'espace courant.
 *
 * Elle ne liste plus tous les écrans (BLOC C) et, depuis la refonte, elle ne
 * liste plus non plus tous les ESPACES : le sélecteur en tête décide lequel des
 * deux — Poste de travail ou Tour de contrôle — occupe la colonne. C'est le
 * point de la refonte : le travail quotidien et la supervision transverse ne se
 * mélangent plus dans une même liste plate.
 *
 * Les deux espaces n'ont pas la même forme de navigation, et c'est délibéré :
 *   - le Poste de travail garde la bande épinglée + le lanceur, parce que sa
 *     liste est longue et personnelle ;
 *   - la Tour de contrôle affiche ses modules en entier, parce qu'ils sont peu
 *     nombreux, fixes, et qu'on veut les voir tous d'un coup d'œil.
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

  // L'espace courant se lit dans l'URL : arriver sur `/scanner` par la palette
  // de commandes ou par une notification doit basculer la colonne, sans que
  // l'appelant ait à y penser.
  const space = spaceForPath(location.pathname);
  const spaceItems = itemsForSpace(space);

  // The pinned modules, in the catalogue's own order so the strip never
  // reshuffles itself under the cursor. An unknown key (a module removed since
  // the choice was made) is dropped rather than rendered as a dead row.
  // Restreint à l'espace courant : une épingle posée dans un espace n'a pas à
  // apparaître dans l'autre.
  const pinnedItems: NavItem[] =
    space === 'control'
      ? spaceItems
      : NAV_ITEMS.filter((item) => favorites.includes(item.key) && spaceItems.includes(item));

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
        // 44 px sous `md` : le tiroir est la navigation principale du
        // téléphone, ses lignes ne peuvent pas être plus petites que les
        // cibles de la barre basse. Au pointeur, la densité d'origine reste.
        className={`group relative flex min-h-11 items-center gap-3 overflow-hidden rounded-lg py-1.5 text-sm transition-colors duration-200 md:min-h-0 ${
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
        {/* Mobile uniquement : le rail est masqué sous `md`, cette ligne le
            remplace pour que changer d'organisation reste possible. */}
        <div className="px-3 md:hidden">
          <OrgSwitchButton onNavigate={onClose} />
        </div>

        <SpaceSwitcher
          expanded={isExpanded}
          onNavigate={() => {
            setIsSitesFlyoutOpen(false);
            setLauncherOpen(false);
            onClose?.();
          }}
        />

        {/* The nav scrolls only when the window is genuinely too short. The
            native scrollbar is hidden and replaced by a mask that fades the
            first/last rows out, so a short window looks deliberate instead of
            showing a grey gutter down the middle of the chrome. */}
        {/* Pinned strip. Fixed by choice, not by catalogue size: adding a
            module adds a tile to the launcher, never a row here. */}
        <nav className="sidebar-scroll flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3">
          {pinnedItems.map(renderNavItem)}

          {/* La Tour de contrôle affiche déjà tous ses modules : un bouton
              « tous les modules » y ouvrirait la même liste que celle qu'on
              regarde. */}
          {space === 'workspace' && (
            <button
              type="button"
              onClick={() => setLauncherOpen(true)}
              title={!isExpanded ? 'Tous les modules' : undefined}
              aria-label="Tous les modules"
              aria-haspopup="dialog"
              aria-expanded={isLauncherOpen}
              // 44 px sur téléphone, comme les lignes du tiroir juste au-dessus :
              // ce bouton avait été oublié lors de la passe précédente.
              className={`group mt-1 flex min-h-11 items-center gap-3 rounded-lg py-1.5 text-sm text-text-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary md:min-h-0 ${
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
          )}
        </nav>

        <div className="mt-auto flex flex-col gap-1 border-t border-border px-3 pt-2">
          <button
            type="button"
            onClick={logout}
            title={!isExpanded ? 'Déconnexion' : undefined}
            aria-label="Déconnexion"
            className={`flex min-h-11 items-center gap-3 rounded-lg py-2 text-sm text-text-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary md:min-h-0 ${
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

      <AppLauncher open={isLauncherOpen} onClose={() => setLauncherOpen(false)} space={space} />

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

/**
 * Le sélecteur d'espace, en tête de la colonne.
 *
 * Il occupe la place qu'occupait le logo AMN — lequel n'y avait plus sa place :
 * le rail, à gauche, dit déjà chez qui on est. Cette ligne-ci répond à l'autre
 * question, celle qui change tout le contenu de la colonne : dans quel espace
 * de travail suis-je ?
 *
 * Replié (barre étroite), il ne montre que l'icône de l'espace et bascule
 * directement sur l'autre au clic : à deux espaces, un menu déroulant pour
 * choisir entre deux entrées est une cérémonie inutile.
 */
function SpaceSwitcher({
  expanded,
  onNavigate,
}: {
  expanded: boolean;
  onNavigate: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const current = spaceByKey(spaceForPath(location.pathname));
  const CurrentIcon = current.icon;
  const { org } = useAuth();
  const orgName = org?.name ?? 'AMN DevSec';

  const go = (home: string) => {
    setOpen(false);
    onNavigate();
    navigate(home);
  };

  return (
    <div className="relative mb-2 px-3">
      <button
        type="button"
        onClick={() => {
          if (expanded) {
            setOpen((v) => !v);
            return;
          }
          const other = SPACES.find((s) => s.key !== current.key);
          if (other) go(other.home);
        }}
        aria-haspopup={expanded ? 'menu' : undefined}
        aria-expanded={expanded ? open : undefined}
        title={expanded ? undefined : `${current.label} — cliquer pour changer d’espace`}
        className={`group flex h-11 w-full items-center gap-2.5 rounded-xl border border-border bg-surface transition-colors duration-200 hover:border-border-strong ${
          expanded ? 'px-3' : 'justify-center px-0'
        }`}
      >
        <span className="flex-shrink-0 text-text-primary transition-transform duration-200 group-hover:scale-105">
          <CurrentIcon size={18} strokeWidth={1.75} />
        </span>
        {expanded && (
          <>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[13px] font-semibold leading-tight text-text-primary">
                {current.label}
              </span>
              {/* L'organisation RÉELLE, pas une chaîne en dur.
                  Elle l'était : en contexte client, ce sous-titre affichait
                  « AMN DevSec » pendant qu'on travaillait dans le dossier
                  d'une cliente — exactement l'erreur que toute la mécanique de
                  contexte existe pour empêcher.
                  Masqué sous `md` : le sélecteur d'organisation, juste
                  au-dessus dans le tiroir mobile, dit déjà la même chose, et
                  le voir deux fois à 60 px d'intervalle donne l'impression
                  d'un montage bricolé. */}
              <span className="hidden truncate font-mono text-[9px] uppercase tracking-[0.18em] text-text-muted md:block">
                {orgName}
              </span>
            </span>
            <ChevronDown
              size={14}
              strokeWidth={2}
              className={`flex-shrink-0 text-text-muted transition-transform duration-200 ${
                open ? 'rotate-180' : ''
              }`}
            />
          </>
        )}
      </button>

      <AnimatePresence>
        {open && expanded && (
          <React.Fragment key="space-menu">
            <motion.div
              key="space-menu-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40"
            />
            <motion.div
              key="space-menu-panel"
              role="menu"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.99 }}
              transition={TRANSITION}
              className="elev-2 absolute left-3 right-3 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-surface"
            >
              {SPACES.map((space) => {
                const Icon = space.icon;
                const active = space.key === current.key;
                return (
                  <button
                    key={space.key}
                    type="button"
                    role="menuitem"
                    onClick={() => go(space.home)}
                    className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors ${
                      active ? 'bg-accent-muted' : 'hover:bg-surface-hover'
                    }`}
                  >
                    <span className="mt-0.5 flex-shrink-0 text-text-primary">
                      <Icon size={16} strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-text-primary">
                        {space.label}
                      </span>
                      <span className="block text-[11px] leading-snug text-text-muted">
                        {space.hint}
                      </span>
                    </span>
                    {active && (
                      <Check size={14} strokeWidth={2} className="mt-0.5 flex-shrink-0 text-text-secondary" />
                    )}
                  </button>
                );
              })}
            </motion.div>
          </React.Fragment>
        )}
      </AnimatePresence>
    </div>
  );
}
