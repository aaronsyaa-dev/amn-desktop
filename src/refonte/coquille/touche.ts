import { useEffect, useState } from 'react';

/** ⌘ sur macOS, Ctrl ailleurs — détecté une fois, comme la barre du haut d'origine. */
export function useToucheModificatrice(): '⌘' | 'Ctrl' {
  const [touche, setTouche] = useState<'⌘' | 'Ctrl'>('Ctrl');
  useEffect(() => {
    setTouche(/mac/i.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl');
  }, []);
  return touche;
}
