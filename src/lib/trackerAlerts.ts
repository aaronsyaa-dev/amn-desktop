import type { AlertKind, RemoteEvent, RemoteSeverity, TrackerTier } from '../shared/api';

/**
 * Presentation vocabulary for tracker alerts. Kept out of the screens so the
 * control desk, the generated report and any future view name a threat the
 * same way — a "force brute" must never be a "brute force" three panels over.
 */

const KIND_LABELS: Record<AlertKind, string> = {
  brute_force: 'Force brute',
  rate_limit: 'Rate limit',
  injection: 'Injection',
  ip_reputation: 'Réputation IP',
  bot: 'Bot',
  traffic_anomaly: 'Anomalie de trafic',
  site_unreachable: 'Site injoignable',
  availability_down: 'Indisponibilité',
  vulnerable_dependency: 'Dépendance vulnérable',
};

/** Human label for an alert's `payload.kind`; falls back to the raw value. */
export function alertKindLabel(kind: unknown): string {
  if (typeof kind !== 'string') return 'Alerte';
  return KIND_LABELS[kind as AlertKind] ?? kind;
}

export const SEVERITY_LABELS: Record<RemoteSeverity, string> = {
  critical: 'Critique',
  warning: 'Avertissement',
  info: 'Information',
};

/** Tailwind classes per severity — red is reserved for genuinely critical. */
export const SEVERITY_STYLES: Record<RemoteSeverity, { chip: string; dot: string; text: string }> = {
  critical: { chip: 'border-danger/40 bg-danger/10 text-danger', dot: 'bg-danger', text: 'text-danger' },
  warning: { chip: 'border-warning/40 bg-warning-muted text-warning', dot: 'bg-warning', text: 'text-warning' },
  info: { chip: 'border-border bg-surface text-text-secondary', dot: 'bg-text-muted', text: 'text-text-secondary' },
};

export function severityOf(event: RemoteEvent): RemoteSeverity {
  return event.severity ?? 'info';
}

/** The attacking IP an alert names, when it named one. */
export function alertIp(event: RemoteEvent): string | null {
  const ip = event.payload?.ip;
  return typeof ip === 'string' && ip && ip !== '?' ? ip : null;
}

export const TIER_LABELS: Record<TrackerTier, string> = {
  sentinel: 'AMN Sentinel',
  'sentinel-plus': 'AMN Sentinel+',
  suite: 'AMN Suite',
};

/** Score colour band, matching the tone amn-api computed. */
export const SCORE_TONE_STYLES: Record<'good' | 'watch' | 'risk', { text: string; ring: string }> = {
  good: { text: 'text-success', ring: 'stroke-success' },
  watch: { text: 'text-warning', ring: 'stroke-warning' },
  risk: { text: 'text-danger', ring: 'stroke-danger' },
};
