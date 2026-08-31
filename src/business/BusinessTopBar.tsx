import React from 'react';
import { EDITION_PRODUCT_NAME } from '../edition/edition';
import { useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { UserAvatar } from '../components/UserAvatar';
import { SyncStatusIndicator } from '../components/SyncStatusIndicator';
import { useLangue } from '../i18n';

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
  const { t } = useLangue();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur sm:px-8">
      <button
        type="button"
        onClick={onMenu}
        aria-label={t('chrome.ouvrirMenu')}
        // 44 px de côté sur téléphone : la même correction que la barre du
        // haut interne, qui n'avait jamais été portée sur celle-ci.
        className="flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary md:hidden"
      >
        <Menu size={18} strokeWidth={1.75} />
      </button>

      <span className="truncate font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
        {/* Repli sur le nom de l'ÉDITION plutôt qu'une chaîne figée : au
            Bloc 1, la chaîne figée disait encore l'ancien nom. */}
        {org?.name ?? EDITION_PRODUCT_NAME}
      </span>

      <div className="ml-auto flex items-center gap-2">
        <SyncStatusIndicator />
        <button
          type="button"
          onClick={() => navigate('/settings')}
          aria-label={t('chrome.parametresCompte')}
          className="flex h-11 w-11 items-center justify-center rounded-full transition-opacity hover:opacity-80 md:h-9 md:w-9"
        >
          <UserAvatar email={user?.email ?? ''} size={28} />
        </button>
      </div>
    </header>
  );
}
