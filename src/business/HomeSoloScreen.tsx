import React, { useEffect, useMemo, useState } from 'react';
import { isModuleEnabled } from '../data/spaces';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarDays, CheckSquare, Contact, FileText, Plus } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useClients } from '../state/useClients';
import { useCollection } from '../state/SyncContext';
import { appointmentEnd, useAppointments, type Appointment } from '../state/useAppointments';
import { capitaliserPhrase, dayKey, longDayLabel, relativeToNow, timeLabel } from '../lib/calendar';
import { AttentionPanel } from '../components/AttentionPanel';
import { useAttention } from '../state/useAttention';
import { Majordome } from './Majordome';
import { homeWelcome, parcSerein } from '../lib/homeGreetings';
import { useLangue } from '../i18n';
import type { SharedTaskStatus } from '../shared/api';
import { useInvoices, isOverdue, netDueCents, isoDay } from '../state/useInvoices';
import { formatCentsCompact } from '../lib/money';
import { serieFlux, type SerieVitale } from '../lib/serieVitale';
import { useTimeTracking } from '../state/useTimeTracking';
import { formatDuration } from '../state/timeEngine';

/**
 * Accueil de l'édition Business — direction « Le poste habité ».
 *
 * Un seul objet domine l'écran : le prochain rendez-vous, en ambre plein.
 * Tout le reste descend en contraste — deux registres en ombre longue, pas de
 * deuxième couleur qui viendrait disputer l'attention. Le rouge est réservé au
 * strictement critique (une échéance dépassée), jamais décoratif.
 *
 * Palette et tuilage sont propres à cet écran, en valeurs codées en dur ici :
 * les jetons globaux (`--color-*` dans `index.css`) restent ceux de toute
 * l'application, et cette direction n'a été validée que pour l'Accueil.
 */

const ENCRE = '#050505';
const AMBRE = '#d09a4a';
const ROUGE = '#ff4230';
const ROUGE_CLAIR = '#ff5847';
const TEXTE_PRIMAIRE = '#f7f7f5';
const TEXTE_SECONDAIRE = '#a3a3a0';
const TEXTE_MUET = '#6b6b68';

interface TaskData {
  title: string;
  status: SharedTaskStatus;
}

/** Pas de configuration d'horaires de bureau dans l'application : une journée
 *  de référence 9 h – 18 h est posée par défaut pour le cadran, documentée
 *  comme telle plutôt que cachée dans un nombre magique. */
const JOURNEE_DEBUT_HEURE = 9;
const JOURNEE_FIN_HEURE = 18;

function progressionJournee(now: Date): { pourcent: number; restanteMs: number } {
  const debut = new Date(now);
  debut.setHours(JOURNEE_DEBUT_HEURE, 0, 0, 0);
  const fin = new Date(now);
  fin.setHours(JOURNEE_FIN_HEURE, 0, 0, 0);
  const total = fin.getTime() - debut.getTime();
  if (total <= 0) return { pourcent: 0, restanteMs: 0 };
  const ecoulee = Math.min(Math.max(now.getTime() - debut.getTime(), 0), total);
  return { pourcent: Math.round((ecoulee / total) * 100), restanteMs: total - ecoulee };
}

/** « Votre journée tient en quatre rendez-vous et deux relances. » — jamais
 *  posée en dur (voir la direction validée) : composée sur les vrais comptes
 *  du jour. « rendez-vous » est invariable, comme partout ailleurs dans
 *  l'application ; seule « relance » s'accorde. */
function journeeEnBref(nbRdv: number, nbRelances: number): string {
  if (nbRdv === 0 && nbRelances === 0) return 'Rien de prévu pour l’instant — la journée est à vous.';
  const parts: string[] = [];
  if (nbRdv > 0) parts.push(`${nbRdv} rendez-vous`);
  if (nbRelances > 0) parts.push(`${nbRelances} relance${nbRelances > 1 ? 's' : ''}`);
  return `Votre journée tient en ${parts.join(' et ')}.`;
}

export function HomeSoloScreen() {
  const { user, org } = useAuth();
  const { appointments } = useAppointments();
  const { clients } = useClients();
  const tasks = useCollection<TaskData>('tasks');

  const attention = useAttention();
  const { langue } = useLangue();
  const serein = parcSerein({
    attentions: attention.items.length,
    regarde: Boolean(attention.checkedAt),
  });

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const todayKey = dayKey(now);

  const today = useMemo(
    () =>
      appointments.filter(
        (a) => dayKey(new Date(a.startAt)) === todayKey && a.status !== 'cancelled',
      ),
    [appointments, todayKey],
  );

  const next =
    appointments.find(
      (a) => a.status === 'scheduled' && appointmentEnd(a).getTime() > now.getTime(),
    ) ?? null;

  const suiteDuJour = useMemo(() => today.filter((a) => a.id !== next?.id), [today, next]);

  const openTasksCount = useMemo(() => tasks.filter((t) => t.status !== 'done').length, [tasks]);

  const semaineRdvCount = useMemo(() => {
    const lundi = new Date(now);
    const jourSemaine = (lundi.getDay() + 6) % 7;
    lundi.setDate(lundi.getDate() - jourSemaine);
    lundi.setHours(0, 0, 0, 0);
    const dimanche = new Date(lundi);
    dimanche.setDate(dimanche.getDate() + 7);
    return appointments.filter((a) => {
      if (a.status === 'cancelled') return false;
      const t = new Date(a.startAt).getTime();
      return t >= lundi.getTime() && t < dimanche.getTime();
    }).length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments, todayKey]);

  const facturationOuverte = isModuleEnabled('invoices');
  const relancesOuvertes = isModuleEnabled('reminders');
  const { invoices, summary } = useInvoices();
  const todayIso = isoDay(now);

  const facturesEnRetard = useMemo(
    () =>
      invoices.filter(
        (f) =>
          f.status === 'issued' &&
          f.kind !== 'creditNote' &&
          netDueCents(f, invoices) > 0 &&
          isOverdue(f, todayIso, invoices),
      ),
    [invoices, todayIso],
  );
  const joursDeRetardMax = useMemo(
    () =>
      facturesEnRetard.reduce(
        (max, f) => Math.max(max, Math.floor((Date.parse(todayIso) - Date.parse(f.dueAt)) / 86400000)),
        0,
      ),
    [facturesEnRetard, todayIso],
  );
  // Le mini-graphe ne peut porter que ce que l'application connaît vraiment :
  // l'activité de FACTURATION des 7 derniers jours (combien émises par jour),
  // pas un historique du montant dû — cette valeur n'est jamais figée dans le
  // temps, donc aucune vraie courbe de « à encaisser » n'existe à tracer.
  const serieEmissions: SerieVitale = useMemo(
    () =>
      serieFlux(
        invoices.filter((f) => f.status !== 'draft' && f.kind !== 'creditNote').map((f) => f.issuedAt),
        7,
        now,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoices, todayKey],
  );

  const tempsActif = isModuleEnabled('time');
  const { summary: tempsSummary } = useTimeTracking();
  const saisiAujourdHuiMs = tempsActif ? tempsSummary(now.getTime()).todayMs : 0;

  const hasAnything = appointments.length > 0 || tasks.length > 0 || clients.length > 0;
  const { pourcent: pourcentJournee, restanteMs } = progressionJournee(now);
  const sousTitre = journeeEnBref(today.length, facturationOuverte ? summary.overdueCount : 0);

  return (
    <div
      className="-mx-4 -my-6 flex flex-col gap-6 px-4 py-8 sm:-mx-8 sm:-my-8 sm:px-8 sm:py-10"
      style={{ background: ENCRE }}
    >
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
            {org?.name ?? 'Votre activité'}
          </p>
          <h1
            className="mt-1 text-3xl font-bold tracking-tight sm:text-[44px]"
            style={{ color: TEXTE_PRIMAIRE, letterSpacing: '-0.03em' }}
          >
            {homeWelcome(user?.name?.split(' ')[0] ?? '', now, serein, langue)}
          </h1>
          <p className="mt-2 text-sm" style={{ color: TEXTE_SECONDAIRE }}>
            {sousTitre}
          </p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em]" style={{ color: TEXTE_MUET }}>
            {capitaliserPhrase(longDayLabel(now))}
          </p>
        </div>
        {isModuleEnabled('agenda') && (
          <Link
            to="/agenda"
            className="inline-flex w-fit items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: TEXTE_PRIMAIRE, color: '#080808' }}
          >
            <Plus size={14} strokeWidth={2.5} />
            Rendez-vous
          </Link>
        )}
      </header>

      {!hasAnything && <FirstRunCard />}

      <Majordome attentions={attention.items.length} />

      {hasAnything && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]" style={{ alignItems: 'stretch' }}>
          <MaintenantBlock appointment={next} now={now} />
          <CadranJournee pourcent={pourcentJournee} restanteMs={restanteMs} tempsActif={tempsActif} saisiMs={saisiAujourdHuiMs} />
        </div>
      )}

      <AttentionPanel state={attention} />

      {hasAnything && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_1fr]" style={{ alignItems: 'start' }}>
          <SuiteDuJour appointments={suiteDuJour} />

          <div className="flex flex-col gap-4">
            {facturationOuverte && (
              <AEncaisser
                outstandingCents={summary.outstandingCents}
                overdueCents={summary.overdueCents}
                overdueCount={summary.overdueCount}
                joursDeRetardMax={joursDeRetardMax}
                serie={serieEmissions}
                relancesOuvertes={relancesOuvertes}
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Tâches" value={openTasksCount} />
              <MiniStat label="RDV / sem." value={semaineRdvCount} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MaintenantBlock({
  appointment,
  now,
}: {
  appointment: Appointment | null;
  now: Date;
}) {
  const navigate = useNavigate();

  if (!appointment) {
    return (
      <div
        className="flex flex-col justify-center gap-1 border p-6"
        style={{ borderColor: '#242424', background: '#0d0d0d' }}
      >
        <span
          className="font-mono text-[10px] uppercase tracking-[0.22em]"
          style={{ color: TEXTE_MUET }}
        >
          Maintenant
        </span>
        <p className="mt-2 text-sm" style={{ color: TEXTE_SECONDAIRE }}>
          Rien de prévu pour l’instant.
        </p>
      </div>
    );
  }

  const enCours = now.getTime() >= new Date(appointment.startAt).getTime();
  const relatif = enCours ? 'En cours' : capitaliserPhrase(relativeToNow(appointment.startAt));
  const duree = appointment.durationMin > 0 ? formatDuration(appointment.durationMin * 60000) : '';
  const peutRejoindre = /^https?:\/\//i.test(appointment.location || '');
  // Un lien de visio en clair est illisible en majuscules (et déborde sur
  // téléphone) — le bouton « Rejoindre » juste en dessous porte déjà l'action.
  const lieu = peutRejoindre ? 'Visio' : appointment.location;
  const meta = [appointment.clientName, lieu, duree].filter(Boolean).join(' · ');
  const peutVoirClient = isModuleEnabled('clients') && Boolean(appointment.clientId);

  return (
    <div
      className="relative overflow-hidden p-6"
      style={{
        background: AMBRE,
        color: '#080808',
        boxShadow: '0 30px 60px -24px rgba(208,154,74,.45), 0 6px 18px rgba(0,0,0,.5)',
      }}
    >
      <span
        className="absolute left-0 right-0 top-0 h-px"
        style={{ background: 'rgba(255,255,255,.45)' }}
      />
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em]">Maintenant</span>
        <span className="h-px flex-1" style={{ background: 'rgba(8,8,8,.28)' }} />
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]">{relatif}</span>
      </div>
      <p className="mt-4 text-5xl font-semibold leading-none tracking-tight tabular-nums sm:text-[52px]">
        {timeLabel(appointment.startAt)}
      </p>
      <p className="mt-2.5 text-xl font-semibold leading-tight tracking-tight">
        {appointment.title || 'Rendez-vous'}
      </p>
      {meta && (
        <p className="mt-1.5 font-mono text-[11.5px] uppercase tracking-wide" style={{ opacity: 0.85 }}>
          {meta}
        </p>
      )}
      {(peutRejoindre || peutVoirClient) && (
        <div className="mt-5 flex flex-wrap gap-2">
          {peutRejoindre && (
            <a
              href={appointment.location}
              target="_blank"
              rel="noreferrer"
              className="px-4 py-2.5 text-[12.5px] font-semibold"
              style={{ background: '#080808', color: TEXTE_PRIMAIRE }}
            >
              Rejoindre
            </a>
          )}
          {peutVoirClient && (
            <button
              type="button"
              onClick={() => navigate('/clients', { state: { focusClientId: appointment.clientId } })}
              className="border px-4 py-2.5 text-[12.5px] font-semibold"
              style={{ borderColor: 'rgba(8,8,8,.5)', color: '#080808', background: 'transparent' }}
            >
              Notes du client
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CadranJournee({
  pourcent,
  restanteMs,
  tempsActif,
  saisiMs,
}: {
  pourcent: number;
  restanteMs: number;
  tempsActif: boolean;
  saisiMs: number;
}) {
  const deg = Math.round((pourcent / 100) * 360);
  return (
    <div
      className="flex flex-col items-center border p-5"
      style={{ background: '#111111', borderColor: '#262626' }}
    >
      <span
        className="self-start font-mono text-[10px] uppercase tracking-[0.18em]"
        style={{ color: TEXTE_MUET }}
      >
        Journée
      </span>
      {/*
        L'ANNEAU N'EST PLUS AMBRE — la règle « un seul objet ambre par écran »
        appliquée à l'écran qui sert de référence à tous les autres.

        Cet anneau et la plaque du rendez-vous étaient tous deux ambre : deux
        signaux sur le même écran, donc plus de signal du tout. Et à la
        relecture, l'anneau ne demande aucune décision — il dit qu'il est
        15 h 30. La règle 3 du jeton tranche : l'ambre marque ce qui appelle un
        geste, jamais un état. L'anneau passe donc en gris de remplissage, la
        plaque du rendez-vous reste le seul ambre de l'Accueil.
      */}
      <div
        className="mt-4 flex h-[132px] w-[132px] items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(#4a4a48 0deg ${deg}deg, #2a2a2a ${deg}deg 360deg)`,
        }}
      >
        <div
          className="flex h-[104px] w-[104px] flex-col items-center justify-center rounded-full border"
          style={{ background: '#111111', borderColor: '#262626' }}
        >
          <span className="text-[27px] font-semibold tabular-nums" style={{ color: TEXTE_PRIMAIRE }}>
            {pourcent} %
          </span>
          <span
            className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em]"
            style={{ color: TEXTE_MUET }}
          >
            écoulée
          </span>
        </div>
      </div>
      <div className="mt-4 flex w-full flex-col gap-2">
        <div className="flex justify-between font-mono text-[11px]">
          <span style={{ color: TEXTE_MUET }}>RESTANT</span>
          <span style={{ color: TEXTE_PRIMAIRE }}>{formatDuration(restanteMs)}</span>
        </div>
        {tempsActif && (
          <div className="flex justify-between font-mono text-[11px]">
            <span style={{ color: TEXTE_MUET }}>SAISI</span>
            <span style={{ color: TEXTE_PRIMAIRE }}>{formatDuration(saisiMs)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SuiteDuJour({ appointments }: { appointments: Appointment[] }) {
  return (
    <section
      className="border"
      style={{ background: '#101010', borderColor: '#242424' }}
    >
      <div
        className="flex items-center gap-3 px-5 py-3.5"
        style={{ background: '#171717', borderBottom: '1px solid #242424' }}
      >
        <span
          className="font-mono text-[10px] font-bold uppercase tracking-[0.22em]"
          style={{ color: TEXTE_PRIMAIRE }}
        >
          Suite du jour
        </span>
        <span className="flex-1" />
        {appointments.length > 0 && (
          <span className="font-mono text-[10px] uppercase tracking-wide" style={{ color: TEXTE_MUET }}>
            {appointments.length} RDV
          </span>
        )}
      </div>
      <div className="px-5 py-2 pb-4">
        {appointments.length === 0 ? (
          <p className="py-3 text-sm" style={{ color: TEXTE_MUET }}>
            Rien d’autre aujourd’hui.
          </p>
        ) : (
          appointments.map((a, i) => {
            const confirme = Boolean(a.location);
            const couleur = confirme ? TEXTE_PRIMAIRE : TEXTE_SECONDAIRE;
            return (
              <div
                key={a.id}
                className="flex items-center gap-4 py-3.5"
                style={i < appointments.length - 1 ? { borderBottom: '1px solid #1a1a1a' } : undefined}
              >
                <span className="w-[54px] flex-shrink-0 text-[15px] tabular-nums" style={{ color: couleur }}>
                  {timeLabel(a.startAt)}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block truncate text-[15px]"
                    style={{ color: couleur, textDecoration: a.status === 'done' ? 'line-through' : undefined }}
                  >
                    {a.title || 'Rendez-vous'}
                  </span>
                  {confirme && (
                    <span
                      className="mt-0.5 block truncate font-mono text-[10.5px] uppercase tracking-wide"
                      style={{ color: TEXTE_MUET }}
                    >
                      {[a.clientName, a.location].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: '#2e2e2e' }} />
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function AEncaisser({
  outstandingCents,
  overdueCents,
  overdueCount,
  joursDeRetardMax,
  serie,
  relancesOuvertes,
}: {
  outstandingCents: number;
  overdueCents: number;
  overdueCount: number;
  joursDeRetardMax: number;
  serie: SerieVitale;
  relancesOuvertes: boolean;
}) {
  if (outstandingCents === 0) {
    return (
      <section className="border p-5" style={{ background: '#101010', borderColor: '#242424' }}>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: TEXTE_MUET }}>
          À encaisser
        </span>
        <p className="mt-3 text-sm" style={{ color: TEXTE_SECONDAIRE }}>
          Rien à encaisser.
        </p>
      </section>
    );
  }

  const max = Math.max(1, ...serie.points.map((p) => p.valeur));

  return (
    <section className="relative border p-5" style={{ background: '#101010', borderColor: '#242424' }}>
      {/*
        Les repères d'angle passent de l'ambre au gris : l'ambre n'est JAMAIS
        décoratif (règle 3 du jeton), et deux repères de 5 px ne demandent
        aucune décision. Le signal de cet encart, c'est le montant et le rouge
        du retard en dessous — pas ses coins.
      */}
      <span className="absolute left-[-1px] top-[-1px] h-0.5 w-5" style={{ background: '#4a4a48' }} />
      <span className="absolute left-[-1px] top-[-1px] h-5 w-0.5" style={{ background: '#4a4a48' }} />
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: TEXTE_MUET }}>
          À encaisser
        </span>
        {overdueCount > 0 && (
          <span
            className="px-1.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.16em]"
            style={{ background: ROUGE, color: '#080808' }}
          >
            {overdueCount} échue{overdueCount > 1 ? 's' : ''}
          </span>
        )}
      </div>
      <p className="mt-4 text-[40px] font-semibold leading-none tracking-tight tabular-nums sm:text-[44px]" style={{ color: TEXTE_PRIMAIRE }}>
        {formatCentsCompact(outstandingCents)}
      </p>
      {overdueCents > 0 && (
        <p className="mt-2.5 text-[13px]" style={{ color: TEXTE_SECONDAIRE }}>
          dont{' '}
          <span className="tabular-nums" style={{ color: ROUGE_CLAIR }}>
            {formatCentsCompact(overdueCents)}
          </span>{' '}
          depuis {joursDeRetardMax} jour{joursDeRetardMax > 1 ? 's' : ''}
        </p>
      )}
      <div className="mt-4 flex h-[34px] items-end gap-1">
        {serie.points.map((p, i) => {
          const dernier = i === serie.points.length - 1;
          const hauteur = Math.max(10, Math.round((p.valeur / max) * 100));
          return (
            <span
              key={p.jour}
              className="flex-1"
              style={{
                height: `${hauteur}%`,
                /* Le dernier point est le plus clair, pas ambre : une barre de
                   série dit où l'on en est, elle ne demande pas de décision. */
                background: dernier ? '#4a4a48' : `rgba(255,255,255,${0.06 + (i / serie.points.length) * 0.16})`,
              }}
            />
          );
        })}
      </div>
      {overdueCount > 0 && relancesOuvertes && (
        <Link
          to="/relances"
          className="mt-4 block w-full border py-2.5 text-center text-[12.5px] font-semibold transition-colors hover:bg-white/5"
          style={{ borderColor: '#3a3a3a', color: TEXTE_PRIMAIRE }}
        >
          Envoyer les {overdueCount} relance{overdueCount > 1 ? 's' : ''}
        </Link>
      )}
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border p-4" style={{ background: '#0d0d0d', borderColor: '#1e1e1e' }}>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: TEXTE_MUET }}>
        {label}
      </span>
      <p className="mt-3 text-[27px] font-semibold tabular-nums" style={{ color: TEXTE_PRIMAIRE }}>
        {value}
      </p>
    </div>
  );
}

/**
 * Première ouverture : l'espace est vide, et il doit le dire sans donner
 * l'impression que quelque chose a échoué.
 *
 * Hors du champ de ce chantier — la direction validée ne dépeint pas cet
 * état — laissée dans le langage visuel partagé existant plutôt que
 * retravaillée sans mockup à suivre.
 */
function FirstRunCard() {
  const { org } = useAuth();

  const ouverts = useMemo(() => {
    const modules = org?.modules ?? null;
    const ouvert = (m: string) => modules === null || modules.includes(m);
    const gestes = [
      { module: 'agenda', to: '/agenda', label: 'Poser un premier rendez-vous', fort: true, icone: CalendarDays },
      { module: 'clients', to: '/clients', label: 'Créer une première fiche client', fort: false, icone: Contact },
      { module: 'invoices', to: '/facturation', label: 'Écrire un premier devis', fort: false, icone: FileText },
      { module: 'orders', to: '/commandes', label: 'Enregistrer une première commande', fort: false, icone: FileText },
      { module: 'notes', to: '/notes', label: 'Prendre une première note', fort: false, icone: FileText },
      { module: 'tasks', to: '/tasks', label: 'Poser une première tâche', fort: false, icone: CheckSquare },
    ].filter((g) => ouvert(g.module));
    return gestes.slice(0, 3).map((g, i) => ({ ...g, fort: i === 0 }));
  }, [org?.modules]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="panel-ticks border border-border-strong bg-surface p-5"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
        Bienvenue
      </p>
      <h2 className="mt-1.5 text-base font-semibold text-text-primary">
        {org?.name
          ? `L’espace ${/^[aeiouyàâéèêëîïôöûüh]/i.test(org.name) ? 'd’' : 'de '}${org.name} est prêt — et vide, c’est normal.`
          : 'Votre espace est prêt, et vide — c’est normal.'}
      </h2>
      <p className="mt-1 max-w-prose text-sm text-text-secondary">
        Commencez par le geste qui vous ressemble :
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {ouverts.map((g) => (
          <Link
            key={g.module}
            to={g.to}
            className={
              g.fort
                ? 'flex items-center gap-1.5 bg-accent px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover'
                : 'flex items-center gap-1.5 border border-border px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary'
            }
          >
            {g.fort ? <Plus size={14} strokeWidth={2} /> : <g.icone size={14} strokeWidth={1.9} />}
            {g.label}
          </Link>
        ))}
      </div>
    </motion.div>
  );
}
