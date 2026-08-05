import type { DerivedSite } from '../state/RemoteSitesContext';

/** Minimal client shape a mention needs — kept small to avoid a heavy import. */
export interface ClientRef {
  id: number;
  name: string;
  company: string;
}

/** Minimal task shape a #mention needs. */
export interface TaskRef {
  id: string;
  title: string;
}

export type MessageSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; site: DerivedSite }
  | { type: 'clientMention'; client: ClientRef }
  | { type: 'taskMention'; taskId: string; title: string }
  | { type: 'link'; url: string };

// NOTE: a capturing split pattern keeps the URLs in the resulting array. It is
// created fresh per call — a shared /g regex is stateful across .test()/.exec()
// and would misclassify segments on repeated renders.
function splitLinks(text: string): MessageSegment[] {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts
    .filter((part) => part.length > 0)
    .map((part) =>
      /^https?:\/\/\S+$/.test(part)
        ? ({ type: 'link', url: part } as const)
        : ({ type: 'text', value: part } as const),
    );
}

type Candidate =
  | { kind: 'site'; name: string; site: DerivedSite }
  | { kind: 'client'; name: string; client: ClientRef };

/**
 * Splits a message body into text, site-mention, client-mention, and link
 * segments.
 *
 * A mention is an "@" immediately followed by a known site OR client name
 * (case-insensitive), e.g. "@Ledger Pay API" or "@ACME Corp". The longest
 * candidate name is matched first so overlapping prefixes resolve correctly;
 * when a site and a client share a name the site wins (historical behaviour).
 * `sites`/`clients` come from the caller rather than a static import, since the
 * real lists change at runtime.
 *
 * Bare URLs (http/https) anywhere in the remaining text are turned into
 * `link` segments so they render as clickable, styled links.
 */
export function parseMentions(
  body: string,
  sites: DerivedSite[],
  clients: ClientRef[] = [],
  tasks: TaskRef[] = [],
): MessageSegment[] {
  const candidates: Candidate[] = [
    ...sites.map((site) => ({ kind: 'site' as const, name: site.name, site })),
    ...clients.map((client) => ({ kind: 'client' as const, name: client.name, client })),
  ]
    // Sites before clients on a tie, then longest name first.
    .sort((a, b) => b.name.length - a.name.length || (a.kind === b.kind ? 0 : a.kind === 'site' ? -1 : 1));

  // Longest task title first so overlapping prefixes resolve to the fuller match.
  const taskCandidates = [...tasks]
    .filter((t) => t.title)
    .sort((a, b) => b.title.length - a.title.length);

  const raw: MessageSegment[] = [];
  let buffer = '';
  let i = 0;
  const flush = () => {
    if (buffer) {
      raw.push({ type: 'text', value: buffer });
      buffer = '';
    }
  };

  while (i < body.length) {
    if (body[i] === '@') {
      const rest = body.slice(i + 1);
      const hit = candidates.find((c) => c.name && rest.toLowerCase().startsWith(c.name.toLowerCase()));
      if (hit) {
        flush();
        raw.push(
          hit.kind === 'site'
            ? { type: 'mention', site: hit.site }
            : { type: 'clientMention', client: hit.client },
        );
        i += 1 + hit.name.length;
        continue;
      }
    }
    if (body[i] === '#') {
      const rest = body.slice(i + 1);
      const hit = taskCandidates.find((t) => rest.toLowerCase().startsWith(t.title.toLowerCase()));
      if (hit) {
        flush();
        raw.push({ type: 'taskMention', taskId: hit.id, title: hit.title });
        i += 1 + hit.title.length;
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
