import { useEffect, useState } from 'react';
import { useCall } from '../../../state/CallContext';
import { useAssistant } from '../../../assistant/AssistantContext';
import { raisonDeBlocage, uneVideoJoue, type RaisonBlocage } from './blocage';

/**
 * LE BRANCHEMENT DU BLOCAGE (G09) — la règle est dans `blocage.ts` ; ici, ses sources réelles : le contexte des
 * appels (celui de `CallOverlay`), la dictée d'Ajmani, et les vidéos de la fenêtre.
 */
const EVENEMENTS_VIDEO = ['play', 'playing', 'pause', 'ended', 'emptied', 'abort'] as const;

/** Vrai pendant qu'une vidéo joue. Les événements de média ne remontent pas : on les écoute en capture. */
function useVideoEnLecture(): boolean {
  const [joue, setJoue] = useState(false);
  useEffect(() => {
    const relire = () => setJoue(uneVideoJoue());
    relire();
    for (const t of EVENEMENTS_VIDEO) document.addEventListener(t, relire, true);
    return () => {
      for (const t of EVENEMENTS_VIDEO) document.removeEventListener(t, relire, true);
    };
  }, []);
  return joue;
}

/** La raison qui empêche la veille en ce moment (appel, partage, enregistrement, vidéo), ou `null`. */
export function useBlocageVeille(): RaisonBlocage | null {
  const { phase, sharingScreen, viewingScreen, controlledBy, controlling } = useCall();
  const { voixEtat } = useAssistant();
  const videoEnLecture = useVideoEnLecture();
  return raisonDeBlocage({ phase, sharingScreen, viewingScreen, controlledBy, controlling, voixEtat, videoEnLecture });
}
