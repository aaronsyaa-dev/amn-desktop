import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * The pulsing circle shown at a marker's spot when a repère is opened (A4).
 * Purely presentational: positioned at viewport coordinates and portalled to
 * <body> so no ancestor transform can trap it. Non-interactive.
 */
export function TagHighlight({ point }: { point: { left: number; top: number } | null }) {
  return createPortal(
    <AnimatePresence>
      {point && (
        <motion.div
          initial={{ opacity: 0, scale: 0.4 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.4 }}
          transition={{ duration: 0.25 }}
          style={{ left: point.left, top: point.top }}
          className="pointer-events-none fixed z-[240] -translate-x-1/2 -translate-y-1/2"
        >
          <span className="relative flex h-10 w-10">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
            <span className="relative inline-flex h-10 w-10 rounded-full border-2 border-accent bg-accent/20" />
          </span>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
