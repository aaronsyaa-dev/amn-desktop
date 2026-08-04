import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

/** Quick-reply templates shipped by default; used until the user customises. */
export const DEFAULT_TEMPLATES = [
  'Je m’en occupe 👍',
  'C’est réglé de mon côté ✅',
  'Peux-tu jeter un œil quand tu as un moment ?',
  'Point rapide en fin de journée ?',
  'RAS, tout est nominal.',
];

const keyFor = (email: string) => `amn.templates.${email}`;

function load(email: string): string[] {
  try {
    const raw = window.localStorage.getItem(keyFor(email));
    if (!raw) return DEFAULT_TEMPLATES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((t) => typeof t === 'string')) return parsed;
  } catch {
    /* ignore corrupt value */
  }
  return DEFAULT_TEMPLATES;
}

function persist(email: string, templates: string[]): void {
  try {
    window.localStorage.setItem(keyFor(email), JSON.stringify(templates));
  } catch {
    /* storage unavailable — templates simply won't persist */
  }
}

/**
 * Per-user, editable quick-reply templates. Persisted in localStorage keyed by
 * the signed-in user's email (an existing persistence mechanism that works in
 * both Electron and the browser fallback). Personal, so it stays local rather
 * than syncing to the shared team workspace.
 */
export function useMessageTemplates() {
  const { user } = useAuth();
  const email = user?.email ?? 'anon';
  const [templates, setTemplates] = useState<string[]>(() => load(email));

  // Re-load when the account changes (e.g. after login).
  useEffect(() => {
    setTemplates(load(email));
  }, [email]);

  const addTemplate = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setTemplates((prev) => {
        if (prev.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return prev;
        const next = [...prev, trimmed];
        persist(email, next);
        return next;
      });
    },
    [email],
  );

  const removeTemplate = useCallback(
    (text: string) => {
      setTemplates((prev) => {
        const next = prev.filter((t) => t !== text);
        persist(email, next);
        return next;
      });
    },
    [email],
  );

  const resetDefaults = useCallback(() => {
    setTemplates(DEFAULT_TEMPLATES);
    persist(email, DEFAULT_TEMPLATES);
  }, [email]);

  return { templates, addTemplate, removeTemplate, resetDefaults };
}
