import { useCallback, useMemo } from 'react';
import { useSync, useCollection } from './SyncContext';
import { moduleByKey } from '../data/trackerModules';

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

  const bySite = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of rows) {
      // Guard against malformed rows; only keep known module keys.
      const mods = Array.isArray(row.modules) ? row.modules.filter((k) => moduleByKey(k)) : [];
      map.set(row.siteId ?? row.id, mods);
    }
    return map;
  }, [rows]);

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

  const totalInstalled = useMemo(
    () => rows.reduce((n, r) => n + (Array.isArray(r.modules) ? r.modules.length : 0), 0),
    [rows],
  );

  return { ready, modulesForSite, isInstalled, setModules, installModule, removeModule, totalInstalled };
}
