import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * L'INACTIVITÉ DU POSTE — la détection que partagent les deux écrans de
 * veille (la Salle de l'édition interne, la vitrine du jour de l'édition
 * cliente). Peu coûteuse : des écouteurs passifs et un seul minuteur,
 * réarmé à chaque geste. `delaiMs` à `null` : jamais de veille.
 */
const EVENEMENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'] as const;

export function useInactivite(delaiMs: number | null): { actif: boolean; declencher: () => void; reveiller: () => void } {
  const [actif, setActif] = useState(false);
  const actifRef = useRef(false);
  actifRef.current = actif;
  const depuis = useRef(0);
  if (actif && depuis.current === 0) depuis.current = Date.now();
  if (!actif) depuis.current = 0;
  const minuteur = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const armer = useCallback(() => {
    if (minuteur.current) clearTimeout(minuteur.current);
    if (delaiMs !== null && delaiMs > 0) minuteur.current = setTimeout(() => setActif(true), delaiMs);
  }, [delaiMs]);

  const reveiller = useCallback(() => {
    setActif(false);
    armer();
  }, [armer]);
  const declencher = useCallback(() => setActif(true), []);

  useEffect(() => {
    const surGeste = (e: Event) => {
      /* Le frémissement de la souris dans la seconde et demie qui suit l'ouverture ne réveille pas. */
      if (actifRef.current && e.type === 'mousemove' && Date.now() - depuis.current < 1500) return;
      if (actifRef.current) setActif(false);
      armer();
    };
    for (const e of EVENEMENTS) window.addEventListener(e, surGeste, { passive: true });
    armer();
    return () => {
      if (minuteur.current) clearTimeout(minuteur.current);
      for (const e of EVENEMENTS) window.removeEventListener(e, surGeste);
    };
  }, [armer]);

  /* Un délai passé à « jamais » pendant la veille la referme. */
  useEffect(() => {
    if (delaiMs === null) setActif(false);
  }, [delaiMs]);

  return { actif, declencher, reveiller };
}
