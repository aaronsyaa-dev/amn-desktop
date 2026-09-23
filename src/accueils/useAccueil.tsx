import { useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useProfiles } from '../state/ProfilesContext';
import { ACCUEILS } from '@edition/accueils';
import { ACCUEIL_DEFAUT, type AccueilDef } from './types';

/**
 * L'ACCUEIL DU COMPTE — lu sur son profil synchronisé, par compte et non par
 * poste. Un code inconnu de l'édition (une variante retirée, ou venue de
 * l'autre édition) retombe sur l'Accueil par défaut.
 */
export function useAccueil(): { courant: AccueilDef; choisir: (code: string) => Promise<boolean> } {
  const { user } = useAuth();
  const { accueilDe, updateSelf } = useProfiles();
  const code = user?.email ? accueilDe(user.email) : null;
  const courant = ACCUEILS.find((a) => a.code === code) ?? (ACCUEILS.find((a) => a.code === ACCUEIL_DEFAUT) as AccueilDef);
  const choisir = useCallback(
    async (c: string) => (user?.email ? updateSelf(user.email, { accueil: c }) : false),
    [user?.email, updateSelf],
  );
  return { courant, choisir };
}

/** L'écran d'accueil : celui que le compte a choisi. */
export function AccueilChoisi() {
  const { courant } = useAccueil();
  const C = courant.composant;
  return <C />;
}
