import React, { useEffect, useState } from 'react';
import { Hourglass } from 'lucide-react';
import { useAuth } from './AuthContext';
import type { GuestQuotaState } from '../shared/api';

/**
 * L'écran d'un invité qui a épuisé son temps du jour (BLOC D).
 *
 * Il occupe tout l'écran plutôt que de s'insérer dans l'application, et c'est
 * volontaire : le compte n'est pas dégradé, il est fermé jusqu'à demain.
 * Laisser l'interface derrière donnerait une application qui a l'air de
 * fonctionner mais dont chaque geste échoue — la pire des deux situations, et
 * exactement ce qu'on a corrigé pour la session locale.
 *
 * Trois choses doivent y figurer, et rien d'autre :
 *   - que ce n'est pas une panne ;
 *   - combien de temps l'accès dure par jour, pour que le quota soit une
 *     règle connue et non une surprise ;
 *   - QUAND ça rouvre, à l'heure de l'organisation — un blocage qui ne dit pas
 *     jusqu'à quand se lit comme un bug.
 *
 * Le bouton « Se déconnecter » est le seul geste offert : il n'y a rien à
 * réessayer, et le proposer ferait mentir l'écran.
 */
export function GuestQuotaGate({ quota }: { quota: GuestQuotaState }) {
  const { user, logout } = useAuth();

  // Compte à rebours vivant : à minuit, l'écran doit disparaître de lui-même
  // plutôt que d'attendre qu'on pense à recharger l'application.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const resetsAtMs = Date.parse(quota.resetsAt);
  const remainingMs = Number.isFinite(resetsAtMs) ? resetsAtMs - now : Number.NaN;

  const reopening = Number.isFinite(resetsAtMs)
    ? new Date(resetsAtMs).toLocaleString('fr-FR', {
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const countdown = (() => {
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) return null;
    const hours = Math.floor(remainingMs / 3_600_000);
    const minutes = Math.max(1, Math.round((remainingMs % 3_600_000) / 60_000));
    return hours > 0 ? `${hours} h ${String(minutes).padStart(2, '0')}` : `${minutes} min`;
  })();

  return (
    <div
      role="alert"
      className="flex h-[100dvh] flex-col items-center justify-center bg-bg px-6 text-center"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="w-full max-w-sm">
        <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center border border-border-strong">
          <Hourglass size={20} strokeWidth={1.75} className="text-text-secondary" />
        </span>

        <h1 className="text-xl font-bold tracking-tight text-text-primary">
          Temps d’accès du jour épuisé
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-text-secondary">
          Cet accès invité est limité à{' '}
          <strong className="font-semibold text-text-primary">
            {quota.minutesPerDay > 0 ? `${quota.minutesPerDay} minutes` : 'une durée'} par jour
          </strong>
          . Ce n’est pas une panne : vos données sont intactes et vous les retrouverez à la
          réouverture.
        </p>

        <div className="mt-6 border border-border bg-surface px-4 py-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
            Réouverture
          </p>
          <p className="mt-1 text-sm font-semibold text-text-primary">
            {reopening ? reopening : 'Demain'}
          </p>
          {countdown && (
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-text-muted">
              dans {countdown}
            </p>
          )}
        </div>

        <p className="mt-5 text-xs leading-relaxed text-text-muted">
          Besoin d’un accès permanent ? Demandez à{' '}
          {/* Pas de nom d'éditeur ici : dans l'édition Business, l'invité est
              l'invité d'une CLIENTE, et c'est elle qu'il doit contacter. */}
          l’administrateur de votre organisation de vous ouvrir un compte complet.
        </p>

        <button
          type="button"
          onClick={logout}
          className="mt-6 min-h-11 w-full border border-border-strong px-4 text-xs uppercase tracking-wider text-text-primary transition-colors hover:bg-surface-hover"
        >
          Se déconnecter
        </button>

        {user?.email && (
          <p className="mt-3 truncate font-mono text-[10px] uppercase tracking-widest text-text-muted">
            {user.email}
          </p>
        )}
      </div>
    </div>
  );
}
