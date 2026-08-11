import { useCallback, useMemo } from 'react';
import { useSync, useCollection, uid, stripMeta } from './SyncContext';
import { oneOf } from '../lib/records';

/**
 * Rendez-vous — le cœur de l'édition Business.
 *
 * Même contrat que les autres collections synchronisées : amn-api est la source
 * durable, le miroir local sert les lectures instantanées et hors-ligne, et
 * chaque écriture est repoussée en direct aux autres sessions de la MÊME
 * organisation. Rien de spécifique ici, et c'est voulu — un module central ne
 * doit pas avoir son propre chemin de persistance.
 *
 * ## Ce qui est stocké, et ce qui est recalculé
 *
 * `startAt` est un instant absolu (ISO, avec fuseau). Un rendez-vous saisi à
 * 14 h reste à 14 h heure locale ; le stocker en heure murale sans fuseau
 * l'aurait décalé au premier changement d'heure.
 *
 * Le nom du client est dénormalisé sur le rendez-vous (`clientName`) EN PLUS
 * de `clientId`. Un rendez-vous libre n'a pas de fiche client, et une fiche
 * supprimée ne doit pas vider l'agenda de ses intitulés : le calendrier reste
 * lisible même quand le lien est cassé, et `clientId` sert quand il tient
 * encore.
 */

export type AppointmentStatus = 'scheduled' | 'done' | 'cancelled';

/** Le même domaine, disponible À L'EXÉCUTION — un type seul ne vérifie rien. */
const APPOINTMENT_STATUSES: AppointmentStatus[] = ['scheduled', 'done', 'cancelled'];

export interface Appointment {
  id: string;
  title: string;
  /** Début, ISO 8601 absolu. */
  startAt: string;
  /** Durée en minutes. */
  durationMin: number;
  /** Fiche client liée, ou `null` pour un rendez-vous libre. */
  clientId: number | null;
  /** Nom affiché, conservé même si la fiche disparaît. */
  clientName: string;
  location: string;
  notes: string;
  /**
   * Projet auquel cet enregistrement se rattache (A.3), ou absent.
   *
   * Un simple identifiant : le projet ne tient aucune liste et ne recopie
   * rien — il retrouve ce qui le concerne en filtrant cette collection. Cet
   * enregistrement garde donc un seul endroit où il vit.
   */
  projectId?: string;
  /** Minutes de préavis pour le rappel. 0 = pas de rappel. */
  reminderMin: number;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
}

type AppointmentData = Omit<Appointment, 'id' | 'updatedAt'>;

export interface AppointmentDraft {
  /** Projet lié (A.3) — voir la note sur `Appointment.projectId`. */
  projectId?: string;
  title: string;
  startAt: string;
  durationMin: number;
  clientId: number | null;
  clientName: string;
  location: string;
  notes: string;
  reminderMin: number;
}

/** Fin du rendez-vous, dérivée — jamais stockée, pour qu'elle ne puisse pas mentir. */
export function appointmentEnd(appointment: Appointment): Date {
  return new Date(new Date(appointment.startAt).getTime() + appointment.durationMin * 60_000);
}

export function useAppointments() {
  const { upsert, remove } = useSync();
  const raw = useCollection<Partial<AppointmentData>>('appointments');

  const appointments = useMemo<Appointment[]>(() => {
    return raw
      .map((row) => ({
        id: row.id,
        title: row.title ?? '',
        startAt: row.startAt ?? row.updatedAt,
        durationMin: Number(row.durationMin ?? 60),
        clientId:
          row.clientId === null || row.clientId === undefined ? null : Number(row.clientId),
        clientName: row.clientName ?? '',
        location: row.location ?? '',
        notes: row.notes ?? '',
        reminderMin: Number(row.reminderMin ?? 0),
        projectId: row.projectId,
        /*
          `as AppointmentStatus` affirmait au compilateur ce que la donnée ne
          garantissait pas : n'importe quelle chaîne stockée passait, puis
          arrivait dans les cinq `STATUS_META[appointment.status].label` de
          l'agenda, où elle faisait tomber l'écran sur un `undefined`.
        */
        status: oneOf(row.status, APPOINTMENT_STATUSES, 'scheduled'),
        createdAt: row.createdAt ?? row.updatedAt,
        updatedAt: row.updatedAt,
      }))
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  }, [raw]);

  const createAppointment = useCallback(
    (draft: AppointmentDraft): string => {
      const id = uid('rdv');
      upsert('appointments', id, {
        ...draft,
        status: 'scheduled',
        createdAt: new Date().toISOString(),
      } satisfies AppointmentData);
      return id;
    },
    [upsert],
  );

  const updateAppointment = useCallback(
    (id: string, patch: Partial<AppointmentData>) => {
      const current = raw.find((r) => r.id === id);
      if (!current) return;
      upsert('appointments', id, { ...stripMeta(current), ...patch });
    },
    [raw, upsert],
  );

  const setStatus = useCallback(
    (id: string, status: AppointmentStatus) => updateAppointment(id, { status }),
    [updateAppointment],
  );

  const deleteAppointment = useCallback((id: string) => remove('appointments', id), [remove]);

  return { appointments, createAppointment, updateAppointment, setStatus, deleteAppointment };
}
