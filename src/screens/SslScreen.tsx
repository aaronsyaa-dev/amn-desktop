import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Lock, RefreshCw, ShieldCheck } from 'lucide-react';
import { bridge } from '../lib/bridge';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import { relativeTime } from '../lib/time';
import type { SslStatus } from '../shared/api';

/**
 * AMN SSL Monitor (BLOC 6).
 *
 * One row per supervised host: who issued the certificate, when it expires, and
 * how long is left. The TLS handshake happens on amn-api, never from this
 * machine — so the figure is the same for both operators, and expiry keeps
 * being watched while every desktop is closed.
 */

export const SSL_STAGES = [30, 15, 7] as const;

export type SslTone = 'ok' | 'warn' | 'urgent' | 'expired' | 'unknown';

export function toneFor(status: Pick<SslStatus, 'daysLeft' | 'error'>): SslTone {
  if (status.error) return 'unknown';
  if (status.daysLeft === null || status.daysLeft === undefined) return 'unknown';
  if (status.daysLeft <= 0) return 'expired';
  if (status.daysLeft <= 7) return 'urgent';
  if (status.daysLeft <= 30) return 'warn';
  return 'ok';
}

/** Red is reserved for the two states that are genuinely critical. */
const TONE_STYLE: Record<SslTone, string> = {
  ok: 'border-border text-text-secondary',
  warn: 'border-border-strong text-text-primary',
  // Un porteur rouge par puce (docs/ROUGE.md, F8) : le mot suffit, la
  // teinte de fond et la bordure rouge par-dessus étaient l'ambiance.
  urgent: 'border-border text-danger',
  expired: 'border-danger/40 text-danger',
  unknown: 'border-border text-text-muted',
};

const TONE_LABEL: Record<SslTone, string> = {
  ok: 'Valide',
  warn: 'À renouveler',
  urgent: 'Urgent',
  expired: 'Expiré',
  unknown: 'Inconnu',
};

export function sslSummary(status: SslStatus): string {
  if (status.error) return status.error;
  if (status.daysLeft === null) return 'Jamais vérifié';
  if (status.daysLeft <= 0) return 'Certificat expiré';
  return `Expire dans ${status.daysLeft} jour${status.daysLeft > 1 ? 's' : ''}`;
}

export function SslScreen() {
  const navigate = useNavigate();
  const [statuses, setStatuses] = useState<SslStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStatuses(await bridge().remote.listSslStatus());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'État SSL indisponible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const recheck = async (host: string) => {
    setChecking(host);
    try {
      const updated = await bridge().remote.checkSsl(host);
      setStatuses((prev) =>
        prev.map((s) => (s.host === host ? { ...s, ...updated, site: s.site } : s)),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Vérification impossible.');
    } finally {
      setChecking(null);
    }
  };

  // Most urgent first: expired, then closest to expiry, then never checked.
  const sorted = useMemo(
    () =>
      [...statuses].sort((a, b) => {
        const av = a.daysLeft ?? Number.POSITIVE_INFINITY;
        const bv = b.daysLeft ?? Number.POSITIVE_INFINITY;
        return av - bv;
      }),
    [statuses],
  );

  const atRisk = sorted.filter((s) => ['expired', 'urgent', 'warn'].includes(toneFor(s))).length;

  return (
    <StaggerGroup className="flex flex-col gap-5">
      <StaggerItem>
        <ScreenHeader
          eyebrow="Produits · SSL Monitor"
          title="SSL Monitor"
          description="Les certificats TLS des sites supervisés. La vérification part d’amn-api, jamais de ce poste."
          stats={[
            { label: 'Hôtes', value: sorted.length },
            {
              label: 'À renouveler',
              value: atRisk,
              emphasis: atRisk > 0,
              title: 'Expirés, ou à moins de trente jours.',
            },
          ]}
          actions={
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Rafraîchir"
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            <RefreshCw size={14} strokeWidth={1.75} />
            <span className="hidden sm:inline">Rafraîchir</span>
          </button>
          }
        />
      </StaggerItem>

      {error && (
        <StaggerItem>
          <div className="flex items-start gap-2 border border-border border-l-2 border-l-danger bg-surface px-4 py-3 text-sm text-text-secondary">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0 text-danger" strokeWidth={2} />
            <span>{error}</span>
          </div>
        </StaggerItem>
      )}

      <StaggerItem>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
          {loading
            ? 'Chargement…'
            : `${sorted.length} hôte(s) suivi(s) · ${atRisk} à surveiller · alertes à 30, 15 et 7 jours`}
        </p>
      </StaggerItem>

      <StaggerItem>
        {sorted.length === 0 && !loading ? (
          <p className="elev-1 rounded-2xl border border-border bg-surface px-4 py-10 text-center text-sm text-text-muted">
            Aucun hôte à surveiller. Renseignez l’URL d’un site dans l’onglet Sites pour que son
            certificat soit suivi.
          </p>
        ) : (
          <ul className="elev-1 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {sorted.map((status) => {
              const tone = toneFor(status);
              return (
                <li key={status.host} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                  <span
                    className={`flex-shrink-0 rounded-md border px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-wider ${TONE_STYLE[tone]}`}
                  >
                    {TONE_LABEL[tone]}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text-primary">{status.host}</p>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                      {sslSummary(status)}
                      {status.validTo &&
                        ` · jusqu’au ${new Date(status.validTo).toLocaleDateString('fr-FR')}`}
                      {status.issuer && ` · ${status.issuer}`}
                    </p>
                    {status.lastCheckedAt && (
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                        Vérifié {relativeTime(status.lastCheckedAt)}
                      </p>
                    )}
                  </div>

                  {status.site && (
                    <button
                      type="button"
                      onClick={() => navigate(`/tracker/site/${status.site?.id}`)}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:text-text-primary"
                    >
                      {status.site.name}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => void recheck(status.host)}
                    disabled={checking === status.host}
                    aria-label={`Vérifier ${status.host}`}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:text-text-primary disabled:opacity-40"
                  >
                    {checking === status.host ? (
                      <RefreshCw size={12} strokeWidth={2} className="animate-spin" />
                    ) : (
                      <ShieldCheck size={12} strokeWidth={2} />
                    )}
                    Vérifier
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </StaggerItem>
    </StaggerGroup>
  );
}
