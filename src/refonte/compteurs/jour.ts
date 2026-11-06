import { useMemo } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useCollection } from '../../state/SyncContext';
import { useInvoices, isOverdue, isoDay } from '../../state/useInvoices';
import { useAppointments, appointmentEnd } from '../../state/useAppointments';
import { useActivity } from '../../state/ActivityContext';
import { useMaintenant } from '../../bureaux/donnees/useSupervisor';
import { declarerCompteurs } from '../coquille/declarerCompteurs';

/**
 * LES COMPTEURS DE MA JOURNÉE — la première déclaration, celle qui portait les
 * pastilles de la coquille avant que les lots ne déclarent les leurs (mêmes
 * chiffres) : l'activité non vue sur chaque module (`useActivity`), ce qui
 * reste de la journée (rendez-vous à venir, priorités non faites), les tâches
 * qu'on m'a confiées, les factures en retard. Un compteur à zéro ne s'affiche pas.
 *
 * L'horloge est lue à la minute (`useMaintenant`) : un rendez-vous fini sort
 * du compteur de l'agenda sans attendre un changement de donnée, et les
 * compteurs du jour (relances, priorités) changent de jour à minuit — comme la
 * carte « Aujourd'hui », qui suit la même cadence.
 */

interface LigneTache {
  status?: string;
  assigneeEmail?: string;
}
interface JourPriorites {
  email: string;
  day: string;
  items?: { doneAt: string | null }[];
}

function useCompteurs(): Record<string, number> {
  const { user } = useAuth();
  const moi = (user?.email ?? '').toLowerCase();
  const { invoices } = useInvoices();
  const { appointments } = useAppointments();
  const taches = useCollection<LigneTache>('tasks');
  const priorites = useCollection<JourPriorites>('dailyPriorities');
  const { unseen } = useActivity();
  const tic = useMaintenant(60_000);
  return useMemo(() => {
    const maintenant = new Date(tic);
    const aujourdhui = isoDay(maintenant);
    return {
      ...unseen,
      '/agenda': appointments.filter((a) => a.status === 'scheduled' && isoDay(new Date(a.startAt)) === aujourdhui && appointmentEnd(a) > maintenant).length,
      '/tasks': taches.filter((t) => (t.status === 'todo' || t.status === 'doing') && (t.assigneeEmail ?? '').toLowerCase() === moi).length,
      '/relances': invoices.filter((f) => isOverdue(f, aujourdhui, invoices)).length,
      '/priorites': priorites.filter((d) => d.day === aujourdhui && d.email.toLowerCase() === moi).flatMap((d) => d.items ?? []).filter((p) => !p.doneAt).length,
    };
  }, [unseen, appointments, taches, invoices, priorites, moi, tic]);
}

export default declarerCompteurs({ famille: 'jour', useCompteurs });
