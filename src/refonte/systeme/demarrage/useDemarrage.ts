import { useCallback, useEffect, useMemo, useState } from 'react';
import { bridge } from '../../../lib/bridge';
import { isAdminRole } from '../../../auth/roles';
import { useAuth } from '../../../auth/AuthContext';
import { useProfilesOptionnel } from '../../../state/ProfilesContext';
import { useCollection, useSync } from '../../../state/SyncContext';
import { useMembers } from '../../../state/useMembers';
import { calculerEtapes, memoriserFaites, prenomAffichable, remettreEtapes, retirerEtape, type IdEtape, type ResultatEtapes } from './etapes';
import { ecrireMemoire, useMemoireEtapes } from './memoire';
import { modeleParId, type ModeleMetier } from './modeles';
import { CLE_PREFS_METIER, ecrireMetier, lireChoix, useMetierStocke, type ChoixMetier } from './metier';

/**
 * LES DONNÉES DE DÉMARRAGE — ce que `PageDemarrage` lit, branché sur le poste.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Aucune écriture dans les collections de l'application (surtout pas `profiles`, que seul `ProfilesContext`
 * touche) : on LIT des effectifs (clients, devis, tâches, rendez-vous, équipe), on LIT le métier gardé (local,
 * puis préférence du compte quand le poste n'en a pas encore), et on ÉCRIT seulement la mémoire de Démarrage.
 */

/** Hors ligne : le serveur le dit, ou le navigateur. */
export function useHorsLigne(): boolean {
  const { connectionStatus } = useSync();
  const [navigateurHors, setNavigateurHors] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  useEffect(() => {
    const maj = () => setNavigateurHors(navigator.onLine === false);
    window.addEventListener('online', maj);
    window.addEventListener('offline', maj);
    return () => {
      window.removeEventListener('online', maj);
      window.removeEventListener('offline', maj);
    };
  }, []);
  return connectionStatus === 'offline' || navigateurHors;
}

export interface DemarrageDonnees {
  etat: 'chargement' | 'erreur' | 'pret';
  calcul: ResultatEtapes;
  prenom: string;
  horsLigne: boolean;
  /** Un membre sans droit d'administration ne voit ni « Inviter » ni « Connecter ». Sans session nominative, rien n'est refusé ici. */
  peutAdministrer: boolean;
  metier: ChoixMetier | null;
  modele: ModeleMetier | null;
  marquerFaite: (id: IdEtape) => void;
  retirer: (id: IdEtape) => void;
  remettre: () => void;
  reessayer: () => void;
}

export function useDemarrage(): DemarrageDonnees {
  const { user, role } = useAuth();
  const email = user?.email ?? '';
  const profils = useProfilesOptionnel();
  const { ready, pullFailed } = useSync();
  const horsLigne = useHorsLigne();
  const { membres, prets: equipePrete, recharger } = useMembers();

  const clients = useCollection('clients').length;
  const quotes = useCollection('quotes').length;
  const tasks = useCollection('tasks').length;
  const appointments = useCollection('appointments').length;

  const metier = useMetierStocke(email);
  const memoire = useMemoireEtapes(email);

  /* Le métier d'un autre poste : la préférence du compte le rend quand celui-ci n'en a pas encore. */
  const [prefsEchec, setPrefsEchec] = useState(false);
  const [essai, setEssai] = useState(0);
  const sansMetierLocal = metier === null;
  useEffect(() => {
    if (!email) return undefined;
    let vivant = true;
    void bridge()
      .remote.prefs.get()
      .then((prefs) => {
        if (!vivant) return;
        setPrefsEchec(false);
        const distant = lireChoix(prefs[CLE_PREFS_METIER]);
        if (distant && sansMetierLocal) ecrireMetier(email, distant);
      })
      .catch(() => {
        if (vivant) setPrefsEchec(true);
      });
    return () => {
      vivant = false;
    };
    // Le métier local ne relance pas la lecture : seul `essai` ou un changement de compte le fait.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, essai]);

  const modele = useMemo(() => modeleParId(metier?.modele), [metier]);
  const calcul = useMemo(
    () =>
      calculerEtapes({
        metier: metier ? { modele, taille: metier.taille, passe: metier.passe } : null,
        donnees: { clients, quotes, tasks, appointments, membres: membres.length },
        memoire,
      }),
    [metier, modele, clients, quotes, tasks, appointments, membres.length, memoire],
  );

  const chargement = !ready || !equipePrete;
  const etat: DemarrageDonnees['etat'] = chargement ? 'chargement' : !horsLigne && (prefsEchec || pullFailed) ? 'erreur' : 'pret';

  /* Une étape que les données prouvent faites est gardée : elle ne redeviendra jamais « à faire ». Jamais avant la fin du chargement. */
  useEffect(() => {
    if (chargement || calcul.aMemoriser.length === 0) return;
    ecrireMemoire(email, memoriserFaites(memoire, calcul.aMemoriser));
  }, [chargement, calcul.aMemoriser, email, memoire]);

  const marquerFaite = useCallback((id: IdEtape) => void ecrireMemoire(email, memoriserFaites(memoire, [id])), [email, memoire]);
  const retirer = useCallback((id: IdEtape) => void ecrireMemoire(email, retirerEtape(memoire, id)), [email, memoire]);
  const remettre = useCallback(() => void ecrireMemoire(email, remettreEtapes(memoire)), [email, memoire]);
  const reessayer = useCallback(() => {
    setEssai((n) => n + 1);
    void recharger();
  }, [recharger]);

  const prenom = prenomAffichable(profils?.profileFor(email).name, user?.name);
  const peutAdministrer = role === null || isAdminRole(role);

  return { etat, calcul, prenom, horsLigne, peutAdministrer, metier, modele, marquerFaite, retirer, remettre, reessayer };
}
