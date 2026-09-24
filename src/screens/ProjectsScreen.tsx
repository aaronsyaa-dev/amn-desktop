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
import { useMembers } from '../state/useMembers';
import { useProfiles } from '../state/ProfilesContext';
import { useCollection } from '../state/SyncContext';
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
  /* Le responsable d'un projet est un membre ; son prénom vient du profil. */
  const { membres } = useMembers();
  const { profileFor } = useProfiles();
  const prenom = (email: string) => profileFor(email).name?.split(' ')[0] || email.split('@')[0];
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
  const [vue, setVue] = useState<'frise' | 'liste' | 'groupe'>('frise');

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

  /*
    LE CHANTIER EN COURS — celui dont la courbe de brûlage se dessine.

    Un seul : l'objet dominant de l'écran est UNE courbe, pas six. Le choix
    n'est pas arbitraire — c'est le projet ouvert, estimé, daté, dont la
    livraison est la plus proche. C'est celui sur lequel se pose la question
    « est-ce que je tiens la date », et c'est la seule question à laquelle une
    courbe de brûlage répond.

    Sans estimation ou sans date de livraison, il n'y a pas de courbe. L'écran
    passe alors directement à la frise et aux colonnes, ce qui est le bon
    comportement : une courbe vraisemblable vaut moins que pas de courbe.
  */
  const { projectBudget } = useExpenses();
  const saisiesTemps = useCollection<{ projectId?: string; startedAt?: string; endedAt?: string }>('timeEntries');
  const brulage = useMemo(() => {
    const candidats = projects
      .filter((p) => !isDone(config, p) && p.deadline && (p.budgetDays ?? 0) > 0)
      .sort((a, b) => a.deadline.localeCompare(b.deadline));
    for (const p of candidats) {
      const calcul = calculerBrulage(
        p,
        saisiesTemps.map((e) => ({
          projectId: e.projectId,
          startedAt: e.startedAt ?? '',
          endedAt: e.endedAt ?? '',
        })),
        new Date(),
      );
      if (calcul) return { projet: p, calcul };
    }
    return null;
  }, [projects, config, saisiesTemps]);

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
              {(['frise', 'liste', 'groupe'] as const).map((v) => (
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
                  {v === 'frise' ? tr('hist.projects.vueFrise') : v === 'liste' ? tr('hist.projects.vueListe') : tr('hist.projects.vueGroupe')}
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
      {/* ── L'OBJET DOMINANT : la courbe de brûlage du chantier en cours ── */}
      {brulage && (
        <CourbeDeBrulage
          projet={brulage.projet}
          brulage={brulage.calcul}
          /* Le budget en argent est une AUTRE mesure que les journées : il se
             tient à côté, jamais mélangé à la courbe. Il ne s'affiche que si
             ce projet a réellement un budget posé. */
          depense={projectBudget(brulage.projet.id)}
        />
      )}

      {vue === 'groupe' ? (
        <VueDuGroupe
          projects={projects}
          config={config}
          today={today}
          prenom={prenom}
          onOuvrir={(id) => {
            setSelectedId(id);
            setVue('liste');
          }}
        />
      ) : vue === 'frise' && frise ? (
        <div className="flex flex-col gap-6">
          <FriseDesEcheances
            ambreDisponible={brulage === null}
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
                  responsable={project.ownerEmail ? prenom(project.ownerEmail) : undefined}
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
            membres={membres}
            prenom={prenom}
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

/**
 * LA COURBE DE BRÛLAGE — l'objet dominant de Projets (système de design, `16b`)
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Le reste-à-faire, en journées de travail, descend jour après jour depuis
 * l'estimation jusqu'à zéro. La diagonale du rythme idéal passe derrière en
 * pointillé. **L'écart vertical entre les deux lignes EST l'avance ou le
 * retard** — on n'a pas besoin de le chiffrer pour le voir, et c'est tout
 * l'intérêt de l'instrument : un « 62 % » ne dit pas si on tiendra la date.
 *
 * LES DEUX SOURCES, et pourquoi aucune n'est inventée :
 *
 *   · l'estimation vient de `Project.budgetDays`, saisie une fois à
 *     l'ouverture du chantier (voir le commentaire du champ pour l'arbitrage
 *     qui l'a fait exister) ;
 *   · le temps fait vient des SAISIES DE TEMPS portant le `projectId` du
 *     projet. Rien n'est estimé ni lissé : un jour sans saisie est un
 *     palier horizontal, ce qui est l'information exacte.
 *
 * LA GÉOMÉTRIE. Un `<svg viewBox="0 0 1000 250" preserveAspectRatio="none">`
 * posé en `inset:0`, et le point d'aujourd'hui positionné en POURCENTAGE du
 * même conteneur — pas en pixels, sinon la ligne et son point se désalignent
 * dès que la carte change de largeur. Le point tombe sur la date réelle de
 * l'axe : à mi-parcours calendaire il est à 50 % et pas ailleurs, parce que
 * son abscisse se déduit de la date et non d'un index de tableau.
 */

/** Une journée de travail. Le module Temps ne configure qu'un tarif horaire,
 *  pas une durée de journée : sept heures est écrit ici, une fois, plutôt
 *  qu'éparpillé — et c'est la seule constante de conversion de l'instrument. */
const HEURES_PAR_JOURNEE = 7;

const BRULAGE_H = 250;

interface PointBrulage {
  /** Abscisse en unités de vue (0 → 1000). */
  x: number;
  /** Ordonnée en unités de vue (0 = budget entier restant, 250 = rien). */
  y: number;
}

/**
 * Le calcul de la courbe. Renvoie `null` dès qu'il manque de quoi la dessiner —
 * une estimation, une date de livraison, ou un début antérieur à la fin. Mieux
 * vaut pas de courbe qu'une courbe vraisemblable.
 */
function calculerBrulage(
  projet: Project,
  saisies: { projectId?: string; startedAt: string; endedAt: string }[],
  aujourdHui: Date,
): {
  reel: PointBrulage[];
  projection: PointBrulage[];
  pctX: number;
  pctY: number;
  restant: number;
  ecart: number;
  budget: number;
  debut: Date;
  fin: Date;
  faites: number;
} | null {
  const budget = projet.budgetDays ?? 0;
  if (budget <= 0 || !projet.deadline) return null;
  const debut = new Date(`${(projet.createdAt || projet.updatedAt).slice(0, 10)}T00:00:00`);
  const fin = new Date(`${projet.deadline}T00:00:00`);
  const etendue = fin.getTime() - debut.getTime();
  if (!Number.isFinite(etendue) || etendue <= 0) return null;

  /* Les minutes faites, par jour. Une saisie compte le jour où elle a
     commencé : une session à cheval sur minuit appartient à la journée de
     travail où on l'a lancée, pas à celle du lendemain matin. */
  const parJour = new Map<string, number>();
  for (const s of saisies) {
    if (s.projectId !== projet.id || !s.endedAt) continue;
    const ms = new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime();
    if (!(ms > 0)) continue;
    const jour = s.startedAt.slice(0, 10);
    parJour.set(jour, (parJour.get(jour) ?? 0) + ms / 60_000);
  }

  const jusqua = aujourdHui.getTime() < fin.getTime() ? aujourdHui : fin;
  const reel: PointBrulage[] = [];
  let cumul = 0;
  for (let t = new Date(debut); t.getTime() <= jusqua.getTime(); t.setDate(t.getDate() + 1)) {
    const iso = t.toISOString().slice(0, 10);
    cumul += (parJour.get(iso) ?? 0) / 60 / HEURES_PAR_JOURNEE;
    const restantJour = Math.max(0, budget - cumul);
    reel.push({
      x: ((t.getTime() - debut.getTime()) / etendue) * 1000,
      y: ((budget - restantJour) / budget) * BRULAGE_H,
    });
  }
  if (reel.length === 0) return null;

  const restant = Math.max(0, budget - cumul);
  const pctX = ((jusqua.getTime() - debut.getTime()) / etendue) * 100;
  const pctY = ((budget - restant) / budget) * 100;

  /*
    L'ÉCART, EN JOURNÉES — le chiffre que l'étiquette porte.

    Le rythme idéal consomme le budget linéairement entre le début et la
    livraison. À la date d'aujourd'hui, il devrait donc rester
    `budget × (1 − avancement calendaire)`. La différence avec ce qui reste
    vraiment est l'avance (positive) ou le retard (négatif). C'est exactement
    l'écart vertical entre les deux lignes, en unités lisibles.
  */
  const idealRestant = budget * (1 - pctX / 100);
  const ecart = idealRestant - restant;

  /* La projection : au rythme tenu jusqu'ici, où la courbe arrive-t-elle à la
     livraison. Tracée en pointillé, parce que ce n'est pas une mesure. */
  const parJourMoyen = pctX > 0 ? (budget - restant) / (((jusqua.getTime() - debut.getTime()) / 86_400_000) || 1) : 0;
  const joursRestants = (fin.getTime() - jusqua.getTime()) / 86_400_000;
  const restantALaFin = Math.max(0, restant - parJourMoyen * joursRestants);
  const projection: PointBrulage[] =
    joursRestants > 0
      ? [
          { x: (pctX / 100) * 1000, y: (pctY / 100) * BRULAGE_H },
          { x: 1000, y: ((budget - restantALaFin) / budget) * BRULAGE_H },
        ]
      : [];

  return { reel, projection, pctX, pctY, restant, ecart, budget, debut, fin, faites: budget - restant };
}

function moisCourt(d: Date): string {
  return d
    .toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    .replace('.', '')
    .toUpperCase();
}

function CourbeDeBrulage({
  projet,
  brulage,
  depense,
}: {
  projet: Project;
  brulage: NonNullable<ReturnType<typeof calculerBrulage>>;
  depense: { spentCents: number; budgetCents: number } | null;
}) {
  const { reel, projection, pctX, pctY, ecart, budget, debut, fin, faites, restant } = brulage;
  const d = (pts: PointBrulage[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const enAvance = ecart >= 0;
  const jours = Math.abs(Math.round(ecart));
  const milieu = new Date((debut.getTime() + fin.getTime()) / 2);
  /* Du côté opposé au point d'aujourd'hui, et jamais dans les coins. */
  const etiquetteIdeal = pctX > 50 ? 22 : 70;

  return (
    <section className="panel-raised panel-raised-wide px-[30px] pb-[26px] pt-[30px]">
      <div className="mb-[22px] flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <span className="min-w-0">
          <span className="eyebrow block text-text-secondary">Le chantier en cours</span>
          <span className="mt-2 block truncate text-[26px] font-bold leading-[1.1] tracking-[-0.028em] text-text-primary">
            {projet.title}
          </span>
        </span>
        <span className="font-mono text-[10px] tracking-[0.1em] text-text-muted">
          {budget} JOURNÉES ESTIMÉES · {restant < 0.5 ? 'TOUT EST FAIT' : `${Math.round(restant)} RESTANTES`}
        </span>
      </div>

      <div className="grid grid-cols-[44px_1fr] gap-3">
        {/* L'axe des ordonnées : le budget en haut, zéro au sol. Les libellés
            sont posés depuis le BAS pour que « 0 » soit exactement au sol. */}
        <div className="relative font-mono text-[9.5px] text-text-muted" style={{ height: `${BRULAGE_H}px` }}>
          <span className="absolute right-0" style={{ bottom: `${BRULAGE_H - 5}px` }}>{budget}</span>
          <span className="absolute right-0" style={{ bottom: `${BRULAGE_H / 2 - 5}px` }}>{Math.round(budget / 2)}</span>
          <span className="absolute right-0" style={{ bottom: '-5px' }}>0</span>
        </div>

        <div>
          <div
            className="relative overflow-hidden border border-border-raised bg-sunken"
            style={{ height: `${BRULAGE_H}px` }}
          >
            <svg
              viewBox={`0 0 1000 ${BRULAGE_H}`}
              preserveAspectRatio="none"
              className="absolute left-0 top-0 w-full"
              style={{ height: `${BRULAGE_H}px` }}
              aria-hidden
            >
              {/* Le rythme idéal : du budget entier au premier jour, à zéro le
                  jour de la livraison. Une droite, toujours la même. */}
              <path
                d={`M0 0 L1000 ${BRULAGE_H}`}
                fill="none"
                stroke="#2e2e2e"
                strokeWidth={1.5}
                strokeDasharray="6 6"
                vectorEffect="non-scaling-stroke"
              />
              {/* Les couleurs viennent des jetons, jamais recopiées : un
                  attribut de présentation SVG accepte `var()` comme n'importe
                  quelle valeur CSS. */}
              <path
                d={d(reel)}
                fill="none"
                stroke="var(--color-text-body)"
                strokeWidth={2.5}
                vectorEffect="non-scaling-stroke"
              />
              {projection.length > 1 && (
                <path
                  d={d(projection)}
                  fill="none"
                  stroke="var(--color-border-strong)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>

            {/* LE POINT D'AUJOURD'HUI — l'ambre, et l'étiquette qui le nomme.
                Deux nœuds, une seule position, donc un seul signal. */}
            <span
              data-signal-groupe="brulage-aujourdhui"
              className="absolute h-[13px] w-[13px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal shadow-[0_0_26px_-3px_var(--color-signal-glow)]"
              style={{ left: `${pctX}%`, top: `${pctY}%` }}
              aria-hidden
            />
            <span
              data-signal-groupe="brulage-aujourdhui"
              className="absolute -translate-x-1/2 whitespace-nowrap bg-signal px-[9px] py-[5px] font-mono text-[10.5px] font-bold tracking-[0.06em] text-signal-ink"
              style={{ left: `${Math.min(88, Math.max(12, pctX))}%`, top: `calc(${pctY}% - 42px)` }}
            >
              AUJOURD’HUI · {jours === 0 ? 'PILE SUR LE RYTHME' : `${jours} JOURNÉE${jours > 1 ? 'S' : ''} ${enAvance ? 'D’AVANCE' : 'DE RETARD'}`}
            </span>
            {/*
              Le libellé de la diagonale se pose SUR elle, du côté où le point
              d'aujourd'hui n'est pas. Posé à une abscisse fixe, il finissait
              sous la pastille ambre dès que le chantier passait la mi-parcours
              — deux textes superposés, dont l'un est le seul ambre de l'écran.
              L'ordonnée suit la diagonale : `y = x`, puisqu'elle va de (0,0) à
              (100,100) en pourcentages.
            */}
            <span
              className="absolute -translate-y-[130%] font-mono text-[9.5px] tracking-[0.12em] text-text-muted"
              style={{ left: `${etiquetteIdeal}%`, top: `${etiquetteIdeal}%` }}
            >
              RYTHME IDÉAL
            </span>
          </div>

          <div className="relative mt-2.5 h-[14px] font-mono text-[9.5px] tracking-[0.08em] text-text-muted">
            <span className="absolute left-0">{moisCourt(debut)}</span>
            <span className="absolute left-1/2 -translate-x-1/2">{moisCourt(milieu)}</span>
            <span className="absolute right-0">{moisCourt(fin)} · LIVRAISON</span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-border-raised pt-[22px]">
        <span>
          <span className="eyebrow block text-text-muted">Journées faites</span>
          <span className="tnum mt-1.5 block font-mono text-[23px] font-semibold text-text-secondary">
            {faites.toFixed(1).replace('.', ',')}
          </span>
        </span>
        {depense && depense.budgetCents > 0 && (
          <span className="border-l border-border-section pl-8">
            <span className="eyebrow block text-text-muted">Budget consommé</span>
            <span className="tnum mt-1.5 block font-mono text-[23px] font-semibold text-text-secondary">
              {Math.round((depense.spentCents / depense.budgetCents) * 100)} %
            </span>
          </span>
        )}
        <span className="border-l border-border-section pl-8">
          <span className="eyebrow block text-text-muted">Livraison</span>
          <span className="tnum mt-1.5 block font-mono text-[23px] font-semibold text-text-secondary">
            {fin.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
          </span>
        </span>
      </div>
    </section>
  );
}

function FriseDesEcheances({
  frise,
  onOuvrir,
  ambreDisponible,
}: {
  frise: Frise;
  onOuvrir: (id: string) => void;
  /**
   * LE BUDGET D'AMBRE DE L'ÉCRAN EST-IL ENCORE LIBRE ?
   *
   * La frise a son propre signal — « voici ce qui a glissé » — et il était
   * juste tant qu'elle était l'objet dominant de Projets. Depuis que la
   * courbe de brûlage occupe cette place, les deux se retrouvent sur le même
   * écran et l'ambre y apparaît deux fois : c'est-à-dire aucune.
   *
   * L'arbitrage est celui du système de design, pas un goût : l'ambre va à
   * l'OBJET DOMINANT. Quand la courbe est là, la frise garde ses dépassements
   * en encre claire — l'information ne disparaît pas, elle cesse de crier.
   * `check:signal` a trouvé ce défaut sur un écran que la capture donnait
   * pour bon : deux régions ambre ne se voient pas quand elles sont à deux
   * hauteurs différentes de la page.
   */
  ambreDisponible: boolean;
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
              data-signal-groupe={ligne.enRetard && ambreDisponible ? 'retard' : undefined}
              className="flex w-full items-stretch border-b border-[#161616] text-left transition-colors last:border-b-0 hover:bg-surface-hover"
            >
              <div className="w-[240px] flex-shrink-0 px-5 py-4">
                <p className="truncate text-[14.5px] font-semibold text-text-primary">{ligne.project.title}</p>
                {/* Deux lignes, pas une coupée : « PROCHAINE ACTION : MAQUET… »
                    ne dit rien de plus que « PROCHAINE ACTION ». */}
                <p
                  className={`eyebrow mt-1.5 line-clamp-2 leading-[1.5] ${
                    ligne.enRetard && ambreDisponible ? 'text-signal' : ''
                  }`}
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
                    ligne.enRetard && ambreDisponible ? 'bg-signal' : ligne.enRetard ? 'bg-border-strong' : 'bg-[#2b2b2b]'
                  }`}
                  style={{
                    left: `${ligne.debut}%`,
                    width: `${Math.max(1.5, ligne.fin - ligne.debut)}%`,
                  }}
                />
                {/* Le dépassement : rayé, parce que ce temps-là n'était pas prévu. */}
                {ligne.depassement > 0 && (
                  <span
                    className={`absolute top-1/2 h-[22px] -translate-y-1/2 ${
                      ambreDisponible ? 'bg-signal-muted' : 'bg-surface-hover'
                    }`}
                    style={{
                      left: `${ligne.fin}%`,
                      width: `${ligne.depassement}%`,
                      backgroundImage:
                        ambreDisponible
                          ? 'repeating-linear-gradient(135deg, var(--color-signal) 0 2px, transparent 2px 6px)'
                          : 'repeating-linear-gradient(135deg, var(--color-border-strong) 0 2px, transparent 2px 6px)',
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
  responsable,
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
  /** Le prénom de qui répond du projet, quand quelqu'un est désigné. */
  responsable?: string;
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
        {responsable && (
          <span className={`${attachments > 0 ? '' : 'ml-auto '}flex-shrink-0 border border-border px-1.5 py-px font-mono text-[9px] uppercase tracking-widest text-text-secondary`} title={responsable}>
            {responsable}
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
  membres,
  prenom,
  today,
  onBack,
  onPatch,
  onDelete,
}: {
  project: Project;
  clients: { id: number; name: string; company: string }[];
  attachments: Attachments;
  membres: { email: string }[];
  prenom: (email: string) => string;
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

        {/* LE RESPONSABLE (vision cliente, chantier 6) : un projet répond à quelqu'un, sinon c'est le groupe entier qui le porte — c'est-à-dire personne. */}
        <Field label={tr('hist.projects.responsable')}>
          <select
            value={project.ownerEmail ?? ''}
            onChange={(e) => onPatch({ ownerEmail: e.target.value || undefined })}
            className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-sm text-text-primary outline-none"
          >
            <option value="">{tr('hist.projects.responsable.personne')}</option>
            {membres.map((m) => (
              <option key={m.email} value={m.email}>
                {prenom(m.email)} — {m.email}
              </option>
            ))}
          </select>
        </Field>

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
          {/*
            L'ESTIMATION EN JOURNÉES — le champ sans lequel il n'y a pas de
            courbe de brûlage. Posé juste sous l'échéance, parce que les deux
            se répondent : un budget sans date et une date sans budget ne
            disent ni l'un ni l'autre si on tiendra.

            `min={0}` et la conversion vide → `undefined` : effacer le champ
            doit retirer l'estimation, pas la mettre à zéro. Une estimation à
            zéro ferait une courbe qui part du sol.
          */}
          {show('deadline') && (
            <Field label="Estimation (journées)">
              <input
                type="number"
                min={0}
                step={0.5}
                inputMode="decimal"
                value={project.budgetDays ?? ''}
                placeholder="—"
                onChange={(e) => {
                  const n = Number(e.target.value);
                  onPatch({ budgetDays: e.target.value.trim() === '' || !(n > 0) ? undefined : n });
                }}
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


/* ═══════════════════════════════════════════════════════════════════════
   LA VUE DU GROUPE (vision cliente, chantier 6)

   Le patron de plusieurs projets ne veut ni la courbe d'un seul chantier ni
   la liste : il veut savoir, projet par projet, qui répond, où ça en est,
   combien de tâches sont ouvertes, qui est dessus — et qui est réclamé par
   deux projets à la fois, parce que c'est là que les arbitrages se jouent.
   Une table, une ligne par projet ouvert ; sous elle, les personnes
   partagées. Rien d'ambre ici : l'objet dominant de l'écran (la courbe)
   reste au-dessus, et la table ne décide de rien — elle montre.
   ═══════════════════════════════════════════════════════════════════════ */
function VueDuGroupe({
  projects,
  config,
  today,
  prenom,
  onOuvrir,
}: {
  projects: Project[];
  config: ProjectConfig;
  today: string;
  prenom: (email: string) => string;
  onOuvrir: (id: string) => void;
}) {
  const taches = useCollection<{ projectId?: string; assigneeEmail?: string; status?: string }>('tasks');
  const ouverts = projects.filter((p) => !isDone(config, p));
  const lignes = ouverts.map((p) => {
    const siennes = taches.filter((t) => t.projectId === p.id);
    const equipe = [...new Set([...(p.ownerEmail ? [p.ownerEmail] : []), ...siennes.map((t) => t.assigneeEmail).filter((e): e is string => Boolean(e))])];
    const retard = p.deadline && p.deadline < today ? Math.round((new Date(today).getTime() - new Date(p.deadline).getTime()) / 86_400_000) : 0;
    return {
      p,
      ouvertes: siennes.filter((t) => t.status !== 'done').length,
      enCours: siennes.filter((t) => t.status === 'doing').length,
      equipe,
      retard,
    };
  });
  /* Les personnes que deux projets ou plus réclament. */
  const parPersonne = new Map<string, string[]>();
  for (const l of lignes) for (const e of l.equipe) parPersonne.set(e, [...(parPersonne.get(e) ?? []), l.p.title || 'Sans titre']);
  const partagees = [...parPersonne.entries()].filter(([, ps]) => ps.length >= 2).sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="flex flex-col gap-4">
      <section className="panel-raised panel-raised-wide px-[22px] pb-4 pt-5" data-guide="dominante">
        <p className="eyebrow">{tr('hist.projects.groupe.titre')}</p>
        <p className="mb-4 mt-1 text-[12.5px] text-text-secondary">{tr('hist.projects.groupe.aide')}</p>
        {lignes.length === 0 ? (
          <p className="py-3 text-[13.5px] text-text-secondary">{tr('hist.projects.groupe.vide')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-border text-left">
                  {(['projet', 'statut', 'echeance', 'taches', 'equipe', 'prochaine'] as const).map((c) => (
                    <th key={c} className="eyebrow pb-2 pr-4 font-normal">
                      {tr(`hist.projects.groupe.${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignes.map(({ p, ouvertes, enCours, equipe, retard }) => (
                  <tr key={p.id} className="border-b border-border-row align-top last:border-b-0">
                    <td className="py-2.5 pr-4">
                      <button type="button" onClick={() => onOuvrir(p.id)} className="text-left font-semibold text-text-primary hover:underline">
                        {p.title || 'Sans titre'}
                      </button>
                      <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-text-muted">
                        {p.ownerEmail ? prenom(p.ownerEmail) : tr('hist.projects.responsable.personne')}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-text-body">{statusLabel(config, p.status)}</td>
                    <td className="py-2.5 pr-4 tnum">
                      {p.deadline ? (
                        <span className={retard > 0 ? 'text-danger-ink' : 'text-text-body'}>
                          {formatDay(p.deadline)}
                          {retard > 0 && <span className="block text-[11px]">{tr('hist.projects.groupe.retard', { n: String(retard) })}</span>}
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4 text-text-body">{tr('hist.projects.groupe.tachesDetail', { ouvertes: String(ouvertes), enCours: String(enCours) })}</td>
                    <td className="py-2.5 pr-4">
                      <span className="flex flex-wrap gap-1">
                        {equipe.length === 0 && <span className="text-text-muted">—</span>}
                        {equipe.map((e) => (
                          <span key={e} className="border border-border px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.1em] text-text-secondary" title={e}>
                            {prenom(e)}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="max-w-[26ch] py-2.5 text-text-secondary">{p.nextAction || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel px-[22px] pb-4 pt-5">
        <p className="eyebrow">{tr('hist.projects.groupe.partages')}</p>
        <p className="mb-3 mt-1 text-[12.5px] text-text-secondary">{tr('hist.projects.groupe.partagesAide')}</p>
        {partagees.length === 0 ? (
          <p className="text-[13px] text-text-muted">{tr('hist.projects.groupe.personnePartagee')}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {partagees.map(([e, ps]) => (
              <li key={e} className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                <span className="font-semibold text-text-primary">{prenom(e)}</span>
                <span className="text-text-secondary">{ps.join(' · ')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
