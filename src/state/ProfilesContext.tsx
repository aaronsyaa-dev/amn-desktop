import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useSync, useCollection } from './SyncContext';
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
}

interface ProfilesContextValue {
  profiles: UserProfile[];
  profileFor: (email: string) => UserProfile;
  updateSelf: (email: string, patch: UpdateProfileInput) => Promise<void>;
}

const ProfilesContext = createContext<ProfilesContextValue | undefined>(undefined);

function titleCase(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function fallbackProfile(email: string): UserProfile {
  return {
    email,
    name: titleCase(email.split('@')[0] || email),
    photoDataUrl: '',
    presenceText: '',
    updatedAt: '',
  };
}

export function ProfilesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { upsert, ready } = useSync();
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
  useEffect(() => {
    if (ready && user && !records.some((r) => r.id === user.email)) {
      upsert('profiles', user.email, { name: user.name, photoDataUrl: '', presenceText: '' });
    }
  }, [ready, user, records, upsert]);

  const profileFor = useCallback(
    (email: string) => {
      const key = email.trim().toLowerCase();
      return profiles.find((p) => p.email === key) ?? fallbackProfile(key);
    },
    [profiles],
  );

  const updateSelf = useCallback(
    async (email: string, patch: UpdateProfileInput) => {
      const key = email.trim().toLowerCase();
      const existing = records.find((r) => r.id === key);
      const base: ProfileData = existing
        ? { name: existing.name, photoDataUrl: existing.photoDataUrl, presenceText: existing.presenceText }
        : { name: fallbackProfile(key).name, photoDataUrl: '', presenceText: '' };
      await upsert('profiles', key, { ...base, ...patch });
    },
    [records, upsert],
  );

  const value = useMemo(
    () => ({ profiles, profileFor, updateSelf }),
    [profiles, profileFor, updateSelf],
  );

  return <ProfilesContext.Provider value={value}>{children}</ProfilesContext.Provider>;
}

export function useProfiles(): ProfilesContextValue {
  const ctx = useContext(ProfilesContext);
  if (!ctx) throw new Error('useProfiles must be used within a ProfilesProvider');
  return ctx;
}
