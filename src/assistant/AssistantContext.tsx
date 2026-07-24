import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { generateReport, runAssistant } from './engine';
import { useRemoteSites, type DerivedSite } from '../state/RemoteSitesContext';
import type { RemoteEvent } from '../shared/api';
import type { ChatMessage, ReportMode, ReportRequest } from './types';

interface AssistantContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  messages: ChatMessage[];
  isThinking: boolean;
  sendMessage: (text: string) => void;
  /** Re-generate a report message in a different mode (internal ↔ client). */
  switchReportMode: (messageId: string, mode: ReportMode) => void;
}

const AssistantContext = createContext<AssistantContextValue | undefined>(
  undefined,
);

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Loads events for the given sites and returns a fresh map built directly
 * from the results — NOT from context state, which may still reflect the
 * pre-load snapshot by the time this promise resolves (React state updates
 * are async relative to this closure).
 */
async function loadFreshEvents(
  sites: DerivedSite[],
  loadEvents: (siteId: string) => Promise<RemoteEvent[]>,
  fallback: Record<string, RemoteEvent[]>,
): Promise<Record<string, RemoteEvent[]>> {
  const entries = await Promise.all(
    sites.map(async (s) => [s.id, await loadEvents(s.id).catch(() => fallback[s.id] ?? [])] as const),
  );
  return Object.fromEntries(entries);
}

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const { sites, eventsBySite, loadEvents } = useRemoteSites();

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      setMessages((prev) => [
        ...prev,
        { id: uid('u'), role: 'user', text: trimmed, createdAt: new Date().toISOString() },
      ]);
      setIsThinking(true);

      // Warm the event cache for every site before asking the engine to
      // reason about the parc — small site count for this tool makes this
      // cheap, and loadEvents() is a no-op once a site is already cached.
      loadFreshEvents(sites, loadEvents, eventsBySite)
        .then((freshEvents) => runAssistant(trimmed, sites, freshEvents))
        .then((turn) => {
          setMessages((prev) => [
            ...prev,
            { id: uid('a'), role: 'assistant', turn, createdAt: new Date().toISOString() },
          ]);
        })
        .finally(() => setIsThinking(false));
    },
    [sites, eventsBySite, loadEvents],
  );

  const switchReportMode = useCallback(
    (messageId: string, mode: ReportMode) => {
      const target = messages.find((m) => m.id === messageId);
      if (!target || target.turn?.kind !== 'report') return;
      const request: ReportRequest = { ...target.turn.request, mode };

      const relevantSites = request.siteId
        ? sites.filter((s) => s.id === request.siteId)
        : sites;

      loadFreshEvents(relevantSites, loadEvents, eventsBySite)
        .then((freshEvents) =>
          generateReport(request, sites, { ...eventsBySite, ...freshEvents }),
        )
        .then((report) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId
                ? { ...m, turn: { kind: 'report', request, report } }
                : m,
            ),
          );
        });
    },
    [messages, sites, eventsBySite, loadEvents],
  );

  const value = useMemo(
    () => ({ isOpen, open, close, messages, isThinking, sendMessage, switchReportMode }),
    [isOpen, open, close, messages, isThinking, sendMessage, switchReportMode],
  );

  return (
    <AssistantContext.Provider value={value}>
      {children}
    </AssistantContext.Provider>
  );
}

export function useAssistant(): AssistantContextValue {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error('useAssistant must be used within an AssistantProvider');
  }
  return context;
}
