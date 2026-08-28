import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Check,
  ChevronDown,
  RotateCcw,
  ShieldCheck,
  Undo2,
} from 'lucide-react';
import { bridge } from '../lib/bridge';
import { ScreenHeader } from '../components/ScreenHeader';
import { EmptyState } from '../components/EmptyState';
import { cleanErrorMessage } from '../lib/errorMessage';
import { formatDateTime, relativeTime } from '../lib/time';
import { alertKindLabel } from '../lib/trackerAlerts';
import {
  depuis,
  dureeLisible,
  ordonner,
  resumeSupervision,
  STATUT_LABEL,
  TON_STYLE,
  tonIncident,
} from '../lib/incidentDisplay';
import type { Incident, IncidentMetrics, RemoteEvent } from '../shared/api';

/**
 * LE BUREAU DE SUPERVISION — la file de travail, pas un journal
 * ════════════════════════════════════════════════════════════
 *
 * L'écran précédent (l'historique d'alertes d'un site) était en lecture seule :
 * on voyait passer, on ne pouvait rien en faire. C'est ce qui manquait pour
 * parler de supervision — voir docs/audit-soc.md.
 *
 * Trois partis pris, et chacun répond à un défaut observé dans les consoles
 * qui ne se lisent plus au bout d'une semaine :
 *
 * **On montre ce qu'il reste à faire, pas tout.** Le filtre par défaut est
 * « ouverts » : les nouveaux ET ceux qu'on a pris en charge. Un incident
 * acquitté n'est pas terminé, le sortir de la file le ferait oublier. Les
 * incidents clos restent atteignables, en un clic, jamais par défaut.
 *
 * **Le geste est sur la ligne.** Acquitter et clore ne demandent ni d'ouvrir
 * un détail ni de confirmer : ce sont des gestes qu'on fait vingt fois par
 * jour, et chaque friction ajoutée est un incident qu'on ne traitera pas. La
 * seule exception est le faux positif, qui exige une note — parce que c'est la
 * seule trace qui permettra un jour de corriger la détection fautive au lieu
 * d'apprendre à ne plus la lire.
 *
 * **Le rouge est rare.** Il ne sort que pour un critique ENCORE à traiter.
 * Critique mais pris en charge n'est plus une urgence, et le peindre en rouge
 * ferait paniquer pour rien — après quoi plus personne ne regarderait le rouge.
 */
export function IncidentsScreen() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [metrics, setMetrics] = useState<IncidentMetrics | null>(null);
  const [portee, setPortee] = useState<'open' | 'all'>('open');
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  const recharger = useCallback(
    async (silencieux = false) => {
      if (!silencieux) setChargement(true);
      try {
        const [liste, mesures] = await Promise.all([
          bridge().remote.listIncidents({ status: portee }),
          bridge().remote.incidentMetrics(30),
        ]);
        setIncidents(liste);
        setMetrics(mesures);
        setErreur(null);
      } catch (err) {
        setErreur(cleanErrorMessage(err, 'Supervision indisponible.'));
      } finally {
        setChargement(false);
      }
    },
    [portee],
  );

  useEffect(() => {
    void recharger();
  }, [recharger]);

  /*
    Une ronde discrète toutes les 30 s. Un bureau de supervision qu'il faut
    rafraîchir à la main n'est pas un bureau de supervision — mais elle est
    SILENCIEUSE (pas de voile de chargement) : faire clignoter la liste sous
    les yeux de quelqu'un qui lit une ligne est le meilleur moyen de lui faire
    perdre le fil.
  */
  useEffect(() => {
    const t = window.setInterval(() => {
      if (!document.hidden) void recharger(true);
    }, 30_000);
    return () => window.clearInterval(t);
  }, [recharger]);

  const liste = useMemo(() => ordonner(incidents), [incidents]);

  /** Remplace un incident sur place — la file ne saute pas sous le curseur. */
  const remplacer = (maj: Incident) =>
    setIncidents((courant) => {
      const dedans = courant.some((i) => i.id === maj.id);
      if (!dedans) return courant;
      // En portée « ouverts », un incident clos quitte la file : c'est le
      // retour visible du geste, et l'animation de sortie le rend lisible.
      if (portee === 'open' && maj.status === 'resolved') {
        return courant.filter((i) => i.id !== maj.id);
      }
      return courant.map((i) => (i.id === maj.id ? maj : i));
    });

  const agir = async (id: string, action: () => Promise<Incident>) => {
    setEnCours(id);
    try {
      remplacer(await action());
      setErreur(null);
      // Les mesures bougent à chaque geste : les relire tout de suite évite
      // qu'un délai médian affiché contredise ce qu'on vient de faire.
      void bridge()
        .remote.incidentMetrics(30)
        .then(setMetrics)
        // Le geste a réussi ; si le relevé des mesures échoue, on garde
        // l'ancien plutôt que d'afficher une erreur qui ferait douter du geste.
        .catch(() => undefined);
    } catch (err) {
      setErreur(cleanErrorMessage(err, 'Geste refusé.'));
      // Un refus vient d'un état qu'on ne connaissait plus (quelqu'un d'autre
      // a pris l'incident entre-temps). On relit plutôt que de laisser l'écran
      // mentir.
      void recharger(true);
    } finally {
      setEnCours(null);
    }
  };

  return (
    <section className="flex flex-col">
      <ScreenHeader
        eyebrow="Supervision · Incidents"
        title="Bureau de supervision"
        description={resumeSupervision(metrics)}
        stats={[
          { label: 'À traiter', value: metrics ? metrics.new : '—', emphasis: (metrics?.new ?? 0) > 0 },
          { label: 'En cours', value: metrics ? metrics.acknowledged : '—' },
          {
            label: 'Prise en charge',
            value: dureeLisible(metrics?.medianTimeToAcknowledgeMs),
            title: 'Délai médian entre la première alerte et sa prise en charge, sur 30 jours.',
          },
          {
            label: 'Résolution',
            value: dureeLisible(metrics?.medianTimeToResolveMs),
            title: 'Délai médian entre la première alerte et la clôture, sur 30 jours.',
          },
          {
            label: 'Plus ancien ouvert',
            value: metrics?.oldestOpenAt ? depuis(metrics.oldestOpenAt) : '—',
            emphasis: Boolean(metrics?.oldestOpenAt),
            title:
              'Une médiane rassurante peut cacher un dossier oublié : voici le plus vieux encore ouvert.',
          },
        ]}
        actions={
          <button
            type="button"
            onClick={() => void recharger()}
            aria-label="Relire maintenant"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-secondary transition-colors hover:text-text-primary"
          >
            <RotateCcw size={15} strokeWidth={1.75} className={chargement ? 'animate-spin' : ''} />
          </button>
        }
      >
        <div className="flex items-center gap-1">
          {(['open', 'all'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPortee(p)}
              className={`rounded-md px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors ${
                portee === p
                  ? 'bg-accent-muted text-text-primary'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {p === 'open' ? 'À traiter' : 'Tout, clos compris'}
            </button>
          ))}
        </div>
      </ScreenHeader>

      {erreur && (
        <p className="mb-4 rounded-lg border border-danger/40 bg-danger-muted px-3 py-2 text-[13px] text-danger">
          {erreur}
        </p>
      )}

      {liste.length === 0 && !chargement ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface px-6 py-16 text-center">
          <ShieldCheck size={22} strokeWidth={1.5} className="text-text-muted" />
          <p className="text-sm font-medium text-text-primary">
            {portee === 'open' ? 'Rien à traiter.' : 'Aucun incident enregistré.'}
          </p>
          <p className="max-w-md text-[13px] leading-relaxed text-text-secondary">
            {portee === 'open'
              ? 'Force brute, injections, débit anormal, indisponibilités et certificats arrivent ici dès qu’ils sont détectés — regroupés par acteur, pour qu’une campagne se lise comme une campagne.'
              : 'Les incidents apparaîtront ici dès la première alerte détectée sur un site supervisé.'}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {liste.map((incident) => (
              <LigneIncident
                key={incident.id}
                incident={incident}
                ouvert={ouvert === incident.id}
                occupe={enCours === incident.id}
                onBasculer={() => setOuvert((c) => (c === incident.id ? null : incident.id))}
                onAcquitter={() => agir(incident.id, () => bridge().remote.acknowledgeIncident(incident.id))}
                onResoudre={(resolution, note) =>
                  agir(incident.id, () => bridge().remote.resolveIncident(incident.id, resolution, note))
                }
                onRouvrir={() => agir(incident.id, () => bridge().remote.reopenIncident(incident.id))}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}

function LigneIncident({
  incident,
  ouvert,
  occupe,
  onBasculer,
  onAcquitter,
  onResoudre,
  onRouvrir,
}: {
  incident: Incident;
  ouvert: boolean;
  occupe: boolean;
  onBasculer: () => void;
  onAcquitter: () => void;
  onResoudre: (resolution: 'resolved' | 'false_positive', note?: string) => void;
  onRouvrir: () => void;
}) {
  const ton = tonIncident(incident);
  const style = TON_STYLE[ton];
  const [fauxPositif, setFauxPositif] = useState(false);
  const [note, setNote] = useState('');

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      /*
        La sortie est plus lente que l'entrée, et glisse vers la gauche. Ce
        n'est pas un ornement : clore un incident le fait quitter la file, et
        sans ce mouvement la ligne disparaîtrait d'un coup — on douterait
        d'avoir cliqué au bon endroit.
      */
      exit={{ opacity: 0, x: -24, height: 0, marginBottom: 0, transition: { duration: 0.28 } }}
      transition={{ duration: 0.18 }}
      className={`overflow-hidden rounded-xl border border-l-2 border-border bg-surface ${style.bord}`}
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="relative mt-1.5 flex h-2 w-2 flex-shrink-0">
            {/*
              La pulsation ne sort que pour un critique NON PRIS. C'est le seul
              endroit de l'écran qui bouge tout seul : dès qu'elle est partout,
              elle ne désigne plus rien.
            */}
            {ton === 'urgent' && (
              <motion.span
                className="absolute inline-flex h-full w-full rounded-full bg-danger"
                animate={{ opacity: [0.7, 0, 0.7], scale: [1, 2.2, 1] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${style.point}`} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className={`rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${style.puce}`}>
                {STATUT_LABEL[incident.status]}
              </span>
              <h2 className="truncate text-sm font-medium text-text-primary">{incident.title}</h2>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] text-text-muted">
              <span>
                {incident.alertCount} alerte{incident.alertCount > 1 ? 's' : ''}
              </span>
              <span aria-hidden>·</span>
              <span title={formatDateTime(incident.lastSeenAt)}>
                dernière {relativeTime(incident.lastSeenAt)}
              </span>
              {incident.acknowledgedBy && (
                <>
                  <span aria-hidden>·</span>
                  <span className="text-text-secondary">pris par {incident.acknowledgedBy}</span>
                </>
              )}
              {incident.resolution === 'false_positive' && (
                <>
                  <span aria-hidden>·</span>
                  <span>faux positif</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1.5">
          {incident.status === 'new' && (
            <Bouton onClick={onAcquitter} disabled={occupe} principal>
              Je m’en occupe
            </Bouton>
          )}
          {incident.status !== 'resolved' && !fauxPositif && (
            <>
              <Bouton onClick={() => onResoudre('resolved')} disabled={occupe}>
                <Check size={13} strokeWidth={2.25} /> Clore
              </Bouton>
              <Bouton onClick={() => setFauxPositif(true)} disabled={occupe} discret>
                Faux positif
              </Bouton>
            </>
          )}
          {incident.status === 'resolved' && (
            <Bouton onClick={onRouvrir} disabled={occupe} discret>
              <Undo2 size={13} strokeWidth={1.75} /> Rouvrir
            </Bouton>
          )}
          <button
            type="button"
            onClick={onBasculer}
            aria-label={ouvert ? 'Replier la chronologie' : 'Voir la chronologie'}
            aria-expanded={ouvert}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <motion.span animate={{ rotate: ouvert ? 180 : 0 }} transition={{ duration: 0.18 }}>
              <ChevronDown size={15} strokeWidth={1.75} />
            </motion.span>
          </button>
        </div>
      </div>

      {/*
        La note d'un faux positif est demandée SUR LA LIGNE, pas dans une boîte
        de dialogue. Le serveur la refuse sans note ; l'écran doit donc la
        réclamer au moment du geste, sinon la personne découvre le refus après
        coup et recommence.
      */}
      <AnimatePresence initial={false}>
        {fauxPositif && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border bg-bg/40"
          >
            <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
              <input
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ce qui a été vérifié, et pourquoi ce n’en était pas un"
                className="input-focus min-w-0 flex-1 rounded-md border border-border bg-bg px-3 py-2 text-[13px] text-text-primary outline-none placeholder:text-text-muted"
              />
              <div className="flex items-center gap-1.5">
                <Bouton
                  onClick={() => {
                    onResoudre('false_positive', note.trim());
                    setFauxPositif(false);
                    setNote('');
                  }}
                  disabled={occupe || note.trim().length < 3}
                >
                  Enregistrer
                </Bouton>
                <Bouton onClick={() => { setFauxPositif(false); setNote(''); }} discret>
                  Annuler
                </Bouton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {ouvert && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="border-t border-border"
          >
            <Chronologie incident={incident} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

/**
 * La chronologie des alertes réunies dans l'incident.
 *
 * Chargée à l'ouverture seulement : une file de cinquante incidents ne doit
 * pas tirer cinquante listes d'alertes pour en afficher zéro.
 */
function Chronologie({ incident }: { incident: Incident }) {
  const [events, setEvents] = useState<RemoteEvent[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    bridge()
      .remote.getIncident(incident.id)
      .then((d) => vivant && setEvents(d.events))
      .catch((err) => vivant && setErreur(cleanErrorMessage(err, 'Chronologie indisponible.')));
    return () => {
      vivant = false;
    };
  }, [incident.id]);

  if (erreur) return <p className="px-4 py-3 text-[13px] text-text-secondary">{erreur}</p>;
  if (!events) return <p className="px-4 py-3 text-[13px] text-text-muted">Lecture…</p>;

  return (
    <div className="px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Activity size={13} strokeWidth={1.75} className="text-text-muted" />
        <span className="eyebrow">Chronologie · {events.length} alerte{events.length > 1 ? 's' : ''}</span>
      </div>

      {incident.note && (
        <p className="mb-3 rounded-md border border-border bg-bg/40 px-3 py-2 text-[13px] leading-relaxed text-text-secondary">
          {incident.note}
        </p>
      )}

      {events.length === 0 ? (
        <EmptyState quiet>
          Aucune alerte rattachée — l’incident a été créé avant que le rattachement existe.
        </EmptyState>
      ) : (
        <ol className="relative flex flex-col gap-2 border-l border-border pl-4">
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[21px] top-2 h-1.5 w-1.5 rounded-full bg-border-strong" />
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-[11px] text-text-muted">
                  {formatDateTime(e.occurredAt)}
                </span>
                <span className="text-[13px] font-medium text-text-primary">
                  {alertKindLabel((e.payload as { kind?: string })?.kind)}
                </span>
              </div>
              {e.message && (
                <p className="mt-0.5 break-words text-[12px] leading-relaxed text-text-secondary">
                  {e.message}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Bouton({
  children,
  onClick,
  disabled,
  principal,
  discret,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  principal?: boolean;
  discret?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        principal
          ? 'bg-accent text-bg hover:bg-accent-hover'
          : discret
            ? 'text-text-muted hover:bg-surface-hover hover:text-text-primary'
            : 'border border-border text-text-secondary hover:border-border-strong hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}
