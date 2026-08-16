import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  History,
  Link2,
  LockKeyhole,
  Radar,
  ScanLine,
  Sparkles,
} from 'lucide-react';
import { SiteBadgeExport, SocDesk } from '../components/tracker/SocDesk';
import { CallLinkPanel } from '../components/call/CallLinkPanel';
import { AttentionPanel } from '../components/AttentionPanel';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import { useRemoteSites } from '../state/RemoteSitesContext';
import { useOrgContext } from '../state/OrgContextContext';
import { bridge } from '../lib/bridge';
import { relativeTime } from '../lib/time';
import { ScreenHeader } from '../components/ScreenHeader';
import { OrgBanner } from '../components/org-rail/OrgBanner';
import type { OrgAccessEntry, SupervisionState } from '../shared/api';

/**
 * La Tour de contrôle — la seconde page d'accueil d'AMN DevSec.
 *
 * Ce n'est pas une section de plus : c'est le point d'entrée de tout ce qui est
 * transverse. Le mur d'incidents, la répartition des visiteurs et la heatmap
 * horaire existaient déjà, enfouis au milieu de l'écran Trackers, sous le
 * catalogue de modules — c'est-à-dire à l'endroit précis où on ne les
 * regardait jamais. Ils sont ici, en tête, parce que c'est la première chose
 * qu'on veut voir en ouvrant la supervision ; le catalogue Trackers, lui, reste
 * où il était, à un clic.
 *
 * Le panneau « Organisations clientes » est la seule pièce neuve : la vue
 * d'ensemble du parc de clientes, avec l'accès direct au dossier de chacune.
 */
export function ControlTowerScreen() {
  const { sites } = useRemoteSites();
  const { organizations, loadingOrgs, orgsError } = useOrgContext();

  const parc = useMemo(() => {
    const online = sites.filter((s) => s.status ==='online').length;
    const degraded = sites.filter((s) => s.status ==='degraded').length;
    const offline = sites.filter((s) => s.status ==='offline').length;
    return { total: sites.length, online, degraded, offline };
  }, [sites]);

  const suspended = organizations.filter((o) => o.status === 'suspended').length;
  const [linkPanel, setLinkPanel] = useState(false);

  return (
    <StaggerGroup className="flex flex-col gap-6">
      <StaggerItem>
        {/*
          L'EN-TÊTE DE CONSOLE (BLOC B).

          Ce n'est pas le même en-tête que les écrans du Poste de travail, et
          c'est voulu : ici le titre n'est pas ce qui compte, l'ÉTAT l'est. Les
          vitales du parc sont donc portées par l'en-tête lui-même, en relevés,
          avant tout le reste — on ouvre cet écran pour savoir si quelque chose
          brûle, pas pour lire un titre.
        */}
        <ScreenHeader
          eyebrow="Tour de contrôle"
          title="Vue d’ensemble"
          description="Le parc, les clientes et les rondes de fond, en un seul écran."
          stats={[
            { label: 'Sites', value: parc.total },
            { label: 'En ligne', value: parc.online },
            {
              label: 'Dégradés',
              value: parc.degraded,
              emphasis: parc.degraded > 0,
            },
            {
              label: 'Hors ligne',
              value: parc.offline,
              emphasis: parc.offline > 0,
            },
            { label: 'Clientes', value: organizations.length },
            {
              label: 'Suspendues',
              value: suspended,
              emphasis: suspended > 0,
            },
          ]}
          actions={
            <>
              {/* L'atelier, à portée depuis la vue d'ensemble : créer une
                  cliente est un geste qu'on fait EN supervisant le parc. */}
              <Link
                to="/tour/generateur"
                className="flex min-h-11 items-center gap-2 bg-accent px-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
              >
                <Sparkles size={15} strokeWidth={2} />
                Atelier
              </Link>
            <button
              type="button"
              onClick={() => setLinkPanel(true)}
              title="Créer un lien d’appel pour un prospect sans compte"
              className="flex min-h-11 items-center gap-2 border border-dashed border-border px-3 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            >
              <Link2 size={15} strokeWidth={1.75} />
              Lien d’appel
            </button>
            </>
          }
        />
      </StaggerItem>

      {/* Ce que la supervision de fond a réellement fait, et quand (BLOC F). */}
      <StaggerItem>
        <SupervisionPanel />
      </StaggerItem>

      {/*
        Points d'attention, AVANT le mur d'incidents.

        Aaron les a cherchés ici et ne les a pas trouvés : ils n'existaient que
        sur l'Accueil. Sa recherche avait raison — la Tour de contrôle est
        l'écran de supervision transverse, et « une facture impayée depuis 45
        jours » est exactement le genre de chose qu'on vient y chercher.

        Ils restent aussi sur l'Accueil : c'est là qu'on atterrit. Le même
        signal à deux endroits légitimes n'est pas une duplication, c'est la
        différence entre « ce que je vois en arrivant » et « ce que je viens
        consulter ».
      */}
      <StaggerItem>
        <AttentionPanel />
      </StaggerItem>

      {/* Le mur : incidents inter-sites, origine des visiteurs, activité horaire. */}
      <StaggerItem>
        <SocDesk withBadgeExport={false} />
      </StaggerItem>

      <AnimatePresence>
        {linkPanel && <CallLinkPanel onClose={() => setLinkPanel(false)} />}
      </AnimatePresence>

      <StaggerItem>
        <ClientOrgsPanel loading={loadingOrgs} error={orgsError} />
      </StaggerItem>

      <StaggerItem>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ProductTile to="/tracker" icon={Radar} label="Trackers" hint="Modules installés par site" />
          <ProductTile to="/scanner" icon={ScanLine} label="Scanner" hint="Analyses de vulnérabilités" />
          <ProductTile to="/comply" icon={BadgeCheck} label="Comply" hint="Conformité RGPD" />
          <ProductTile to="/ssl" icon={LockKeyhole} label="SSL Monitor" hint="Certificats TLS" />
        </div>
      </StaggerItem>

      <StaggerItem>
        <RecentAccessPanel />
      </StaggerItem>

      <StaggerItem>
        <SiteBadgeExport />
      </StaggerItem>
    </StaggerGroup>
  );
}

function ProductTile({
  to,
  icon: Icon,
  label,
  hint,
}: {
  to: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="elev-hover group flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 transition-colors duration-200 hover:border-border-strong"
    >
      <span className="text-text-primary transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:scale-110">
        <Icon size={20} strokeWidth={1.5} />
      </span>
      <span className="text-sm font-medium text-text-primary">{label}</span>
      <span className="text-[11px] leading-snug text-text-muted">{hint}</span>
    </Link>
  );
}

/**
 * Les organisations clientes, en vue d'ensemble.
 *
 * Trois colonnes seulement, choisies parce que ce sont les trois questions
 * qu'on se pose sur une cliente sans ouvrir son dossier : est-ce que son accès
 * fonctionne, est-ce qu'elle s'en sert, et combien de personnes y sont. Tout le
 * reste demande d'entrer chez elle — et entrer chez elle laisse une trace.
 */
function ClientOrgsPanel({ loading, error }: { loading: boolean; error: string | null }) {
  const { organizations, enterOrganization, entering } = useOrgContext();

  return (
    <section className="elev-1 rounded-2xl border border-border bg-surface">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <Building2 size={15} strokeWidth={1.75} className="text-text-secondary" />
        <h2 className="mr-auto text-sm font-semibold text-text-primary">Organisations clientes</h2>
        <Link
          to="/tour/organisations"
          className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-text-muted transition-colors hover:text-text-primary"
        >
          Tout gérer
          <ArrowRight size={12} strokeWidth={2} />
        </Link>
      </header>

      {error && <p className="px-4 py-3 text-xs text-danger">{error}</p>}

      {loading && !error && <p className="px-4 py-6 text-sm text-text-muted">Chargement…</p>}

      {!loading && !error && organizations.length === 0 && (
        <div className="px-4 py-8 text-center">
          <p className="text-sm font-medium text-text-primary">Aucune organisation cliente</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-text-secondary">
            Créez-en une depuis le « + » du rail, à gauche : l’organisation, son compte
            propriétaire et son accès sont générés d’un coup.
          </p>
        </div>
      )}

      {/*
        Des BANDEROLES, comme au registre (BLOC E). Le composant est le même
        des deux côtés : deux présentations de la même chose finiraient par
        diverger, et l'une des deux serait alors la mauvaise.
      */}
      <div className="flex flex-col gap-2 p-3">
        {organizations.slice(0, 6).map((org) => (
          <OrgBanner
            key={org.id}
            org={org}
            openLabel="Ouvrir"
            busy={entering === org.id}
            onOpen={() => void enterOrganization(org.id)}
          />
        ))}
      </div>
    </section>
  );
}

/** Les derniers accès aux dossiers clients — la trace, à hauteur de coup d'œil. */
function RecentAccessPanel() {
  const [entries, setEntries] = useState<OrgAccessEntry[] | null>(null);

  useEffect(() => {
    let active = true;
    bridge()
      .remote.admin.accessLog({ limit: 5 })
      .then((rows) => {
        if (active) setEntries(rows);
      })
      .catch(() => {
        if (active) setEntries([]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (entries === null || entries.length === 0) return null;

  return (
    <section className="elev-1 rounded-2xl border border-border bg-surface">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <History size={15} strokeWidth={1.75} className="text-text-secondary" />
        <h2 className="mr-auto text-sm font-semibold text-text-primary">Derniers accès</h2>
        <Link
          to="/tour/journal"
          className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-text-muted transition-colors hover:text-text-primary"
        >
          Journal complet
          <ArrowRight size={12} strokeWidth={2} />
        </Link>
      </header>
      <ul className="divide-y divide-border">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="min-w-0 flex-1 truncate text-xs text-text-secondary">
              <span className="text-text-primary">{entry.actorEmail}</span>{' '}
              {ACCESS_VERB[entry.action] ?? entry.action}{' '}
              <span className="text-text-primary">{entry.orgName}</span>
            </span>
            <time className="flex-shrink-0 font-mono text-[10px] uppercase tracking-widest text-text-muted">
              {relativeTime(entry.createdAt)}
            </time>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Le journal est lu par des humains : « enter » n'est pas une phrase. */
export const ACCESS_VERB: Record<string, string> = {
  enter: 'a ouvert le dossier de',
  leave: 'a quitté le dossier de',
  suspend: 'a suspendu',
  reactivate: 'a réactivé',
  invite: 'a réémis une invitation pour',
  password: 'a réinitialisé un mot de passe chez',
};


/**
 * LES RONDES DE FOND — ce que la supervision a réellement fait (BLOC F).
 *
 * Aaron demandait : « les scanners etc, ça doit vraiment pouvoir tourner en
 * fond. » Elles tournaient déjà côté serveur — mais rien, nulle part, ne
 * permettait de le CONSTATER, et une supervision qu'on doit croire sur parole
 * n'est pas une supervision. Ce panneau est la réponse observable.
 *
 * Chaque ligne dit la périodicité voulue, la dernière exécution réelle et si la
 * ronde est en retard. Le verdict de retard vient du SERVEUR : c'est lui qui
 * connaît sa propre horloge, et deux horloges qui divergent donneraient deux
 * verdicts pour la même ronde.
 *
 * Le point ne bat que sur une ronde à l'heure. Une ronde en retard reste fixe —
 * un point qui continuerait de battre dirait « ça tourne » au moment précis où
 * ça ne tourne plus, ce qui est exactement le mensonge qu'une animation ne doit
 * jamais commettre.
 */
function SupervisionPanel() {
  const [state, setState] = useState<SupervisionState | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      bridge()
        .remote.admin.supervision()
        .then((s) => {
          if (alive) setState(s);
        })
        .catch(() => {
          if (alive) setFailed(true);
        });
    void load();
    // Une relecture par minute : les périodicités vont de la minute à la
    // journée, donc rafraîchir plus vite ne montrerait rien de plus.
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  if (failed || !state) return null;

  const late = state.sweeps.filter((s) => s.overdue).length;

  return (
    <section className="panel panel-ticks">
      <header className="panel-head flex flex-wrap items-center gap-2 px-4 py-2.5">
        <Radar size={14} strokeWidth={1.75} className="text-text-secondary" />
        <h2 className="mr-auto text-[13px] font-semibold text-text-primary">Rondes de fond</h2>
        <span className="eyebrow">
          {late === 0
            ? `${state.sweeps.length} à l’heure`
            : `${late} en retard sur ${state.sweeps.length}`}
        </span>
      </header>

      <ul className="divide-y divide-border">
        {state.sweeps.map((sweep) => (
          <li key={sweep.name} className="flex items-center gap-3 px-4 py-2">
            <span
              className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                sweep.overdue ? 'bg-warning' : 'bg-success live-dot'
              }`}
              aria-hidden
            />
            <span className="w-32 flex-shrink-0 font-mono text-[11px] text-text-primary">
              {SWEEP_LABELS[sweep.name] ?? sweep.name}
            </span>
            <span className="eyebrow w-24 flex-shrink-0">{everyLabel(sweep.everyMs)}</span>
            <span className="min-w-0 flex-1 truncate text-[11px] text-text-secondary">
              {sweep.lastRunAt ? `passée ${relativeTime(sweep.lastRunAt)}` : 'jamais exécutée'}
            </span>
            {sweep.overdue && (
              <span className="flex-shrink-0 font-mono text-[9px] uppercase tracking-wider text-warning">
                Due
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Les noms internes des rondes ne sont pas des phrases. */
const SWEEP_LABELS: Record<string, string> = {
  heartbeat: 'Battements',
  availability: 'Disponibilité',
  schedules: 'Scanner / Comply',
  digest: 'Rapports',
  ssl: 'Certificats',
  dependencies: 'Dépendances',
};

/** Une périodicité en millisecondes, dite comme on la dirait à voix haute. */
function everyLabel(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `toutes les ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `toutes les ${hours} h`;
  return `toutes les ${Math.round(hours / 24)} j`;
}
