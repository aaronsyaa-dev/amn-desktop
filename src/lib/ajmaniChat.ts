import { bridge } from './bridge';
import { assistantSystemPrompt } from '../assistant/engine';
import type { DerivedSite } from '../state/RemoteSitesContext';
import type { RemoteEvent } from '../shared/api';

/**
 * `@Ajmani` in the team chat.
 *
 * A human can summon Ajmani directly in the shared conversation by mentioning
 * `@Ajmani`. Ajmani's reply is posted as a normal (synced) message authored by
 * the reserved identity below, so BOTH operators see it live. Generation is
 * triggered ONLY on the sender's client (the one who typed the mention) — never
 * on the receiver's — so two connected operators never double-generate the same
 * answer. See useMessages.sendWithAjmani.
 */
export const AJMANI_EMAIL = 'ajmani@amn-devsec.com';
export const AJMANI_NAME = 'Ajmani';

/** Detects an `@Ajmani` mention (case-insensitive, word-boundaried). */
export function mentionsAjmani(body: string): boolean {
  return /(^|[^\w])@ajmani\b/i.test(body);
}

/** Strips the `@Ajmani` token so only the actual question reaches the model. */
export function stripAjmaniMention(body: string): string {
  return body.replace(/(^|[^\w])@ajmani\b/gi, '$1').replace(/\s{2,}/g, ' ').trim();
}

type EventsMap = Record<string, RemoteEvent[]>;

/**
 * Generates Ajmani's reply to a chat prompt via the local Ollama model, grounded
 * in the real parc data (like the assistant panel). Returns a clear, honest
 * fallback string when Ollama is unavailable rather than throwing — the message
 * still posts so the other operator isn't left hanging.
 */
export async function generateAjmaniReply(
  prompt: string,
  sites: DerivedSite[],
  eventsBySite: EventsMap,
): Promise<string> {
  let status: { available: boolean; models: string[] };
  try {
    status = await bridge().ollama.status();
  } catch {
    status = { available: false, models: [] };
  }

  if (!status.available || status.models.length === 0) {
    return "Je ne peux pas répondre pour l'instant : l'IA locale (Ollama) n'est pas disponible sur ce poste. Vérifie qu'Ollama est lancé (Paramètres → Ajmani).";
  }

  const stored = (() => {
    try {
      return window.localStorage.getItem('amn.ollama.model');
    } catch {
      return null;
    }
  })();
  const model = stored && status.models.includes(stored) ? stored : status.models[0];

  const system = [
    assistantSystemPrompt(sites, eventsBySite),
    '',
    "Tu réponds ici DANS la messagerie d'équipe partagée entre Aaron et Mohamed. Sois bref et direct (2-4 phrases maximum sauf demande explicite de détail), comme dans une conversation.",
  ].join('\n');

  try {
    const { text } = await bridge().ollama.chat({ model, system, prompt });
    const trimmed = text.trim();
    return trimmed || "Je n'ai pas de réponse à formuler pour cette demande.";
  } catch (err) {
    // The error already says whether it's the server or the model — repeating
    // "is Ollama running?" on a model-not-installed error sends the operator
    // looking in the wrong place.
    const detail = err instanceof Error ? err.message : 'erreur inconnue';
    return `Je n'ai pas pu générer de réponse. ${detail}`;
  }
}
