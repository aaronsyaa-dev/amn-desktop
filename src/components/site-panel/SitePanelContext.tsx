import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

interface SitePanelContextValue {
  activeSiteId: string | null;
  openSite: (id: string) => void;
  close: () => void;
}

const SitePanelContext = createContext<SitePanelContextValue | undefined>(
  undefined,
);

export function SitePanelProvider({ children }: { children: React.ReactNode }) {
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);

  const openSite = useCallback((id: string) => setActiveSiteId(id), []);
  const close = useCallback(() => setActiveSiteId(null), []);

  const value = useMemo(
    () => ({ activeSiteId, openSite, close }),
    [activeSiteId, openSite, close],
  );

  return (
    <SitePanelContext.Provider value={value}>
      {children}
    </SitePanelContext.Provider>
  );
}

export function useSitePanel(): SitePanelContextValue {
  const context = useContext(SitePanelContext);
  if (!context) {
    throw new Error('useSitePanel must be used within a SitePanelProvider');
  }
  return context;
}
