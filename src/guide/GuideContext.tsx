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

/*
  SANS FOURNISSEUR, LE GUIDE SE TAIT — IL NE PLANTE JAMAIS L'APPLICATION.

  Avant : une exception. Le contexte de support (ClientContextLayout) est un
  arbre de routes à part ; son Accueil montait « Vos premiers pas », qui
  appelait useGuide sans fournisseur — et Harun ne pouvait plus entrer chez
  aucune cliente (écran « Une erreur inattendue s'est produite »). Un guide
  est un confort : son absence doit coûter une visite, pas l'écran.
*/
const SANS_GUIDE: GuideValue = { enCours: null, lancer: () => undefined, arreter: () => undefined };

export function useGuide(): GuideValue {
  return useContext(GuideCtx) ?? SANS_GUIDE;
}

/** Vrai quand un guide est réellement monté (les composants qui n'ont de sens qu'avec lui s'effacent sinon). */
export function useGuideDisponible(): boolean {
  return useContext(GuideCtx) !== null;
}
