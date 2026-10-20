import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * LA BULLE — ce qu'Ajmani dit, en une ou deux phrases courtes.
 *
 * `role="status"` : un lecteur d'écran l'annonce poliment, sans couper la
 * parole. Elle ne prend jamais le focus. Une nouvelle réplique remplace
 * l'ancienne par un fondu (et une montée de 6 px en mouvement complet,
 * que le réglage réduit coupe via le MotionConfig de la racine).
 */
export function Bulle({ texte, alerte = false, className = '', children }: { texte: string; alerte?: boolean; className?: string; children?: React.ReactNode }) {
  return (
    <div role="status" aria-live="polite" className={`relative ${className}`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={texte}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className={`relative rounded-2xl border px-4 py-3 text-[17px] font-semibold leading-snug text-socle-texte [text-wrap:pretty] sm:text-[19px] ${
            // Pas d'ambre ici : en alerte, c'est le visage d'Ajmani qui le porte — un seul objet ambre par écran.
            alerte ? 'border-socle-bord-fort bg-socle-eleve' : 'border-socle-bord bg-socle-eleve'
          }`}
        >
          {/* La pointe, vers Ajmani (à gauche sur grand écran, en haut sur téléphone). */}
          <span aria-hidden className="absolute -top-[7px] left-8 h-3 w-3 rotate-45 border-l border-t border-inherit bg-inherit sm:-left-[7px] sm:top-6 sm:border-b sm:border-t-0" />
          <span className="relative">{texte}</span>
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
