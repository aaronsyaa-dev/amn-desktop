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
  templatesForScope,
} from '../lib/pageBlocks';
import { checklistTotals } from '../lib/pageBlocks';
import { centsToInput, formatCents, parsePositiveAmount } from '../lib/money';
import type { PageBlock, PageData, PageEditorRole } from '../shared/api';

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

const TYPES: { type: PageBlock['type']; label: string; icon: typeof Type }[] = [
  { type: 'text', label: 'Texte', icon: Type },
  { type: 'checklist', label: 'Liste à cocher', icon: ListChecks },
  { type: 'table', label: 'Tableau', icon: TableIcon },
  { type: 'image', label: 'Image', icon: ImageIcon },
  { type: 'video', label: 'Vidéo', icon: Video },
];

const ROLES: { role: PageEditorRole; label: string }[] = [
  { role: 'owner', label: 'Propriétaire' },
  { role: 'admin', label: 'Administrateur' },
  { role: 'member', label: 'Membre' },
];

export function PagesScreen({ scope, title, description }: {
  /** Le module propriétaire. Les pages des autres modules ne sont pas listées. */
  scope?: string;
  title?: string;
  description?: string;
}) {
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

  const courante = pages.find((p) => p.id === ouverte) ?? null;
  const modifiable = courante ? canEditPage(role, courante.data) : false;

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
          title={title ?? 'Pages'}
          description={
            description ??
            'Des pages composées de blocs, écrites à plusieurs. Tout le monde les voit à jour ; les rôles choisis peuvent les modifier.'
          }
          stats={[{ label: 'Pages', value: pages.length }]}
          actions={
            <button
              type="button"
              onClick={() => setCreation((v) => !v)}
              className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
            >
              <Plus size={16} strokeWidth={2} />
              Nouvelle page
            </button>
          }
        />
      </StaggerItem>

      <AnimatePresence initial={false}>
        {creation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="panel p-4">
              <p className="eyebrow">Partir d’un gabarit</p>
              <p className="mt-1 text-xs text-text-secondary">
                Un point de départ, pas un formulaire : tout se démonte ensuite.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {templatesForScope(scope).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => creer(t.id)}
                    className="flex flex-col items-start gap-1 border border-border bg-surface px-3 py-2.5 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
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

      <StaggerItem>
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          {/* ------------------------------------------------ la liste ---- */}
          <div className="panel flex flex-col gap-1 p-2">
            {!ready && <p className="px-2 py-3 text-xs text-text-muted">Chargement…</p>}
            {ready && pages.length === 0 && (
              <p className="px-2 py-3 text-xs text-text-muted">
                Aucune page pour l’instant. « Nouvelle page » en crée une depuis un gabarit.
              </p>
            )}
            {pages.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setOuverte(p.id)}
                className={`flex min-h-11 items-center gap-2.5 rounded px-2.5 text-left text-sm transition-colors ${
                  p.id === ouverte
                    ? 'bg-accent-muted text-text-primary'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                }`}
              >
                <span className="flex-shrink-0">{p.data.icon ?? <FileText size={15} />}</span>
                <span className="min-w-0 flex-1 truncate">{p.data.title}</span>
                {!canEditPage(role, p.data) && (
                  <Lock size={11} className="flex-shrink-0 text-text-muted" aria-label="Lecture seule" />
                )}
              </button>
            ))}
          </div>

          {/* ----------------------------------------------- l'éditeur ---- */}
          <div className="panel min-h-[300px] p-4">
            {!courante ? (
              <p className="text-sm text-text-muted">
                Choisissez une page à gauche, ou créez-en une.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
                  <input
                    value={courante.data.title}
                    disabled={!modifiable}
                    onChange={(e) =>
                      enregistrer(courante.id, { ...courante.data, title: e.target.value })
                    }
                    className="min-w-0 flex-1 bg-transparent text-lg font-semibold text-text-primary outline-none disabled:cursor-default"
                    aria-label="Titre de la page"
                  />
                  {modifiable && (
                    <ConfirmDelete
                      onConfirm={() => void remove('pages', courante.id)}
                      label="Supprimer la page"
                    />
                  )}
                </div>

                {!modifiable && (
                  <p className="mt-3 flex items-center gap-2 border border-border bg-surface px-3 py-2 text-xs text-text-secondary">
                    <Lock size={12} className="flex-shrink-0" />
                    Lecture seule : votre rôle n’est pas autorisé à modifier cette page. Vous en
                    voyez toujours la dernière version.
                  </p>
                )}

                {/* ------------------------------------------- les blocs -- */}
                <div className="mt-4 flex flex-col gap-3">
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
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
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
                          className="flex items-center gap-1.5 border border-border bg-surface px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                        >
                          <Icone size={13} strokeWidth={1.75} />
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* --------------------------------------- les rôles -- */}
                    <div className="mt-4 border-t border-border pt-4">
                      <p className="eyebrow">Qui peut modifier</p>
                      <p className="mt-1 text-xs text-text-muted">
                        Tout le monde lit la page. Le propriétaire garde toujours la main — sans
                        quoi une page pourrait devenir impossible à corriger.
                      </p>
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
  return (
    <div className="group relative border border-border bg-surface p-3">
      {modifiable && (
        <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <BoutonBloc onClick={onMonter} label="Monter" icon={ChevronUp} />
          <BoutonBloc onClick={onDescendre} label="Descendre" icon={ChevronDown} />
          <BoutonBloc onClick={onSupprimer} label="Supprimer le bloc" icon={Trash2} />
        </div>
      )}
      <Contenu bloc={bloc} modifiable={modifiable} onChange={onChange} />
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
      className="flex h-6 w-6 items-center justify-center border border-border bg-raised text-text-muted transition-colors hover:text-text-primary"
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
        placeholder="Écrire…"
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
            <Video size={13} />
            Ouvrir la vidéo
          </a>
        )}
        <input
          value={bloc.caption ?? ''}
          disabled={!modifiable}
          onChange={(e) => onChange({ ...bloc, caption: e.target.value })}
          placeholder="Légende (facultative)"
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
                aria-label="Retirer la ligne"
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
          >
            + une ligne
          </button>
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
                    aria-label="Ajouter une colonne"
                    title="Ajouter une colonne"
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
                      aria-label="Retirer la ligne"
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
          >
            + une ligne
          </button>
          {bloc.columns.length > 1 && (
            <button
              type="button"
              onClick={() => onChange(removeColumn(bloc, bloc.columns.length - 1))}
              className="-my-1 py-1 text-xs text-text-muted hover:text-text-primary"
            >
              − la dernière colonne
            </button>
          )}
        </div>
      )}
    </div>
  );
}
