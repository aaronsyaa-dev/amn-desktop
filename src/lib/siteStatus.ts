import type { RemoteSiteState } from '../shared/api';

export type DerivedStatus = 'unknown' | 'online' | 'degraded' | 'offline';

/**
 * amn-api only ever stores status='online' (set on any event) or 'unknown'
 * (before the first one) — it doesn't know about staleness or severity.
 * "offline"/"degraded" are derived client-side from timestamps, the same way
 * a human would read a monitoring dashboard: no heartbeat in a while means
 * the site probably isn't up; a recent critical/warning alert on an
 * otherwise-live site means "up, but something's wrong".
 */
const OFFLINE_AFTER_MS = 90_000; // ~3x the tracker's default 30s heartbeat
const DEGRADED_ALERT_WINDOW_MS = 15 * 60_000;

export function deriveSiteStatus(
  state: RemoteSiteState | null | undefined,
  now: number = Date.now(),
): DerivedStatus {
  if (!state || !state.lastSeenAt) return 'unknown';

  const lastSeen = new Date(state.lastSeenAt).getTime();
  if (now - lastSeen > OFFLINE_AFTER_MS) return 'offline';

  if (state.lastAlertAt) {
    const lastAlert = new Date(state.lastAlertAt).getTime();
    if (now - lastAlert < DEGRADED_ALERT_WINDOW_MS) return 'degraded';
  }

  return 'online';
}
