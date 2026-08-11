import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Building2, FolderLock, Plus, Search, ShieldOff, ShieldCheck } from 'lucide-react';
import { useOrgContext } from '../state/OrgContextContext';
import { OrgAvatar } from '../components/org-rail/OrgAvatar';
import { CreateOrgDialog } from '../components/org-rail/CreateOrgDialog';
import { OrgDossierPanel } from '../components/org-rail/OrgDossierPanel';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import { bridge } from '../lib/bridge';
import { cleanErrorMessage } from '../lib/errorMessage';
import { relativeTime } from '../lib/time';
import type { AdminOrganization } from '../shared/api';

type Filter = 'all' | 'active' | 'suspended';

/**
 * Le registre des organisations clientes.
 *
 * Le panneau de la Tour de contrôle donne l'état du parc en six lignes ; celui-ci
 * est fait pour le gérer — chercher, filtrer, suspendre, réactiver, entrer.
 *
 * Suspendre et réactiver sont ici, PAS dans le contexte client : ce sont des
 * gestes qu'on fait sur une organisation, pas dans son espace de travail. Le
 * contexte client garde son propre panneau Administration pour ce qui concerne
 * l'organisation qu'on est en train de consulter.
 */
export function OrganizationsScreen() {
  const { organizations, loadingOrgs, orgsError, refreshOrganizations, enterOrganization, entering } =
    useOrgContext();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dossierOrg, setDossierOrg] = useState<AdminOrganization | null>(null);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return organizations.filter((org) => {
      if (filter !== 'all' && org.status !== filter) return false;
      if (needle && !org.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [organizations, query, filter]);

  const toggleStatus = async (org: AdminOrganization) => {
    setError(null);
    setPending(org.id);
    try {
      await bridge().remote.admin.setOrganizationStatus(
        org.id,
        org.status === 'suspended' ? 'active' : 'suspended',
      );
      await refreshOrganizations();
    } catch (err) {
      setError(cleanErrorMessage(err, 'Action refusée par amn-api.'));
    } finally {
      setPending(null);
    }
  };

  return (
    <StaggerGroup className="flex flex-col gap-6">
      <StaggerItem>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">Organisations</h1>
            <p className="mt-1 font-mono text-xs uppercase tracking-widest text-text-muted">
              {organizations.length} organisation{organizations.length > 1 ? 's' : ''} cliente
              {organizations.length > 1 ? 's' : ''} gérée{organizations.length > 1 ? 's' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 bg-accent px-4 py-2.5 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover"
          >
            <Plus size={16} strokeWidth={2} />
            Nouvelle organisation
          </button>
        </div>
      </StaggerItem>

      <StaggerItem>
        <div className="flex flex-wrap items-center gap-2">
          <label className="input-focus flex min-w-[14rem] flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
            <Search size={15} strokeWidth={1.75} className="flex-shrink-0 text-text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Chercher une organisation…"
              aria-label="Chercher une organisation"
              className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
            />
          </label>
          <div className="flex gap-1">
            {(
              [
                ['all', 'Toutes'],
                ['active', 'Actives'],
                ['suspended', 'Suspendues'],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-lg px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                  filter === key
                    ? 'bg-accent-muted text-text-primary'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </StaggerItem>

      {(error || orgsError) && (
        <StaggerItem>
          <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-text-secondary">
            {error ?? orgsError}
          </p>
        </StaggerItem>
      )}

      <StaggerItem>
        {loadingOrgs ? (
          <p className="py-8 text-center text-sm text-text-muted">Chargement…</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface py-12 text-center">
            <Building2 size={22} strokeWidth={1.5} className="text-text-muted" />
            <p className="text-sm font-medium text-text-primary">
              {organizations.length === 0
                ? 'Aucune organisation cliente'
                : 'Aucune organisation ne correspond'}
            </p>
            <p className="max-w-sm text-sm text-text-secondary">
              {organizations.length === 0
                ? 'La création génère l’organisation, son compte propriétaire et son accès en une fois.'
                : 'Changez le filtre ou effacez la recherche.'}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {rows.map((org) => (
                <motion.li
                  key={org.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="elev-1 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3"
                >
                  <OrgAvatar name={org.name} logoDataUrl={org.logoDataUrl} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text-primary">{org.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                      {org.plan === 'business_premium' ? 'Business premium' : 'Business standard'} ·{' '}
                      {org.userCount} compte{org.userCount > 1 ? 's' : ''} ·{' '}
                      {org.lastActivityAt
                        ? `activité ${relativeTime(org.lastActivityAt)}`
                        : 'aucune activité'}
                    </p>
                  </div>

                  {org.status === 'suspended' && (
                    <span className="rounded-md border border-danger/40 bg-danger/10 px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-danger">
                      Suspendue
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => void toggleStatus(org)}
                    disabled={pending === org.id}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
                  >
                    {org.status === 'suspended' ? (
                      <ShieldCheck size={14} strokeWidth={1.75} />
                    ) : (
                      <ShieldOff size={14} strokeWidth={1.75} />
                    )}
                    {org.status === 'suspended' ? 'Réactiver' : 'Suspendre'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setDossierOrg(org)}
                    title="Dossier interne : modules ouverts et notes"
                    className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-2 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
                  >
                    <FolderLock size={14} strokeWidth={1.75} />
                    Dossier
                  </button>

                  <button
                    type="button"
                    onClick={() => void enterOrganization(org.id)}
                    disabled={entering === org.id || org.status === 'suspended'}
                    title={
                      org.status === 'suspended'
                        ? 'Réactivez l’organisation pour ouvrir son espace'
                        : undefined
                    }
                    className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
                  >
                    Ouvrir
                    <ArrowRight size={13} strokeWidth={2} />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </StaggerItem>

      <CreateOrgDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      <AnimatePresence>
        {dossierOrg && (
          <OrgDossierPanel
            key={dossierOrg.id}
            /* Relu dans la liste plutôt que figé à l'ouverture : les bascules de
               modules doivent se voir immédiatement dans le panneau qui vient
               de les provoquer. */
            org={organizations.find((o) => o.id === dossierOrg.id) ?? dossierOrg}
            onClose={() => setDossierOrg(null)}
            onSaved={() => void refreshOrganizations()}
          />
        )}
      </AnimatePresence>
    </StaggerGroup>
  );
}
