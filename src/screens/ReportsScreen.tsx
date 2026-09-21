import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bold,
  CheckSquare,
  Code2,
  Contact,
  Eye,
  FileText,
  Heading1,
  Italic,
  Link2,
  List,
  Pencil,
  ArrowLeft,
  Plus,
  Scale,
  Trash2,
  X,
} from 'lucide-react';
import { useCollection } from '../state/SyncContext';
import { useClients } from '../state/useClients';
import { useReports, type Report, type ReportDraft, type ReportLink, type ReportType } from '../state/useReports';
import { useProfiles } from '../state/ProfilesContext';
import { useUndo } from '../state/UndoContext';
import { Markdown } from '../lib/markdown';
import { relativeTime } from '../lib/time';
import { useExclusive, useProductReports } from '@edition/exclusive';
import { EmptyState } from '../components/EmptyState';
import { useLangue, t as tr } from '../i18n';
import { useHaloSignal } from '../components/EtatEcran';

/* ─── LE FIL DE PROVENANCE — l'objet dominant des Rapports (`18b`) ────────── */

/*
  UN COMPTE RENDU N'EST PAS UN DOCUMENT FIGÉ — SAUF QU'IL L'EST.

  À gauche, ce que le rapport RETIENT de chaque élément qu'il cite : le
  libellé tel qu'il était le jour où on l'a lié. À droite, la source vivante,
  telle qu'elle est maintenant. Entre les deux, un fil courbe. Le fil rend
  visible une dépendance qu'un document ne montre jamais : ce qu'il raconte
  continue de bouger derrière lui.

  LE FIL SE TERNIT QUAND LA SOURCE VIEILLIT. Plein et clair quand le rapport
  est du jour ; pointillé gris à mesure qu'il prend de l'âge. Le fil AMBRE est
  le seul épais — c'est la règle, et c'est ce qui fait qu'on le voit d'abord.

  CE QUE LE MODÈLE PERMET, ET L'ARBITRAGE.
  `MODULES.md` parle des « chiffres du rapport ». Les rapports de ce produit
  ne sont pas calculés : ce sont des comptes rendus ÉCRITS, dont les sources
  sont les fiches qu'ils citent (`ReportLink`). Fabriquer des chiffres en
  lisant le texte au hasard d'une expression régulière aurait donné une
  provenance inventée. Le fil porte donc ce qui est vrai : chaque lien, son
  libellé FIGÉ au moment de l'écriture, et la fiche vivante en face. La règle
  du module — « un rapport ne se regénère pas tout seul, il garde ce qu'il
  avait le jour où il a été fait » — est exactement ce que ce libellé figé
  démontre, et l'écran l'écrit.
*/
const FIL_LIGNE_H = 44;
const FIL_X_PLAQUE = 46;
const FIL_X_SOURCE = 58;
/** Au-delà, le fil est pointillé : la source a eu le temps de bouger. */
const FIL_JOURS_FRAIS = 2;

type EtatDeSource = 'vivante' | 'perdue';

interface FilDeProvenance {
  cle: string;
  kind: ReportLink['kind'];
  /** Ce que le rapport a retenu, le jour où il a été écrit. */
  fige: string;
  /** Ce que dit la source maintenant — ou l'absence, si elle a disparu. */
  vivant: string;
  etat: EtatDeSource;
  /** Vrai quand le libellé figé ne correspond plus à la source. */
  diverge: boolean;
  jours: number;
}

const MODULE_DE_LA_SOURCE: Record<ReportLink['kind'], string> = {
  task: 'Tâches',
  client: 'Clients',
  decision: 'Journal de décisions',
};

/** « 6 semaines », « 3 jours » — l'unité qui se lit, jamais un nombre nu. */
function depuisCombien(jours: number): string {
  if (jours <= 0) return 'aujourd’hui';
  if (jours === 1) return '1 jour';
  if (jours < 14) return `${jours} jours`;
  const semaines = Math.round(jours / 7);
  if (semaines < 9) return `${semaines} semaines`;
  const mois = Math.round(jours / 30);
  return `${mois} mois`;
}

const TYPES: { value: ReportType; label: string }[] = [
  { value: 'task', label: 'Tâche' },
  { value: 'client', label: 'Client' },
  { value: 'decision', label: tr('hist.reports.decision') },
  { value: 'manual', label: 'Manuel' },
];

/**
 * Les types PROPOSABLES ici.
 *
 * « Décision » renvoie au Journal de décisions, un module d'AMN DevSec qui
 * n'est pas compilé dans l'édition Business. Le proposer à une cliente lui
 * offre un filtre qui ne trouvera jamais rien et une catégorie qui ne désigne
 * rien — deux façons de la faire douter d'avoir compris.
 *
 * `typeLabel` continue de lire TYPES en entier : un enregistrement ancien
 * marqué « decision » doit garder un intitulé lisible, même là où on ne peut
 * plus en créer.
 */
function proposableTypes(teamEnabled: boolean) {
  return teamEnabled ? TYPES : TYPES.filter((t) => t.value !== 'decision');
}

function typeLabel(t: ReportType): string {
  return TYPES.find((x) => x.value === t)?.label ?? 'Manuel';
}

/**
 * Le filtre de type. Les valeurs qui ne sont pas des types de rapport viennent
 * de l'édition (`useProductReports().filters`) : cet écran est partagé, et
 * nommer ici des sorties qui n'existent que chez nous les ferait entrer dans le
 * bundle d'une cliente — voir `@edition/exclusive`.
 */
type ListFilter = ReportType | 'all' | string;

type DateFilter = 'all' | '7' | '30' | '90';

/**
 * Ce qui est sélectionné dans la liste de gauche : un rapport, ou une sortie
 * produit désignée par son identifiant opaque.
 */
type Selection = { kind: 'report'; id: string } | { kind: 'product'; id: string } | null;

const emptyDraft = (): ReportDraft => ({ type: 'manual', title: '', body: '', links: [] });

/** State shape while creating/editing: `id` present ⇒ editing an existing report. */
interface EditState {
  id?: string;
  draft: ReportDraft;
}

export function ReportsScreen() {
  // Abonnement à la langue : sans lui, l'écran gardait les libellés de la
  // langue active AU MONTAGE et ne suivait pas un changement en cours de route.
  useLangue();
  const { TEAM_ENABLED } = useExclusive();
  /* Les sources vivantes du fil de provenance (`18b`) — lues ici parce que
     c'est le dominant qui en a besoin, pas seulement le sélecteur de liens. */
  const tachesDuFil = useCollection<{ title?: string }>('tasks');
  const decisionsDuFil = useCollection<{ title?: string }>('decisions');
  const { clients: clientsDuFil } = useClients();
  const { reports, createReport, updateReport, deleteReport } = useReports();
  const { isPending, scheduleDelete } = useUndo();
  const location = useLocation();

  const [typeFilter, setTypeFilter] = useState<ListFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [selection, setSelection] = useState<Selection>(null);
  const [editing, setEditing] = useState<EditState | null>(null);

  // Les sorties produit (scans Elite, contrôles RGPD) mêlées à la liste. Cet
  // écran ne sait pas ce qu'elles sont : il reçoit des entrées datées, une
  // ligne à afficher et un panneau à ouvrir. Dans l'édition Business, la liste
  // est vide et rien de tout cela n'est compilé.
  const cutoffMs = useMemo(
    () => (dateFilter === 'all' ? 0 : Date.now() - Number(dateFilter) * 86400000),
    [dateFilter],
  );
  const products = useProductReports(typeFilter, cutoffMs);

  // A "Faire un rapport" trigger from Tasks/Clients/Décisions arrives as a
  // prefilled draft in the navigation state — open the editor on it. A site
  // control desk instead creates the report itself (it has all the data) and
  // sends its id, so we just open it read-only.
  useEffect(() => {
    const state = location.state as { reportDraft?: ReportDraft; openReportId?: string } | null;
    if (state?.reportDraft) {
      setEditing({ draft: state.reportDraft });
      setSelection(null);
    } else if (state?.openReportId) {
      setSelection({ kind: 'report', id: state.openReportId });
      setEditing(null);
    }
  }, [location.state]);

  /*
    L'ÉCRAN S'OUVRE SUR UN RAPPORT, pas sur « sélectionnez un rapport ».

    L'objet dominant que la table du paquet donne à cet écran est LA
    PROVENANCE — d'où le rapport est tiré. Elle n'existe que sur un rapport
    ouvert : s'ouvrir sur rien, c'est cacher la seule chose qui distingue ce
    module d'un traitement de texte. Le plus récent est le bon défaut ; un
    choix déjà fait n'est jamais écrasé, et un brouillon en cours d'édition
    non plus.
  */
  useEffect(() => {
    if (editing) return;
    setSelection((prev) => prev ?? (reports[0] ? { kind: 'report', id: reports[0].id } : null));
  }, [reports, editing]);

  const visibleReports = useMemo(() => {
    // Un filtre produit (« Scanner », « RGPD ») ne laisse passer aucun rapport
    // écrit : c'est un filtre SUR la liste commune, pas sur les rapports.
    const isProductFilter = products.filters.some((f) => f.value === typeFilter);
    return reports
      .filter((r) => !isPending(`reports:${r.id}`))
      .filter((r) => (typeFilter === 'all' ? true : isProductFilter ? false : r.type === typeFilter))
      .filter((r) => (cutoffMs ? new Date(r.createdAt).getTime() >= cutoffMs : true));
  }, [reports, typeFilter, cutoffMs, isPending, products.filters]);

  // Une seule liste chronologique, rapports et sorties produit mêlés, du plus
  // récent au plus ancien — « Tous » se lit comme un historique unifié.
  const items = useMemo(
    () =>
      [
        ...visibleReports.map((r) => ({
          kind: 'report' as const,
          id: r.id,
          at: r.createdAt,
          report: r,
        })),
        ...products.entries.map((e) => ({ kind: 'product' as const, id: e.id, at: e.at, entry: e })),
      ].sort((a, b) => (b.at || '').localeCompare(a.at || '')),
    [visibleReports, products.entries],
  );

  const selectedReport = useMemo(
    () => (selection?.kind === 'report' ? reports.find((r) => r.id === selection.id) ?? null : null),
    [reports, selection],
  );
  const selectedProduct = useMemo(
    () =>
      selection?.kind === 'product'
        ? products.entries.find((e) => e.id === selection.id) ?? null
        : null,
    [products.entries, selection],
  );

  /*
    LE RAPPORT LU PAR LE FIL — celui qui est sélectionné, sinon le plus récent
    qui cite quelque chose. Un rapport sans lien n'a pas de provenance : le
    fil ne s'invente pas une source pour avoir quelque chose à dessiner.
  */
  const rapportDuFil = useMemo(
    () => selectedReport ?? reports.find((r) => r.links.length > 0) ?? null,
    [selectedReport, reports],
  );

  const maintenant = Date.now();

  /*
    LES FILS. Un par lien : à gauche ce que le rapport a FIGÉ, à droite ce que
    la source dit maintenant. Une source disparue est un fil qui ne mène plus
    nulle part — et ça se dessine, plutôt que de se taire.
  */
  const fils = useMemo<FilDeProvenance[]>(() => {
    if (!rapportDuFil) return [];
    const jours = Math.max(
      0,
      Math.floor((maintenant - Date.parse(rapportDuFil.createdAt)) / 86_400_000),
    );
    return rapportDuFil.links.map((lien) => {
      const source =
        lien.kind === 'task'
          ? tachesDuFil.find((t) => t.id === lien.id)?.title
          : lien.kind === 'client'
            ? clientsDuFil.find((c) => String(c.id) === lien.id)?.name
            : decisionsDuFil.find((d) => d.id === lien.id)?.title;
      const vivant = (source ?? '').trim();
      return {
        cle: `${lien.kind}:${lien.id}`,
        kind: lien.kind,
        fige: lien.label,
        vivant: vivant || 'Fiche introuvable',
        etat: vivant ? ('vivante' as const) : ('perdue' as const),
        diverge: Boolean(vivant) && vivant !== lien.label,
        jours,
      };
    });
  }, [rapportDuFil, tachesDuFil, clientsDuFil, decisionsDuFil, maintenant]);

  /*
    LE FIL AMBRE — la source perdue d'abord, sinon celle qui a divergé, sinon
    rien. C'est la seule chaîne épaisse de l'écran : cinq nœuds (la plaque, sa
    valeur, son libellé, son fil et la mention sur la source) mais un seul
    objet, parce que c'est une seule chaîne du chiffre à sa source.
  */
  /*
    LES MODULES CITÉS, dans l'ordre où ils apparaissent. Leur ordonnée est
    répartie régulièrement sur la hauteur du fil : c'est cette différence de
    hauteur avec les plaques qui donne au fil sa courbe.
  */
  const modulesDuFil = useMemo(() => {
    const compte = new Map<ReportLink['kind'], number>();
    for (const f of fils) compte.set(f.kind, (compte.get(f.kind) ?? 0) + 1);
    return [...compte.entries()].map(([kind, n]) => ({ kind, compte: n }));
  }, [fils]);

  const hauteurDuFil = Math.max(FIL_LIGNE_H, fils.length * FIL_LIGNE_H);
  const ordonneeDuModule = (kind: ReportLink['kind']) => {
    const i = modulesDuFil.findIndex((m) => m.kind === kind);
    const n = Math.max(1, modulesDuFil.length);
    return ((i < 0 ? 0 : i) + 0.5) * (hauteurDuFil / n);
  };

  const filAmbre =
    fils.find((f) => f.etat === 'perdue') ?? fils.find((f) => f.diverge) ?? null;
  const haloFil = useHaloSignal(filAmbre !== null);

  // Below lg the two panes don't fit side by side, so the screen behaves like a
  // master/detail: the list fills the width until something is picked, then the
  // detail takes over full-screen with a back control. lg+ keeps both columns.
  const hasDetail = Boolean(editing || selectedReport || selectedProduct);
  const closeDetail = () => {
    setSelection(null);
    setEditing(null);
  };

  const save = (state: EditState) => {
    if (state.id) {
      updateReport(state.id, state.draft);
      setSelection({ kind: 'report', id: state.id });
    } else {
      const id = createReport(state.draft);
      setSelection({ kind: 'report', id });
    }
    setEditing(null);
  };

  const remove = (report: Report) => {
    setSelection(null);
    scheduleDelete({
      key: `reports:${report.id}`,
      label: report.title ? `Rapport « ${report.title} »` : 'Rapport',
      commit: () => deleteReport(report.id),
    });
  };

  return (
    <section className="screen-h flex flex-col gap-4">
      {/* « Mémoire de l'équipe » suppose une équipe. Chez une cliente, ce sont
          ses comptes-rendus à elle — le mot juste est le sien. */}
      <ScreenHeader
        eyebrow={tr('hist.surtitre', { module: tr('hist.reports.titre') })}
        title={tr('hist.reports.titre')}
        description={TEAM_ENABLED ? tr('hist.reports.memoireEquipe') : tr('hist.reports.vosComptesRendus')}
        stats={[{ label: 'Rapports', value: reports.length }]}
        actions={
        <button
          type="button"
          onClick={() => {
            setEditing({ draft: emptyDraft() });
            setSelection(null);
          }}
          className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
        >
          <Plus size={16} strokeWidth={2.25} />{tr('hist.reports.nouveauRapport')}</button>
        }
      />

      {/* ── LE FIL DE PROVENANCE — l'objet dominant (`18b`) ──────────────── */}
      {rapportDuFil && fils.length > 0 && (
        <section className="panel-raised panel-raised-wide p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
            <div className="min-w-0">
              <p className="eyebrow">
                {typeLabel(rapportDuFil.type)} · écrit {relativeTime(rapportDuFil.createdAt)}
              </p>
              <p className="mt-1 truncate text-[19px] font-semibold leading-tight text-text-primary sm:text-[23px]">
                {rapportDuFil.title || 'Rapport sans titre'}
              </p>
            </div>
            <p className="max-w-xs font-mono text-[9.5px] uppercase leading-[1.7] tracking-[0.18em] text-text-muted">
              à gauche ce que le rapport a retenu, à droite ce que la source dit
            </p>
          </div>

          <div className="relative mt-5 w-full" style={{ height: fils.length * FIL_LIGNE_H }}>
            {/* LES FILS COURBES. `viewBox` en hauteur de pixels et
                `preserveAspectRatio="none"` : l'ordonnée de vue est le pixel,
                donc la courbe part et arrive exactement au centre des lignes
                qu'elle relie. */}
            <svg
              aria-hidden
              className={`absolute inset-0 h-full w-full ${filAmbre ? haloFil : ''}`}
              viewBox={`0 0 100 ${fils.length * FIL_LIGNE_H}`}
              preserveAspectRatio="none"
            >
              {fils.map((f, i) => {
                const signal = filAmbre?.cle === f.cle;
                const y = i * FIL_LIGNE_H + FIL_LIGNE_H / 2;
                /*
                  LE FIL EST COURBE PARCE QUE SES DEUX BOUTS NE SONT PAS À LA
                  MÊME HAUTEUR : à gauche une ligne par citation, à droite un
                  bloc par MODULE. Deux citations du même module convergent
                  donc vers le même point, ce qu'une ligne droite ne saurait
                  pas montrer. Les points de contrôle sont à mi-chemin en
                  abscisse et gardent chacun l'ordonnée de son extrémité :
                  la courbe part et arrive horizontalement.
                */
                const yModule = ordonneeDuModule(f.kind);
                const milieu = (FIL_X_PLAQUE + FIL_X_SOURCE) / 2;
                return (
                  <path
                    key={f.cle}
                    d={`M ${FIL_X_PLAQUE} ${y} C ${milieu} ${y}, ${milieu} ${yModule}, ${FIL_X_SOURCE} ${yModule}`}
                    fill="none"
                    stroke={signal ? 'var(--color-signal)' : 'var(--color-border-strong)'}
                    /* LE FIL AMBRE EST LE SEUL ÉPAIS : c'est la règle du
                       module, et c'est ce qui le fait voir avant tout. */
                    strokeWidth={signal ? 2.5 : 1}
                    strokeDasharray={signal ? undefined : f.jours > FIL_JOURS_FRAIS ? '3 3' : undefined}
                    vectorEffect="non-scaling-stroke"
                    data-signal-groupe={signal ? 'source-perimee' : undefined}
                  />
                );
              })}
            </svg>

            {fils.map((f, i) => {
              const signal = filAmbre?.cle === f.cle;
              return (
                <React.Fragment key={f.cle}>
                  {/* LA PLAQUE — ce que le rapport a figé. */}
                  <div
                    className={`absolute flex items-center gap-2 border px-3 ${
                      signal ? `border-signal-line bg-signal-muted ${haloFil}` : 'border-border bg-sunken'
                    }`}
                    style={{
                      top: i * FIL_LIGNE_H + 4,
                      height: FIL_LIGNE_H - 8,
                      left: 0,
                      width: `${FIL_X_PLAQUE}%`,
                    }}
                    data-signal-groupe={signal ? 'source-perimee' : undefined}
                  >
                    <span
                      className={`min-w-0 flex-1 truncate text-[13px] ${signal ? 'font-semibold text-signal' : 'text-text-primary'}`}
                      data-signal-groupe={signal ? 'source-perimee' : undefined}
                    >
                      {f.fige}
                    </span>
                    <span
                      className={`max-w-[45%] flex-shrink-0 truncate font-mono text-[9.5px] uppercase tracking-wider ${
                        f.etat === 'perdue'
                          ? 'text-danger'
                          : signal
                            ? 'text-signal'
                            : 'text-text-muted'
                      }`}
                      data-signal-groupe={signal ? 'source-perimee' : undefined}
                      title={f.vivant}
                    >
                      {f.etat === 'perdue' ? 'fiche effacée' : f.diverge ? `→ ${f.vivant}` : 'à jour'}
                    </span>
                  </div>

                </React.Fragment>
              );
            })}

            {/* LES SOURCES — un bloc par MODULE, et non par fiche : c'est le
                module qui produit la donnée, et deux citations du même module
                convergent vers lui. */}
            {modulesDuFil.map((m) => {
              const signal = filAmbre?.kind === m.kind;
              return (
                <div
                  key={m.kind}
                  className={`absolute flex items-center gap-2 border px-3 ${
                    signal ? `border-signal-line bg-signal-muted ${haloFil}` : 'border-border bg-raised'
                  }`}
                  style={{
                    top: ordonneeDuModule(m.kind) - (FIL_LIGNE_H - 8) / 2,
                    height: FIL_LIGNE_H - 8,
                    left: `${FIL_X_SOURCE}%`,
                    right: 0,
                  }}
                  data-signal-groupe={signal ? 'source-perimee' : undefined}
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-text-secondary">
                    {MODULE_DE_LA_SOURCE[m.kind]}
                  </span>
                  <span className="tnum flex-shrink-0 font-mono text-[9.5px] uppercase tracking-wider text-text-muted">
                    {m.compte} citation{m.compte > 1 ? 's' : ''}
                  </span>
                  {signal && filAmbre && (
                    <span
                      className="signal-plate flex-shrink-0 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em]"
                      data-signal-groupe="source-perimee"
                    >
                      figé depuis {depuisCombien(filAmbre.jours)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/*
            SOUS LE FIL — l'explication de l'écart, et la règle du module.
            Un rapport ne se régénère pas tout seul : le dire est la seule
            façon d'empêcher qu'on le lise comme un tableau de bord.
          */}
          <div className="mt-4 border-t border-border-row pt-3">
            {filAmbre ? (
              <p className="text-[12.5px] leading-relaxed text-text-secondary">
                {filAmbre.etat === 'perdue' ? (
                  <>
                    Le rapport cite{' '}
                    <span className="font-semibold text-text-primary">{filAmbre.fige}</span>, dont la
                    fiche n’existe plus. Le rapport, lui, l’annoncera toujours : il garde ce qu’il
                    avait le jour où il a été écrit.
                  </>
                ) : (
                  <>
                    Le rapport annonce{' '}
                    <span className="font-semibold text-text-primary">{filAmbre.fige}</span> ; la
                    source dit maintenant{' '}
                    <span className="font-semibold text-text-primary">{filAmbre.vivant}</span>. Ce
                    n’est pas une erreur du rapport : c’est la source qui a bougé depuis.
                  </>
                )}
              </p>
            ) : (
              <p className="text-[12.5px] leading-relaxed text-text-secondary">
                Chaque source dit encore ce que le rapport en a retenu.
              </p>
            )}
            <p className="mt-2 text-[12.5px] leading-relaxed text-text-muted">
              Un rapport ne se régénère pas tout seul. Il garde le texte et les libellés du jour où
              il a été fait ; le fil montre ce qui a bougé derrière, il ne le corrige pas.
            </p>
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <Segmented
          value={typeFilter}
          onChange={(v) => setTypeFilter(v as ListFilter)}
          options={[
            { value: 'all', label: tr('hist.reports.tous') },
            ...proposableTypes(TEAM_ENABLED).map((t) => ({ value: t.value, label: t.label })),
            ...products.filters,
          ]}
        />
        <Segmented
          value={dateFilter}
          onChange={(v) => setDateFilter(v as DateFilter)}
          options={[
            { value: 'all', label: 'Toujours' },
            { value: '90', label: '90 j' },
            { value: '30', label: '30 j' },
            { value: '7', label: '7 j' },
          ]}
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
        {/* List — full width on mobile until a detail is opened. */}
        <div
          className={`min-h-0 flex-col overflow-y-auto rounded-lg border border-border bg-surface ${
            hasDetail ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {items.length === 0 ? (
            /*
              RAPPORTS (BLOC A) — la boîte occupait toute la colonne (`flex-1`
              + centrage vertical), donc le vide était l'élément le plus grand
              de l'écran. Une ligne en haut de liste suffit.
            */
            <div className="px-4">
              <EmptyState quiet={reports.length > 0 || products.entries.length > 0}>
                {/* « depuis un produit » est du vocabulaire d'AMN DevSec
                    (Scanner, Comply, SSL Monitor). Une cliente n'a pas de
                    produits : la phrase la renvoyait à quelque chose
                    d'introuvable chez elle. */}
                {reports.length === 0 && products.entries.length === 0
                  ? TEAM_ENABLED
                    ? 'Aucun rapport pour l’instant. Ils se rédigent ici ou s’exportent depuis un produit.'
                    : 'Aucun compte-rendu pour l’instant. Rédigez-en un ici, ou depuis une tâche terminée ou une fiche client.'
                  : 'Aucun rapport pour ces filtres.'}
              </EmptyState>
            </div>
          ) : (
            items.map((item) => {
              const selected = selection?.kind === item.kind && selection.id === item.id && !editing;
              return (
                <button
                  key={`${item.kind}:${item.id}`}
                  type="button"
                  onClick={() => {
                    setSelection({ kind: item.kind, id: item.id });
                    setEditing(null);
                  }}
                  className={`flex flex-col gap-1 border-b border-border px-4 py-3 text-left transition-colors hover:bg-surface-hover ${
                    selected ? 'bg-surface-hover' : ''
                  }`}
                >
                  {item.kind === 'report' ? (
                    <>
                      <div className="flex items-center gap-2">
                        <TypeChip type={item.report.type} />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                          {item.report.title || 'Sans titre'}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        {relativeTime(item.report.createdAt)}
                      </span>
                    </>
                  ) : (
                    item.entry.row
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Detail / editor — full-screen on mobile, right-hand column on lg+. */}
        <div
          className={`min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface ${
            hasDetail ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {hasDetail && (
            <button
              type="button"
              onClick={closeDetail}
              className="flex items-center gap-1.5 border-b border-border px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-text-muted transition-colors hover:text-text-primary lg:hidden"
            >
              <ArrowLeft size={13} strokeWidth={2} />{tr('hist.reports.retourALaListe')}</button>
          )}
          {editing ? (
            <ReportEditor
              state={editing}
              onChange={setEditing}
              onSave={() => save(editing)}
              onCancel={() => setEditing(null)}
            />
          ) : selectedReport ? (
            <ReportReader
              report={selectedReport}
              onEdit={() =>
                setEditing({
                  id: selectedReport.id,
                  draft: {
                    type: selectedReport.type,
                    title: selectedReport.title,
                    body: selectedReport.body,
                    links: selectedReport.links,
                  },
                })
              }
              onRemove={() => remove(selectedReport)}
            />
          ) : selectedProduct ? (
            <div className="min-h-0 flex-1 overflow-y-auto">{selectedProduct.detail}</div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <FileText size={26} strokeWidth={1.9} className="text-text-muted" />
              <p className="text-sm font-medium text-text-primary">{tr('hist.reports.selectionnezUnRapport')}</p>
              <p className="max-w-sm text-sm text-text-secondary">
                {products.enabled
                  ? tr('hist.reports.genererInterne')
                  : tr('hist.reports.genererCliente')}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- Reader -------------------------------- */

function ReportReader({
  report,
  onEdit,
  onRemove,
}: {
  report: Report;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { profileFor } = useProfiles();
  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <TypeChip type={report.type} />
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              {new Date(report.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              {report.authorEmail && ` · ${profileFor(report.authorEmail).name}`}
            </span>
          </div>
          <h2 className="text-2xl font-semibold leading-tight text-text-primary">{report.title || 'Sans titre'}</h2>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="flex min-h-9 items-center gap-1.5 rounded-sm px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
          >
            <Pencil size={13} strokeWidth={1.9} />{tr('hist.reports.editer')}</button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={tr('hist.reports.supprimer')}
            className="flex h-9 w-9 items-center justify-center rounded text-text-muted hover:text-danger"
          >
            <Trash2 size={15} strokeWidth={1.9} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/*
          LA BANDE DE PROVENANCE — l'objet dominant de l'écran Rapports.

          Les liens étaient une rangée de puces grises noyées en haut du corps,
          de la même couleur que tout le reste. Or la provenance est CE QUI
          DISTINGUE ce module d'un traitement de texte : un rapport tiré d'une
          tâche et d'une fiche cliente n'est pas une note, c'est une pièce
          rattachée. La table du paquet le dit en un mot — l'objet dominant de
          cet écran est « la provenance ».

          Elle occupe donc une bande à part, en plan creux, AU-DESSUS du corps.

          L'AMBRE est celui que la table nomme : le surtitre « tiré de ». Un
          rapport sans lien n'a pas de bande, donc pas d'ambre — et c'est juste,
          il n'y a alors rien à remonter.
        */}
        {report.links.length > 0 && (
          <div className="border-b border-border bg-sunken px-6 py-4">
            <div className="mb-3 flex items-center gap-4">
              {/* Ce surtitre portait l'ambre quand la provenance n'était
                  qu'une bande de jetons. Le fil de provenance est maintenant
                  l'objet dominant et porte la seule région ambre de l'écran :
                  ce rappel redescend en matière. */}
              <p className="eyebrow flex-shrink-0">{tr('hist.reports.tireDe')}</p>
              <span className="h-px flex-1 bg-border-section" aria-hidden />
              {/* Pourquoi les libellés ne bougent plus : `ReportLink.label` est
                  une copie prise au moment du lien. Renommer la fiche d'origine
                  ne réécrit pas le rapport — c'est voulu, une pièce doit dire ce
                  qu'elle disait le jour où elle a été faite. */}
              <p className="eyebrow flex-shrink-0">{tr('hist.reports.libellesFiges')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {report.links.map((l) => (
                <LinkChip key={`${l.kind}:${l.id}`} link={l} />
              ))}
            </div>
          </div>
        )}

        <div className="px-6 py-6">
          {report.body.trim() ? (
            <div className="max-w-[62ch] text-[15.5px] leading-[1.75] text-text-body [text-wrap:pretty]">
              <Markdown text={report.body} />
            </div>
          ) : (
            <p className="font-mono text-xs text-text-muted">Rapport vide.</p>
          )}
        </div>
      </div>
    </>
  );
}

/** A clickable reference chip navigating back to the origin entity. */
function LinkChip({ link }: { link: ReportLink }) {
  const { DECISIONS_ROUTE } = useExclusive();
  const navigate = useNavigate();
  const go = () => {
    if (link.kind === 'task') navigate('/tasks', { state: { openTaskId: link.id } });
    else if (link.kind === 'client') navigate('/clients', { state: { focusClientId: Number(link.id) } });
    // Le troisième type de lien est une décision — un module d'équipe, donc
    // absent de l'édition Business. Sans écran cible, la puce ne navigue pas
    // plutôt que d'envoyer sur une route qui n'existe pas.
    else if (DECISIONS_ROUTE) navigate(DECISIONS_ROUTE, { state: { focusDecisionId: link.id } });
  };
  const Icon = link.kind === 'task' ? CheckSquare : link.kind === 'client' ? Contact : Scale;
  /* Le GENRE du lien s'écrit à côté du libellé au lieu de tenir dans une icône
     de 12 px : « client » et « décision » ne se devinent pas à la silhouette, et
     c'est précisément la distinction qui donne son sens à la provenance. */
  const genre =
    link.kind === 'task'
      ? tr('hist.reports.genreTache')
      : link.kind === 'client'
        ? tr('hist.reports.genreClient')
        : tr('hist.reports.genreDecision');
  return (
    <button
      type="button"
      onClick={go}
      className="flex min-h-11 items-center gap-2.5 border border-border bg-surface px-3 text-left transition-colors hover:border-border-strong md:min-h-0 md:py-2.5"
    >
      <Icon size={13} strokeWidth={1.9} className="flex-shrink-0 text-text-muted" />
      <span className="eyebrow flex-shrink-0">{genre}</span>
      <span className="truncate text-[14px] font-semibold text-text-primary">{link.label}</span>
    </button>
  );
}

/* --------------------------------- Editor -------------------------------- */

function ReportEditor({
  state,
  onChange,
  onSave,
  onCancel,
}: {
  state: EditState;
  onChange: (s: EditState) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { TEAM_ENABLED } = useExclusive();
  const { draft } = state;
  const setDraft = (patch: Partial<ReportDraft>) => onChange({ ...state, draft: { ...draft, ...patch } });
  const [preview, setPreview] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const wrap = (before: string, after = before) => {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = draft.body.slice(s, e) || 'texte';
    setDraft({ body: draft.body.slice(0, s) + before + sel + after + draft.body.slice(e) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  };
  const prefixLine = (marker: string) => {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: s } = el;
    const lineStart = draft.body.lastIndexOf('\n', s - 1) + 1;
    setDraft({ body: draft.body.slice(0, lineStart) + marker + draft.body.slice(lineStart) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + marker.length, s + marker.length);
    });
  };
  const codeBlock = () => {
    const el = bodyRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = draft.body.slice(s, e) || 'code';
    setDraft({ body: `${draft.body.slice(0, s)}\n\`\`\`\n${sel}\n\`\`\`\n${draft.body.slice(e)}` });
    requestAnimationFrame(() => el.focus());
  };
  const tools = [
    { icon: Bold, label: 'Gras', run: () => wrap('**') },
    { icon: Italic, label: 'Italique', run: () => wrap('*') },
    { icon: Heading1, label: 'Titre', run: () => prefixLine('## ') },
    { icon: List, label: 'Liste', run: () => prefixLine('- ') },
    { icon: Code2, label: 'Bloc de code', run: codeBlock },
  ];

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-5 py-3">
        <input
          autoFocus
          value={draft.title}
          onChange={(e) => setDraft({ title: e.target.value })}
          placeholder="Titre du rapport"
          className="min-w-0 flex-1 bg-transparent text-lg font-semibold text-text-primary outline-none placeholder:text-text-muted"
        />
        <select
          value={draft.type}
          onChange={(e) => setDraft({ type: e.target.value as ReportType })}
          aria-label="Type de rapport"
          className="input-focus cursor-pointer border border-border bg-bg px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary"
        >
          {proposableTypes(TEAM_ENABLED).map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Toolbar */}
      {/*
        `gap-2` : une barre d'outils serre ses boutons par habitude, mais 36 px
        à 4 px d'écart reste une rangée de petites icônes grises qui se
        ressemblent toutes — gras, italique, titre, lien, liste. Voir
        `docs/PRINCIPE-CONFORT.md` : sous 44 px, une cible a besoin d'un vrai
        dégagement.
      */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        {tools.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={t.run}
            disabled={preview}
            aria-label={t.label}
            title={t.label}
            className="flex h-9 w-9 items-center justify-center rounded text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary disabled:opacity-30"
          >
            <t.icon size={15} strokeWidth={1.9} />
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPreview((v) => !v)}
          className="ml-auto flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          {preview ? <Pencil size={12} strokeWidth={1.9} /> : <Eye size={12} strokeWidth={1.9} />}
          {preview ? 'Éditer' : 'Aperçu'}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {preview ? (
          <div className="max-w-2xl px-5 py-4 leading-relaxed">
            {draft.body.trim() ? <Markdown text={draft.body} /> : <p className="font-mono text-xs text-text-muted">Rapport vide.</p>}
          </div>
        ) : (
          <textarea
            ref={bodyRef}
            value={draft.body}
            onChange={(e) => setDraft({ body: e.target.value })}
            placeholder={tr('hist.reports.redigezLeRapportGras')}
            className="h-full min-h-[12rem] w-full resize-none bg-transparent px-5 py-4 font-mono text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
          />
        )}
      </div>

      {/* Linked elements */}
      <LinkManager links={draft.links} onChange={(links) => setDraft({ links })} />

      <div className="flex items-center gap-2 border-t border-border p-3">
        <button
          type="button"
          onClick={onSave}
          disabled={!draft.title.trim() && !draft.body.trim()}
          className="bg-accent px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
        >{tr('hist.reports.enregistrer')}</button>
        <button
          type="button"
          onClick={onCancel}
          className="border border-border px-3 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
        >
          Annuler
        </button>
      </div>
    </>
  );
}

/* ------------------------------ Link manager ----------------------------- */

function LinkManager({ links, onChange }: { links: ReportLink[]; onChange: (links: ReportLink[]) => void }) {
  const [open, setOpen] = useState(false);
  const tasks = useCollection<{ title?: string }>('tasks');
  const decisions = useCollection<{ title?: string }>('decisions');
  // Synced collection: the same clients are linkable from every platform.
  const { clients } = useClients();

  const has = (kind: ReportLink['kind'], id: string) => links.some((l) => l.kind === kind && l.id === id);
  const add = (link: ReportLink) => {
    if (!has(link.kind, link.id)) onChange([...links, link]);
    setOpen(false);
  };
  const removeLink = (link: ReportLink) => onChange(links.filter((l) => !(l.kind === link.kind && l.id === link.id)));

  const candidates: ReportLink[] = [
    ...tasks.map((t) => ({ kind: 'task' as const, id: t.id, label: t.title || 'Tâche' })),
    ...decisions.map((d) => ({ kind: 'decision' as const, id: d.id, label: d.title || 'Décision' })),
    ...clients.map((c) => ({ kind: 'client' as const, id: String(c.id), label: c.name })),
  ].filter((c) => !has(c.kind, c.id));

  return (
    <div className="border-t border-border px-3 py-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{tr('hist.reports.elementsLies')}</span>
        {links.map((l) => {
          const Icon = l.kind === 'task' ? CheckSquare : l.kind === 'client' ? Contact : Scale;
          return (
            <span key={`${l.kind}:${l.id}`} className="group/l flex items-center gap-1 rounded-sm bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-text-secondary">
              <Icon size={11} strokeWidth={2} />
              {l.label}
              <button
                type="button"
                onClick={() => removeLink(l)}
                aria-label={tr('hist.reports.retirerLeLien')}
                className="opacity-0 transition-opacity hover:text-danger group-hover/l:opacity-100"
              >
                <X size={10} strokeWidth={2.5} />
              </button>
            </span>
          );
        })}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 rounded-sm border border-dashed border-border px-1.5 py-0.5 text-[11px] text-text-muted transition-colors hover:border-accent/50 hover:text-accent"
          >
            <Link2 size={11} strokeWidth={2} /> Lier
          </button>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-full left-0 z-20 mb-1 max-h-64 w-64 overflow-y-auto rounded-lg border border-border bg-surface elev-2"
            >
              {candidates.length === 0 ? (
                <p className="px-3 py-2 text-xs text-text-muted">{tr('hist.reports.rienALier')}</p>
              ) : (
                candidates.slice(0, 40).map((c) => {
                  const Icon = c.kind === 'task' ? CheckSquare : c.kind === 'client' ? Contact : Scale;
                  return (
                    <button
                      key={`${c.kind}:${c.id}`}
                      type="button"
                      onClick={() => add(c)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                    >
                      <Icon size={13} strokeWidth={1.9} className="text-text-muted" />
                      <span className="min-w-0 flex-1 truncate">{c.label}</span>
                      <span className="font-mono text-[9px] uppercase tracking-widest text-text-muted">
                        {typeLabel(c.kind)}
                      </span>
                    </button>
                  );
                })
              )}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Bits ---------------------------------- */

function TypeChip({ type }: { type: ReportType }) {
  return (
    <span className="flex-shrink-0 rounded-sm border border-border bg-bg px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-text-muted">
      {typeLabel(type)}
    </span>
  );
}


function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    // Scrolls horizontally rather than clipping: with seven filters the row no
    // longer fits a 390px screen, and a clipped row silently hides the last
    // options (RGPD was unreachable on mobile).
    <div className="flex max-w-full items-center overflow-x-auto border border-border bg-surface">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          /*
          Voir `docs/PRINCIPE-CONFORT.md`. Ces filtres se touchent, et
          c'est JUSTE : un contrôle segmenté se lit comme un seul objet, et
          le segment actif est rempli — on ne se trompe pas de cible parce
          qu'on ne voit pas la frontière, on la voit très bien.

          Ce qui manquait n'était pas l'écart mais la HAUTEUR : 31 px
          mesurés, sous les 44 px qui rendent un geste confortable sans
          qu'on ait à viser. `min-h-11` les y porte.
            */
          className={`flex min-h-11 flex-shrink-0 items-center whitespace-nowrap px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors duration-150 ${
            value === opt.value ? 'bg-accent-muted text-text-primary' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
