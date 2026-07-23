import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { bridge } from '../lib/bridge';
import type { User } from '../shared/api';

const AUTH_STORAGE_KEY = 'amn-desktop.auth.user';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  /** Verifies credentials via the bridge (SQLite in Electron, bcrypt fallback in browser). */
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): User | null {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => readStoredUser());

  const login = useCallback(async (email: string, password: string) => {
    const result = await bridge().auth.login(email, password);
    if (!result.ok || !result.user) {
      throw new Error(result.error ?? 'Échec de la connexion.');
    }
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(result.user));
    setUser(result.user);
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAuthenticated: user !== null, login, logout }),
    [user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
