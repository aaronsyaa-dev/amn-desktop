import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Sparkles, RefreshCw, X } from 'lucide-react';

/**
 * Lightweight, in-app toast notifications — discreet, bottom-right, auto-
 * dismissing, consistent with the mono/B&W identity. Distinct from the native
 * OS notifications (bridge().system.notify): these are for gentle, in-context
 * signals while the user is actively in the app (e.g. "Ajmani a répondu",
 * "changement reçu de l'équipe"). Callers may pair a toast with an OS
 * notification when the window is unfocused.
 */

export type ToastTone = 'default' | 'assistant' | 'sync';

export interface ToastInput {
  title: string;
  body?: string;
  tone?: ToastTone;
  /** Auto-dismiss delay in ms (default 6000). */
  durationMs?: number;
  /** Optional click handler (e.g. open the assistant, navigate). */
  onClick?: () => void;
}

interface Toast extends ToastInput {
  id: string;
}

interface ToastValue {
  notify: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastValue | undefined>(undefined);

const TONE_ICON: Record<ToastTone, typeof Bell> = {
  default: Bell,
  assistant: Sparkles,
  sync: RefreshCw,
};

const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const notify = useCallback(
    (input: ToastInput) => {
      const id = `toast-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), { ...input, id }]);
      const timer = setTimeout(() => dismiss(id), input.durationMs ?? 6000);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[190] flex flex-col items-end gap-2">
        <AnimatePresence>
          {toasts.map((t) => {
            const Icon = TONE_ICON[t.tone ?? 'default'];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 24, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.98 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                onClick={() => {
                  t.onClick?.();
                  dismiss(t.id);
                }}
                className={`pointer-events-auto flex w-80 max-w-[calc(100vw-3rem)] items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3 elev-2 ${
                  t.onClick ? 'cursor-pointer hover:border-border-strong' : ''
                }`}
              >
                <span
                  className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${
                    t.tone === 'assistant' ? 'bg-accent-muted text-accent' : 'bg-white/5 text-text-secondary'
                  }`}
                >
                  <Icon size={15} strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">{t.title}</p>
                  {t.body && <p className="mt-0.5 line-clamp-3 text-xs text-text-secondary">{t.body}</p>}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    dismiss(t.id);
                  }}
                  aria-label="Fermer la notification"
                  className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-text-muted transition-colors hover:text-text-primary"
                >
                  <X size={13} strokeWidth={2} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
