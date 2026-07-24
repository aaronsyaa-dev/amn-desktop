import type { RemoteSeverity } from '../shared/api';

export const ALERT_SEVERITY_CONFIG: Record<
  RemoteSeverity,
  { label: string; text: string; bg: string; dot: string; ring: string }
> = {
  critical: {
    label: 'Critique',
    text: 'text-danger',
    bg: 'bg-danger-muted',
    dot: 'bg-danger',
    ring: 'ring-danger/30',
  },
  warning: {
    label: 'Alerte',
    text: 'text-warning',
    bg: 'bg-warning-muted',
    dot: 'bg-warning',
    ring: 'ring-warning/30',
  },
  info: {
    label: 'Info',
    text: 'text-text-secondary',
    bg: 'bg-white/5',
    dot: 'bg-text-muted',
    ring: 'ring-white/10',
  },
};
