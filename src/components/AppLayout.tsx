import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
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
import { NotificationsManager } from './NotificationsManager';
import { WelcomeOverlay, shouldShowWelcome } from './WelcomeOverlay';
import { variantsForPath } from '../lib/transitions';

export function AppLayout() {
  const location = useLocation();
  const [showWelcome, setShowWelcome] = React.useState(shouldShowWelcome);

  return (
    <SyncProvider>
      <ProfilesProvider>
        <RemoteSitesProvider>
          <SitePanelProvider>
            <AssistantProvider>
              <CommandPaletteProvider>
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
              {showWelcome && <WelcomeOverlay onDone={() => setShowWelcome(false)} />}
            </CommandPaletteProvider>
          </AssistantProvider>
        </SitePanelProvider>
        </RemoteSitesProvider>
      </ProfilesProvider>
    </SyncProvider>
  );
}
