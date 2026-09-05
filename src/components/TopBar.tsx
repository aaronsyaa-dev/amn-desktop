import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search, Sparkles } from 'lucide-react';
import { useCommandPalette } from './command-palette/CommandPalette';
import { NotificationCenter } from './NotificationCenter';
import { HelpButton } from './HelpOverlay';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { OrgSwitchButton } from './org-rail/OrgSwitchButton';
import { UserAvatar } from './UserAvatar';
import { useAssistant } from '../assistant/AssistantContext';
import { GardeBadge } from './garde/GardeBadge';
import { useAuth } from '../auth/AuthContext';
import { useProfiles } from '../state/ProfilesContext';
import { useLangue } from '../i18n';

/** Detects the platform once so we can show ⌘ on macOS and Ctrl elsewhere. */
function useModifierKey(): string {
  const [key, setKey] = useState('Ctrl');
  useEffect(() => {
    const isMac = /mac/i.test(navigator.platform || navigator.userAgent);
    setKey(isMac ? '⌘' : 'Ctrl');
  }, []);
  return key;
}

export function TopBar({ onMenu }: { onMenu?: () => void }) {
  const { open } = useCommandPalette();
  const { open: openAssistant } = useAssistant();
  const { user } = useAuth();
  const { profileFor } = useProfiles();
  const navigate = useNavigate();
  const modKey = useModifierKey();
  const { t } = useLangue();

  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-bg/80 px-4 py-3 backdrop-blur-md sm:gap-3 md:px-8">
      {/* Mobile: hamburger opens the nav drawer (< md only). */}
      <button
        type="button"
        onClick={onMenu}
        aria-label={t('chrome.ouvrirMenu')}
        // 44 px sous `md` : c'est le minimum atteignable au pouce sans viser.
        // Repasse à 36 px dès le bureau, où le pointeur est précis — la taille
        // mobile y paraîtrait grossière.
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary transition-colors hover:text-text-primary md:hidden"
      >
        <Menu size={18} strokeWidth={1.75} />
      </button>

      {/* Mobile : l'organisation active, en permanence et sans rien ouvrir.
          Sur bureau c'est le rail qui le dit ; sous `md` le rail est masqué, et
          jusqu'ici il fallait ouvrir le tiroir pour savoir chez qui on
          travaille — inacceptable quand on peut être dans le dossier d'une
          cliente. Le bandeau de contexte client reste au-dessus, non masquable :
          celui-ci ne le remplace pas, il couvre le cas « je suis chez moi ». */}
      <MobileActiveOrg />

      {/*
        LE SÉLECTEUR D'ORGANISATION, NOMMÉ (BLOC D).

        Il n'existait sur bureau QUE dans le rail : une colonne de 72 px
        d'avatars ronds, sans un mot, dont le libellé n'apparaît qu'au survol.
        Aaron ne l'a pas trouvé en usage réel, et c'est un échec de
        découvrabilité, pas d'attention : une icône sans texte n'est trouvable
        que par quelqu'un qui sait déjà qu'elle existe.

        Il est donc AUSSI ici, en toutes lettres, à l'endroit où l'on regarde
        pour savoir « où suis-je » — en tête de la barre du haut. Le rail reste
        le chemin rapide pour qui le connaît ; celui-ci est le chemin
        découvrable. Ce n'est pas une décoration ajoutée : c'est le même geste,
        rendu nommable.
      */}
      <OrgSwitchButton className="hidden md:flex" />

      {/* Desktop: full search field with Ctrl/⌘ K hint. */}
      <button
        type="button"
        onClick={open}
        className="input-focus group hidden flex-1 items-center gap-2.5 border border-border bg-surface px-3 py-2 text-sm text-text-muted transition-colors duration-200 hover:border-border-strong md:flex md:max-w-xs"
      >
        <Search size={15} strokeWidth={1.75} />
        <span className="flex-1 text-left">{t('chrome.rechercher')}</span>
        <kbd className="flex items-center gap-0.5 border border-border px-1.5 py-0.5 font-mono text-[10px] font-medium text-text-secondary">
          {modKey} K
        </kbd>
      </button>

      {/* Mobile: search collapses to a loupe icon that opens the full-screen palette. */}
      <button
        type="button"
        onClick={open}
        aria-label={t('chrome.rechercher')}
        className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-text-secondary transition-colors hover:text-text-primary md:hidden"
      >
        <Search size={17} strokeWidth={1.75} />
      </button>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <SyncStatusIndicator />
        {/* L'insigne de la Garde (Bloc 9) : le pouls, qui est en ronde, chez qui — un clic vers la Salle. */}
        <GardeBadge />
        <button
          type="button"
          onClick={() => openAssistant()}
          className="flex h-11 items-center gap-2 border border-border-strong bg-surface px-3 text-sm font-medium text-text-primary transition-colors duration-200 hover:bg-surface-hover md:h-9"
        >
          <Sparkles size={16} strokeWidth={1.75} />
          <span className="hidden sm:inline">Ajmani</span>
        </button>
        <span className="hidden sm:flex">
          <HelpButton />
        </span>
        <NotificationCenter />
        {user && (
          <button
            type="button"
            onClick={() => navigate('/settings')}
            title={`${profileFor(user.email).name} — ouvrir les paramètres`}
            aria-label={t('chrome.monProfil')}
            // L'avatar reste à 32 px (c'est une image, pas une icône), mais sa
            // zone cliquable est portée à 44 px sur mobile par le padding.
            className="ml-1 flex h-11 w-11 items-center justify-center rounded-full transition-opacity hover:opacity-80 md:h-8 md:w-8"
          >
            <UserAvatar email={user.email} size={32} ring />
          </button>
        )}
      </div>
    </header>
  );
}

/**
 * Le nom de l'organisation courante, sur téléphone uniquement.
 *
 * Lit `useAuth().org`, qui vaut déjà l'organisation SUBSTITUÉE quand un
 * contexte client est ouvert (voir AuthContext) : une seule source, donc
 * impossible d'afficher « AMN DevSec » pendant qu'on travaille chez une
 * cliente.
 */
function MobileActiveOrg() {
  const { org } = useAuth();
  const name = org?.name ?? 'AMN DevSec';
  return (
    <span
      className="min-w-0 flex-1 truncate font-mono text-[11px] uppercase tracking-[0.15em] text-text-secondary md:hidden"
      title={name}
    >
      {name}
    </span>
  );
}
