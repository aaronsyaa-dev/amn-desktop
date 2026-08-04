import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  CheckSquare,
  Contact,
  CornerDownLeft,
  GraduationCap,
  Globe,
  LayoutDashboard,
  NotebookPen,
  Radar,
  Scale,
  Search,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react';
import { useRemoteSites } from '../../state/RemoteSitesContext';
import { useCollection } from '../../state/SyncContext';
import { useNotes } from '../../state/useNotes';
import { useSitePanel } from '../site-panel/SitePanelContext';
import { useAssistant } from '../../assistant/AssistantContext';
import { StatusBadge } from '../StatusBadge';

interface CommandPaletteContextValue {
  open: () => void;
  close: () => void;
}

const CommandPaletteContext = createContext<
  CommandPaletteContextValue | undefined
>(undefined);

type IconType = React.ComponentType<{ size?: number; strokeWidth?: number }>;

type Command =
  | { kind: 'nav'; id: string; label: string; icon: IconType; to: string }
  | { kind: 'action'; id: string; label: string; icon: IconType; run: () => void }
  | { kind: 'site'; id: string; label: string; siteId: string }
  | { kind: 'record'; id: string; label: string; icon: IconType; to: string; hint: string };

const NAV_COMMANDS: Extract<Command, { kind: 'nav' }>[] = [
  { kind: 'nav', id: 'nav-home', label: 'Accueil', icon: LayoutDashboard, to: '/' },
  { kind: 'nav', id: 'nav-sites', label: 'Sites', icon: Globe, to: '/sites' },
  { kind: 'nav', id: 'nav-team', label: 'Équipe', icon: Users, to: '/team' },
  { kind: 'nav', id: 'nav-tasks', label: 'Tâches', icon: CheckSquare, to: '/tasks' },
  { kind: 'nav', id: 'nav-clients', label: 'Clients', icon: Contact, to: '/clients' },
  { kind: 'nav', id: 'nav-tracker', label: 'Tracker', icon: Radar, to: '/tracker' },
  { kind: 'nav', id: 'nav-decisions', label: 'Décisions', icon: Scale, to: '/decisions' },
  { kind: 'nav', id: 'nav-knowledge', label: 'Connaissances', icon: BookOpen, to: '/knowledge' },
  { kind: 'nav', id: 'nav-notes', label: 'Notes', icon: NotebookPen, to: '/notes' },
  { kind: 'nav', id: 'nav-learning', label: 'Progression', icon: GraduationCap, to: '/learning' },
  { kind: 'nav', id: 'nav-settings', label: 'Paramètres', icon: Settings, to: '/settings' },
];

export function CommandPaletteProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value = useMemo(() => ({ open, close }), [open, close]);

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPaletteModal isOpen={isOpen} onClose={close} />
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette(): CommandPaletteContextValue {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error(
      'useCommandPalette must be used within a CommandPaletteProvider',
    );
  }
  return context;
}

function CommandPaletteModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { openSite } = useSitePanel();
  const { open: openAssistant } = useAssistant();
  const { sites } = useRemoteSites();
  const tasks = useCollection<{ title: string }>('tasks');
  const decisions = useCollection<{ title: string }>('decisions');
  const knowledge = useCollection<{ title: string }>('knowledge');
  const { notes } = useNotes();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo<Command[]>(() => {
    const q = query.trim().toLowerCase();
    const actionCommands: Command[] = (
      [
        {
          kind: 'action',
          id: 'act-assistant',
          label: 'Ouvrir Ajmani (assistant IA)',
          icon: Sparkles,
          run: openAssistant,
        },
      ] as Command[]
    ).filter((c) => !q || c.label.toLowerCase().includes(q));
    const siteCommands: Command[] = sites
      .filter((s) => !q || s.name.toLowerCase().includes(q))
      .map((s) => ({
        kind: 'site',
        id: `site-${s.id}`,
        label: s.name,
        siteId: s.id,
      }));
    const navCommands = NAV_COMMANDS.filter(
      (c) => !q || c.label.toLowerCase().includes(q),
    );

    // Content search across synced collections — only when the user is typing,
    // so the default palette stays a clean navigation list.
    const recordCommands: Command[] = q
      ? [
          ...tasks.map((t) => ({ label: t.title || '', to: '/tasks', hint: 'Tâche', icon: CheckSquare, key: `task-${t.id}`, searchText: (t.title || '').toLowerCase() })),
          ...decisions.map((d) => ({ label: d.title || '', to: '/decisions', hint: 'Décision', icon: Scale, key: `dec-${d.id}`, searchText: (d.title || '').toLowerCase() })),
          ...knowledge.map((k) => ({ label: k.title || '', to: '/knowledge', hint: 'Document', icon: BookOpen, key: `kb-${k.id}`, searchText: (k.title || '').toLowerCase() })),
          // Notes match on their body too, not just the title.
          ...notes.map((n) => ({
            label: n.title || n.body.slice(0, 40) || 'Note sans titre',
            to: '/notes',
            hint: n.scope === 'personal' ? 'Note perso' : 'Note équipe',
            icon: NotebookPen,
            key: `note-${n.id}`,
            searchText: `${n.title} ${n.body}`.toLowerCase(),
          })),
        ]
          .filter((r) => r.searchText.includes(q))
          .slice(0, 10)
          .map((r) => ({ kind: 'record' as const, id: r.key, label: r.label, to: r.to, hint: r.hint, icon: r.icon }))
      : [];

    return [...navCommands, ...actionCommands, ...siteCommands, ...recordCommands];
  }, [query, openAssistant, sites, tasks, decisions, knowledge, notes]);

  // Reset transient state whenever the palette opens.
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const runCommand = useCallback(
    (command: Command | undefined) => {
      if (!command) return;
      if (command.kind === 'nav' || command.kind === 'record') {
        navigate(command.to);
      } else if (command.kind === 'action') {
        command.run();
      } else {
        navigate('/sites');
        openSite(command.siteId);
      }
      onClose();
    },
    [navigate, openSite, onClose],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runCommand(results[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[14vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search size={18} strokeWidth={1.75} className="text-text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Rechercher : page, site, tâche, décision, document…"
                className="w-full bg-transparent py-4 text-sm text-text-primary outline-none placeholder:text-text-muted"
              />
              <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-text-muted">
                ESC
              </kbd>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {results.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-text-secondary">
                  Aucun résultat pour « {query} »
                </p>
              ) : (
                results.map((command, index) => (
                  <CommandRow
                    key={command.id}
                    command={command}
                    active={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => runCommand(command)}
                  />
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function CommandRow({
  command,
  active,
  onMouseEnter,
  onClick,
}: {
  command: Command;
  active: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  const { sites } = useRemoteSites();
  const site =
    command.kind === 'site' ? sites.find((s) => s.id === command.siteId) : undefined;

  return (
    <button
      type="button"
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-100 ${
        active ? 'bg-accent-muted text-text-primary' : 'text-text-secondary'
      }`}
    >
      <span
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${
          active ? 'bg-accent/20 text-accent' : 'bg-white/5 text-text-secondary'
        }`}
      >
        {command.kind === 'nav' || command.kind === 'action' || command.kind === 'record' ? (
          <command.icon size={15} strokeWidth={1.75} />
        ) : (
          <Globe size={15} strokeWidth={1.75} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate">{command.label}</p>
      </div>
      {command.kind === 'record' && (
        <span className="flex-shrink-0 font-mono text-[10px] uppercase tracking-wider text-text-muted">
          {command.hint}
        </span>
      )}
      {site && <StatusBadge status={site.status} />}
      {active && (
        <CornerDownLeft
          size={14}
          strokeWidth={1.75}
          className="flex-shrink-0 text-text-muted"
        />
      )}
    </button>
  );
}
