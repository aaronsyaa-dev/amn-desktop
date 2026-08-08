import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
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
import type { VaultCategory, VaultEntry } from '../shared/api';

const CATEGORIES: { value: VaultCategory; label: string }[] = [
  { value: 'api', label: 'API Keys' },
  { value: 'accounts', label: 'Comptes' },
  { value: 'servers', label: 'Serveurs' },
  { value: 'other', label: 'Autres' },
];

function categoryLabel(c: VaultCategory): string {
  return CATEGORIES.find((x) => x.value === c)?.label ?? 'Autres';
}

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
    <section className="flex h-[calc(100dvh-8rem)] flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            <Lock size={22} strokeWidth={2} />
            Coffre-fort
          </h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-text-muted">
            {loading ? 'Chargement…' : `${entries.length} entrée${entries.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing({ draft: emptyDraft() });
            setSelectedId(null);
          }}
          className="flex flex-shrink-0 items-center gap-2 bg-accent px-3 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
        >
          <Plus size={16} strokeWidth={2.25} />
          <span className="hidden sm:inline">Nouvelle entrée</span>
        </button>
      </div>

      {/* Storage/security banner — always visible, never a one-time toast, since
          it changes what the operator should and shouldn't store here. */}
      {!loading &&
        (encrypted ? (
          <div className="flex items-center gap-2 border border-border bg-surface px-4 py-2.5 font-mono text-xs text-text-secondary">
            <ShieldCheck size={14} className="flex-shrink-0 text-success" strokeWidth={2} />
            Chiffré localement (AES-256, trousseau du système) — jamais synchronisé, jamais transmis sur le réseau.
          </div>
        ) : (
          <div className="flex items-start gap-2 border border-warning/40 bg-warning-muted px-4 py-2.5 font-mono text-xs text-text-secondary">
            <AlertTriangle size={14} className="mt-px flex-shrink-0 text-warning" strokeWidth={2} />
            Stockage local non chiffré (navigateur) — ne stockez pas de secrets critiques ici. Toujours local, jamais
            synchronisé, mais lisible par qui a accès à ce navigateur.
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
                className={`flex-shrink-0 whitespace-nowrap px-3 py-2 font-mono text-[11px] uppercase tracking-wider transition-colors duration-150 ${
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

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,20rem)_1fr]">
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
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs text-text-secondary hover:text-text-primary"
          >
            <Pencil size={13} strokeWidth={1.75} /> Éditer
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Supprimer"
            className="flex h-7 w-7 items-center justify-center rounded text-text-muted hover:text-danger"
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
          className="text-text-secondary hover:text-text-primary"
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
