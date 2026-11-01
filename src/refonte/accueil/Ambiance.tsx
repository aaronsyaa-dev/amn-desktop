import { useEffect } from 'react';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '../../socle/noir.css';
import '../../socle/ui/briques.css';
import '../../socle/ui/controles/controles.css';
import '../../socle/ui/situations/situations.css';
import '../../socle/ui/graphiques/graphiques.css';
import '../../socle/ui/archetypes/archetypes.css';
import '../../socle/coquille/coquille.css';
import '../../socle/ui/vivant/vivant.css';
import '../../socle/mouvement.css';

/**
 * Allume le fond noir et gris dans l'édition interne (jetons : `src/socle/noir.css`,
 * briques et coquille : leurs feuilles, chargées ici et nulle part ailleurs) : pose
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
