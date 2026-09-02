import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';

/**
 * LE RANGEMENT PERSONNEL — ce qui n'appartient qu'à une personne, sur ce poste.
 *
 * Les collections synchronisées sont celles de l'organisation : tout membre
 * les lit. Un journal intime, des habitudes, des objectifs personnels n'ont
 * rien à y faire — et promettre « privé » sur une collection partagée serait
 * un mensonge. Même règle que les notes personnelles et le budget avant la
 * paie : `localStorage`, par compte, sur cette machine. Le prix de cette
 * confidentialité est dit tel quel dans les écrans : ça ne quitte pas ce
 * poste, et ce n'est pas chiffré.
 */
export function usePersonalStore<T>(nom: string, initial: T): [T, (suivant: T | ((v: T) => T)) => void, boolean] {
  const { user } = useAuth();
  const cle = `amn.perso.${nom}.${user?.email ?? 'anonyme'}`;
  const [valeur, setValeur] = useState<T>(initial);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    try {
      const brut = window.localStorage.getItem(cle);
      setValeur(brut ? (JSON.parse(brut) as T) : initial);
    } catch {
      setValeur(initial);
    }
    setPret(true);
    // `initial` est une valeur de départ, pas une dépendance : la relire à chaque rendu effacerait la saisie.
  }, [cle]); // eslint-disable-line react-hooks/exhaustive-deps

  const ecrire = useCallback(
    (suivant: T | ((v: T) => T)) => {
      setValeur((courant) => {
        const prochain = typeof suivant === 'function' ? (suivant as (v: T) => T)(courant) : suivant;
        try {
          window.localStorage.setItem(cle, JSON.stringify(prochain));
        } catch {
          /* stockage plein ou refusé : la valeur reste en mémoire pour la session */
        }
        return prochain;
      });
    },
    [cle],
  );

  return [valeur, ecrire, pret];
}
