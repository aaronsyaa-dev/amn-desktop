import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { useOrgContext } from '../../state/OrgContextContext';

/**
 * Le refus d'une bascule de contexte, dit à voix haute.
 *
 * Le rail montre les organisations suspendues (grisées) plutôt que de les
 * masquer : les faire disparaître donnerait l'impression que la cliente
 * n'existe plus. Mais cliquer sur l'une d'elles doit alors expliquer pourquoi
 * ça n'ouvre rien — amn-api répond « Organisation suspendue — réactivez-la
 * avant d'ouvrir son espace », et c'est ce message-là qui s'affiche, sans
 * reformulation.
 *
 * Rendu hors des deux arborescences, comme le voile : la bascule qui échoue est
 * précisément le moment où aucune des deux n'est montée.
 */
export function ContextError() {
  const { actionError, dismissActionError } = useOrgContext();

  // Disparaît toute seule au bout de quelques secondes : c'est une réponse à un
  // clic, pas un état à gérer.
  useEffect(() => {
    if (!actionError) return undefined;
    const timer = window.setTimeout(dismissActionError, 6000);
    return () => window.clearTimeout(timer);
  }, [actionError, dismissActionError]);

  return (
    <AnimatePresence>
      {actionError && (
        <motion.div
          key="context-error"
          role="alert"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="elev-3 fixed bottom-5 left-1/2 z-[250] flex max-w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 items-start gap-2.5 rounded-xl border border-danger/40 bg-surface px-3.5 py-2.5"
        >
          <AlertTriangle size={14} strokeWidth={2} className="mt-0.5 flex-shrink-0 text-danger" />
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-text-primary">{actionError}</p>
          <button
            type="button"
            onClick={dismissActionError}
            aria-label="Fermer"
            className="flex-shrink-0 rounded p-0.5 text-text-muted transition-colors hover:text-text-primary"
          >
            <X size={13} strokeWidth={2} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
