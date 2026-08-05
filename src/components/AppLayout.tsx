import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
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
import { UndoProvider } from '../state/UndoContext';
import { ToastProvider } from '../state/ToastContext';
import { NotificationsManager } from './NotificationsManager';
import { SyncActivityNotifier } from './SyncActivityNotifier';
import { IdleScreensaver } from './IdleScreensaver';
import { WelcomeOverlay, shouldShowWelcome } from './WelcomeOverlay';
import { UpdateNotice } from './UpdateNotice';
import { UpdateReady } from './UpdateReady';
import { variantsForPath } from '../lib/transitions';

const LAST_TAB_KEY = 'amn.lastTab';

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showWelcome, setShowWelcome] = React.useState(shouldShowWelcome);

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
          <SitePanelProvider>
            <AssistantProvider>
              <CommandPaletteProvider>
              <UndoProvider>
            <div className="flex h-screen overflow-hidden text-text-primary">
              <Sidebar />
              <main className="relative flex-1 overflow-y-auto">
                <TopBar />
                <div className="mx-auto max-w-6xl px-8 py-8">
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
              <SiteDetailPanel />
              <AssistantPanel />
              <NotificationsManager />
              <SyncActivityNotifier />
              <RouteSeenTracker />
              <IdleScreensaver />
              {showWelcome && <WelcomeOverlay onDone={() => setShowWelcome(false)} />}
              {!showWelcome && <UpdateNotice />}
              <UpdateReady />
              </UndoProvider>
            </CommandPaletteProvider>
          </AssistantProvider>
        </SitePanelProvider>
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
