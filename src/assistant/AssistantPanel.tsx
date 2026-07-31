import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUp,
  Check,
  Copy,
  Download,
  History,
  Loader2,
  MessageSquarePlus,
  Newspaper,
  RefreshCw,
  Search,
  Sparkles,
  Sunrise,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';
import { useRemoteSites } from '../state/RemoteSitesContext';
import { ALERT_SEVERITY_CONFIG } from '../lib/alerts';
import { bridge } from '../lib/bridge';
import { relativeTime } from '../lib/time';
import { useAssistant } from './AssistantContext';
import { getDailySummary, getSuggestions } from './engine';
import { searchableText } from './conversations';
import { ReportBlocks } from './ReportBlocks';
import { PrintPortal } from './PrintPortal';
import type { AssistantReport, ChatMessage } from './types';
import type { WatchFeedResult } from '../shared/api';

const PANEL_SPRING = { type: 'spring' as const, stiffness: 340, damping: 34 };

type Tab = 'chat' | 'summary' | 'watch';

const TABS: Array<{ key: Tab; label: string; icon: typeof Sparkles }> = [
  { key: 'chat', label: 'Ajmani', icon: Sparkles },
  { key: 'summary', label: 'Résumé du jour', icon: Sunrise },
  { key: 'watch', label: 'Veille', icon: Newspaper },
];

export function AssistantPanel() {
  const { isOpen, close, newConversation, openConversation } = useAssistant();
  const { sites, ensureEventsLoaded } = useRemoteSites();
  const [tab, setTab] = useState<Tab>('chat');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<AssistantReport | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  // Warm the event cache as soon as the panel opens so suggestions/summary
  // have real data by the time the user looks at them.
  useEffect(() => {
    if (!isOpen) return;
    for (const site of sites) ensureEventsLoaded(site.id);
  }, [isOpen, sites, ensureEventsLoaded]);

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
              <Header
                onClose={close}
                onNew={() => {
                  newConversation();
                  setHistoryOpen(false);
                  setTab('chat');
                }}
                onHistory={() => setHistoryOpen((v) => !v)}
                historyOpen={historyOpen}
              />
              <TabBar tab={tab} onChange={setTab} />
              <div className="flex-1 overflow-hidden">
                {tab === 'chat' && <ChatTab onExport={setExportTarget} />}
                {tab === 'summary' && <SummaryTab />}
                {tab === 'watch' && <WatchTab />}
              </div>

              <AnimatePresence>
                {historyOpen && (
                  <HistoryDrawer
                    onClose={() => setHistoryOpen(false)}
                    onOpen={(id) => {
                      openConversation(id);
                      setHistoryOpen(false);
                      setTab('chat');
                    }}
                  />
                )}
              </AnimatePresence>
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

function Header({
  onClose,
  onNew,
  onHistory,
  historyOpen,
}: {
  onClose: () => void;
  onNew: () => void;
  onHistory: () => void;
  historyOpen: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-muted text-accent">
          <Sparkles size={18} strokeWidth={1.75} />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Ajmani</h2>
          <p className="text-xs text-text-secondary">
            Assistant IA — questions, rapports, résumés et veille
          </p>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onNew}
          aria-label="Nouvelle conversation"
          title="Nouvelle conversation"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary"
        >
          <MessageSquarePlus size={17} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={onHistory}
          aria-label="Historique des conversations"
          title="Historique"
          className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary ${
            historyOpen ? 'text-text-primary' : 'text-text-secondary'
          }`}
        >
          <History size={17} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer l'assistant"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors duration-200 hover:bg-surface-hover hover:text-text-primary"
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

/* --------------------------- History drawer (A5) --------------------------- */

function HistoryDrawer({ onClose, onOpen }: { onClose: () => void; onOpen: (id: string) => void }) {
  const { conversations, activeId, deleteConversation } = useAssistant();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => searchableText(c).includes(q));
  }, [conversations, query]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
        className="absolute inset-0 z-10 bg-black/40"
      />
      <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        className="absolute left-0 top-0 z-20 flex h-full w-80 max-w-[80%] flex-col border-r border-border bg-surface"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">Conversations</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l'historique"
            className="text-text-muted hover:text-text-primary"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>
        <div className="border-b border-border p-3">
          <div className="input-focus flex items-center gap-2 rounded-lg border border-border bg-bg px-2.5 py-1.5">
            <Search size={14} strokeWidth={1.75} className="text-text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {results.length === 0 ? (
            <p className="p-4 text-sm text-text-muted">
              {conversations.length === 0
                ? 'Aucune conversation enregistrée pour l’instant.'
                : 'Aucun résultat.'}
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {results.map((c) => (
                <div
                  key={c.id}
                  className={`group flex items-start gap-2 px-3 py-2.5 transition-colors hover:bg-surface-hover ${
                    activeId === c.id ? 'bg-accent-muted' : ''
                  }`}
                >
                  <button type="button" onClick={() => onOpen(c.id)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-medium text-text-primary">{c.title}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {relativeTime(c.updatedAt)} · {c.messages.filter((m) => m.role === 'user').length} question
                      {c.messages.filter((m) => m.role === 'user').length > 1 ? 's' : ''}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteConversation(c.id)}
                    aria-label="Supprimer la conversation"
                    className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                  >
                    <Trash2 size={13} strokeWidth={1.75} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </>
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

function ModelPicker() {
  const { ollamaAvailable, ollamaModels, ollamaModel, setOllamaModel } = useAssistant();
  if (!ollamaAvailable || ollamaModels.length === 0) return null;

  return (
    <label className="flex items-center gap-1.5" title="Modèle Ollama utilisé par Ajmani">
      <span className="h-1.5 w-1.5 rounded-full bg-success" />
      <select
        value={ollamaModel ?? ollamaModels[0]}
        onChange={(e) => setOllamaModel(e.target.value)}
        aria-label="Modèle Ollama"
        className="input-focus cursor-pointer rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text-secondary outline-none"
      >
        {ollamaModels.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </label>
  );
}

function ChatTab({ onExport }: { onExport: (r: AssistantReport) => void }) {
  const { messages, isThinking, sendMessage, ollamaAvailable } = useAssistant();
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
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            {ollamaAvailable ? 'IA locale active' : 'Moteur intégré'}
          </span>
          <ModelPicker />
        </div>
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
            placeholder="Posez n’importe quelle question, ou « génère un rapport sur… »"
            className="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-sm text-text-primary outline-none placeholder:text-text-muted"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!input.trim()}
            aria-label="Envoyer"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent text-bg transition-colors duration-200 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowUp size={16} strokeWidth={2.25} />
          </button>
        </div>
      </div>
    </div>
  );
}

function WelcomeState({ onPrompt }: { onPrompt: (text: string) => void }) {
  const { sites, eventsBySite } = useRemoteSites();
  const suggestions = useMemo(
    () => getSuggestions(sites, eventsBySite),
    [sites, eventsBySite],
  );
  const criticalSite = useMemo(
    () => sites.find((s) => s.status !== 'online') ?? sites[0],
    [sites],
  );

  const chips =
    sites.length === 0
      ? ['Explique-moi ce qu’est une injection SQL', 'C’est quand le Ramadan cette année ?']
      : [
          'Génère un rapport global',
          `Rapport sur ${criticalSite?.name}`,
          'Quels sites sont hors ligne ?',
          'Comment faire un nœud de cravate ?',
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
          Je suis Ajmani. Je réponds à vos questions — sur votre parc comme sur
          tout autre sujet — et je génère des rapports interne / client à partir
          de vos vraies données.
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
                        ? `Génère un rapport sur ${sites.find((m) => m.id === s.siteId)?.name}`
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

      {chips.length > 0 && (
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
      )}
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
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-accent px-4 py-2.5 text-sm text-bg">
          {message.text}
        </div>
      </div>
    );
  }

  const turn = message.turn;
  if (!turn) return null;

  if (turn.kind === 'answer') {
    return <AnswerBubble blocks={turn.blocks} />;
  }

  return (
    <ReportView
      messageId={message.id}
      report={turn.report}
      onExport={onExport}
    />
  );
}

/** Flattens answer blocks to plain text for the copy button. */
function blocksToText(blocks: import('./types').ReportBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'heading':
          return `## ${b.text}`;
        case 'paragraph':
          return b.text;
        case 'list':
          return b.items.map((i) => `- ${i}`).join('\n');
        case 'code':
          return `\`\`\`${b.lang ?? ''}\n${b.text}\n\`\`\``;
        case 'kpis':
          return b.items.map((k) => `${k.label}: ${k.value}`).join('\n');
        default:
          return '';
      }
    })
    .filter(Boolean)
    .join('\n\n');
}

function AnswerBubble({ blocks }: { blocks: import('./types').ReportBlock[] }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(blocksToText(blocks));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="group relative max-w-[92%] rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3.5">
      <ReportBlocks blocks={blocks} />
      <button
        type="button"
        onClick={copy}
        aria-label="Copier la réponse"
        title="Copier la réponse"
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border border-border bg-bg text-text-muted opacity-0 transition-opacity hover:text-text-primary group-hover:opacity-100"
      >
        {copied ? <Check size={12} strokeWidth={2.5} /> : <Copy size={12} strokeWidth={1.75} />}
      </button>
    </div>
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
  const { sites, eventsBySite } = useRemoteSites();
  const summary = useMemo(
    () => getDailySummary(sites, eventsBySite),
    [sites, eventsBySite],
  );
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
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [feed, setFeed] = useState<WatchFeedResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    setState('loading');
    bridge()
      .watch.list()
      .then((result) => {
        if (!activeRef.current) return;
        setFeed(result);
        setState('ready');
      })
      .catch(() => activeRef.current && setState('error'));

    // Stale-while-revalidate: the main process may serve a stale cache instantly
    // and refresh in the background. Pick that fresher result up shortly after,
    // so an open panel doesn't stay "figée" on old entries.
    const t = setTimeout(() => {
      bridge()
        .watch.list()
        .then((result) => {
          const fresher = result.fetchedAt;
          if (!activeRef.current || !fresher) return;
          setFeed((prev) => (!prev?.fetchedAt || fresher > prev.fetchedAt ? result : prev));
        })
        .catch(() => {
          /* keep whatever we already showed */
        });
    }, 4000);

    return () => {
      activeRef.current = false;
      clearTimeout(t);
    };
  }, []);

  const forceRefresh = () => {
    setRefreshing(true);
    bridge()
      .watch.refresh()
      .then((result) => {
        if (activeRef.current) {
          setFeed(result);
          setState('ready');
        }
      })
      .catch(() => activeRef.current && setState('error'))
      .finally(() => activeRef.current && setRefreshing(false));
  };

  const items = feed?.items ?? [];
  const isElectron = bridge().env.isElectron;

  return (
    <div className="h-full overflow-y-auto px-6 py-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-sm text-text-secondary">
          Veille cybersécurité — flux publics CERT-FR (ANSSI) et The Hacker News.
        </p>
        <div className="flex flex-shrink-0 items-center gap-2">
          {feed?.fetchedAt && (
            <time className="whitespace-nowrap text-[11px] text-text-muted" title="Dernière mise à jour">
              {new Date(feed.fetchedAt).toLocaleString('fr-FR', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
          )}
          {isElectron && (
            <button
              type="button"
              onClick={forceRefresh}
              disabled={refreshing}
              aria-label="Rafraîchir la veille"
              title="Rafraîchir maintenant"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
            >
              <RefreshCw size={13} strokeWidth={1.75} className={refreshing ? 'animate-spin' : ''} />
            </button>
          )}
        </div>
      </div>

      {feed?.degraded && items.length > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-white/[0.03] px-3 py-2 text-xs text-text-muted">
          <WifiOff size={13} strokeWidth={1.75} />
          Certaines sources sont momentanément injoignables — contenu partiel.
        </div>
      )}

      {state === 'loading' && (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-text-muted">
          <Loader2 size={20} className="animate-spin" />
          <p className="text-sm">Récupération des dernières actualités…</p>
        </div>
      )}

      {state !== 'loading' && items.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          <WifiOff size={22} strokeWidth={1.5} className="text-text-muted" />
          <p className="text-sm font-medium text-text-primary">Veille indisponible pour l’instant</p>
          <p className="max-w-xs text-sm text-text-secondary">
            {isElectron
              ? 'Impossible de joindre les sources pour le moment. Réessayez une fois la connexion rétablie.'
              : 'La veille en direct est disponible dans l’application de bureau AMN Desktop.'}
          </p>
        </div>
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const card = (
              <>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      WATCH_CATEGORY_STYLE[item.category] ?? 'bg-white/5 text-text-secondary'
                    }`}
                  >
                    {item.category}
                  </span>
                  <time className="text-xs text-text-muted">
                    {new Date(item.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </time>
                </div>
                <h3 className="text-sm font-semibold text-text-primary">{item.title}</h3>
                {item.summary && <p className="mt-1 text-sm text-text-secondary">{item.summary}</p>}
                <p className="mt-2 text-xs text-text-muted">{item.source}</p>
              </>
            );
            return item.link ? (
              <a
                key={item.id}
                href={item.link}
                target="_blank"
                rel="noreferrer noopener"
                className="card-interactive block rounded-2xl p-4"
              >
                {card}
              </a>
            ) : (
              <article key={item.id} className="card-interactive rounded-2xl p-4">
                {card}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
