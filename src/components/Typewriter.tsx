import React, { useEffect, useRef, useState } from 'react';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Reveals text with a subtle typewriter effect. The reveal duration is capped
 * (length-independent) so long text stays quick to read, and it honours
 * prefers-reduced-motion by showing the full text immediately.
 */
export function Typewriter({
  text,
  durationMs = 1200,
  className,
}: {
  text: string;
  durationMs?: number;
  className?: string;
}) {
  const [count, setCount] = useState(() =>
    prefersReducedMotion() ? text.length : 0,
  );
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setCount(text.length);
      return;
    }
    setCount(0);
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      setCount(Math.floor(progress * text.length));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [text, durationMs]);

  const done = count >= text.length;

  return (
    <span className={className}>
      {text.slice(0, count)}
      {!done && (
        <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-accent align-middle" />
      )}
    </span>
  );
}
