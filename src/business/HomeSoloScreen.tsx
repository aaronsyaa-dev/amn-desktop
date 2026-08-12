import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, CalendarDays, CheckSquare, Contact, FileText, Plus } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useClients } from '../state/useClients';
import { useCollection } from '../state/SyncContext';
import { appointmentEnd, useAppointments, type Appointment } from '../state/useAppointments';
import { dayKey, longDayLabel, relativeToNow, timeLabel } from '../lib/calendar';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import { AttentionPanel } from '../components/AttentionPanel';
import type { SharedTaskStatus } from '../shared/api';

/**
 * Accueil de l'édition Business — la vue du jour de quelqu'un qui travaille seul.
 *
 * L'accueil interne est un poste de supervision : parc de sites, incidents,
 * activité de l'équipe. Rien de tout ça n'a de sens ici, et le transposer
 * aurait donné un tableau de bord vide. Celui-ci répond aux trois seules
 * questions d'une journée en solo : qu'est-ce que j'ai de prévu, qu'est-ce
 * qu'il me reste à faire, et où en sont mes clients.
 *
 * Il n'y a pas de fil « activité de l'équipe » : à une seule personne, ce fil
 * ne fait que rejouer ses propres actions.
 */

interface TaskData {
  title: string;
  status: SharedTaskStatus;
}

export function HomeSoloScreen() {
  const { user, org } = useAuth();
  const { appointments } = useAppointments();
  const { clients } = useClients();
  const tasks = useCollection<TaskData>('tasks');

  const now = new Date();
  const todayKey = dayKey(now);

  const today = useMemo(
    () =>
      appointments.filter(
        (a) => dayKey(new Date(a.startAt)) === todayKey && a.status !== 'cancelled',
      ),
    [appointments, todayKey],
  );

  // Les rendez-vous sont déjà triés par heure de début : le premier qui n'est
  // pas terminé est le prochain. Recalculé à chaque rendu — pas de minuteur,
  // donc pas d'horloge à garder juste.
  const next =
    appointments.find(
      (a) => a.status === 'scheduled' && appointmentEnd(a).getTime() > now.getTime(),
    ) ?? null;

  const openTasks = useMemo(
    () => tasks.filter((t) => t.status !== 'done').slice(0, 6),
    [tasks],
  );

  const hasAnything = appointments.length > 0 || tasks.length > 0 || clients.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
          {org?.name ?? 'Votre activité'}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-text-primary">
          Bonjour {user?.name ?? ''}
        </h1>
        <p className="mt-0.5 text-sm capitalize text-text-secondary">{longDayLabel(now)}</p>
      </header>

      {!hasAnything && <FirstRunCard />}

      {/* Factures impayées, tâches enlisées, clients sans nouvelles. Rien ne
          s'affiche tant qu'il n'y a rien à signaler. */}
      <AttentionPanel />

      <StaggerGroup className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StaggerItem className="lg:col-span-2">
          <Card
            icon={CalendarDays}
            title="Aujourd’hui"
            action={{ to: '/agenda', label: 'Ouvrir l’agenda' }}
          >
            {next && (
              <div className="mb-3 border border-border-strong bg-accent-muted px-3 py-2.5">
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  Prochain rendez-vous · {relativeToNow(next.startAt)}
                </p>
                <p className="mt-0.5 text-sm font-medium text-text-primary">
                  {timeLabel(next.startAt)} — {next.title || 'Rendez-vous'}
                </p>
                {next.clientName && (
                  <p className="font-mono text-[10px] text-text-secondary">{next.clientName}</p>
                )}
              </div>
            )}

            {today.length === 0 ? (
              <Empty>Aucun rendez-vous aujourd’hui.</Empty>
            ) : (
              <ul className="flex flex-col divide-y divide-border/60">
                {today.map((appointment) => (
                  <AppointmentRow key={appointment.id} appointment={appointment} />
                ))}
              </ul>
            )}
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card icon={CheckSquare} title="À faire" action={{ to: '/tasks', label: 'Toutes les tâches' }}>
            {openTasks.length === 0 ? (
              <Empty>Rien en attente.</Empty>
            ) : (
              <ul className="flex flex-col divide-y divide-border/60">
                {openTasks.map((task) => (
                  <li key={task.id} className="flex items-start gap-2 py-2">
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-text-muted" />
                    <span className="min-w-0 flex-1 text-sm text-text-secondary">
                      <span className="block truncate">{task.title || 'Sans titre'}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </StaggerItem>

        <StaggerItem className="lg:col-span-2">
          <Card icon={Contact} title="Clients" action={{ to: '/clients', label: 'Toutes les fiches' }}>
            {clients.length === 0 ? (
              <Empty>Aucune fiche client pour l’instant.</Empty>
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {clients.slice(0, 6).map((client) => (
                  <li
                    key={client.id}
                    className="flex items-center gap-2.5 border border-border bg-bg px-2.5 py-2"
                  >
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-surface font-mono text-[10px] text-text-secondary">
                      {(client.name || '?').charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-text-primary">{client.name}</span>
                      {client.company && (
                        <span className="block truncate font-mono text-[10px] text-text-muted">
                          {client.company}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card icon={FileText} title="Raccourcis">
            <div className="flex flex-col gap-2">
              <Shortcut to="/agenda" label="Planifier un rendez-vous" />
              <Shortcut to="/clients" label="Ajouter un client" />
              <Shortcut to="/notes" label="Prendre une note" />
              <Shortcut to="/reports" label="Rédiger un compte-rendu" />
            </div>
          </Card>
        </StaggerItem>
      </StaggerGroup>
    </div>
  );
}

/**
 * Première ouverture : l'espace est vide, et il doit le dire sans donner
 * l'impression que quelque chose a échoué.
 */
function FirstRunCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="border border-border-strong bg-surface p-5"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
        Bienvenue
      </p>
      <h2 className="mt-1.5 text-base font-semibold text-text-primary">
        Votre espace est prêt, et vide — c’est normal.
      </h2>
      <p className="mt-1 max-w-prose text-sm text-text-secondary">
        Tout ce que vous créez ici n’appartient qu’à votre organisation. Commencez par le plus
        utile : poser un premier rendez-vous, ou créer la fiche d’un client.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to="/agenda"
          className="flex items-center gap-1.5 bg-accent px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
        >
          <Plus size={14} strokeWidth={2} /> Premier rendez-vous
        </Link>
        <Link
          to="/clients"
          className="flex items-center gap-1.5 border border-border px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <Contact size={14} strokeWidth={1.75} /> Première fiche client
        </Link>
      </div>
    </motion.div>
  );
}

function AppointmentRow({ appointment }: { appointment: Appointment }) {
  return (
    <li className="flex items-baseline gap-3 py-2">
      <span className="w-24 flex-shrink-0 font-mono text-[11px] text-text-muted">
        {timeLabel(appointment.startAt)} – {timeLabel(appointmentEnd(appointment).toISOString())}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-sm ${
            appointment.status === 'done' ? 'text-text-muted line-through' : 'text-text-primary'
          }`}
        >
          {appointment.title || 'Rendez-vous'}
        </span>
        {appointment.clientName && (
          <span className="block truncate font-mono text-[10px] text-text-muted">
            {appointment.clientName}
          </span>
        )}
      </span>
    </li>
  );
}

function Card({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  title: string;
  action?: { to: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="flex h-full flex-col border border-border bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-text-secondary">
          <Icon size={13} strokeWidth={1.75} className="text-text-muted" />
          {title}
        </h2>
        {action && (
          <Link
            to={action.to}
            className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-text-muted transition-colors hover:text-text-primary"
          >
            {action.label}
            <ArrowRight size={11} strokeWidth={2} />
          </Link>
        )}
      </div>
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-2 font-mono text-xs text-text-muted">{children}</p>;
}

function Shortcut({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-2 border border-border bg-bg px-3 py-2 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
    >
      {label}
      <ArrowRight size={13} strokeWidth={2} className="text-text-muted" />
    </Link>
  );
}
