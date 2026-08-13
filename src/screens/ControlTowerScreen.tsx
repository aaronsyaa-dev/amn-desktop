import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  History,
  Link2,
  LockKeyhole,
  Radar,
  ScanLine,
} from 'lucide-react';
import { SiteBadgeExport, SocDesk } from '../components/tracker/SocDesk';
import { CallLinkPanel } from '../components/call/CallLinkPanel';
import { AttentionPanel } from '../components/AttentionPanel';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import { useRemoteSites } from '../state/RemoteSitesContext';
import { useOrgContext } from '../state/OrgContextContext';
import { OrgAvatar } from '../components/org-rail/OrgAvatar';
import { bridge } from '../lib/bridge';
import { relativeTime } from '../lib/time';
import type { OrgAccessEntry } from '../shared/api';

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
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">Tour de contrôle</h1>
            <p className="mt-1 font-mono text-xs uppercase tracking-widest text-text-muted">
              {parc.total} site{parc.total > 1 ? 's' : ''} supervisé{parc.total > 1 ? 's' : ''} ·{' '}
              {organizations.length} organisation{organizations.length > 1 ? 's' : ''} cliente
              {organizations.length > 1 ? 's' : ''}
              {suspended > 0 ? ` · ${suspended} suspendue${suspended > 1 ? 's' : ''}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/*
              Le lien d'appel vivait dans Équipe, c'est-à-dire dans la messagerie
              interne entre Aaron et Mohamed. Or il ne sert jamais à joindre un
              collègue : il sert à parler à un PROSPECT, quelqu'un qui n'a pas
              encore de compte et n'est pas encore une organisation.

              Sa place est ici, dans l'espace « transverse » — celui des
              incidents, des produits et des organisations, c'est-à-dire tout ce
              qui regarde vers l'extérieur. Équipe regarde vers l'intérieur.
            */}
            <button
              type="button"
              onClick={() => setLinkPanel(true)}
              title="Créer un lien d’appel pour un prospect sans compte"
              className="flex min-h-11 items-center gap-2 border border-dashed border-border px-3 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            >
              <Link2 size={15} strokeWidth={1.75} />
              Lien d’appel
            </button>
            <Vital label="En ligne" value={parc.online} />
            <Vital label="Dégradés" value={parc.degraded} tone={parc.degraded > 0 ? 'warn' : 'calm'} />
            <Vital label="Hors ligne" value={parc.offline} tone={parc.offline > 0 ? 'alert' : 'calm'} />
          </div>
        </div>
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

function Vital({
  label,
  value,
  tone = 'calm',
}: {
  label: string;
  value: number;
  tone?: 'calm' | 'warn' | 'alert';
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-center">
      <p
        className={`tnum text-lg font-semibold leading-none ${
          tone === 'alert' ? 'text-danger' : 'text-text-primary'
        }`}
      >
        {value}
      </p>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-text-muted">{label}</p>
    </div>
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

      <ul className="divide-y divide-border">
        {organizations.slice(0, 6).map((org) => (
          <li key={org.id}>
            <button
              type="button"
              onClick={() => void enterOrganization(org.id)}
              disabled={entering === org.id}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover disabled:opacity-60"
            >
              <OrgAvatar name={org.name} logoDataUrl={org.logoDataUrl} size={34} rounded="rounded-xl" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-text-primary">{org.name}</span>
                <span className="block font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  {org.userCount} compte{org.userCount > 1 ? 's' : ''}
                  {org.lastActivityAt
                    ? ` · activité ${relativeTime(org.lastActivityAt)}`
                    : ' · aucune activité'}
                </span>
              </span>
              {org.status === 'suspended' ? (
                <span className="flex-shrink-0 rounded-md border border-danger/40 bg-danger/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-danger">
                  Suspendue
                </span>
              ) : (
                <motion.span
                  className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-success"
                  animate={{ opacity: [1, 0.35, 1] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                  aria-hidden
                />
              )}
              <ArrowRight
                size={14}
                strokeWidth={2}
                className="flex-shrink-0 text-text-muted"
                aria-hidden
              />
            </button>
          </li>
        ))}
      </ul>
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
