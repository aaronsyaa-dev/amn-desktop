import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MurDeControle } from './MurDeControle';
import { useInactivite } from '../lib/useInactivite';

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

export function IdleScreensaver() {
  const { actif, reveiller } = useInactivite(IDLE_MS);
  return <AnimatePresence>{actif && <Veil onWake={reveiller} />}</AnimatePresence>;
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
