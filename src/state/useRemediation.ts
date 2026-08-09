import { useCallback, useMemo } from 'react';
import { useSync, useCollection } from './SyncContext';
import { useAuth } from '../auth/AuthContext';

/**
 * Per-finding remediation state — the "corrigé" checklist of BLOC 5.
 *
 * Two decisions shape this:
 *
 *  - It is keyed by `<host>::<findingId>`, NOT by scan id. A scan is a
 *    snapshot; the vulnerability is the thing being tracked. Keying on the scan
 *    would reset every checkbox the moment the weekly run produced a new one,
 *    which is exactly the history the operator wants to keep.
 *
 *  - It lives in a synced collection, so a finding one operator marks fixed is
 *    fixed for the other too, and the record outlives the scan that raised it.
 */

export interface RemediationEntry {
  fixed: boolean;
  /** When it was marked fixed (or unmarked). */
  at: string;
  /** Who marked it. */
  by: string;
  /** Kept for display when the finding is no longer in the latest scan. */
  title: string;
  host: string;
}

type StoredEntry = RemediationEntry & { id: string; updatedAt: string };

/** Host of a scanned URL, or the raw value when it isn't parseable. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

export function remediationKey(url: string, findingId: string): string {
  return `${hostOf(url)}::${findingId}`;
}

export function useRemediation() {
  const { upsert } = useSync();
  const { user } = useAuth();
  const rows = useCollection<StoredEntry>('remediation');

  const byKey = useMemo(() => {
    const map = new Map<string, StoredEntry>();
    for (const row of rows) map.set(row.id, row);
    return map;
  }, [rows]);

  const isFixed = useCallback(
    (url: string, findingId: string) => byKey.get(remediationKey(url, findingId))?.fixed ?? false,
    [byKey],
  );

  const entryFor = useCallback(
    (url: string, findingId: string) => byKey.get(remediationKey(url, findingId)) ?? null,
    [byKey],
  );

  const setFixed = useCallback(
    (url: string, findingId: string, title: string, fixed: boolean) => {
      const key = remediationKey(url, findingId);
      void upsert('remediation', key, {
        fixed,
        at: new Date().toISOString(),
        by: user?.email ?? '',
        title,
        host: hostOf(url),
      });
    },
    [upsert, user?.email],
  );

  /** Everything marked fixed for one host, newest first — the running history. */
  const historyFor = useCallback(
    (url: string) => {
      const host = hostOf(url);
      return rows
        .filter((r) => r.host === host && r.fixed)
        .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
    },
    [rows],
  );

  return { isFixed, entryFor, setFixed, historyFor };
}
