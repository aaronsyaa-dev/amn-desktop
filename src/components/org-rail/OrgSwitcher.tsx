import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Building2, Plus, Search, ShieldCheck } from 'lucide-react';
import { useOrgContext } from '../../state/OrgContextContext';
import { OrgAvatar } from './OrgAvatar';
import { relativeTime } from '../../lib/time';
import type { AdminOrganization } from '../../shared/api';

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Le sélecteur d'organisation — la recherche du rail.
 *
 * Le rail lui-même reste une colonne d'icônes : c'est le bon geste pour les
 * quelques organisations qu'on ouvre tous les jours, et le mauvais dès qu'il y
 * en a cinquante. Passé ce seuil, on ne parcourt plus une colonne, on cherche
 * un nom — d'où ce panneau, ouvert au clic sur la loupe ou au clavier, filtré
 * au fil de la frappe et entièrement navigable aux flèches.
 *
 * Volontairement bâti comme la palette de commandes plutôt que comme un menu
 * déroulant : même geste, même vocabulaire, rien de nouveau à apprendre.
 */
export function OrgSwitcher({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: () => void;
}) {
  const { organizations, support, enterOrganization, leaveOrganization, orgsError } = useOrgContext();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return organizations;
    return organizations.filter((org) => org.name.toLowerCase().includes(needle));
  }, [organizations, query]);

  // « AMN DevSec » est une destination du sélecteur au même titre qu'une
  // cliente : depuis un contexte client, c'est même la plus utile.
  const showHome = !query.trim() || 'amn devsec'.includes(query.trim().toLowerCase());
  const rows: Array<{ key: string; org?: AdminOrganization }> = [
    ...(showHome ? [{ key: '__amn' }] : []),
    ...matches.map((org) => ({ key: org.id, org })),
  ];

  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  const choose = (row: { key: string; org?: AdminOrganization }) => {
    onClose();
    if (!row.org) {
      if (support) void leaveOrganization();
      return;
    }
    void enterOrganization(row.org.id);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setCursor((c) => Math.min(c + 1, rows.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const row = rows[cursor];
      if (row) choose(row);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  // Garde la ligne sélectionnée dans le champ de vision : avec des centaines
  // d'organisations, naviguer aux flèches sans ça sort de l'écran au 8e appui.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  return (
    <AnimatePresence>
      {open && (
        <React.Fragment key="org-switcher">
          <motion.div
            key="switcher-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 z-[170] bg-black/65 backdrop-blur-[2px]"
            aria-hidden
          />
          <motion.div
            key="switcher-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Changer d’organisation"
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.99 }}
            transition={{ duration: 0.26, ease: EASE }}
            onKeyDown={onKeyDown}
            className="elev-3 fixed inset-x-0 bottom-0 z-[171] flex max-h-[80vh] flex-col overflow-hidden rounded-t-3xl border border-border bg-surface sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-[12vh] sm:w-[min(34rem,calc(100vw-3rem))] sm:-translate-x-1/2 sm:rounded-2xl"
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Search size={16} strokeWidth={1.75} className="flex-shrink-0 text-text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCursor(0);
                }}
                placeholder="Chercher une organisation…"
                aria-label="Chercher une organisation"
                className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
              />
              <span className="hidden font-mono text-[10px] uppercase tracking-widest text-text-muted sm:inline">
                {organizations.length} organisation{organizations.length > 1 ? 's' : ''}
              </span>
            </div>

            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto py-1">
              {orgsError && (
                <p className="px-4 py-3 text-xs text-danger">{orgsError}</p>
              )}
              {rows.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-text-muted">
                  Aucune organisation ne porte ce nom.
                </p>
              )}
              {rows.map((row, index) => {
                const active = index === cursor;
                const current = row.org ? support?.orgId === row.org.id : !support;
                return (
                  <button
                    key={row.key}
                    type="button"
                    data-active={active}
                    onMouseMove={() => setCursor(index)}
                    onClick={() => choose(row)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      active ? 'bg-surface-hover' : ''
                    }`}
                  >
                    {row.org ? (
                      <OrgAvatar
                        name={row.org.name}
                        logoDataUrl={row.org.logoDataUrl}
                        size={30}
                        rounded="rounded-xl"
                      />
                    ) : (
                      <span className="flex h-[30px] w-[30px] items-center justify-center rounded-xl bg-accent-muted text-text-primary">
                        <ShieldCheck size={16} strokeWidth={1.75} />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-text-primary">
                        {row.org ? row.org.name : 'AMN DevSec'}
                      </span>
                      <span className="block truncate font-mono text-[10px] uppercase tracking-widest text-text-muted">
                        {row.org
                          ? row.org.status === 'suspended'
                            ? 'Suspendue'
                            : row.org.lastActivityAt
                              ? `Activité ${relativeTime(row.org.lastActivityAt)}`
                              : 'Aucune activité'
                          : 'Votre organisation'}
                      </span>
                    </span>
                    {current && (
                      <span className="font-mono text-[9px] uppercase tracking-widest text-text-secondary">
                        Actif
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onCreate();
              }}
              className="flex items-center gap-3 border-t border-border px-4 py-3 text-left text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <span className="flex h-[30px] w-[30px] items-center justify-center rounded-xl border border-dashed border-border-strong">
                <Plus size={15} strokeWidth={2} />
              </span>
              <span className="flex-1">Créer une organisation cliente</span>
              <Building2 size={14} strokeWidth={1.75} className="text-text-muted" />
            </button>
          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
}
