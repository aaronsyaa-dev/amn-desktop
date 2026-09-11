import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  CheckSquare,
  Contact,
  Globe,
  NotebookPen,
  Radar,
  Scale,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useRemoteSites } from '../state/RemoteSitesContext';
import { useAssistant } from '../assistant/AssistantContext';
import { useActivity } from '../state/ActivityContext';
import { useCollection } from '../state/SyncContext';
import { useProfiles } from '../state/ProfilesContext';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { useSitePins } from '../lib/useSitePins';
import { useSitePanel } from '../components/site-panel/SitePanelContext';
import { StatusBadge } from '../components/StatusBadge';
import { VeilleTicker } from '../components/VeilleTicker';
import { SupervisionBand } from '../components/SupervisionBand';
import { AttentionPanel } from '../components/AttentionPanel';
import { useAttention } from '../state/useAttention';
import { passagePrecedent, RelevePoste } from '../components/RelevePoste';
import { ProfilInterneCarte } from '../components/ProfilInterneCarte';
import { bridge } from '../lib/bridge';
import type { Observation } from '../lib/releve';
import { useLangue } from '../i18n';
import { homeWelcome, homeNudge, parcSerein, alerteParc } from '../lib/homeGreetings';
import { relativeTime } from '../lib/time';

/**
 * L'ACCUEIL INTERNE — le poste de supervision d'Harun et Mohamed
 * ══════════════════════════════════════════════════════════════
 *
 * Distinct de `HomeSoloScreen`, qui est l'accueil d'UNE cliente dans son propre
 * espace. Celui-ci regarde un PARC : des sites supervisés pour plusieurs
 * clientes, les incidents ouverts dessus, et le travail que l'équipe se
 * partage. Les deux écrans n'ont donc pas le même objet dominant, et le second
 * ne doit surtout pas copier la composition du premier.
 *
 * ## Ce qui domine, et pourquoi
 *
 * « Ce qui attend quelqu'un » — la tête de la file des points d'attention.
 *
 * Le candidat évident était la salutation : elle occupait 48 px au centre, et
 * c'est ce qu'on lisait d'abord. Mais une salutation n'est pas le sujet de
 * l'écran. Les autres candidats ont été écartés pour une raison chacun :
 *
 *   · le nombre de sites supervisés est un ÉTAT, pas une décision ; un état se
 *     lit en second ;
 *   · les sites hors ligne sont déjà rouges, et être hors ligne n'implique pas
 *     que personne ne s'en occupe ;
 *   · le prochain rendez-vous est l'objet de l'accueil CLIENTE — ici deux
 *     personnes couvrent plusieurs clientes, il n'y a pas « mon prochain
 *     rendez-vous » qui vaille pour l'écran.
 *
 * Ce qui reste est le seul fait qui parle du travail de L'ÉQUIPE : la chose la
 * plus grave qui a attendu le plus longtemps. Sur un poste à deux, la panne
 * n'est pas « on ne savait pas », c'est « chacun pensait que l'autre l'avait ».
 *
 * ## La file n'est pas recalculée ici
 *
 * La carte dominante PROMEUT la tête de `useAttention`, dont le classement
 * (gravité + ancienneté) vit dans `lib/attention.ts` et se contrôle hors
 * application. Écrire un second classement ici, c'est se donner deux vérités
 * qui finiront par diverger — le panneau dirait une chose, la carte une autre.
 * Le panneau reçoit donc la file PRIVÉE DE SA TÊTE : promue, pas dupliquée.
 *
 * ## L'ambre et le rouge disent deux choses différentes
 *
 * Le rouge reste la gravité, et il est déjà porté par les lignes du panneau.
 * L'ambre de la carte ne redit pas « c'est grave » : il dit « c'est à prendre
 * en premier ». Un incident critique déjà pris en charge est grave et n'appelle
 * aucune décision ; celui-ci en appelle une.
 */
export function HomeScreen() {
  const { user, org } = useAuth();
  const { sites } = useRemoteSites();
  const { open: openAssistant } = useAssistant();
  const { isPinned } = useSitePins();
  const { openSite } = useSitePanel();
  const { events } = useActivity();
  const { profileFor } = useProfiles();
  const navigate = useNavigate();

  // A3.2 — chronological feed of what the other operator recently added or
  // changed across the shared collections. Capped to keep Accueil calm.
  const recentActivity = useMemo(() => events.slice(0, 6), [events]);

  // Which feed rows arrived *after* the screen was already on display. The
  // first batch must not flash — everything is "new" on mount and six
  // simultaneous pulses would read as a glitch — so the initial keys are
  // recorded silently and only later arrivals pulse.
  const seenActivityKeys = useRef<Set<string> | null>(null);
  const [pulsingKeys, setPulsingKeys] = useState<string[]>([]);
  useEffect(() => {
    if (seenActivityKeys.current === null) {
      seenActivityKeys.current = new Set(recentActivity.map((e) => e.key));
      return;
    }
    const seen = seenActivityKeys.current;
    const fresh = recentActivity.filter((e) => !seen.has(e.key)).map((e) => e.key);
    recentActivity.forEach((e) => seen.add(e.key));
    if (fresh.length === 0) return;
    setPulsingKeys(fresh);
    const t = setTimeout(() => setPulsingKeys([]), 1600);
    return () => clearTimeout(t);
  }, [recentActivity]);

  // Personal fast lane: the sites this operator chose to follow (favoris).
  const pinnedSites = useMemo(() => sites.filter((s) => isPinned(s.id)), [sites, isPinned]);

  const displayName = user?.name?.split(' ')[0] ?? 'opérateur';

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Varies by time of day + a per-launch pick. Recomputed from the ticking
  // clock so it stays coherent with the real hour even if the app is left open
  // across a slot boundary (e.g. midnight); the pick is stable within a slot.
  /*
    LA SALUTATION N'AFFIRME LE CALME QUE SI ON L'A VÉRIFIÉ.

    Vu sur une capture réelle : « La nuit est calme, Aaron. » au-dessus de
    « 12 sites hors ligne » et de vingt et un points d'attention. La première
    phrase que lit l'opérateur contredisait tout ce qui la suivait.

    Trois conditions, et les trois comptent :
      · `checkedAt` — on a réellement regardé. Avant, on ne dit rien ;
      · aucun point d'attention ;
      · aucun site hors ligne.

    C'est la même règle que le panneau juste en dessous applique depuis
    toujours (« on n'affirme pas tout va bien avant d'avoir regardé ») ; la
    salutation était le seul endroit qui s'en dispensait.
  */
  const attention = useAttention();

  /*
    LA RELÈVE SOC (Signes Vitaux). Le dernier passage sur ce poste, et les
    incidents APPARUS depuis — une lecture au montage, pas une ronde : le
    présent est déjà surveillé par le panneau d'attention, la relève ne parle
    que du passé.
  */
  const depuisReleve = useMemo(() => passagePrecedent(org?.id), [org?.id]);
  const tachesReleve = useCollection<{ status?: string; createdAt?: string }>('tasks');
  const { t: tr, langue: langueReleve } = useLangue();
  const [incidentsApparus, setIncidentsApparus] = useState(0);
  useEffect(() => {
    if (!depuisReleve) return;
    let vivant = true;
    (async () => {
      try {
        const liste = await bridge().remote.listIncidents({ status: 'open' });
        if (!vivant) return;
        setIncidentsApparus(
          liste.filter((i) => Date.parse(i.firstSeenAt) > depuisReleve.getTime()).length,
        );
      } catch {
        /* relève sans cette ligne — plutôt manquer que mentir */
      }
    })();
    return () => {
      vivant = false;
    };
  }, [depuisReleve]);

  const observationsReleve = useMemo((): Observation[] => {
    if (!depuisReleve) return [];
    return [
      {
        nombre: incidentsApparus,
        un: tr('relev.incident.un'),
        plusieurs: tr('relev.incident.des'),
      },
      {
        nombre: tachesReleve.filter((t) => {
          const d = t.createdAt ? Date.parse(t.createdAt) : NaN;
          return Number.isFinite(d) && d > depuisReleve.getTime();
        }).length,
        un: tr('relev.tache.un'),
        plusieurs: tr('relev.tache.des'),
      },
    ];
  }, [depuisReleve, incidentsApparus, tachesReleve, langueReleve]);
  /*
    « JAMAIS VU » COMPTE, et c'est le chiffre qui manquait.

    Un site dont le traceur n'a jamais rien envoyé n'était NI en ligne NI hors
    ligne : il n'apparaissait dans aucun des deux compteurs, et n'empêchait pas
    l'accueil d'annoncer le calme. Mesuré : dix-neuf sites, douze hors ligne,
    sept jamais vus, et aucun des sept nulle part à l'écran.

    La règle vit dans lib/homeGreetings.ts, pas ici : elle était déjà écrite de
    deux façons différentes dans les deux accueils.
  */
  const horsLigne = sites.filter((s) => s.status === 'offline').length;
  const jamaisVus = sites.filter((s) => s.status === 'unknown').length;
  const serein = parcSerein({
    attentions: attention.items.length,
    regarde: Boolean(attention.checkedAt),
    horsLigne,
    jamaisVus,
  });
  const welcome = homeWelcome(displayName, now, serein, langueReleve);
  // Tiré une fois par montage (le tirage reste stable), dans la langue du
  // moment ; un changement de langue re-rend l'écran et retire dans la sienne.
  const nudge = useMemo(() => homeNudge(langueReleve), [langueReleve]);
  const dateLabel = now.toLocaleDateString(langueReleve === 'en' ? 'en-GB' : 'fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  /*
    LA TÊTE DE FILE, ET LE RESTE.

    `useAttention` trie déjà par poids (gravité + ancienneté) : la tête est,
    par construction, la chose la plus grave qui a attendu le plus longtemps.
    On la sort de la liste plutôt que de la laisser s'y perdre — c'était la
    sixième chose lisible de l'écran, en 14 px, dans un panneau replié à trois
    lignes sur treize.

    Le panneau reçoit `reste` : la même file, sans sa tête. Sans cela, l'objet
    dominant de l'écran serait aussi la première ligne du panneau juste en
    dessous, et on lirait deux fois la même phrase à deux tailles.
  */
  const aPrendre = attention.items[0];
  const reste = attention.items.length > 1 ? attention.items.length - 1 : 0;
  const fileRestante = useMemo(
    () => ({ items: attention.items.slice(1), checkedAt: attention.checkedAt }),
    [attention.items, attention.checkedAt],
  );

  const alerte = alerteParc({ horsLigne, jamaisVus }, langueReleve);

  // A three-number pulse of the workspace. Kept to counts the operator can act
  // on — nothing here is a vanity metric, and each one is a link to the screen
  // that resolves it.
  const openTasks = useCollection<{ status?: string }>('tasks');
  const stats = useMemo(
    () => [
      { key: 'sites', value: sites.length, label: tr('accueil.stats.sitesSupervises'), to: '/sites' },
      /*
        « En ligne » seul laissait un trou : dix-neuf supervisés, zéro en
        ligne, et rien qui dise où sont les dix-neuf autres. Le compteur des
        sites JAMAIS VUS prend la place quand il y en a — c'est le chiffre le
        plus grave des deux, et celui qu'on ne peut lire nulle part ailleurs.
        Quand tout a déjà parlé au moins une fois, il redevient « En ligne ».
      */
      jamaisVus > 0
        ? { key: 'jamais-vus', value: jamaisVus, label: tr('accueil.stats.jamaisVus'), to: '/sites' }
        : {
            key: 'online',
            value: sites.filter((s) => s.status === 'online').length,
            label: tr('accueil.stats.enLigne'),
            to: '/sites',
          },
      {
        key: 'tasks',
        value: openTasks.filter((t) => t.status !== 'done').length,
        label: tr('accueil.stats.tachesOuvertes'),
        to: '/tasks',
      },
    ],
    [sites, openTasks, jamaisVus, langueReleve],
  );

  const destinations = [
    { key: 'sites', label: tr('accueil.dest.sites'), hint: tr('accueil.dest.sites.hint'), icon: Globe, to: () => navigate('/sites') },
    { key: 'tasks', label: tr('accueil.dest.taches'), hint: tr('accueil.dest.taches.hint'), icon: CheckSquare, to: () => navigate('/tasks') },
    { key: 'clients', label: tr('accueil.dest.clients'), hint: tr('accueil.dest.clients.hint'), icon: Contact, to: () => navigate('/clients') },
    { key: 'team', label: tr('accueil.dest.equipe'), hint: tr('accueil.dest.equipe.hint'), icon: Users, to: () => navigate('/team') },
    { key: 'assistant', label: 'Ajmani', hint: tr('accueil.dest.assistant.hint'), icon: Sparkles, to: () => openAssistant() },
    { key: 'tracker', label: tr('accueil.dest.trackers'), hint: tr('accueil.dest.trackers.hint'), icon: Radar, to: () => navigate('/tracker') },
  ];

  const secondary = [
    { label: tr('accueil.sec.notes'), icon: NotebookPen, to: '/notes' },
    { label: tr('accueil.sec.decisions'), icon: Scale, to: '/decisions' },
    { label: tr('accueil.sec.connaissances'), icon: BookOpen, to: '/knowledge' },
  ];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col py-8">
      {/*
        LA SALUTATION DESCEND D'UN CRAN, ELLE NE DISPARAÎT PAS.

        Elle était le plus gros objet de l'écran — 48 px, au centre, au-dessus
        de tout. Ce n'est pas le sujet : la première chose qu'un poste de
        supervision doit dire, c'est ce qui attend. Elle garde sa règle (voir
        `parcSerein` : on n'affirme le calme qu'après avoir regardé), et devient
        la ligne de contexte qu'elle aurait toujours dû être.

        L'écran passe aussi de centré à aligné à gauche, comme les vingt-quatre
        autres : un tableau de bord qu'on balaie plusieurs fois par jour se lit
        au bord, pas au milieu.
      */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-wrap items-baseline gap-x-3 gap-y-1"
      >
        <p className="eyebrow">{dateLabel}</p>
        <p className="text-sm text-text-secondary">{welcome}</p>
        {/*
          L'alerte OU le clin d'œil, jamais rien.

          Le `nudge` est la phrase des jours où le parc n'a rien à signaler ;
          il était la branche « sinon » de l'alerte, et un premier jet de cette
          recomposition l'avait laissé tomber en même temps que la grande
          salutation — un écran qui ne dit plus rien quand tout va bien apprend
          qu'il ne dit rien.
        */}
        {alerte ? (
          <button
            type="button"
            onClick={() => navigate('/sites')}
            className="text-sm text-danger underline decoration-danger/40 underline-offset-4 transition-colors hover:decoration-danger"
          >
            {alerte}
          </button>
        ) : (
          <span className="text-sm text-text-muted">{nudge}</span>
        )}
      </motion.div>

      {/*
        L'OBJET DOMINANT — ce qui attend quelqu'un.

        Voir l'en-tête du fichier pour l'arbitrage. En résumé : c'est le seul
        fait de l'écran qui parle du travail de l'équipe plutôt que de l'état du
        parc, et sur un poste à deux, c'est là que ça casse.

        La plaque ambre porte la POSITION dans la file, pas la gravité : la
        gravité est déjà dite par la preuve (« non pris en charge depuis 7 h »,
        « échue depuis 45 jours »), qui vient du moteur et vaut pour les dix
        sortes de points d'attention. Une plaque qui dirait « critique »
        mentirait le jour où la tête de file est une facture.
      */}
      {aPrendre && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="panel-raised mt-5 p-5 sm:p-6"
          data-signal-groupe="a-prendre"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="signal-plate px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em]">
              {tr('accueil.aPrendre.enPremier')}
            </span>
            {reste > 0 && (
              <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                {reste === 1
                  ? tr('accueil.aPrendre.puisUnAutre')
                  : tr('accueil.aPrendre.puisNAutres', { n: reste })}
              </span>
            )}
          </div>

          <p className="mt-3.5 text-[21px] font-semibold leading-snug text-text-primary sm:text-[25px]">
            {aPrendre.title}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{aPrendre.evidence}</p>

          {aPrendre.action && (
            <button
              type="button"
              onClick={() => navigate(aPrendre.to)}
              className="mt-4 flex min-h-10 items-center gap-2 bg-accent px-4 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
            >
              {aPrendre.action}
              <ArrowRight size={15} strokeWidth={2} />
            </button>
          )}
        </motion.section>
      )}

      {/* La relève SOC : ce qui est apparu pendant l'absence, et un verdict.
          Même grammaire que le Majordome cliente, un degré plus froid. */}
      <RelevePoste
        depuis={depuisReleve}
        observations={observationsReleve}
        attentions={attention.items.length}
        ton="soc"
        className="mt-8"
      />

      {/* Live counts. They animate on display so the screen reads as awake
          rather than as a static poster, and they re-count in place when sync
          delivers a change. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        /*
          Le parc passe en SECOND, et à angles vifs comme tout le reste.

          Trois chiffres qui décrivent un état : ils ne demandent aucune
          décision, donc ils ne dominent plus. Les coins arrondis et l'ombre
          `elev-1` dataient d'avant le système de design, qui pose des cartes
          franches — voir « Pas de border-radius sur les cartes » dans le
          paquet, et les trois matières `.panel` / `.panel-raised` /
          `.panel-sheet` dans index.css.
        */
        className="mt-8 grid grid-cols-3 gap-px border border-border bg-border"
      >
        {stats.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => navigate(s.to)}
            className="group flex flex-col items-start gap-1 bg-surface px-4 py-4 text-left transition-colors hover:bg-surface-hover"
          >
            <AnimatedCounter
              value={s.value}
              className="font-mono text-2xl font-semibold tabular-nums text-text-primary sm:text-3xl"
            />
            <span className="text-[10px] uppercase tracking-[0.18em] text-text-muted transition-colors group-hover:text-text-secondary">
              {s.label}
            </span>
          </button>
        ))}
      </motion.div>

      {/* Veille ticker (Bloc 2) — renders nothing (no margin) when there's no data */}
      <VeilleTicker />

      {/* La veille dit ce qui se passe DEHORS ; celle-ci, ce qui se passe chez
          nous — clientes connectées, volume écrit, silences, sites en panne.
          Elle ne s'affiche que s'il y a un fait vrai à dire (BLOC K). */}
      <SupervisionBand />

      {/* Ce que l'application a remarqué toute seule. Ne s'affiche que s'il y a
          quelque chose à dire — voir AttentionPanel. */}
      <AttentionPanel state={fileRestante} className="mt-8" />

      {/*
        LE CHOIX DE POSTE PASSE APRÈS LA SUPERVISION.

        Cette carte n'apparaît qu'à la première ouverture d'un compte interne
        (Bloc 7) et ne revient pas. Elle se posait entre l'objet dominant et le
        parc, c'est-à-dire au milieu de la seule séquence que l'écran doit
        servir. Un réglage de barre latérale, si utile soit-il une fois, ne
        passe pas devant un incident que personne n'a pris.
      */}
      <ProfilInterneCarte />

      {/* Sites suivis — personal shortcut, only when the operator pinned some */}
      {pinnedSites.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10"
        >
          <p className="eyebrow mb-2.5">Sites suivis</p>
          <div className="flex flex-wrap gap-2">
            {pinnedSites.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => openSite(s.id)}
                className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-text-primary transition-colors hover:border-border-strong"
              >
                <StatusBadge status={s.status} compact />
                <span className="max-w-[10rem] truncate">{s.name}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Primary destinations */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.3 } } }}
        className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        {destinations.map((d) => (
          <motion.button
            key={d.key}
            type="button"
            onClick={d.to}
            variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ y: -3 }}
            className="panel group flex flex-col gap-3 p-5 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[6px] border border-border bg-bg text-text-secondary transition-colors group-hover:text-text-primary">
              <d.icon size={18} strokeWidth={1.9} />
            </span>
            <div>
              <p className="text-sm font-semibold text-text-primary">{d.label}</p>
              <p className="mt-0.5 text-xs text-text-muted">{d.hint}</p>
            </div>
            <ArrowRight
              size={15}
              className="mt-1 text-text-muted opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
            />
          </motion.button>
        ))}
      </motion.div>

      {/* Activité récente — what the other operator changed (A3.2) */}
      {recentActivity.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mt-12"
        >
          <p className="eyebrow mb-2.5">Activité récente</p>
          <div className="panel flex flex-col divide-y divide-border">
            {recentActivity.map((ev) => (
              <motion.button
                key={ev.key}
                type="button"
                onClick={() => navigate(ev.routeKey)}
                animate={
                  pulsingKeys.includes(ev.key)
                    ? { backgroundColor: ['rgba(0,0,0,0)', 'rgba(255,255,255,0.10)', 'rgba(0,0,0,0)'] }
                    : { backgroundColor: 'rgba(0,0,0,0)' }
                }
                transition={{ duration: 1.4, times: [0, 0.2, 1], ease: 'easeOut' }}
                className="flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
              >
                <span className="flex-shrink-0 border border-border bg-bg px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-text-muted">
                  {ev.noun}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="truncate text-sm text-text-primary">{ev.text}</span>
                  <span className="mt-0.5 block text-xs text-text-muted">
                    {profileFor(ev.actorEmail).name}
                  </span>
                </span>
                <span className="flex-shrink-0 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  {relativeTime(ev.at)}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Secondary links — quiet row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.8 }}
        className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2"
      >
        {secondary.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => navigate(s.to)}
            className="-my-1.5 flex items-center gap-1.5 py-1.5 text-xs text-text-muted transition-colors hover:text-text-secondary"
          >
            <s.icon size={13} strokeWidth={1.9} />
            {s.label}
          </button>
        ))}
      </motion.div>
    </div>
  );
}
