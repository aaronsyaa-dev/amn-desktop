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

export interface HealthFactor {
  label: string;
  value: string;
  tone: 'good' | 'medium' | 'bad';
}

export interface HealthBreakdown {
  health: ClientHealth;
  factors: HealthFactor[];
  /** Concrete things that would move the score up, if any. */
  toImprove: string[];
}

/**
 * Transparent breakdown of WHY a client's health is where it is, and what would
 * move it — so the score never feels arbitrary. Same two signals as
 * computeClientHealth, spelled out.
 */
export function computeClientHealthBreakdown(
  client: Client,
  sites: DerivedSite[],
  now: number = Date.now(),
): HealthBreakdown {
  const lastContact = client.events[0]?.date ?? client.updatedAt;
  const days = Math.floor((now - new Date(lastContact).getTime()) / 86_400_000);

  const contactTone: HealthFactor['tone'] =
    days >= CONTACT_ATTENTION_DAYS ? 'bad' : days >= CONTACT_MEDIUM_DAYS ? 'medium' : 'good';
  const contactValue =
    days <= 0 ? "Aujourd'hui" : days === 1 ? 'Hier' : `Il y a ${days} jours`;

  const linked = sites.filter((s) => client.linkedSiteIds.includes(s.id));
  const offlineSites = linked.filter((s) => s.status === 'offline');
  const degradedSites = linked.filter((s) => s.status === 'degraded' || s.status === 'unknown');
  let sitesTone: HealthFactor['tone'] = 'good';
  let sitesValue: string;
  if (linked.length === 0) {
    sitesTone = 'medium';
    sitesValue = 'Aucun site lié';
  } else if (offlineSites.length > 0) {
    sitesTone = 'bad';
    sitesValue = `${offlineSites.length}/${linked.length} hors ligne`;
  } else if (degradedSites.length > 0) {
    sitesTone = 'medium';
    sitesValue = `${degradedSites.length}/${linked.length} à surveiller`;
  } else {
    sitesValue = `${linked.length} opérationnel${linked.length > 1 ? 's' : ''}`;
  }

  const toImprove: string[] = [];
  if (contactTone !== 'good') toImprove.push('Ajoutez un échange sur la fiche pour rafraîchir le suivi.');
  if (linked.length === 0) toImprove.push('Liez au moins un site supervisé à ce client.');
  if (offlineSites.length > 0) toImprove.push(`Traitez le(s) site(s) hors ligne : ${offlineSites.map((s) => s.name).join(', ')}.`);
  else if (degradedSites.length > 0) toImprove.push(`Vérifiez le(s) site(s) dégradé(s) : ${degradedSites.map((s) => s.name).join(', ')}.`);

  return {
    health: computeClientHealth(client, sites, now),
    factors: [
      { label: 'Dernier échange', value: contactValue, tone: contactTone },
      { label: 'Sites supervisés', value: sitesValue, tone: sitesTone },
    ],
    toImprove,
  };
}
