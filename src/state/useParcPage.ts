import { bridge } from '../lib/bridge';
import { useCursorPage } from './useCursorPage';
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
 *
 * La mécanique qui empêche une réponse périmée de mélanger deux questions —
 * un filtre changé pendant un « Charger plus », deux clics rapides sur le
 * même bouton — vit dans `useCursorPage`, partagée avec la file d'incidents
 * du parc (`ParcSocPanel`). Voir son en-tête pour la course du 25/09.
 */
export function useParcPage(query: ParcPageQuery) {
  const cle = JSON.stringify({ ...query, cursor: undefined });
  const { rows, total, loading, error, hasMore, loadMore, reload } = useCursorPage<ParcOrganization>(
    cle,
    async (cursor) => {
      const page = await bridge().remote.admin.organizationsPage({ ...(JSON.parse(cle) as ParcPageQuery), cursor, limit: 50 });
      return { items: page.organizations, total: page.total, nextCursor: page.nextCursor };
    },
    { debounceMs: 250, messageErreur: 'Le parc n’a pas pu être lu.' },
  );
  return { rows, total, loading, error, hasMore, loadMore, reload };
}
