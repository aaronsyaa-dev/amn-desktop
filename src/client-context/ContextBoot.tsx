import React from 'react';
import { motion } from 'framer-motion';
import { LogoMark } from '../components/Logo';

/**
 * L'écran d'attente pendant la reprise d'un contexte client au démarrage.
 *
 * Court — le temps d'un aller-retour vers amn-api pour revalider le jeton de
 * support — mais il ne peut pas être sauté : afficher l'une ou l'autre des deux
 * arborescences avant de savoir laquelle est la bonne, c'est soit faire
 * clignoter notre espace de travail avant de basculer chez la cliente, soit
 * afficher ses écrans à elle remplis de nos données.
 */
export function ContextBoot() {
  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-bg">
      <motion.div
        animate={{ opacity: [0.45, 1, 0.45] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <LogoMark size={38} />
      </motion.div>
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-text-muted">
        Reprise du contexte…
      </p>
    </div>
  );
}
