import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Logo } from './Logo';
import { useRemoteSites } from '../state/RemoteSitesContext';

/**
 * Cozy idle screensaver (Partie 4). After a few minutes without mouse/keyboard
 * activity, a calm full-screen veil appears so the app can live on a secondary
 * screen without being visually noisy. It is deliberately low-motion (a very
 * slow "breathing" of the time) and consistent with the mono/B&W identity.
 * The first interaction wakes it with a smooth fade back to wherever the user
 * was — it's an overlay, so nothing about the underlying screen changes.
 *
 * Lightweight: while the veil is hidden, only passive activity listeners + a
 * single reset timer run (no clock, no animation). The 30 s clock/phrase
 * intervals exist only while the veil is actually shown.
 */
const IDLE_MS = 4 * 60_000; // 4 minutes — restful, not twitchy.
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'] as const;

const PHRASES = [
  'Tout est sous contrôle. Respire.',
  'Le parc veille pendant que tu fais une pause.',
  'Un café, peut-être ?',
  'Rien d’urgent à l’horizon.',
  'Le calme fait aussi partie du travail.',
  'La supervision continue, tranquillement.',
  'Prends un instant pour toi.',
];

function pickPhrase(): string {
  return PHRASES[Math.floor(Math.random() * PHRASES.length)];
}

export function IdleScreensaver() {
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);
  activeRef.current = active;
  const wake = useCallback(() => setActive(false), []);

  // --- Idle detection (cheap: passive listeners + one debounced timer) ------
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const arm = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setActive(true), IDLE_MS);
    };

    const onActivity = () => {
      if (activeRef.current) setActive(false); // any input wakes the app
      arm();
    };

    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }
    arm();

    return () => {
      if (timer) clearTimeout(timer);
      for (const evt of ACTIVITY_EVENTS) window.removeEventListener(evt, onActivity);
    };
  }, []);

  return <AnimatePresence>{active && <Veil onWake={wake} />}</AnimatePresence>;
}

function Veil({ onWake }: { onWake: () => void }) {
  // Glanceable, calm-by-default: surface a real problem (a site down) so an
  // always-on secondary screen still tells you when something needs attention.
  const { sites } = useRemoteSites();
  const offline = sites.filter((s) => s.status === 'offline').length;

  const [now, setNow] = useState(() => new Date());
  const [phrase, setPhrase] = useState(pickPhrase);

  // Clock + gently rotating phrase — only while the veil is shown.
  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 30_000);
    const rotator = setInterval(() => setPhrase(pickPhrase()), 30_000);
    return () => {
      clearInterval(clock);
      clearInterval(rotator);
    };
  }, []);

  const time = useMemo(
    () => now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    [now],
  );
  const date = useMemo(
    () => now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
    [now],
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-bg"
      // Clicking/tapping the veil also wakes (belt-and-suspenders with the
      // global activity listener, which fires first in practice).
      onMouseDown={onWake}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        className="flex flex-col items-center text-center"
      >
        <div className="mb-10 opacity-40">
          <Logo height={30} />
        </div>

        {/* Very slow breathing on the time — the only motion, intentionally calm. */}
        <motion.p
          animate={{ opacity: [0.72, 1, 0.72] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="font-mono text-7xl font-light tracking-tight text-text-primary tabular-nums sm:text-8xl"
        >
          {time}
        </motion.p>

        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.3em] text-text-muted">{date}</p>

        <h2 className="mt-12 text-2xl font-semibold tracking-tight text-text-secondary">
          Une petite pause ?
        </h2>

        <AnimatePresence mode="wait">
          <motion.p
            key={phrase}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
            className="mt-3 max-w-sm text-sm text-text-muted"
          >
            {phrase}
          </motion.p>
        </AnimatePresence>

        {offline > 0 && (
          <div className="mt-8 flex items-center gap-2 rounded-full border border-danger/40 bg-danger-muted px-3 py-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
            <span className="font-mono text-[11px] uppercase tracking-widest text-danger">
              {offline} site{offline > 1 ? 's' : ''} hors ligne
            </span>
          </div>
        )}

        <p className="mt-16 font-mono text-[10px] uppercase tracking-[0.25em] text-text-muted/60">
          Bougez la souris pour reprendre
        </p>
      </motion.div>
    </motion.div>
  );
}
