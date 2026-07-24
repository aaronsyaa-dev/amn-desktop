import type { Insight, WatchItem } from '../assistant/types';
import type { Message, RemoteEvent, RemoteSeverity } from '../shared/api';
import type { DerivedSite } from '../state/RemoteSitesContext';
import { remoteEventDetail, remoteEventLabel } from './remoteEventDisplay';

export type FeedItem =
  | {
      kind: 'alert';
      id: string;
      timestamp: string;
      siteId: string;
      siteName: string;
      title: string;
      detail: string;
      severity: RemoteSeverity;
    }
  | {
      kind: 'news';
      id: string;
      timestamp: string;
      category: string;
      title: string;
    }
  | {
      kind: 'message';
      id: string;
      timestamp: string;
      author: string;
      body: string;
    }
  | {
      kind: 'insight';
      id: string;
      timestamp: string;
      title: string;
      body: string;
      tone: 'positive' | 'neutral' | 'warning';
      siteId?: string;
    };

const MINUTE = 60 * 1000;

/**
 * Builds a unified, reverse-chronological activity stream mixing real site
 * alerts, real team messages, watch news (still mock content — there is no
 * real news feed to source) and generated insights — the "always something
 * to see" feed of the home QG. Pure function: all data comes from the
 * caller (sites/events from RemoteSitesContext, messages from the bridge),
 * so this file has no data-source opinions of its own.
 */
export function buildActivityFeed(
  {
    sites,
    eventsBySite,
    insights,
    watchItems,
    messages,
  }: {
    sites: DerivedSite[];
    eventsBySite: Record<string, RemoteEvent[]>;
    insights: Insight[];
    watchItems: WatchItem[];
    messages: Message[];
  },
  limit = 14,
): FeedItem[] {
  const now = Date.now();
  const siteById = new Map(sites.map((s) => [s.id, s]));

  const alerts: FeedItem[] = Object.entries(eventsBySite)
    .flatMap(([siteId, events]) =>
      events
        .filter((e): e is RemoteEvent & { severity: RemoteSeverity } =>
          e.type === 'security_alert' && e.severity !== null,
        )
        .map((event) => {
          const site = siteById.get(siteId);
          return {
            kind: 'alert' as const,
            id: `feed-alert-${siteId}-${event.id}`,
            timestamp: event.occurredAt,
            siteId,
            siteName: site?.name ?? siteId,
            title: remoteEventLabel(event),
            detail: remoteEventDetail(event),
            severity: event.severity,
          };
        }),
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8);

  const news: FeedItem[] = watchItems.slice(0, 3).map((n) => ({
    kind: 'news',
    id: `feed-${n.id}`,
    timestamp: new Date(n.date).toISOString(),
    category: n.category,
    title: n.title,
  }));

  const insightItems: FeedItem[] = insights.map((ins, i) => ({
    kind: 'insight',
    id: `feed-${ins.id}`,
    timestamp: new Date(now - (i + 1) * 40 * MINUTE).toISOString(),
    title: ins.title,
    body: ins.body,
    tone: ins.tone,
    siteId: ins.siteId,
  }));

  const messageItems: FeedItem[] = messages
    .slice(-6)
    .map((m) => ({
      kind: 'message' as const,
      id: `feed-msg-${m.id}`,
      timestamp: m.createdAt,
      author: m.authorName,
      body: m.body,
    }));

  return [...alerts, ...news, ...insightItems, ...messageItems]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}
