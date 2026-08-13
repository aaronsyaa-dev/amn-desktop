import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Loader2, ShieldCheck} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Logo } from '../components/Logo';
import { EDITION_PRODUCT_NAME, IS_BUSINESS } from '../edition/edition';

interface LocationState {
  from?: { pathname: string };
}

type Phase = 'idle' | 'submitting' | 'success';

/** Detects an active Caps Lock from a keyboard event, when the browser exposes it. */
function capsFromEvent(e: React.KeyboardEvent): boolean {
  return typeof e.getModifierState === 'function' && e.getModifierState('CapsLock');
}

export function LoginScreen() {
  const { login, completeMfa, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  /*
    Le défi de la seconde étape.

    Gardé en état local et JAMAIS écrit dans localStorage : ce n'est pas une
    session, il ne survit pas volontairement à un rechargement. Perdre un défi
    coûte une saisie de mot de passe ; le persister en ferait un objet
    ramassable sur un poste partagé.
  */
  const [challenge, setChallenge] = useState<{ challenge: string; email: string } | null>(null);
  const [code, setCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);

  if (isAuthenticated && phase !== 'success') {
    const state = location.state as LocationState | null;
    const redirectTo = state?.from?.pathname ?? '/';
    return <Navigate to={redirectTo} replace />;
  }

  const isSubmitting = phase === 'submitting';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Veuillez renseigner votre email et votre mot de passe.');
      return;
    }

    setPhase('submitting');
    try {
      const outcome = await login(email, password);
      if (outcome.kind === 'mfa') {
        // Second facteur dû : on reste sur cet écran, sans session ouverte.
        setChallenge({ challenge: outcome.challenge, email: outcome.email });
        setPhase('idle');
        return;
      }
      // Clean sequence: validated → brief fade → home (+ Welcome overlay).
      setPhase('success');
      window.setTimeout(() => navigate('/', { replace: true }), 480);
    } catch (err) {
      setPhase('idle');
      setError(
        err instanceof Error
          ? err.message
          : 'Une erreur est survenue lors de la connexion.',
      );
    }
  };

  const submitCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!challenge) return;
    setError(null);
    setPhase('submitting');
    try {
      await completeMfa({
        challenge: challenge.challenge,
        ...(useBackup ? { backupCode: code.trim() } : { code: code.trim() }),
      });
      setPhase('success');
      window.setTimeout(() => navigate('/', { replace: true }), 480);
    } catch (err) {
      setPhase('idle');
      setCode('');
      setError(err instanceof Error ? err.message : 'Code invalide.');
    }
  };

  const leaving = phase === 'success';

  return (
    <motion.div
      animate={{ opacity: leaving ? 0 : 1, scale: leaving ? 0.98 : 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex min-h-screen flex-col items-center justify-center px-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="mb-7 flex justify-center"
      >
        <Logo height={52} showTagline showAppName />
      </motion.div>
      {/*
        Seconde étape : le formulaire du code REMPLACE celui du mot de passe.

        Remplacer plutôt qu'ajouter en dessous : garder les champs de mot de
        passe à l'écran laisserait croire qu'il faut les resaisir, et laisserait
        surtout un mot de passe en clair dans un champ pendant qu'on cherche
        son téléphone.
      */}
      {challenge ? (
        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          onSubmit={submitCode}
          noValidate
          aria-label="Double authentification"
          className="w-[340px] border border-border bg-surface"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-2.5">
            <span className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
              Double authentification
            </span>
            <ShieldCheck size={13} strokeWidth={2} className="text-success" />
          </div>

          <div className="flex flex-col gap-4 p-6">
            <p className="text-xs leading-relaxed text-text-secondary">
              {useBackup
                ? 'Saisissez l’un de vos codes de secours. Il ne servira qu’une fois.'
                : 'Ouvrez votre application d’authentification et saisissez le code à six chiffres.'}
              <span className="mt-1 block font-mono text-[10px] text-text-muted">
                {challenge.email}
              </span>
            </p>

            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
                {useBackup ? 'Code de secours' : 'Code à six chiffres'}
              </span>
              <input
                // `one-time-code` : c'est ce qui déclenche la proposition
                // automatique du code reçu sur iOS et Android.
                autoComplete="one-time-code"
                inputMode={useBackup ? 'text' : 'numeric'}
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={useBackup ? 'XXXX-XXXX' : '000000'}
                maxLength={useBackup ? 9 : 7}
                className="input-focus min-h-11 w-full border border-border bg-bg px-3 text-center font-mono text-lg tracking-[0.3em] text-text-primary outline-none"
              />
            </label>

            {error && (
              <p role="alert" className="text-xs leading-relaxed text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={phase === 'submitting' || code.trim().length < 6}
              className="flex min-h-11 items-center justify-center gap-2 bg-accent text-sm font-semibold text-bg transition-colors hover:bg-accent-hover disabled:opacity-40"
            >
              {phase === 'submitting' ? 'Vérification…' : 'Valider'}
            </button>

            <button
              type="button"
              onClick={() => {
                setUseBackup((v) => !v);
                setCode('');
                setError(null);
              }}
              className="min-h-11 font-mono text-[10px] uppercase tracking-widest text-text-muted transition-colors hover:text-text-secondary md:min-h-0"
            >
              {useBackup ? 'Utiliser l’application' : 'Utiliser un code de secours'}
            </button>
          </div>
        </motion.form>
      ) : (
      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08, ease: 'easeOut' }}
        onSubmit={handleSubmit}
        noValidate
        className="w-[340px] border border-border bg-surface"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-2.5">
          <span className="font-mono text-[11px] uppercase tracking-widest text-text-secondary">
            Console d’accès
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
        </div>

        <div className="flex flex-col gap-4 p-6">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Identifiant
            </span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              required
              className="input-focus border border-border bg-bg px-3 py-2.5 font-mono text-sm text-text-primary outline-none"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
              Mot de passe
            </span>
            <div className="input-focus relative flex items-center border border-border bg-bg focus-within:border-border-strong focus-within:shadow-[0_0_0_3px_rgba(255,255,255,0.1)]">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => setCapsLock(capsFromEvent(e))}
                onKeyUp={(e) => setCapsLock(capsFromEvent(e))}
                disabled={isSubmitting}
                required
                className="flex-1 bg-transparent px-3 py-2.5 font-mono text-sm text-text-primary outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                className="flex h-full items-center px-3 text-text-muted transition-colors hover:text-text-secondary"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {capsLock && (
              <motion.span
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-mono text-[10px] uppercase tracking-widest text-warning"
              >
                Verr. Maj activé
              </motion.span>
            )}
          </label>

          {error && (
            <p
              role="alert"
              className="border border-danger/40 bg-danger-muted px-3 py-2 font-mono text-xs text-danger"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || leaving}
            className="mt-1 flex items-center justify-center gap-2 bg-accent px-3 py-2.5 text-sm font-semibold text-bg transition-colors duration-200 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {(isSubmitting || leaving) && <Loader2 size={15} className="animate-spin" />}
            {leaving ? 'Bienvenue…' : isSubmitting ? 'Vérification…' : 'Se connecter'}
          </button>
        </div>
      </motion.form>
      )}
      <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-text-muted">
        {IS_BUSINESS ? `${EDITION_PRODUCT_NAME} · Espace de travail` : 'AMN DevSec · Centre de supervision'}
      </p>
    </motion.div>
  );
}
