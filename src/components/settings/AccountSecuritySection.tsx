import React, { useCallback, useEffect, useState } from 'react';
import { Eye, History, Loader2, LogOut, Monitor, ShieldCheck } from 'lucide-react';
import { bridge } from '../../lib/bridge';
import { cleanErrorMessage } from '../../lib/errorMessage';
import { relativeTime, futureTime } from '../../lib/time';
import { IS_BUSINESS } from '../../edition/edition';
import type { ActiveSession, OrgAccessRecord } from '../../shared/api';

/**
 * Hygiène du compte : les appareils connectés, et qui a ouvert cet espace.
 *
 * ## Les sessions ouvertes
 *
 * Manque de base jusqu'ici : un poste revendu ou un téléphone perdu gardait une
 * session valide jusqu'à son expiration naturelle, et son propriétaire n'avait
 * aucun moyen de le savoir ni d'y couper court. On liste donc les appareils, et
 * on peut en fermer un à distance.
 *
 * L'appareil courant est marqué. Ce n'est pas cosmétique : sans ça, le geste le
 * plus probable est de se déconnecter soi-même en croyant fermer un autre poste.
 *
 * ## Le journal d'accès
 *
 * Le site vitrine affirme que « chaque ouverture de votre espace par nous est
 * enregistrée côté serveur ». C'était vrai à moitié : le journal existait, mais
 * seule AMN DevSec pouvait le lire. Une transparence que le sujet ne peut pas
 * consulter n'en est pas une — cette section est ce qui rend la promesse
 * vérifiable par celle à qui elle est faite.
 *
 * Il est donc affiché en priorité dans l'édition Business, où il concerne la
 * cliente. Côté interne il reste utile — Aaron y voit ses propres entrées —
 * mais il n'y est pas le sujet.
 */
export function AccountSecuritySection() {
  const [sessions, setSessions] = useState<ActiveSession[] | null>(null);
  const [access, setAccess] = useState<OrgAccessRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([
        bridge().remote.listSessions(),
        // Le journal peut être refusé (jeton partagé, pas de compte nominatif) :
        // ce n'est pas une panne, c'est une absence de droit. On n'affiche
        // simplement rien plutôt que de faire échouer toute la section.
        bridge().remote.accessLog().catch(() => [] as OrgAccessRecord[]),
      ]);
      setSessions(s);
      setAccess(a);
    } catch (err) {
      setError(cleanErrorMessage(err, 'Impossible de lire vos accès.'));
      setSessions([]);
      setAccess([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const revoke = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await bridge().remote.revokeSession(id);
      await refresh();
    } catch (err) {
      setError(cleanErrorMessage(err, 'Impossible de fermer cette session.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="border border-border bg-surface p-5">
      <h2 className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
        <ShieldCheck size={13} strokeWidth={2} />
        Sécurité du compte
      </h2>

      {/* ------------------------------------------------- appareils ----- */}
      <p className="mt-4 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
        <Monitor size={11} strokeWidth={2} />
        Appareils connectés
      </p>

      {sessions === null ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-text-muted">
          <Loader2 size={14} className="animate-spin" />
          Lecture…
        </p>
      ) : sessions.length === 0 ? (
        <p className="mt-2 text-sm text-text-secondary">
          Aucune session à afficher pour ce mode de connexion.
        </p>
      ) : (
        <div className="mt-2 flex flex-col divide-y divide-border/60 border border-border">
          {sessions.map((s) => (
            <div key={s.id} className="flex min-h-14 items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text-primary">
                  {s.current ? 'Cet appareil' : 'Autre appareil'}
                  {s.supportOrgId && (
                    <span className="ml-2 border border-border px-1.5 py-px font-mono text-[9px] uppercase tracking-widest text-text-muted">
                      contexte client
                    </span>
                  )}
                </p>
                <p className="font-mono text-[9px] uppercase tracking-widest text-text-muted">
                  ouvert {relativeTime(s.createdAt)} · expire {futureTime(s.expiresAt)}
                </p>
              </div>
              {s.current ? (
                <span className="flex-shrink-0 font-mono text-[9px] uppercase tracking-widest text-text-muted">
                  en cours
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void revoke(s.id)}
                  disabled={busyId === s.id}
                  aria-label="Fermer cette session à distance"
                  title="Fermer cette session à distance"
                  className="flex min-h-11 flex-shrink-0 items-center gap-1.5 border border-border px-2.5 font-mono text-[10px] uppercase tracking-wider text-text-muted transition-colors hover:border-danger hover:text-danger disabled:opacity-50"
                >
                  {busyId === s.id ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} strokeWidth={2} />}
                  Fermer
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* --------------------------------------------- journal d'accès ---- */}
      <p className="mt-6 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
        <History size={11} strokeWidth={2} />
        {IS_BUSINESS ? 'Ouvertures de votre espace' : 'Ouvertures de cet espace'}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-text-secondary">
        {IS_BUSINESS
          ? 'Chaque fois que votre prestataire ouvre votre espace pour vous assister, l’accès est enregistré ici. Vous le voyez aussi en direct : un bandeau apparaît pendant toute la durée.'
          : 'Les ouvertures de contexte client enregistrées pour cette organisation.'}
      </p>

      {access === null ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-text-muted">
          <Loader2 size={14} className="animate-spin" />
          Lecture…
        </p>
      ) : access.length === 0 ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-text-secondary">
          <Eye size={14} strokeWidth={1.75} className="text-text-muted" />
          Aucune ouverture enregistrée.
        </p>
      ) : (
        <div className="mt-2 flex flex-col divide-y divide-border/60 border border-border">
          {access.slice(0, 20).map((entry, i) => (
            <div key={`${entry.createdAt}-${i}`} className="flex min-h-11 items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{entry.actorEmail}</span>
              <span className="flex-shrink-0 font-mono text-[9px] uppercase tracking-widest text-text-muted">
                {entry.action === 'enter' ? 'entrée' : entry.action} · {relativeTime(entry.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 border border-danger/40 bg-danger-muted px-3 py-2 font-mono text-xs text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
