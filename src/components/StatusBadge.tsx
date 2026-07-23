import React from 'react';
import type { SiteStatus } from '../types/site';

const STATUS_CONFIG: Record<
  SiteStatus,
  { label: string; dot: string; classes: string }
> = {
  online: {
    label: 'En ligne',
    dot: 'bg-success',
    classes: 'bg-success-muted text-success',
  },
  degraded: {
    label: 'Dégradé',
    dot: 'bg-warning',
    classes: 'bg-warning-muted text-warning',
  },
  offline: {
    label: 'Hors ligne',
    dot: 'bg-danger',
    classes: 'bg-danger-muted text-danger',
  },
};

export function StatusBadge({ status }: { status: SiteStatus }) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.classes}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
