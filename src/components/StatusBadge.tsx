import React from 'react';
import type { SiteStatus } from '../types/site';

const STATUS_CONFIG: Record<
  SiteStatus,
  { label: string; text: string; dot: string; hollow: boolean }
> = {
  online: {
    label: 'EN LIGNE',
    text: 'text-success',
    dot: 'bg-success',
    hollow: false,
  },
  degraded: {
    label: 'DÉGRADÉ',
    text: 'text-warning',
    dot: 'border border-warning bg-transparent',
    hollow: true,
  },
  offline: {
    label: 'HORS LIGNE',
    text: 'text-danger',
    dot: 'bg-danger',
    hollow: false,
  },
};

/**
 * Monochrome status language. Online reads as a solid bright dot, degraded as a
 * hollow ring, and only genuinely-down sites get the single reserved red.
 * Squared (not pill) with a mono uppercase label — control-room register.
 */
export function StatusBadge({ status }: { status: SiteStatus }) {
  const config = STATUS_CONFIG[status];
  const critical = status === 'offline';

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
