import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { generateReport, runAssistant } from './engine';
import { useRemoteSites, type DerivedSite } from '../state/RemoteSitesContext';
import { useAuth } from '../auth/AuthContext';
import type { RemoteEvent } from '../shared/api';
import type { ChatMessage, ReportMode, ReportRequest } from './types';
import {
  loadConversations,
  saveConversations,
  titleFor,
  type Conversation,
} from './conversations';

interface AssistantContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  messages: ChatMessage[];
  isThinking: boolean;
  sendMessage: (text: string) => void;
  /** Re-generate a report message in a different mode (internal ↔ client). */
  switchReportMode: (messageId: string, mode: ReportMode) => void;
  /* --- History (A5) --- */
  conversations: Conversation[];
  activeId: string | null;
  newConversation: () => void;
  openConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
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
  const { user } = useAuth();
  const email = user?.email ?? 'anon';

  // Persistent history (A5). `activeId` null means a fresh, unsaved conversation.
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  // Mirror of activeId that updates synchronously — the user message and the
  // assistant reply persist back-to-back, before React re-renders, so reading
  // state alone would create a duplicate conversation on the second write.
  const activeIdRef = useRef<string | null>(null);
  const setActiveId = useCallback((id: string | null) => {
    activeIdRef.current = id;
    setActiveIdState(id);
  }, []);

  // Keep a ref in sync so async callbacks always append to the latest messages.
  const messagesRef = useRef<ChatMessage[]>([]);
  const setMessagesSynced = useCallback((next: ChatMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  // Load this user's history when the account changes; start on a blank convo.
  useEffect(() => {
    setConversations(loadConversations(email));
    setActiveId(null);
    setMessagesSynced([]);
  }, [email, setMessagesSynced]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const emailRef = useRef(email);
  emailRef.current = email;

  /** Persists the given messages under the active (or a new) conversation. */
  const persist = useCallback((msgs: ChatMessage[]) => {
    if (msgs.length === 0) return;
    const nowIso = new Date().toISOString();
    setConversations((prev) => {
      let id = activeIdRef.current;
      let next: Conversation[];
      if (id && prev.some((c) => c.id === id)) {
        next = prev.map((c) =>
          c.id === id ? { ...c, messages: msgs, title: titleFor(msgs), updatedAt: nowIso } : c,
        );
      } else {
        id = uid('conv');
        setActiveId(id);
        next = [{ id, title: titleFor(msgs), messages: msgs, createdAt: nowIso, updatedAt: nowIso }, ...prev];
      }
      saveConversations(emailRef.current, next);
      return next;
    });
  }, [setActiveId]);

  const newConversation = useCallback(() => {
    setActiveId(null);
    setMessagesSynced([]);
  }, [setMessagesSynced]);

  const openConversation = useCallback(
    (id: string) => {
      const convo = conversations.find((c) => c.id === id);
      if (!convo) return;
      setActiveId(id);
      setMessagesSynced(convo.messages);
    },
    [conversations, setMessagesSynced],
  );

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        saveConversations(emailRef.current, next);
        return next;
      });
      if (activeId === id) {
        setActiveId(null);
        setMessagesSynced([]);
      }
    },
    [activeId, setMessagesSynced],
  );

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const withUser: ChatMessage[] = [
        ...messagesRef.current,
        { id: uid('u'), role: 'user', text: trimmed, createdAt: new Date().toISOString() },
      ];
      setMessagesSynced(withUser);
      persist(withUser);
      setIsThinking(true);

      // Warm the event cache for every site before asking the engine to
      // reason about the parc — small site count for this tool makes this
      // cheap, and loadEvents() is a no-op once a site is already cached.
      loadFreshEvents(sites, loadEvents, eventsBySite)
        .then((freshEvents) => runAssistant(trimmed, sites, freshEvents))
        .then((turn) => {
          const withAnswer: ChatMessage[] = [
            ...messagesRef.current,
            { id: uid('a'), role: 'assistant', turn, createdAt: new Date().toISOString() },
          ];
          setMessagesSynced(withAnswer);
          persist(withAnswer);
        })
        .finally(() => setIsThinking(false));
    },
    [sites, eventsBySite, loadEvents, setMessagesSynced, persist],
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
          const next = messagesRef.current.map((m) =>
            m.id === messageId ? { ...m, turn: { kind: 'report' as const, request, report } } : m,
          );
          setMessagesSynced(next);
          persist(next);
        });
    },
    [messages, sites, eventsBySite, loadEvents, setMessagesSynced, persist],
  );

  const value = useMemo(
    () => ({
      isOpen,
      open,
      close,
      messages,
      isThinking,
      sendMessage,
      switchReportMode,
      conversations,
      activeId,
      newConversation,
      openConversation,
      deleteConversation,
    }),
    [
      isOpen,
      open,
      close,
      messages,
      isThinking,
      sendMessage,
      switchReportMode,
      conversations,
      activeId,
      newConversation,
      openConversation,
      deleteConversation,
    ],
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
