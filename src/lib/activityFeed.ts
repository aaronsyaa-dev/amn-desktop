import { getGlobalAlerts } from '../data/mockSites';
import { getInsights, getWatchItems } from '../assistant/engine';
import type { AlertSeverity } from '../types/site';

export type FeedItem =
  | {
      kind: 'alert';
      id: string;
      timestamp: string;
      siteId: string;
      siteName: string;
      title: string;
      detail: string;
      severity: AlertSeverity;
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
const HOUR = 60 * MINUTE;

/** A few mock team messages so the feed feels alive even without real chat. */
function mockTeamMessages(now: number): FeedItem[] {
  return [
    {
      kind: 'message',
      id: 'feed-msg-1',
      timestamp: new Date(now - 25 * MINUTE).toISOString(),
      author: 'Mohamed',
      body: 'Je regarde la latence PSP sur Ledger Pay API, je te tiens au courant.',
    },
    {
      kind: 'message',
      id: 'feed-msg-2',
      timestamp: new Date(now - 2 * HOUR).toISOString(),
      author: 'Aaron',
      body: 'RAS sur Nova Store ce matin, le pic de trafic est bien absorbé.',
    },
  ];
}

/**
 * Builds a unified, reverse-chronological activity stream mixing site alerts,
 * team messages, watch news and generated insights — the "always something to
 * see" feed of the home QG.
 */
export function buildActivityFeed(limit = 14): FeedItem[] {
  const now = Date.now();

  const alerts: FeedItem[] = getGlobalAlerts()
    .slice(0, 8)
    .map((a) => ({
      kind: 'alert',
      id: `feed-${a.site.id}-${a.id}`,
      timestamp: a.timestamp,
      siteId: a.site.id,
      siteName: a.site.name,
      title: a.title,
      detail: a.detail,
      severity: a.severity,
    }));

  const news: FeedItem[] = getWatchItems()
    .slice(0, 3)
    .map((n) => ({
      kind: 'news',
      id: `feed-${n.id}`,
      timestamp: new Date(n.date).toISOString(),
      category: n.category,
      title: n.title,
    }));

  const insights: FeedItem[] = getInsights().map((ins, i) => ({
    kind: 'insight',
    id: `feed-${ins.id}`,
    timestamp: new Date(now - (i + 1) * 40 * MINUTE).toISOString(),
    title: ins.title,
    body: ins.body,
    tone: ins.tone,
    siteId: ins.siteId,
  }));

  return [...alerts, ...news, ...insights, ...mockTeamMessages(now)]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, limit);
}
