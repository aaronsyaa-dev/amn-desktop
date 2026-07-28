import { useEffect, useState } from 'react';

const KEY = 'amn.streak';

interface StreakState {
  last: string; // YYYY-MM-DD of the last active day
  count: number;
  best: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function dayBefore(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * A lightweight "active-day streak": how many consecutive days the operator has
 * opened the app. Gives the home screen a sense of momentum. Persisted locally
 * (per machine) — it's a personal motivator, not shared workspace data.
 */
export function useStreak(): { count: number; best: number } {
  const [state, setState] = useState<{ count: number; best: number }>({ count: 1, best: 1 });

  useEffect(() => {
    let prev: StreakState | null = null;
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) prev = JSON.parse(raw) as StreakState;
    } catch {
      /* ignore */
    }

    const t = today();
    let next: StreakState;
    if (!prev) {
      next = { last: t, count: 1, best: 1 };
    } else if (prev.last === t) {
      next = prev; // already counted today
    } else if (prev.last === dayBefore(t)) {
      const count = prev.count + 1;
      next = { last: t, count, best: Math.max(count, prev.best ?? count) };
    } else {
      next = { last: t, count: 1, best: prev.best ?? 1 }; // streak broken
    }

    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setState({ count: next.count, best: next.best });
  }, []);

  return state;
}
