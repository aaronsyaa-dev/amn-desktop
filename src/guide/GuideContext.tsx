import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { GuideOverlay } from './GuideOverlay';
import type { Parcours } from './types';

interface GuideValue {
  enCours: Parcours | null;
  lancer: (p: Parcours) => void;
  arreter: () => void;
}

const GuideCtx = createContext<GuideValue | null>(null);

/**
 * LE GUIDE — une seule visite à la fois, montée dans la coquille.
 *
 * `lancer` remplace la visite en cours ; `arreter` la ferme. Le rendu est
 * l'affaire de `GuideOverlay`, en portail hors de `<main>` : le projecteur et
 * le curseur ne sont pas des objets de l'écran, et `check:signal` ne les
 * compte pas — ils sont d'ailleurs sans ambre (voir GuideOverlay).
 */
export function GuideProvider({ children }: { children: React.ReactNode }) {
  const [enCours, setEnCours] = useState<Parcours | null>(null);
  const lancer = useCallback((p: Parcours) => setEnCours(p), []);
  const arreter = useCallback(() => setEnCours(null), []);
  const value = useMemo(() => ({ enCours, lancer, arreter }), [enCours, lancer, arreter]);
  return (
    <GuideCtx.Provider value={value}>
      {children}
      {enCours && <GuideOverlay parcours={enCours} onFin={arreter} />}
    </GuideCtx.Provider>
  );
}

export function useGuide(): GuideValue {
  const v = useContext(GuideCtx);
  if (!v) throw new Error('useGuide must be used within a GuideProvider');
  return v;
}
