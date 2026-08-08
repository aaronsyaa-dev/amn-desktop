import type { ScanSeverity, ScanTier } from '../shared/api';

/**
 * Shared presentation rules for scan severities and tiers, so the results
 * table, the counters and the history rows all read the same way.
 *
 * Colour discipline follows the app's identity: the palette stays monochrome
 * except for risk, where red is reserved for `critical` alone — that keeps a
 * genuine critical finding visually unmistakable in a list of forty rows.
 */

export const SEVERITY_ORDER: ScanSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

export const SEVERITY_LABEL: Record<ScanSeverity, string> = {
  critical: 'Critique',
  high: 'Élevée',
  medium: 'Moyenne',
  low: 'Faible',
  info: 'Info',
};

/** Tailwind classes for a severity chip (background + text + border). */
export const SEVERITY_CHIP: Record<ScanSeverity, string> = {
  critical: 'bg-danger text-white border-danger',
  high: 'bg-warning/20 text-warning border-warning/40',
  medium: 'bg-warning/10 text-warning/90 border-warning/25',
  low: 'bg-success/10 text-success border-success/30',
  info: 'bg-surface text-text-muted border-border',
};

/** Text-only colour, for counters and score. */
export const SEVERITY_TEXT: Record<ScanSeverity, string> = {
  critical: 'text-danger',
  high: 'text-warning',
  medium: 'text-warning/80',
  low: 'text-success',
  info: 'text-text-muted',
};

export const TIER_LABEL: Record<ScanTier, string> = {
  lite: 'Lite',
  pro: 'Pro',
  elite: 'Elite',
};

/** What each tier actually runs — shown under the tier picker. */
export const TIER_BLURB: Record<ScanTier, string> = {
  lite: 'HTTPS/TLS, en-têtes de sécurité, cookies, versions exposées',
  pro: 'Tout Lite + CMS, CVE connues, injection, XSS réfléchi, ports ouverts',
  elite: 'Tout Pro + rapport PDF, score OWASP, comparaison avant/après',
};

/** Green ≥ 80, amber ≥ 50, red below — same thresholds as the PDF report. */
export function scoreColor(score: number | null): string {
  if (score == null) return 'text-text-muted';
  if (score >= 80) return 'text-success';
  if (score >= 50) return 'text-warning';
  return 'text-danger';
}
