import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Copy,
  History,
  KeyRound,
  Link2,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Users,
} from 'lucide-react';
import { useOrgContext } from '../state/OrgContextContext';
import { OrgAvatar } from '../components/org-rail/OrgAvatar';
import { StaggerGroup, StaggerItem } from '../components/Stagger';
import { ACCESS_VERB } from '../screens/ControlTowerScreen';
import { bridge } from '../lib/bridge';
import { cleanErrorMessage } from '../lib/errorMessage';
import { relativeTime } from '../lib/time';
import type { AdminOrgUser, OrgAccessEntry } from '../shared/api';

/**
 * Le panneau d'administration d'une organisation cliente.
 *
 * Séparé de ses écrans à elle, délibérément : suspendre une organisation ou
 * réémettre un accès ne sont pas des fonctions de son application, ce sont des
 * gestes d'AMN DevSec sur son compte. Les mélanger à son Calendrier ou à ses
 * Clients rendrait impossible de répondre à la question « est-ce que je regarde
 * son outil, ou est-ce que j'agis sur son abonnement ? ».
 *
 * Les trois actions passent par la console admin d'amn-api avec le justificatif
 * de l'opérateur — pas avec le jeton de support, qu'amn-api refuse d'ailleurs
 * sur ces routes. Chacune laisse une ligne au journal.
 */
export function ClientAdminScreen() {
  const { support, organizations, refreshOrganizations, leaveOrganization } = useOrgContext();
  const org = organizations.find((o) => o.id === support?.orgId);

  const [users, setUsers] = useState<AdminOrgUser[] | null>(null);
  const [log, setLog] = useState<OrgAccessEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ kind: 'password' | 'invitation'; value: string; email: string } | null>(
    null,
  );

  const orgId = support?.orgId;

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const [members, entries] = await Promise.all([
        bridge().remote.admin.listUsers(orgId),
        bridge().remote.admin.accessLog({ orgId, limit: 20 }),
      ]);
      setUsers(members);
      setLog(entries);
      setError(null);
    } catch (err) {
      setError(cleanErrorMessage(err, 'Console d’administration indisponible.'));
      setUsers([]);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!support) return null;

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(cleanErrorMessage(err, 'Action refusée par amn-api.'));
    } finally {
      setBusy(null);
    }
  };

  const suspend = () =>
    run('status', async () => {
      await bridge().remote.admin.setOrganizationStatus(support.orgId, 'suspended');
      await refreshOrganizations();
      // Une organisation suspendue ne peut plus être consultée — amn-api coupe
      // le jeton de support à la requête suivante. Sortir tout de suite vaut
      // mieux que laisser l'écran se vider erreur par erreur.
      await leaveOrganization();
    });

  const reactivate = () =>
    run('status', async () => {
      await bridge().remote.admin.setOrganizationStatus(support.orgId, 'active');
      await refreshOrganizations();
      await load();
    });

  const reissue = (user: AdminOrgUser) =>
    run(`invite-${user.id}`, async () => {
      const result = await bridge().remote.admin.reissueInvitation(support.orgId, user.email, user.role);
      setSecret({ kind: 'invitation', value: result.invitation.token, email: user.email });
      await load();
    });

  const resetPassword = (user: AdminOrgUser) =>
    run(`password-${user.id}`, async () => {
      const result = await bridge().remote.admin.resetPassword(support.orgId, user.id);
      setSecret({ kind: 'password', value: result.password, email: user.email });
      await load();
    });

  const suspended = org?.status === 'suspended';

  return (
    <StaggerGroup className="flex flex-col gap-6">
      <StaggerItem>
        <div className="flex flex-wrap items-center gap-3">
          <OrgAvatar name={support.orgName} logoDataUrl={support.logoDataUrl} size={44} />
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-text-primary">Administration</h1>
            <p className="mt-0.5 font-mono text-xs uppercase tracking-widest text-text-muted">
              {support.orgName} · {org?.plan === 'business_premium' ? 'Business premium' : 'Business standard'}
            </p>
          </div>
        </div>
      </StaggerItem>

      <StaggerItem>
        <p className="flex items-start gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-xs leading-relaxed text-text-secondary">
          <ShieldAlert size={14} strokeWidth={1.75} className="mt-0.5 flex-shrink-0 text-text-muted" />
          Ces actions portent sur le COMPTE de l’organisation, pas sur son travail. Elles partent
          avec votre propre justificatif AMN DevSec et sont consignées au journal, avec votre nom.
        </p>
      </StaggerItem>

      {error && (
        <StaggerItem>
          <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-text-secondary">
            {error}
          </p>
        </StaggerItem>
      )}

      <AnimatePresence>
        {secret && (
          <motion.div
            key="secret"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-xl border border-warning/50 bg-warning-muted p-4"
          >
            <SecretRow secret={secret} onDismiss={() => setSecret(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      <StaggerItem>
        <section className="elev-1 rounded-2xl border border-border bg-surface">
          <header className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Users size={15} strokeWidth={1.75} className="text-text-secondary" />
            <h2 className="text-sm font-semibold text-text-primary">Comptes</h2>
          </header>
          {users === null ? (
            <p className="px-4 py-6 text-sm text-text-muted">Chargement…</p>
          ) : users.length === 0 ? (
            <p className="px-4 py-6 text-sm text-text-muted">Aucun compte.</p>
          ) : (
            <ul className="divide-y divide-border">
              {users.map((user) => (
                <li key={user.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-text-primary">{user.email}</span>
                    <span className="block font-mono text-[10px] uppercase tracking-widest text-text-muted">
                      {user.role} ·{' '}
                      {user.status === 'invited'
                        ? 'invité, pas encore activé'
                        : user.status === 'suspended'
                          ? 'suspendu'
                          : 'actif'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void reissue(user)}
                    disabled={busy !== null}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
                  >
                    <Link2 size={13} strokeWidth={1.75} />
                    Réémettre l’invitation
                  </button>
                  <button
                    type="button"
                    onClick={() => void resetPassword(user)}
                    disabled={busy !== null || user.status === 'suspended'}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary disabled:opacity-50"
                  >
                    <KeyRound size={13} strokeWidth={1.75} />
                    Mot de passe temporaire
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </StaggerItem>

      <StaggerItem>
        <section className="elev-1 rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-3">
            {suspended ? (
              <ShieldOff size={16} strokeWidth={1.75} className="text-danger" />
            ) : (
              <ShieldCheck size={16} strokeWidth={1.75} className="text-text-secondary" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text-primary">
                {suspended ? 'Organisation suspendue' : 'Organisation active'}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-text-muted">
                La suspension prend effet à la requête suivante et coupe aussi sa synchronisation
                temps réel. Elle referme immédiatement ce contexte.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void (suspended ? reactivate() : suspend())}
              disabled={busy !== null}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
                suspended
                  ? 'bg-accent text-bg hover:bg-accent-hover'
                  : 'border border-danger/50 text-danger hover:bg-danger/10'
              }`}
            >
              {suspended ? 'Réactiver' : 'Suspendre l’organisation'}
            </button>
          </div>
        </section>
      </StaggerItem>

      <StaggerItem>
        <section className="elev-1 rounded-2xl border border-border bg-surface">
          <header className="flex items-center gap-2 border-b border-border px-4 py-3">
            <History size={15} strokeWidth={1.75} className="text-text-secondary" />
            <h2 className="text-sm font-semibold text-text-primary">
              Accès à cette organisation
            </h2>
          </header>
          {log.length === 0 ? (
            <p className="px-4 py-6 text-sm text-text-muted">Aucun accès consigné.</p>
          ) : (
            <ul className="divide-y divide-border">
              {log.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-xs text-text-secondary">
                    <span className="text-text-primary">{entry.actorEmail}</span>{' '}
                    {ACCESS_VERB[entry.action] ?? entry.action}{' '}
                    <span className="text-text-primary">{entry.orgName}</span>
                    {entry.detail && <span className="text-text-muted"> — {entry.detail}</span>}
                  </span>
                  <time className="flex-shrink-0 font-mono text-[10px] uppercase tracking-widest text-text-muted">
                    {relativeTime(entry.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </StaggerItem>
    </StaggerGroup>
  );
}

/** Le secret émis, affiché une seule fois — comme le dit l'encart. */
function SecretRow({
  secret,
  onDismiss,
}: {
  secret: { kind: 'password' | 'invitation'; value: string; email: string };
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
        {secret.kind === 'password' ? 'Mot de passe temporaire' : 'Jeton d’activation'} ·{' '}
        {secret.email}
      </p>
      <div className="flex items-start gap-2">
        <code className="min-w-0 flex-1 break-all font-mono text-sm text-text-primary">
          {secret.value}
        </code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard
              .writeText(secret.value)
              .then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              })
              .catch(() => undefined);
          }}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 text-[10px] uppercase tracking-widest text-text-secondary transition-colors hover:text-text-primary"
        >
          {copied ? <Check size={12} strokeWidth={2} /> : <Copy size={12} strokeWidth={2} />}
          {copied ? 'Copié' : 'Copier'}
        </button>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] leading-relaxed text-text-secondary">
          Affiché une seule fois. À transmettre de vive voix, pas par email.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="flex-shrink-0 font-mono text-[10px] uppercase tracking-widest text-text-muted transition-colors hover:text-text-primary"
        >
          J’ai noté
        </button>
      </div>
    </div>
  );
}
