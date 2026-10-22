import { useEffect } from 'react';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import './ambiance.css';

/**
 * Allume le fond noir et gris dans l'édition interne : pose
 * `data-ambiance="noir"` sur <html> tant qu'elle est montée (une fois, dans
 * `src/App.tsx`, via `@edition/vivant`). Côté cliente, la couture rend `null`
 * et n'importe ni la feuille ni la police.
 */
export function Ambiance(): null {
  useEffect(() => {
    const racine = document.documentElement;
    racine.dataset.ambiance = 'noir';
    return () => {
      delete racine.dataset.ambiance;
    };
  }, []);
  return null;
}
