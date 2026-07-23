import React from 'react';
import type { BlockTone, ReportBlock } from './types';

type Variant = 'dark' | 'print';

const TONE_DARK: Record<BlockTone, string> = {
  default: 'text-text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

const TONE_PRINT: Record<BlockTone, string> = {
  default: 'text-neutral-900',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-red-600',
};

/**
 * Renders structured assistant output. The `print` variant swaps to
 * ink-friendly light styling so exported PDFs read well on paper.
 */
export function ReportBlocks({
  blocks,
  variant = 'dark',
}: {
  blocks: ReportBlock[];
  variant?: Variant;
}) {
  const isPrint = variant === 'print';
  const tones = isPrint ? TONE_PRINT : TONE_DARK;

  const body = isPrint ? 'text-neutral-700' : 'text-text-secondary';
  const tileClass = isPrint
    ? 'border-neutral-200 bg-neutral-50'
    : 'border-border bg-surface';
  const tileLabel = isPrint ? 'text-neutral-500' : 'text-text-secondary';

  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'heading':
            return (
              <h3
                key={i}
                className={`text-sm font-semibold uppercase tracking-wider ${isPrint ? 'text-neutral-500' : 'text-text-muted'} ${i === 0 ? '' : 'mt-2'}`}
              >
                {block.text}
              </h3>
            );
          case 'paragraph':
            return (
              <p key={i} className={`text-sm leading-relaxed ${body}`}>
                {block.text}
              </p>
            );
          case 'list':
            return (
              <ul key={i} className="flex flex-col gap-2">
                {block.items.map((item, j) => (
                  <li key={j} className={`flex gap-2.5 text-sm leading-relaxed ${body}`}>
                    <span className={`mt-2 h-1 w-1 flex-shrink-0 rounded-full ${isPrint ? 'bg-neutral-400' : 'bg-accent'}`} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            );
          case 'kpis':
            return (
              <div key={i} className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {block.items.map((kpi, j) => (
                  <div
                    key={j}
                    className={`rounded-xl border p-3 ${tileClass}`}
                  >
                    <p className={`text-lg font-semibold ${tones[kpi.tone ?? 'default']}`}>
                      {kpi.value}
                    </p>
                    <p className={`mt-0.5 text-xs ${tileLabel}`}>{kpi.label}</p>
                  </div>
                ))}
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
