import React, { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  CalendarDays,
  CheckSquare,
  ExternalLink,
  FileText,
  NotebookPen,
  Plus,
  ReceiptEuro,
  Settings2,
  Timer,
  Trash2,
  Wallet,
} from 'lucide-react';
import { useProjects } from '../state/useProjects';
import { useExpenses } from '../state/useExpenses';
import { useClients } from '../state/useClients';
import { isModuleEnabled } from '../data/spaces';
import { formatCents } from '../lib/money';
import {
  fieldEnabled,
  fieldLabel,
  isDone,
  statusLabel,
  type OptionalFieldKey,
  type Project,
  type ProjectConfig,
  type ProjectPriority,
} from '../state/projectEngine';
import { ProjectConfigPanel } from '../components/projects/ProjectConfigPanel';
import { formatDay, formatShortDay, isoDay } from '../state/useInvoices';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { EmptyState, FirstRun } from '../components/EmptyState';
import { useLangue, t as tr } from '../i18n';

/**
 * Projets — la première application concrète du moteur (BLOC A).
 *
 * L'écran ne connaît aucun statut, aucune structure, aucun intitulé : il lit
 * la configuration de l'organisation et se dessine à partir d'elle. C'est ce
 * qui fait qu'un second profil métier ne demande pas une seconde version de
 * cet écran.
 *
 * Le panneau de détail montre, à côté des champs du projet, CE QUI S'Y
 * RATTACHE — tâches, rendez-vous, notes, factures. Ces éléments ne sont pas
 * stockés ici : ils vivent dans leurs collections et portent l'identifiant du
 * projet. Le projet est une vue, pas une base parallèle.
 */

const PRIORITY_LABEL: Record<ProjectPriority, string> = {
  low: 'Basse',
  normal: 'Normale',
  high: 'Haute',
};

export function ProjectsScreen() {
  const {
    config,
    saveConfig,
    projects,
    createProject,
    updateProject,
    deleteProject,
    attachmentsOf,
    attachmentCount,
  } = useProjects();
  // Abonnement à la langue : sans lui, l'écran gardait les libellés de la
  // langue active AU MONTAGE et ne suivait pas un changement en cours de route.
  useLangue();
  const { clients } = useClients();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  /*
    DEUX FAÇONS DE REGARDER LE MÊME PORTEFEUILLE, et elles ne répondent pas à
    la même question. La liste répond à « où en est CE projet » — c'est la vue
    de travail, celle qui ouvre une fiche. La frise répond à « qu'est-ce qui
    glisse » : les échéances côte à côte sur la même règle de temps, ce qu'une
    liste ne peut pas montrer, puisqu'elle range les projets les uns SOUS les
    autres et jamais les uns EN FACE des autres. C'est l'objet dominant que le
    système de design donne à cet écran, donc la vue d'ouverture.
  */
  const [vue, setVue] = useState<'frise' | 'liste'>('frise');

  const today = isoDay();

  const visible = useMemo(
    () => (statusFilter === 'all' ? projects : projects.filter((p) => p.status === statusFilter)),
    [projects, statusFilter],
  );
  const selected = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId],
  );

  const newProject = () => {
    const id = createProject({ title: tr('hist.projects.nouveauProjet') });
    setSelectedId(id);
    setStatusFilter('all');
    setVue('liste');
  };

  /* La frise ne se dessine que si le moteur a un champ d'échéance activé :
     sans date, il n'y a pas de règle de temps sur quoi poser les projets. */
  const friseActive = fieldEnabled(config, 'deadline') && projects.length > 0;
  const frise = useMemo(
    () => (friseActive ? construireFrise(projects, config, today) : null),
    [friseActive, projects, config, today],
  );

  /* La phrase sous le titre dit la période couverte, puis nomme ce qui glisse. */
  const resume = useMemo(() => {
    if (!frise) return tr('hist.projects.toutCeQuiS');
    const periode = tr('hist.projects.periodeFrise', {
      debut: moisDe(frise.debut),
      fin: moisDe(frise.fin),
    });
    const retard = frise.lignes.find((l) => l.enRetard);
    return retard
      ? `${periode} ${tr('hist.projects.aDepasseSonEcheance', { projet: retard.project.title })}`
      : `${periode} ${tr('hist.projects.aucuneEcheanceDepassee')}`;
  }, [frise]);

  return (
    /*
      La hauteur pleine ne se justifie que s'il y a une liste à faire défiler
      (BLOC A). `screen-h` force la section à occuper tout l'écran ; avec une
      liste vide, ça produit un panneau bordé de 700 px contenant une phrase.
      Sans liste, la section se dimensionne sur son contenu.
    */
    <section className={`flex flex-col gap-4 ${projects.length === 0 || vue === 'frise' ? '' : 'screen-h'}`}>
      <ScreenHeader
        eyebrow={tr('hist.surtitre', { module: tr('hist.projects.titre') })}
        title={tr('hist.projects.titre')}
        description={resume}
        stats={[
          { label: 'Projets', value: projects.length },
          /*
            Le premier statut configuré est celui d'un projet qui DÉMARRE, et
            le dernier celui d'un projet fini : c'est l'ordre dans lequel la
            configuration les présente. On compte donc « en cours » comme tout
            ce qui n'est pas au dernier statut, plutôt que de coder en dur un
            libellé que chaque organisation peut renommer.
          */
          {
            label: 'En cours',
            value: projects.filter((p) => p.status !== config.statuses[config.statuses.length - 1]?.key)
              .length,
            emphasis: true,
          },
          { label: tr('hist.projects.affiches'), value: visible.length, title: tr('hist.projects.apresLeFiltreDe') },
        ]}
        actions={
        <div className="flex flex-shrink-0 items-center gap-2">
          {friseActive && (
            <div className="flex border border-border">
              {(['frise', 'liste'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setVue(v);
                    if (v === 'frise') setSelectedId(null);
                  }}
                  className={`min-h-11 px-3 font-mono text-[10px] font-bold uppercase tracking-[0.2em] transition-colors md:min-h-0 md:py-2 ${
                    vue === v ? 'bg-raised text-text-primary' : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {v === 'frise' ? tr('hist.projects.vueFrise') : tr('hist.projects.vueListe')}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setConfigOpen(true)}
            title={tr('hist.projects.configurerLeModule')}
            aria-label={tr('hist.projects.configurerLeModule')}
            className="flex h-11 w-11 items-center justify-center border border-border text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:h-9 md:w-9"
          >
            <Settings2 size={16} strokeWidth={1.9} />
          </button>
          <button
            type="button"
            onClick={newProject}
            className="flex h-11 items-center gap-2 bg-accent px-3 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover md:h-9"
          >
            <Plus size={16} strokeWidth={2.25} />
            <span className="hidden sm:inline">{tr('hist.projects.nouveauProjet')}</span>
            <span className="sm:hidden">Projet</span>
          </button>
        </div>
        }
      >
      {/* Les filtres appartiennent à la liste : la frise montre tout le temps,
          et un filtre de statut la trouerait sans rien dire de plus. */}
      {vue === 'liste' && (
      <div className="flex flex-shrink-0 gap-1.5 overflow-x-auto pb-0.5">
        <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>{tr('hist.projects.tous')}</FilterChip>
        {config.statuses.map((status) => (
          <FilterChip
            key={status.key}
            active={statusFilter === status.key}
            onClick={() => setStatusFilter(status.key)}
          >
            {status.label}
          </FilterChip>
        ))}
      </div>
      )}
      </ScreenHeader>

      {/*
        LA COLONNE DE DÉTAIL DISPARAÎT QUAND IL N'Y A RIEN À DÉTAILLER (BLOC A).

        C'est le vide le plus grand de toute l'application, et il ne venait
        d'aucun « état vide » : il venait de la MISE EN PAGE. Une grille
        maître/détail réserve les deux tiers de l'écran au détail, même quand la
        liste est vide — et on se retrouve devant 900 × 700 px de rien portant
        « SÉLECTIONNEZ UN PROJET », c'est-à-dire une consigne impossible à
        suivre puisqu'il n'y a rien à sélectionner.

        Liste vide → une seule colonne, la largeur d'une colonne de lecture. Le
        détail revient à la seconde où un premier projet existe. Rien n'est
        ajouté ; une colonne est retirée quand elle n'a pas de sujet.
      */}
      {vue === 'frise' && frise ? (
        <div className="flex flex-col gap-6">
          <FriseDesEcheances
            frise={frise}
            onOuvrir={(id) => {
              setSelectedId(id);
              setVue('liste');
            }}
          />
          <ColonnesDeStatut
            projects={projects}
            config={config}
            today={today}
            onOuvrir={(id) => {
              setSelectedId(id);
              setVue('liste');
            }}
          />
        </div>
      ) : (
      <div
        className={`grid min-h-0 flex-1 gap-4 ${
          projects.length === 0 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-[340px_1fr]'
        }`}
      >
        <div
          className={`min-h-0 flex-col border border-border bg-surface ${
            selected ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="flex-shrink-0 border-b border-border px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            {visible.length} projet{visible.length > 1 ? 's' : ''}
          </div>
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto"
          >
            {visible.length === 0 ? (
              /*
                PROJETS (BLOC A) — une étiquette en capitales là où il fallait
                une phrase. « AUCUN PROJET » ne dit ni ce qu'est un projet ici,
                ni comment en ouvrir un.
              */
              <div className="px-4">
                {projects.length === 0 ? (
                  <FirstRun title={tr('hist.projects.aucunProjetOuvert')}>{tr('hist.projects.unProjetRassembleCe')}</FirstRun>
                ) : (
                  <EmptyState quiet>{tr('hist.projects.rienDansCeFiltre')}</EmptyState>
                )}
              </div>
            ) : (
              visible.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  label={statusLabel(config, project.status)}
                  done={isDone(config, project)}
                  late={Boolean(project.deadline) && project.deadline < today && !isDone(config, project)}
                  attachments={attachmentCount(project.id)}
                  showStructure={fieldEnabled(config, 'structure')}
                  showNextAction={fieldEnabled(config, 'nextAction')}
                  active={project.id === selectedId}
                  onSelect={() => setSelectedId(project.id)}
                />
              ))
            )}
          </motion.div>
        </div>

        {selected ? (
          <ProjectDetail
            key={selected.id}
            project={selected}
            clients={clients}
            attachments={attachmentsOf(selected.id)}
            today={today}
            onBack={() => setSelectedId(null)}
            onPatch={(patch) => updateProject(selected.id, patch)}
            onDelete={() => {
              deleteProject(selected.id);
              setSelectedId(null);
            }}
          />
        ) : projects.length === 0 ? null : (
          <div className="hidden items-center justify-center border border-border bg-surface font-mono text-xs uppercase tracking-widest text-text-muted md:flex">{tr('hist.projects.selectionnezUnProjet')}</div>
        )}
      </div>
      )}

      <AnimatePresence>
        {configOpen && (
          <ProjectConfigPanel
            config={config}
            onSave={saveConfig}
            onClose={() => setConfigOpen(false)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

/* ─── LA FRISE ─────────────────────────────────────────────────────────────
   L'objet dominant de l'écran Projets : dix semaines sur une même règle, et
   les échéances les unes EN FACE des autres. Tout ce qui suit est du calcul
   de dates — il vit ici, en dehors des composants, pour qu'on puisse le lire
   sans traverser du JSX.
   ──────────────────────────────────────────────────────────────────────── */

const JOUR_MS = 86_400_000;
const SEMAINES_AFFICHEES = 10;
/* Une semaine de recul avant aujourd'hui : ce qui vient d'être livré reste
   visible, et la ligne du jour n'est pas collée au bord gauche. */
const SEMAINES_DE_RECUL = 1;
/* Au-delà, la frise devient un mur et ne se lit plus. Le reste est dans les
   colonnes en dessous, qui, elles, comptent tout. */
const LIGNES_MAX = 6;

function lundiDe(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  /* getDay() rend 0 le dimanche : on le ramène à 7 pour que le lundi soit 1. */
  d.setDate(d.getDate() - ((d.getDay() || 7) - 1));
  return d;
}

/**
 * Le numéro de semaine ISO 8601 — celui qu'on écrit « S37 » et qui sert de
 * repère partagé dans à peu près tous les ateliers d'Europe.
 *
 * La règle ISO : la semaine 1 est celle qui contient le premier jeudi de
 * l'année. Le calcul classique consiste donc à se déplacer sur le JEUDI de la
 * semaine visée, puis à compter les semaines depuis le 1er janvier de l'année
 * de ce jeudi — ce qui range d'office le 31 décembre en semaine 1 quand il le
 * faut, sans cas particulier écrit à la main.
 */
function semaineIso(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const janvier = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - janvier.getTime()) / JOUR_MS + 1) / 7);
}

function moisDe(date: Date): string {
  return date.toLocaleDateString('fr-FR', { month: 'long' });
}

interface LigneFrise {
  project: Project;
  /** Part de la largeur totale, en pourcentage, bornée à la fenêtre affichée. */
  debut: number;
  fin: number;
  /** Le dépassement, de l'échéance à aujourd'hui. Zéro si le projet tient. */
  depassement: number;
  enRetard: boolean;
}

interface Frise {
  debut: Date;
  fin: Date;
  semaines: number[];
  /** Position de la ligne du jour, en pourcentage de la largeur. */
  aujourdhui: number;
  lignes: LigneFrise[];
}

function construireFrise(projects: Project[], config: ProjectConfig, today: string): Frise {
  const debut = lundiDe(new Date());
  debut.setDate(debut.getDate() - SEMAINES_DE_RECUL * 7);
  const fin = new Date(debut);
  fin.setDate(fin.getDate() + SEMAINES_AFFICHEES * 7);
  const etendue = fin.getTime() - debut.getTime();
  /* Une position en pourcentage, ramenée dans la fenêtre : un projet commencé
     il y a six mois entre par le bord gauche au lieu de sortir du cadre. */
  const part = (instant: number) => Math.min(100, Math.max(0, ((instant - debut.getTime()) / etendue) * 100));

  const semaines: number[] = [];
  for (let i = 0; i < SEMAINES_AFFICHEES; i += 1) {
    const jour = new Date(debut);
    jour.setDate(jour.getDate() + i * 7);
    semaines.push(semaineIso(jour));
  }

  /*
    Les dépassées d'abord — c'est la raison d'être de la frise — puis les autres
    par échéance. `Map` sur l'identifiant : une dépassée est AUSSI dans la
    fenêtre affichée, et la concaténation naïve la dessinait deux fois.
  */
  const enCours = projects.filter((p) => !isDone(config, p) && p.deadline);
  const parEcheance = (a: Project, b: Project) => a.deadline.localeCompare(b.deadline);
  const ordonnees = [
    ...enCours.filter((p) => p.deadline < today).sort(parEcheance),
    ...enCours.filter((p) => p.deadline >= isoDay(debut)).sort(parEcheance),
  ];
  const retenues = [...new Map(ordonnees.map((p) => [p.id, p])).values()].slice(0, LIGNES_MAX);

  const maintenant = new Date(`${today}T00:00:00`).getTime();
  const lignes: LigneFrise[] = retenues.map((project) => {
    const echeance = new Date(`${project.deadline}T00:00:00`).getTime();
    const depart = new Date(project.createdAt || project.updatedAt).getTime();
    const enRetard = project.deadline < today;
    return {
      project,
      debut: part(depart),
      fin: part(echeance),
      depassement: enRetard ? part(maintenant) - part(echeance) : 0,
      enRetard,
    };
  });

  return {
    debut,
    fin,
    semaines,
    aujourdhui: part(maintenant),
    lignes,
  };
}

function FriseDesEcheances({
  frise,
  onOuvrir,
}: {
  frise: Frise;
  onOuvrir: (id: string) => void;
}) {
  const semaineCourante = semaineIso(new Date());
  return (
    <div className="panel-raised panel-raised-wide overflow-x-auto">
      <div className="min-w-[760px]">
        {/* La règle de temps. */}
        <div className="flex border-b border-border-raised">
          <div className="eyebrow w-[240px] flex-shrink-0 px-5 py-3">{tr('hist.projects.colProjet')}</div>
          {frise.semaines.map((s) => (
            <div
              key={s}
              className={`flex-1 border-l border-border py-3 text-center font-mono text-[9.5px] font-bold uppercase tracking-[0.2em] ${
                s === semaineCourante ? 'bg-raised text-text-primary' : 'text-text-muted'
              }`}
            >
              S{s}
            </div>
          ))}
        </div>

        {/* Le corps : une ligne par projet, et la ligne du jour par-dessus. */}
        <div className="relative">
          {/*
            LA LIGNE DU JOUR N'EST PAS EN AMBRE, et c'est délibéré.

            La maquette la dessine ambre avec sa pastille « AUJ. ». Mais l'ambre
            de cet écran est nommé par la table du paquet : « la barre de
            retard ». Aujourd'hui n'est pas une décision — c'est un repère, et
            il y en a un sur tous les écrans qui montrent du temps. Lui donner
            l'ambre mettrait deux signaux sur l'écran, c'est-à-dire aucun.
          */}
          <span
            className="pointer-events-none absolute inset-y-0 z-10 w-px bg-[#4a4a48]"
            style={{ left: `calc(240px + (100% - 240px - 20px) * ${frise.aujourdhui / 100})` }}
            aria-hidden
          />
          {frise.lignes.map((ligne) => (
            <button
              key={ligne.project.id}
              type="button"
              onClick={() => onOuvrir(ligne.project.id)}
              /*
                UN SEUL GROUPE AMBRE POUR TOUT L'ÉCRAN, partagé par les lignes.

                Le libellé « échéance dépassée » et la barre disent la même
                chose sur la même ligne, et deux projets qui glissent ne sont
                pas deux signaux : c'est LE signal de la frise, « voici ce qui
                a glissé », écrit autant de fois qu'il y a de retards. Le
                groupe partagé rend cette lecture explicite, et `check:signal`
                les compte pour un.
              */
              data-signal-groupe={ligne.enRetard ? 'retard' : undefined}
              className="flex w-full items-stretch border-b border-[#161616] text-left transition-colors last:border-b-0 hover:bg-surface-hover"
            >
              <div className="w-[240px] flex-shrink-0 px-5 py-4">
                <p className="truncate text-[14.5px] font-semibold text-text-primary">{ligne.project.title}</p>
                {/* Deux lignes, pas une coupée : « PROCHAINE ACTION : MAQUET… »
                    ne dit rien de plus que « PROCHAINE ACTION ». */}
                <p
                  className={`eyebrow mt-1.5 line-clamp-2 leading-[1.5] ${ligne.enRetard ? 'text-signal' : ''}`}
                >
                  {ligne.enRetard
                    ? tr('hist.projects.echeanceDepasseeLe', { date: formatShortDay(ligne.project.deadline) })
                    : ligne.project.nextAction
                      ? tr('hist.projects.prochaineAction', { quoi: ligne.project.nextAction })
                      : tr('hist.projects.sansProchaineAction')}
                </p>
              </div>
              <div className="relative flex-1 py-4 pr-5">
                {/* La barre ne porte pas de texte : elle fait parfois quarante
                    pixels de large, et « EN RETARD » y devenait « EN R… ». Le
                    mot est dans la colonne de gauche, où il tient toujours. */}
                <span
                  className={`absolute top-1/2 h-[22px] -translate-y-1/2 ${
                    ligne.enRetard ? 'bg-signal' : 'bg-[#2b2b2b]'
                  }`}
                  style={{
                    left: `${ligne.debut}%`,
                    width: `${Math.max(1.5, ligne.fin - ligne.debut)}%`,
                  }}
                />
                {/* Le dépassement : rayé, parce que ce temps-là n'était pas prévu. */}
                {ligne.depassement > 0 && (
                  <span
                    className="absolute top-1/2 h-[22px] -translate-y-1/2 bg-signal-muted"
                    style={{
                      left: `${ligne.fin}%`,
                      width: `${ligne.depassement}%`,
                      backgroundImage:
                        'repeating-linear-gradient(135deg, var(--color-signal) 0 2px, transparent 2px 6px)',
                    }}
                    aria-hidden
                  />
                )}
              </div>
            </button>
          ))}
          {frise.lignes.length === 0 && (
            <p className="px-5 py-8 text-[13.5px] text-text-muted">{tr('hist.projects.aucuneEcheanceDansLa')}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ColonnesDeStatut({
  projects,
  config,
  today,
  onOuvrir,
}: {
  projects: Project[];
  config: ProjectConfig;
  today: string;
  onOuvrir: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {config.statuses.map((statut) => {
        const siens = projects.filter((p) => p.status === statut.key);
        const dates = siens.filter((p) => p.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline));
        const sansDate = siens.length - dates.length;
        return (
          <div key={statut.key} className="panel flex flex-col gap-4 p-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="eyebrow">{statut.label}</p>
              <p className="tnum font-mono text-[23px] font-semibold leading-none tracking-[-0.03em] text-text-primary">
                {siens.length}
              </p>
            </div>
            {siens.length === 0 ? (
              <p className="text-[13.5px] text-text-muted">{tr('hist.projects.aucunDansCeStatut')}</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {dates.slice(0, 3).map((p) => {
                  const retard = p.deadline < today && !statut.done;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => onOuvrir(p.id)}
                        className="flex w-full items-baseline gap-3 border-l border-border-strong pl-3 text-left transition-colors hover:border-text-secondary"
                      >
                        <span className="min-w-0 flex-1 truncate text-[13.5px] text-text-body">{p.title}</span>
                        <span
                          className={`tnum flex-shrink-0 font-mono text-[11px] tracking-[0.1em] ${
                            retard ? 'text-text-secondary' : 'text-text-muted'
                          }`}
                        >
                          {formatShortDay(p.deadline)}
                        </span>
                      </button>
                    </li>
                  );
                })}
                {sansDate > 0 && (
                  <li className="pl-3 text-[13.5px] text-text-muted">
                    {tr('hist.projects.nSansEcheance', { n: sansDate })}
                  </li>
                )}
                {dates.length > 3 && (
                  <li className="pl-3 text-[13.5px] text-text-muted">
                    {tr('hist.projects.nDePlus', { n: dates.length - 3 })}
                  </li>
                )}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-11 flex-shrink-0 items-center border px-2.5 font-mono text-[10px] uppercase tracking-widest transition-colors md:min-h-0 md:py-1.5 ${
        active
          ? 'border-border-strong bg-accent-muted text-text-primary'
          : 'border-border text-text-muted hover:text-text-secondary'
      }`}
    >
      {children}
    </button>
  );
}

function ProjectRow({
  project,
  label,
  done,
  late,
  attachments,
  showStructure,
  showNextAction,
  active,
  onSelect,
}: {
  project: Project;
  label: string;
  done: boolean;
  late: boolean;
  attachments: number;
  showStructure: boolean;
  showNextAction: boolean;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      variants={staggerItem}
      type="button"
      onClick={onSelect}
      className={`flex min-h-11 w-full flex-col gap-1 px-4 py-3 text-left transition-colors ${
        active ? 'bg-accent-muted' : 'hover:bg-surface-hover'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex-shrink-0 border px-1.5 py-px font-mono text-[9px] uppercase tracking-widest ${
            done ? 'border-border text-text-muted' : 'border-border-strong text-text-secondary'
          }`}
        >
          {label}
        </span>
        {showStructure && project.structure && (
          <span className="truncate font-mono text-[9px] uppercase tracking-[0.18em] text-text-muted">
            {project.structure}
          </span>
        )}
        {attachments > 0 && (
          <span className="ml-auto flex-shrink-0 font-mono text-[9px] uppercase tracking-widest text-text-muted">
            {attachments} lié{attachments > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <p className={`truncate text-sm ${done ? 'text-text-muted' : 'text-text-primary'}`}>
        {project.title || 'Sans titre'}
      </p>

      {/*
        La prochaine action est le champ le plus utile de l'écran : c'est la
        seule ligne qui dit quoi faire, donc elle est lisible sans ouvrir le
        projet.
      */}
      {showNextAction && project.nextAction && !done && (
        <p className="truncate text-xs text-text-secondary">→ {project.nextAction}</p>
      )}

      {project.deadline && (
        <p
          className={`font-mono text-[10px] uppercase tracking-widest ${
            late ? 'text-danger' : 'text-text-muted'
          }`}
        >
          {late ? 'En retard · ' : 'Échéance '}
          {formatDay(project.deadline)}
        </p>
      )}
    </motion.button>
  );
}

/* -------------------------------- Le détail ------------------------------- */

interface Attachments {
  tasks: { id: string; title?: string }[];
  appointments: { id: string; title?: string; startsAt?: string }[];
  notes: { id: string; title?: string }[];
  invoices: { id: string; number?: string }[];
  expenses: { id: string }[];
  timeEntries: { id: string }[];
}

function ProjectDetail({
  project,
  clients,
  attachments,
  today,
  onBack,
  onPatch,
  onDelete,
}: {
  project: Project;
  clients: { id: number; name: string; company: string }[];
  attachments: Attachments;
  today: string;
  onBack: () => void;
  onPatch: (patch: Partial<Project>) => void;
  onDelete: () => void;
}) {
  const { config } = useProjects();
  const { projectBudget } = useExpenses();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const spent = projectBudget(project.id);

  const late = Boolean(project.deadline) && project.deadline < today && !isDone(config, project);

  const show = (key: OptionalFieldKey) => fieldEnabled(config, key);
  const label = (key: OptionalFieldKey) => fieldLabel(config, key);

  return (
    <div className="flex min-h-0 flex-col border border-border bg-surface">
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-border px-3 py-2.5 md:px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label={tr('hist.projects.retourALaListe')}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center text-text-secondary transition-colors hover:text-text-primary md:hidden"
        >
          <ArrowLeft size={18} strokeWidth={2} />
        </button>
        <input
          value={project.title}
          onChange={(e) => onPatch({ title: e.target.value })}
          placeholder="Titre du projet"
          className="input-focus min-w-0 flex-1 border border-transparent bg-transparent px-1 text-base font-semibold text-text-primary outline-none hover:border-border focus:border-border"
        />
        <button
          type="button"
          onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
          onBlur={() => setConfirmDelete(false)}
          /* Bouton sans texte tant qu'il n'est pas armé : sans nom
             accessible, il était invisible pour un lecteur d'écran comme
             pour un balayage automatique — un bouton destructeur ne peut
             pas être anonyme. */
          aria-label={tr('hist.projects.supprimerLeProjet')}
          title={tr('hist.projects.supprimerLeProjet')}
          className={`flex h-11 flex-shrink-0 items-center gap-1.5 border px-2.5 font-mono text-[10px] uppercase tracking-wider transition-colors md:h-9 ${
            confirmDelete
              ? 'border-danger bg-danger-muted text-danger'
              : 'border-border text-text-muted hover:text-danger'
          }`}
        >
          <Trash2 size={14} strokeWidth={2} />
          {confirmDelete ? 'Confirmer' : ''}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">
        {late && (
          <p className="mb-3 border border-border border-l-2 border-l-danger bg-surface px-3 py-2 text-xs leading-tight text-text-primary">
            <strong className="font-semibold">{tr('hist.projects.echeanceDepassee')}</strong> — attendue le{' '}
            {formatDay(project.deadline)}.
          </p>
        )}

        <Field label="Statut">
          <select
            value={project.status}
            onChange={(e) => onPatch({ status: e.target.value })}
            className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
          >
            {config.statuses.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>

        {show('nextAction') && (
          <Field label={label('nextAction')}>
            <input
              value={project.nextAction}
              onChange={(e) => onPatch({ nextAction: e.target.value })}
              placeholder={tr('hist.projects.laProchaineChoseA')}
              className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
            />
          </Field>
        )}

        {show('structure') && (
          <Field label={label('structure')}>
            <select
              value={project.structure}
              onChange={(e) => onPatch({ structure: e.target.value })}
              className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
            >
              <option value="">—</option>
              {config.structures.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              {/* Une valeur héritée d'une structure retirée de la liste reste
                  affichable : elle disparaîtrait sinon sans que personne ne
                  s'en aperçoive. */}
              {project.structure && !config.structures.includes(project.structure) && (
                <option value={project.structure}>{project.structure} (retirée)</option>
              )}
            </select>
          </Field>
        )}

        {show('client') && (
          <Field label={label('client')}>
            <select
              value={project.clientId || 0}
              onChange={(e) => onPatch({ clientId: Number(e.target.value) })}
              className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
            >
              <option value={0}>—</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company ? `${c.company} — ${c.name}` : c.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          {show('deadline') && (
            <Field label={label('deadline')}>
              <input
                type="date"
                value={project.deadline}
                onChange={(e) => onPatch({ deadline: e.target.value })}
                className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
              />
            </Field>
          )}
          {show('priority') && (
            <Field label={label('priority')}>
              <select
                value={project.priority}
                onChange={(e) => onPatch({ priority: e.target.value as ProjectPriority })}
                className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
              >
                {(Object.keys(PRIORITY_LABEL) as ProjectPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        {show('link') && (
          <Field label={label('link')}>
            <div className="flex gap-2">
              <input
                value={project.link}
                onChange={(e) => onPatch({ link: e.target.value })}
                placeholder="https://drive.google.com/…"
                className="input-focus min-h-11 min-w-0 flex-1 border border-border bg-bg px-3 text-sm text-text-primary outline-none"
              />
              {project.link && (
                <a
                  href={project.link}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={tr('hist.projects.ouvrirLeLien')}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center border border-border text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                >
                  <ExternalLink size={15} strokeWidth={1.9} />
                </a>
              )}
            </div>
          </Field>
        )}

        {config.extraFields.map((field) => (
          <Field key={field.key} label={field.label}>
            <input
              value={project.extra[field.key] ?? ''}
              onChange={(e) => onPatch({ extra: { ...project.extra, [field.key]: e.target.value } })}
              className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
            />
          </Field>
        ))}

        <Field label="Notes du projet">
          <textarea
            rows={3}
            value={project.notes}
            onChange={(e) => onPatch({ notes: e.target.value })}
            className="input-focus w-full resize-none border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
          />
        </Field>

        {/* ------------------------------------------------- rattachés ----- */}
        <div className="mt-5 border-t border-border pt-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{tr('hist.projects.rattacheACeProjet')}</p>
          <p className="mt-1 text-xs leading-relaxed text-text-secondary">{tr('hist.projects.cesElementsViventDans')}</p>

          <div className="mt-3 flex flex-col gap-2">
            <AttachmentGroup
              icon={CheckSquare}
              label="Tâches"
              count={attachments.tasks.length}
              onOpen={() => navigate('/tasks')}
            />
            <AttachmentGroup
              icon={CalendarDays}
              label="Rendez-vous"
              count={attachments.appointments.length}
              onOpen={() => navigate('/agenda')}
            />
            <AttachmentGroup
              icon={NotebookPen}
              label="Notes"
              count={attachments.notes.length}
              onOpen={() => navigate('/notes')}
            />
            <AttachmentGroup
              icon={ReceiptEuro}
              label="Factures"
              count={attachments.invoices.length}
              onOpen={() => navigate('/facturation')}
            />
            {isModuleEnabled('expenses') && (
              <AttachmentGroup
                icon={Wallet}
                label={tr('hist.projects.depenses')}
                count={attachments.expenses.length}
                onOpen={() => navigate('/depenses')}
              />
            )}
            {isModuleEnabled('time') && (
              <AttachmentGroup
                icon={Timer}
                label={tr('hist.projects.tempsPasse')}
                count={attachments.timeEntries.length}
                onOpen={() => navigate('/temps')}
              />
            )}
          </div>

          {/* L'enveloppe du projet, quand il en a une. Réglée dans Dépenses →
              Catégories et budgets : ce qui la consomme est ici, mais elle se
              décide là-bas, avec les autres budgets. */}
          {isModuleEnabled('expenses') && spent.state !== 'none' && (
            <div className="mt-4 border border-border p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                  Enveloppe du projet
                </span>
                <span className="font-mono text-xs tabular-nums text-text-secondary">
                  {formatCents(spent.spentCents)} / {formatCents(spent.budgetCents)}
                </span>
              </div>
              <div className="mt-2 h-2 w-full bg-bg">
                <div
                  className={`h-full ${spent.state === 'over' ? 'bg-danger' : 'bg-accent'}`}
                  style={{ width: `${Math.round(spent.ratio * 100)}%` }}
                />
              </div>
              <p
                className={`mt-1.5 font-mono text-[10px] uppercase tracking-widest ${
                  spent.state === 'over' ? 'text-danger' : 'text-text-muted'
                }`}
              >
                {spent.state === 'over'
                  ? `Dépassé de ${formatCents(spent.deltaCents)}`
                  : `Il reste ${formatCents(spent.deltaCents)}`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AttachmentGroup({
  icon: Icon,
  label,
  count,
  onOpen,
}: {
  icon: typeof FileText;
  label: string;
  count: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-11 items-center gap-3 border border-border px-3 text-left transition-colors hover:border-border-strong"
    >
      <Icon size={15} strokeWidth={1.9} className="flex-shrink-0 text-text-muted" />
      <span className="flex-1 text-sm text-text-primary">{label}</span>
      <span
        className={`font-mono text-[11px] tabular-nums ${
          count > 0 ? 'text-text-primary' : 'text-text-muted'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-3 block first:mt-0">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
