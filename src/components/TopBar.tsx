import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Sparkles } from 'lucide-react';
import { useCommandPalette } from './command-palette/CommandPalette';
import { NotificationCenter } from './NotificationCenter';
import { HelpButton } from './HelpOverlay';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { UserAvatar } from './UserAvatar';
import { useAssistant } from '../assistant/AssistantContext';
import { useAuth } from '../auth/AuthContext';
import { useProfiles } from '../state/ProfilesContext';

/** Detects the platform once so we can show ⌘ on macOS and Ctrl elsewhere. */
function useModifierKey(): string {
  const [key, setKey] = useState('Ctrl');
  useEffect(() => {
    const isMac = /mac/i.test(navigator.platform || navigator.userAgent);
    setKey(isMac ? '⌘' : 'Ctrl');
  }, []);
  return key;
}

export function TopBar() {
  const { open } = useCommandPalette();
  const { open: openAssistant } = useAssistant();
  const { user } = useAuth();
  const { profileFor } = useProfiles();
  const navigate = useNavigate();
  const modKey = useModifierKey();

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-bg/80 px-8 py-3 backdrop-blur-md">
      <button
        type="button"
        onClick={open}
        className="input-focus group flex flex-1 items-center gap-2.5 border border-border bg-surface px-3 py-2 text-sm text-text-muted transition-colors duration-200 hover:border-border-strong md:max-w-xs"
      >
        <Search size={15} strokeWidth={1.75} />
        <span className="flex-1 text-left">Rechercher…</span>
        <kbd className="flex items-center gap-0.5 border border-border px-1.5 py-0.5 font-mono text-[10px] font-medium text-text-secondary">
          {modKey} K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <SyncStatusIndicator />
        <button
          type="button"
          onClick={openAssistant}
          className="flex h-9 items-center gap-2 border border-border-strong bg-surface px-3 text-sm font-medium text-text-primary transition-colors duration-200 hover:bg-surface-hover"
        >
          <Sparkles size={16} strokeWidth={1.75} />
          <span className="hidden sm:inline">Assistant</span>
        </button>
        <HelpButton />
        <NotificationCenter />
        {user && (
          <button
            type="button"
            onClick={() => navigate('/settings')}
            title={`${profileFor(user.email).name} — ouvrir les paramètres`}
            aria-label="Mon profil"
            className="ml-1 rounded-full transition-opacity hover:opacity-80"
          >
            <UserAvatar email={user.email} size={32} ring />
          </button>
        )}
      </div>
    </header>
  );
}
