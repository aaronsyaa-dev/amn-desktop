import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Link2,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useRemoteSites, type DerivedSite } from '../state/RemoteSitesContext';
import { useUndo } from '../state/UndoContext';
import { useToast } from '../state/ToastContext';
import { useSitePins } from '../lib/useSitePins';
import { useTrackers } from '../state/useTrackers';
import { useSiteRegistry, safeSiteHref, type SiteNote } from '../state/useSiteRegistry';
import { useProfiles } from '../state/ProfilesContext';
import { bridge } from '../lib/bridge';
import { ScanDetail } from '../components/scanner/ScanDetail';
import { scoreColor } from '../lib/scanSeverity';
import { relativeTime } from '../lib/time';
import { staggerContainer, staggerItem } from '../lib/transitions';
import { useSitePanel } from '../components/site-panel/SitePanelContext';
import type { RegisterSiteResult, Scan } from '../shared/api';

/** Readable message from a thrown error, for a toast. */
function describeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 160) || 'Erreur inconnue.';
}

type SortKey = 'alpha' | 'score' | 'recent';

const SORT_LABELS: Record<SortKey, string> = {
  alpha: 'Alphabétique',
  score: 'Score scanner',
  recent: 'Ajout récent',
};

/**
 * Registre des sites — the catalogue of client sites: their URL, their internal
 * discussion thread, and their latest scanner score.
 *
 * Deliberately *not* a supervision screen: live status, visitors, alert counts
 * and heartbeats all live in the Tracker tab (comparateur + bureau de contrôle)
 * so the same information isn't maintained and read in two places.
 */
export function SitesDashboardScreen() {
  const { sites, loading, connectionStatus } = useRemoteSites();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('alpha');
  const [registering, setRegistering] = useState(false);

  const { isPending } = useUndo();
  const { isPinned, togglePin } = useSitePins();
  const { urlBySite } = useSiteRegistry();

  // Latest finished scan per hostname, so a site can show the score of the scan
  // that was run against its URL (scans are keyed by URL, not by site id).
  const [scanByHost, setScanByHost] = useState<Record<string, Scan>>({});
  const refreshScans = useCallback(async () => {
    try {
      const all = await bridge().remote.listScans();
      const map: Record<string, Scan> = {};
      for (const s of all) {
        if (s.status !== 'done') continue;
        const host = hostOf(s.url);
        if (!host) continue;
        // listScans is newest-first, so the first hit per host is the latest.
        if (!map[host]) map[host] = s;
      }
      setScanByHost(map);
    } catch {
      /* offline or not configured — the badge just won't show */
    }
  }, []);

  useEffect(() => {
    void refreshScans();
    return bridge().remote.onScanProgress((p) => {
      if (p.status === 'done') void refreshScans();
    });
  }, [refreshScans]);

  const scanForSite = useCallback(
    (siteId: string): Scan | null => {
      const host = hostOf(urlBySite[siteId] ?? '');
      return host ? scanByHost[host] ?? null : null;
    },
    [urlBySite, scanByHost],
  );

  const filteredSites = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = sites.filter((site) => {
      if (isPending(`site:${site.id}`)) return false; // hidden during undo window
      if (!q) return true;
      return (
        site.name.toLowerCase().includes(q) || (urlBySite[site.id] ?? '').toLowerCase().includes(q)
      );
    });
    const byKey = (a: DerivedSite, b: DerivedSite) => {
      switch (sort) {
        case 'score': {
          // Sites with a score first, worst first — that's the actionable order.
          const sa = scanForSite(a.id)?.score;
          const sb = scanForSite(b.id)?.score;
          if (sa == null && sb == null) return a.name.localeCompare(b.name, 'fr');
          if (sa == null) return 1;
          if (sb == null) return -1;
          return sa - sb;
        }
        case 'recent':
          return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
        case 'alpha':
        default:
          return a.name.localeCompare(b.name, 'fr');
      }
    };
    // Pinned sites always rise to the top, then the chosen sort applies within
    // each group — a personal fast lane for the client sites you're watching.
    return [...filtered].sort(
      (a, b) => Number(isPinned(b.id)) - Number(isPinned(a.id)) || byKey(a, b),
    );
  }, [sites, query, sort, isPending, isPinned, urlBySite, scanForSite]);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            Registre des sites
          </h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-text-muted">
            {loading
              ? 'Chargement…'
              : `${sites.length} site${sites.length > 1 ? 's' : ''} enregistré${sites.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRegistering(true)}
          className="flex flex-shrink-0 items-center gap-2 bg-accent px-3 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
        >
          <Plus size={16} strokeWidth={2.25} />
          <span className="hidden sm:inline">Nouveau site</span>
        </button>
      </div>

      <ConnectionBanner status={connectionStatus} />

      {sites.length > 0 && (
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
              placeholder="Filtrer par nom ou URL…"
              className="input-focus w-full border border-border bg-surface py-2 pl-9 pr-3 font-mono text-sm text-text-primary placeholder:text-text-muted"
            />
          </div>

          <div className="relative flex items-center">
            <SlidersHorizontal
              size={14}
              strokeWidth={1.75}
              className="pointer-events-none absolute left-3 text-text-muted"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="input-focus cursor-pointer appearance-none border border-border bg-surface py-2 pl-9 pr-8 font-mono text-[11px] uppercase tracking-wider text-text-secondary"
              aria-label="Trier"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <option key={key} value={key}>
                  {SORT_LABELS[key]}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              strokeWidth={1.75}
              className="pointer-events-none absolute right-3 text-text-muted"
            />
          </div>
        </div>
      )}

      {sites.length === 0 && !loading ? (
        <EmptyRegistry onRegister={() => setRegistering(true)} />
      ) : (
        <div className="border border-border bg-surface">
          {filteredSites.length > 0 ? (
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="divide-y divide-border/60"
            >
              {filteredSites.map((site) => (
                <motion.div key={site.id} variants={staggerItem}>
                  <SiteRow
                    site={site}
                    scan={scanForSite(site.id)}
                    pinned={isPinned(site.id)}
                    onTogglePin={() => togglePin(site.id)}
                  />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="px-5 py-16 text-center font-mono text-xs uppercase tracking-widest text-text-muted">
              Aucun site ne correspond au filtre
            </div>
          )}
        </div>
      )}

      {registering && <RegisterSiteModal onClose={() => setRegistering(false)} />}
    </section>
  );
}

/** Hostname of a URL string, or null when it isn't parseable. */
function hostOf(raw: string): string | null {
  const href = safeSiteHref(raw);
  if (!href) return null;
  try {
    return new URL(href).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function ConnectionBanner({
  status,
}: {
  status: ReturnType<typeof useRemoteSites>['connectionStatus'];
}) {
  if (status === 'online') return null;

  const copy: Record<Exclude<typeof status, 'online'>, string> = {
    connecting: 'Connexion à amn-api en cours…',
    offline:
      'amn-api est injoignable — les données affichées peuvent être obsolètes. Reconnexion automatique en cours.',
    unconfigured:
      "amn-api n'est pas configuré (AMN_API_URL / AMN_API_OPERATOR_TOKEN manquants dans .env).",
  };

  return (
    <div className="flex items-center gap-2 border border-border bg-surface px-4 py-2.5 font-mono text-xs text-text-secondary">
      <span
        className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
          status === 'connecting' ? 'animate-pulse bg-text-muted' : 'bg-danger'
        }`}
      />
      {copy[status]}
    </div>
  );
}

function EmptyRegistry({ onRegister }: { onRegister: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 border border-dashed border-border px-6 py-16 text-center">
      <p className="text-sm font-medium text-text-primary">
        Aucun site enregistré pour l’instant
      </p>
      <p className="max-w-sm text-sm text-text-secondary">
        Enregistrez votre premier site pour obtenir sa clé API, puis installez
        le tracker (onglet « Trackers ») pour commencer à recevoir des
        données réelles.
      </p>
      <button
        type="button"
        onClick={onRegister}
        className="mt-2 flex items-center gap-2 bg-accent px-3 py-2 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
      >
        <Plus size={15} strokeWidth={2.25} />
        Enregistrer un site
      </button>
    </div>
  );
}

type Panel = 'none' | 'discussion' | 'scan';

function SiteRow({
  site,
  scan,
  pinned,
  onTogglePin,
}: {
  site: DerivedSite;
  scan: Scan | null;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  const { openSite } = useSitePanel();
  const { updateSite, deleteSite } = useRemoteSites();
  const { scheduleDelete } = useUndo();
  const { notify } = useToast();
  const { setModules } = useTrackers();
  const { urlBySite, notesBySite, setSiteUrl, forgetSite } = useSiteRegistry();

  const [panel, setPanel] = useState<Panel>('none');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(site.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const url = urlBySite[site.id] ?? '';
  const href = safeSiteHref(url);
  const noteCount = notesBySite[site.id]?.length ?? 0;

  const startEdit = () => {
    setDraft(site.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };
  const commitEdit = () => {
    const name = draft.trim();
    setEditing(false);
    if (name && name !== site.name) {
      updateSite(site.id, name).catch((err) =>
        notify({ title: 'Renommage impossible', body: describeError(err), durationMs: 8000 }),
      );
    }
  };

  const remove = () => {
    scheduleDelete({
      key: `site:${site.id}`,
      label: `Site « ${site.name} »`,
      commit: () => {
        // Surface a failure instead of silently reverting (the site would just
        // reappear with no feedback — reads as "the button does nothing").
        deleteSite(site.id).catch((err) =>
          notify({ title: 'Suppression impossible', body: describeError(err), durationMs: 8000 }),
        );
        setModules(site.id, []); // cascade: drop this site's tracker config
        forgetSite(site.id); // …and its URL + discussion thread
      },
    });
  };

  const toggle = (next: Panel) => setPanel((p) => (p === next ? 'none' : next));

  return (
    <div className="group relative">
      <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-surface-hover sm:px-5 md:grid-cols-[1.4fr_1fr_auto_auto]">
        <span className="absolute left-0 top-0 h-full w-0.5 scale-y-0 bg-accent transition-transform duration-150 group-hover:scale-y-100" />

        {/* Name */}
        <div className="min-w-0">
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') setEditing(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="input-focus w-full max-w-xs border border-border bg-bg px-2 py-1 text-sm text-text-primary outline-none"
            />
          ) : (
            <button type="button" onClick={() => openSite(site.id)} className="block max-w-full text-left">
              <p className="flex items-center gap-1.5 truncate text-sm font-medium text-text-primary">
                {pinned && (
                  <Star size={12} strokeWidth={2} className="flex-shrink-0 fill-accent text-accent" />
                )}
                <span className="truncate">{site.name}</span>
              </p>
              <p className="truncate font-mono text-[11px] text-text-muted">#{site.id.slice(0, 8)}</p>
            </button>
          )}
        </div>

        {/* URL — clickable, opens in the OS browser */}
        <div className="col-span-2 min-w-0 md:col-span-1">
          <SiteUrlField siteId={site.id} url={url} href={href} onSave={setSiteUrl} />
        </div>

        {/* Scanner score + discussion */}
        <div className="flex items-center gap-1.5 justify-self-end">
          {scan ? (
            <button
              type="button"
              onClick={() => toggle('scan')}
              title={`Dernier scan ${scan.tier} — voir le détail`}
              className={`flex-shrink-0 border px-1.5 py-1 font-mono text-xs font-semibold transition-colors ${
                panel === 'scan' ? 'border-border-strong bg-surface-hover' : 'border-border'
              } ${scoreColor(scan.score)}`}
            >
              {scan.score}
              <span className="text-[9px] text-text-muted">/100</span>
            </button>
          ) : (
            <span
              title="Aucun scan pour cette URL"
              className="hidden flex-shrink-0 border border-dashed border-border px-1.5 py-1 font-mono text-[10px] text-text-muted sm:inline"
            >
              —
            </span>
          )}

          <button
            type="button"
            onClick={() => toggle('discussion')}
            aria-label="Discussion interne du site"
            title="Discussion"
            className={`flex h-7 items-center gap-1 rounded px-1.5 text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary ${
              panel === 'discussion' ? 'bg-white/5 text-text-primary' : ''
            }`}
          >
            <MessageSquare size={14} strokeWidth={1.75} />
            {noteCount > 0 && <span className="font-mono text-[10px]">{noteCount}</span>}
          </button>
        </div>

        {/* Row actions */}
        <div
          className={`col-span-2 flex items-center gap-1 justify-self-end transition-opacity focus-within:opacity-100 group-hover:opacity-100 md:col-span-1 ${
            pinned ? 'opacity-100' : 'opacity-100 md:opacity-0'
          }`}
        >
          <button
            type="button"
            onClick={onTogglePin}
            aria-label={pinned ? 'Retirer des favoris' : 'Épingler en favori'}
            aria-pressed={pinned}
            title={pinned ? 'Retirer des favoris' : 'Épingler'}
            className={`flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-white/5 ${
              pinned ? 'text-accent' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Star size={14} strokeWidth={1.75} className={pinned ? 'fill-accent' : ''} />
          </button>
          <button
            type="button"
            onClick={startEdit}
            aria-label="Renommer le site"
            title="Renommer"
            className="flex h-7 w-7 items-center justify-center rounded text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
          >
            <Pencil size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={remove}
            aria-label="Supprimer le site"
            title="Supprimer"
            className="flex h-7 w-7 items-center justify-center rounded text-text-muted transition-colors hover:bg-danger-muted hover:text-danger"
          >
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {panel === 'discussion' && <SiteDiscussion siteId={site.id} />}
      {panel === 'scan' && scan && (
        <div className="border-t border-border bg-bg/40 p-3 sm:p-4">
          <ScanDetail scan={scan} />
        </div>
      )}
    </div>
  );
}

/** The site's public URL: a link once set, an inline editor while editing. */
function SiteUrlField({
  siteId,
  url,
  href,
  onSave,
}: {
  siteId: string;
  url: string;
  href: string | null;
  onSave: (siteId: string, url: string) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(url);
  const ref = useRef<HTMLInputElement>(null);

  const start = () => {
    setDraft(url);
    setEditing(true);
    setTimeout(() => ref.current?.select(), 0);
  };
  const commit = () => {
    setEditing(false);
    if (draft.trim() !== url) void onSave(siteId, draft);
  };

  if (editing) {
    return (
      <input
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        placeholder="https://exemple.com"
        className="input-focus w-full border border-border bg-bg px-2 py-1 font-mono text-xs text-text-primary outline-none"
      />
    );
  }

  if (!href) {
    return (
      <button
        type="button"
        onClick={start}
        className="flex items-center gap-1.5 font-mono text-[11px] text-text-muted transition-colors hover:text-text-primary"
      >
        <Link2 size={12} strokeWidth={1.75} />
        Ajouter une URL
      </button>
    );
  }

  return (
    <span className="flex min-w-0 items-center gap-1">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title={href}
        className="flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-text-secondary transition-colors hover:text-text-primary hover:underline"
      >
        <ExternalLink size={11} strokeWidth={1.75} className="flex-shrink-0" />
        <span className="truncate">{href.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
      </a>
      <button
        type="button"
        onClick={start}
        aria-label="Modifier l’URL"
        title="Modifier l’URL"
        className="flex-shrink-0 text-text-muted opacity-0 transition-opacity hover:text-text-primary group-hover:opacity-100"
      >
        <Pencil size={11} strokeWidth={1.75} />
      </button>
    </span>
  );
}

/** Internal notes thread attached to one site, synced between both operators. */
function SiteDiscussion({ siteId }: { siteId: string }) {
  const { notesBySite, addNote, deleteNote } = useSiteRegistry();
  const { profileFor } = useProfiles();
  const [text, setText] = useState('');
  const notes = notesBySite[siteId] ?? [];

  const send = () => {
    if (!text.trim()) return;
    addNote(siteId, text);
    setText('');
  };

  return (
    <div className="border-t border-border bg-bg/40 px-4 py-3 sm:px-5">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-text-muted">
        Discussion interne · {notes.length} note{notes.length > 1 ? 's' : ''}
      </p>

      {notes.length > 0 && (
        <ul className="mb-3 flex max-h-64 flex-col gap-2 overflow-y-auto">
          {notes.map((n) => (
            <NoteRow key={n.id} note={n} author={profileFor(n.authorEmail).name} onDelete={() => deleteNote(n.id)} />
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
          placeholder="Ajouter une note sur ce site…"
          className="input-focus min-w-0 flex-1 border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
        />
        <button
          type="button"
          onClick={send}
          disabled={!text.trim()}
          className="border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary transition-colors hover:bg-surface-hover disabled:opacity-40"
        >
          Ajouter
        </button>
      </div>
    </div>
  );
}

function NoteRow({ note, author, onDelete }: { note: SiteNote; author: string; onDelete: () => void }) {
  return (
    <li className="group/n flex items-start gap-2 border border-border bg-surface px-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="block whitespace-pre-wrap break-words text-sm text-text-primary">{note.body}</span>
        <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-wider text-text-muted">
          {author} · {relativeTime(note.createdAt)}
        </span>
      </span>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Supprimer la note"
        className="flex-shrink-0 text-text-muted opacity-0 transition-opacity hover:text-danger group-hover/n:opacity-100"
      >
        <X size={13} strokeWidth={2} />
      </button>
    </li>
  );
}

function RegisterSiteModal({ onClose }: { onClose: () => void }) {
  const { registerSite } = useRemoteSites();
  const { setSiteUrl } = useSiteRegistry();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RegisterSiteResult | null>(null);

  const submit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await registerSite(name.trim());
      // Awaited: the URL is what SSL Monitor and the availability probe key
      // off, so a site must not be announced as created before it lands.
      if (url.trim()) await setSiteUrl(created.id, url);
      setResult(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec de l’enregistrement.');
    } finally {
      setSubmitting(false);
    }
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
            {result ? 'Site enregistré' : 'Nouveau site'}
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

        {result ? (
          <RegisteredSiteResult result={result} onClose={onClose} />
        ) : (
          <div className="flex flex-col gap-3 p-5">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                Nom du site *
              </span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="Ex : Boutique Mohamed"
                className="input-focus border border-border bg-bg px-3 py-2 text-sm text-text-primary outline-none"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                URL du site
              </span>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="https://exemple.com"
                className="input-focus border border-border bg-bg px-3 py-2 font-mono text-sm text-text-primary outline-none"
              />
            </label>
            {error && (
              <p className="border border-danger/40 bg-danger-muted px-3 py-2 font-mono text-xs text-danger">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={!name.trim() || submitting}
              className="mt-1 bg-accent px-3 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
            >
              {submitting ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function RegisteredSiteResult({
  result,
  onClose,
}: {
  result: RegisterSiteResult;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable — the key remains selectable manually.
    }
  };

  return (
    <div className="flex flex-col gap-3 p-5">
      <p className="text-sm text-text-secondary">
        <strong className="text-text-primary">{result.name}</strong> est
        enregistré. Copiez la clé API ci-dessous — elle ne sera plus jamais
        affichée.
      </p>
      <div className="relative border border-border-strong bg-bg p-3">
        <p className="break-all pr-16 font-mono text-xs text-text-primary">{result.apiKey}</p>
        <button
          type="button"
          onClick={copy}
          className="absolute right-2 top-2 flex items-center gap-1.5 border border-border-strong bg-surface px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary transition-colors hover:bg-surface-hover"
        >
          {copied ? (
            <>
              <Check size={11} strokeWidth={2.5} />
              Copié
            </>
          ) : (
            <>
              <Copy size={11} strokeWidth={2} />
              Copier
            </>
          )}
        </button>
      </div>
      <p className="font-mono text-[11px] text-text-muted">
        AMN_API_KEY à coller dans le .env du site cible — voir l’onglet
        Trackers pour le reste de l’installation.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-1 border border-border-strong bg-surface px-3 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-hover"
      >
        Terminé
      </button>
    </div>
  );
}
