import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { SitePanelProvider } from './site-panel/SitePanelContext';
import { SiteDetailPanel } from './site-panel/SiteDetailPanel';
import { CommandPaletteProvider } from './command-palette/CommandPalette';
import { AssistantProvider } from '../assistant/AssistantContext';
import { AssistantPanel } from '../assistant/AssistantPanel';
import { variantsForPath } from '../lib/transitions';

export function AppLayout() {
  const location = useLocation();

  return (
    <SitePanelProvider>
      <AssistantProvider>
        <CommandPaletteProvider>
          <div className="flex h-screen overflow-hidden text-text-primary">
            <Sidebar />
            <main className="relative flex-1 overflow-y-auto">
              <TopBar />
              <div className="mx-auto max-w-6xl px-8 py-8">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={location.pathname}
                    variants={variantsForPath(location.pathname)}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    <Outlet />
                  </motion.div>
                </AnimatePresence>
              </div>
            </main>
          </div>
          <SiteDetailPanel />
          <AssistantPanel />
        </CommandPaletteProvider>
      </AssistantProvider>
    </SitePanelProvider>
  );
}
