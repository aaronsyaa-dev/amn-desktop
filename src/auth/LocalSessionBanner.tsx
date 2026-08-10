import React from 'react';
import { CloudOff } from 'lucide-react';
import { useAuth } from './AuthContext';

/**
 * Le bandeau permanent d'une session LOCALE (BLOC 0).
 *
 * Il existe à cause d'un bug qui a coûté une soirée : cliquer sur une
 * organisation cliente répondait « Connectez-vous avec votre compte AMN DevSec »
 * à quelqu'un dont les Paramètres affichaient correctement son nom et son
 * adresse. Les deux affirmations étaient vraies. L'application était bien
 * connectée — à un compte SQLite du POSTE, pas à amn-api — et rien, nulle part,
 * ne le disait.
 *
 * La cause structurelle n'est pas le message : c'est qu'un état aussi lourd de
 * conséquences (aucun jeton nominatif, donc aucun dossier client ouvrable,
 * aucune trace au journal d'accès) était invisible partout sauf au moment
 * précis où il bloquait. Une session locale se restaurait en plus à chaque
 * lancement, sans jamais être revalidée : elle pouvait durer des semaines.
 *
 * D'où ce bandeau, sur le même modèle que celui du contexte client : pleine
 * largeur, en haut, sans bouton pour le masquer. Le seul bouton qu'il porte est
 * celui qui répare — se reconnecter.
 */
export function LocalSessionBanner() {
  const { sessionKind, logout } = useAuth();
  if (sessionKind !== 'local') return null;

  return (
    <div
      role="alert"
      // La marge d'encoche est portée par le conteneur de AppLayout : la
      // remettre ici laisserait une bande vide au-dessus du bandeau.
      className="flex flex-shrink-0 items-center gap-2 border-b border-warning/50 bg-warning-muted px-3 py-1.5 sm:gap-3 sm:px-4"
    >
      <CloudOff size={14} strokeWidth={2} className="flex-shrink-0 text-warning" />
      <p className="min-w-0 flex-1 text-xs leading-tight text-text-primary">
        <strong className="font-semibold">Session locale à ce poste</strong>
        <span className="hidden sm:inline">
          {' '}
          — non connectée à amn-api : aucun dossier client ne peut être ouvert.
        </span>
      </p>
      <button
        type="button"
        onClick={logout}
        className="flex-shrink-0 rounded-md border border-border-strong bg-surface px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-text-primary transition-colors hover:bg-surface-hover"
      >
        Se reconnecter
      </button>
    </div>
  );
}
