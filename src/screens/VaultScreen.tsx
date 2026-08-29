import React, { useMemo, useRef, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useVault, type VaultDraft } from '../state/useVault';
import { useUndo } from '../state/UndoContext';
import { copyWithAutoClear } from '../lib/clipboard';
import { downloadBlob } from '../lib/download';
import { bridge } from '../lib/bridge';
import type { VaultCategory, VaultEntry } from '../shared/api';
import { VAULT_CATEGORIES as CATEGORIES, vaultCategoryLabel as categoryLabel } from '../lib/vaultCategories';

const emptyDraft = (): VaultDraft => ({
  label: '',
  username: '',
  password: '',
  url: '',
  notes: '',
  category: 'accounts',
});

type CategoryFilter = VaultCategory | 'all';

interface EditState {
  id?: string;
  draft: VaultDraft;
}

/**
 * Coffre-fort — local-only password vault. See VaultEntry (shared/api.ts) and
 * useVault: nothing here ever calls amn-api or touches the sync machinery.
 * Encrypted at rest in Electron (OS keychain via safeStorage), plain
 * localStorage in the browser — `encrypted` (from useVault) says which, and
 * the browser case is called out explicitly rather than glossed over.
 */
export function VaultScreen() {
  const { entries, encrypted, loading, saveEntry, deleteEntry } = useVault();
  const { scheduleDelete, isPending } = useUndo();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries
      .filter((e) => !isPending(`vault:${e.id}`))
      .filter((e) => (category === 'all' ? true : e.category === category))
      .filter((e) => !q || e.label.toLowerCase().includes(q))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [entries, category, query, isPending]);

  const selected = useMemo(() => entries.find((e) => e.id === selectedId) ?? null, [entries, selectedId]);
  const hasDetail = Boolean(editing || selected);
  const closeDetail = () => {
    setSelectedId(null);
    setEditing(null);
  };

  const save = (state: EditState) => {
    saveEntry(state.draft, state.id);
    setSelectedId(state.id ?? null);
    setEditing(null);
  };

  const remove = (entry: VaultEntry) => {
    setSelectedId(null);
    setEditing(null);
    scheduleDelete({
      key: `vault:${entry.id}`,
      label: `Entrée « ${entry.label} »`,
      commit: () => deleteEntry(entry.id),
    });
  };

  return (
    <section className={`flex flex-col gap-4 ${entries.length === 0 ? '' : 'screen-h'}`}>
      <ScreenHeader
        eyebrow="Poste de travail · Coffre-fort"
        title="Coffre-fort"
        description="Chiffré sur cette machine, et sur elle seule — le serveur n’en voit rien."
        stats={[
          {
            label: 'Entrées',
            value: loading ? '…' : entries.length,
            title: 'Le contenu ne quitte jamais ce poste : il n’y a rien à synchroniser.',
          },
        ]}
        actions={
        <div className="flex flex-shrink-0 items-center gap-2">
          {/*
            LA SORTIE DE SECOURS.

            Ce coffre ne peut pas être sauvegardé par le serveur (sa clé de
            chiffrement n'existe que sur cette machine). Sans un moyen d'en
            sortir le contenu, la limite devient un piège : on y met ses accès
            pendant des mois, et une réinstallation les efface.

            Le fichier produit est EN CLAIR, et le bouton le dit : un export
            chiffré qu'on ne saurait pas relire n'est pas une sauvegarde. À
            ranger dans un endroit sûr — c'est un choix conscient, pas un
            détail qu'on découvre après.
          */}
          {entries.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const contenu = JSON.stringify(
                  {
                    exporteLe: new Date().toISOString(),
                    avertissement:
                      'Ce fichier contient vos mots de passe EN CLAIR. Rangez-le dans un endroit sûr, ou supprimez-le après usage.',
                    entrees: entries,
                  },
                  null,
                  2,
                );
                downloadBlob(
                  new Blob([contenu], { type: 'application/json' }),
                  `coffre-fort-${new Date().toISOString().slice(0, 10)}.json`,
                );
              }}
              title="Enregistrer une copie de secours — le fichier contient vos mots de passe en clair"
              className="flex items-center gap-2 border border-border px-3 py-2.5 text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
            >
              <Download size={15} strokeWidth={1.75} />
              <span className="hidden sm:inline">Copie de secours</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEditing({ draft: emptyDraft() });
              setSelectedId(null);
            }}
            className="flex items-center gap-2 bg-accent px-3 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            <Plus size={16} strokeWidth={2.25} />
            <span className="hidden sm:inline">Nouvelle entrée</span>
          </button>
        </div>
        }
      />

      {/*
        CE BANDEAU DISAIT UNE PROPRIÉTÉ, PAS SA CONSÉQUENCE.

        « Jamais synchronisé, jamais transmis sur le réseau » se lit comme une
        bonne nouvelle — et c'en est une, pour la confidentialité. Mais quelqu'un
        qui n'est pas technicien en tire l'inverse de ce qu'il faudrait en tirer :
        il comprend « c'est bien protégé », pas « si je perds cet ordinateur, tout
        est perdu », ni « mon téléphone montrera un coffre vide », ni « ceci
        n'est pas dans l'export de mes données ».

        Le bandeau énonce donc maintenant les trois conséquences, et l'écran
        offre une copie de secours juste à côté. Une limite qu'on ne peut pas
        lever dans l'immédiat doit au moins être dite dans les termes de qui la
        subit.
      */}
      {!loading &&
        (encrypted ? (
          <div className="flex items-start gap-2 border border-border bg-surface px-4 py-2.5 text-xs text-text-secondary">
            <ShieldCheck size={14} className="mt-0.5 flex-shrink-0 text-success" strokeWidth={2} />
            <span>
              <span className="text-text-primary">Ce coffre reste sur cet appareil.</span> Il est
              chiffré par le trousseau du système et ne part jamais sur le réseau — donc personne
              d’autre ne peut le lire, mais il n’est ni synchronisé avec vos autres appareils, ni
              sauvegardé, ni inclus dans l’export de vos données. Faites-en une copie.
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 border border-warning/40 bg-warning-muted px-4 py-2.5 font-mono text-xs text-text-secondary">
            <AlertTriangle size={14} className="mt-px flex-shrink-0 text-warning" strokeWidth={2} />
            {bridge().env.isElectron
              ? 'Ce coffre reste sur cet appareil, et le trousseau du système n’est pas disponible ici : il n’est donc pas chiffré. Lisible par qui a accès à cette session, ni synchronisé, ni sauvegardé, ni inclus dans l’export de vos données.'
              : 'Ce coffre reste dans CE navigateur, sans chiffrement — n’y mettez pas de secret important. Il n’est ni synchronisé avec vos autres appareils, ni sauvegardé, ni inclus dans l’export de vos données.'}
          </div>
        ))}

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[200px] flex-1">
          <Search
            size={15}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par nom…"
            className="input-focus w-full border border-border bg-surface py-2 pl-9 pr-3 font-mono text-sm text-text-primary placeholder:text-text-muted"
          />
        </div>
        <div className="flex max-w-full items-center overflow-x-auto border border-border bg-surface">
          {([{ value: 'all', label: 'Tous' }, ...CATEGORIES] as { value: CategoryFilter; label: string }[]).map(
            (opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setCategory(opt.value)}
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
                  category === opt.value
                    ? 'bg-accent-muted text-text-primary'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {opt.label}
              </button>
            ),
          )}
        </div>
      </div>

      {/* Même règle : pas de colonne de détail sans sujet (BLOC A). */}
      <div
        className={`grid min-h-0 flex-1 gap-4 ${
          entries.length === 0
            ? 'grid-cols-1'
            : 'grid-cols-1 lg:grid-cols-[minmax(0,20rem)_1fr]'
        }`}
      >
        {/* List — full width on mobile until a detail is opened. */}
        <div
          className={`min-h-0 flex-col overflow-y-auto rounded-lg border border-border bg-surface ${
            hasDetail ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {visible.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <KeyRound size={22} strokeWidth={1.5} className="text-text-muted" />
              <p className="text-sm text-text-secondary">
                {entries.length === 0 ? 'Aucune entrée pour l’instant.' : 'Aucune entrée pour ces filtres.'}
              </p>
            </div>
          ) : (
            visible.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setSelectedId(entry.id);
                  setEditing(null);
                }}
                className={`flex flex-col gap-1 border-b border-border px-4 py-3 text-left transition-colors hover:bg-surface-hover ${
                  selectedId === entry.id && !editing ? 'bg-surface-hover' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex-shrink-0 rounded-sm border border-border bg-bg px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-text-muted">
                    {categoryLabel(entry.category)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-text-primary">
                    {entry.label || 'Sans nom'}
                  </span>
                </div>
                {entry.username && (
                  <span className="truncate font-mono text-[11px] text-text-muted">{entry.username}</span>
                )}
              </button>
            ))
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
              <ArrowLeft size={13} strokeWidth={2} />
              Retour à la liste
            </button>
          )}
          {editing ? (
            <VaultEditor
              state={editing}
              onChange={setEditing}
              onSave={() => save(editing)}
              onCancel={() => setEditing(null)}
            />
          ) : selected ? (
            <VaultReader
              entry={selected}
              onEdit={() =>
                setEditing({
                  id: selected.id,
                  draft: {
                    label: selected.label,
                    username: selected.username,
                    password: selected.password,
                    url: selected.url,
                    notes: selected.notes,
                    category: selected.category,
                  },
                })
              }
              onRemove={() => remove(selected)}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <Lock size={26} strokeWidth={1.5} className="text-text-muted" />
              <p className="text-sm font-medium text-text-primary">Sélectionnez une entrée</p>
              <p className="max-w-sm text-sm text-text-secondary">
                Ou créez-en une pour un identifiant, une clé d’API ou un accès serveur.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- Reader -------------------------------- */

function VaultReader({
  entry,
  onEdit,
  onRemove,
}: {
  entry: VaultEntry;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copiedField, setCopiedField] = useState<'username' | 'password' | null>(null);

  const copy = async (field: 'username' | 'password', value: string) => {
    if (!value) return;
    await copyWithAutoClear(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField((f) => (f === field ? null : f)), 1600);
  };

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
        <div className="min-w-0">
          <span className="mb-2 inline-block rounded-sm border border-border bg-bg px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-text-muted">
            {categoryLabel(entry.category)}
          </span>
          <h2 className="truncate text-2xl font-semibold leading-tight text-text-primary">{entry.label}</h2>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="flex min-h-9 items-center gap-1.5 rounded-sm px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
          >
            <Pencil size={13} strokeWidth={1.75} /> Éditer
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Supprimer"
            className="flex h-9 w-9 items-center justify-center rounded text-text-muted hover:text-danger"
          >
            <Trash2 size={15} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {entry.username && (
          <VaultField
            label="Identifiant"
            value={entry.username}
            copied={copiedField === 'username'}
            onCopy={() => copy('username', entry.username)}
          />
        )}

        <div>
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Mot de passe
          </span>
          <div className="flex items-center gap-1.5 border border-border bg-bg px-3 py-2">
            <span className="min-w-0 flex-1 truncate font-mono text-sm text-text-primary">
              {revealed ? entry.password || '—' : entry.password ? '•'.repeat(Math.min(entry.password.length, 20)) : '—'}
            </span>
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? 'Masquer le mot de passe' : 'Révéler le mot de passe'}
              className="flex-shrink-0 text-text-muted transition-colors hover:text-text-primary"
            >
              {revealed ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
            </button>
            <button
              type="button"
              onClick={() => copy('password', entry.password)}
              aria-label="Copier le mot de passe"
              className="flex-shrink-0 text-text-muted transition-colors hover:text-text-primary"
            >
              {copiedField === 'password' ? (
                <Check size={15} strokeWidth={2} className="text-success" />
              ) : (
                <Copy size={15} strokeWidth={1.75} />
              )}
            </button>
          </div>
          <p className="mt-1 font-mono text-[10px] text-text-muted">
            La copie s’efface du presse-papiers après 30 secondes.
          </p>
        </div>

        {entry.url && (
          <div>
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-text-muted">URL</span>
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all text-sm text-text-secondary underline decoration-border underline-offset-4 hover:text-text-primary hover:decoration-text-primary"
            >
              {entry.url}
            </a>
          </div>
        )}

        {entry.notes && (
          <div>
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Notes
            </span>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">{entry.notes}</p>
          </div>
        )}
      </div>
    </>
  );
}

function VaultField({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-widest text-text-muted">{label}</span>
      <div className="flex items-center gap-1.5 border border-border bg-bg px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-sm text-text-primary">{value}</span>
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copier ${label.toLowerCase()}`}
          className="flex-shrink-0 text-text-muted transition-colors hover:text-text-primary"
        >
          {copied ? <Check size={15} strokeWidth={2} className="text-success" /> : <Copy size={15} strokeWidth={1.75} />}
        </button>
      </div>
    </div>
  );
}

/* --------------------------------- Editor -------------------------------- */

function VaultEditor({
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
  const { draft } = state;
  const setDraft = (patch: Partial<VaultDraft>) => onChange({ ...state, draft: { ...draft, ...patch } });
  const [showPassword, setShowPassword] = useState(false);
  const labelRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
          {state.id ? 'Éditer l’entrée' : 'Nouvelle entrée'}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Fermer"
          className="flex h-9 w-9 items-center justify-center text-text-secondary hover:text-text-primary"
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Nom *</span>
          <input
            ref={labelRef}
            autoFocus
            value={draft.label}
            onChange={(e) => setDraft({ label: e.target.value })}
            placeholder="Ex : API Stripe production"
            className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Catégorie</span>
          <select
            value={draft.category}
            onChange={(e) => setDraft({ category: e.target.value as VaultCategory })}
            className="input-focus cursor-pointer border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Identifiant</span>
          <input
            value={draft.username}
            onChange={(e) => setDraft({ username: e.target.value })}
            placeholder="email, nom d’utilisateur…"
            className="input-focus border border-border bg-bg px-3 py-2 font-mono text-sm text-text-primary outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Mot de passe *</span>
          <div className="flex items-center gap-1.5 border border-border bg-bg px-3 py-1">
            <input
              type={showPassword ? 'text' : 'password'}
              value={draft.password}
              onChange={(e) => setDraft({ password: e.target.value })}
              className="input-focus min-w-0 flex-1 bg-transparent py-1.5 font-mono text-sm text-text-primary outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Masquer' : 'Révéler'}
              className="flex-shrink-0 text-text-muted transition-colors hover:text-text-primary"
            >
              {showPassword ? <EyeOff size={15} strokeWidth={1.75} /> : <Eye size={15} strokeWidth={1.75} />}
            </button>
          </div>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">URL</span>
          <input
            value={draft.url}
            onChange={(e) => setDraft({ url: e.target.value })}
            placeholder="https://…"
            className="input-focus border border-border bg-bg px-3 py-2 font-mono text-sm text-text-primary outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Notes</span>
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft({ notes: e.target.value })}
            rows={4}
            placeholder="Contexte, restrictions, contact…"
            className="input-focus resize-none border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
          />
        </label>
      </div>

      <div className="flex items-center gap-2 border-t border-border p-3">
        <button
          type="button"
          onClick={onSave}
          disabled={!draft.label.trim() || !draft.password.trim()}
          className="bg-accent px-4 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          Enregistrer
        </button>
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
