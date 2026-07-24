import type { DerivedSite } from '../state/RemoteSitesContext';

export type MessageSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; site: DerivedSite }
  | { type: 'link'; url: string };

const URL_RE = /(https?:\/\/[^\s]+)/g;

/** Splits a plain-text run into text/link segments by detecting bare URLs. */
function splitLinks(text: string): MessageSegment[] {
  const parts = text.split(URL_RE);
  return parts
    .filter((part) => part.length > 0)
    .map((part) =>
      URL_RE.test(part) && part.match(/^https?:\/\//)
        ? { type: 'link' as const, url: part }
        : { type: 'text' as const, value: part },
    );
}

/**
 * Splits a message body into text, site-mention, and link segments.
 *
 * A mention is an "@" immediately followed by a known site name
 * (case-insensitive), e.g. "@Ledger Pay API". Longest site names are matched
 * first so overlapping prefixes resolve correctly. `sites` comes from the
 * caller (RemoteSitesContext) rather than a static import, since the real
 * site list can change at runtime.
 *
 * Bare URLs (http/https) anywhere in the remaining text are turned into
 * `link` segments so they render as clickable, styled links.
 */
export function parseMentions(body: string, sites: DerivedSite[]): MessageSegment[] {
  const sitesByLength = [...sites].sort((a, b) => b.name.length - a.name.length);

  const raw: MessageSegment[] = [];
  let buffer = '';
  let i = 0;

  while (i < body.length) {
    if (body[i] === '@') {
      const rest = body.slice(i + 1);
      const site = sitesByLength.find((s) =>
        rest.toLowerCase().startsWith(s.name.toLowerCase()),
      );
      if (site) {
        if (buffer) {
          raw.push({ type: 'text', value: buffer });
          buffer = '';
        }
        raw.push({ type: 'mention', site });
        i += 1 + site.name.length;
        continue;
      }
    }
    buffer += body[i];
    i += 1;
  }
  if (buffer) raw.push({ type: 'text', value: buffer });

  // Second pass: split any plain-text segments further into text/link runs.
  return raw.flatMap((segment) => (segment.type === 'text' ? splitLinks(segment.value) : [segment]));
}

/** True if the string contains at least one http(s) URL — used for lightweight link previews. */
export function extractFirstUrl(body: string): string | null {
  const match = body.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

/** Best-effort "site name" from a URL, for a simple text-only link preview (no network fetch). */
export function urlDisplayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
