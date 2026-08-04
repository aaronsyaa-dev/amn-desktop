import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Trash2, X } from 'lucide-react';

/**
 * Inline two-step delete: first click reveals a confirm/cancel pair rather than
 * firing immediately, so removals are always deliberate — no separate modal.
 */
export function ConfirmDelete({
  onConfirm,
  label = 'Supprimer',
  size = 14,
  className = '',
}: {
  onConfirm: () => void;
  label?: string;
  size?: number;
  className?: string;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className={`flex items-center ${className}`}>
      <AnimatePresence mode="wait" initial={false}>
        {confirming ? (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="flex items-center gap-1"
          >
            <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">Sûr ?</span>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                onConfirm();
              }}
              aria-label="Confirmer la suppression"
              className="flex h-6 w-6 items-center justify-center rounded text-danger hover:bg-danger-muted"
            >
              <Check size={size} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              aria-label="Annuler"
              className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-surface-hover hover:text-text-primary"
            >
              <X size={size} strokeWidth={2.25} />
            </button>
          </motion.div>
        ) : (
          <motion.button
            key="trigger"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={label}
            title={label}
            className="flex h-6 w-6 items-center justify-center rounded text-text-muted transition-colors hover:bg-surface-hover hover:text-danger"
          >
            <Trash2 size={size} strokeWidth={1.75} />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
