import React from 'react';
import type { DerivedStatus } from '../lib/siteStatus';

const STATUS_CONFIG: Record<
  DerivedStatus,
  { label: string; text: string; dot: string }
> = {
  online: {
    label: 'EN LIGNE',
    text: 'text-success',
    dot: 'bg-success',
  },
  degraded: {
    label: 'DÉGRADÉ',
    text: 'text-warning',
    dot: 'border border-warning bg-transparent',
  },
  offline: {
    label: 'HORS LIGNE',
    text: 'text-danger',
    dot: 'bg-danger',
  },
  unknown: {
    label: 'INCONNU',
    text: 'text-text-muted',
    dot: 'border border-text-muted bg-transparent',
  },
};

/**
 * Monochrome status language. Online reads as a solid bright dot, degraded as a
 * hollow ring, and only genuinely-down sites get the single reserved red.
 * Squared (not pill) with a mono uppercase label — control-room register.
 */
export function StatusBadge({
  status,
  compact = false,
}: {
  status: DerivedStatus;
  /** Dot-only rendering for tight spaces (chips, inline lists). */
  compact?: boolean;
}) {
  const config = STATUS_CONFIG[status];
  const critical = status === 'offline';

  if (compact) {
    return (
      <span
        role="img"
        aria-label={config.label}
        title={config.label}
        className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${config.dot} ${
          status === 'offline' ? 'animate-pulse' : ''
        }`}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider ${config.text} ${
        critical ? 'border-danger/40 bg-danger-muted' : 'border-border bg-white/[0.03]'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${config.dot} ${
          status === 'offline' ? 'animate-pulse' : ''
        }`}
      />
      {config.label}
    </span>
  );
}
