import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { generateReport, runAssistant, type Generate } from './engine';
import { useRemoteSites, type DerivedSite } from '../state/RemoteSitesContext';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../state/ToastContext';
import { bridge } from '../lib/bridge';
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
  /* --- Local AI / Ollama (A6) --- */
  ollamaAvailable: boolean;
  ollamaModels: string[];
  ollamaModel: string | null;
  setOllamaModel: (m: string) => void;
  refreshOllama: () => void;
}

const AssistantContext = createContext<AssistantContextValue | undefined>(
  undefined,
);

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Short text preview of an assistant turn, for notifications. */
function previewOfTurn(turn: ChatMessage['turn']): string {
  if (!turn) return 'Réponse prête.';
  if (turn.kind === 'report') return turn.report.title;
  const first = turn.blocks.find(
    (b) => b.type === 'paragraph' || b.type === 'heading',
  );
  if (first && (first.type === 'paragraph' || first.type === 'heading')) return first.text;
  return 'Réponse prête.';
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
  const { notify: toast } = useToast();
  const email = user?.email ?? 'anon';

  // Track whether the panel is open + the window focused, so we only nudge the
  // user when a reply lands while they've looked away (2.5).
  const isOpenRef = useRef(false);
  isOpenRef.current = isOpen;
  const windowFocusedRef = useRef(true);
  useEffect(() => {
    const onFocus = () => (windowFocusedRef.current = true);
    const onBlur = () => (windowFocusedRef.current = false);
    const onVisibility = () => (windowFocusedRef.current = document.visibilityState === 'visible');
    window.addEventListener('focus', onFocus);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

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

  // Quick access: Ctrl/⌘ + J toggles Ajmani from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const emailRef = useRef(email);
  emailRef.current = email;

  // --- Local AI (Ollama), A6 -------------------------------------------------
  const [ollama, setOllama] = useState<{ available: boolean; models: string[] }>({
    available: false,
    models: [],
  });
  const [ollamaModel, setOllamaModelState] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem('amn.ollama.model');
    } catch {
      return null;
    }
  });
  // Kept in a ref so sendMessage stays stable while still seeing live status.
  const ollamaRef = useRef<{ available: boolean; model: string | null; models: string[] }>({
    available: false,
    model: null,
    models: [],
  });
  ollamaRef.current = { available: ollama.available, model: ollamaModel, models: ollama.models };

  const setOllamaModel = useCallback((m: string) => {
    setOllamaModelState(m);
    try {
      window.localStorage.setItem('amn.ollama.model', m);
    } catch {
      /* ignore */
    }
  }, []);

  const refreshOllama = useCallback(() => {
    bridge()
      .ollama.status()
      .then((s) => {
        setOllama(s);
        // Keep the saved model if still installed, else default to the first.
        setOllamaModelState((cur) => {
          const next = cur && s.models.includes(cur) ? cur : s.models[0] ?? null;
          try {
            if (next) window.localStorage.setItem('amn.ollama.model', next);
          } catch {
            /* ignore */
          }
          return next;
        });
      })
      .catch(() => setOllama({ available: false, models: [] }));
  }, []);

  useEffect(() => {
    refreshOllama();
  }, [refreshOllama]);

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

      // Route free-text questions through the local model (Ollama) when it's
      // available. Falls back to the first installed model if none is explicitly
      // selected — a common reason the model path silently never fired before.
      const { available, model, models } = ollamaRef.current;
      const chosenModel = model ?? models[0] ?? null;
      const generate: Generate | undefined =
        available && chosenModel
          ? (system, userPrompt) =>
              bridge().ollama.chat({ model: chosenModel, system, prompt: userPrompt }).then((r) => r.text)
          : undefined;

      const appendAnswer = (turn: ChatMessage['turn']) => {
        const withAnswer: ChatMessage[] = [
          ...messagesRef.current,
          { id: uid('a'), role: 'assistant', turn, createdAt: new Date().toISOString() },
        ];
        setMessagesSynced(withAnswer);
        persist(withAnswer);
      };

      // If the reply lands while the user isn't looking at the panel, nudge them
      // (2.5) — an in-app toast plus, when the window is unfocused, an OS notif.
      const notifyReady = (preview: string) => {
        const away = !isOpenRef.current || !windowFocusedRef.current;
        if (!away) return;
        toast({
          tone: 'assistant',
          title: 'Ajmani a répondu',
          body: preview.slice(0, 120),
          onClick: () => setIsOpen(true),
        });
        if (!windowFocusedRef.current) {
          bridge().system.notify({ title: 'Ajmani a répondu', body: preview.slice(0, 120) });
        }
      };

      loadFreshEvents(sites, loadEvents, eventsBySite)
        .then((freshEvents) => runAssistant(trimmed, sites, freshEvents, { generate }))
        .then((turn) => {
          appendAnswer(turn);
          notifyReady(previewOfTurn(turn));
        })
        .catch((err) => {
          // Ollama was configured but the call failed — be honest rather than
          // silently returning a canned message that looks like a bug.
          const detail = err instanceof Error ? err.message : 'erreur inconnue';
          appendAnswer({
            kind: 'answer',
            blocks: [
              {
                type: 'paragraph',
                text: `Je n'ai pas pu générer de réponse via Ollama (${detail}). Vérifiez qu'Ollama tourne et qu'un modèle est bien sélectionné (Paramètres → Ajmani — modèle local).`,
              },
            ],
          });
          notifyReady('La réponse a échoué — Ollama est-il lancé ?');
        })
        .finally(() => setIsThinking(false));
    },
    [sites, eventsBySite, loadEvents, setMessagesSynced, persist, toast],
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
      ollamaAvailable: ollama.available,
      ollamaModels: ollama.models,
      ollamaModel,
      setOllamaModel,
      refreshOllama,
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
      ollama.available,
      ollama.models,
      ollamaModel,
      setOllamaModel,
      refreshOllama,
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
