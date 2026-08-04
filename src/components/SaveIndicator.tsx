import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';

/**
 * Tiny "Enregistrement… / Enregistré" indicator for autosaving free-text
 * fields (client notes, knowledge docs), so the user is always reassured
 * nothing is lost.
 */
export function SaveIndicator({ saved }: { saved: boolean }) {
  return (
    <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider">
      <AnimatePresence mode="wait" initial={false}>
        {saved ? (
          <motion.span
            key="saved"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1 text-success"
          >
            <Check size={11} strokeWidth={2.5} />
            Enregistré
          </motion.span>
        ) : (
          <motion.span
            key="saving"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-1 text-text-muted"
          >
            <Loader2 size={11} className="animate-spin" />
            Enregistrement…
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
