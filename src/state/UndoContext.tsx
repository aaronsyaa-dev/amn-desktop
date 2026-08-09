import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, RotateCcw, Trash2 } from 'lucide-react';

/**
 * Undoable deletion. Rather than delete immediately, a screen calls
 * `scheduleDelete` with a stable key and a `commit` callback. The item is
 * considered "pending" (screens hide it via `isPending`) and a toast offers
 * "Annuler" for a few seconds. If the user waits it out, `commit` runs (the
 * real, permanent delete). If they undo, `commit` never runs and the item
 * simply reappears. Nothing is deleted — locally or on the server — until the
 * delay elapses, so undo is always safe.
 */
const DELAY_MS = 5000;

interface Pending {
  key: string;
  label: string;
  commit: () => void;
}

interface UndoValue {
  isPending: (key: string) => boolean;
  scheduleDelete: (opts: { key: string; label: string; commit: () => void }) => void;
  /** Commit the pending deletion immediately, without waiting out the delay. */
  confirmNow: () => void;
}

const UndoContext = createContext<UndoValue | undefined>(undefined);

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep the latest pending in a ref so the timer callback always commits the
  // right item even if state has moved on.
  const pendingRef = useRef<Pending | null>(null);
  pendingRef.current = pending;

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const flush = useCallback(() => {
    clearTimer();
    const p = pendingRef.current;
    if (p) {
      p.commit();
      setPending(null);
    }
  }, []);

  const scheduleDelete = useCallback(
    ({ key, label, commit }: { key: string; label: string; commit: () => void }) => {
      // A new deletion commits any previous still-pending one immediately.
      clearTimer();
      const prev = pendingRef.current;
      if (prev && prev.key !== key) prev.commit();

      const next = { key, label, commit };
      setPending(next);
      pendingRef.current = next;
      timer.current = setTimeout(() => {
        next.commit();
        setPending((cur) => (cur?.key === key ? null : cur));
      }, DELAY_MS);
    },
    [],
  );

  const undo = useCallback(() => {
    clearTimer();
    setPending(null);
  }, []);

  const isPending = useCallback((key: string) => pending?.key === key, [pending]);

  // Commit any pending delete if the provider unmounts, so nothing is lost.
  useEffect(() => () => flush(), [flush]);

  const value = useMemo(
    () => ({ isPending, scheduleDelete, confirmNow: flush }),
    [isPending, scheduleDelete, flush],
  );

  return (
    <UndoContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {pending && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-6 left-1/2 z-[180] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2.5 elev-2"
          >
            <Trash2 size={15} strokeWidth={1.75} className="text-text-muted" />
            <span className="text-sm text-text-secondary">
              <span className="font-medium text-text-primary">{pending.label}</span> supprimé
            </span>
            <button
              type="button"
              onClick={undo}
              className="ml-1 flex items-center gap-1.5 rounded-lg border border-border-strong bg-bg px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover"
            >
              <RotateCcw size={13} strokeWidth={2} />
              Annuler
            </button>
            <button
              type="button"
              onClick={flush}
              title="Supprimer définitivement maintenant"
              className="flex items-center gap-1.5 rounded-lg border border-danger/40 bg-danger-muted px-3 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger/20"
            >
              <Check size={13} strokeWidth={2.25} />
              Supprimer
            </button>
            {/* Draining bar mirrors the time left before permanent deletion. */}
            <motion.span
              key={pending.key}
              aria-hidden
              className="absolute bottom-0 left-0 h-0.5 bg-text-muted"
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: DELAY_MS / 1000, ease: 'linear' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </UndoContext.Provider>
  );
}

export function useUndo(): UndoValue {
  const ctx = useContext(UndoContext);
  if (!ctx) throw new Error('useUndo must be used within an UndoProvider');
  return ctx;
}
