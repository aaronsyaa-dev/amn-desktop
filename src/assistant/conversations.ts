import type { ChatMessage } from './types';

/**
 * Persistent per-user history of assistant conversations. Kept local
 * (localStorage keyed by the operator's email) because a chat with the AI is a
 * personal working session, not shared team data — different operators
 * shouldn't see each other's drafts and questions.
 */
export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

const keyFor = (email: string) => `amn.assistant.convos.${email}`;
const MAX_CONVERSATIONS = 100;

export function loadConversations(email: string): Conversation[] {
  try {
    const raw = window.localStorage.getItem(keyFor(email));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Conversation[];
  } catch {
    /* ignore corrupt value */
  }
  return [];
}

export function saveConversations(email: string, convos: Conversation[]): void {
  try {
    // Newest first, capped, and never persist empty conversations.
    const kept = convos
      .filter((c) => c.messages.length > 0)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_CONVERSATIONS);
    window.localStorage.setItem(keyFor(email), JSON.stringify(kept));
  } catch {
    /* storage unavailable */
  }
}

/** Derives a short title from the first user message. */
export function titleFor(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === 'user');
  const text = firstUser?.text?.trim();
  if (!text) return 'Nouvelle conversation';
  return text.length > 48 ? `${text.slice(0, 48).trimEnd()}…` : text;
}

/** Plain-text of a conversation for search (user text + report/chat bodies). */
export function searchableText(c: Conversation): string {
  const parts: string[] = [c.title];
  for (const m of c.messages) {
    if (m.text) parts.push(m.text);
    if (m.turn?.kind === 'answer') {
      for (const block of m.turn.blocks) {
        if ('text' in block && block.text) parts.push(block.text);
      }
    }
    if (m.turn?.kind === 'report') parts.push(m.turn.report.title);
  }
  return parts.join(' ').toLowerCase();
}
