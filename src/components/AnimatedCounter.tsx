import React, { useEffect, useRef, useState } from 'react';

/**
 * A number that counts up to its value when it first appears, and re-counts
 * from the previous value whenever it changes.
 *
 * Two deliberate constraints:
 *  - it renders the *final* value immediately for assistive tech (the animated
 *    digits are `aria-hidden`), so a screen reader never reads a sweep of
 *    meaningless intermediate numbers;
 *  - it honours `prefers-reduced-motion` by snapping straight to the value.
 *
 * Written with a rAF loop rather than framer-motion's `animate()` because the
 * home screen mounts several of these at once and a plain loop keeps the whole
 * strip on a single frame budget.
 */
export function AnimatedCounter({
  value,
  durationMs = 900,
  className,
}: {
  value: number;
  /** Total sweep time. Kept short — this is a flourish, not a loading bar. */
  durationMs?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const frameRef = useRef<number | null>(null);
  // First mount counts up from zero; later changes count from where we were,
  // so a value going 4 → 5 nudges by one instead of replaying the whole sweep.
  const mountedRef = useRef(false);

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const from = mountedRef.current ? fromRef.current : 0;
    mountedRef.current = true;

    if (reduced || from === value) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      // easeOutExpo: fast commitment, soft landing.
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setDisplay(Math.round(from + (value - from) * eased));
      if (p < 1) frameRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      // Leaving mid-sweep must not strand the next run on a stale origin.
      fromRef.current = value;
    };
  }, [value, durationMs]);

  return (
    <span className={className}>
      <span aria-hidden>{display}</span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
