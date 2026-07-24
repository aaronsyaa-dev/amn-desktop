import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Globe } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { bridge } from '../lib/bridge';
import { useRemoteSites, type DerivedSite } from '../state/RemoteSitesContext';
import { parseMentions } from '../lib/mentions';
import { relativeTime } from '../lib/time';
import { useSitePanel } from '../components/site-panel/SitePanelContext';
import type { Message } from '../shared/api';

interface TeamMember {
  email: string;
  name: string;
}

const TEAM: TeamMember[] = [
  { email: 'aaron@amn-devsec.com', name: 'Aaron' },
  { email: 'mohamed@amn-devsec.com', name: 'Mohamed' },
];

function initials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

export function TeamScreen() {
  const { user } = useAuth();
  const { sites } = useRemoteSites();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    bridge()
      .messages.list()
      .then((list) => {
        if (active) setMessages(list);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const handleSend = async (body: string) => {
    if (!user) return;
    const message = await bridge().messages.send({
      authorEmail: user.email,
      body,
    });
    setMessages((prev) => [...prev, message]);
  };

  return (
    <section className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Équipe</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Messagerie et présence de l’équipe AMN DevSec.
        </p>
      </div>

      <PresenceBar currentEmail={user?.email} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-surface">
        <MessageList
          messages={messages}
          loading={loading}
          currentEmail={user?.email}
          sites={sites}
        />
        <Composer onSend={handleSend} sites={sites} />
      </div>
    </section>
  );
}

function PresenceBar({ currentEmail }: { currentEmail?: string }) {
  return (
    <div className="flex flex-wrap gap-3">
      {TEAM.map((member) => {
        const isSelf = member.email === currentEmail;
        // Real presence for the signed-in user; the other member is mocked
        // online until the central presence service is wired up.
        const online = true;
        return (
          <div
            key={member.email}
            className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2"
          >
            <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-accent-muted text-xs font-semibold text-accent">
              {initials(member.name)}
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${
                  online ? 'bg-success' : 'bg-text-muted'
                }`}
              />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-medium text-text-primary">
                {member.name}
                {isSelf && <span className="text-text-muted"> (vous)</span>}
              </p>
              <p className="text-xs text-text-secondary">
                {online ? 'En ligne' : 'Hors ligne'}
                {!isSelf && <span className="text-text-muted"> · simulé</span>}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MessageList({
  messages,
  loading,
  currentEmail,
  sites,
}: {
  messages: Message[];
  loading: boolean;
  currentEmail?: string;
  sites: DerivedSite[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-text-secondary">
        Chargement des messages…
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
        <p className="text-sm font-medium text-text-primary">
          Aucun message pour l’instant
        </p>
        <p className="text-sm text-text-secondary">
          Démarrez la conversation. Astuce : tapez « @ » pour mentionner un site.
        </p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-5">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          own={message.authorEmail === currentEmail}
          sites={sites}
        />
      ))}
    </div>
  );
}

function MessageBubble({
  message,
  own,
  sites,
}: {
  message: Message;
  own: boolean;
  sites: DerivedSite[];
}) {
  return (
    <div className={`flex flex-col ${own ? 'items-end' : 'items-start'}`}>
      {!own && (
        <span className="mb-1 px-1 text-xs font-medium text-text-secondary">
          {message.authorName}
        </span>
      )}
      <div
        className={`max-w-[75%] px-4 py-2.5 text-sm ${
          own
            ? 'rounded-l-lg rounded-tr-lg bg-accent text-bg'
            : 'rounded-r-lg rounded-tl-lg border border-border bg-surface-hover text-text-primary'
        }`}
      >
        <MessageBody body={message.body} light={own} sites={sites} />
      </div>
      <span className="mt-1 px-1 font-mono text-[10px] text-text-muted">
        {relativeTime(message.createdAt)}
      </span>
    </div>
  );
}

function MessageBody({
  body,
  light,
  sites,
}: {
  body: string;
  light: boolean;
  sites: DerivedSite[];
}) {
  const { openSite } = useSitePanel();
  const segments = useMemo(() => parseMentions(body, sites), [body, sites]);

  return (
    <span className="whitespace-pre-wrap break-words">
      {segments.map((segment, i) => {
        if (segment.type === 'text') {
          return <span key={i}>{segment.value}</span>;
        }
        return (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openSite(segment.site.id);
            }}
            className={`mx-0.5 inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 align-baseline font-mono text-[12px] font-medium transition-colors ${
              light
                ? 'bg-black/15 text-bg hover:bg-black/25'
                : 'bg-white/[0.06] text-text-primary hover:bg-white/10'
            }`}
          >
            <Globe size={12} strokeWidth={2} />
            {segment.site.name}
          </button>
        );
      })}
    </span>
  );
}

function Composer({
  onSend,
  sites,
}: {
  onSend: (body: string) => void;
  sites: DerivedSite[];
}) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const mentionQuery = useMemo(() => {
    const atIdx = text.lastIndexOf('@');
    if (atIdx < 0) return null;
    const query = text.slice(atIdx + 1);
    if (/\s{2,}$/.test(query) || query.includes('@')) return null;
    // Hide once the mention is completed (a full site name followed by space).
    if (/\s$/.test(query)) return null;
    return { atIdx, query: query.toLowerCase() };
  }, [text]);

  const suggestions = useMemo<DerivedSite[]>(() => {
    if (!mentionQuery) return [];
    return sites
      .filter((s) => s.name.toLowerCase().includes(mentionQuery.query))
      .slice(0, 5);
  }, [mentionQuery, sites]);

  const applyMention = (site: DerivedSite) => {
    if (!mentionQuery) return;
    setText(text.slice(0, mentionQuery.atIdx) + `@${site.name} `);
    inputRef.current?.focus();
  };

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  return (
    <div className="relative border-t border-border p-4">
      {suggestions.length > 0 && (
        <div className="absolute bottom-full left-4 mb-2 w-72 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Mentionner un site
          </p>
          {suggestions.map((site) => (
            <button
              key={site.id}
              type="button"
              onClick={() => applyMention(site)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <Globe size={14} strokeWidth={1.75} className="text-text-muted" />
              {site.name}
            </button>
          ))}
        </div>
      )}

      <div className="input-focus flex items-end gap-2 rounded-xl border border-border bg-bg px-3 py-2">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && suggestions.length === 0) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder="Écrire un message… (@ pour mentionner un site)"
          className="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-sm text-text-primary outline-none placeholder:text-text-muted"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim()}
          aria-label="Envoyer"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-accent text-bg transition-colors duration-200 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowUp size={16} strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}
