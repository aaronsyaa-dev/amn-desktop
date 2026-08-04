import type { RemoteEvent } from '../shared/api';

/**
 * Buckets event timestamps into a fixed number of equal windows, oldest
 * first — used to drive the sparkline/area-chart components with a real
 * signal (event volume) since there is no fabricated uptime-percentage curve
 * to show for real sites.
 */
export function buildActivitySeries(
  events: RemoteEvent[],
  { buckets = 12, windowMs = 24 * 60 * 60 * 1000 }: { buckets?: number; windowMs?: number } = {},
): number[] {
  const now = Date.now();
  const bucketMs = windowMs / buckets;
  const series = new Array(buckets).fill(0);

  for (const event of events) {
    const age = now - new Date(event.occurredAt).getTime();
    if (age < 0 || age > windowMs) continue;
    const bucketIndex = buckets - 1 - Math.floor(age / bucketMs);
    if (bucketIndex >= 0 && bucketIndex < buckets) {
      series[bucketIndex] += 1;
    }
  }

  return series;
}

export function countRecentAlerts(events: RemoteEvent[], windowMs = 24 * 60 * 60 * 1000): number {
  const now = Date.now();
  return events.filter(
    (e) =>
      e.type === 'security_alert' &&
      e.severity &&
      e.severity !== 'info' &&
      now - new Date(e.occurredAt).getTime() <= windowMs,
  ).length;
}
