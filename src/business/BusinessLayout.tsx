import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BusinessSidebar } from './BusinessSidebar';
import { BusinessTopBar } from './BusinessTopBar';
import { AppointmentReminders } from './AppointmentReminders';
import { ProfilesProvider } from '../state/ProfilesContext';
import { SyncProvider } from '../state/SyncContext';
import { ActivityProvider, useActivity } from '../state/ActivityContext';
import { UndoProvider } from '../state/UndoContext';
import { ToastProvider } from '../state/ToastContext';
import { TagProvider } from '../components/tags/TagProvider';
import { SyncActivityNotifier } from '../components/SyncActivityNotifier';
import { MobileBottomNav } from '../components/MobileBottomNav';
import { AppLauncher } from '../components/AppLauncher';
import { UpdateNotice } from '../components/UpdateNotice';
import { UpdateReady } from '../components/UpdateReady';
import { variantsForPath } from '../lib/transitions';

const LAST_TAB_KEY = 'amn.lastTab';

/**
 * Coquille de l'édition Business.
 *
 * Reprend la structure de `AppLayout` — même grille, mêmes transitions par
 * route, même tiroir mobile — avec la liste de fournisseurs réduite à ce qui
 * a un sens pour une personne seule. Ce qui manque manque exprès :
 *
 *   - `RemoteSitesProvider`, `SitePanelProvider` — pas de parc de sites ;
 *   - `CallProvider`, `CallOverlay` — les appels audio et le partage d'écran
 *     n'ont d'objet qu'à plusieurs, et ne sont pas vérifiés sous Windows en
 *     conditions réelles ;
 *   - `AssistantProvider` — l'assistant raisonne sur le parc, les décisions et
 *     la base de connaissances, qui n'existent pas ici ;
 *   - `RegressionNotifier`, `IdleScreensaver`, `NotificationsManager` — tous
 *     branchés sur des événements de supervision.
 *
 * À la place, `AppointmentReminders` : la seule notification qui compte quand
 * on travaille seul, c'est le rendez-vous qui approche.
 */
export function BusinessLayout() {
  const location = useLocation();
  const [navOpen, setNavOpen] = React.useState(false);
  // Le lanceur « Tous les modules » de la barre du pouce. L'édition Business
  // n'a qu'un espace, d'où le `space="workspace"` figé plus bas.
  const [launcherOpen, setLauncherOpen] = React.useState(false);
  React.useEffect(() => setNavOpen(false), [location.pathname]);
  React.useEffect(() => setLauncherOpen(false), [location.pathname]);

  // Ouverture du tiroir par balayage depuis le bord gauche (mobile).
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

  // Mémoire d'onglet : on revient là où on s'était arrêté.
  const restored = React.useRef(false);
  React.useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const last = window.localStorage.getItem(LAST_TAB_KEY);
      if (last && last !== '/' && location.pathname === '/') {
        window.location.hash = `#${last}`;
      }
    } catch {
      /* ignore */
    }
  }, [location.pathname]);

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
          <ToastProvider>
            <UndoProvider>
              <TagProvider>
                <div
                  onTouchStart={onTouchStart}
                  onTouchEnd={onTouchEnd}
                  className="flex h-[100dvh] flex-col overflow-hidden text-text-primary"
                  style={{
                    paddingTop: 'env(safe-area-inset-top)',
                    paddingBottom: 'env(safe-area-inset-bottom)',
                  }}
                >
                  <div className="flex min-h-0 flex-1">
                    <BusinessSidebar mobileOpen={navOpen} onClose={() => setNavOpen(false)} />
                    <main className="relative flex-1 overflow-y-auto overflow-x-hidden overscroll-none">
                      <BusinessTopBar onMenu={() => setNavOpen(true)} />
                      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
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
                  {/*
                    La barre du pouce manquait ICI, et c'est la seconde cause du
                    bug signalé depuis un vrai iPhone : le composant existait
                    bien, mais n'était monté que dans `AppLayout`, la coquille
                    interne. L'édition Business — celle des clientes — n'en a
                    donc jamais eu, quelle que soit la version déployée.
                    Sous le contenu et non par-dessus, comme dans AppLayout :
                    une barre superposée masquerait la dernière ligne de chaque
                    écran.
                  */}
                  <MobileBottomNav onOpenLauncher={() => setLauncherOpen(true)} />
                  <AppLauncher
                    open={launcherOpen}
                    onClose={() => setLauncherOpen(false)}
                    space="workspace"
                  />
                </div>
                <AppointmentReminders />
                <SyncActivityNotifier />
                <RouteSeenTracker />
                <UpdateNotice />
                <UpdateReady />
              </TagProvider>
            </UndoProvider>
          </ToastProvider>
        </ActivityProvider>
      </ProfilesProvider>
    </SyncProvider>
  );
}

/** Efface la pastille « non vu » d'un onglet dès qu'on y arrive. */
function RouteSeenTracker() {
  const location = useLocation();
  const { markSeen } = useActivity();
  React.useEffect(() => {
    markSeen(location.pathname);
  }, [location.pathname, markSeen]);
  return null;
}
