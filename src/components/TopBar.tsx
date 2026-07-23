import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useCommandPalette } from './command-palette/CommandPalette';
import { NotificationCenter } from './NotificationCenter';

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
  const modKey = useModifierKey();

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/70 bg-bg/70 px-8 py-3 backdrop-blur-md">
      <button
        type="button"
        onClick={open}
        className="input-focus group flex flex-1 items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-muted transition-colors duration-200 hover:border-white/15 md:max-w-xs"
      >
        <Search size={15} strokeWidth={1.75} />
        <span className="flex-1 text-left">Rechercher…</span>
        <kbd className="flex items-center gap-0.5 rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
          {modKey} K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <NotificationCenter />
      </div>
    </header>
  );
}
