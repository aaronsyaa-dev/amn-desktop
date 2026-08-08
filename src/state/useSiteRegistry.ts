import { useCallback, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useSync, useCollection, uid } from './SyncContext';

/**
 * Per-site registry data: the site's public URL, and its internal discussion
 * thread. Both live in synced collections rather than the amn-api `sites`
 * table, so they're shared between Aaron and Mohamed through the existing sync
 * with no schema change (see amn-api collections.js ALLOWED).
 *
 * The discussion is deliberately separate from the Équipe chat: it's the notes
 * you want to find again next to *this* client's site, not in a scrolling
 * general thread.
 */

interface SiteMetaData {
  /** Public URL of the site, as entered by an operator. */
  url: string;
}

interface SiteNoteData {
  siteId: string;
  body: string;
  authorEmail: string;
  createdAt: string;
}

export type SiteNote = SiteNoteData & { id: string; updatedAt: string };

export function useSiteRegistry() {
  const { user } = useAuth();
  const email = user?.email ?? 'anon';
  const { upsert, remove } = useSync();
  const metaRaw = useCollection<SiteMetaData>('siteMeta');
  const notesRaw = useCollection<SiteNoteData>('siteNotes');

  /** siteId -> url, for O(1) lookup while rendering the list. */
  const urlBySite = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of metaRaw) if (typeof m.url === 'string' && m.url) map[m.id] = m.url;
    return map;
  }, [metaRaw]);

  /** siteId -> its notes, oldest first (a conversation reads downward). */
  const notesBySite = useMemo(() => {
    const map: Record<string, SiteNote[]> = {};
    for (const n of notesRaw) {
      if (!n.siteId) continue;
      const note: SiteNote = {
        id: n.id,
        siteId: n.siteId,
        body: n.body ?? '',
        authorEmail: n.authorEmail ?? '',
        createdAt: n.createdAt ?? n.updatedAt,
        updatedAt: n.updatedAt,
      };
      (map[n.siteId] ??= []).push(note);
    }
    for (const list of Object.values(map)) {
      list.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    }
    return map;
  }, [notesRaw]);

  /** Stores (or clears) a site's public URL. Keyed by site id. */
  const setSiteUrl = useCallback(
    (siteId: string, url: string) => {
      upsert('siteMeta', siteId, { url: url.trim() } satisfies SiteMetaData);
    },
    [upsert],
  );

  const addNote = useCallback(
    (siteId: string, body: string) => {
      const text = body.trim();
      if (!text) return;
      upsert('siteNotes', uid('snote'), {
        siteId,
        body: text,
        authorEmail: email,
        createdAt: new Date().toISOString(),
      } satisfies SiteNoteData);
    },
    [email, upsert],
  );

  const deleteNote = useCallback((id: string) => remove('siteNotes', id), [remove]);

  /** Drops a deleted site's URL and its whole thread, so nothing is orphaned. */
  const forgetSite = useCallback(
    (siteId: string) => {
      if (urlBySite[siteId] !== undefined) remove('siteMeta', siteId);
      for (const n of notesBySite[siteId] ?? []) remove('siteNotes', n.id);
    },
    [urlBySite, notesBySite, remove],
  );

  return { urlBySite, notesBySite, setSiteUrl, addNote, deleteNote, forgetSite };
}

/**
 * Normalises an operator-entered URL for use in an href: adds https:// when no
 * scheme was typed, and refuses anything that isn't http(s) so a stored value
 * can never become a javascript: or data: link.
 */
export function safeSiteHref(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
