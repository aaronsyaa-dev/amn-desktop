import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { SitePanelProvider } from './site-panel/SitePanelContext';
import { SiteDetailPanel } from './site-panel/SiteDetailPanel';
import { CommandPaletteProvider } from './command-palette/CommandPalette';

export function AppLayout() {
  const location = useLocation();

  return (
    <SitePanelProvider>
      <CommandPaletteProvider>
        <div className="flex h-screen overflow-hidden text-text-primary">
          <Sidebar />
          <main className="relative flex-1 overflow-y-auto">
            <TopBar />
            <div className="mx-auto max-w-6xl px-8 py-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>
        <SiteDetailPanel />
      </CommandPaletteProvider>
    </SitePanelProvider>
  );
}
