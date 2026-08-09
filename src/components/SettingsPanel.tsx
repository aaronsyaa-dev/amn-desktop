import React from 'react';

/**
 * Encadré d'une section de réglages : icône, titre, sous-titre, contenu.
 *
 * Extrait de `SettingsScreen` parce que la section Ollama, elle, a dû sortir de
 * l'écran (elle n'existe que dans l'édition interne — voir `@edition/exclusive`)
 * et devait continuer à ressembler exactement aux autres.
 */
export function SettingsPanel({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border bg-surface">
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-3.5">
        <Icon size={16} strokeWidth={1.75} className="text-text-secondary" />
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          <p className="text-xs text-text-muted">{subtitle}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
