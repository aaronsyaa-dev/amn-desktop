import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUp,
  Download,
  Newspaper,
  Sparkles,
  Sunrise,
  X,
} from 'lucide-react';
import { mockSites } from '../data/mockSites';
import { ALERT_SEVERITY_CONFIG } from '../lib/alerts';
import { useAssistant } from './AssistantContext';
import { getDailySummary, getSuggestions, getWatchItems } from './engine';
import { ReportBlocks } from './ReportBlocks';
import { PrintPortal } from './PrintPortal';
import type { AssistantReport, ChatMessage } from './types';

const PANEL_SPRING = { type: 'spring' as const, stiffness: 340, damping: 34 };

type Tab = 'chat' | 'summary' | 'watch';

const TABS: Array<{ key: Tab; label: string; icon: typeof Sparkles }> = [
  { key: 'chat', label: 'Assistant', icon: Sparkles },
  { key: 'summary', label: 'Résumé du jour', icon: Sunrise },
  { key: 'watch', label: 'Veille', icon: Newspaper },
];

export function AssistantPanel() {
  const { isOpen, close } = useAssistant();
  const [tab, setTab] = useState<Tab>('chat');
  const [exportTarget, setExportTarget] = useState<AssistantReport | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[60]">
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={close}
              className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            />
            <motion.aside
              key="panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={PANEL_SPRING}
              className="absolute right-0 top-0 flex h-full w-full max-w-[660px] flex-col border-l border-border bg-bg shadow-[-24px_0_60px_rgba(0,0,0,0.5)]"
            >
              <Header onClose={close} />
              <TabBar tab={tab} onChange={setTab} />
              <div className="flex-1 overflow-hidden">
                {tab === 'chat' && <ChatTab onExport={setExportTarget} />}
                {tab === 'summary' && <SummaryTab />}
                {tab === 'watch' && <WatchTab />}
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {exportTarget && (
        <PrintPortal
          report={exportTarget}
          onDone={() => setExportTarget(null)}
        />
      )}
    </>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-muted text-accent">
          <Sparkles size={18} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Assistant IA</h2>
          <p className="text-xs text-text-secondary">
            Rapports, résumés et veille — propulsé par vos données
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer l'assistant"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary"
      >
        <X size={18} strokeWidth={2} />
      </button>
    </div>
  );
}

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex gap-1 border-b border-border px-4">
      {TABS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`relative flex items-center gap-2 px-3 py-3 text-sm font-medium transition-colors duration-200 ${
            tab === key
              ? 'text-text-primary'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Icon size={15} strokeWidth={1.75} />
          {label}
          {tab === key && (
            <motion.span
              layoutId="assistant-tab-underline"
              className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent"
            />
          )}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------- Chat tab ----------------------------- */

function ChatTab({ onExport }: { onExport: (r: AssistantReport) => void }) {
  const { messages, isThinking, sendMessage } = useAssistant();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isThinking]);

  const submit = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5">
        {messages.length === 0 ? (
          <WelcomeState onPrompt={sendMessage} />
        ) : (
          <div className="flex flex-col gap-5">
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} onExport={onExport} />
            ))}
            {isThinking && <ThinkingIndicator />}
          </div>
        )}
      </div>

      <div className="border-t border-border p-4">
        <div className="input-focus flex items-end gap-2 rounded-xl border border-border bg-surface px-3 py-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Posez une question ou « génère un rapport sur… »"
            className="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!input.trim()}
            aria-label="Envoyer"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent text-white transition-colors duration-200 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowUp size={16} strokeWidth={2.25} />
          </button>
        </div>
      </div>
    </div>
  );
}

function WelcomeState({ onPrompt }: { onPrompt: (text: string) => void }) {
  const suggestions = useMemo(() => getSuggestions(), []);
  const criticalSite = useMemo(
    () => mockSites.find((s) => s.status !== 'online') ?? mockSites[0],
    [],
  );

  const chips = [
    'Génère un rapport global',
    `Rapport sur ${criticalSite.name}`,
    'Quels sites sont hors ligne ?',
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-muted text-accent">
          <Sparkles size={22} strokeWidth={1.75} />
        </span>
        <h3 className="mt-4 text-lg font-semibold text-text-primary">
          Comment puis-je vous aider ?
        </h3>
        <p className="mt-1 text-sm text-text-secondary">
          Je génère des rapports (interne ou client), réponds à vos questions et
          surveille votre parc en continu.
        </p>
      </div>

      {suggestions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Suggestions proactives
          </p>
          <div className="flex flex-col gap-2">
            {suggestions.map((s) => {
              const sev = ALERT_SEVERITY_CONFIG[s.severity];
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() =>
                    onPrompt(
                      s.siteId
                        ? `Génère un rapport sur ${mockSites.find((m) => m.id === s.siteId)?.name}`
                        : s.title,
                    )
                  }
                  className="card-interactive flex items-start gap-3 rounded-xl p-3 text-left"
                >
                  <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${sev.dot}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text-primary">{s.title}</p>
                    <p className="text-xs text-text-secondary">{s.detail}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onPrompt(chip)}
            className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-text-secondary transition-colors duration-200 hover:border-white/15 hover:text-text-primary"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onExport,
}: {
  message: ChatMessage;
  onExport: (r: AssistantReport) => void;
}) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm text-white">
          {message.text}
        </div>
      </div>
    );
  }

  const turn = message.turn;
  if (!turn) return null;

  if (turn.kind === 'answer') {
    return (
      <div className="max-w-[92%] rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3.5">
        <ReportBlocks blocks={turn.blocks} />
      </div>
    );
  }

  return (
    <ReportView
      messageId={message.id}
      report={turn.report}
      onExport={onExport}
    />
  );
}

function ReportView({
  messageId,
  report,
  onExport,
}: {
  messageId: string;
  report: AssistantReport;
  onExport: (r: AssistantReport) => void;
}) {
  const { switchReportMode } = useAssistant();

  return (
    <div className="rounded-2xl rounded-bl-md border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-text-primary">{report.title}</h3>
          <p className="text-xs text-text-secondary">{report.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => onExport(report)}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface-hover px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-200 hover:text-text-primary"
        >
          <Download size={13} strokeWidth={1.75} />
          Exporter PDF
        </button>
      </div>

      <div className="my-4 flex w-fit rounded-lg border border-border bg-bg p-0.5">
        <ModeButton
          active={report.mode === 'internal'}
          onClick={() => switchReportMode(messageId, 'internal')}
        >
          Rapport interne
        </ModeButton>
        <ModeButton
          active={report.mode === 'client'}
          onClick={() => switchReportMode(messageId, 'client')}
        >
          Rapport client
        </ModeButton>
      </div>

      <ReportBlocks blocks={report.blocks} />
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${
        active
          ? 'bg-accent-muted text-text-primary'
          : 'text-text-secondary hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3.5">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-text-muted"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

/* --------------------------- Summary tab --------------------------- */

function SummaryTab() {
  const summary = useMemo(() => getDailySummary(), []);
  const time = new Date(summary.generatedAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="mb-4 flex items-center gap-2 text-xs text-text-muted">
        <Sunrise size={14} strokeWidth={1.75} />
        Généré automatiquement à {time}
      </div>
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h3 className="text-base font-semibold text-text-primary">
          {summary.headline}
        </h3>
        <div className="mt-4">
          <ReportBlocks blocks={summary.blocks} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Watch tab ---------------------------- */

const WATCH_CATEGORY_STYLE: Record<string, string> = {
  Cybersécurité: 'bg-accent-muted text-accent',
  Vulnérabilité: 'bg-danger-muted text-danger',
  IA: 'bg-success-muted text-success',
  Anthropic: 'bg-warning-muted text-warning',
};

function WatchTab() {
  const items = useMemo(() => getWatchItems(), []);

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <p className="mb-4 text-sm text-text-secondary">
        Actualités cybersécurité, IA et Anthropic sélectionnées pour vous.
      </p>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="card-interactive rounded-2xl p-4"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  WATCH_CATEGORY_STYLE[item.category] ?? 'bg-white/5 text-text-secondary'
                }`}
              >
                {item.category}
              </span>
              <time className="text-xs text-text-muted">
                {new Date(item.date).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                })}
              </time>
            </div>
            <h3 className="text-sm font-semibold text-text-primary">{item.title}</h3>
            <p className="mt-1 text-sm text-text-secondary">{item.summary}</p>
            <p className="mt-2 text-xs text-text-muted">{item.source}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
