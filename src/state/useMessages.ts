import { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useSync, useCollection, uid, stripMeta } from './SyncContext';
import { AJMANI_EMAIL } from '../lib/ajmaniIdentity';
import { canDeleteMessage } from '../lib/messageRules';
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
  const { user, role } = useAuth();
  const { upsert, remove } = useSync();
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

  /**
   * Posts a reply authored by Ajmani (the reserved AI identity) into the shared
   * thread. Called ONLY by the sender's client after it generates the answer, so
   * two connected operators never double-post — see TeamScreen.handleSend.
   */
  const sendAjmani = (body: string, replyToId: string | null) => {
    upsert('messages', uid('msg'), {
      authorEmail: AJMANI_EMAIL,
      body,
      createdAt: new Date().toISOString(),
      attachments: [],
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

  /**
   * Retire un message du fil (BLOC 10).
   *
   * La règle vit dans `lib/messageRules` et elle est REJOUÉE ici, pas
   * seulement dans l'écran : cacher le bouton ne suffit pas. Un appel venu
   * d'ailleurs — une prochaine palette de commandes, un raccourci — passerait
   * à côté du JSX, et la suppression est irréversible pour tout le monde,
   * puisqu'elle voyage par la synchronisation.
   *
   * `remove` pose une pierre tombale plutôt qu'un effacement local : sans
   * elle, le poste d'en face rendrait le message à la prochaine passe.
   */
  const canDelete = (message: SyncMessage) => canDeleteMessage(role, user?.email, message);

  const removeMessage = (message: SyncMessage) => {
    if (!canDelete(message)) return;
    void remove('messages', message.id);
  };

  return { messages, send, sendAjmani, react, togglePin, canDelete, removeMessage };
}
