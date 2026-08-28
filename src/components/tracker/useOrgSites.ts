import { useEffect, useState } from 'react';
import { bridge } from '../../lib/bridge';
import type { OrgOverview } from '../../shared/api';

/**
 * La liste des sites de l'organisation, pour les panneaux qui ont juste besoin
 * de proposer un choix.
 *
 * Extrait parce que deux panneaux de la Tour de contrôle en ont besoin — le
 * badge et la page de statut — et que chacun allait chercher l'aperçu complet
 * de son côté. Deux fois la même requête sur un écran qui s'ouvre à chaque
 * démarrage, pour deux listes déroulantes identiques.
 *
 * Les erreurs sont avalées volontairement : ces panneaux sont accessoires, et
 * un aperçu indisponible doit laisser la Tour de contrôle lisible plutôt que
 * d'y planter un message d'erreur pour une liste déroulante.
 */
export function useOrgSites(days = 7): OrgOverview['sites'] {
  const [sites, setSites] = useState<OrgOverview['sites']>([]);
  useEffect(() => {
    let actif = true;
    bridge()
      .remote.getOrgOverview(days)
      .then((data) => {
        if (actif) setSites(data.sites);
      })
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, [days]);
  return sites;
}
