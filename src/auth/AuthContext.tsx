import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { bridge } from '../lib/bridge';
import { cleanErrorMessage } from '../lib/errorMessage';
import { IS_BUSINESS } from '../edition/edition';
import type { OrgIdentity, RemoteSession, User } from '../shared/api';

const AUTH_STORAGE_KEY = 'amn-desktop.auth.user';
const SESSION_STORAGE_KEY = 'amn-desktop.auth.session';

/**
 * Qui est connecté, et POUR QUELLE ORGANISATION.
 *
 * Deux chemins d'authentification cohabitent, dans cet ordre :
 *
 *   1. **amn-api** (`/v1/auth/login`) — le vrai. Il rend une session nominative
 *      qui porte l'organisation ; toutes les requêtes et la WebSocket passent
 *      ensuite par ce jeton, donc les données visibles sont, par construction,
 *      celles de cette organisation et d'aucune autre.
 *   2. **Compte local** (SQLite + bcrypt) — le mode historique d'Aaron et
 *      Mohamed, conservé pour qu'un poste interne continue de fonctionner si
 *      amn-api est injoignable. Il n'existe PAS dans l'édition Business : une
 *      installation cliente n'a ni comptes locaux ni jeton opérateur, donc
 *      aucun moyen d'atteindre des données sans passer par son propre compte.
 *
 * Le jeton de session est conservé en `localStorage`. C'est le justificatif de
 * l'utilisatrice elle-même — pas un secret de build comme le jeton opérateur —
 * et le process main s'en sert pour parler à amn-api (voir remoteConfig.ts).
 */

interface StoredSession {
  token: string;
  user: User;
  org: OrgIdentity;
}

interface AuthContextValue {
  user: User | null;
  /** Organisation amn-api de la session. `null` sur une connexion locale interne. */
  org: OrgIdentity | null;
  isAuthenticated: boolean;
  /**
   * Vrai tant que la session stockée n'a pas été revalidée auprès d'amn-api.
   * L'app attend : monter la synchro avant de savoir pour quelle organisation
   * elle tourne, c'est afficher un espace de travail vide puis le remplacer.
   */
  bootstrapping: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Nom affichable par défaut, tiré de l'adresse — remplaçable dans Paramètres. */
function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email;
  const cleaned = local.replace(/[._-]+/g, ' ').trim();
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : email;
}

function userFromSession(session: RemoteSession): User {
  return { id: 0, email: session.user.email, name: nameFromEmail(session.user.email) };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const stored = useMemo(() => read<StoredSession>(SESSION_STORAGE_KEY), []);
  const [user, setUser] = useState<User | null>(
    () => stored?.user ?? read<User>(AUTH_STORAGE_KEY),
  );
  const [org, setOrg] = useState<OrgIdentity | null>(() => stored?.org ?? null);
  const [bootstrapping, setBootstrapping] = useState(() => Boolean(stored?.token));

  // Revalidation au démarrage. Une session expirée, un compte suspendu ou une
  // organisation suspendue ramènent à l'écran de connexion tout de suite,
  // plutôt que d'ouvrir un espace de travail qui échouerait appel par appel.
  useEffect(() => {
    if (!stored?.token) return;
    let active = true;
    (async () => {
      const session = await bridge().remote.session.restore(stored.token).catch(() => null);
      if (!active) return;
      if (session) {
        setUser(userFromSession(session));
        setOrg(session.org);
      } else {
        window.localStorage.removeItem(SESSION_STORAGE_KEY);
        setUser(null);
        setOrg(null);
      }
      setBootstrapping(false);
    })();
    return () => {
      active = false;
    };
  }, [stored]);

  const login = useCallback(async (email: string, password: string) => {
    let remoteError: Error | null = null;
    try {
      const session = await bridge().remote.session.login(email, password);

      // Garde-fou d'édition. Un build interne embarque les produits exclusifs
      // d'AMN DevSec : une organisation cliente n'a rien à y faire, même avec
      // des identifiants valides. L'inverse est permis — Aaron peut ouvrir
      // AMN Business avec son propre compte pour vérifier ce que voit sa
      // cliente.
      if (!IS_BUSINESS && session.org.plan !== 'internal') {
        await bridge().remote.session.clear().catch(() => undefined);
        throw new Error(
          'Ce compte appartient à une organisation cliente. Utilisez l’application AMN Business.',
        );
      }

      const nextUser = userFromSession(session);
      const toStore: StoredSession = { token: session.token, user: nextUser, org: session.org };
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(toStore));
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
      setUser(nextUser);
      setOrg(session.org);
      return;
    } catch (err) {
      remoteError = new Error(cleanErrorMessage(err, 'Échec de la connexion.'));
      // Le refus d'édition ci-dessus n'est pas un « essayez autre chose » : il
      // ne doit pas retomber sur un compte local du même poste.
      if (remoteError.message.startsWith('Ce compte appartient')) throw remoteError;
    }

    // Repli local, édition interne seulement.
    if (IS_BUSINESS) throw remoteError;

    const result = await bridge().auth.login(email, password);
    if (!result.ok || !result.user) {
      throw new Error(result.error ?? remoteError?.message ?? 'Échec de la connexion.');
    }
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(result.user));
    setUser(result.user);
    setOrg(null);
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    // Les miroirs de collections sont indexés par poste, pas par organisation :
    // les laisser en place ferait apparaître les données du compte précédent
    // pendant la première seconde du suivant. On les efface à la déconnexion.
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('amn.sync.')) window.localStorage.removeItem(key);
    }
    void bridge().remote.session.clear().catch(() => undefined);
    setUser(null);
    setOrg(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      org,
      isAuthenticated: user !== null,
      bootstrapping,
      login,
      logout,
    }),
    [user, org, bootstrapping, login, logout],
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
