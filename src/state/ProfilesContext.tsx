import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { bridge } from '../lib/bridge';
import type { UpdateProfileInput, UserProfile } from '../shared/api';

interface ProfilesContextValue {
  profiles: UserProfile[];
  /** Profile for an email, or a name-only fallback if not loaded yet. */
  profileFor: (email: string) => UserProfile;
  updateSelf: (email: string, patch: UpdateProfileInput) => Promise<UserProfile>;
  refresh: () => Promise<void>;
}

const ProfilesContext = createContext<ProfilesContextValue | undefined>(undefined);

function fallbackProfile(email: string): UserProfile {
  return { email, name: email.split('@')[0], photoDataUrl: '', presenceText: '', updatedAt: '' };
}

export function ProfilesProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);

  const refresh = useCallback(async () => {
    try {
      setProfiles(await bridge().profiles.list());
    } catch {
      /* keep whatever we have */
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const profileFor = useCallback(
    (email: string) => {
      const key = email.trim().toLowerCase();
      return profiles.find((p) => p.email === key) ?? fallbackProfile(key);
    },
    [profiles],
  );

  const updateSelf = useCallback(async (email: string, patch: UpdateProfileInput) => {
    const updated = await bridge().profiles.updateSelf(email, patch);
    setProfiles((prev) => {
      const exists = prev.some((p) => p.email === updated.email);
      return exists ? prev.map((p) => (p.email === updated.email ? updated : p)) : [...prev, updated];
    });
    return updated;
  }, []);

  const value = useMemo(
    () => ({ profiles, profileFor, updateSelf, refresh }),
    [profiles, profileFor, updateSelf, refresh],
  );

  return <ProfilesContext.Provider value={value}>{children}</ProfilesContext.Provider>;
}

export function useProfiles(): ProfilesContextValue {
  const ctx = useContext(ProfilesContext);
  if (!ctx) throw new Error('useProfiles must be used within a ProfilesProvider');
  return ctx;
}
