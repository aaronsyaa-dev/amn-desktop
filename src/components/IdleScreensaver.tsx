import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MurDeControle } from './MurDeControle';

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
  /*
    Le voile de veille EST la Salle de contrôle : même mur, même vérité —
    voir MurDeControle pour tout ce qu'il dit et s'interdit de dire. Ici il
    n'ajoute que deux choses : l'entrée en fondu, et le réveil au geste.
  */
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[200]"
      onMouseDown={onWake}
    >
      <MurDeControle enVeille />
    </motion.div>
  );
}
