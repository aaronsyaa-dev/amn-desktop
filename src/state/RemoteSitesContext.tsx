import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { bridge } from '../lib/bridge';
import { deriveSiteStatus, type DerivedStatus } from '../lib/siteStatus';
import type {
  RegisterSiteResult,
  RemoteConnectionStatus,
  RemoteEvent,
  RemoteSite,
} from '../shared/api';

export interface DerivedSite extends RemoteSite {
  status: DerivedStatus;
}

interface RemoteSitesContextValue {
  sites: DerivedSite[];
  loading: boolean;
  connectionStatus: RemoteConnectionStatus;
  /** Recent events for a site, once loaded via ensureEventsLoaded(). */
  eventsBySite: Record<string, RemoteEvent[]>;
  ensureEventsLoaded: (siteId: string) => void;
  registerSite: (name: string) => Promise<RegisterSiteResult>;
  refresh: () => Promise<void>;
}

const RemoteSitesContext = createContext<RemoteSitesContextValue | undefined>(
  undefined,
);

const EVENTS_PER_SITE_CAP = 150;

export function RemoteSitesProvider({ children }: { children: React.ReactNode }) {
  const [rawSites, setRawSites] = useState<RemoteSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<RemoteConnectionStatus>(
    'connecting',
  );
  const [now, setNow] = useState(() => Date.now());
  const [eventsBySite, setEventsBySite] = useState<Record<string, RemoteEvent[]>>({});
  const loadedEventSites = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    const sites = await bridge().remote.listSites();
    setRawSites(sites);
  }, []);

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh()
      .catch(() => {
        // Leave sites empty; connectionStatus (below) surfaces the failure.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // Live pushes: patch the affected site's state in place and append the
  // event to its cache (if that site's history has been loaded already).
  useEffect(() => {
    const unsubscribe = bridge().remote.onEvent((push) => {
      setRawSites((prev) => {
        const idx = prev.findIndex((s) => s.id === push.siteId);
        if (idx === -1) {
          // Unknown site (registered elsewhere/just now) — pick it up on next refresh.
          refresh().catch((err) => void err);
          return prev;
        }
        const site = prev[idx];
        const nextState = {
          siteId: push.siteId,
          status: 'online',
          activeVisitors:
            push.event.type === 'heartbeat' &&
            typeof push.event.payload?.activeVisitors === 'number'
              ? (push.event.payload.activeVisitors as number)
              : (site.state?.activeVisitors ?? 0),
          lastSeenAt: push.event.occurredAt,
          lastAlertAt:
            push.event.type === 'security_alert'
              ? push.event.occurredAt
              : (site.state?.lastAlertAt ?? null),
          updatedAt: push.event.occurredAt,
        };
        const next = [...prev];
        next[idx] = { ...site, state: nextState };
        return next;
      });

      setEventsBySite((prev) => {
        if (!loadedEventSites.current.has(push.siteId)) return prev;
        const existing = prev[push.siteId] ?? [];
        return {
          ...prev,
          [push.siteId]: [push.event, ...existing].slice(0, EVENTS_PER_SITE_CAP),
        };
      });
    });
    return unsubscribe;
  }, [refresh]);

  // Connection status.
  useEffect(() => {
    bridge()
      .remote.getConnectionStatus()
      .then(setConnectionStatus)
      .catch((err) => void err);
    const unsubscribe = bridge().remote.onConnectionStatusChange(setConnectionStatus);
    return unsubscribe;
  }, []);

  // Re-derive online/offline/degraded periodically even with no new events,
  // since "offline" is a function of elapsed time, not just of the last push.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(interval);
  }, []);

  const ensureEventsLoaded = useCallback((siteId: string) => {
    if (loadedEventSites.current.has(siteId)) return;
    loadedEventSites.current.add(siteId);
    bridge()
      .remote.getSiteEvents(siteId, { limit: EVENTS_PER_SITE_CAP })
      .then((events) => {
        setEventsBySite((prev) => ({ ...prev, [siteId]: events }));
      })
      .catch(() => {
        loadedEventSites.current.delete(siteId); // allow retry
      });
  }, []);

  const registerSite = useCallback(async (name: string) => {
    const result = await bridge().remote.registerSite(name);
    await refresh();
    return result;
  }, [refresh]);

  const sites = useMemo<DerivedSite[]>(
    () =>
      rawSites
        .map((site) => ({ ...site, status: deriveSiteStatus(site.state, now) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [rawSites, now],
  );

  const value = useMemo<RemoteSitesContextValue>(
    () => ({
      sites,
      loading,
      connectionStatus,
      eventsBySite,
      ensureEventsLoaded,
      registerSite,
      refresh,
    }),
    [sites, loading, connectionStatus, eventsBySite, ensureEventsLoaded, registerSite, refresh],
  );

  return (
    <RemoteSitesContext.Provider value={value}>
      {children}
    </RemoteSitesContext.Provider>
  );
}

export function useRemoteSites(): RemoteSitesContextValue {
  const context = useContext(RemoteSitesContext);
  if (!context) {
    throw new Error('useRemoteSites must be used within a RemoteSitesProvider');
  }
  return context;
}

/** Convenience: a single site by id (undefined while loading/not found). */
export function useRemoteSite(siteId: string | undefined): DerivedSite | undefined {
  const { sites } = useRemoteSites();
  return useMemo(() => sites.find((s) => s.id === siteId), [sites, siteId]);
}
