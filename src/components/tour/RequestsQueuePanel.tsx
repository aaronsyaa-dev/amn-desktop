import React, { useCallback, useEffect, useState } from 'react';
import { Check, Inbox, Loader2, Reply, X } from 'lucide-react';
import { bridge } from '../../lib/bridge';
import { cleanErrorMessage } from '../../lib/errorMessage';
import { relativeTime } from '../../lib/time';
import type { SupportRequestForOperator } from '../../shared/api';

/**
 * LA FILE DES DEMANDES — ce que les clientes nous ont écrit (Blocs 1, 3, 4)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Une seule file, trois natures : un message, une place de plus, un mot de
 * passe oublié. Trois statuts : à traiter, répondu, clos. On répond ICI —
 * la réponse s'affiche chez elle, sous sa demande — et on clôt quand c'est
 * fait. Un mot de passe oublié se règle dans son dossier (mot de passe
 * temporaire ou lien de bienvenue) ; la ligne rappelle où.
 */

const NATURE: Record<SupportRequestForOperator['kind'], string> = {
  message: 'Message',
  seat: 'Place de plus',
  password_reset: 'Mot de passe oublié',
};

export function RequestsQueuePanel() {
  const [demandes, setDemandes] = useState<SupportRequestForOperator[] | null>(null);
  const [filtre, setFiltre] = useState<'pending' | 'answered' | 'closed'>('pending');
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [reponse, setReponse] = useState('');
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      setDemandes(await bridge().remote.admin.supportRequests(filtre));
      setErreur(null);
    } catch (err) {
      setErreur(cleanErrorMessage(err, 'La file des demandes n’a pas pu être lue.'));
    }
  }, [filtre]);

  useEffect(() => {
    void charger();
  }, [charger]);

  // Une demande qui arrive pendant qu'on regarde la file : on relit, sans voile.
  useEffect(() => bridge().remote.onSupportRequest?.(() => void charger()) ?? undefined, [charger]);

  const agir = async (id: string, status: 'answered' | 'closed') => {
    setEnCours(id);
    setErreur(null);
    try {
      await bridge().remote.admin.answerSupportRequest(id, {
        status,
        reply: status === 'answered' ? reponse.trim() : undefined,
      });
      setOuverte(null);
      setReponse('');
      await charger();
    } catch (err) {
      setErreur(cleanErrorMessage(err, 'La demande n’a pas pu être traitée.'));
    } finally {
      setEnCours(null);
    }
  };

  const enAttente = filtre === 'pending' ? (demandes?.length ?? 0) : null;
  // La file vide en « à traiter » ne s'affiche pas : c'est un bloc en plus, pas le sujet de la page.
  if (filtre === 'pending' && demandes !== null && demandes.length === 0 && !erreur) return null;

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow flex items-center gap-2">
          <Inbox size={13} strokeWidth={1.75} />
          Demandes des clientes{enAttente !== null && enAttente > 0 ? ` · ${enAttente}` : ''}
        </p>
        <div className="flex gap-1" role="group" aria-label="Filtrer les demandes">
          {(['pending', 'answered', 'closed'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltre(f)}
              aria-pressed={filtre === f}
              className={`min-h-11 px-2.5 font-mono text-[10px] uppercase tracking-wider transition-colors md:min-h-0 md:py-1 ${
                filtre === f ? 'border border-border-strong text-text-primary' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {f === 'pending' ? 'À traiter' : f === 'answered' ? 'Répondu' : 'Clos'}
            </button>
          ))}
        </div>
      </div>

      {erreur && (
        <p className="mb-3 rounded-lg border border-warning/40 bg-warning-muted px-3 py-2 text-xs text-text-primary">{erreur}</p>
      )}
      {demandes === null && !erreur && (
        <p className="flex items-center gap-2 text-xs text-text-muted"><Loader2 size={13} className="animate-spin" /> Lecture…</p>
      )}
      {demandes !== null && demandes.length === 0 && filtre !== 'pending' && (
        <p className="text-xs text-text-muted">Rien dans cette vue.</p>
      )}

      {demandes !== null && demandes.length > 0 && (
        <ul className="flex flex-col gap-px bg-border">
          {demandes.map((d) => (
            <li key={d.id} className="bg-surface px-3 py-2.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-text-primary">
                    <span className="mr-2 font-mono text-[10px] uppercase tracking-wider text-text-muted">{NATURE[d.kind]}</span>
                    {d.orgName ?? 'Adresse inconnue'} <span className="text-text-muted">·</span> {d.subject}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    {d.requestedByEmail} · {relativeTime(d.createdAt)}
                    {d.handledByEmail ? ` · traité par ${d.handledByEmail}` : ''}
                  </p>
                  {d.body && <p className="mt-1 max-w-prose whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">{d.body}</p>}
                  {d.reply && (
                    <p className="mt-1 max-w-prose border-l-2 border-border-strong pl-2 text-xs leading-relaxed text-text-primary">{d.reply}</p>
                  )}
                  {d.kind === 'password_reset' && d.status === 'pending' && (
                    <p className="mt-1 text-[11px] text-text-muted">
                      À régler dans son dossier : mot de passe temporaire, ou lien de bienvenue.
                    </p>
                  )}
                </div>
                {d.status === 'pending' && (
                  <div className="flex flex-shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setOuverte(ouverte === d.id ? null : d.id); setReponse(''); }}
                      className="flex min-h-11 items-center gap-1.5 border border-border-strong bg-surface px-3 text-xs text-text-primary transition-colors hover:bg-surface-hover md:min-h-0 md:py-2"
                    >
                      <Reply size={13} />
                      Répondre
                    </button>
                    <button
                      type="button"
                      disabled={enCours === d.id}
                      onClick={() => void agir(d.id, 'closed')}
                      className="flex min-h-11 items-center gap-1.5 border border-border px-3 text-xs text-text-muted transition-colors hover:text-text-primary disabled:opacity-40 md:min-h-0 md:py-2"
                    >
                      <X size={13} />
                      Clore
                    </button>
                  </div>
                )}
              </div>
              {ouverte === d.id && (
                <div className="mt-2">
                  <textarea
                    value={reponse}
                    onChange={(e) => setReponse(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    autoFocus
                    placeholder="Votre réponse — elle s’affiche chez elle, sous sa demande."
                    className="input-focus w-full resize-y border border-border bg-bg px-3 py-2 text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-muted"
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={enCours === d.id || reponse.trim().length === 0}
                      onClick={() => void agir(d.id, 'answered')}
                      className="flex min-h-11 items-center gap-1.5 bg-accent px-3 text-xs font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40 md:min-h-0 md:py-2"
                    >
                      {enCours === d.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      Envoyer la réponse
                    </button>
                    <button type="button" onClick={() => setOuverte(null)} className="min-h-11 px-2 text-xs text-text-muted hover:text-text-primary md:min-h-0">
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
