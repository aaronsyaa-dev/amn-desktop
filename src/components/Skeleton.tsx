import React from 'react';

/** A single shimmering placeholder block. Sizes via className. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

/**
 * A stack of skeleton "rows" inside a bordered panel — the generic
 * loading state for list/board screens, consistent with the mono identity.
 */
export function SkeletonList({
  rows = 4,
  className = '',
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className}`} aria-label="Chargement…" role="status">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 flex-shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/3 rounded-sm" />
              <Skeleton className="h-3 w-2/3 rounded-sm" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton for a 3-column board (Tâches). */
export function SkeletonBoard() {
  return (
    <div className="grid h-full grid-cols-1 gap-4 md:grid-cols-3" aria-label="Chargement…" role="status">
      {[0, 1, 2].map((col) => (
        <div key={col} className="flex flex-col border border-border bg-surface">
          <div className="border-b border-border px-4 py-3">
            <Skeleton className="h-3 w-20 rounded-sm" />
          </div>
          <div className="flex-1 space-y-2 p-3">
            {Array.from({ length: 3 - col }).map((_, i) => (
              <div key={i} className="border border-border bg-bg p-3">
                <Skeleton className="mb-2 h-3 w-3/4 rounded-sm" />
                <Skeleton className="h-3 w-1/2 rounded-sm" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
