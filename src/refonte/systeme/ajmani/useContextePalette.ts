import { useMemo, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { isAdminRole } from '../../../auth/roles';
import { lireFocus } from '../../../assistant/ecranContexte';
import { toutesLesSections } from '../../../data/spaces';
import { cheminLePlusPrecis } from '../../../lib/cheminCourant';
import { libelleNav, useLangue } from '../../../i18n';
import { useNavAlleges } from '../../../state/useNavAlleges';
import { entreeDuRegistre } from '../../navigation/registre';
import type { ContexteAjmani, FamilleCourante } from './intentions';

function abonnerReseau(rappel: () => void): () => void {
  window.addEventListener('online', rappel);
  window.addEventListener('offline', rappel);
  return () => {
    window.removeEventListener('online', rappel);
    window.removeEventListener('offline', rappel);
  };
}

/** Le poste est-il en ligne ? Lu sur le navigateur, relu quand la connexion change. */
export function useEnLigne(): boolean {
  return useSyncExternalStore(abonnerReseau, () => (typeof navigator === 'undefined' ? true : navigator.onLine), () => true);
}

/**
 * LE CONTEXTE DE LA PALETTE — l'écran courant, la fiche ouverte, les droits, la connexion.
 *
 * La famille vient du registre (celle du module où l'on est, `garde` pour la famille réservée à l'équipe AMN) ;
 * la fiche ouverte (client, facture) est lue quand la palette s'ouvre, pas avant.
 */
export function useContextePalette(ouverte: boolean): ContexteAjmani {
  const { pathname } = useLocation();
  const { user, role } = useAuth();
  const { langue } = useLangue();
  const alleges = useNavAlleges();
  const enLigne = useEnLigne();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const catalogue = useMemo(() => toutesLesSections().flatMap((s) => s.items), [alleges]);

  return useMemo<ContexteAjmani>(() => {
    const chemin = cheminLePlusPrecis(pathname, catalogue);
    const item = catalogue.find((i) => i.to === chemin);
    const entree = item ? entreeDuRegistre(item.key) : undefined;
    const famille: FamilleCourante | null = entree ? (entree.famille === 'garde' ? 'garde' : entree.teinte) : null;
    return {
      famille,
      ecranLibelle: item ? libelleNav(item) : '',
      admin: isAdminRole(role),
      enLigne,
      focus: ouverte ? lireFocus() : null,
      langue,
      email: (user?.email ?? '').toLowerCase(),
    };
  }, [pathname, catalogue, role, enLigne, ouverte, langue, user?.email]);
}
