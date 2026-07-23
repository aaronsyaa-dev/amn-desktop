import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../auth/AuthContext';
import { Logo } from '../components/Logo';

interface LocationState {
  from?: { pathname: string };
}

export function LoginScreen() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isAuthenticated) {
    const state = location.state as LocationState | null;
    const redirectTo = state?.from?.pathname ?? '/';
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Veuillez renseigner votre email et votre mot de passe.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Une erreur est survenue lors de la connexion.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="mb-8 flex justify-center"
      >
        <Logo height={56} showTagline />
      </motion.div>
      <motion.form
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08, ease: 'easeOut' }}
        onSubmit={handleSubmit}
        noValidate
        className="flex w-80 flex-col gap-4 rounded-2xl border border-border bg-surface p-8 shadow-[0_20px_40px_rgba(0,0,0,0.4)]"
      >
        <div className="mb-1 text-center">
          <h1 className="text-lg font-semibold text-text-primary">
            Connexion
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Accédez à votre console de supervision
          </p>
        </div>

        <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSubmitting}
            required
            className="rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text-primary outline-none transition-colors duration-200 focus:border-accent"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-text-secondary">
          <span>Mot de passe</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isSubmitting}
            required
            className="rounded-lg border border-border bg-bg px-3 py-2.5 text-sm text-text-primary outline-none transition-colors duration-200 focus:border-accent"
          />
        </label>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-danger-muted px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-1 rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Connexion en cours…' : 'Se connecter'}
        </button>
      </motion.form>
    </div>
  );
}
