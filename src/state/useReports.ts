import { useCallback, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useSync, useCollection, uid, stripMeta } from './SyncContext';

/**
 * Rapports (B1). A report is a formal write-up — for a client, or for the
 * team's memory — generated from concrete actions (a finished task, a client, a
 * decision) or written manually. Backed by the synced `reports` collection so
 * both operators share them.
 */

export type ReportType = 'task' | 'client' | 'decision' | 'manual';

/** A clickable reference from a report back to its origin entity. */
export interface ReportLink {
  kind: 'task' | 'client' | 'decision';
  /** Origin id (string for synced tasks/decisions, numeric-as-string for clients). */
  id: string;
  /** Snapshot label, so the chip reads well even if the origin is renamed/removed. */
  label: string;
}

export interface ReportDraft {
  type: ReportType;
  title: string;
  body: string;
  links: ReportLink[];
}

interface ReportData {
  type: ReportType;
  title: string;
  body: string;
  links: ReportLink[];
  authorEmail: string;
  createdAt: string;
}

export type Report = ReportData & { id: string; updatedAt: string };

export function useReports() {
  const { user } = useAuth();
  const email = user?.email ?? 'anon';
  const { upsert, remove } = useSync();
  const raw = useCollection<ReportData>('reports');

  const reports = useMemo<Report[]>(
    () =>
      raw
        .map((r) => ({
          id: r.id,
          type: r.type ?? 'manual',
          title: r.title ?? '',
          body: r.body ?? '',
          links: Array.isArray(r.links) ? r.links : [],
          authorEmail: r.authorEmail ?? '',
          createdAt: r.createdAt ?? r.updatedAt,
          updatedAt: r.updatedAt,
        }))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [raw],
  );

  const createReport = useCallback(
    (draft: ReportDraft): string => {
      const id = uid('report');
      upsert('reports', id, {
        type: draft.type,
        title: draft.title,
        body: draft.body,
        links: draft.links,
        authorEmail: email,
        createdAt: new Date().toISOString(),
      } satisfies ReportData);
      return id;
    },
    [email, upsert],
  );

  const updateReport = useCallback(
    (id: string, patch: Partial<ReportDraft>) => {
      const current = raw.find((r) => r.id === id);
      if (!current) return;
      upsert('reports', id, { ...stripMeta(current), ...patch });
    },
    [raw, upsert],
  );

  const deleteReport = useCallback((id: string) => remove('reports', id), [remove]);

  return { reports, createReport, updateReport, deleteReport };
}
