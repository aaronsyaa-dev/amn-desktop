import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { OrgRail } from './org-rail/OrgRail';
import { TopBar } from './TopBar';
import { SitePanelProvider } from './site-panel/SitePanelContext';
import { SiteDetailPanel } from './site-panel/SiteDetailPanel';
import { CommandPaletteProvider } from './command-palette/CommandPalette';
import { AssistantProvider } from '../assistant/AssistantContext';
import { AssistantPanel } from '../assistant/AssistantPanel';
import { RemoteSitesProvider } from '../state/RemoteSitesContext';
import { ProfilesProvider } from '../state/ProfilesContext';
import { SyncProvider } from '../state/SyncContext';
import { ActivityProvider, useActivity } from '../state/ActivityContext';
import { BootHealthy } from './BootHealthy';
import { CallProvider } from '../state/CallContext';
import { CallOverlay } from './call/CallOverlay';
import { UndoProvider } from '../state/UndoContext';
import { ToastProvider } from '../state/ToastContext';
import { TagProvider } from './tags/TagProvider';
import { NotificationsManager } from './NotificationsManager';
import { SyncActivityNotifier } from './SyncActivityNotifier';
import { RegressionNotifier } from './RegressionNotifier';
import { IdleScreensaver } from './IdleScreensaver';
import { WelcomeOverlay, shouldShowWelcome } from './WelcomeOverlay';
import { LocalSessionBanner } from '../auth/LocalSessionBanner';
import { MobileBottomNav } from './MobileBottomNav';
import { spaceForPath } from '../data/spaces';
import { AppLauncher } from './AppLauncher';
import { UpdateNotice } from './UpdateNotice';
import { UpdateReady } from './UpdateReady';
import { variantsForPath } from '../lib/transitions';
import { StatusRail } from './StatusRail';
import { useAuth } from '../auth/AuthContext';

const LAST_TAB_KEY = 'amn.lastTab';

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { org } = useAuth();
  // L'espace se DÉDUIT du chemin : un lien profond, une notification ou un
  // onglet mémorisé arrivent donc toujours dans la bonne pièce, sans que
  // personne ait à penser à la régler.
  const isControl = spaceForPath(location.pathname) === 'control';
  const [showWelcome, setShowWelcome] = React.useState(shouldShowWelcome);

  // Mobile navigation drawer (< md). Closed on every route change.
  const [navOpen, setNavOpen] = React.useState(false);
  const [mobileLauncherOpen, setMobileLauncherOpen] = React.useState(false);
  React.useEffect(() => setNavOpen(false), [location.pathname]);

  // Edge-swipe to open the drawer: a touch starting within 24px of the left
  // edge and dragged right opens it (mobile gesture; desktop is unaffected).
  const swipeStart = React.useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    swipeStart.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = swipeStart.current;
    swipeStart.current = null;
    if (!s || navOpen) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - s.x;
    const dy = Math.abs(t.clientY - s.y);
    if (s.x <= 24 && dx > 45 && dy < 60) setNavOpen(true);
  };

  // Session memory: restore the last visited tab once, on entry at the root,
  // then keep the last tab in sync on every navigation.
  const restored = React.useRef(false);
  React.useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const last = window.localStorage.getItem(LAST_TAB_KEY);
      if (last && last !== '/' && location.pathname === '/') navigate(last, { replace: true });
    } catch {
      /* ignore */
    }
  }, [location.pathname, navigate]);

  React.useEffect(() => {
    try {
      window.localStorage.setItem(LAST_TAB_KEY, location.pathname);
    } catch {
      /* ignore */
    }
  }, [location.pathname]);

  return (
    <SyncProvider>
      <ProfilesProvider>
        <ActivityProvider>
        <RemoteSitesProvider>
          <ToastProvider>
          <CallProvider>
          <SitePanelProvider>
            <AssistantProvider>
              <CommandPaletteProvider>
              <UndoProvider>
              <TagProvider>
            <div
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
              // 100dvh (not 100vh) so mobile browser chrome + the virtual
              // keyboard (via viewport interactive-widget=resizes-content) shrink
              // the layout, keeping bottom-anchored inputs (chat composer) above
              // the keyboard. Identical to 100vh on desktop.
              className="app-ground flex h-[100dvh] flex-col overflow-hidden text-text-primary"
              // Respect the iPhone notch / home indicator when installed as a PWA.
              style={{
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}
            >
              {/* Réservé dans le flux, jamais superposé : recouvrir la barre du
                  haut rendrait le bouton du menu inatteignable sur téléphone. */}
              <LocalSessionBanner />
              <div className="flex min-h-0 flex-1">
              {/* Le rail des organisations, toujours à gauche de tout le reste.
                  Masqué sous `md` : sur un téléphone, la colonne d'icônes et le
                  tiroir de navigation ne tiennent pas côte à côte — le
                  sélecteur d'organisation reste atteignable par le tiroir. */}
              <div className="hidden md:flex">
                <OrgRail />
              </div>
              <Sidebar mobileOpen={navOpen} onClose={() => setNavOpen(false)} />
              {/*
                DEUX ESPACES, DEUX PIÈCES (BLOC B).

                La Tour de contrôle ne reçoit pas un thème « en plus » : elle
                reçoit un autre plan de travail, une autre largeur de lecture et
                une autre densité. Le Poste de travail lit des textes, donc il se
                brise à une colonne confortable ; la Tour de contrôle lit des
                tableaux, et la brider à la même largeur laissait un tiers
                d'écran vide à côté d'une grille qui manquait de place.

                Décidé ICI plutôt que dans chaque écran de supervision : la
                densité et la texture sont des propriétés du LIEU. Écran par
                écran, il aurait suffi d'en oublier un pour qu'il ait l'air
                d'appartenir à l'autre espace — c'est exactement le défaut qu'on
                répare.
              */}
              <main
                className={`relative flex-1 overflow-y-auto overflow-x-hidden overscroll-none ${
                  isControl ? 'control-ground control-edge control-dense' : ''
                }`}
              >
                <TopBar onMenu={() => setNavOpen(true)} />
                <div
                  className={
                    isControl
                      ? 'w-full px-4 py-5 sm:px-6 sm:py-6'
                      : 'mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8'
                  }
                >
                  {/*
                    Entrance-only, keyed per route. Remounting on navigation
                    replays the per-tab entrance. We deliberately do NOT use
                    AnimatePresence mode="wait" + exit here: an interrupted
                    exit could strand the incoming screen in its exit variant
                    (opacity 0), which made screens render blank until a second
                    navigation. Keyed entrance can never strand content.
                  */}
                  <motion.div
                    key={location.pathname}
                    variants={variantsForPath(location.pathname)}
                    initial="initial"
                    animate="animate"
                  >
                    <Outlet />
                  </motion.div>
                </div>
              </main>
              </div>
              {/* Le bandeau d'état : la ligne permanente qui dit où l'on est,
                  si le lien tient et quelle heure il est. Même composant que
                  dans la coquille Business — la parité est structurelle, pas
                  relue. */}
              <StatusRail
                orgName={org?.name ?? 'AMN DevSec'}
                context={spaceForPath(location.pathname) === 'control' ? 'Tour de contrôle' : 'Poste de travail'}
              />
              {/* Sous le contenu, jamais par-dessus : une barre superposée
                  masquerait la dernière ligne de chaque écran. */}
              <MobileBottomNav onOpenLauncher={() => setMobileLauncherOpen(true)} />
              <AppLauncher
                open={mobileLauncherOpen}
                onClose={() => setMobileLauncherOpen(false)}
                space={spaceForPath(location.pathname)}
              />
            </div>
              <CallOverlay />
              <SiteDetailPanel />
              <AssistantPanel />
              <NotificationsManager />
              <SyncActivityNotifier />
              <RegressionNotifier />
              <RouteSeenTracker />
              <BootHealthy />
              <IdleScreensaver />
              {showWelcome && <WelcomeOverlay onDone={() => setShowWelcome(false)} />}
              {!showWelcome && <UpdateNotice />}
              <UpdateReady />
              </TagProvider>
              </UndoProvider>
            </CommandPaletteProvider>
          </AssistantProvider>
        </SitePanelProvider>
          </CallProvider>
          </ToastProvider>
        </RemoteSitesProvider>
        </ActivityProvider>
      </ProfilesProvider>
    </SyncProvider>
  );
}

/**
 * Clears a tab's unseen badge when the operator lands on it. Lives inside the
 * ActivityProvider so it can call markSeen on every navigation (and on mount).
 */
function RouteSeenTracker() {
  const location = useLocation();
  const { markSeen } = useActivity();
  React.useEffect(() => {
    markSeen(location.pathname);
  }, [location.pathname, markSeen]);
  return null;
}
