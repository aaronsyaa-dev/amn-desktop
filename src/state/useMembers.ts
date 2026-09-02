import { useCallback, useEffect, useState } from 'react';
import { bridge } from '../lib/bridge';
import { useAuth } from '../auth/AuthContext';
import type { OrgMember } from '../shared/api';

/**
 * LES MEMBRES DE L'ORGANISATION, pour les modules du Collectif.
 *
 * Une seule source : les comptes réels (`/v1/auth/users`), les mêmes que
 * Système → Membres, avec leur dernière connexion. Sans serveur (poste local),
 * la liste se réduit à soi — sans prétendre le reste. Les suspendus n'y
 * figurent pas : ce sont les gens qui travaillent, pas l'administration.
 */
export function useMembers(): { membres: OrgMember[]; prets: boolean; recharger: () => Promise<void> } {
  const { user } = useAuth();
  const [membres, setMembres] = useState<OrgMember[]>([]);
  const [prets, setPrets] = useState(false);

  const recharger = useCallback(async () => {
    try {
      const liste = await bridge().remote.members.list();
      setMembres(liste.filter((m) => m.status !== 'suspended'));
    } catch {
      setMembres(
        user ? [{ id: 'moi', email: user.email, role: 'owner', status: 'active', invitedAt: null, joinedAt: null }] : [],
      );
    } finally {
      setPrets(true);
    }
  }, [user]);

  useEffect(() => {
    void recharger();
  }, [recharger]);

  return { membres, prets, recharger };
}
