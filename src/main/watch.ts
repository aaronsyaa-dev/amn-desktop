import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';
import type { WatchItem, WatchFeedResult } from '../shared/api';

/**
 * Real cyber/tech watch feed, fetched from public RSS sources in the main
 * process (the renderer can't fetch cross-origin RSS). Results are cached on
 * disk and refreshed on a TTL — never on every panel open — so we don't hammer
 * the sources. A source that is unreachable is simply skipped for that refresh;
 * it never breaks the feed (the last good cache, even stale, is served).
 *
 * Sources are reputable and free:
 *  - CERT-FR (the French national CERT, operated by ANSSI): actualité, alertes,
 *    avis. This is the authoritative French-language cyber source.
 *  - The Hacker News: widely-followed general cyber news.
 *
 * NOTE on Anthropic: there is no official public RSS feed for the Anthropic
 * blog/news at time of writing, so it is intentionally omitted rather than
 * faked. If one appears, add it to FEEDS below.
 */

interface FeedSource {
  name: string;
  url: string;
  category: string;
}

const FEEDS: FeedSource[] = [
  { name: 'CERT-FR — Alertes', url: 'https://www.cert.ssi.gouv.fr/alerte/feed/', category: 'Vulnérabilité' },
  { name: 'CERT-FR — Avis', url: 'https://www.cert.ssi.gouv.fr/avis/feed/', category: 'Vulnérabilité' },
  { name: 'CERT-FR — Actualité', url: 'https://www.cert.ssi.gouv.fr/feed/', category: 'Cybersécurité' },
  { name: 'The Hacker News', url: 'https://feeds.feedburner.com/TheHackersNews', category: 'Cybersécurité' },
];

const TTL_MS = 3 * 60 * 60 * 1000; // 3 hours
const FETCH_TIMEOUT_MS = 9000;
const MAX_ITEMS = 30;
const MAX_SUMMARY = 260;

const cacheFile = () => path.join(app.getPath('userData'), 'watch-cache.json');

let inFlight: Promise<WatchFeedResult> | null = null;

/* ------------------------------- RSS parsing ------------------------------ */

// Common named entities, incl. the accented French ones CERT-FR uses heavily.
const NAMED_ENTITIES: Record<string, string> = {
  lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë',
  agrave: 'à', acirc: 'â', auml: 'ä', ccedil: 'ç',
  icirc: 'î', iuml: 'ï', ocirc: 'ô', ouml: 'ö', oelig: 'œ',
  ugrave: 'ù', ucirc: 'û', uuml: 'ü', ntilde: 'ñ',
  Eacute: 'É', Egrave: 'È', Agrave: 'À', Ccedil: 'Ç',
  laquo: '«', raquo: '»', hellip: '…', deg: '°', euro: '€',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
  mdash: '—', ndash: '–', middot: '·', times: '×', copy: '©', reg: '®',
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (whole, name) =>
      Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name) ? NAMED_ENTITIES[name] : whole,
    )
    .replace(/&amp;/g, '&'); // last, so we don't double-decode
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Inner text of the first <tag>…</tag> in `block`, CDATA-aware. */
function tag(block: string, name: string): string {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  if (!m) return '';
  let v = m[1].trim();
  const cdata = v.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdata) v = cdata[1];
  return v.trim();
}

/** Atom <link href="…"/> or RSS <link>…</link>. */
function extractLink(block: string): string {
  const rss = tag(block, 'link');
  if (rss && !rss.startsWith('<')) return rss;
  const atom = block.match(/<link[^>]*href=["']([^"']+)["']/i);
  return atom ? atom[1] : '';
}

function parseFeed(xml: string, source: FeedSource): WatchItem[] {
  // Support both RSS <item> and Atom <entry>.
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/(item|entry)>/gi) ?? [];
  const items: WatchItem[] = [];
  for (const block of blocks) {
    const title = decodeEntities(stripHtml(tag(block, 'title')));
    if (!title) continue;
    const rawDesc = tag(block, 'description') || tag(block, 'summary') || tag(block, 'content');
    const summaryFull = decodeEntities(stripHtml(rawDesc));
    const summary =
      summaryFull.length > MAX_SUMMARY ? `${summaryFull.slice(0, MAX_SUMMARY).trimEnd()}…` : summaryFull;
    const dateRaw = tag(block, 'pubDate') || tag(block, 'updated') || tag(block, 'published') || tag(block, 'dc:date');
    const parsed = dateRaw ? new Date(dateRaw) : null;
    const date = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
    const link = extractLink(block);
    items.push({
      id: `${source.name}:${link || title}`,
      category: source.category,
      title,
      summary,
      source: source.name,
      date,
      link: link || undefined,
    });
  }
  return items;
}

/* --------------------------------- fetch ---------------------------------- */

async function fetchFeed(source: FeedSource): Promise<WatchItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        // Some feeds reject requests without a UA / Accept.
        'User-Agent': 'AMN-Desktop/1.0 (+https://amn-devsec.com)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    return parseFeed(xml, source);
  } finally {
    clearTimeout(timer);
  }
}

function readCache(): WatchFeedResult | null {
  try {
    const raw = fs.readFileSync(cacheFile(), 'utf-8');
    const parsed = JSON.parse(raw) as WatchFeedResult;
    if (Array.isArray(parsed.items)) return parsed;
  } catch {
    /* no cache yet */
  }
  return null;
}

function writeCache(result: WatchFeedResult): void {
  try {
    fs.writeFileSync(cacheFile(), JSON.stringify(result));
  } catch {
    /* non-fatal */
  }
}

async function refresh(): Promise<WatchFeedResult> {
  const settled = await Promise.allSettled(FEEDS.map(fetchFeed));
  const items: WatchItem[] = [];
  let okCount = 0;
  settled.forEach((r) => {
    if (r.status === 'fulfilled') {
      okCount += 1;
      items.push(...r.value);
    }
  });

  // Every source failed: keep serving the last good cache (even if stale)
  // rather than wiping the feed to empty.
  if (okCount === 0) {
    const cached = readCache();
    if (cached && cached.items.length > 0) {
      return { ...cached, degraded: true };
    }
    const empty: WatchFeedResult = { items: [], fetchedAt: new Date().toISOString(), degraded: true };
    return empty;
  }

  // Dedupe by link/title, newest first, capped.
  const seen = new Set<string>();
  const deduped = items
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .filter((it) => {
      const key = it.link || it.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, MAX_ITEMS);

  const result: WatchFeedResult = {
    items: deduped,
    fetchedAt: new Date().toISOString(),
    degraded: okCount < FEEDS.length,
  };
  writeCache(result);
  return result;
}

function isStale(result: WatchFeedResult | null): boolean {
  if (!result || !result.fetchedAt) return true;
  return Date.now() - new Date(result.fetchedAt).getTime() > TTL_MS;
}

/**
 * Returns the watch feed. Serves fresh cache instantly; if the cache is stale it
 * is still served immediately while a refresh runs in the background. Only the
 * very first run (no cache at all) awaits the network.
 */
export async function getWatch(force = false): Promise<WatchFeedResult> {
  const cached = readCache();

  if (force) {
    // User-initiated refresh: fetch now, bypassing the TTL (but still coalesce
    // with any in-flight refresh so we never hammer the sources).
    if (!inFlight) {
      inFlight = refresh().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  }

  if (cached && !isStale(cached)) return cached;

  if (!inFlight) {
    inFlight = refresh().finally(() => {
      inFlight = null;
    });
  }

  // Stale-but-present cache: return it now, let the refresh finish in the
  // background for next time.
  if (cached && cached.items.length > 0) return cached;

  // First run / empty cache: wait for the fetch.
  return inFlight;
}

/** Kicks off a background refresh at startup if the cache is stale. */
export function warmWatch(): void {
  const cached = readCache();
  if (isStale(cached) && !inFlight) {
    inFlight = refresh().finally(() => {
      inFlight = null;
    });
    inFlight.catch(() => {
      /* ignore — getWatch handles failures */
    });
  }
}
