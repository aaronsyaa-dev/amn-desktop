import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSync, recordWriter } from './SyncContext';
import { useAuth } from '../auth/AuthContext';
import { AJMANI_EMAIL } from '../lib/ajmaniChat';
import type { SyncedCollection } from '../shared/api';

/**
 * Cross-collection activity awareness (A3.2 + A3.3).
 *
 * Every synced write is stamped with its author (see WRITER_KEY in SyncContext),
 * so we can tell, durably, what the OTHER operator has added or changed across
 * all shared collections. From that we derive two things:
 *
 *  - `unseen[routeKey]` — how many records in each tab's collection changed
 *    since this operator last opened that tab (numeric sidebar badges, A3.3).
 *  - `events` — a chronological feed of the other operator's recent changes,
 *    shown on Accueil (A3.2).
 *
 * "Last seen" is per-operator and LOCAL (localStorage): a badge means "new to
 * *you*, on this machine", reset by visiting the tab. First run baselines every
 * tab to now so pre-existing history doesn't show up as unseen.
 */

export interface ActivityTab {
  routeKey: string;
  collection: SyncedCollection;
  /** Icon label used in the activity feed (e.g. "Tâche"). */
  noun: string;
}

/** Tabs whose collection is shared and where "the other added something" reads well. */
export const ACTIVITY_TABS: ActivityTab[] = [
  { routeKey: '/team', collection: 'messages', noun: 'Message' },
  { routeKey: '/tasks', collection: 'tasks', noun: 'Tâche' },
  { routeKey: '/decisions', collection: 'decisions', noun: 'Décision' },
  { routeKey: '/knowledge', collection: 'knowledge', noun: 'Connaissance' },
  { routeKey: '/notes', collection: 'notes', noun: 'Note' },
];

export interface ActivityEvent {
  key: string;
  routeKey: string;
  collection: SyncedCollection;
  noun: string;
  /** Short human description of the record (title or message excerpt). */
  text: string;
  actorEmail: string;
  at: string;
}

interface ActivityContextValue {
  /** Unseen count per tab routeKey (records changed by the other operator since last visit). */
  unseen: Record<string, number>;
  /** Sum of all unseen counts. */
  totalUnseen: number;
  /** The other operator's recent changes, newest first (capped). */
  events: ActivityEvent[];
  /** Mark a tab as seen now (clears its badge). */
  markSeen: (routeKey: string) => void;
}

const ActivityContext = createContext<ActivityContextValue | undefined>(undefined);

const SEEN_PREFIX = 'amn.activity.seen.';
const MAX_EVENTS = 40;

function seenKey(email: string | undefined): string {
  return SEEN_PREFIX + (email || 'anon');
}

function loadSeen(email: string | undefined, baseline: string): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(seenKey(email));
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    /* fall through to baseline */
  }
  // First run for this operator: baseline every tab to "now" so existing
  // history isn't counted as unseen.
  const init: Record<string, string> = {};
  for (const t of ACTIVITY_TABS) init[t.routeKey] = baseline;
  try {
    window.localStorage.setItem(seenKey(email), JSON.stringify(init));
  } catch {
    /* ignore quota */
  }
  return init;
}

/** Short label for one record, per collection shape. */
function describe(collection: SyncedCollection, data: Record<string, unknown>): string {
  const str = (k: string) => (typeof data[k] === 'string' ? (data[k] as string) : '');
  if (collection === 'messages') {
    const body = str('body').trim();
    if (body) return body.length > 80 ? `${body.slice(0, 80)}…` : body;
    const atts = Array.isArray(data.attachments) ? data.attachments.length : 0;
    return atts > 0 ? 'a partagé un média' : 'a écrit un message';
  }
  const title = str('title').trim();
  return title || 'Sans titre';
}

export function ActivityProvider({ children }: { children: React.ReactNode }) {
  const { useRecords } = useSync();
  const { user } = useAuth();
  const myEmail = user?.email;

  // Stable per-mount baseline for tabs never seen before.
  const baseline = useRef(new Date().toISOString());
  const [seen, setSeen] = useState<Record<string, string>>(() => loadSeen(myEmail, baseline.current));

  const markSeen = useCallback(
    (routeKey: string) => {
      if (!ACTIVITY_TABS.some((t) => t.routeKey === routeKey)) return;
      setSeen((prev) => {
        const next = { ...prev, [routeKey]: new Date().toISOString() };
        try {
          window.localStorage.setItem(seenKey(myEmail), JSON.stringify(next));
        } catch {
          /* ignore quota */
        }
        return next;
      });
    },
    [myEmail],
  );

  // Pull raw records for every activity collection. Hooks must be called
  // unconditionally and in a fixed order, so one call per collection (the tab
  // list is a compile-time constant). useRecords returns a fresh filtered array
  // when the store changes, so the memo below recomputes on live sync.
  const messagesR = useRecords('messages');
  const tasksR = useRecords('tasks');
  const decisionsR = useRecords('decisions');
  const knowledgeR = useRecords('knowledge');
  const notesR = useRecords('notes');
  const recordsByRoute: Record<string, typeof messagesR> = {
    '/team': messagesR,
    '/tasks': tasksR,
    '/decisions': decisionsR,
    '/knowledge': knowledgeR,
    '/notes': notesR,
  };

  const { unseen, events } = useMemo(() => {
    const counts: Record<string, number> = {};
    const feed: ActivityEvent[] = [];

    for (const tab of ACTIVITY_TABS) {
      const records = recordsByRoute[tab.routeKey] ?? [];
      const since = seen[tab.routeKey] ?? baseline.current;
      let n = 0;
      for (const r of records) {
        const writer = recordWriter(r.data);
        // Only the OTHER human operator's writes qualify (skip self + Ajmani).
        if (!writer || writer === myEmail || writer === AJMANI_EMAIL) continue;
        const at = r.updatedAt || '';
        feed.push({
          key: `${tab.collection}:${r.id}`,
          routeKey: tab.routeKey,
          collection: tab.collection,
          noun: tab.noun,
          text: describe(tab.collection, r.data),
          actorEmail: writer,
          at,
        });
        if (at > since) n += 1;
      }
      counts[tab.routeKey] = n;
    }

    feed.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
    return { unseen: counts, events: feed.slice(0, MAX_EVENTS) };
  }, [messagesR, tasksR, decisionsR, knowledgeR, notesR, seen, myEmail]);

  const totalUnseen = useMemo(
    () => Object.values(unseen).reduce((a, b) => a + b, 0),
    [unseen],
  );

  const value = useMemo(
    () => ({ unseen, totalUnseen, events, markSeen }),
    [unseen, totalUnseen, events, markSeen],
  );

  return <ActivityContext.Provider value={value}>{children}</ActivityContext.Provider>;
}

export function useActivity(): ActivityContextValue {
  const ctx = useContext(ActivityContext);
  if (!ctx) throw new Error('useActivity must be used within an ActivityProvider');
  return ctx;
}
