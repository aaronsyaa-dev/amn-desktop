import React from 'react';
import { useProfiles } from '../state/ProfilesContext';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Renders a user's real profile photo (shared across both operators via the
 * profiles store) with an initials fallback. Single source of truth for how a
 * person is shown — used in messages, tasks, decisions, presence, sidebar.
 */
export function UserAvatar({
  email,
  size = 32,
  className = '',
  ring = false,
}: {
  email: string;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const { profileFor } = useProfiles();
  const profile = profileFor(email);
  const ringClass = ring ? 'ring-2 ring-border-strong' : '';

  if (profile.photoDataUrl) {
    return (
      <img
        src={profile.photoDataUrl}
        alt={profile.name}
        style={{ width: size, height: size }}
        className={`flex-shrink-0 rounded-full object-cover ${ringClass} ${className}`}
      />
    );
  }

  return (
    <span
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.36)) }}
      className={`flex flex-shrink-0 items-center justify-center rounded-full bg-accent-muted font-semibold text-accent ${ringClass} ${className}`}
    >
      {initials(profile.name)}
    </span>
  );
}
