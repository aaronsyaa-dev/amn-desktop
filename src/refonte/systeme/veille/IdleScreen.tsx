import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { COTES_MOUVEMENT, COURBE_MOUVEMENT } from '../../../socle/couche-mouvement';

/**
 * LE CALQUE DE L'ÉCRAN DE VEILLE (G09, `IdleScreen`) — plein écran, noir absolu, AU-DESSUS DE TOUT.
 *
 *   · Au-dessus de tout : rendu par un portail directement dans <body>, hors de l'arbre de l'application, à un
 *     z-index que rien d'autre n'approche (`veille.css`) — panneaux, palettes, calques de la pile
 *     (`src/lib/pileCalques.ts`, z 50 à 300), bandeaux d'appel compris. Aucun nom ne transparaît.
 *   · Le premier geste n'agit pas sur l'application (aucun clic fantôme) : tant que le calque est là, les gestes
 *     qui « font » quelque chose (touche, clic, toucher, molette, menu contextuel) sont pris à la phase de
 *     CAPTURE de la fenêtre, annulés, et ne servent qu'à reprendre ; leurs suites (relâcher la touche ou le
 *     bouton, le clic qui suit) sont encore avalées un court instant après la fermeture. Le mouvement de la
 *     souris, lui, passe : il ne déclenche rien, et `useInactivite` s'en sert pour reprendre.
 *   · Le focus : pris à l'ouverture (le calque est un dialogue modal, nommé « Écran de veille. Appuyez sur une
 *     touche pour reprendre. »), rendu à la fermeture à l'élément qui l'avait.
 *   · Fondu court de 200 ms à l'entrée et à la sortie (cotes de la couche commune) ; framer-motion suit le
 *     réglage Mouvement de la racine (rien ne bouge en « aucun »).
 *
 * Il ne s'inscrit pas dans la pile des calques : Échap ne doit rien fermer d'autre, il reprend, comme toute touche.
 */
const GESTES = ['keydown', 'mousedown', 'pointerdown', 'touchstart', 'wheel', 'contextmenu', 'auxclick'] as const;
const SUITES = ['keyup', 'keypress', 'mouseup', 'pointerup', 'touchend', 'click', 'dblclick', 'contextmenu', 'auxclick'] as const;
/** Combien de temps les suites d'un geste sont encore avalées après la fermeture. */
export const SUITE_AVALEE_MS = 450;

const avaler = (e: Event) => {
  if (e.cancelable) e.preventDefault();
  e.stopImmediatePropagation();
};

/** Avale les suites du geste de reprise pendant `ms` (le clic qui suivrait le bouton enfoncé, par exemple). */
function avalerLaSuite(ms = SUITE_AVALEE_MS): void {
  const opts = { capture: true, passive: false } as const;
  for (const t of SUITES) window.addEventListener(t, avaler, opts);
  window.setTimeout(() => {
    for (const t of SUITES) window.removeEventListener(t, avaler, opts);
  }, ms);
}

function Calque({ libelle, onReprendre, children }: { libelle: string; onReprendre: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const reprendre = useRef(onReprendre);
  reprendre.current = onReprendre;

  useEffect(() => {
    const precedent = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.focus({ preventScroll: true });
    const opts = { capture: true, passive: false } as const;
    const surGeste = (e: Event) => {
      avaler(e);
      reprendre.current();
    };
    for (const t of GESTES) window.addEventListener(t, surGeste, opts);
    for (const t of SUITES) if (!(GESTES as readonly string[]).includes(t)) window.addEventListener(t, avaler, opts);
    return () => {
      for (const t of GESTES) window.removeEventListener(t, surGeste, opts);
      for (const t of SUITES) if (!(GESTES as readonly string[]).includes(t)) window.removeEventListener(t, avaler, opts);
      avalerLaSuite();
      if (precedent && precedent.isConnected) precedent.focus({ preventScroll: true });
    };
  }, []);

  const transition = { duration: COTES_MOUVEMENT.fonduCourt.duree / 1000, ease: COURBE_MOUVEMENT };
  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={libelle}
      tabIndex={-1}
      className="ve"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}

export interface IdleScreenProps {
  ouvert: boolean;
  /** « Écran de veille. Appuyez sur une touche pour reprendre. » */
  libelle: string;
  onReprendre: () => void;
  children: React.ReactNode;
}

export function IdleScreen({ ouvert, libelle, onReprendre, children }: IdleScreenProps) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {ouvert && (
        <Calque key="veille" libelle={libelle} onReprendre={onReprendre}>
          {children}
        </Calque>
      )}
    </AnimatePresence>,
    document.body,
  );
}
