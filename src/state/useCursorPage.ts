import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cleanErrorMessage } from '../lib/errorMessage';

/**
 * UNE PAGE À LA FOIS, SANS COURSE — la mécanique commune à toute liste que le
 * serveur pagine par curseur : le parc des organisations (`useParcPage`,
 * bloc 4) et la file d'incidents du parc (`ParcSocPanel`, bloc 6).
 *
 * ## La course trouvée le 25/09
 *
 * Signalée pendant le chantier de la visite guidée : « changer un filtre
 * pendant un chargement peut mélanger d'anciens et de nouveaux résultats ».
 * Reproduite dans un vrai navigateur (`scripts/check-courses-parc.mjs`),
 * réseau ralenti sur la réponse du filtre le plus récent :
 *
 *   1. la question change (un filtre, une recherche, une gravité) — mais le
 *      CURSEUR de l'ancienne question reste en mémoire tant que le nouveau
 *      premier lot n'est pas arrivé ;
 *   2. si « Charger plus » est cliqué dans cette fenêtre, il repart avec ce
 *      curseur périmé ; sa réponse, si elle arrive avant celle de la
 *      nouvelle question, s'ajoute quand même aux lignes affichées — des
 *      lignes de l'ANCIENNE question, alors que l'écran affiche déjà le
 *      nouveau filtre choisi ;
 *   3. deux clics rapides sur « Charger plus » peuvent tous les deux partir
 *      avant que le premier n'ait eu le temps de désactiver le bouton (deux
 *      clics synchrones, sans qu'un rendu s'intercale) : la même page est
 *      alors demandée deux fois.
 *
 * ## Le principe du correctif
 *
 * Une question se reconnaît à une clé (`cle`, une chaîne). Dès que `cle`
 * change, AVANT que le navigateur ne peigne (`useLayoutEffect`, pas un effet
 * ordinaire qui laisserait passer un clic entre-temps) :
 *
 *   - le numéro de génération avance. Toute réponse déjà en vol — un
 *     chargement initial ou un « Charger plus » de l'ancienne question — voit
 *     son numéro devenir périmé, et sera ignorée à son arrivée, qu'elle
 *     arrive avant ou après la réponse de la nouvelle question ;
 *   - le curseur repart à zéro (`nextCursor = null`), donc `hasMore` devient
 *     faux immédiatement : « Charger plus » ne peut plus repartir avec un
 *     curseur qui n'appartient pas à cette question-là.
 *
 * Les lignes et le total affichés, eux, ne sont PAS effacés à cet instant :
 * ils restent ceux de l'ancienne question jusqu'à ce que la nouvelle réponde
 * — un instant de données périmées mais COHÉRENTES vaut mieux qu'un vide qui
 * clignote à chaque lettre tapée dans une recherche.
 *
 * Le second clic est bloqué par un verrou tenu dans une `ref` (`enVol`),
 * jamais dans le state `loading` : une ref se lit et s'écrit tout de suite,
 * un state ne se voit qu'au rendu suivant — c'est exactement la fenêtre où
 * deux clics synchrones passeraient tous les deux le contrôle `!loading`.
 */
export interface PageDeCurseur<T> {
  items: T[];
  total: number;
  nextCursor: string | null;
}

export function useCursorPage<T>(
  /** La question posée, réduite à une chaîne : deux appels avec la même clé sont la même question. */
  cle: string,
  /** Demande une page au serveur. Lu depuis une ref à chaque appel : peut fermer sur des valeurs qui changent à chaque rendu, sans avoir besoin d'être mémoïsée. */
  chargerPage: (cursor: string | null) => Promise<PageDeCurseur<T>>,
  options: {
    /** Attente après un changement de `cle` avant de charger le premier lot (une recherche en direct ne doit pas faire une requête par lettre). 0 = tout de suite. */
    debounceMs?: number;
    messageErreur?: string;
    /** Coupe tout chargement (une session de support qui n'a rien à faire ici, par exemple) sans démonter le composant. */
    actif?: boolean;
  } = {},
) {
  const { debounceMs = 0, messageErreur = 'La suite n’a pas pu être chargée.', actif = true } = options;

  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generation = useRef(0);
  /* Un chargement est en vol ou non — lu et écrit tout de suite, jamais après un rendu. */
  const enVol = useRef(false);
  const chargerRef = useRef(chargerPage);
  chargerRef.current = chargerPage;

  const charger = useCallback(
    async (cursor: string | null, remplacer: boolean) => {
      const mienne = ++generation.current;
      enVol.current = true;
      setLoading(true);
      setError(null);
      try {
        const page = await chargerRef.current(cursor);
        if (mienne !== generation.current) return; // périmée : une question plus récente a déjà remplacé celle-ci
        setRows((prev) => (remplacer ? page.items : [...prev, ...page.items]));
        setTotal(page.total);
        setNextCursor(page.nextCursor);
      } catch (err) {
        if (mienne !== generation.current) return;
        setError(cleanErrorMessage(err, messageErreur));
      } finally {
        if (mienne === generation.current) {
          setLoading(false);
          enVol.current = false;
        }
      }
    },
    [messageErreur],
  );

  /*
    LA QUESTION A CHANGÉ — invalidé avant que le navigateur ne peigne, pas
    après un effet ordinaire qui laisserait une fenêtre où « Charger plus »
    peut encore partir avec le curseur de l'ancienne question. Le verrou est
    aussi relâché ici : un « Charger plus » resté en vol pour l'ancienne
    question ne doit pas garder le bouton bloqué pour la nouvelle, et sa
    réponse, de toute façon périmée par le numéro de génération qui vient de
    changer, ne le reprendra pas elle-même (son `finally` compare à la
    génération courante avant de le faire).
  */
  useLayoutEffect(() => {
    if (!actif) return;
    generation.current += 1;
    enVol.current = false;
    setNextCursor(null);
    setError(null);
  }, [cle, actif]);

  useEffect(() => {
    if (!actif) return;
    const lancer = () => void charger(null, true);
    if (debounceMs <= 0) {
      lancer();
      return;
    }
    const minuterie = window.setTimeout(lancer, debounceMs);
    return () => window.clearTimeout(minuterie);
    // `cle` pilote le rechargement ; `charger` en dépend déjà (via `messageErreur`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, actif, debounceMs, charger]);

  const loadMore = useCallback(() => {
    if (!actif) return;
    if (nextCursor && !enVol.current) void charger(nextCursor, false);
  }, [charger, nextCursor, actif]);
  const reload = useCallback(() => void charger(null, true), [charger]);

  return { rows, total, loading, error, hasMore: nextCursor !== null, loadMore, reload };
}
