import { useEffect, useState } from 'react';

/** ⌘ sur macOS, Ctrl ailleurs — détecté une fois, comme la barre du haut d'origine. */
export function useToucheModificatrice(): '⌘' | 'Ctrl' {
  const [touche, setTouche] = useState<'⌘' | 'Ctrl'>('Ctrl');
  useEffect(() => {
    setTouche(/mac/i.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl');
  }, []);
  return touche;
}

/** Un raccourci tel qu'il s'écrit : « ⌘K » d'un bloc sur macOS (écart C8), « Ctrl K » ailleurs. */
export function raccourciAffiche(touche: '⌘' | 'Ctrl', lettre: string): string {
  return touche === '⌘' ? `⌘${lettre}` : `${touche} ${lettre}`;
}
