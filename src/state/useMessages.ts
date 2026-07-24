import { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useSync, useCollection, uid, stripMeta } from './SyncContext';
import type { MessageAttachment, MessageReaction } from '../shared/api';

export interface MessageData {
  authorEmail: string;
  body: string;
  createdAt: string;
  attachments: MessageAttachment[];
  replyToId: string | null;
  reactions: MessageReaction[];
  pinned: boolean;
}

export type SyncMessage = MessageData & { id: string; updatedAt: string };

/**
 * Team chat messages, synced live between operators via the `messages`
 * collection. Centralises send/react/pin so both TeamScreen and the home
 * activity feed read one consistent source.
 */
export function useMessages() {
  const { user } = useAuth();
  const { upsert } = useSync();
  const raw = useCollection<MessageData>('messages');

  const messages = useMemo<SyncMessage[]>(
    () =>
      [...raw]
        .map((m) => ({
          ...m,
          attachments: m.attachments ?? [],
          reactions: m.reactions ?? [],
          replyToId: m.replyToId ?? null,
          pinned: Boolean(m.pinned),
        }))
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')),
    [raw],
  );

  const send = (body: string, attachments: MessageAttachment[], replyToId: string | null) => {
    if (!user) return;
    upsert('messages', uid('msg'), {
      authorEmail: user.email,
      body,
      createdAt: new Date().toISOString(),
      attachments,
      replyToId,
      reactions: [],
      pinned: false,
    } satisfies MessageData);
  };

  const react = (message: SyncMessage, emoji: string) => {
    if (!user) return;
    const exists = message.reactions.some((r) => r.emoji === emoji && r.authorEmail === user.email);
    const reactions: MessageReaction[] = exists
      ? message.reactions.filter((r) => !(r.emoji === emoji && r.authorEmail === user.email))
      : [...message.reactions, { emoji, authorEmail: user.email }];
    upsert('messages', message.id, { ...stripMeta(message), reactions });
  };

  const togglePin = (message: SyncMessage) => {
    upsert('messages', message.id, { ...stripMeta(message), pinned: !message.pinned });
  };

  return { messages, send, react, togglePin };
}
