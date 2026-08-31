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
    /*
      LE POINT PORTE LE SIGNAL, LE MOT REDEVIENT DE L'ENCRE (docs/ROUGE.md,
      F3). Douze sites en panne faisaient vingt-quatre éléments rouges — le
      rouge cessait d'être un signal pour devenir l'ambiance de la liste. Le
      point rouge suffit à balayer une colonne d'un regard.
    */
    text: 'text-text-secondary',
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

  if (compact) {
    return (
      <span
        role="img"
        aria-label={config.label}
        title={config.label}
        // Plus de pulsation sur la panne : le battement veut dire « flux
        // vivant », un point de panne qui respire est un mensonge de
        // vocabulaire (docs/ROUGE.md, F3).
        className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${config.dot}`}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 border border-border bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] font-medium tracking-wider ${config.text}`}
    >
      {/* Le badge complet suit la même règle que le compact : le point porte
          le signal, le cadre et le mot restent neutres (docs/ROUGE.md, F3). */}
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
