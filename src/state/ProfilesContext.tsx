import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useSync, useCollection } from './SyncContext';
import { useClientView } from './ClientViewContext';
import type { UpdateProfileInput, UserProfile } from '../shared/api';

/**
 * Operator profiles (name, photo, custom presence text). Backed by the synced
 * `profiles` collection so a photo one operator uploads is visible to the other
 * everywhere (messages, tasks, decisions, presence, account). Keyed by email.
 */

interface ProfileData {
  name: string;
  photoDataUrl: string;
  presenceText: string;
  /**
   * ISO timestamp of the last time this operator opened the Équipe tab.
   * Shared (it lives on the synced profile) so the OTHER operator can tell
   * whether their messages have been read — the read-receipt signal (A3.1).
   */
  teamSeenAt?: string;
}

interface ProfilesContextValue {
  profiles: UserProfile[];
  profileFor: (email: string) => UserProfile;
  updateSelf: (email: string, patch: UpdateProfileInput) => Promise<void>;
  /** Marks the Équipe tab as read now for this operator (read receipts). */
  markTeamSeen: (email: string) => void;
  /** When the given operator last opened the Équipe tab, or null if never. */
  teamSeenAt: (email: string) => string | null;
}

const ProfilesContext = createContext<ProfilesContextValue | undefined>(undefined);

function titleCase(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Normalises any value that is *supposed* to be an operator email.
 *
 * Deliberately total: `profileFor(task.assigneeEmail)` is called from a dozen
 * screens, and a single record with a missing author — a task synced before
 * the field existed, an import, a half-written row — used to throw on
 * `.trim()` and take the whole screen down through the error boundary. One
 * incomplete row must never cost the operator an entire tab.
 */
function normaliseEmail(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function fallbackProfile(email: string): UserProfile {
  return {
    email,
    // An empty key means the record never named anyone — say so rather than
    // rendering a blank avatar with no name.
    name: email ? titleCase(email.split('@')[0] || email) : 'Non attribué',
    photoDataUrl: '',
    presenceText: '',
    updatedAt: '',
  };
}

export function ProfilesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { upsert, ready, configured, pullFailed } = useSync();
  const records = useCollection<ProfileData>('profiles');

  const profiles = useMemo<UserProfile[]>(
    () =>
      records.map((r) => ({
        email: r.id,
        name: r.name || titleCase(r.id.split('@')[0]),
        photoDataUrl: r.photoDataUrl || '',
        presenceText: r.presenceText || '',
        updatedAt: r.updatedAt,
      })),
    [records],
  );

  // Seed only *your own* profile if it doesn't exist yet — never overwrite the
  // other operator's row, so their photo is never clobbered by a default.
  //
  // Guarded on `!pullFailed`: a transient amn-api hiccup during the initial
  // pull can leave `records` empty in memory even though the profile — with a
  // real photo — exists on the server. Seeding in that window used to upsert
  // a blank profile straight over the real one, permanently wiping the photo
  // (last-writer-wins). Only seed once the pull is confirmed to have
  // succeeded, or when sync isn't configured at all (nothing to pull).
  // Jamais dans le dossier d'une cliente : l'opérateur n'a rien à faire dans sa
  // collection de profils. Sans ce garde-fou, ouvrir son espace y déposait une
  // fiche « Aaron / aaron@amn-devsec.com » — une trace de nous dans ses données,
  // créée par le seul fait de la dépanner.
  const clientView = useClientView();
  useEffect(() => {
    if (clientView) return;
    if (ready && (!configured || !pullFailed) && user && !records.some((r) => r.id === user.email)) {
      upsert('profiles', user.email, { name: user.name, photoDataUrl: '', presenceText: '' });
    }
  }, [clientView, ready, configured, pullFailed, user, records, upsert]);

  const profileFor = useCallback(
    (email: string) => {
      const key = normaliseEmail(email);
      return profiles.find((p) => p.email === key) ?? fallbackProfile(key);
    },
    [profiles],
  );

  // Full existing profile data (preserving fields not in ProfileData's core
  // three, e.g. teamSeenAt) so no patch silently drops the read-receipt marker.
  const baseData = useCallback(
    (key: string): ProfileData => {
      const existing = records.find((r) => r.id === key);
      return existing
        ? {
            name: existing.name,
            photoDataUrl: existing.photoDataUrl,
            presenceText: existing.presenceText,
            teamSeenAt: existing.teamSeenAt,
          }
        : { name: fallbackProfile(key).name, photoDataUrl: '', presenceText: '' };
    },
    [records],
  );

  const updateSelf = useCallback(
    async (email: string, patch: UpdateProfileInput) => {
      const key = normaliseEmail(email);
      if (!key) return; // nothing to update without an identity
      await upsert('profiles', key, { ...baseData(key), ...patch });
    },
    [baseData, upsert],
  );

  const markTeamSeen = useCallback(
    (email: string) => {
      const key = normaliseEmail(email);
      if (!key) return;
      void upsert('profiles', key, { ...baseData(key), teamSeenAt: new Date().toISOString() });
    },
    [baseData, upsert],
  );

  const teamSeenAt = useCallback(
    (email: string): string | null => {
      const key = normaliseEmail(email);
      if (!key) return null;
      return records.find((r) => r.id === key)?.teamSeenAt ?? null;
    },
    [records],
  );

  const value = useMemo(
    () => ({ profiles, profileFor, updateSelf, markTeamSeen, teamSeenAt }),
    [profiles, profileFor, updateSelf, markTeamSeen, teamSeenAt],
  );

  return <ProfilesContext.Provider value={value}>{children}</ProfilesContext.Provider>;
}

export function useProfiles(): ProfilesContextValue {
  const ctx = useContext(ProfilesContext);
  if (!ctx) throw new Error('useProfiles must be used within a ProfilesProvider');
  return ctx;
}
