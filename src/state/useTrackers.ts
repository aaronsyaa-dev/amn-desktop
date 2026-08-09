import { useCallback, useMemo } from 'react';
import { useSync, useCollection } from './SyncContext';
import { moduleByKey, modulesForTier } from '../data/trackerModules';
import { useRemoteSites } from './RemoteSitesContext';

/**
 * Per-site tracker configuration: which modules (paliers) are installed on each
 * site. Persisted through the existing sync layer (collection 'trackers', keyed
 * by siteId) — so it survives restarts via the local mirror and syncs across
 * operators once amn-api enables the collection. Each module is independent:
 * installing or removing one never touches the others.
 */
export interface TrackerConfigData {
  siteId: string;
  /** Installed module keys (see src/data/trackerModules.ts). */
  modules: string[];
  updatedAt: string;
}

export type TrackerConfig = TrackerConfigData & { id: string; updatedAt: string };

export function useTrackers() {
  const { upsert, remove, ready } = useSync();
  const rows = useCollection<TrackerConfigData>('trackers');

  const { sites } = useRemoteSites();

  const bySite = useMemo(() => {
    const map = new Map<string, string[]>();
    // The palier stored on amn-api comes first: it is the record of what is
    // really deployed on the client's site. Without it, a site registered from
    // the other operator's machine — or one whose local row predates the
    // 'trackers' collection being synced — appeared as "aucun module installé"
    // while it was visibly sending events, and the catalogue counted 0.
    for (const site of sites) {
      const implied = modulesForTier(site.tier);
      if (implied.length > 0) map.set(site.id, implied);
    }
    // A recorded choice then overrides it: the wizard is how an operator says
    // what is installed, and adding or removing a module there must be visible
    // immediately. The palier is the FALLBACK, not a floor.
    for (const row of rows) {
      // Guard against malformed rows; only keep known module keys.
      const mods = Array.isArray(row.modules) ? row.modules.filter((k) => moduleByKey(k)) : [];
      map.set(row.siteId ?? row.id, mods);
    }
    return map;
  }, [rows, sites]);

  const modulesForSite = useCallback((siteId: string): string[] => bySite.get(siteId) ?? [], [bySite]);

  const isInstalled = useCallback(
    (siteId: string, moduleKey: string) => (bySite.get(siteId) ?? []).includes(moduleKey),
    [bySite],
  );

  /** Replaces the full installed-module set for a site (used by the wizard). */
  const setModules = useCallback(
    (siteId: string, moduleKeys: string[]) => {
      const clean = Array.from(new Set(moduleKeys.filter((k) => moduleByKey(k))));
      if (clean.length === 0) {
        // No modules left → drop the record entirely.
        remove('trackers', siteId);
        return;
      }
      upsert('trackers', siteId, { siteId, modules: clean, updatedAt: new Date().toISOString() });
    },
    [upsert, remove],
  );

  const installModule = useCallback(
    (siteId: string, moduleKey: string) => {
      const current = bySite.get(siteId) ?? [];
      if (current.includes(moduleKey)) return;
      // Pull in any required modules (e.g. Suite requires Sentinel).
      const mod = moduleByKey(moduleKey);
      const withDeps = [...current, ...(mod?.requires ?? []), moduleKey];
      setModules(siteId, withDeps);
    },
    [bySite, setModules],
  );

  const removeModule = useCallback(
    (siteId: string, moduleKey: string) => {
      const current = bySite.get(siteId) ?? [];
      // Also remove modules that depend on the one being removed.
      const next = current.filter((k) => {
        if (k === moduleKey) return false;
        const dependsOnRemoved = moduleByKey(k)?.requires.includes(moduleKey);
        return !dependsOnRemoved;
      });
      setModules(siteId, next);
    },
    [bySite, setModules],
  );

  // Counted from the resolved view, not from the stored rows: otherwise the
  // catalogue announced "0 module déployé" for sites whose palier is live on
  // amn-api simply because this machine had no local row for them.
  const totalInstalled = useMemo(
    () => [...bySite.values()].reduce((n, mods) => n + mods.length, 0),
    [bySite],
  );

  return { ready, modulesForSite, isInstalled, setModules, installModule, removeModule, totalInstalled };
}
