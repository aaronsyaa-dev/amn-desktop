import type { DerivedSite } from '../state/RemoteSitesContext';

export type MessageSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; site: DerivedSite };

/**
 * Splits a message body into text and site-mention segments. A mention is an
 * "@" immediately followed by a known site name (case-insensitive), e.g.
 * "@Ledger Pay API". Longest site names are matched first so overlapping
 * prefixes resolve correctly. `sites` comes from the caller (RemoteSitesContext)
 * rather than a static import, since the real site list can change at runtime.
 */
export function parseMentions(body: string, sites: DerivedSite[]): MessageSegment[] {
  const sitesByLength = [...sites].sort((a, b) => b.name.length - a.name.length);

  const segments: MessageSegment[] = [];
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
          segments.push({ type: 'text', value: buffer });
          buffer = '';
        }
        segments.push({ type: 'mention', site });
        i += 1 + site.name.length;
        continue;
      }
    }
    buffer += body[i];
    i += 1;
  }

  if (buffer) segments.push({ type: 'text', value: buffer });
  return segments;
}
