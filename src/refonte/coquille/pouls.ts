import { useEffect, useState } from 'react';
import { garde } from '../../lib/garde';
import type { EtatGarde } from '../../socle/coquille';

const RELECTURE_MS = 60_000;
const ECHECS_AVANT_INCONNU = 3;

/**
 * LE POULS DE LA GARDE pour la pastille de l'en-tête : une lecture au
 * montage, puis une par minute. Une lecture en échec garde le dernier état
 * connu ; après trois échecs de suite, l'état devient « inconnu » (la pastille
 * le dit, au lieu de laisser croire que tout va bien).
 */
export function usePoulsGarde(): { etat: EtatGarde; points: number } {
  const [pouls, setPouls] = useState<{ etat: EtatGarde; points: number }>({ etat: 'calme', points: 0 });
  useEffect(() => {
    let vivant = true;
    let echecs = 0;
    const lire = () => {
      garde
        .pouls()
        .then((p) => {
          if (!vivant) return;
          echecs = 0;
          const etat: EtatGarde = p.niveau;
          const points = p.compte.ouvertes;
          setPouls((prev) => (prev.etat === etat && prev.points === points ? prev : { etat, points }));
        })
        .catch(() => {
          echecs += 1;
          if (vivant && echecs >= ECHECS_AVANT_INCONNU) setPouls({ etat: 'inconnu', points: 0 });
        });
    };
    lire();
    const id = window.setInterval(lire, RELECTURE_MS);
    return () => {
      vivant = false;
      window.clearInterval(id);
    };
  }, []);
  return pouls;
}
