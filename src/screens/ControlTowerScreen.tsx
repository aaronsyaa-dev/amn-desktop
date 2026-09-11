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
  MonitorPlay,
} from 'lucide-react';
import { SiteBadgeExport, SocDesk } from '../components/tracker/SocDesk';
import { SiteStatusPageExport } from '../components/tracker/StatusPageExport';
import { CallLinkPanel } from '../components/call/CallLinkPanel';
import { AttentionPanel } from '../components/AttentionPanel';
import { useAttention } from '../state/useAttention';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import { useRemoteSites } from '../state/RemoteSitesContext';
import { useOrgContext } from '../state/OrgContextContext';
import { bridge } from '../lib/bridge';
import { relativeTime } from '../lib/time';
import { ScreenHeader } from '../components/ScreenHeader';
import { TourExceptions } from '../components/tour/TourExceptions';
import { OrgBanner } from '../components/org-rail/OrgBanner';
import { useParcInsights } from '../state/parcInsights';
import { computeTrend } from '../lib/trend';
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
  // Évalué ici et passé au panneau : une seule lecture, une seule minuterie.
  const attention = useAttention();

  const parc = useMemo(() => {
    const online = sites.filter((s) => s.status ==='online').length;
    const degraded = sites.filter((s) => s.status ==='degraded').length;
    const offline = sites.filter((s) => s.status ==='offline').length;
    return { total: sites.length, online, degraded, offline };
  }, [sites]);

  const suspended = organizations.filter((o) => o.status === 'suspended').length;
  /*
    `releve`, et non `parc` : ce nom-là est déjà celui des SITES supervisés,
    juste au-dessus. Deux « parcs » dans le même écran finiraient par se
    confondre à la relecture, et ils ne comptent pas la même chose.
  */
  const releve = useParcInsights();
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
          description={
            /*
              CE QUI FAISAIT « FAUX » (BLOC B), premier point.

              « On dirait une fausse où tout est faux dessus, même si c'est
              vrai. » Un parc vide affichait quatre relevés à zéro alignés :
              SITES 0 · EN LIGNE 0 · DÉGRADÉS 0 · HORS LIGNE 0. Or un zéro dans
              une case de mesure ne se lit pas comme « il n'y en a pas », il se
              lit comme un capteur débranché — c'est ce que tout le monde a
              appris à croire devant un tableau de bord. Quatre à la suite, et
              l'écran entier passe pour une maquette.

              Quand il n'y a rien à mesurer, on l'écrit en toutes lettres et on
              retire les cases. Une phrase est un fait ; un zéro est un doute.
            */
            parc.total === 0
              ? 'Aucun site n’est supervisé pour l’instant — les relevés du parc apparaîtront dès le premier tracker installé.'
              : 'Décider : ce qui attend une décision d’abord, puis le parc, les clientes et les rondes de fond.'
          }
          stats={[
            ...(parc.total === 0
              ? []
              : [
                  { label: 'Sites', value: parc.total },
                  { label: 'En ligne', value: parc.online },
                  { label: 'Dégradés', value: parc.degraded, emphasis: parc.degraded > 0 },
                  { label: 'Hors ligne', value: parc.offline, emphasis: parc.offline > 0 },
                ]),
            { label: 'Clientes', value: organizations.length },
            /*
              CE QUE FONT LES CLIENTES, PAS SEULEMENT COMBIEN ELLES SONT
              (BLOCS E ET F)

              « Clientes : 4 » est un état civil. Ces deux relevés-ci répondent
              aux deux questions qu'on se pose vraiment en ouvrant la console :
              combien s'en servent cette semaine, et combien travaillent à
              l'instant où je regarde.

              « Au travail », et non « En ligne » : ce libellé-là est déjà pris,
              deux relevés plus haut, par les SITES supervisés. Deux « En
              ligne » côte à côte comptant des choses différentes seraient lus
              l'un pour l'autre.

              Les deux disparaissent tant que le relevé n'est pas arrivé —
              `ScreenHeader` retire une colonne dont la valeur est `undefined`.
              Un zéro d'attente serait pris pour un zéro mesuré.
            */
            {
              label: releve.data ? `Actives (${releve.data.windowDays} j)` : 'Actives',
              // Plus de flèche : voir le commentaire jumeau d'OrganizationsScreen —
              // la tendance du volume se dit en toutes lettres dans l'infobulle.
              value: releve.data ? releve.data.totals.active7d : undefined,
              title: releve.data
                ? `Clientes ayant écrit quelque chose sur ${releve.data.windowDays} jours. Volume : ${computeTrend(releve.data.totals.records7d, releve.data.totals.previous7d).sentence}.`
                : undefined,
            },
            {
              label: 'Au travail',
              value: releve.data && !releve.stale ? releve.data.totals.connectedOrgs : undefined,
              title: 'Espaces clients ayant au moins une connexion ouverte à l’instant.',
            },
            ...(suspended > 0 ? [{ label: 'Suspendues', value: suspended, emphasis: true }] : []),
          ]}
          actions={
            <>
              {/* Le mur, pour un deuxième écran : chaque site un point qui
                  respire, un incident l'embrase — voir MurDeControle. */}
              <Link
                to="/salle"
                aria-label="Salle de contrôle"
                title="Le mur de supervision, en plein écran — à poser sur un deuxième moniteur"
                className="flex min-h-11 items-center gap-2 border border-border px-3 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
              >
                <MonitorPlay size={15} strokeWidth={1.9} />
                {/* À 390 px, trois actions étiquetées débordaient de 10 px —
                    c'est check:largeur qui l'a dit. Le mot se replie, le
                    geste reste nommé (aria-label + title). */}
                <span className="hidden sm:inline">Salle de contrôle</span>
              </Link>
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
              <Link2 size={15} strokeWidth={1.9} />
              Lien d’appel
            </button>
            </>
          }
        />
      </StaggerItem>

      {/* LES EXCEPTIONS D'ABORD (Bloc 7) : ce qui attend une décision, en un geste chacun, avant le parc. */}
      <StaggerItem>
        <TourExceptions />
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
        <AttentionPanel state={attention} />
      </StaggerItem>

      {/* Le mur : incidents inter-sites, origine des visiteurs, activité horaire. */}
      <StaggerItem>
        <SocDesk withBadgeExport={false} apercu={6} />
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

      <StaggerItem>
        <SiteStatusPageExport />
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
        <Icon size={20} strokeWidth={1.9} />
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
        <Building2 size={15} strokeWidth={1.9} className="text-text-secondary" />
        <h2 className="mr-auto text-sm font-semibold text-text-primary">Organisations clientes</h2>
        <Link
          to="/tour/organisations"
          className="-my-2 flex items-center gap-1 py-2 font-mono text-[10px] uppercase tracking-widest text-text-muted transition-colors hover:text-text-primary"
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
            Créez-en une depuis le « + » du rail, à gauche : l’organisation, son compte
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
        <History size={15} strokeWidth={1.9} className="text-text-secondary" />
        <h2 className="mr-auto text-sm font-semibold text-text-primary">Derniers accès</h2>
        <Link
          to="/tour/journal"
          className="-my-2 flex items-center gap-1 py-2 font-mono text-[10px] uppercase tracking-widest text-text-muted transition-colors hover:text-text-primary"
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

/**
 * Le journal est lu par des humains : « enter » n'est pas une phrase.
 *
 * Et il n'est pas lu que par nous : une cliente relit ses propres lignes dans
 * ses paramètres. Une clé technique brute y serait à la fois illisible et
 * inquiétante — « member_role_changed » ressemble à une erreur, pas à un
 * geste que sa propre associée vient de faire.
 *
 * `npm run check:journal` croise cette liste avec `ACCESS_LOG_ACTIONS`
 * (amn-api) et avec ce que les routes écrivent RÉELLEMENT. Les trois avaient
 * divergé : la liste du serveur ignorait `user_removed`, écrite depuis des
 * mois, et quatre gestes sensibles n'étaient tracés nulle part.
 */
export const ACCESS_VERB: Record<string, string> = {
  enter: 'a ouvert le dossier de',
  leave: 'a quitté le dossier de',
  suspend: 'a suspendu',
  reactivate: 'a réactivé',
  invite: 'a réémis une invitation pour',
  password: 'a réinitialisé un mot de passe chez',
  user_removed: 'a supprimé un compte chez',
  org_updated: 'a modifié les réglages de',
  plan_changed: 'a changé la formule de',
  // Un module ouvert ou fermé par-dessus la formule ; le détail dit lequel et
  // dans quel sens (ajouté hors formule, retiré de la formule, retour).
  module_opened: 'a ouvert un module chez',
  module_closed: 'a fermé un module chez',
  modules_reset: 'a remis la formule de',
  tags_changed: 'a étiqueté',
  // Le consentement : c'est la CLIENTE qui ferme ou rouvre à son prestataire.
  module_locked: 'a fermé un module à son prestataire chez',
  module_unlocked: 'a rouvert un module à son prestataire chez',
  announcement_sent: 'a déposé une annonce chez',
  member_suspended: 'a suspendu un membre de',
  member_reactivated: 'a réactivé un membre de',
  member_role_changed: 'a changé un rôle chez',
  // Le lien de bienvenue (Bloc 2) : émis par nous, lu puis consommé par elle.
  welcome_link_created: 'a émis un lien de bienvenue chez',
  welcome_revealed: 'a lu ses accès de bienvenue chez',
  welcome_consumed: 'a confirmé ses accès chez',
  // Une demande (message, place, mot de passe oublié) a reçu une réponse.
  request_answered: 'a répondu à une demande de',
  login: 's’est connecté chez',
  member_removed: 'a retiré un compte chez',
  org_created: 'a créé',
  // Ces deux-là ouvrent et referment une adresse PUBLIQUE : la formulation le
  // dit, parce que c'est la seule ligne du journal qui concerne des tiers.
  status_page_published: 'a publié la page de statut d’un site de',
  status_page_revoked: 'a retiré la page de statut d’un site de',
  // Une détection qui cesse de remonter pendant trente jours : la ligne dit
  // « mis en sourdine », pas « supprimé » — rien n'est supprimé.
  suppression_created: 'a mis une détection en sourdine chez',
  suppression_revoked: 'a rendu la parole à une détection chez',
  // Une maintenance annoncée : pendant sa fenêtre, plus rien ne réveille
  // personne sur ce site — quelle que soit la nature de l'alerte. C'est le
  // geste le plus large de la supervision, et la formulation le dit sans
  // détour plutôt que de parler de « fenêtre », qui ne veut rien dire pour
  // qui lit son propre journal.
  maintenance_declared: 'a annoncé une maintenance sur un site de',
  maintenance_cancelled: 'a annulé une maintenance annoncée chez',
};


/**
 * LA GARDE, DE FOND — une seule source de vérité (BLOC 0 de l'Automatique).
 *
 * Ce panneau lisait `monitor_runs`, la table de l'ancien ordonnanceur, que la
 * Garde ne remplit pas : la Tour disait « 6 en retard sur 7, passée il y a
 * 15 h » pendant que la Salle disait « dernière ronde il y a 1 min ». Il lit
 * désormais la même chose que la Salle — le battement du Capitaine et ses
 * rondes — par `/v1/admin/supervision`, qui le dérive de la Garde.
 *
 * Et il dit peu : le battement, le nombre de gardes, les retards s'il y en a,
 * la dernière interruption s'il y en a eu. Le détail est dans la Salle. Un
 * indicateur d'état ne bouge que quand l'état change : la lecture est faite
 * toutes les minutes, et le rendu ne change que si le texte change.
 */
function SupervisionPanel() {
  const [state, setState] = useState<SupervisionState | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      bridge()
        .remote.admin.supervision()
        .then((s) => { if (alive) { setState(s); setFailed(false); } })
        .catch(() => { if (alive && !state) setFailed(true); });
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => { alive = false; window.clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (failed || !state) return null;
  const b = state.battement;
  const retards = b?.enRetard ?? state.sweeps.filter((s) => s.overdue).map((s) => ({ agent: s.name, nom: SWEEP_LABELS[s.name] ?? s.name, retardMs: 0 }));
  const dernier = b?.dernierBattementAt ?? state.sweeps.map((s) => s.lastRunAt).filter(Boolean).sort().at(-1) ?? null;
  const vivante = Boolean(dernier) && Date.now() - Date.parse(dernier as string) < 5 * 60_000;
  const interruption = b?.derniereInterruption ?? null;

  return (
    <section className="panel panel-ticks" aria-label="La Garde, de fond" data-garde-fond={retards.length}>
      <header className="panel-head flex flex-wrap items-center gap-2 px-4 py-2.5">
        <Radar size={14} strokeWidth={1.9} className="text-text-secondary" />
        <h2 className="mr-auto text-[13px] font-semibold text-text-primary">La Garde, de fond</h2>
        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${retards.length > 0 ? 'bg-warning' : vivante ? 'bg-success live-dot' : 'bg-text-muted'}`} aria-hidden />
        <span className="eyebrow">{retards.length === 0 ? (vivante ? 'à l’heure' : 'sans battement') : `${retards.length} en retard`}</span>
      </header>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
        <p className="text-[13px] text-text-primary">
          {dernier ? `Dernier battement ${relativeTime(dernier)}` : 'Aucun battement encore'}
          {b ? <span className="text-text-secondary"> · {b.agents} gardes</span> : null}
        </p>
        <Link to="/garde" className="eyebrow text-text-secondary hover:text-text-primary">Voir la Salle →</Link>
      </div>
      {retards.length > 0 && (
        <ul className="divide-y divide-border border-t border-border">
          {retards.map((r) => (
            <li key={r.agent} className="flex items-center gap-3 px-4 py-2 text-[12px]">
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-warning" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-text-primary">{r.nom}</span>
              <span className="eyebrow">{r.retardMs > 0 ? `en retard de ${everyLabel(r.retardMs)}` : 'en retard'}</span>
            </li>
          ))}
        </ul>
      )}
      {interruption && Date.now() - Date.parse(interruption.a) < 48 * 3_600_000 && (
        <p className="eyebrow border-t border-border px-4 py-2 text-warning" data-garde-interruption>
          interrompue {everyLabel(interruption.dureeMs)}, reprise {relativeTime(interruption.a)}
        </p>
      )}
    </section>
  );
}

const SWEEP_LABELS: Record<string, string> = {
  heartbeat: 'Battements',
  escalation: 'Escalade',
  availability: 'Disponibilité',
  schedules: 'Scanner / Comply',
  digest: 'Rapports',
  ssl: 'Certificats',
  dependencies: 'Dépendances',
};

/** Une durée en millisecondes, dite comme on la dirait à voix haute. */
function everyLabel(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.round(hours / 24)} j`;
}
