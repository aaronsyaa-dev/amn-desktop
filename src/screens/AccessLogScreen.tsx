import React, { useEffect, useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { History, RefreshCw } from 'lucide-react';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import { useOrgContext } from '../state/OrgContextContext';
import { ACCESS_VERB } from './ControlTowerScreen';
import { bridge } from '../lib/bridge';
import { cleanErrorMessage } from '../lib/errorMessage';
import { relativeTime } from '../lib/time';
import type { OrgAccessEntry } from '../shared/api';

/**
 * Le journal des accès aux dossiers clients.
 *
 * AMN DevSec peut entrer dans l'espace de travail d'une cliente pour la
 * dépanner. Ce pouvoir n'a de sens que s'il est relisible : chaque entrée, chaque
 * sortie, chaque suspension, chaque accès réémis laisse une ligne ici.
 *
 * Le journal est écrit par amn-api, pas par cette application : elle ne fait
 * que le lire. Un journal que le client pourrait omettre d'écrire ne prouverait
 * rien — et c'est justement le genre de garantie qu'on veut pouvoir présenter à
 * une cliente qui demande qui a vu ses données.
 */
export function AccessLogScreen() {
  const { organizations } = useOrgContext();
  const [entries, setEntries] = useState<OrgAccessEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [orgFilter, setOrgFilter] = useState('all');
  const [reloading, setReloading] = useState(false);

  const load = React.useCallback(async () => {
    setReloading(true);
    try {
      const rows = await bridge().remote.admin.accessLog({ limit: 300 });
      setEntries(rows);
      setError(null);
    } catch (err) {
      setError(cleanErrorMessage(err, 'Journal indisponible.'));
      setEntries([]);
    } finally {
      setReloading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(
    () => (entries ?? []).filter((e) => orgFilter === 'all' || e.orgId === orgFilter),
    [entries, orgFilter],
  );

  // Regroupé par jour : un journal continu de trois cents lignes ne se lit pas,
  // alors qu'une question comme « qui est entré chez elle mardi ? » se pose tout
  // le temps.
  const days = useMemo(() => {
    const map = new Map<string, OrgAccessEntry[]>();
    for (const entry of rows) {
      const key = entry.createdAt.slice(0, 10);
      const bucket = map.get(key);
      if (bucket) bucket.push(entry);
      else map.set(key, [entry]);
    }
    return [...map.entries()];
  }, [rows]);

  return (
    <StaggerGroup className="flex flex-col gap-6">
      <StaggerItem>
        <ScreenHeader
          eyebrow="Tour de contrôle · Journal"
          title="Journal d’accès"
          description="Qui est entré chez qui, et quand — consigné par amn-api, jamais par ce poste."
          stats={[
            { label: 'Entrées', value: entries === null ? '…' : entries.length },
            { label: 'Affichées', value: rows.length, title: 'Après le filtre d’organisation.' },
          ]}
          actions={
          <div className="flex items-center gap-2">
            <select
              value={orgFilter}
              onChange={(e) => setOrgFilter(e.target.value)}
              aria-label="Filtrer par organisation"
              className="input-focus rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-secondary"
            >
              <option value="all">Toutes les organisations</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void load()}
              disabled={reloading}
              aria-label="Rafraîchir"
              className="rounded-lg border border-border p-2 text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
            >
              <RefreshCw size={15} strokeWidth={1.75} className={reloading ? 'animate-spin' : ''} />
            </button>
          </div>
          }
        />
      </StaggerItem>

      {error && (
        <StaggerItem>
          <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-text-secondary">
            {error}
          </p>
        </StaggerItem>
      )}

      <StaggerItem>
        {entries === null ? (
          <p className="py-8 text-center text-sm text-text-muted">Chargement…</p>
        ) : days.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface py-12 text-center">
            <History size={22} strokeWidth={1.5} className="text-text-muted" />
            <p className="text-sm font-medium text-text-primary">Aucun accès consigné</p>
            <p className="max-w-sm text-sm text-text-secondary">
              Le journal se remplit dès qu’un dossier client est ouvert depuis le rail.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {days.map(([day, dayEntries]) => (
              <section key={day}>
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
                  {new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <ul className="elev-1 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                  {dayEntries.map((entry) => (
                    <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                      <span
                        className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                          entry.action === 'suspend' ? 'bg-danger' : 'bg-text-muted'
                        }`}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 text-xs text-text-secondary">
                        <span className="text-text-primary">{entry.actorEmail}</span>{' '}
                        {ACCESS_VERB[entry.action] ?? entry.action}{' '}
                        <span className="text-text-primary">{entry.orgName}</span>
                        {entry.detail && <span className="text-text-muted"> — {entry.detail}</span>}
                      </span>
                      <time
                        dateTime={entry.createdAt}
                        title={new Date(entry.createdAt).toLocaleString('fr-FR')}
                        className="tnum flex-shrink-0 text-[10px] uppercase tracking-widest text-text-muted"
                      >
                        {new Date(entry.createdAt).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        · {relativeTime(entry.createdAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </StaggerItem>
    </StaggerGroup>
  );
}
