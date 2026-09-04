import { useCallback, useEffect, useRef, useState } from 'react';
import { bridge } from '../lib/bridge';
import { cleanErrorMessage } from '../lib/errorMessage';
import type { ParcOrganization, ParcPageQuery } from '../shared/api';

/**
 * UNE PAGE DU PARC À LA FOIS (Bloc 4).
 *
 * Le registre des organisations chargeait tout puis filtrait dans le
 * navigateur — mesuré à 100 000 organisations : 2,6 s et 48 Mo par ouverture.
 * Ici le serveur filtre, trie et compte ; le poste tient les lignes reçues,
 * demande la suivante avec le curseur, et jette tout quand la question
 * change. Le total vient du serveur : on sait combien correspondent sans
 * les avoir.
 *
 * La recherche attend 250 ms après la dernière touche : frapper « fleur »
 * ne doit pas faire cinq requêtes.
 */
export function useParcPage(query: ParcPageQuery) {
  const [rows, setRows] = useState<ParcOrganization[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cle = JSON.stringify({ ...query, cursor: undefined });
  const generation = useRef(0);

  const charger = useCallback(
    async (cursor: string | null, remplacer: boolean) => {
      const mienne = ++generation.current;
      setLoading(true);
      setError(null);
      try {
        const page = await bridge().remote.admin.organizationsPage({ ...(JSON.parse(cle) as ParcPageQuery), cursor, limit: 50 });
        if (mienne !== generation.current) return;
        setRows((prev) => (remplacer ? page.organizations : [...prev, ...page.organizations]));
        setTotal(page.total);
        setNextCursor(page.nextCursor);
      } catch (err) {
        if (mienne !== generation.current) return;
        setError(cleanErrorMessage(err, 'Le parc n’a pas pu être lu.'));
      } finally {
        if (mienne === generation.current) setLoading(false);
      }
    },
    [cle],
  );

  useEffect(() => {
    const minuterie = window.setTimeout(() => void charger(null, true), 250);
    return () => window.clearTimeout(minuterie);
  }, [charger]);

  const loadMore = useCallback(() => {
    if (nextCursor && !loading) void charger(nextCursor, false);
  }, [charger, nextCursor, loading]);
  const reload = useCallback(() => void charger(null, true), [charger]);

  return { rows, total, loading, error, hasMore: nextCursor !== null, loadMore, reload };
}
