import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Logo } from './Logo';

// Module-level: the splash plays once per app launch (cold start), not on
// every React remount within the session.
let splashPlayed = false;

export function hasSplashPlayed(): boolean {
  return splashPlayed;
}

const DURATION_MS = 1400;

/**
 * Very brief animated logo curtain shown while the app initializes, before the
 * login screen. Distinct from the daily post-login WelcomeOverlay. Monochrome,
 * on-brand, non-interactive.
 */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    splashPlayed = true;
    const t = setTimeout(() => setVisible(false), DURATION_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence onExitComplete={onDone}>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[300] flex items-center justify-center bg-bg"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center gap-5"
          >
            <Logo height={56} showTagline showAppName />
            <motion.div className="h-px w-28 overflow-hidden bg-white/10">
              <motion.div
                className="h-full bg-text-secondary"
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: DURATION_MS / 1000, ease: 'easeInOut' }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
