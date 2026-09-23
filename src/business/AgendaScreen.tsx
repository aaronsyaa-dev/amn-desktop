import React, { useEffect, useMemo, useState } from 'react';
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
  capitaliserPhrase,
  dayKey,
  fromDateTimeLocalValue,
  isSameDay,
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

/*
  LES TROIS VUES ONT FUSIONNÉ EN DEUX ÉCHELLES.

  `ViewMode` et son sélecteur mois / semaine / jour ont disparu : le plan à
  deux échelles (`PlanDuMois`) porte le mois ET la semaine dans une seule
  carte, et la journée est en dessous, toujours visible. Il n'y a plus de
  mode à choisir, donc plus d'état à se rappeler ni de vue où l'on se perd.
  Voir l'en-tête de `PlanDuMois` pour ce qui a été repris et ce qui ne l'a
  pas été.
*/

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
  /*
    LA JOURNÉE EST LA VUE D'OUVERTURE.

    L'écran s'ouvrait sur la semaine. C'est la vue qui sert à ORGANISER, et
    elle garde tout son sens — mais la question du matin n'est pas « comment
    s'agence ma semaine », c'est « qu'est-ce que je fais maintenant ». La table
    du paquet de design nomme d'ailleurs « la journée » comme objet dominant de
    cet écran, et c'est elle qui porte désormais la colonne d'heures et le
    créneau en cours. La semaine reste à un clic.
  */
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

  /* Les flèches déplacent le JOUR ; le mois et la semaine du plan suivent
     l'ancre, puisqu'ils sont deux échelles de la même date. */
  const step = (direction: 1 | -1) => setAnchor(addDays(anchor, direction));

  /*
    La capitale se pose ICI, sur la première lettre, et pas par la classe CSS
    `capitalize` : celle-ci en met une à chaque mot, ce qui donnait « Semaine
    Du 24 Août ». Voir `capitaliserPhrase`.

    La ligne « Semaine du … » commence déjà par une capitale et n'en demande
    donc aucune ; les deux autres viennent de `toLocaleDateString`, tout en
    minuscules.
  */
  const periodLabel = capitaliserPhrase(longDayLabel(anchor));

  /*
    LA PHRASE SOUS LE TITRE, écrite avec les vrais rendez-vous du jour.

    « Vos rendez-vous et vos disponibilités » décrivait le module. Sur la vue
    jour, la phrase dit maintenant ce que la journée PÈSE — combien de
    rendez-vous, combien d'heures occupées — et dans combien de temps tombe le
    prochain. Les deux autres vues gardent la phrase descriptive : sur un mois,
    « le prochain dans 48 minutes » ne veut rien dire.
  */
  const resumeDeLaPeriode = useMemo(() => {
    const duJour = (byDay.get(dayKey(anchor)) ?? []).filter((a) => a.status !== 'cancelled');
    if (duJour.length === 0) return 'Rien de prévu ce jour-là.';
    const minutes = duJour.reduce((n, a) => n + a.durationMin, 0);
    const morceaux = [
      `${duJour.length} rendez-vous`,
      `${dureeLisible(minutes)} occupée${minutes >= 120 ? 's' : ''}`,
    ];
    const prochain = duJour
      .filter((a) => new Date(a.startAt).getTime() >= Date.now())
      .sort((a, b) => a.startAt.localeCompare(b.startAt))[0];
    if (prochain) {
      const dans = Math.round((new Date(prochain.startAt).getTime() - Date.now()) / 60_000);
      morceaux.push(dans <= 0 ? 'le prochain a commencé' : `le prochain dans ${dureeLisible(dans)}`);
    }
    return `${capitaliserPhrase(morceaux.join(', '))}.`;
  }, [byDay, anchor]);

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
        {/*
          LE TITRE EST LA PÉRIODE, pas le nom du module.

          « Agenda » est déjà écrit dans le surtitre et dans la barre latérale ;
          l'écrire une troisième fois en gros ne dit rien de plus. Ce qu'on a
          besoin de lire en grand, c'est QUEL JOUR on regarde — c'est la seule
          information de l'écran qui change à chaque visite.
        */}
        <ScreenHeader
          eyebrow="Mon espace · Agenda"
          title={periodLabel}
          description={resumeDeLaPeriode}
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
          {/*
            `gap-2` : ces trois commandes font 40 px et se suivaient à 4 px.
            Voir `docs/PRINCIPE-CONFORT.md` — sous 44 px, une cible a besoin
            d'un vrai écart, et « précédent » et « suivant » se ressemblent
            assez pour qu'on se trompe de sens sans le voir.
          */}
          <div className="flex min-w-0 max-w-full items-center gap-2">
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
            <span className="ml-1 min-w-0 truncate text-sm font-medium text-text-primary">
              {periodLabel}
            </span>
          </div>

        </div>
      </header>

      {/* L'OBJET DOMINANT (`24b`) : le mois en densité et la semaine
          détachée, deux échelles dans une seule carte. */}
      <PlanDuMois anchor={anchor} byDay={byDay} onPickDay={setAnchor} onPick={setSelectedId} />

      {/* AUTOUR — à gauche la journée, à droite ce que le mois pèse. */}
      <DayView
        anchor={anchor}
        byDay={byDay}
        onPick={setSelectedId}
        onCreate={(date) => setEditing({ appointment: null, at: defaultSlot(date) })}
      />

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

/* -------------------------------------------------------------------------- */
/*          LE PLAN — deux échelles dans une seule carte (`24b`)               */
/* -------------------------------------------------------------------------- */

/*
  DEUX MAILLES DU MÊME OBJET, ET C'EST POUR ÇA QU'ELLES NE SE SÉPARENT PAS.

  En haut le MOIS EN DENSITÉ : sept colonnes, et la clarté de chaque case est
  le nombre d'heures prises ce jour-là. On n'y lit pas des rendez-vous, on y
  lit une CHARGE — où le mois est plein, où il est creux. En bas la SEMAINE
  DÉTACHÉE, à l'échelle des heures, avec les blocs à leur vraie position sur
  08 → 20.

  `MODULES.md` insiste : les deux vivent dans la même carte dominante. Séparer
  en deux cartes ferait deux objets qui se regardent, alors que la semaine est
  un agrandissement du mois — on zoome, on ne change pas de sujet.

  CE QUI A ÉTÉ REMPLACÉ, et pourquoi ce n'est pas une perte de fonction.
  L'écran portait trois vues : mois, semaine, jour. La grille du mois listait
  deux rendez-vous par case puis « +3 autres » — une liste tronquée qui ne
  répond ni à « qu'est-ce que je fais » ni à « quand suis-je chargé ». La vue
  semaine était sept listes côte à côte, qui ne disaient pas non plus à quelle
  heure la semaine se remplit. Les deux sont ici, mieux : la densité répond à
  la charge du mois, la semaine détachée à la forme des journées, et un clic
  sur n'importe quelle case ou n'importe quel bloc mène au jour ou au
  rendez-vous. Ce qui disparaît vraiment est la création d'un rendez-vous
  depuis une case de semaine ; elle reste au bouton d'en-tête et dans la
  colonne d'heures du jour, qui est l'endroit où l'on choisit une heure.
*/

/** Les quatre paliers de densité, du plus creux au plus chargé. */
const PALIERS_DENSITE = ['var(--color-border)', '#2b2b2b', 'var(--color-border-strong)', '#4a4a48'];
/** Bornes en HEURES prises dans la journée. Au-delà du dernier, dernier palier. */
const BORNES_DENSITE = [2, 4, 6];
const POINTS_DENSITE_MAX = 4;

/** Hauteur d'une colonne de la semaine détachée, en pixels. */
const SEMAINE_H = 118;
const SEMAINE_DEBUT = 8;
const SEMAINE_FIN = 20;

/** Heures occupées un jour donné — les annulés ne prennent pas de place. */
function heuresPrises(liste: Appointment[]): number {
  return liste
    .filter((a) => a.status !== 'cancelled')
    .reduce((n, a) => n + a.durationMin, 0) / 60;
}

/** Le palier de densité d'une journée : 0 = rien de pris. */
function palierDe(heures: number): number {
  if (heures <= 0) return 0;
  for (let i = 0; i < BORNES_DENSITE.length; i += 1) {
    if (heures < BORNES_DENSITE[i]) return i + 1;
  }
  return PALIERS_DENSITE.length;
}

function PlanDuMois({
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
  const cases = monthGrid(anchor);
  const semaine = weekDays(anchor);
  const aujourdHuiDansLaSemaine = semaine.some((d) => isToday(d));

  return (
    <section className="panel-raised panel-raised-wide p-5 sm:p-6">
      {/* ── LE MOIS EN DENSITÉ ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="eyebrow">{capitaliserPhrase(monthLabel(anchor))} · la charge</p>
        <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-text-muted">
          plus la case est claire, plus la journée est prise
        </p>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <span
            key={label}
            className="pb-1 text-center font-mono text-[9px] uppercase tracking-widest text-text-muted"
          >
            {label}
          </span>
        ))}
        {cases.map((jour) => {
          const liste = byDay.get(dayKey(jour)) ?? [];
          const vivants = liste.filter((a) => a.status !== 'cancelled');
          const palier = palierDe(heuresPrises(liste));
          const dehors = jour.getMonth() !== anchor.getMonth();
          return (
            <button
              key={dayKey(jour)}
              type="button"
              onClick={() => onPickDay(jour)}
              title={`${longDayLabel(jour)} · ${vivants.length} rendez-vous · ${dureeLisible(Math.round(heuresPrises(liste) * 60))}`}
              className={`flex h-12 flex-col items-center justify-center gap-1 border transition-colors hover:border-border-strong ${
                isSameDay(jour, anchor) ? 'border-text-secondary' : 'border-transparent'
              } ${dehors ? 'opacity-35' : ''}`}
              style={{ background: palier === 0 ? 'var(--color-sunken)' : PALIERS_DENSITE[palier - 1] }}
            >
              <span
                className={`tnum font-mono text-[10px] leading-none ${
                  palier >= 3 ? 'text-text-body' : 'text-text-muted'
                }`}
              >
                {jour.getDate()}
              </span>
              {/* LES PASTILLES — elles COMPTENT les rendez-vous, là où la
                  clarté du fond pèse les heures. Deux informations
                  différentes : trois quarts d'heure en trois fois ne
                  remplissent pas une journée mais la hachent. */}
              <span aria-hidden className="flex h-1 items-center gap-0.5">
                {Array.from({ length: Math.min(POINTS_DENSITE_MAX, vivants.length) }, (_, i) => (
                  <span
                    key={i}
                    className={`h-1 w-1 rounded-full ${palier >= 3 ? 'bg-bg' : 'bg-text-muted'}`}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── LA SEMAINE DÉTACHÉE ────────────────────────────────────────── */}
      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-border-row pt-5">
        <p className="eyebrow">
          La semaine du {semaine[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
        </p>
        <p className="tnum font-mono text-[9.5px] uppercase tracking-[0.2em] text-text-muted">
          {SEMAINE_DEBUT} h → {SEMAINE_FIN} h
        </p>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {semaine.map((jour) => {
          const liste = (byDay.get(dayKey(jour)) ?? []).filter((a) => a.status !== 'cancelled');
          const courant = isToday(jour);
          return (
            <div key={dayKey(jour)} className="min-w-0">
              {/*
                LA COLONNE — les blocs sont posés en POURCENTAGE de sa
                hauteur, jamais en pixels : la colonne est fluide en largeur
                comme en hauteur, et un bloc calé au pixel serait juste à une
                seule taille de fenêtre.
              */}
              <div
                className={`relative w-full overflow-hidden border ${
                  courant ? 'border-signal' : 'border-border'
                }`}
                style={{ height: SEMAINE_H, background: 'var(--color-sunken)' }}
                data-signal-groupe={courant ? 'maintenant' : undefined}
              >
                {liste.map((a) => {
                  const d = new Date(a.startAt);
                  const debutH = d.getHours() + d.getMinutes() / 60;
                  const haut = ((debutH - SEMAINE_DEBUT) / (SEMAINE_FIN - SEMAINE_DEBUT)) * 100;
                  const hauteur = (a.durationMin / 60 / (SEMAINE_FIN - SEMAINE_DEBUT)) * 100;
                  /* Un rendez-vous hors de la plage dessinée est ramené à son
                     bord, jamais coupé : il existe, et la colonne doit le
                     dire. */
                  const top = Math.max(0, Math.min(100, haut));
                  const h = Math.max(2.5, Math.min(100 - top, hauteur));
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onPick(a.id)}
                      title={`${timeLabel(a.startAt)} · ${a.title || 'Rendez-vous'}`}
                      className={`absolute inset-x-0.5 overflow-hidden px-1 text-left ${
                        courant ? 'bg-signal' : 'bg-border-strong'
                      }`}
                      style={{ top: `${top}%`, height: `${h}%` }}
                    >
                      <span
                        className={`block truncate font-mono text-[9px] leading-[1.4] ${
                          courant ? 'text-signal-ink' : 'text-text-body'
                        }`}
                      >
                        {timeLabel(a.startAt)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => onPickDay(jour)}
                className={`mt-1.5 block w-full truncate text-center font-mono text-[9.5px] uppercase tracking-[0.12em] ${
                  courant ? 'text-signal' : 'text-text-muted hover:text-text-primary'
                }`}
                data-signal-groupe={courant ? 'maintenant' : undefined}
              >
                {WEEKDAY_LABELS[(jour.getDay() + 6) % 7]} {jour.getDate()}
              </button>
            </div>
          );
        })}
      </div>

      {!aujourdHuiDansLaSemaine && (
        <p className="mt-3 text-[12.5px] leading-relaxed text-text-muted">
          Aujourd’hui n’est pas dans cette semaine : aucune colonne n’est désignée.
        </p>
      )}
    </section>
  );
}

/*
  CE QUI ENTOURE LE PLAN — à gauche la journée, à droite ce que le mois pèse.

  Le mini-mois qui tenait cette colonne a disparu : la densité du plan est le
  même mois, en mieux, et deux calendriers sur un écran obligent à vérifier
  qu'ils disent la même chose.
*/
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
  const duJour = byDay.get(dayKey(anchor)) ?? [];
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <ColonneDHeures day={anchor} appointments={duJour} onPick={onPick} onCreate={onCreate} />
      <div className="flex flex-col gap-5">
        <CarteDuMois anchor={anchor} byDay={byDay} />
        <CarteDeRappel appointments={duJour} />
      </div>
    </div>
  );
}

/**
 * Ce que le mois pèse : rendez-vous, jour le plus chargé, jours vides.
 *
 * Les trois chiffres sortent des MÊMES cases que la densité du plan — ils
 * comptent ce qui est dessiné, et un jour annulé n'y pèse rien nulle part.
 */
function CarteDuMois({ anchor, byDay }: { anchor: Date; byDay: Map<string, Appointment[]> }) {
  const bilan = useMemo(() => {
    const jours = monthGrid(anchor).filter((d) => d.getMonth() === anchor.getMonth());
    let total = 0;
    let vides = 0;
    let plusCharge: { jour: Date; heures: number } | null = null;
    for (const jour of jours) {
      const liste = (byDay.get(dayKey(jour)) ?? []).filter((a) => a.status !== 'cancelled');
      total += liste.length;
      if (liste.length === 0) vides += 1;
      const heures = heuresPrises(liste);
      if (!plusCharge || heures > plusCharge.heures) plusCharge = { jour, heures };
    }
    return { total, vides, plusCharge: plusCharge && plusCharge.heures > 0 ? plusCharge : null };
  }, [anchor, byDay]);

  return (
    <section className="panel p-4 sm:p-5">
      <p className="eyebrow">{capitaliserPhrase(monthLabel(anchor))}</p>
      <p className="tnum mt-2 text-[27px] font-semibold leading-none text-text-primary">
        {bilan.total}
      </p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">
        rendez-vous dans le mois
      </p>
      <dl className="mt-4 flex flex-col gap-2 border-t border-border-row pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            jour le plus chargé
          </dt>
          <dd className="tnum text-right font-mono text-[12px] text-text-primary">
            {bilan.plusCharge
              ? `${bilan.plusCharge.jour.getDate()} · ${dureeLisible(Math.round(bilan.plusCharge.heures * 60))}`
              : '—'}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            jours vides
          </dt>
          <dd className="tnum font-mono text-[12px] text-text-secondary">{bilan.vides}</dd>
        </div>
      </dl>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*                     LA JOURNÉE — colonne d'heures                          */
/* -------------------------------------------------------------------------- */

/*
  L'EN-TÊTE DE CE FICHIER DISAIT : « si un jour un vrai quadrillage est
  souhaité, seule DayColumn change ». C'est ce jour-là, et c'est bien ce qui
  change — la vue JOUR seulement.

  Ses objections tenaient, et tiennent toujours, pour la vue SEMAINE : sept
  colonnes au pixel gèrent mal les chevauchements et deviennent illisibles sur
  un téléphone. Sur UNE journée, aucune des trois ne s'applique : il y a la
  place, les chevauchements se voient au lieu de se cacher, et c'est
  précisément ce que la table du paquet de design demande — « la journée »
  comme objet dominant, sur une colonne d'heures.

  Semaine et mois gardent donc leurs listes, intactes.
*/

/** Hauteur d'une heure, en pixels. Une demi-heure reste donc visible à 27 px. */
const HAUTEUR_HEURE = 54;

/**
 * Les bornes de la journée dessinée.
 *
 * Huit heures à dix-neuf heures par défaut — la journée ouvrable — mais
 * ÉLARGIES par les rendez-vous réels : un passage à sept heures ou une
 * livraison à vingt-et-une heures doit apparaître, sinon la colonne ment par
 * omission. C'est la seule règle ici qui ne soit pas cosmétique.
 */
function bornesDuJour(appointments: Appointment[]): { debut: number; fin: number } {
  let debut = 8;
  let fin = 19;
  for (const a of appointments) {
    const d = new Date(a.startAt);
    const f = appointmentEnd(a);
    debut = Math.min(debut, d.getHours());
    fin = Math.max(fin, f.getMinutes() > 0 ? f.getHours() + 1 : f.getHours());
  }
  return { debut, fin: Math.max(fin, debut + 1) };
}

function ColonneDHeures({
  day,
  appointments,
  onPick,
  onCreate,
}: {
  day: Date;
  appointments: Appointment[];
  onPick: (id: string) => void;
  onCreate: (date: Date) => void;
}) {
  const { debut, fin } = useMemo(() => bornesDuJour(appointments), [appointments]);
  const heures = useMemo(
    () => Array.from({ length: fin - debut }, (_, i) => debut + i),
    [debut, fin],
  );

  /*
    L'HEURE COURANTE, RAFRAÎCHIE À LA MINUTE.

    Sans horloge, le trait resterait figé à l'heure du montage — et cet écran
    reste ouvert toute la journée, c'est même sa vocation. Une minute suffit :
    la position ne bouge que d'un pixel entre deux battements.
  */
  const [maintenant, setMaintenant] = useState(() => new Date());
  useEffect(() => {
    const battement = setInterval(() => setMaintenant(new Date()), 60_000);
    return () => clearInterval(battement);
  }, []);

  const aujourdhui = isToday(day);
  const minutesDe = (d: Date) => (d.getHours() - debut) * 60 + d.getMinutes();
  const dansLaFenetre = (m: number) => m >= 0 && m <= (fin - debut) * 60;
  const minutesMaintenant = minutesDe(maintenant);

  return (
    <div className="panel relative flex">
      {/* La règle des heures. */}
      <div className="w-[52px] flex-shrink-0 border-r border-border">
        {heures.map((h) => (
          <div key={h} style={{ height: HAUTEUR_HEURE }} className="relative">
            <span className="absolute -top-[7px] right-2.5 font-mono text-[11px] tracking-[0.1em] text-text-muted">
              {String(h).padStart(2, '0')}
            </span>
          </div>
        ))}
      </div>

      {/* Le plan des rendez-vous. */}
      <div className="relative min-w-0 flex-1">
        {heures.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => {
              const creneau = startOfDay(day);
              creneau.setHours(h, 0, 0, 0);
              onCreate(creneau);
            }}
            aria-label={`Ajouter un rendez-vous à ${String(h).padStart(2, '0')} h`}
            style={{ height: HAUTEUR_HEURE }}
            /* Chaque heure vide est une cible d'ajout : c'est le geste le plus
               naturel sur un agenda, et il n'existait nulle part — il fallait
               passer par le bouton d'en-tête puis ressaisir l'heure. */
            className="block w-full border-b border-[#161616] transition-colors last:border-b-0 hover:bg-surface-hover"
          />
        ))}

        {appointments.map((a) => {
          const d = new Date(a.startAt);
          const meta = metaOf(STATUS_META, a.status, STATUS_META.scheduled);
          const haut = (minutesDe(d) / 60) * HAUTEUR_HEURE;
          /* Vingt-deux pixels de plancher : un rendez-vous de quinze minutes
             doit rester lisible, même s'il ment alors légèrement sur sa durée
             — la durée est écrite en toutes lettres à droite. */
          const hauteur = Math.max(22, (a.durationMin / 60) * HAUTEUR_HEURE);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onPick(a.id)}
              style={{ top: haut, height: hauteur }}
              className="absolute inset-x-2 flex flex-col justify-start overflow-hidden border-l-2 border-l-border-strong bg-raised px-3 py-1.5 text-left transition-colors hover:bg-surface-hover"
            >
              <span className="flex w-full items-baseline gap-2.5">
                <span className="tnum flex-shrink-0 font-mono text-[12.5px] text-text-secondary">
                  {timeLabel(a.startAt)}
                </span>
                <span className={`min-w-0 flex-1 truncate text-[14.5px] font-semibold ${meta.text}`}>
                  {a.title || 'Rendez-vous'}
                </span>
                <span className="eyebrow flex-shrink-0">{dureeLisible(a.durationMin)}</span>
              </span>
              {(a.clientName || a.location) && hauteur > 34 && (
                <span className="eyebrow mt-1.5 truncate">
                  {[a.clientName, a.location].filter(Boolean).join(' · ')}
                </span>
              )}
            </button>
          );
        })}

        {/*
          LE CRÉNEAU EN COURS — l'ambre de cet écran, et le seul.

          La table du paquet le nomme ainsi. Contrairement à la ligne du jour
          d'une frise de projets, qui n'est qu'un repère, l'heure qu'il est sur
          un agenda EST la décision : c'est elle qui dit si le prochain
          rendez-vous est dans quarante-huit minutes ou déjà commencé. Le trait
          et la pastille disent la même chose, d'où le groupe — et la colonne
          du jour, dans la frise de la semaine au-dessus, le dit aussi : c'est
          le même « maintenant » vu à deux échelles, un seul objet ambre.
        */}
        {aujourdhui && dansLaFenetre(minutesMaintenant) && (
          <span
            className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
            style={{ top: (minutesMaintenant / 60) * HAUTEUR_HEURE }}
            data-signal-groupe="maintenant"
            aria-hidden
          >
            <span className="signal-plate -ml-[52px] w-[52px] flex-shrink-0 py-[3px] text-center font-mono text-[10px] font-bold tracking-[0.05em]">
              {timeLabel(maintenant.toISOString())}
            </span>
            <span className="h-px flex-1 bg-signal" />
          </span>
        )}
      </div>
    </div>
  );
}

/** « 1 h 30 », « 45 min » — la durée telle qu'on la dit, pas en minutes brutes. */
function dureeLisible(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const reste = minutes % 60;
  return reste === 0 ? `${h} h` : `${h} h ${reste}`;
}

/**
 * LE MINI-MOIS — se repérer sans quitter la journée.
 *
 * Il ne remplace pas la vue mois : il dit où l'on est dans le mois et quels
 * jours portent quelque chose (un point sous le chiffre), pour qu'on saute au
 * 12 sans passer par « mois », cliquer, puis « jour ».
 */
/*
  `MiniMois` a été retiré ici, et non laissé « au cas où ».

  Il rendait un calendrier réduit dans la colonne de droite. Le plan à deux
  échelles porte le même mois, en densité, dans la carte dominante. Garder les
  deux aurait laissé deux calendriers côte à côte qu'il faut comparer pour
  savoir s'ils disent la même chose — et du code mort à côté de son
  remplaçant finit toujours par être modifié par erreur.
*/

function CarteDeRappel({ appointments }: { appointments: Appointment[] }) {
  const maintenant = Date.now();
  const prochain = appointments
    .filter(
      (a) =>
        a.status !== 'cancelled' &&
        a.status !== 'done' &&
        a.reminderMin > 0 &&
        new Date(a.startAt).getTime() >= maintenant,
    )
    .sort((a, b) => a.startAt.localeCompare(b.startAt))[0];

  if (!prochain) return null;

  return (
    <div className="panel p-4">
      <p className="eyebrow mb-3.5">Rappel</p>
      <p className="text-[14px] leading-[1.65] text-text-secondary [text-wrap:pretty]">
        Préavis de{' '}
        <span className="font-semibold text-text-primary">{reminderLabel(prochain.reminderMin)}</span>{' '}
        sur ce rendez-vous. La notification sortira ainsi :
      </p>
      <div className="mt-4 border border-border-raised bg-raised p-3.5">
        <p className="text-[13.5px] font-semibold text-text-primary">
          Rendez-vous dans {reminderLabel(prochain.reminderMin).replace(' avant', '')}
        </p>
        <p className="mt-1.5 text-[13px] leading-[1.55] text-text-secondary">
          {[timeLabel(prochain.startAt), prochain.title || 'Rendez-vous', prochain.clientName, prochain.location]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <p className="mt-4 font-mono text-[9.5px] uppercase leading-[1.7] tracking-[0.14em] text-text-muted">
        Un rappel en retard de plus de cinq minutes est abandonné
      </p>
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
/*
  `DayColumn` a été retiré pour la même raison.

  C'était la liste d'une journée, utilisée par les vues mois et semaine. Ces
  vues n'existent plus (voir `PlanDuMois`), et la journée est rendue par
  `ColonneDHeures`, à l'échelle des heures — ce que la liste ne savait pas
  faire.
*/

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
          className="flex h-9 w-9 items-center justify-center text-text-secondary hover:text-text-primary"
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
            <Contact size={14} strokeWidth={1.9} className="text-text-muted" />
            {appointment.clientName}
            {appointment.clientId === null && (
              <span className="font-mono text-[10px] text-text-muted">(rendez-vous libre)</span>
            )}
          </p>
        )}
        {appointment.location && (
          <p className="flex items-center gap-2 text-sm text-text-secondary">
            <MapPin size={14} strokeWidth={1.9} className="text-text-muted" />
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
            <CalendarDays size={14} strokeWidth={1.9} />
            {appointment ? 'Modifier le rendez-vous' : 'Nouveau rendez-vous'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-9 w-9 items-center justify-center text-text-secondary hover:text-text-primary"
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
