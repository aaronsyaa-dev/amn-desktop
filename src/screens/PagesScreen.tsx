import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  ListChecks,
  Lock,
  Plus,
  Table as TableIcon,
  Trash2,
  Type,
  Video,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useCollection, useSync, uid } from '../state/SyncContext';
import { ScreenHeader } from '../components/ScreenHeader';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import { ConfirmDelete } from '../components/ConfirmDelete';
import {
  addColumn,
  blockId,
  canEditPage,
  emptyBlock,
  moveBlock,
  normalizePage,
  normalizeRoles,
  removeColumn,
  checklistTotals,
  templatesForScope,
} from '../lib/pageBlocks';
import { centsToInput, formatCents, parsePositiveAmount } from '../lib/money';
import type { PageBlock, PageData, PageEditorRole } from '../shared/api';
import { useLangue, t as tr } from '../i18n';
import { useHaloSignal } from '../components/EtatEcran';

/**
 * LES PAGES — UN MOTEUR, PLUSIEURS MODULES (BLOC 3)
 * ═════════════════════════════════════════════════
 *
 * Une page est une suite de blocs qu'on écrit à plusieurs. C'est le même
 * moteur pour une fiche de production, un brief, une page d'information
 * d'équipe et les pages du module Personnel — d'où le `scope`, qui dit à quel
 * module une page appartient sans que la logique de blocs soit réécrite.
 *
 * ## Édition par rôle, lecture par tous
 *
 * Tout le monde voit la page à jour ; seuls les rôles listés peuvent la
 * modifier. C'est ce que demandait l'exemple de l'adresse d'un lieu de tournage
 * qui change : une personne corrige, tout le monde le voit, personne n'a de
 * version périmée dans un fichier à part.
 *
 * Le réglage est un droit d'ÉCRITURE, pas une barrière de confidentialité :
 * l'isolation des données reste celle de l'organisation, comme partout. Un
 * écran en lecture seule n'est donc jamais une promesse de secret, et il ne
 * prétend pas l'être.
 *
 * ## L'enregistrement
 *
 * Chaque geste écrit la page entière par `upsert` — la synchronisation existante
 * s'occupe du reste, et l'autre poste voit le changement sans recharger. Deux
 * personnes qui écrivent EN MÊME TEMPS sur la même page : la dernière écriture
 * gagne. C'est la limite du modèle, elle est assumée ici (une fiche de
 * production se remplit à quelques-uns, pas à vingt en simultané) et il vaut
 * mieux l'écrire que la laisser découvrir.
 */

/* ─── LA PAGE DE PROFIL — l'objet dominant (`18a`) ────────────────────────── */

/*
  ON VOIT LA FORME D'UNE PAGE AVANT D'EN LIRE UN MOT.

  La page est rendue DE PROFIL : un bloc horizontal par section, chacun à la
  hauteur de ce qu'il contient RÉELLEMENT. Où elle est dense, où elle est
  creuse, et où il manque quelque chose — tout ça se lit sans lire. Un
  sommaire en liste dirait « 6 blocs » ; le profil dit lesquels portent
  quelque chose.

  DEUX RÈGLES, et la seconde est celle qu'on oublie.
  · La hauteur d'un bloc est proportionnelle à SON CONTENU, pas à son
    importance. Un pied de page de deux lignes fait 34 px même s'il est
    obligatoire ; un bloc de prestations en fait 96 même s'il est facultatif.
  · UN BLOC VIDE SE DESSINE À UNE HAUTEUR MINIMALE VISIBLE. Il ne disparaît
    pas, et il ne se réduit pas à un trait : c'est précisément lui qu'on
    cherche, et un manque qu'on ne voit pas n'est pas signalé.
*/
const PROFIL_H_MIN = 34;
const PROFIL_H_MAX = 120;
/** Ce qu'une unité de contenu (ligne, article, rangée) ajoute à la hauteur. */
const PROFIL_PAS = 9;

interface BlocDeProfil {
  id: string;
  type: PageBlock['type'];
  typeLabel: string;
  resume: string;
  unites: number;
  hauteur: number;
  vide: boolean;
}

/** Le nombre d'unités de contenu d'un bloc — ce qui fait sa hauteur. */
function unitesDuBloc(bloc: PageBlock): number {
  switch (bloc.type) {
    case 'text':
      return bloc.text.trim() ? bloc.text.trim().split(/\n+/).length : 0;
    case 'checklist':
      return bloc.items.filter((i) => i.text.trim()).length;
    case 'table':
      return bloc.rows.filter((r) => r.some((c) => c.trim())).length;
    case 'image':
    case 'video':
      return bloc.url.trim() ? 3 : 0;
    default:
      return 0;
  }
}

/** Le contenu résumé, au centre du bloc. Jamais le contenu entier. */
function resumeDuBloc(bloc: PageBlock): string {
  switch (bloc.type) {
    case 'text': {
      const texte = bloc.text.trim().replace(/\s+/g, ' ');
      return texte.length > 120 ? `${texte.slice(0, 117)}…` : texte;
    }
    case 'checklist': {
      const faits = bloc.items.filter((i) => i.done).length;
      const total = bloc.items.filter((i) => i.text.trim()).length;
      return total === 0 ? '' : `${total} point${total > 1 ? 's' : ''}, ${faits} coché${faits > 1 ? 's' : ''}`;
    }
    case 'table': {
      const lignes = bloc.rows.filter((r) => r.some((c) => c.trim())).length;
      return lignes === 0
        ? ''
        : `${bloc.columns.length} colonne${bloc.columns.length > 1 ? 's' : ''} × ${lignes} ligne${lignes > 1 ? 's' : ''}`;
    }
    case 'image':
    case 'video':
      return bloc.url.trim() ? bloc.caption?.trim() || bloc.url.trim() : '';
    default:
      return '';
  }
}

function profilDeLaPage(blocs: PageBlock[], nomDuType: (t: PageBlock['type']) => string): BlocDeProfil[] {
  return blocs.map((bloc) => {
    const unites = unitesDuBloc(bloc);
    return {
      id: bloc.id,
      type: bloc.type,
      typeLabel: nomDuType(bloc.type),
      resume: resumeDuBloc(bloc),
      unites,
      hauteur: Math.min(PROFIL_H_MAX, PROFIL_H_MIN + unites * PROFIL_PAS),
      vide: unites === 0,
    };
  });
}

const TYPES: { type: PageBlock['type']; label: string; icon: typeof Type }[] = [
  { type: 'text', label: tr('hist.pages.texte'), icon: Type },
  { type: 'checklist', label: tr('hist.pages.listeACocher'), icon: ListChecks },
  { type: 'table', label: tr('hist.pages.tableau'), icon: TableIcon },
  { type: 'image', label: tr('hist.pages.image'), icon: ImageIcon },
  { type: 'video', label: tr('hist.pages.video'), icon: Video },
];

/*
  LE NOM DU TYPE, DANS LA GOUTTIÈRE DU BLOC.

  Un bloc rempli ne dit plus ce qu'il est : trois lignes de texte et un tableau
  à une colonne se ressemblent une fois écrits. Le type était visible à la
  seconde où on l'ajoutait, et invisible ensuite — alors que c'est lui qui dit
  ce qu'on peut faire du bloc (cocher, ordonner, ajouter une colonne).
*/
const nomDuType = (type: PageBlock['type']) => TYPES.find((t) => t.type === type)?.label ?? type;

/*
  Le sous-titre d'une entrée du rail. Le nombre de blocs dit le POIDS de la
  page — c'est la seule mesure qu'on ait avant de l'ouvrir. « Lecture seule »
  passe devant : un accès refusé change ce qu'on va faire de la page, un
  nombre de blocs non.
*/
function sousTitreDeLaPage(nbBlocs: number, modifiable: boolean): string {
  if (!modifiable) return tr('hist.pages.lectureSeule');
  if (nbBlocs === 0) return tr('hist.pages.aucunBloc');
  if (nbBlocs === 1) return tr('hist.pages.unBloc');
  return tr('hist.pages.nBlocs', { n: nbBlocs });
}

const ROLES: { role: PageEditorRole; label: string }[] = [
  { role: 'owner', label: tr('hist.pages.proprietaire') },
  { role: 'admin', label: 'Administrateur' },
  { role: 'member', label: 'Membre' },
];

export function PagesScreen({ scope, title, description }: {
  /** Le module propriétaire. Les pages des autres modules ne sont pas listées. */
  scope?: string;
  title?: string;
  description?: string;
}) {
  /* L'abonnement à la langue : `tr(...)` lit la langue ACTIVE à l'appel, donc
     sans abonnement l'écran garde celle du montage. */
  useLangue();
  const { role } = useAuth();
  const { upsert, remove, ready } = useSync();
  const brutes = useCollection<PageData>('pages');
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [creation, setCreation] = useState(false);

  const pages = useMemo(
    () =>
      brutes
        .map((p) => ({ id: (p as { id: string }).id, data: normalizePage(p) }))
        .filter((p) => (scope ? p.data.scope === scope : !p.data.scope))
        .sort((a, b) => a.data.title.localeCompare(b.data.title, 'fr')),
    [brutes, scope],
  );

  /*
    LA PAGE OUVERTE PAR DÉFAUT — celle qui a un bloc vide s'il en existe une.

    Le profil n'a qu'un défaut à montrer : le bloc qui retient la page. S'ouvrir
    sur une page complète, c'est s'ouvrir sur la démonstration la moins
    parlante — et laisser le trou ailleurs, invisible.
  */
  const premiereIncomplete = useMemo(
    () => pages.find((p) => p.data.blocks.some((b) => unitesDuBloc(b) === 0)) ?? null,
    [pages],
  );
  const courante = pages.find((p) => p.id === ouverte) ?? premiereIncomplete ?? pages[0] ?? null;
  const modifiable = courante ? canEditPage(role, courante.data) : false;

  /*
    LE PROFIL DE LA PAGE OUVERTE, et le bloc qui retient la publication.

    L'ambre va au PREMIER bloc vide dans l'ordre de la page : c'est celui
    qu'on rencontrera en descendant, et désigner le dernier obligerait à
    remonter. Une page dont tous les blocs portent quelque chose n'a pas
    d'ambre — il n'y a rien à décider.
  */
  const nomDuType = (t: PageBlock['type']) =>
    TYPES.find((entry) => entry.type === t)?.label ?? t;
  const profil = useMemo(
    () => (courante ? profilDeLaPage(courante.data.blocks, nomDuType) : []),
    [courante],
  );
  const blocAmbre = profil.find((b) => b.vide) ?? null;
  const halo = useHaloSignal(blocAmbre !== null);

  const enregistrer = (id: string, data: PageData) => void upsert('pages', id, { ...data });

  const creer = (templateId: string) => {
    const gabarit = templatesForScope(scope).find((t) => t.id === templateId);
    if (!gabarit) return;
    const id = uid('page');
    const base = gabarit.build();
    const data: PageData = {
      ...base,
      // `owner` et `admin` par défaut : une page nouvelle doit être modifiable
      // par qui l'a créée, et le réglage s'ouvre ensuite si besoin.
      editorRoles: normalizeRoles(['owner', 'admin']),
      scope,
      template: gabarit.id,
    };
    void upsert('pages', id, { ...data });
    setOuverte(id);
    setCreation(false);
  };

  const majBloc = (index: number, bloc: PageBlock) => {
    if (!courante || !modifiable) return;
    const blocks = courante.data.blocks.map((b, i) => (i === index ? bloc : b));
    enregistrer(courante.id, { ...courante.data, blocks });
  };

  return (
    <StaggerGroup className="flex flex-col gap-6">
      <StaggerItem>
        <ScreenHeader
          eyebrow={scope ? `Pages · ${scope}` : 'Pages'}
          title={title ?? tr('hist.pages.titre')}
          description={
            description ??
            tr('hist.pages.description')
          }
          /*
            Le nombre de pages n'est plus un relevé d'en-tête : il est écrit en
            tête du rail, juste au-dessus de la liste qu'il compte. Le répéter
            ici en ferait deux chiffres à rapprocher pour la même mesure.
          */
          actions={
            <button
              type="button"
              onClick={() => setCreation((v) => !v)}
              className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
            >
              <Plus size={16} strokeWidth={2} />{tr('hist.pages.nouvellePage')}</button>
          }
        />
      </StaggerItem>

      {/* ── LA PAGE DE PROFIL — l'objet dominant (`18a`) ─────────────────── */}
      {courante && profil.length > 0 && (
        <StaggerItem>
          <section className="panel-raised panel-raised-wide p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <p className="eyebrow">{courante.data.title || 'Page sans titre'} · de profil</p>
              <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-text-muted">
                la hauteur d’un bloc est ce qu’il contient
              </p>
            </div>

            <div className="mt-4 flex flex-col gap-1.5">
              {profil.map((b) => {
                const signal = blocAmbre?.id === b.id;
                return (
                  <div
                    key={b.id}
                    className={`flex items-center gap-4 border px-3 ${
                      signal
                        ? `border-signal-line bg-signal-muted ${halo}`
                        : 'border-border bg-sunken'
                    }`}
                    style={{ height: b.hauteur }}
                    data-signal-groupe={signal ? 'bloc-vide' : undefined}
                  >
                    <span
                      className={`w-24 flex-shrink-0 truncate font-mono text-[10px] uppercase tracking-[0.14em] ${
                        signal ? 'text-signal' : 'text-text-muted'
                      }`}
                      data-signal-groupe={signal ? 'bloc-vide' : undefined}
                    >
                      {b.typeLabel}
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate text-[13px] ${
                        b.vide ? (signal ? 'text-signal' : 'text-text-muted') : 'text-text-secondary'
                      }`}
                      data-signal-groupe={signal ? 'bloc-vide' : undefined}
                    >
                      {b.vide ? 'Aucun contenu' : b.resume}
                    </span>
                    <span className="tnum w-12 flex-shrink-0 text-right font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {b.hauteur} px
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="mt-4 border-t border-border-row pt-3 text-[12.5px] leading-relaxed text-text-muted">
              {blocAmbre
                ? `Le bloc « ${blocAmbre.typeLabel} » n’a aucun contenu : c’est lui qui retient la page. Un bloc vide garde sa place et sa hauteur minimale — un manque qu’on ne voit pas n’est pas signalé.`
                : 'Tous les blocs de cette page portent quelque chose.'}
            </p>
            {/*
              CE QUE LE PRODUIT NE MESURE PAS. La maquette place à droite « les
              visites du mois et la page la plus vue ». Les pages de ce module
              sont INTERNES : elles ne passent par aucune page publique, rien
              ne compte de visite, et le module `22a Mini-page` est celui qui
              porte la fréquentation. Afficher un compteur ici serait afficher
              un zéro qui n'a jamais été mesuré.
            */}
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-muted">
              Ces pages sont internes : elles ne sont pas publiées, et aucune visite n’est comptée.
              La fréquentation d’une page publique se lit dans Mini-page.
            </p>
          </section>
        </StaggerItem>
      )}

      <StaggerItem>
        <div className="grid gap-4 lg:grid-cols-[268px_1fr]">
          {/* ------------------------------------------------- le rail ---- */}
          <div className="panel flex flex-col self-start">
            {/*
              LE RAIL SE COMPTE LUI-MÊME.

              Une pile de pages sans nombre oblige à compter des lignes pour
              savoir si on les a toutes sous les yeux ou si la liste défile.
            */}
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <p className="eyebrow">
                {pages.length} {pages.length === 1 ? 'page' : 'pages'}
              </p>
              <button
                type="button"
                onClick={() => setCreation((v) => !v)}
                aria-label={tr('hist.pages.nouvellePageCourt')}
                title={tr('hist.pages.nouvellePageCourt')}
                className="flex h-7 w-7 items-center justify-center border border-border text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
              >
                <Plus size={14} strokeWidth={2} />
              </button>
            </div>

            <div className="flex flex-col p-1.5">
              {!ready && <p className="px-2 py-3 text-xs text-text-muted">Chargement…</p>}
              {ready && pages.length === 0 && (
                <p className="px-2 py-3 text-xs text-text-muted">{tr('hist.pages.aucunePagePourL')}</p>
              )}
              {pages.map((p) => {
                const editable = canEditPage(role, p.data);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setOuverte(p.id)}
                    /*
                      Un filet à gauche plutôt qu'un fond plein sur la page
                      ouverte : le rail est une marge, pas une liste de
                      boutons, et un bloc de couleur y pèse plus que le
                      document qu'il désigne.
                    */
                    className={`flex min-h-12 items-start gap-2.5 border-l-2 px-2.5 py-2 text-left transition-colors ${
                      p.id === ouverte
                        ? 'border-l-text-primary bg-surface-hover'
                        : 'border-l-transparent hover:bg-surface-hover'
                    }`}
                  >
                    <span className="mt-0.5 flex-shrink-0 text-text-muted">
                      {p.data.icon ?? (editable ? <FileText size={14} /> : <Lock size={13} />)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-sm leading-snug ${
                          p.id === ouverte ? 'text-text-primary' : 'text-text-secondary'
                        }`}
                      >
                        {p.data.title}
                      </span>
                      <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        {sousTitreDeLaPage(p.data.blocks.length, editable)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {/*
              LES GABARITS VIVENT DANS LE RAIL.

              Ils ouvraient un panneau en pleine largeur au-dessus de l'écran,
              qui poussait la page en cours de lecture vers le bas. Or choisir
              un gabarit, c'est choisir une NOUVELLE ENTRÉE du rail : le choix
              appartient à l'endroit où le résultat apparaîtra.
            */}
            <AnimatePresence initial={false}>
              {creation && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="m-1.5 border border-dashed border-border p-3">
                    <p className="eyebrow">{tr('hist.pages.partirDUnGabarit')}</p>
                    <p className="mt-1 text-xs text-text-secondary">{tr('hist.pages.unPointDeDepart')}</p>
                    <div className="mt-2.5 flex flex-col gap-1.5">
                      {templatesForScope(scope).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => creer(t.id)}
                          className="flex flex-col items-start gap-0.5 border border-border bg-surface px-2.5 py-2 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
                        >
                          <span className="text-sm text-text-primary">{t.label}</span>
                          <span className="text-xs text-text-muted">{t.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* -------------------------------------------- le document ---- */}
          <div className="panel-sheet min-h-[300px] p-5 sm:p-7">
            {!courante ? (
              <p className="text-sm text-text-muted">{tr('hist.pages.choisissezUnePageA')}</p>
            ) : (
              <>
                {/*
                  LE STATUT D'ÉCRITURE, EN TÊTE ET UNE SEULE FOIS.

                  « Lecture seule » n'apparaissait qu'en bandeau d'excuse APRÈS
                  le titre, et seulement quand l'accès était refusé. Le cas
                  inverse — j'ai le droit d'écrire ici — n'était écrit nulle
                  part : on le découvrait en essayant.
                */}
                <div className="flex flex-wrap items-center gap-2.5 pb-3">
                  <span className="border border-border px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary">
                    {modifiable ? tr('hist.pages.vousEtesProprietaire') : tr('hist.pages.lectureSeule')}
                  </span>
                  {modifiable && (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      {tr('hist.pages.toutLeMondeLitCourt')}
                    </span>
                  )}
                  <span className="flex-1" />
                  {modifiable && (
                    <ConfirmDelete
                      onConfirm={() => void remove('pages', courante.id)}
                      label={tr('hist.pages.supprimerLaPage')}
                    />
                  )}
                </div>

                {/*
                  Le titre est celui d'un DOCUMENT, pas l'étiquette d'un
                  panneau : il était à 18 px, plus petit que le titre d'écran
                  qui le surplombait, alors que c'est lui qu'on est venu lire.
                */}
                <input
                  value={courante.data.title}
                  disabled={!modifiable}
                  onChange={(e) =>
                    enregistrer(courante.id, { ...courante.data, title: e.target.value })
                  }
                  className="w-full border-b border-border bg-transparent pb-4 text-[27px] font-bold leading-tight tracking-[-0.02em] text-text-primary outline-none disabled:cursor-default sm:text-[32px]"
                  aria-label={tr('hist.pages.titreDeLaPage')}
                />

                {/*
                  La phrase longue reste, mais sous le titre et sans plaque :
                  l'ÉTAT est déjà dit par le jeton en tête, celle-ci n'en donne
                  plus que la RAISON — et une raison ne se crie pas.
                */}
                {!modifiable && (
                  <p className="mt-3 flex items-start gap-2 text-xs text-text-muted">
                    <Lock size={12} className="mt-0.5 flex-shrink-0" />{tr('hist.pages.lectureSeuleVotreRole')}</p>
                )}

                {/* ------------------------------------------- les blocs -- */}
                <div className="mt-2 flex flex-col">
                  {courante.data.blocks.map((bloc, index) => (
                    <BlocEditeur
                      key={bloc.id}
                      bloc={bloc}
                      modifiable={modifiable}
                      onChange={(b) => majBloc(index, b)}
                      onMonter={() =>
                        enregistrer(courante.id, {
                          ...courante.data,
                          blocks: moveBlock(courante.data.blocks, index, -1),
                        })
                      }
                      onDescendre={() =>
                        enregistrer(courante.id, {
                          ...courante.data,
                          blocks: moveBlock(courante.data.blocks, index, 1),
                        })
                      }
                      onSupprimer={() =>
                        enregistrer(courante.id, {
                          ...courante.data,
                          blocks: courante.data.blocks.filter((_, i) => i !== index),
                        })
                      }
                    />
                  ))}
                </div>

                {modifiable && (
                  <>
                    {/*
                      LA PALETTE — L'UNIQUE AMBRE DE L'ÉCRAN.

                      Une page est une PILE qu'on allonge : le geste du module,
                      celui qu'on refait à chaque ouverture, est d'ajouter un
                      bloc. Il était une rangée de petits boutons gris sans
                      titre, au ras du dernier bloc — impossible à distinguer
                      du contenu qu'elle sert à écrire.

                      L'ambre porte ici un SURTITRE et non une plaque : la
                      règle réserve la plaque au corps de texte, et le paquet
                      nomme lui-même « ajouter un bloc » comme le signal de cet
                      écran — même arbitrage qu'en 7b pour « tiré de ».

                      Ambre parce qu'il y a une DÉCISION à prendre : quel type
                      de bloc ajouter. Les cinq boutons restent sobres — c'est
                      le choix qui appelle, pas chacune de ses cinq réponses.
                    */}
                    <div
                      className="mt-6 border border-border bg-sunken p-4"
                      data-signal-groupe="ajouter-un-bloc"
                    >
                      {/* Ce surtitre portait l'ambre. Il le cède au bloc vide
                          de la page de profil : ajouter un bloc est une
                          possibilité permanente, pas une décision — et un
                          écran n'a qu'une région ambre. */}
                      <p className="eyebrow mb-3">{tr('hist.pages.ajouterUnBloc')}</p>
                      <div className="flex flex-wrap gap-2">
                        {TYPES.map(({ type, label, icon: Icone }) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() =>
                              enregistrer(courante.id, {
                                ...courante.data,
                                blocks: [...courante.data.blocks, emptyBlock(type)],
                              })
                            }
                            className="flex min-h-9 items-center gap-1.5 border border-border bg-surface px-3 py-1.5 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                          >
                            <Icone size={13} strokeWidth={1.9} />
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* --------------------------------------- les rôles -- */}
                    <div className="mt-5 border-t border-border pt-4">
                      <p className="eyebrow">{tr('hist.pages.quiPeutModifier')}</p>
                      <p className="mt-1 text-xs text-text-muted">{tr('hist.pages.toutLeMondeLit')}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {ROLES.map(({ role: r, label }) => {
                          const on = courante.data.editorRoles.includes(r);
                          const verrouille = r === 'owner';
                          return (
                            <button
                              key={r}
                              type="button"
                              disabled={verrouille}
                              onClick={() =>
                                enregistrer(courante.id, {
                                  ...courante.data,
                                  editorRoles: normalizeRoles(
                                    on
                                      ? courante.data.editorRoles.filter((x) => x !== r)
                                      : [...courante.data.editorRoles, r],
                                  ),
                                })
                              }
                              className={`border px-2.5 py-1.5 text-xs transition-colors disabled:cursor-default disabled:opacity-60 ${
                                on
                                  ? 'border-accent bg-accent text-bg'
                                  : 'border-border text-text-secondary hover:border-border-strong'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </StaggerItem>
    </StaggerGroup>
  );
}

/* -------------------------------------------------------------------------- */

function BlocEditeur({
  bloc,
  modifiable,
  onChange,
  onMonter,
  onDescendre,
  onSupprimer,
}: {
  bloc: PageBlock;
  modifiable: boolean;
  onChange: (b: PageBlock) => void;
  onMonter: () => void;
  onDescendre: () => void;
  onSupprimer: () => void;
}) {
  /*
    Le bloc n'est plus une carte mais une LIGNE DE DOCUMENT : une gouttière de
    gauche qui le nomme, le contenu au centre, les commandes à droite. Encadrer
    chaque bloc donnait une pile de boîtes de même poids, où le texte d'une page
    avait l'air d'un formulaire à remplir plutôt que d'un document à lire.
  */
  return (
    <div className="group relative grid gap-2 border-b border-border py-4 last:border-b-0 sm:grid-cols-[86px_1fr] sm:gap-4">
      <p className="eyebrow leading-[1.35] sm:pt-1">{nomDuType(bloc.type)}</p>
      <div className="min-w-0">
        <Contenu bloc={bloc} modifiable={modifiable} onChange={onChange} />
      </div>
      {modifiable && (
        <div className="absolute right-0 top-3 flex gap-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <BoutonBloc onClick={onMonter} label="Monter" icon={ChevronUp} />
          <BoutonBloc onClick={onDescendre} label="Descendre" icon={ChevronDown} />
          <BoutonBloc onClick={onSupprimer} label={tr('hist.pages.supprimerLeBloc')} icon={Trash2} />
        </div>
      )}
    </div>
  );
}

function BoutonBloc({
  onClick,
  label,
  icon: Icone,
}: {
  onClick: () => void;
  label: string;
  icon: typeof ChevronUp;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      /*
        36 px, et un écart sur le conteneur. Voir
        `docs/PRINCIPE-CONFORT.md` : une barre d'outils serre ses boutons par
        habitude, mais 28 px à 4 px d'écart reste une rangée de petites icônes
        grises qui se ressemblent toutes.
      */
      className="flex h-9 w-9 items-center justify-center border border-border bg-raised text-text-muted transition-colors hover:text-text-primary"
    >
      <Icone size={12} strokeWidth={2} />
    </button>
  );
}

function Contenu({
  bloc,
  modifiable,
  onChange,
}: {
  bloc: PageBlock;
  modifiable: boolean;
  onChange: (b: PageBlock) => void;
}) {
  if (bloc.type === 'text') {
    return (
      <textarea
        value={bloc.text}
        disabled={!modifiable}
        rows={Math.max(2, bloc.text.split('\n').length)}
        onChange={(e) => onChange({ ...bloc, text: e.target.value })}
        placeholder={tr('hist.pages.ecrire')}
        className="w-full resize-none bg-transparent pr-20 text-sm leading-relaxed text-text-secondary outline-none placeholder:text-text-muted disabled:cursor-default"
      />
    );
  }

  if (bloc.type === 'image' || bloc.type === 'video') {
    const estVideo = bloc.type === 'video';
    return (
      <div className="flex flex-col gap-2">
        <input
          value={bloc.url}
          disabled={!modifiable}
          onChange={(e) => onChange({ ...bloc, url: e.target.value })}
          placeholder={estVideo ? 'Lien de la vidéo (YouTube, Vimeo, Drive…)' : 'Lien de l’image'}
          className="w-full bg-transparent pr-20 font-mono text-xs text-text-secondary outline-none placeholder:text-text-muted disabled:cursor-default"
        />
        {/*
          La vidéo n'est JAMAIS hébergée ici : on montre un lien, pas un lecteur.
          Héberger de la vidéo, c'est du stockage, de la bande passante et du
          transcodage — trois métiers qu'AMN DevSec ne fait pas.
        */}
        {bloc.url && !estVideo && (
          <img
            src={bloc.url}
            alt={bloc.caption ?? ''}
            className="max-h-64 w-auto self-start border border-border object-contain"
          />
        )}
        {bloc.url && estVideo && (
          <a
            href={bloc.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 self-start border border-border bg-raised px-3 py-2 text-xs text-text-secondary hover:text-text-primary"
          >
            <Video size={13} />{tr('hist.pages.ouvrirLaVideo')}</a>
        )}
        <input
          value={bloc.caption ?? ''}
          disabled={!modifiable}
          onChange={(e) => onChange({ ...bloc, caption: e.target.value })}
          placeholder={tr('hist.pages.legendeFacultative')}
          className="w-full bg-transparent text-xs text-text-muted outline-none disabled:cursor-default"
        />
      </div>
    );
  }

  if (bloc.type === 'checklist') {
    const courses = bloc.shopping === true;
    const totaux = checklistTotals(bloc.items);
    return (
      <div className="flex flex-col gap-1.5 pr-20">
        {bloc.items.map((item, i) => (
          <label key={item.id} className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={item.done}
              disabled={!modifiable}
              onChange={() =>
                onChange({
                  ...bloc,
                  items: bloc.items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)),
                })
              }
              // 16 px mesurés. Sur une case à cocher, `p-1` ne sert à rien : la
              // boîte a une hauteur FIXE et le remplissage se range dedans. Il
              // faut agrandir la boîte — et cocher une course est le geste
              // principal de ce bloc, il mérite ses 24 px.
              className="h-6 w-6 flex-shrink-0 accent-[var(--color-accent)]"
            />
            <input
              value={item.text}
              disabled={!modifiable}
              onChange={(e) =>
                onChange({
                  ...bloc,
                  items: bloc.items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)),
                })
              }
              placeholder={courses ? 'Article…' : 'À faire…'}
              className={`min-w-0 flex-1 bg-transparent outline-none placeholder:text-text-muted disabled:cursor-default ${
                item.done ? 'text-text-muted line-through' : 'text-text-secondary'
              }`}
            />
            {courses && (
              <>
                {/* Le lien n'est cliquable qu'une fois rempli : une ancre vide
                    a l'air d'un lien et ne mène nulle part. */}
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Ouvrir la fiche produit de ${item.text || 'cet article'}`}
                    className="flex-shrink-0 text-text-muted hover:text-text-primary"
                  >
                    <ExternalLink size={12} />
                  </a>
                ) : null}
                <input
                  value={item.url ?? ''}
                  disabled={!modifiable}
                  onChange={(e) =>
                    onChange({
                      ...bloc,
                      items: bloc.items.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)),
                    })
                  }
                  placeholder="lien du produit"
                  className="w-28 flex-shrink-0 bg-transparent font-mono text-[10px] text-text-muted outline-none placeholder:text-text-muted disabled:cursor-default sm:w-40"
                />
                <input
                  inputMode="decimal"
                  defaultValue={typeof item.priceCents === 'number' ? centsToInput(item.priceCents) : ''}
                  disabled={!modifiable}
                  onBlur={(e) => {
                    const brut = e.target.value.trim();
                    const prix = brut === '' ? undefined : parsePositiveAmount(brut);
                    onChange({
                      ...bloc,
                      items: bloc.items.map((x, j) => (j === i ? { ...x, priceCents: prix } : x)),
                    });
                  }}
                  placeholder="prix"
                  aria-label="Prix de l’article"
                  className="w-14 flex-shrink-0 bg-transparent text-right font-mono text-[11px] text-text-secondary outline-none placeholder:text-text-muted disabled:cursor-default"
                />
              </>
            )}
            {modifiable && (
              <button
                type="button"
                aria-label={tr('hist.pages.retirerLaLigne')}
                onClick={() =>
                  onChange({ ...bloc, items: bloc.items.filter((_, j) => j !== i) })
                }
                // 12 × 12 px pour une SUPPRESSION, la plus petite cible de
                // toute l’application. `-m-1.5 p-1.5` la porte à 24.
                className="-m-1.5 flex-shrink-0 p-1.5 text-text-muted hover:text-text-primary"
              >
                <Trash2 size={12} />
              </button>
            )}
          </label>
        ))}
        {/*
          COMBIEN DE COCHÉES, SUR COMBIEN.

          Une liste de sept lignes dont quatre sont barrées demande qu'on
          compte des barres pour savoir où elle en est. Le relevé n'apparaît
          qu'à partir de deux lignes : « 0 / 1 coché » n'apprend rien qu'une
          case vide ne dise déjà.
        */}
        {!courses && bloc.items.length > 1 && (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-text-muted">
            {tr('hist.pages.nCoches', {
              faits: bloc.items.filter((x) => x.done).length,
              total: bloc.items.length,
            })}
          </p>
        )}
        {modifiable && (
          <button
            type="button"
            onClick={() =>
              onChange({
                ...bloc,
                items: [...bloc.items, { id: blockId('i'), text: '', done: false }],
              })
            }
            className="-my-1 self-start py-1 text-xs text-text-muted hover:text-text-primary"
          >{tr('hist.pages.uneLigne')}</button>
        )}
        {courses && (
          /*
            Le total dit AUSSI ce qu'il ne sait pas. Afficher « 24,80 € » sur
            une liste dont six articles n'ont pas de prix se lirait comme le
            montant des courses, et ce serait faux.
          */
          <p className="mt-1 border-t border-border pt-1.5 font-mono text-[11px] text-text-secondary">
            {formatCents(totaux.restantCents)} à prendre
            <span className="text-text-muted"> · {formatCents(totaux.totalCents)} en tout</span>
            {totaux.sansPrix > 0 && (
              <span className="text-text-muted">
                {' '}· {totaux.sansPrix} sans prix
              </span>
            )}
          </p>
        )}
        {modifiable && (
          <button
            type="button"
            onClick={() => onChange({ ...bloc, shopping: !courses })}
            className="-my-1.5 self-start py-1.5 text-[11px] text-text-muted hover:text-text-primary"
          >
            {courses ? 'Masquer les liens et les prix' : 'Liste de courses (liens et prix)'}
          </button>
        )}
      </div>
    );
  }

  // Tableau
  return (
    <div className="flex flex-col gap-2 pr-20">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {bloc.columns.map((col, c) => (
                <th key={c} className="border border-border p-0 text-left">
                  <input
                    value={col}
                    disabled={!modifiable}
                    onChange={(e) =>
                      onChange({
                        ...bloc,
                        columns: bloc.columns.map((x, j) => (j === c ? e.target.value : x)),
                      })
                    }
                    className="w-full bg-raised px-2 py-1.5 text-xs font-semibold text-text-primary outline-none disabled:cursor-default"
                  />
                </th>
              ))}
              {modifiable && (
                <th className="w-8 border border-border bg-raised p-0">
                  <button
                    type="button"
                    aria-label={tr('hist.pages.ajouterUneColonne')}
                    title={tr('hist.pages.ajouterUneColonne')}
                    onClick={() => onChange(addColumn(bloc, `Colonne ${bloc.columns.length + 1}`))}
                    className="flex h-full w-full items-center justify-center py-1.5 text-text-muted hover:text-text-primary"
                  >
                    <Plus size={12} />
                  </button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {bloc.rows.map((ligne, r) => (
              <tr key={r}>
                {ligne.map((cell, c) => (
                  <td key={c} className="border border-border p-0">
                    <input
                      value={cell}
                      disabled={!modifiable}
                      onChange={(e) =>
                        onChange({
                          ...bloc,
                          rows: bloc.rows.map((l, j) =>
                            j === r ? l.map((x, k) => (k === c ? e.target.value : x)) : l,
                          ),
                        })
                      }
                      className="w-full bg-transparent px-2 py-1.5 text-text-secondary outline-none disabled:cursor-default"
                    />
                  </td>
                ))}
                {modifiable && (
                  <td className="border border-border text-center">
                    <button
                      type="button"
                      aria-label={tr('hist.pages.retirerLaLigne')}
                      onClick={() =>
                        onChange({ ...bloc, rows: bloc.rows.filter((_, j) => j !== r) })
                      }
                      // Même suppression de 12 px, côté tableau.
                      className="-m-1.5 p-1.5 text-text-muted hover:text-text-primary"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modifiable && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() =>
              onChange({ ...bloc, rows: [...bloc.rows, bloc.columns.map(() => '')] })
            }
            className="-my-1 py-1 text-xs text-text-muted hover:text-text-primary"
          >{tr('hist.pages.uneLigne')}</button>
          {bloc.columns.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(removeColumn(bloc, bloc.columns.length - 1))}
              className="-my-1 py-1 text-xs text-text-muted hover:text-text-primary"
            >{tr('hist.pages.laDerniereColonne')}</button>
          )}
        </div>
      )}
    </div>
  );
}
