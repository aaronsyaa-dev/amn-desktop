import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { generateReport, runAssistant } from './engine';
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

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages((prev) => [
      ...prev,
      { id: uid('u'), role: 'user', text: trimmed, createdAt: new Date().toISOString() },
    ]);
    setIsThinking(true);

    runAssistant(trimmed)
      .then((turn) => {
        setMessages((prev) => [
          ...prev,
          { id: uid('a'), role: 'assistant', turn, createdAt: new Date().toISOString() },
        ]);
      })
      .finally(() => setIsThinking(false));
  }, []);

  const switchReportMode = useCallback(
    (messageId: string, mode: ReportMode) => {
      const target = messages.find((m) => m.id === messageId);
      if (!target || target.turn?.kind !== 'report') return;
      const request: ReportRequest = { ...target.turn.request, mode };

      generateReport(request).then((report) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, turn: { kind: 'report', request, report } }
              : m,
          ),
        );
      });
    },
    [messages],
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
