import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { UserAvatar } from '../components/UserAvatar';
import { SyncStatusIndicator } from '../components/SyncStatusIndicator';

/**
 * Barre haute de l'édition Business.
 *
 * Volontairement plus courte que l'interne : ni centre de notifications de
 * parc, ni bouton d'assistant. Ce qui reste est ce qui sert quand on travaille
 * seul — l'état de synchronisation (« mes données sont-elles bien remontées ? »),
 * le nom de l'organisation, et l'accès aux paramètres.
 */
export function BusinessTopBar({ onMenu }: { onMenu: () => void }) {
  const { user, org } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur sm:px-8">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Ouvrir le menu"
        className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary md:hidden"
      >
        <Menu size={18} strokeWidth={1.75} />
      </button>

      <span className="truncate font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
        {org?.name ?? 'AMN Business'}
      </span>

      <div className="ml-auto flex items-center gap-2">
        <SyncStatusIndicator />
        <button
          type="button"
          onClick={() => navigate('/settings')}
          aria-label="Paramètres du compte"
          className="rounded-full transition-opacity hover:opacity-80"
        >
          <UserAvatar email={user?.email ?? ''} size={28} />
        </button>
      </div>
    </header>
  );
}
