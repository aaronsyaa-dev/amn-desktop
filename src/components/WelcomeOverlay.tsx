import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Logo } from './Logo';
import { useAuth } from '../auth/AuthContext';

const LAST_SHOWN_KEY = 'amn.welcome.lastShown';
const DURATION_MS = 5200;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

/** True the first time the app is opened on a given calendar day. */
export function shouldShowWelcome(): boolean {
  try {
    return window.localStorage.getItem(LAST_SHOWN_KEY) !== todayKey();
  } catch {
    return false;
  }
}

function markWelcomeShown(): void {
  try {
    window.localStorage.setItem(LAST_SHOWN_KEY, todayKey());
  } catch {
    /* ignore */
  }
}

/** Speaks the welcome via the free native Web Speech API (robotic is fine). */
function speakWelcome(name: string): void {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(`Welcome to AMN Desktop. Bonjour ${name}.`);
    utter.rate = 0.98;
    utter.pitch = 1;
    synth.speak(utter);
  } catch {
    /* speech unavailable — the visual welcome still plays */
  }
}

/**
 * Full-screen "Welcome to AMN Desktop" curtain shown once per day on launch,
 * with a spoken greeting and a soft reveal, in the app's monochrome identity.
 * Auto-dismisses after ~5s; click anywhere to skip.
 */
export function WelcomeOverlay({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const name = user?.name ?? 'opérateur';
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = () => {
    if (!visible) return;
    setVisible(false);
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    markWelcomeShown();
    speakWelcome(name);
    timer.current = setTimeout(dismiss, DURATION_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return (
    <AnimatePresence onExitComplete={onDone}>
      {visible && (
        <motion.div
          role="button"
          tabIndex={0}
          onClick={dismiss}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') && dismiss()}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[200] flex cursor-pointer flex-col items-center justify-center bg-bg"
        >
          {/* Slow sweeping highlight for a bit of life */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            initial={{ backgroundPosition: '0% 50%' }}
            animate={{ backgroundPosition: '100% 50%' }}
            transition={{ duration: 5, ease: 'linear' }}
            style={{
              background:
                'radial-gradient(60% 40% at 50% 45%, rgba(255,255,255,0.05), transparent 70%)',
              backgroundSize: '200% 200%',
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex flex-col items-center gap-6"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <Logo height={52} showTagline showAppName />
            </motion.div>

            <div className="flex flex-col items-center gap-2 text-center">
              <motion.h1
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="text-3xl font-bold tracking-tight text-text-primary sm:text-4xl"
              >
                Welcome to AMN Desktop
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.8 }}
                className="font-mono text-sm uppercase tracking-[0.3em] text-text-secondary"
              >
                Bonjour {name}
              </motion.p>
            </div>

            {/* thin progress bar that drains over the display duration */}
            <motion.div className="mt-2 h-px w-40 overflow-hidden bg-white/10">
              <motion.div
                className="h-full bg-text-secondary"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: DURATION_MS / 1000, ease: 'linear' }}
              />
            </motion.div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6, duration: 0.8 }}
            className="absolute bottom-10 font-mono text-[10px] uppercase tracking-widest text-text-muted"
          >
            Cliquez pour passer
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
