import React from 'react';
import { markBootHealthy } from '../lib/safeBoot';

/**
 * La preuve qu'un démarrage a abouti (voir lib/safeBoot.ts).
 *
 * Monté DANS la coquille applicative, jamais à la racine : l'écran d'erreur est
 * lui aussi un rendu React, et poser la marque « tout va bien » depuis la
 * racine l'aurait posée même quand l'application affichait son plantage — ce
 * qui aurait rendu le mode de secours inopérant précisément quand il sert.
 *
 * Le délai n'est pas un ornement. Un plantage arrive souvent au premier effet,
 * juste après le premier rendu ; lever la marque dans la foulée du montage
 * l'aurait levée avant l'erreur. Deux secondes d'application vivante valent
 * preuve — et si elle meurt entre-temps, la marque reste, et le démarrage
 * suivant repart en sécurité.
 */
export function BootHealthy() {
  React.useEffect(() => {
    const t = setTimeout(markBootHealthy, 2000);
    return () => clearTimeout(t);
  }, []);
  return null;
}
