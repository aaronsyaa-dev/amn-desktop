import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { bridge } from '../lib/bridge';
import { useRemoteSites } from './RemoteSitesContext';
import { useSync, useCollection, uid } from './SyncContext';

/**
 * Per-site registry data: the site's public URL, and its internal discussion
 * thread.
 *
 * The URL lives in the amn-api `sites` table, and ONLY there. It used to live
 * in the `siteMeta` synced collection instead, which put the same fact in two
 * places: the Sites tab wrote one, while every server-side feature that needs a
 * URL — the availability probe, the Scanner/Comply matching, and SSL Monitor —
 * read the other. A site with a URL typed in the Sites tab therefore looked
 * URL-less to the server, which is why SSL Monitor showed nothing and appeared
 * to be asking for a URL that had already been entered.
 *
 * `siteMeta` is still READ, so no existing URL is lost, and each one found
 * there is pushed up to the server once and then dropped. New writes go
 * straight to the server.
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
  const { sites, refresh } = useRemoteSites();
  const metaRaw = useCollection<SiteMetaData>('siteMeta');
  const notesRaw = useCollection<SiteNoteData>('siteNotes');

  /** Legacy URLs still sitting in the synced collection, keyed by site id. */
  const legacyUrlBySite = useMemo(() => {
    const map: Record<string, string> = {};
    for (const m of metaRaw) if (typeof m.url === 'string' && m.url) map[m.id] = m.url;
    return map;
  }, [metaRaw]);

  /**
   * siteId -> url. The server value wins; a legacy value only shows through
   * until the migration below has moved it, so the field never looks empty in
   * the meantime.
   */
  const urlBySite = useMemo(() => {
    const map: Record<string, string> = { ...legacyUrlBySite };
    for (const site of sites) if (site.url) map[site.id] = site.url;
    return map;
  }, [sites, legacyUrlBySite]);

  /**
   * One-shot migration of URLs left in `siteMeta`. Runs at most once per site
   * per session and only when the server has none, so it can never overwrite a
   * URL an operator has since corrected on the server side.
   */
  const migrated = useRef(new Set<string>());
  useEffect(() => {
    for (const site of sites) {
      const legacy = legacyUrlBySite[site.id];
      if (!legacy || site.url || migrated.current.has(site.id)) continue;
      migrated.current.add(site.id);
      void bridge()
        .remote.configureSite(site.id, { url: legacy })
        .then(() => {
          remove('siteMeta', site.id);
          return refresh();
        })
        .catch(() => {
          // Offline or amn-api down: leave the legacy value in place and retry
          // on a later session rather than losing the URL.
          migrated.current.delete(site.id);
        });
    }
  }, [sites, legacyUrlBySite, remove, refresh]);

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

  /**
   * Stores (or clears) a site's public URL — on the server, which is the only
   * place that counts. Everything that acts on a URL without a desktop open
   * (availability probe, SSL Monitor, scheduled scans) reads it from there.
   */
  const setSiteUrl = useCallback(
    async (siteId: string, url: string) => {
      const value = url.trim();
      await bridge().remote.configureSite(siteId, { url: value || null });
      // A leftover legacy row would otherwise resurrect the old value.
      if (legacyUrlBySite[siteId] !== undefined) remove('siteMeta', siteId);
      await refresh();
    },
    [legacyUrlBySite, remove, refresh],
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
      if (legacyUrlBySite[siteId] !== undefined) remove('siteMeta', siteId);
      for (const n of notesBySite[siteId] ?? []) remove('siteNotes', n.id);
    },
    [legacyUrlBySite, notesBySite, remove],
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
