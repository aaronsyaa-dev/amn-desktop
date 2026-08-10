import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOrgContext } from '../../state/OrgContextContext';
import { OrgAvatar } from './OrgAvatar';
import { LogoMark } from '../Logo';

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Le voile de bascule de contexte.
 *
 * Changer d'organisation change TOUT ce que l'app affiche — la navigation, les
 * données, le bandeau. Laisser les écrans se remplir dans le désordre pendant
 * que la nouvelle synchro arrive donnerait l'impression d'un rechargement raté,
 * et laisserait entrevoir un écran d'AMN DevSec sous le nom d'une cliente.
 *
 * Le voile occupe exactement cet intervalle : il balaie l'écran depuis le rail,
 * annonce où l'on arrive, et ne se lève qu'une fois la bascule réellement
 * faite (voir `MIN_TRANSITION_MS` dans OrgContextContext). C'est de la
 * chorégraphie, mais c'est aussi la garantie visuelle qu'aucune donnée ne se
 * croise à l'écran.
 */
export function ContextVeil() {
  const { transition } = useOrgContext();

  return (
    <AnimatePresence>
      {transition && (
        <motion.div
          key="context-veil"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-none fixed inset-0 z-[260] flex items-center justify-center bg-bg"
          aria-hidden
        >
          {/* Le balayage part du rail, à gauche : le mouvement raconte d'où
              vient le changement, plutôt que de tomber du ciel. */}
          <motion.span
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ scaleX: 0, originX: 1 }}
            transition={{ duration: 0.42, ease: EASE }}
            style={{ originX: 0 }}
            className="absolute inset-0 bg-surface"
          />
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: EASE, delay: 0.08 }}
            className="relative flex flex-col items-center gap-4"
          >
            {transition.kind === 'leave' ? (
              <LogoMark size={44} />
            ) : (
              <OrgAvatar name={transition.name} logoDataUrl={transition.logoDataUrl} size={56} />
            )}
            <div className="text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-text-muted">
                {transition.kind === 'leave' ? 'Retour à' : 'Ouverture de'}
              </p>
              <p className="mt-1.5 text-lg font-semibold tracking-tight text-text-primary">
                {transition.name}
              </p>
            </div>
            {/* Une barre de progression indéterminée, pas un pourcentage : la
                durée dépend d'amn-api, et un faux pourcentage serait un mensonge. */}
            <motion.span
              className="h-px w-24 origin-left bg-border-strong"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.5, ease: 'linear' }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
