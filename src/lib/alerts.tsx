import React from 'react';
import {
  AlertTriangle,
  Bug,
  CreditCard,
  KeyRound,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import type { AlertSeverity, AlertType } from '../types/site';

export const ALERT_TYPE_CONFIG: Record<
  AlertType,
  { label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }
> = {
  'brute-force': { label: 'Force brute', icon: KeyRound },
  injection: { label: 'Injection', icon: Bug },
  'payment-failed': { label: 'Paiement', icon: CreditCard },
  'traffic-spike': { label: 'Trafic', icon: TrendingUp },
  malware: { label: 'Malware', icon: ShieldAlert },
  certificate: { label: 'Certificat', icon: AlertTriangle },
};

export const ALERT_SEVERITY_CONFIG: Record<
  AlertSeverity,
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
