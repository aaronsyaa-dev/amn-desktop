import type { Client } from '../shared/api';
import type { DerivedSite } from '../state/RemoteSitesContext';

export type ClientHealth = 'good' | 'medium' | 'attention';

const CONTACT_ATTENTION_DAYS = 60;
const CONTACT_MEDIUM_DAYS = 21;

/**
 * Client "health" is a simple traffic-light combining two signals we already
 * have — no new external data source:
 *  - how long since the last recorded contact (most recent client_event, or
 *    the fiche's updatedAt if there's none yet)
 *  - the technical status of the client's linked sites (if any)
 *
 * Rule (documented here since it's a judgment call, not a spec):
 *  - "attention" if any linked site is offline, or contact is stale (60+ days)
 *  - "medium" if any linked site is degraded/unknown, or contact is aging (21-59 days)
 *  - "good" otherwise
 */
export function computeClientHealth(
  client: Client,
  sites: DerivedSite[],
  now: number = Date.now(),
): ClientHealth {
  const lastContact = client.events[0]?.date ?? client.updatedAt;
  const daysSinceContact = (now - new Date(lastContact).getTime()) / 86_400_000;

  const linked = sites.filter((s) => client.linkedSiteIds.includes(s.id));
  const anyOffline = linked.some((s) => s.status === 'offline');
  const anyDegradedOrUnknown = linked.some((s) => s.status === 'degraded' || s.status === 'unknown');

  if (anyOffline || daysSinceContact >= CONTACT_ATTENTION_DAYS) return 'attention';
  if (anyDegradedOrUnknown || daysSinceContact >= CONTACT_MEDIUM_DAYS) return 'medium';
  return 'good';
}

export const CLIENT_HEALTH_META: Record<
  ClientHealth,
  { label: string; dot: string; text: string; hint: string }
> = {
  good: {
    label: 'Bon',
    dot: 'bg-success',
    text: 'text-text-primary',
    hint: 'Contact récent et sites liés opérationnels.',
  },
  medium: {
    label: 'Moyen',
    dot: 'bg-warning',
    text: 'text-text-secondary',
    hint: 'Contact qui date un peu, ou un site lié dégradé — à relancer bientôt.',
  },
  attention: {
    label: 'À surveiller',
    dot: 'bg-danger',
    text: 'text-danger',
    hint: 'Contact ancien (60 j+) ou un site lié hors ligne — action recommandée.',
  },
};

/** One-line, plain-language explanation of what the score combines. */
export const CLIENT_HEALTH_EXPLAINER =
  'Santé = ancienneté du dernier échange + état des sites supervisés de ce client.';
