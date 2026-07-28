import React from 'react';
import { MATURITY_META, type ModuleMaturity } from '../../data/trackerModules';

const TONE_CLASS: Record<'stable' | 'beta' | 'dev', string> = {
  stable: 'border-success/40 text-success bg-success-muted',
  beta: 'border-warning/40 text-warning bg-warning-muted',
  dev: 'border-border-strong text-text-muted bg-white/[0.03]',
};

/** Honest maturity chip so the UI never implies a module is more proven than it is. */
export function MaturityBadge({ maturity }: { maturity: ModuleMaturity }) {
  const meta = MATURITY_META[maturity];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-wider ${TONE_CLASS[meta.tone]}`}
    >
      {meta.label}
    </span>
  );
}
