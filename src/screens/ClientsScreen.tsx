import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ImagePlus, Mail, Phone, Plus, X } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import type {
  Client,
  ClientStatus,
  CreateClientInput,
  UpdateClientInput,
} from '../shared/api';

const STATUS_META: Record<
  ClientStatus,
  { label: string; dot: string; text: string }
> = {
  active: { label: 'ACTIF', dot: 'bg-success', text: 'text-text-primary' },
  paused: {
    label: 'EN PAUSE',
    dot: 'border border-text-muted bg-transparent',
    text: 'text-text-secondary',
  },
  prospect: { label: 'PROSPECT', dot: 'bg-text-muted', text: 'text-text-secondary' },
};

const STATUS_ORDER: ClientStatus[] = ['active', 'paused', 'prospect'];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function ClientsScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let active = true;
    bridge()
      .clients.list()
      .then((list) => {
        if (!active) return;
        setClients(list);
        setSelectedId((prev) => prev ?? list[0]?.id ?? null);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const selected = useMemo(
    () => clients.find((c) => c.id === selectedId) ?? null,
    [clients, selectedId],
  );

  const replaceClient = (updated: Client) =>
    setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));

  const patch = async (id: number, p: UpdateClientInput) => {
    const updated = await bridge().clients.update(id, p);
    replaceClient(updated);
  };

  const addEvent = async (id: number, title: string, detail: string) => {
    const updated = await bridge().clients.addEvent({ clientId: id, title, detail });
    replaceClient(updated);
  };

  const createClient = async (input: CreateClientInput) => {
    const created = await bridge().clients.create(input);
    setClients((prev) =>
      [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    );
    setSelectedId(created.id);
    setAdding(false);
  };

  return (
    <section className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">
            Clients
          </h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-text-muted">
            {clients.length} fiches · relation & missions
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 bg-accent px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
        >
          <Plus size={16} strokeWidth={2.25} />
          Nouveau client
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-[300px_1fr]">
        <ClientList
          clients={clients}
          loading={loading}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
        {selected ? (
          <ClientDetail
            key={selected.id}
            client={selected}
            onPatch={patch}
            onAddEvent={addEvent}
          />
        ) : (
          <div className="flex items-center justify-center border border-border bg-surface font-mono text-xs uppercase tracking-widest text-text-muted">
            {loading ? 'Chargement…' : 'Aucun client'}
          </div>
        )}
      </div>

      {adding && (
        <NewClientModal onClose={() => setAdding(false)} onCreate={createClient} />
      )}
    </section>
  );
}

function ClientList({
  clients,
  loading,
  selectedId,
  onSelect,
}: {
  clients: Client[];
  loading: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="flex min-h-0 flex-col border border-border bg-surface">
      <div className="border-b border-border px-4 py-3 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
        Répertoire
      </div>
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="flex-1 divide-y divide-border/60 overflow-y-auto"
      >
        {loading ? (
          <p className="px-4 py-6 font-mono text-xs text-text-muted">Chargement…</p>
        ) : (
          clients.map((client) => {
            const meta = STATUS_META[client.status];
            const active = client.id === selectedId;
            return (
              <motion.button
                key={client.id}
                variants={staggerItem}
                type="button"
                onClick={() => onSelect(client.id)}
                className={`relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 ${
                  active ? 'bg-surface-hover' : 'hover:bg-surface-hover'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-0 h-full w-0.5 bg-accent" />
                )}
                <Avatar client={client} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {client.name}
                  </p>
                  <p className="truncate font-mono text-[11px] text-text-muted">
                    {client.company || '—'}
                  </p>
                </div>
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
              </motion.button>
            );
          })
        )}
      </motion.div>
    </div>
  );
}

function Avatar({ client, size }: { client: Client; size: number }) {
  if (client.imageDataUrl) {
    return (
      <img
        src={client.imageDataUrl}
        alt={client.name}
        style={{ width: size, height: size }}
        className="flex-shrink-0 rounded-sm object-cover"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size }}
      className="flex flex-shrink-0 items-center justify-center rounded-sm border border-border bg-bg font-mono text-xs font-semibold text-text-secondary"
    >
      {initials(client.name)}
    </span>
  );
}

function ClientDetail({
  client,
  onPatch,
  onAddEvent,
}: {
  client: Client;
  onPatch: (id: number, p: UpdateClientInput) => Promise<void>;
  onAddEvent: (id: number, title: string, detail: string) => Promise<void>;
}) {
  return (
    <div className="min-h-0 overflow-y-auto border border-border bg-surface">
      <ClientHeader client={client} onPatch={onPatch} />
      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <ContactBlock client={client} onPatch={onPatch} />
          <NotesBlock client={client} onPatch={onPatch} />
        </div>
        <TimelineBlock client={client} onAddEvent={onAddEvent} />
      </div>
    </div>
  );
}

function ClientHeader({
  client,
  onPatch,
}: {
  client: Client;
  onPatch: (id: number, p: UpdateClientInput) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      onPatch(client.id, { imageDataUrl: String(reader.result) });
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col gap-4 border-b border-border p-6 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="group relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-sm border border-border-strong bg-bg"
        title="Changer l’image"
      >
        {client.imageDataUrl ? (
          <img
            src={client.imageDataUrl}
            alt={client.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-mono text-xl font-semibold text-text-secondary">
            {initials(client.name)}
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
          <ImagePlus size={18} strokeWidth={1.75} className="text-white" />
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      <div className="min-w-0 flex-1">
        <InlineField
          value={client.name}
          onSave={(v) => onPatch(client.id, { name: v })}
          className="text-xl font-bold text-text-primary"
          placeholder="Nom du client"
        />
        <InlineField
          value={client.company}
          onSave={(v) => onPatch(client.id, { company: v })}
          className="font-mono text-sm text-text-secondary"
          placeholder="Société"
        />
      </div>

      <StatusSelector
        value={client.status}
        onChange={(status) => onPatch(client.id, { status })}
      />
    </div>
  );
}

function StatusSelector({
  value,
  onChange,
}: {
  value: ClientStatus;
  onChange: (s: ClientStatus) => void;
}) {
  return (
    <div className="flex flex-shrink-0 border border-border">
      {STATUS_ORDER.map((status) => {
        const meta = STATUS_META[status];
        const active = status === value;
        return (
          <button
            key={status}
            type="button"
            onClick={() => onChange(status)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              active
                ? 'bg-accent-muted text-text-primary'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

function ContactBlock({
  client,
  onPatch,
}: {
  client: Client;
  onPatch: (id: number, p: UpdateClientInput) => Promise<void>;
}) {
  return (
    <div>
      <BlockTitle>Contact</BlockTitle>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2.5 border border-border bg-bg px-3 py-2">
          <Mail size={14} strokeWidth={1.75} className="flex-shrink-0 text-text-muted" />
          <InlineField
            value={client.email}
            onSave={(v) => onPatch(client.id, { email: v })}
            className="w-full font-mono text-sm text-text-primary"
            placeholder="email@exemple.com"
          />
        </div>
        <div className="flex items-center gap-2.5 border border-border bg-bg px-3 py-2">
          <Phone size={14} strokeWidth={1.75} className="flex-shrink-0 text-text-muted" />
          <InlineField
            value={client.phone}
            onSave={(v) => onPatch(client.id, { phone: v })}
            className="w-full font-mono text-sm text-text-primary"
            placeholder="+33 …"
          />
        </div>
      </div>
    </div>
  );
}

function NotesBlock({
  client,
  onPatch,
}: {
  client: Client;
  onPatch: (id: number, p: UpdateClientInput) => Promise<void>;
}) {
  const [notes, setNotes] = useState(client.notes);
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNotes(client.notes);
    setSaved(true);
  }, [client.id, client.notes]);

  const onChange = (value: string) => {
    setNotes(value);
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onPatch(client.id, { notes: value }).then(() => setSaved(true));
    }, 600);
  };

  return (
    <div className="flex flex-1 flex-col">
      <BlockTitle
        aside={
          <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
            {saved ? 'Enregistré' : '…'}
          </span>
        }
      >
        Notes
      </BlockTitle>
      <textarea
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Notes libres sur le client…"
        className="input-focus min-h-[120px] flex-1 resize-none border border-border bg-bg p-3 text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
      />
    </div>
  );
}

function TimelineBlock({
  client,
  onAddEvent,
}: {
  client: Client;
  onAddEvent: (id: number, title: string, detail: string) => Promise<void>;
}) {
  const [title, setTitle] = useState('');

  const submit = () => {
    const t = title.trim();
    if (!t) return;
    onAddEvent(client.id, t, '');
    setTitle('');
  };

  return (
    <div className="flex flex-col">
      <BlockTitle>Historique</BlockTitle>
      <div className="mb-3 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Ajouter un échange / une mission…"
          className="input-focus flex-1 border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-muted"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!title.trim()}
          className="flex items-center justify-center border border-border-strong bg-surface px-3 text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-40"
        >
          <Plus size={16} strokeWidth={2} />
        </button>
      </div>

      <ol className="relative">
        {client.events.length === 0 && (
          <li className="font-mono text-xs text-text-muted">Aucun échange.</li>
        )}
        {client.events.map((event, i) => (
          <li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i !== client.events.length - 1 && (
              <span className="absolute left-[3px] top-3 bottom-0 w-px bg-border" />
            )}
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-text-secondary" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-medium text-text-primary">
                  {event.title}
                </p>
                <time className="flex-shrink-0 font-mono text-[10px] uppercase tracking-wide text-text-muted">
                  {relativeTime(event.date).replace('il y a ', '')}
                </time>
              </div>
              {event.detail && (
                <p className="text-xs text-text-secondary">{event.detail}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function BlockTitle({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <h3 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
        {children}
      </h3>
      {aside}
    </div>
  );
}

/** Text that turns into an input on click and saves on blur/Enter. */
function InlineField({
  value,
  onSave,
  className,
  placeholder,
}: {
  value: string;
  onSave: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft !== value) onSave(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
        placeholder={placeholder}
        className={`w-full border-b border-border-strong bg-transparent outline-none ${className ?? ''}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`block w-full truncate border-b border-transparent text-left hover:border-border ${className ?? ''} ${
        value ? '' : 'text-text-muted'
      }`}
    >
      {value || placeholder}
    </button>
  );
}

function NewClientModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: CreateClientInput) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [status, setStatus] = useState<ClientStatus>('prospect');

  const submit = () => {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), company: company.trim(), status });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        className="relative w-full max-w-md border border-border-strong bg-surface"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            Nouveau client
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-text-secondary hover:text-text-primary"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="flex flex-col gap-3 p-5">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Nom *
            </span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Société
            </span>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Statut
            </span>
            <StatusSelector value={status} onChange={setStatus} />
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim()}
            className="mt-1 bg-accent px-3 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            Créer la fiche
          </button>
        </div>
      </motion.div>
    </div>
  );
}
