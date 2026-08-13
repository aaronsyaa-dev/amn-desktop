import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Copy, KeyRound, Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { bridge } from '../../lib/bridge';
import { cleanErrorMessage } from '../../lib/errorMessage';
import { downloadText } from '../../lib/download';
import type { MfaEnrolment, MfaStatus } from '../../shared/api';

/**
 * Double authentification, dans les Paramètres.
 *
 * L'écran suit exactement le modèle du serveur (voir `docs/MFA.md` d'amn-api) :
 * l'enrôlement se fait en deux temps, et rien n'est actif tant qu'un code n'a
 * pas prouvé que le téléphone est bien configuré.
 *
 * Les codes de secours sont affichés UNE seule fois. L'écran le dit avant de
 * les montrer, propose de les télécharger, et demande une confirmation
 * explicite avant de les faire disparaître — parce qu'ils ne sont plus
 * relisibles ensuite, et que c'est le seul chemin de récupération autonome.
 */
export function MfaSection() {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [enrolment, setEnrolment] = useState<MfaEnrolment | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'idle' | 'enrolling' | 'disabling' | 'regenerating'>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await bridge().remote.mfa.status());
    } catch (err) {
      setError(cleanErrorMessage(err, 'Impossible de lire l’état de la double authentification.'));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const reset = () => {
    setMode('idle');
    setEnrolment(null);
    setCode('');
    setPassword('');
    setError(null);
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(cleanErrorMessage(err, 'L’opération a échoué.'));
    } finally {
      setBusy(false);
    }
  };

  const startEnrolment = () =>
    run(async () => {
      setEnrolment(await bridge().remote.mfa.setup());
      setMode('enrolling');
    });

  const activate = () =>
    run(async () => {
      const res = await bridge().remote.mfa.activate(code.trim());
      setCodes(res.backupCodes);
      setStatus(res.mfa);
      setEnrolment(null);
      setCode('');
      setMode('idle');
    });

  const regenerate = () =>
    run(async () => {
      const res = await bridge().remote.mfa.regenerateBackupCodes({
        password,
        code: code.trim(),
      });
      setCodes(res.backupCodes);
      setStatus(res.mfa);
      reset();
    });

  const disable = () =>
    run(async () => {
      setStatus(await bridge().remote.mfa.disable({ password, code: code.trim() }));
      reset();
    });

  const copyCodes = async () => {
    if (!codes) return;
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('La copie a échoué — sélectionnez les codes à la main.');
    }
  };

  if (!status) return null;

  /* Le serveur ne sait pas faire de MFA : on le dit, plutôt que de griser un
     bouton sans raison visible. */
  if (!status.available) {
    return (
      <Frame>
        <p className="text-xs leading-relaxed text-text-secondary">
          La double authentification n’est pas configurée sur ce serveur. Elle demande une clé de
          chiffrement (<code className="font-mono text-[11px]">MFA_SECRET_KEY</code>) : sans elle,
          le secret ne pourrait être stocké qu’en clair, ce qui vaudrait moins que pas de MFA du
          tout.
        </p>
      </Frame>
    );
  }

  return (
    <Frame>
      {/* ------------------------------- État -------------------------------- */}
      <div className="flex items-start gap-3">
        {status.enabled ? (
          <ShieldCheck size={16} strokeWidth={2} className="mt-0.5 flex-shrink-0 text-success" />
        ) : (
          <ShieldOff size={16} strokeWidth={2} className="mt-0.5 flex-shrink-0 text-warning" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text-primary">
            {status.enabled ? 'Active' : 'Inactive'}
            {status.required && (
              <span className="ml-2 border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-text-muted">
                obligatoire
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">
            {status.enabled
              ? `${status.backupCodesRemaining} code${status.backupCodesRemaining > 1 ? 's' : ''} de secours restant${status.backupCodesRemaining > 1 ? 's' : ''} sur ${status.backupCodesTotal}.`
              : status.required
                ? 'Votre rôle peut ouvrir des sessions de support sur les espaces clients : un mot de passe seul ne suffit pas à protéger ça.'
                : 'Un code à six chiffres en plus du mot de passe, depuis votre téléphone.'}
          </p>
        </div>
      </div>

      {status.enabled && status.backupCodesRemaining <= 2 && (
        <p className="mt-3 flex items-start gap-2 border border-warning/40 bg-warning-muted px-3 py-2 text-xs leading-relaxed text-text-primary">
          <AlertTriangle size={14} strokeWidth={2} className="mt-0.5 flex-shrink-0 text-warning" />
          Il ne vous reste presque plus de codes de secours. Régénérez-en : sans eux et sans votre
          téléphone, seul un autre administrateur peut vous rouvrir l’accès.
        </p>
      )}

      {/* --------------------------- Codes de secours ------------------------ */}
      {codes && (
        <div className="mt-4 border border-accent/50 bg-accent-muted p-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Vos codes de secours — affichés une seule fois
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
            Mettez-les en lieu sûr <strong className="font-semibold">maintenant</strong>. Ils ne
            seront plus jamais affichés : seule leur empreinte est conservée. Chacun ne sert qu’une
            fois.
          </p>
          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            {codes.map((c) => (
              <span key={c} className="border border-border bg-bg px-2 py-1.5 text-center font-mono text-xs text-text-primary">
                {c}
              </span>
            ))}
          </div>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => void copyCodes()}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 border border-border-strong text-xs text-text-primary transition-colors hover:bg-surface-hover md:min-h-9"
            >
              {copied ? <Check size={14} strokeWidth={2.5} /> : <Copy size={14} strokeWidth={1.75} />}
              {copied ? 'Copiés' : 'Copier'}
            </button>
            <button
              type="button"
              onClick={() =>
                downloadText(
                  `Codes de secours AMN — ${new Date().toLocaleDateString('fr-FR')}\n\n${codes.join('\n')}\n`,
                  'amn-codes-de-secours.txt',
                )
              }
              className="flex min-h-11 flex-1 items-center justify-center gap-2 border border-border text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary md:min-h-9"
            >
              Télécharger
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCodes(null)}
            className="mt-2 min-h-11 w-full bg-accent text-xs font-semibold text-bg transition-colors hover:bg-accent-hover md:min-h-9"
          >
            Je les ai mis en lieu sûr
          </button>
        </div>
      )}

      {/* ----------------------------- Enrôlement ---------------------------- */}
      {mode === 'enrolling' && enrolment && (
        <div className="mt-4 border border-border bg-bg p-3">
          <p className="text-xs leading-relaxed text-text-secondary">
            Ajoutez ce compte dans votre application d’authentification (Google Authenticator,
            Authy, 1Password…), puis saisissez le code qu’elle affiche.
          </p>
          <p className="mt-2.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Clé à saisir
          </p>
          <p className="mt-1 select-all break-all font-mono text-sm tracking-wider text-text-primary">
            {enrolment.readableSecret}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
            Rien n’est activé tant que vous n’avez pas confirmé par un code : si la configuration
            échoue, vous ne serez pas verrouillé dehors.
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={7}
            className="input-focus mt-3 min-h-11 w-full border border-border bg-surface px-3 text-center font-mono text-lg tracking-[0.3em] text-text-primary outline-none"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => void activate()}
              disabled={busy || code.trim().length < 6}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 bg-accent text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              Activer
            </button>
            <button
              type="button"
              onClick={reset}
              className="min-h-11 border border-border px-4 text-xs uppercase tracking-wider text-text-muted transition-colors hover:text-text-primary"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* --------------------- Désactivation / régénération ------------------ */}
      {(mode === 'disabling' || mode === 'regenerating') && (
        <div className="mt-4 border border-border bg-bg p-3">
          <p className="text-xs leading-relaxed text-text-secondary">
            {mode === 'disabling'
              ? 'Confirmez avec votre mot de passe ET un code : désactiver la double authentification n’est pas un simple bouton.'
              : 'De nouveaux codes remplaceront les anciens, qui cesseront immédiatement de fonctionner.'}
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Mot de passe"
            className="input-focus mt-2.5 min-h-11 w-full border border-border bg-surface px-3 text-sm text-text-primary outline-none"
          />
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={7}
            className="input-focus mt-2 min-h-11 w-full border border-border bg-surface px-3 text-center font-mono text-lg tracking-[0.3em] text-text-primary outline-none"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => void (mode === 'disabling' ? disable() : regenerate())}
              disabled={busy || !password || code.trim().length < 6}
              className={`flex min-h-11 flex-1 items-center justify-center gap-2 text-sm font-semibold transition-colors disabled:opacity-40 ${
                mode === 'disabling'
                  ? 'bg-danger text-bg hover:opacity-90'
                  : 'bg-accent text-bg hover:bg-accent-hover'
              }`}
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              {mode === 'disabling' ? 'Désactiver' : 'Régénérer'}
            </button>
            <button
              type="button"
              onClick={reset}
              className="min-h-11 border border-border px-4 text-xs uppercase tracking-wider text-text-muted transition-colors hover:text-text-primary"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 border border-danger/40 bg-danger-muted px-3 py-2 text-xs leading-relaxed text-danger">
          {error}
        </p>
      )}

      {/* ------------------------------- Actions ----------------------------- */}
      {mode === 'idle' && !codes && (
        <div className="mt-4 flex flex-wrap gap-2">
          {!status.enabled ? (
            <button
              type="button"
              onClick={() => void startEnrolment()}
              disabled={busy}
              className="flex min-h-11 items-center gap-2 bg-accent px-4 text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <KeyRound size={15} strokeWidth={2} />}
              Activer la double authentification
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setMode('regenerating')}
                className="min-h-11 border border-border px-4 text-xs uppercase tracking-wider text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
              >
                Régénérer les codes de secours
              </button>
              {/*
                Le bouton de désactivation n'existe PAS quand la MFA est
                obligatoire. Le serveur refuserait de toute façon (403) ; ne pas
                l'afficher évite de proposer une action dont la seule issue est
                un refus.
              */}
              {!status.required && (
                <button
                  type="button"
                  onClick={() => setMode('disabling')}
                  className="min-h-11 border border-border px-4 text-xs uppercase tracking-wider text-text-muted transition-colors hover:border-danger/50 hover:text-danger"
                >
                  Désactiver
                </button>
              )}
            </>
          )}
        </div>
      )}
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <section aria-label="Double authentification" className="border border-border bg-surface p-4">
      <h3 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-text-secondary">
        Double authentification
      </h3>
      {children}
    </section>
  );
}
