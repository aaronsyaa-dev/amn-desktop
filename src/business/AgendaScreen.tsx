import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  BellOff,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Contact,
  MapPin,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import { useClients } from '../state/useClients';
import {
  appointmentEnd,
  useAppointments,
  type Appointment,
  type AppointmentDraft,
  type AppointmentStatus,
} from '../state/useAppointments';
import {
  WEEKDAY_LABELS,
  addDays,
  addMonths,
  capitaliserPhrase,
  dayKey,
  fromDateTimeLocalValue,
  isToday,
  longDayLabel,
  monthGrid,
  monthLabel,
  startOfDay,
  timeLabel,
  toDateTimeLocalValue,
  weekDays,
} from '../lib/calendar';
import { ConfirmDelete } from '../components/ConfirmDelete';
import { metaOf } from '../lib/records';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useFermetureEchap } from '../lib/useFermetureEchap';

/**
 * Agenda — le module que la cliente ouvre en premier chaque matin.
 *
 * Trois vues sur la même donnée : le mois pour se repérer, la semaine pour
 * organiser, le jour pour exécuter. Elles partagent une seule date d'ancrage,
 * donc changer de vue ne fait jamais perdre l'endroit où on était.
 *
 * ## Pourquoi des listes par jour, et pas une grille horaire au pixel
 *
 * Une grille où chaque rendez-vous est positionné à sa hauteur exacte est
 * belle sur une maquette et pénible en vrai : elle demande une hauteur fixe
 * par heure, gère mal les chevauchements, et devient illisible sur un
 * téléphone. Une liste ordonnée par heure dit la même chose — quoi, quand,
 * avec qui — reste juste quand deux rendez-vous se chevauchent, et se replie
 * naturellement sur mobile. Si un jour un vrai quadrillage est souhaité, seule
 * `DayColumn` change.
 */

type ViewMode = 'month' | 'week' | 'day';

const VIEW_LABELS: Record<ViewMode, string> = {
  month: 'Mois',
  week: 'Semaine',
  day: 'Jour',
};

const STATUS_META: Record<AppointmentStatus, { label: string; dot: string; text: string }> = {
  scheduled: { label: 'Prévu', dot: 'bg-accent', text: 'text-text-primary' },
  done: { label: 'Terminé', dot: 'bg-success', text: 'text-text-muted line-through' },
  cancelled: { label: 'Annulé', dot: 'bg-danger', text: 'text-text-muted line-through' },
};

const DURATION_CHOICES = [15, 30, 45, 60, 90, 120, 180];
const REMINDER_CHOICES = [0, 10, 30, 60, 120, 1440];

function reminderLabel(minutes: number): string {
  if (minutes === 0) return 'Aucun rappel';
  if (minutes < 60) return `${minutes} min avant`;
  if (minutes === 1440) return 'La veille';
  return `${minutes / 60} h avant`;
}

export function AgendaScreen() {
  const { appointments, createAppointment, updateAppointment, setStatus, deleteAppointment } =
    useAppointments();
  const [view, setView] = useState<ViewMode>('week');
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [editing, setEditing] = useState<{ appointment: Appointment | null; at: Date } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /** Rendez-vous groupés par jour local — l'index dont dépendent les trois vues. */
  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const appointment of appointments) {
      const key = dayKey(new Date(appointment.startAt));
      const list = map.get(key);
      if (list) list.push(appointment);
      else map.set(key, [appointment]);
    }
    return map;
  }, [appointments]);

  const selected = appointments.find((a) => a.id === selectedId) ?? null;

  /*
    LES RELEVÉS DE L'EN-TÊTE, calculés sur les rendez-vous réels.

    Trois chiffres qu'on peut agir : ce qu'il reste AUJOURD'HUI, ce que porte
    la semaine affichée, et ce qui n'a pas encore été confirmé. Le dernier
    porte l'emphase — c'est le seul qui appelle un geste, et le mettre partout
    reviendrait à ne le mettre nulle part.
  */
  const releves = useMemo(() => {
    const maintenant = Date.now();
    const aujourdhui = byDay.get(dayKey(new Date())) ?? [];
    const restants = aujourdhui.filter((a) => new Date(a.startAt).getTime() >= maintenant).length;
    const semaine = weekDays(anchor).reduce((n, jour) => n + (byDay.get(dayKey(jour))?.length ?? 0), 0);
    const aConfirmer = appointments.filter(
      (a) => a.status !== 'done' && a.status !== 'cancelled' && new Date(a.startAt).getTime() >= maintenant,
    ).length;
    return [
      { label: 'Aujourd’hui', value: restants, title: 'Rendez-vous restants dans la journée' },
      { label: 'Cette semaine', value: semaine, title: 'Sur la semaine affichée' },
      { label: 'À venir', value: aConfirmer, emphasis: aConfirmer > 0 },
    ];
  }, [appointments, byDay, anchor]);

  const step = (direction: 1 | -1) => {
    if (view === 'month') setAnchor(addMonths(anchor, direction));
    else if (view === 'week') setAnchor(addDays(anchor, 7 * direction));
    else setAnchor(addDays(anchor, direction));
  };

  /*
    La capitale se pose ICI, sur la première lettre, et pas par la classe CSS
    `capitalize` : celle-ci en met une à chaque mot, ce qui donnait « Semaine
    Du 24 Août ». Voir `capitaliserPhrase`.

    La ligne « Semaine du … » commence déjà par une capitale et n'en demande
    donc aucune ; les deux autres viennent de `toLocaleDateString`, tout en
    minuscules.
  */
  const periodLabel =
    view === 'month'
      ? capitaliserPhrase(monthLabel(anchor))
      : view === 'week'
        ? `Semaine du ${weekDays(anchor)[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
        : capitaliserPhrase(longDayLabel(anchor));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        {/*
          `ScreenHeader`, comme les vingt-six écrans de l'autre édition — voir
          le même commentaire dans MediaSoloScreen. Le titre était écrit à la
          main en `text-lg`, soit 18 px contre les 22 à 24 du composant, et le
          contrôle `check:ecrans` ne regardait pas ce dossier.

          Les relevés ne sont pas décoratifs : ils disent ce que la semaine
          affichée VAUT avant qu'on ait lu une case. Ils se recalculent sur les
          rendez-vous rendus, jamais sur une constante.
        */}
        <ScreenHeader
          eyebrow="Mon espace · Agenda"
          title="Agenda"
          description="Vos rendez-vous et vos disponibilités."
          stats={releves}
          actions={
            <button
              type="button"
              onClick={() => setEditing({ appointment: null, at: defaultSlot(anchor) })}
              className="flex items-center gap-1.5 bg-accent px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
            >
              <Plus size={15} strokeWidth={2} />
              Nouveau rendez-vous
            </button>
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-surface px-3 py-2">
          {/*
            LES CIBLES DE CETTE BARRE SONT DIMENSIONNÉES POUR UN POUCE.

            Mesurées sur un écran de 390 px, les deux flèches faisaient 28×28 et
            les boutons de vue 23 px de haut — sous le minimum tenable pour un
            doigt, et cette barre est justement celle qu'on utilise le plus sur
            téléphone : c'est elle qui change de jour. Le rembourrage est donc
            généreux jusqu'à `sm`, et redevient compact à la souris, où viser
            n'a jamais été le problème.
          */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Période précédente"
              className="rounded-lg p-3 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary sm:p-1.5"
            >
              <ChevronLeft size={16} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => setAnchor(startOfDay(new Date()))}
              className="rounded-lg px-2.5 py-3 font-mono text-[10px] uppercase tracking-widest text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary sm:py-1"
            >
              Aujourd’hui
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Période suivante"
              className="rounded-lg p-3 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary sm:p-1.5"
            >
              <ChevronRight size={16} strokeWidth={2} />
            </button>
            <span className="ml-1 truncate text-sm font-medium text-text-primary">
              {periodLabel}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {(Object.keys(VIEW_LABELS) as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={`rounded-lg px-2.5 py-3 font-mono text-[10px] uppercase tracking-wider transition-colors sm:py-1 ${
                  view === mode
                    ? 'bg-accent-muted text-text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {VIEW_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>
      </header>

      {view === 'month' && (
        <MonthView
          anchor={anchor}
          byDay={byDay}
          onPickDay={(date) => {
            setAnchor(date);
            setView('day');
          }}
          onPick={setSelectedId}
        />
      )}
      {view === 'week' && (
        <WeekView
          anchor={anchor}
          byDay={byDay}
          onPick={setSelectedId}
          onCreate={(date) => setEditing({ appointment: null, at: defaultSlot(date) })}
        />
      )}
      {view === 'day' && (
        <DayView
          anchor={anchor}
          byDay={byDay}
          onPick={setSelectedId}
          onCreate={(date) => setEditing({ appointment: null, at: defaultSlot(date) })}
        />
      )}

      <AnimatePresence>
        {selected && (
          <AppointmentDetail
            key={selected.id}
            appointment={selected}
            onClose={() => setSelectedId(null)}
            onEdit={() => {
              setEditing({ appointment: selected, at: new Date(selected.startAt) });
              setSelectedId(null);
            }}
            onStatus={(status) => setStatus(selected.id, status)}
            onDelete={() => {
              deleteAppointment(selected.id);
              setSelectedId(null);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editing && (
          <AppointmentForm
            key={editing.appointment?.id ?? 'new'}
            appointment={editing.appointment}
            defaultAt={editing.at}
            onClose={() => setEditing(null)}
            onSubmit={(draft) => {
              if (editing.appointment) updateAppointment(editing.appointment.id, draft);
              else createAppointment(draft);
              setEditing(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Prochaine heure ronde du jour visé — un créneau par défaut plausible. */
function defaultSlot(date: Date): Date {
  const now = new Date();
  const slot = startOfDay(date);
  if (dayKey(date) === dayKey(now)) slot.setHours(now.getHours() + 1, 0, 0, 0);
  else slot.setHours(9, 0, 0, 0);
  return slot;
}

/* -------------------------------------------------------------------------- */
/*                                    Vues                                    */
/* -------------------------------------------------------------------------- */

function MonthView({
  anchor,
  byDay,
  onPickDay,
  onPick,
}: {
  anchor: Date;
  byDay: Map<string, Appointment[]>;
  onPickDay: (date: Date) => void;
  onPick: (id: string) => void;
}) {
  const days = monthGrid(anchor);
  return (
    <div className="border border-border bg-surface">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAY_LABELS.map((label) => (
          <span
            key={label}
            className="px-2 py-2 text-center font-mono text-[9px] uppercase tracking-widest text-text-muted"
          >
            {label}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const list = byDay.get(dayKey(day)) ?? [];
          const outside = day.getMonth() !== anchor.getMonth();
          return (
            <button
              key={dayKey(day)}
              type="button"
              onClick={() => onPickDay(day)}
              className={`flex min-h-[4.5rem] flex-col items-stretch gap-1 border-b border-r border-border/60 p-1.5 text-left transition-colors last:border-r-0 hover:bg-surface-hover sm:min-h-[6rem] ${
                outside ? 'opacity-40' : ''
              }`}
            >
              <span
                className={`self-end font-mono text-[10px] ${
                  isToday(day)
                    ? 'flex h-5 w-5 items-center justify-center rounded-full bg-accent text-bg'
                    : 'text-text-muted'
                }`}
              >
                {day.getDate()}
              </span>
              {list.slice(0, 2).map((appointment) => (
                <span
                  key={appointment.id}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPick(appointment.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation();
                      onPick(appointment.id);
                    }
                  }}
                  className={`truncate rounded bg-bg px-1 py-0.5 text-[10px] ${metaOf(STATUS_META, appointment.status, STATUS_META.scheduled).text}`}
                >
                  {timeLabel(appointment.startAt)} {appointment.title || 'Rendez-vous'}
                </span>
              ))}
              {list.length > 2 && (
                <span className="px-1 font-mono text-[9px] text-text-muted">
                  +{list.length - 2} autre{list.length - 2 > 1 ? 's' : ''}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  anchor,
  byDay,
  onPick,
  onCreate,
}: {
  anchor: Date;
  byDay: Map<string, Appointment[]>;
  onPick: (id: string) => void;
  onCreate: (date: Date) => void;
}) {
  const days = weekDays(anchor);
  const lists = days.map((day) => byDay.get(dayKey(day)) ?? []);
  const total = lists.reduce((sum, list) => sum + list.length, 0);
  const freeDays = lists.filter((list) => list.length === 0).length;

  /*
    UNE LIGNE POUR LA SEMAINE, À LA PLACE DE SEPT ABSENCES.

    « Rien de prévu » répété sept fois n'apprend rien et pèse beaucoup. Une
    phrase à l'échelle de la SEMAINE apprend quelque chose : combien de
    rendez-vous, et combien de jours restent libres. C'est la même information
    que sept absences, dite une fois et de façon utilisable.

    Elle est calculée sur les rendez-vous affichés, à chaque rendu — comme tous
    les relevés de cette refonte.
  */
  const résumé =
    total === 0
      ? 'Semaine libre — sept jours ouverts.'
      : `${total} rendez-vous cette semaine${freeDays > 0 ? ` · ${freeDays} jour${freeDays > 1 ? 's' : ''} libre${freeDays > 1 ? 's' : ''}` : ' · aucun jour libre'}`;

  return (
    <div className="flex flex-col gap-3">
      <p className="eyebrow">{résumé}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((day, index) => (
          <DayColumn
            key={dayKey(day)}
            day={day}
            appointments={lists[index]}
            onPick={onPick}
            onCreate={onCreate}
          />
        ))}
      </div>
    </div>
  );
}

function DayView({
  anchor,
  byDay,
  onPick,
  onCreate,
}: {
  anchor: Date;
  byDay: Map<string, Appointment[]>;
  onPick: (id: string) => void;
  onCreate: (date: Date) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <DayColumn
        day={anchor}
        appointments={byDay.get(dayKey(anchor)) ?? []}
        onPick={onPick}
        onCreate={onCreate}
        expanded
      />
    </div>
  );
}

/**
 * UNE COLONNE DE JOUR, ET LE VIDE (BLOC A)
 *
 * Le défaut signalé, mot pour mot : « une semaine avec sept colonnes "Rien de
 * prévu" côte à côte donne une impression de vide anxiogène, pas de calme ».
 * Il était exact, et il venait de trois choix qui, chacun isolément, semblaient
 * raisonnables :
 *
 *   1. chaque jour était une CARTE — bordure, fond, hauteur minimale — qu'il
 *      contienne quelque chose ou non. Sept boîtes vides pèsent plus lourd à
 *      l'œil que sept absences ;
 *   2. le vide était NOMMÉ, sept fois de suite. « Rien de prévu » écrit une
 *      fois informe ; écrit sept fois, il matraque ;
 *   3. chaque jour portait un bouton « Ajouter » permanent, donc une semaine
 *      calme affichait sept invitations identiques et aucune information.
 *
 * Ce qui change ici, et rien d'autre — pas de décoration ajoutée :
 *
 *   · un jour VIDE n'est plus un objet. Pas de bordure, pas de fond : il
 *     redevient du sol. Une semaine à deux rendez-vous se lit alors comme deux
 *     choses posées sur un calendrier, et non comme sept boîtes dont deux sont
 *     remplies ;
 *   · le vide n'est plus nommé. L'absence se voit ; l'écrire n'ajoute rien ;
 *   · le geste d'ajout reste, mais discret sur un jour vide (il apparaît au
 *     survol et au focus). Il reste atteignable au clavier — une invitation qui
 *     n'existe qu'à la souris exclut.
 *
 * La vue JOUR garde sa carte : il n'y a qu'une colonne, donc aucune répétition,
 * et le cadre y aide à situer la journée.
 */
function DayColumn({
  day,
  appointments,
  onPick,
  onCreate,
  expanded = false,
}: {
  day: Date;
  appointments: Appointment[];
  onPick: (id: string) => void;
  onCreate: (date: Date) => void;
  expanded?: boolean;
}) {
  const empty = appointments.length === 0;
  // Un jour vide de la vue SEMAINE redevient du sol. Ailleurs (vue jour, ou
  // jour rempli), la carte garde son rôle : délimiter un contenu.
  const asGround = empty && !expanded;

  return (
    <div
      className={`group/day flex flex-col ${
        asGround
          ? 'border border-transparent'
          : `border bg-surface ${isToday(day) ? 'border-border-strong' : 'border-border'}`
      }`}
    >
      <div
        className={`flex items-center justify-between px-2.5 py-2 ${
          asGround ? '' : 'border-b border-border'
        }`}
      >
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
          {WEEKDAY_LABELS[(day.getDay() + 6) % 7]}
        </span>
        <span
          className={`font-mono text-[11px] ${
            isToday(day)
              ? 'flex h-5 w-5 items-center justify-center rounded-full bg-accent text-bg'
              : 'text-text-secondary'
          }`}
        >
          {day.getDate()}
        </span>
      </div>

      {!empty && (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="flex flex-col divide-y divide-border/60"
        >
          {appointments.map((appointment) => (
            <motion.button
              key={appointment.id}
              variants={staggerItem}
              type="button"
              onClick={() => onPick(appointment.id)}
              className="flex flex-col items-start gap-0.5 px-2.5 py-2 text-left transition-colors hover:bg-surface-hover"
            >
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-text-muted">
                <span className={`h-1.5 w-1.5 rounded-full ${metaOf(STATUS_META, appointment.status, STATUS_META.scheduled).dot}`} />
                {timeLabel(appointment.startAt)} – {timeLabel(appointmentEnd(appointment).toISOString())}
              </span>
              <span className={`text-sm font-medium ${metaOf(STATUS_META, appointment.status, STATUS_META.scheduled).text}`}>
                {appointment.title || 'Rendez-vous'}
              </span>
              {appointment.clientName && (
                <span className="truncate font-mono text-[10px] text-text-secondary">
                  {appointment.clientName}
                </span>
              )}
            </motion.button>
          ))}
        </motion.div>
      )}

      <button
        type="button"
        onClick={() => onCreate(day)}
        aria-label={`Ajouter un rendez-vous le ${day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`}
        className={`flex items-center justify-center gap-1 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest transition-colors hover:bg-surface-hover hover:text-text-primary ${
          asGround
            ? // Discret sur un jour vide : présent, atteignable au clavier, mais
              // il ne réclame pas l'attention sept fois de suite.
              'text-transparent group-hover/day:text-text-muted focus-visible:text-text-primary'
            : 'border-t border-border text-text-muted'
        }`}
      >
        <Plus size={11} strokeWidth={2} />
        Ajouter
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Détail                                   */
/* -------------------------------------------------------------------------- */

function AppointmentDetail({
  appointment,
  onClose,
  onEdit,
  onStatus,
  onDelete,
}: {
  appointment: Appointment;
  onClose: () => void;
  onEdit: () => void;
  onStatus: (status: AppointmentStatus) => void;
  onDelete: () => void;
}) {
  const start = new Date(appointment.startAt);
  return (
    <Overlay onClose={onClose} labelledBy="rdv-detail-title">
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
        <div className="min-w-0">
          <h2 id="rdv-detail-title" className="truncate text-base font-semibold text-text-primary">
            {appointment.title || 'Rendez-vous'}
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            <span>{capitaliserPhrase(longDayLabel(start))}</span> · {timeLabel(appointment.startAt)} –{' '}
            {timeLabel(appointmentEnd(appointment).toISOString())}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="-m-2 flex h-9 w-9 items-center justify-center p-2 text-text-secondary hover:text-text-primary"
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <div className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary">
            <span className={`h-1.5 w-1.5 rounded-full ${metaOf(STATUS_META, appointment.status, STATUS_META.scheduled).dot}`} />
            {metaOf(STATUS_META, appointment.status, STATUS_META.scheduled).label}
          </span>
          <span className="flex items-center gap-1.5 border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary">
            {appointment.reminderMin > 0 ? <Bell size={11} /> : <BellOff size={11} />}
            {reminderLabel(appointment.reminderMin)}
          </span>
        </div>

        {appointment.clientName && (
          <p className="flex items-center gap-2 text-sm text-text-secondary">
            <Contact size={14} strokeWidth={1.75} className="text-text-muted" />
            {appointment.clientName}
            {appointment.clientId === null && (
              <span className="font-mono text-[10px] text-text-muted">(rendez-vous libre)</span>
            )}
          </p>
        )}
        {appointment.location && (
          <p className="flex items-center gap-2 text-sm text-text-secondary">
            <MapPin size={14} strokeWidth={1.75} className="text-text-muted" />
            {appointment.location}
          </p>
        )}
        {appointment.notes && (
          <p className="whitespace-pre-wrap border-l-2 border-border pl-3 text-sm text-text-secondary">
            {appointment.notes}
          </p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-2">
          {appointment.status !== 'done' && (
            <button
              type="button"
              onClick={() => onStatus('done')}
              className="flex items-center gap-1.5 border border-border px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <Check size={13} strokeWidth={2} /> Marquer terminé
            </button>
          )}
          {appointment.status !== 'cancelled' && (
            <button
              type="button"
              onClick={() => onStatus('cancelled')}
              className="flex items-center gap-1.5 border border-border px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <X size={13} strokeWidth={2} /> Annuler
            </button>
          )}
          {appointment.status !== 'scheduled' && (
            <button
              type="button"
              onClick={() => onStatus('scheduled')}
              className="flex items-center gap-1.5 border border-border px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <Clock size={13} strokeWidth={2} /> Remettre au programme
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 border border-border px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <Pencil size={13} strokeWidth={2} /> Modifier
          </button>
          <span className="ml-auto">
            <ConfirmDelete onConfirm={onDelete} label="Supprimer le rendez-vous" />
          </span>
        </div>
      </div>
    </Overlay>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Formulaire                                 */
/* -------------------------------------------------------------------------- */

function AppointmentForm({
  appointment,
  defaultAt,
  onClose,
  onSubmit,
}: {
  appointment: Appointment | null;
  defaultAt: Date;
  onClose: () => void;
  onSubmit: (draft: AppointmentDraft) => void;
}) {
  const { clients } = useClients();
  const [title, setTitle] = useState(appointment?.title ?? '');
  const [startValue, setStartValue] = useState(
    toDateTimeLocalValue(appointment ? new Date(appointment.startAt) : defaultAt),
  );
  const [durationMin, setDurationMin] = useState(appointment?.durationMin ?? 60);
  // '' = rendez-vous libre. Le nom saisi à la main sert alors d'intitulé.
  const [clientId, setClientId] = useState<string>(
    appointment?.clientId != null ? String(appointment.clientId) : '',
  );
  const [freeName, setFreeName] = useState(
    appointment && appointment.clientId === null ? appointment.clientName : '',
  );
  const [location, setLocation] = useState(appointment?.location ?? '');
  const [notes, setNotes] = useState(appointment?.notes ?? '');
  const [reminderMin, setReminderMin] = useState(appointment?.reminderMin ?? 30);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError('Donnez un intitulé au rendez-vous.');
      return;
    }
    if (!startValue) {
      setError('Choisissez une date et une heure.');
      return;
    }
    const linked = clientId ? clients.find((c) => String(c.id) === clientId) : undefined;
    onSubmit({
      title: title.trim(),
      startAt: fromDateTimeLocalValue(startValue),
      durationMin,
      clientId: linked ? linked.id : null,
      clientName: linked ? linked.name : freeName.trim(),
      location: location.trim(),
      notes: notes.trim(),
      reminderMin,
    });
  };

  return (
    <Overlay onClose={onClose} labelledBy="rdv-form-title">
      <form onSubmit={submit}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2
            id="rdv-form-title"
            className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary"
          >
            <CalendarDays size={14} strokeWidth={1.75} />
            {appointment ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="-m-2 flex h-9 w-9 items-center justify-center p-2 text-text-secondary hover:text-text-primary"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col gap-3 p-5">
          <Field label="Intitulé *">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="ex. Séance de suivi"
              className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Début *">
              <input
                type="datetime-local"
                value={startValue}
                onChange={(e) => setStartValue(e.target.value)}
                className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
              />
            </Field>
            <Field label="Durée">
              <select
                value={durationMin}
                onChange={(e) => setDurationMin(Number(e.target.value))}
                className="input-focus cursor-pointer border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
              >
                {DURATION_CHOICES.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes < 60 ? `${minutes} min` : `${minutes / 60} h`}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Client">
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="input-focus cursor-pointer border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            >
              <option value="">Rendez-vous libre (sans fiche client)</option>
              {clients.map((client) => (
                <option key={client.id} value={String(client.id)}>
                  {client.name}
                  {client.company ? ` — ${client.company}` : ''}
                </option>
              ))}
            </select>
          </Field>

          {/* Un rendez-vous libre garde quand même un nom : « Mme Dupont »
              vaut mieux qu'une ligne anonyme dans l'agenda de la semaine. */}
          {!clientId && (
            <Field label="Avec qui (optionnel)">
              <input
                value={freeName}
                onChange={(e) => setFreeName(e.target.value)}
                placeholder="ex. Mme Dupont"
                className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
              />
            </Field>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Lieu (optionnel)">
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="ex. À l’atelier, visio…"
                className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
              />
            </Field>
            <Field label="Rappel">
              <select
                value={reminderMin}
                onChange={(e) => setReminderMin(Number(e.target.value))}
                className="input-focus cursor-pointer border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
              >
                {REMINDER_CHOICES.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {reminderLabel(minutes)}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Notes (optionnel)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="input-focus resize-none border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            />
          </Field>

          {error && (
            <p role="alert" className="border border-danger/40 bg-danger-muted px-3 py-2 font-mono text-xs text-danger">
              {error}
            </p>
          )}

          <div className="mt-1 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="border border-border px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="bg-accent px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
            >
              {appointment ? 'Enregistrer' : 'Créer le rendez-vous'}
            </button>
          </div>
        </div>
      </form>
    </Overlay>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{label}</span>
      {children}
    </label>
  );
}

/** Feuille montante sur mobile, boîte centrée sur écran large — comme le lanceur. */
function Overlay({
  children,
  onClose,
  labelledBy,
}: {
  children: React.ReactNode;
  onClose: () => void;
  labelledBy: string;
}) {
  // Échap ferme, comme partout ailleurs. Voir lib/useFermetureEchap.
  useFermetureEchap(true, onClose);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-[2px]"
        aria-hidden
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        initial={{ opacity: 0, y: 24, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.99 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-x-0 bottom-0 z-[71] max-h-[88vh] overflow-y-auto rounded-t-3xl border border-border-strong bg-surface sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85vh] sm:w-[min(34rem,calc(100vw-3rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg"
      >
        {children}
      </motion.div>
    </>
  );
}
