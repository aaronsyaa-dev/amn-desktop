import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Enregistrer au fil de la frappe, SANS PERDRE LA FIN.
 *
 * Les éditeurs (Notes, Documentation) attendent six cents millisecondes de
 * silence avant d'envoyer ce qu'on tape : c'est ce qui évite une requête par
 * lettre. Le revers, mesuré au navigateur (suite « casser », Bloc 7) : une
 * phrase tapée puis un rechargement cent millisecondes plus tard, et la
 * phrase n'existait nulle part — ni sur le serveur, ni sur le poste, sans
 * un mot. Quitter la note pour une autre avait le même effet.
 *
 * Ici, ce qui attend part AUSSI quand la page se cache (`pagehide` :
 * rechargement, onglet fermé, navigation) et quand l'éditeur se démonte.
 * Le pont, de son côté, marque `keepalive` l'écriture lancée à ce moment-là
 * pour que le navigateur la laisse finir (voir lib/bridge.ts).
 */
export function useSauvegardeDifferee<T>(enregistrer: (valeur: T) => void, delai = 600) {
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enAttente = useRef<T | null>(null);
  // La fonction d'enregistrement change à chaque rendu du parent (une flèche
  // en ligne) ; on lit toujours la dernière sans réabonner quoi que ce soit.
  const enregistrerRef = useRef(enregistrer);
  enregistrerRef.current = enregistrer;

  /** Envoyer tout de suite ce qui attend, s'il y a quelque chose. */
  const vider = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (enAttente.current === null) return;
    const valeur = enAttente.current;
    enAttente.current = null;
    enregistrerRef.current(valeur);
    setSaved(true);
  }, []);

  const programmer = useCallback(
    (valeur: T) => {
      setSaved(false);
      enAttente.current = valeur;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(vider, delai);
    },
    [delai, vider],
  );

  useEffect(() => {
    window.addEventListener('pagehide', vider);
    return () => {
      window.removeEventListener('pagehide', vider);
      vider();
    };
  }, [vider]);

  return { programmer, vider, saved };
}
