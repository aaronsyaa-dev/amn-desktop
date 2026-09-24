import { useMemo } from 'react';
import { PROFILS } from '@edition/guide';
import { useAuth } from '../auth/AuthContext';
import { useProfiles } from '../state/ProfilesContext';
import { useCollection } from '../state/SyncContext';
import { useMembers } from '../state/useMembers';
import { useModulesOuverts } from '../state/useModulesOuverts';
import { isModuleEnabled } from '../data/spaces';
import type { PremierPas, ProfilDepart } from './profils';

/**
 * LES PREMIERS PAS, COCHÉS PAR LES DONNÉES.
 *
 * Un pas est fait quand la chose existe (une tâche, un client, un projet),
 * quand le module a été ouvert (le journal des ouvertures) ou quand l'équipe
 * compte assez de membres. Jamais coché à la main : un pas coché sans rien
 * derrière dirait « c'est fait » à quelqu'un qui n'a rien fait.
 *
 * Les collections lues sont TOUTES celles qu'un pas peut citer, lues d'un
 * coup : les hooks ne se conditionnent pas. Elles sont synchronisées de toute
 * façon — ce hook n'ajoute aucune lecture réseau.
 */
export function useProfilDepart(): ProfilDepart | null {
  const { user } = useAuth();
  const { profilDe } = useProfiles();
  const id = user?.email ? profilDe(user.email) : null;
  return PROFILS.find((p) => p.id === id) ?? null;
}

export type PasCoche = Omit<PremierPas, 'fait'> & { fait: boolean };

export function usePremiersPas(): { profil: ProfilDepart | null; pas: PasCoche[] } {
  const profil = useProfilDepart();
  const tasks = useCollection('tasks');
  const appointments = useCollection('appointments');
  const clients = useCollection('clients');
  const quotes = useCollection('quotes');
  const projects = useCollection('projects');
  const notes = useCollection('notes');
  const expenses = useCollection('expenses');
  const okrs = useCollection('okrs');
  const meetings = useCollection('meetings');
  const { membres } = useMembers();
  const ouverts = useModulesOuverts();

  const tailles: Record<string, number> = useMemo(
    () => ({
      tasks: tasks.length,
      appointments: appointments.length,
      clients: clients.length,
      quotes: quotes.length,
      projects: projects.length,
      notes: notes.length,
      expenses: expenses.length,
      okrs: okrs.length,
      meetings: meetings.length,
    }),
    [tasks.length, appointments.length, clients.length, quotes.length, projects.length, notes.length, expenses.length, okrs.length, meetings.length],
  );

  const pas = useMemo(() => {
    if (!profil) return [];
    return profil.premiersPas
      .filter((p) => isModuleEnabled(p.module))
      .map((p) => {
        const preuve = p.fait;
        let fait = false;
        if ('collection' in preuve) fait = (tailles[preuve.collection] ?? 0) >= (preuve.min ?? 1);
        else if ('moduleOuvert' in preuve) fait = Boolean(ouverts[preuve.moduleOuvert]);
        else fait = membres.length >= preuve.membres;
        const { fait: _preuve, ...reste } = p;
        void _preuve;
        return { ...reste, fait };
      });
  }, [profil, tailles, ouverts, membres.length]);

  return { profil, pas };
}
