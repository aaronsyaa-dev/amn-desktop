import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

const AUTH_STORAGE_KEY = 'amn-desktop.auth.user';

interface AuthUser {
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser(): AuthUser | null {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

/**
 * Simulates an authentication API call. Any well-formed email combined with
 * a password of at least 6 characters is accepted; this stands in for a
 * real backend until one is wired up.
 */
function mockAuthenticate(email: string, password: string): Promise<AuthUser> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const isValidEmail = /^\S+@\S+\.\S+$/.test(email);
      if (!isValidEmail || password.length < 6) {
        reject(new Error('Email ou mot de passe invalide.'));
        return;
      }
      resolve({ email });
    }, 600);
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());

  const login = useCallback(async (email: string, password: string) => {
    const authenticatedUser = await mockAuthenticate(email, password);
    window.localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify(authenticatedUser),
    );
    setUser(authenticatedUser);
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
