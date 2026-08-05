import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUp,
  Building2,
  Check,
  CheckCheck,
  CheckSquare,
  CornerUpLeft,
  Film,
  Globe,
  Image as ImageIcon,
  Link2,
  MessageSquarePlus,
  Mic,
  Pin,
  PinOff,
  Plus,
  Search,
  SmilePlus,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useRemoteSites, type DerivedSite } from '../state/RemoteSitesContext';
import { useSync, useCollection } from '../state/SyncContext';
import { useProfiles } from '../state/ProfilesContext';
import { useMessages, type SyncMessage } from '../state/useMessages';
import { UserAvatar } from '../components/UserAvatar';
import { parseMentions, urlDisplayHost, type ClientRef, type TaskRef } from '../lib/mentions';
import { resizeImageToDataUrl } from '../lib/imageResize';
import { relativeTime } from '../lib/time';
import { bridge } from '../lib/bridge';
import { useSitePanel } from '../components/site-panel/SitePanelContext';
import { useMessageTemplates } from '../state/useMessageTemplates';
import { LightboxProvider, type LightboxImage } from '../components/team/MediaLightbox';
import { MessageMedia } from '../components/team/MessageMedia';
import { VoiceRecorder } from '../components/team/VoiceRecorder';
import {
  AJMANI_EMAIL,
  AJMANI_NAME,
  generateAjmaniReply,
  mentionsAjmani,
  stripAjmaniMention,
} from '../lib/ajmaniChat';
import type { MessageAttachment } from '../shared/api';
import { REACTION_EMOJIS } from '../shared/api';

/** Max raw size for a chat video, before the ~33% base64 inflation, kept under
 * amn-api's 12 MB JSON body limit. Short clips only — see Bloc 3 for a heavier
 * media-storage strategy. */
const MAX_VIDEO_BYTES = 6 * 1024 * 1024;
const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

/** Reads a file into a data-URL as-is (no resize) — used for short videos. */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

/**
 * Clients available for @-mentions, provided by TeamScreen so the deeply-nested
 * message/composer components can read them without prop-drilling through every
 * layer. Empty until the client list loads (or in the browser fallback).
 */
const MentionClientsContext = React.createContext<ClientRef[]>([]);
const useMentionClients = () => React.useContext(MentionClientsContext);

type MentionSuggestion =
  | { kind: 'site'; name: string }
  | { kind: 'client'; name: string; company: string }
  | { kind: 'ajmani'; name: string }
  | { kind: 'task'; name: string };

/** Live task titles for #mentions in the chat (A5.3). */
function useMentionTasks(): TaskRef[] {
  const rows = useCollection<{ title?: string }>('tasks');
  return React.useMemo(
    () => rows.map((r) => ({ id: r.id, title: r.title ?? '' })).filter((t) => t.title),
    [rows],
  );
}

const TEAM = [
  { email: 'aaron@amn-devsec.com' },
  { email: 'mohamed@amn-devsec.com' },
];

export function TeamScreen() {
  const { user } = useAuth();
  const { sites, eventsBySite, ensureEventsLoaded } = useRemoteSites();
  const { messages, send, sendAjmani, react, togglePin } = useMessages();
  const [replyTo, setReplyTo] = useState<SyncMessage | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientRef[]>([]);
  const [ajmaniThinking, setAjmaniThinking] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  // Warm the parc event cache so an @Ajmani question is grounded in real data.
  useEffect(() => {
    for (const site of sites) ensureEventsLoaded(site.id);
  }, [sites, ensureEventsLoaded]);

  // Ordered gallery of every image in the thread — powers the lightbox's ←/→.
  const gallery = useMemo<LightboxImage[]>(() => {
    const items: LightboxImage[] = [];
    for (const m of messages) {
      m.attachments.forEach((att, i) => {
        if ((att.kind ?? 'image') === 'image') {
          items.push({ key: `${m.id}:${i}`, src: att.dataUrl, name: att.name });
        }
      });
    }
    return items;
  }, [messages]);

  // Load the client roster once so "@" can mention clients as well as sites.
  useEffect(() => {
    let active = true;
    bridge()
      .clients.list()
      .then((list) => {
        if (active) setClients(list.map((c) => ({ id: c.id, name: c.name, company: c.company })));
      })
      .catch(() => {
        /* offline / no clients yet — @site mentions still work */
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSend = (body: string, attachments: MessageAttachment[]) => {
    const replyId = replyTo?.id ?? null;
    send(body, attachments, replyId);
    setReplyTo(null);

    // @Ajmani: only THIS client (the sender) generates + posts the reply, so
    // two connected operators never double-answer. The reply is a normal synced
    // message, so both of them see it live.
    if (body && mentionsAjmani(body)) {
      const question = stripAjmaniMention(body);
      if (question) {
        setAjmaniThinking(true);
        generateAjmaniReply(question, sites, eventsBySite)
          .then((reply) => sendAjmani(reply, replyId))
          .catch(() => sendAjmani("Je n'ai pas pu répondre à cette demande.", replyId))
          .finally(() => setAjmaniThinking(false));
      }
    }
  };

  const jumpToMessage = (id: string) => {
    setSearchOpen(false);
    rowRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(id);
    window.setTimeout(() => setHighlightId((current) => (current === id ? null : current)), 1600);
  };

  const pinned = useMemo(() => messages.filter((m) => m.pinned), [messages]);
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  return (
    <MentionClientsContext.Provider value={clients}>
    <LightboxProvider gallery={gallery}>
    <section className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Équipe</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Messagerie et présence de l’équipe AMN DevSec.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          aria-label="Rechercher dans les messages"
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border transition-colors ${
            searchOpen
              ? 'border-border-strong bg-accent-muted text-text-primary'
              : 'border-border text-text-secondary hover:text-text-primary'
          }`}
        >
          <Search size={16} strokeWidth={1.75} />
        </button>
      </div>

      <PresenceBar currentEmail={user?.email} />

      <AnimatePresence>
        {searchOpen && (
          <MessageSearch messages={messages} onJump={jumpToMessage} onClose={() => setSearchOpen(false)} />
        )}
      </AnimatePresence>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-surface">
        {pinned.length > 0 && (
          <PinnedBar pinned={pinned} onJump={jumpToMessage} onUnpin={togglePin} />
        )}
        <MessageList
          messages={messages}
          currentEmail={user?.email}
          sites={sites}
          byId={byId}
          highlightId={highlightId}
          rowRefs={rowRefs}
          ajmaniThinking={ajmaniThinking}
          onReply={setReplyTo}
          onReact={react}
          onTogglePin={togglePin}
          onJump={jumpToMessage}
        />
        <Composer onSend={handleSend} sites={sites} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
      </div>
    </section>
    </LightboxProvider>
    </MentionClientsContext.Provider>
  );
}

function PresenceBar({ currentEmail }: { currentEmail?: string }) {
  const { onlineEmails, configured } = useSync();
  const { profileFor } = useProfiles();

  return (
    <div className="flex flex-wrap gap-3">
      {TEAM.map((member) => {
        const isSelf = member.email === currentEmail;
        const profile = profileFor(member.email);
        // Real presence (via the amn-api WebSocket) when configured; you are
        // always shown online since you're the one looking at the screen.
        const online = isSelf || onlineEmails.has(member.email);
        // When amn-api isn't configured we can't know the other operator's
        // real presence, so we say so rather than claiming "hors ligne".
        const statusLine = isSelf
          ? profile.presenceText || 'En ligne'
          : !configured
            ? 'Présence indisponible'
            : online
              ? profile.presenceText || 'En ligne'
              : 'Hors ligne';
        return (
          <div
            key={member.email}
            className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2"
          >
            <span className="relative">
              <UserAvatar email={member.email} size={32} />
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${
                  online ? 'bg-success' : 'bg-text-muted'
                }`}
              />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-medium text-text-primary">
                {profile.name}
                {isSelf && <span className="text-text-muted"> (vous)</span>}
              </p>
              <p className="text-xs text-text-secondary">
                {statusLine}
                {!isSelf && !configured && <span className="text-text-muted"> · hors-ligne</span>}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------- Search ------------------------------- */

function MessageSearch({
  messages,
  onJump,
  onClose,
}: {
  messages: SyncMessage[];
  onJump: (id: string) => void;
  onClose: () => void;
}) {
  const { profileFor } = useProfiles();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return messages.filter((m) => m.body.toLowerCase().includes(q)).slice(-20).reverse();
  }, [query, messages]);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="overflow-hidden rounded-xl border border-border bg-surface"
    >
      <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
        <Search size={15} strokeWidth={1.75} className="flex-shrink-0 text-text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un mot-clé dans les messages…"
          className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
        />
        <button type="button" onClick={onClose} aria-label="Fermer la recherche" className="text-text-muted hover:text-text-primary">
          <X size={15} strokeWidth={1.75} />
        </button>
      </div>
      {query.trim() && (
        <div className="max-h-56 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-4 py-4 text-sm text-text-secondary">Aucun message ne contient « {query} ».</p>
          ) : (
            results.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onJump(m.id)}
                className="flex w-full flex-col gap-0.5 border-b border-border/60 px-4 py-2.5 text-left last:border-b-0 hover:bg-surface-hover"
              >
                <span className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="font-medium text-text-secondary">{profileFor(m.authorEmail).name}</span>
                  {relativeTime(m.createdAt)}
                </span>
                <span className="truncate text-sm text-text-primary">{m.body}</span>
              </button>
            ))
          )}
        </div>
      )}
    </motion.div>
  );
}

/* -------------------------------- Pinned -------------------------------- */

function PinnedBar({
  pinned,
  onJump,
  onUnpin,
}: {
  pinned: SyncMessage[];
  onJump: (id: string) => void;
  onUnpin: (message: SyncMessage) => void;
}) {
  const { profileFor } = useProfiles();
  return (
    <div className="flex items-center gap-2 overflow-x-auto border-b border-border bg-bg/60 px-3 py-2">
      <Pin size={13} strokeWidth={2} className="flex-shrink-0 text-text-muted" />
      {pinned.map((m) => (
        <div
          key={m.id}
          className="group flex flex-shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface py-1 pl-2.5 pr-1 text-xs"
        >
          <button type="button" onClick={() => onJump(m.id)} className="max-w-[220px] truncate text-text-secondary hover:text-text-primary">
            <span className="font-medium text-text-primary">{profileFor(m.authorEmail).name}</span> · {m.body || '(pièce jointe)'}
          </button>
          <button
            type="button"
            onClick={() => onUnpin(m)}
            aria-label="Désépingler"
            className="rounded p-0.5 text-text-muted opacity-0 transition-opacity hover:text-text-primary group-hover:opacity-100"
          >
            <PinOff size={12} strokeWidth={2} />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Message list ----------------------------- */

function MessageList({
  messages,
  currentEmail,
  sites,
  byId,
  highlightId,
  rowRefs,
  ajmaniThinking,
  onReply,
  onReact,
  onTogglePin,
  onJump,
}: {
  messages: SyncMessage[];
  currentEmail?: string;
  sites: DerivedSite[];
  byId: Map<string, SyncMessage>;
  highlightId: string | null;
  rowRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  ajmaniThinking: boolean;
  onReply: (message: SyncMessage) => void;
  onReact: (message: SyncMessage, emoji: string) => void;
  onTogglePin: (message: SyncMessage) => void;
  onJump: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasAtBottom = useRef(true);
  const { profiles, markTeamSeen, teamSeenAt } = useProfiles();

  // A3.1 — opening/viewing the team chat marks it read for this operator, so
  // the other one sees a "seen" receipt. Fire on mount and on each new message.
  // markTeamSeen is read from a ref so writing the receipt (which mutates the
  // synced profiles) can't feed back into this effect and loop.
  const markSeenRef = useRef(markTeamSeen);
  markSeenRef.current = markTeamSeen;
  useEffect(() => {
    if (currentEmail) markSeenRef.current(currentEmail);
  }, [currentEmail, messages.length]);

  // Latest moment any OTHER operator opened the chat — a message is "seen" when
  // it predates that. (Two-operator team, but written to generalise.)
  const otherSeenAt = useMemo(() => {
    let latest: string | null = null;
    for (const p of profiles) {
      if (p.email === currentEmail || p.email === AJMANI_EMAIL) continue;
      const t = teamSeenAt(p.email);
      if (t && (!latest || t > latest)) latest = t;
    }
    return latest;
  }, [profiles, currentEmail, teamSeenAt]);

  useEffect(() => {
    if (wasAtBottom.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
        <p className="text-sm font-medium text-text-primary">Aucun message pour l’instant</p>
        <p className="text-sm text-text-secondary">
          Démarrez la conversation. Astuce : tapez « @ » pour mentionner un site ou un client.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      onScroll={(e) => {
        const el = e.currentTarget;
        wasAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
      }}
      className="flex-1 space-y-3 overflow-y-auto p-5"
    >
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          own={message.authorEmail === currentEmail}
          isAjmani={message.authorEmail === AJMANI_EMAIL}
          seen={Boolean(otherSeenAt && otherSeenAt >= message.createdAt)}
          sites={sites}
          repliedTo={message.replyToId ? byId.get(message.replyToId) ?? null : null}
          highlighted={highlightId === message.id}
          registerRef={(el) => {
            if (el) rowRefs.current.set(message.id, el);
            else rowRefs.current.delete(message.id);
          }}
          onReply={() => onReply(message)}
          onReact={(emoji) => onReact(message, emoji)}
          onTogglePin={() => onTogglePin(message)}
          onJumpToReply={() => message.replyToId && onJump(message.replyToId)}
        />
      ))}
      {ajmaniThinking && <AjmaniThinkingBubble />}
    </div>
  );
}

function AjmaniThinkingBubble() {
  return (
    <div className="flex gap-2.5">
      <AjmaniAvatar />
      <div className="flex flex-col items-start">
        <span className="mb-1 flex items-center gap-1 px-1 text-xs font-medium text-accent">
          {AJMANI_NAME}
        </span>
        <div className="flex items-center gap-1.5 rounded-r-lg rounded-tl-lg border border-accent/30 bg-accent-muted px-4 py-3">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-accent"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Distinct avatar for Ajmani's messages (accent Sparkles, not a user photo). */
function AjmaniAvatar() {
  return (
    <span className="mt-5 flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-accent-muted text-accent ring-1 ring-accent/40">
      <Sparkles size={15} strokeWidth={1.75} />
    </span>
  );
}

function MessageBubble({
  message,
  own,
  isAjmani,
  seen,
  sites,
  repliedTo,
  highlighted,
  registerRef,
  onReply,
  onReact,
  onTogglePin,
  onJumpToReply,
}: {
  message: SyncMessage;
  own: boolean;
  isAjmani: boolean;
  seen: boolean;
  sites: DerivedSite[];
  repliedTo: SyncMessage | null;
  highlighted: boolean;
  registerRef: (el: HTMLDivElement | null) => void;
  onReply: () => void;
  onReact: (emoji: string) => void;
  onTogglePin: () => void;
  onJumpToReply: () => void;
}) {
  const { profileFor } = useProfiles();
  const [pickerOpen, setPickerOpen] = useState(false);

  const groupedReactions = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of message.reactions) {
      const list = map.get(r.emoji) ?? [];
      list.push(r.authorEmail);
      map.set(r.emoji, list);
    }
    return [...map.entries()];
  }, [message.reactions]);

  return (
    <motion.div
      ref={registerRef}
      initial={{ opacity: 0, y: 8 }}
      animate={{
        opacity: 1,
        y: 0,
        backgroundColor: highlighted ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0)',
      }}
      transition={{ duration: 0.25 }}
      className={`group/msg flex gap-2.5 rounded-lg px-1.5 py-1 ${own ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {isAjmani ? <AjmaniAvatar /> : <UserAvatar email={message.authorEmail} size={30} className="mt-5" />}
      <div className={`flex min-w-0 flex-col ${own ? 'items-end' : 'items-start'}`}>
        {!own && (
          <span className={`mb-1 flex items-center gap-1 px-1 text-xs font-medium ${isAjmani ? 'text-accent' : 'text-text-secondary'}`}>
            {isAjmani ? AJMANI_NAME : profileFor(message.authorEmail).name}
          </span>
        )}

        {repliedTo && (
          <button
            type="button"
            onClick={onJumpToReply}
            className={`mb-1 flex max-w-[75%] items-center gap-1.5 rounded-md border border-border bg-bg/60 px-2.5 py-1 text-xs text-text-muted hover:text-text-secondary ${
              own ? 'self-end' : 'self-start'
            }`}
          >
            <CornerUpLeft size={11} strokeWidth={2} className="flex-shrink-0" />
            <span className="truncate">
              <span className="font-medium">{profileFor(repliedTo.authorEmail).name}</span> · {repliedTo.body || '(pièce jointe)'}
            </span>
          </button>
        )}

        <div className="relative flex items-end gap-1.5">
          {own && (
            <BubbleActions onReply={onReply} onTogglePin={onTogglePin} pinned={message.pinned} pickerOpen={pickerOpen} setPickerOpen={setPickerOpen} onReact={onReact} side="left" />
          )}
          <div
            className={`max-w-[75%] px-4 py-2.5 text-sm ${
              own
                ? 'rounded-l-lg rounded-tr-lg bg-accent text-bg'
                : isAjmani
                  ? 'rounded-r-lg rounded-tl-lg border border-accent/30 bg-accent-muted text-text-primary'
                  : 'rounded-r-lg rounded-tl-lg border border-border bg-surface-hover text-text-primary'
            }`}
          >
            {message.attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {message.attachments.map((att, i) => (
                  <MessageMedia key={i} att={att} galleryKey={`${message.id}:${i}`} />
                ))}
              </div>
            )}
            {message.body && <MessageBody body={message.body} light={own} sites={sites} />}
          </div>
          {!own && (
            <BubbleActions onReply={onReply} onTogglePin={onTogglePin} pinned={message.pinned} pickerOpen={pickerOpen} setPickerOpen={setPickerOpen} onReact={onReact} side="right" />
          )}
        </div>

        {groupedReactions.length > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1 px-1 ${own ? 'justify-end' : 'justify-start'}`}>
            {groupedReactions.map(([emoji, authors]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReact(emoji)}
                className="flex items-center gap-1 rounded-full border border-border bg-surface px-1.5 py-0.5 text-xs text-text-secondary hover:border-border-strong"
                title={authors.map((a) => profileFor(a).name).join(', ')}
              >
                <span>{emoji}</span>
                <span className="tnum text-[10px] text-text-muted">{authors.length}</span>
              </button>
            ))}
          </div>
        )}

        <span className="mt-1 flex items-center gap-1 px-1 font-mono text-[10px] text-text-muted">
          {relativeTime(message.createdAt)}
          {/* Read receipt (A3.1): single check = envoyé, double = lu. Own,
              non-Ajmani messages only. */}
          {own && !isAjmani &&
            (seen ? (
              <CheckCheck size={12} strokeWidth={2} className="text-accent" aria-label="Lu" />
            ) : (
              <Check size={12} strokeWidth={2} className="text-text-muted" aria-label="Envoyé" />
            ))}
        </span>
      </div>
    </motion.div>
  );
}

function BubbleActions({
  onReply,
  onTogglePin,
  pinned,
  pickerOpen,
  setPickerOpen,
  onReact,
  side,
}: {
  onReply: () => void;
  onTogglePin: () => void;
  pinned: boolean;
  pickerOpen: boolean;
  setPickerOpen: (v: boolean) => void;
  onReact: (emoji: string) => void;
  side: 'left' | 'right';
}) {
  return (
    <div className="relative flex items-center gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100">
      {pickerOpen && (
        <div
          className={`absolute bottom-full z-10 mb-1 flex items-center gap-0.5 rounded-lg border border-border bg-surface p-1 shadow-lg ${
            side === 'left' ? 'left-0' : 'right-0'
          }`}
        >
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => {
                onReact(emoji);
                setPickerOpen(false);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-sm hover:bg-surface-hover"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setPickerOpen(!pickerOpen)}
        aria-label="Réagir"
        className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-surface-hover hover:text-text-primary"
      >
        <SmilePlus size={13} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={onReply}
        aria-label="Répondre"
        className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-surface-hover hover:text-text-primary"
      >
        <CornerUpLeft size={13} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={onTogglePin}
        aria-label={pinned ? 'Désépingler' : 'Épingler'}
        className={`flex h-6 w-6 items-center justify-center rounded hover:bg-surface-hover ${
          pinned ? 'text-text-primary' : 'text-text-muted hover:text-text-primary'
        }`}
      >
        {pinned ? <PinOff size={13} strokeWidth={1.75} /> : <Pin size={13} strokeWidth={1.75} />}
      </button>
    </div>
  );
}

const STATUS_LABEL: Record<DerivedSite['status'], string> = {
  online: 'En ligne',
  degraded: 'Dégradé',
  offline: 'Hors ligne',
  unknown: 'État inconnu',
};

function MessageBody({
  body,
  light,
  sites,
}: {
  body: string;
  light: boolean;
  sites: DerivedSite[];
}) {
  const clients = useMentionClients();
  const tasks = useMentionTasks();
  const segments = useMemo(() => parseMentions(body, sites, clients, tasks), [body, sites, clients, tasks]);

  return (
    <span className="whitespace-pre-wrap break-words">
      {segments.map((segment, i) => {
        if (segment.type === 'text') {
          return <span key={i}>{segment.value}</span>;
        }
        if (segment.type === 'link') {
          return <LinkChip key={i} url={segment.url} light={light} />;
        }
        if (segment.type === 'clientMention') {
          return <ClientMentionChip key={i} client={segment.client} light={light} />;
        }
        if (segment.type === 'taskMention') {
          return <TaskMentionChip key={i} taskId={segment.taskId} title={segment.title} light={light} />;
        }
        return <SiteMentionChip key={i} site={segment.site} light={light} />;
      })}
    </span>
  );
}

/** Clickable #task chip in chat → opens the task on the Tâches board (A5.3). */
function TaskMentionChip({ taskId, title, light }: { taskId: string; title: string; light: boolean }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigate('/tasks', { state: { openTaskId: taskId } });
      }}
      className={chipClass(light)}
    >
      <CheckSquare size={12} strokeWidth={2} />
      {title}
    </button>
  );
}

const chipClass = (light: boolean) =>
  `mx-0.5 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 align-baseline font-mono text-[12px] font-medium transition-colors ${
    light ? 'bg-black/15 text-bg hover:bg-black/25' : 'bg-white/[0.06] text-text-primary hover:bg-white/10'
  }`;

/** Small hover card anchored above a mention chip (CSS-only reveal). */
function HoverCard({ children }: { children: React.ReactNode }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 hidden w-56 -translate-x-1/2 rounded-lg border border-border bg-surface p-3 text-left shadow-2xl group-hover:block"
    >
      {children}
    </span>
  );
}

function SiteMentionChip({ site, light }: { site: DerivedSite; light: boolean }) {
  const { openSite } = useSitePanel();
  const visitors = site.state?.activeVisitors ?? 0;
  return (
    <span className="group relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openSite(site.id);
        }}
        className={chipClass(light)}
      >
        <Globe size={12} strokeWidth={2} />
        {site.name}
      </button>
      <HoverCard>
        <span className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
          <Globe size={11} strokeWidth={2} /> Site supervisé
        </span>
        <span className="block text-sm font-semibold text-text-primary">{site.name}</span>
        <span className="mt-1.5 flex items-center justify-between text-xs text-text-secondary">
          <span>{STATUS_LABEL[site.status]}</span>
          {site.status !== 'unknown' && <span>{visitors} visiteur{visitors > 1 ? 's' : ''}</span>}
        </span>
      </HoverCard>
    </span>
  );
}

function ClientMentionChip({ client, light }: { client: ClientRef; light: boolean }) {
  const navigate = useNavigate();
  return (
    <span className="group relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          navigate('/clients', { state: { focusClientId: client.id } });
        }}
        className={chipClass(light)}
      >
        <Building2 size={12} strokeWidth={2} />
        {client.name}
      </button>
      <HoverCard>
        <span className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
          <Building2 size={11} strokeWidth={2} /> Client
        </span>
        <span className="block text-sm font-semibold text-text-primary">{client.name}</span>
        {client.company && <span className="mt-0.5 block text-xs text-text-secondary">{client.company}</span>}
        <span className="mt-1.5 block text-xs text-text-muted">Ouvrir la fiche client →</span>
      </HoverCard>
    </span>
  );
}

/** URL rendered as a small clickable chip with a best-effort favicon. */
function LinkChip({ url, light }: { url: string; light: boolean }) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const host = urlDisplayHost(url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      onClick={(e) => e.stopPropagation()}
      className={`mx-0.5 inline-flex max-w-[240px] items-center gap-1.5 rounded-sm px-1.5 py-0.5 align-baseline underline decoration-dotted underline-offset-2 transition-colors ${
        light ? 'text-bg hover:bg-black/10' : 'text-text-primary hover:bg-white/[0.06]'
      }`}
    >
      {faviconFailed ? (
        <Link2 size={12} strokeWidth={2} className="flex-shrink-0 opacity-70" />
      ) : (
        <img
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`}
          alt=""
          className="h-3.5 w-3.5 flex-shrink-0 rounded-sm"
          onError={() => setFaviconFailed(true)}
        />
      )}
      <span className="truncate">{host}</span>
    </a>
  );
}

/* -------------------------------- Composer ------------------------------- */

function Composer({
  onSend,
  sites,
  replyTo,
  onCancelReply,
}: {
  onSend: (body: string, attachments: MessageAttachment[]) => void;
  sites: DerivedSite[];
  replyTo: SyncMessage | null;
  onCancelReply: () => void;
}) {
  const { profileFor } = useProfiles();
  const clients = useMentionClients();
  const tasks = useMentionTasks();
  const { templates, addTemplate, removeTemplate } = useMessageTemplates();
  const [text, setText] = useState('');
  const [newTemplate, setNewTemplate] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<MessageAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Active trigger: the last '@' (Ajmani/site/client) or '#' (task) still being
  // typed. Whichever is nearer the caret-end wins.
  const mentionQuery = useMemo(() => {
    const atIdx = text.lastIndexOf('@');
    const hashIdx = text.lastIndexOf('#');
    const idx = Math.max(atIdx, hashIdx);
    if (idx < 0) return null;
    const char = idx === hashIdx ? '#' : '@';
    const query = text.slice(idx + 1);
    if (/\s{2,}$/.test(query) || query.includes('@') || query.includes('#')) return null;
    if (/\s$/.test(query)) return null;
    return { idx, char, query: query.toLowerCase() };
  }, [text]);

  const suggestions = useMemo<MentionSuggestion[]>(() => {
    if (!mentionQuery) return [];
    const q = mentionQuery.query;
    if (mentionQuery.char === '#') {
      return tasks
        .filter((t) => t.title.toLowerCase().includes(q))
        .slice(0, 6)
        .map((t) => ({ kind: 'task', name: t.title }));
    }
    const ajmaniHit: MentionSuggestion[] =
      AJMANI_NAME.toLowerCase().startsWith(q) || q === '' ? [{ kind: 'ajmani', name: AJMANI_NAME }] : [];
    const siteHits: MentionSuggestion[] = sites
      .filter((s) => s.name.toLowerCase().includes(q))
      .map((s) => ({ kind: 'site', name: s.name }));
    const clientHits: MentionSuggestion[] = clients
      .filter((c) => c.name.toLowerCase().includes(q))
      .map((c) => ({ kind: 'client', name: c.name, company: c.company }));
    return [...ajmaniHit, ...siteHits, ...clientHits].slice(0, 6);
  }, [mentionQuery, sites, clients, tasks]);

  const applyMention = (name: string) => {
    if (!mentionQuery) return;
    setText(text.slice(0, mentionQuery.idx) + `${mentionQuery.char}${name} `);
    inputRef.current?.focus();
  };

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const results: MessageAttachment[] = [];
    let rejected: string | null = null;

    for (const f of list) {
      const isVideo = VIDEO_TYPES.includes(f.type) || /\.(mp4|mov|webm)$/i.test(f.name);
      if (f.type.startsWith('image/')) {
        results.push({ dataUrl: await resizeImageToDataUrl(f), name: f.name, kind: 'image' });
      } else if (isVideo) {
        if (f.size > MAX_VIDEO_BYTES) {
          rejected = `La vidéo « ${f.name} » dépasse 6 Mo. Utilise un clip plus court.`;
          continue;
        }
        results.push({
          dataUrl: await fileToDataUrl(f),
          name: f.name,
          kind: 'video',
          mime: f.type || 'video/mp4',
        });
      }
      // Other file types are ignored (only images/videos in chat).
    }

    setUploadError(rejected);
    if (results.length) setPendingAttachments((prev) => [...prev, ...results]);
  };

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed && pendingAttachments.length === 0) return;
    onSend(trimmed, pendingAttachments);
    setText('');
    setPendingAttachments([]);
    setUploadError(null);
  };

  return (
    <div
      className="relative border-t border-border p-4"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
      }}
    >
      {dragOver && (
        <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-border-strong bg-bg/90">
          <p className="font-mono text-xs uppercase tracking-widest text-text-secondary">
            Déposer image ou vidéo ici
          </p>
        </div>
      )}

      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs text-text-secondary">
          <CornerUpLeft size={12} strokeWidth={2} className="flex-shrink-0 text-text-muted" />
          <span className="min-w-0 flex-1 truncate">
            Réponse à <span className="font-medium text-text-primary">{profileFor(replyTo.authorEmail).name}</span> · {replyTo.body || '(pièce jointe)'}
          </span>
          <button type="button" onClick={onCancelReply} aria-label="Annuler la réponse" className="text-text-muted hover:text-text-primary">
            <X size={13} strokeWidth={2} />
          </button>
        </div>
      )}

      {uploadError && (
        <p className="mb-2 rounded-lg border border-danger/40 bg-danger-muted px-3 py-1.5 text-xs text-danger">
          {uploadError}
        </p>
      )}

      {pendingAttachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pendingAttachments.map((att, i) => {
            const kind = att.kind ?? 'image';
            return (
              <div key={i} className="relative">
                {kind === 'image' ? (
                  <img src={att.dataUrl} alt={att.name} className="h-16 w-16 rounded-md border border-border object-cover" />
                ) : (
                  <div className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-md border border-border bg-bg text-text-muted">
                    {kind === 'video' ? <Film size={18} strokeWidth={1.75} /> : <Mic size={18} strokeWidth={1.75} />}
                    <span className="px-1 text-[9px] uppercase tracking-wider">{kind === 'video' ? 'Vidéo' : 'Vocal'}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setPendingAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label="Retirer la pièce jointe"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-text-secondary hover:text-text-primary"
                >
                  <X size={11} strokeWidth={2.25} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="absolute bottom-full left-4 mb-2 w-72 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Mentionner Ajmani, un site, un client ou une tâche
          </p>
          {suggestions.map((item) => (
            <button
              key={`${item.kind}:${item.name}`}
              type="button"
              onClick={() => applyMention(item.name)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              {item.kind === 'site' ? (
                <Globe size={14} strokeWidth={1.75} className="text-text-muted" />
              ) : item.kind === 'client' ? (
                <Building2 size={14} strokeWidth={1.75} className="text-text-muted" />
              ) : item.kind === 'task' ? (
                <CheckSquare size={14} strokeWidth={1.75} className="text-text-muted" />
              ) : (
                <Sparkles size={14} strokeWidth={1.75} className="text-accent" />
              )}
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted">
                {item.kind === 'site'
                  ? 'Site'
                  : item.kind === 'client'
                    ? 'Client'
                    : item.kind === 'task'
                      ? 'Tâche'
                      : 'IA'}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="input-focus flex items-end gap-2 rounded-xl border border-border bg-bg px-3 py-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/mp4,video/quicktime,video/webm"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Joindre une image ou une vidéo"
          title="Image ou vidéo"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <ImageIcon size={16} strokeWidth={1.75} />
        </button>
        <VoiceRecorder onRecorded={(att) => setPendingAttachments((prev) => [...prev, att])} />
        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setTemplatesOpen((v) => !v)}
            aria-label="Messages rapides"
            className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-surface-hover hover:text-text-primary ${
              templatesOpen ? 'text-text-primary' : 'text-text-muted'
            }`}
          >
            <MessageSquarePlus size={16} strokeWidth={1.75} />
          </button>
          {templatesOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setTemplatesOpen(false)} />
              <div className="absolute bottom-full left-0 z-20 mb-2 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
                <p className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  Messages rapides
                </p>
                <div className="max-h-56 overflow-y-auto">
                  {templates.length === 0 && (
                    <p className="px-3 py-2 text-xs text-text-muted">
                      Aucun modèle. Ajoutez-en un ci-dessous.
                    </p>
                  )}
                  {templates.map((tpl) => (
                    <div
                      key={tpl}
                      className="group flex items-center gap-1 pr-2 transition-colors hover:bg-surface-hover"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setText((prev) => (prev ? `${prev} ${tpl}` : tpl));
                          setTemplatesOpen(false);
                          inputRef.current?.focus();
                        }}
                        className="block flex-1 px-3 py-2 text-left text-sm text-text-secondary transition-colors group-hover:text-text-primary"
                      >
                        {tpl}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeTemplate(tpl)}
                        aria-label="Retirer ce modèle"
                        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                      >
                        <X size={13} strokeWidth={2} />
                      </button>
                    </div>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    addTemplate(newTemplate);
                    setNewTemplate('');
                  }}
                  className="flex items-center gap-1.5 border-t border-border p-2"
                >
                  <input
                    value={newTemplate}
                    onChange={(e) => setNewTemplate(e.target.value)}
                    placeholder="Nouveau modèle…"
                    className="input-focus min-w-0 flex-1 rounded-md border border-border bg-bg px-2.5 py-1.5 text-sm text-text-primary outline-none placeholder:text-text-muted"
                  />
                  <button
                    type="submit"
                    disabled={!newTemplate.trim()}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-accent text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
                    aria-label="Ajouter le modèle"
                  >
                    <Plus size={15} strokeWidth={2.25} />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.length) addFiles(files);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && suggestions.length === 0) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="Écrire un message… (@Ajmani, @ site/client, # tâche)"
          className="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-sm text-text-primary outline-none placeholder:text-text-muted"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() && pendingAttachments.length === 0}
          aria-label="Envoyer"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-accent text-bg transition-colors duration-200 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowUp size={16} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}
