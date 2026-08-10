import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { bridge } from '../lib/bridge';
import { cleanErrorMessage, isApiUnreachable } from '../lib/errorMessage';
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

/** Voir `AuthContextValue.sessionKind`. */
export type SessionKind = 'api' | 'local' | null;

interface AuthContextValue {
  user: User | null;
  /**
   * L'organisation POUR LAQUELLE l'app travaille en ce moment.
   *
   * Normalement celle de la session. Dans un contexte client, c'est celle de la
   * cliente : `OrgContextProvider` la substitue ici en entrant, et la retire en
   * sortant. La substitution vit à cet endroit précis parce que c'est ce que
   * `org` a toujours voulu dire pour ses lecteurs — le nom affiché en tête de
   * l'accueil, l'émetteur d'un devis imprimé, l'organisation des Paramètres.
   * Sans elle, un devis imprimé depuis le dossier d'une cliente porterait
   * « AMN DevSec » en émetteur, sur un document qu'elle envoie à SES clients.
   *
   * `null` sur une connexion locale interne (repli hors ligne).
   */
  org: OrgIdentity | null;
  /**
   * D'où vient la session : `'api'` (amn-api, nominative) ou `'local'` (repli
   * hors ligne sur un compte SQLite du poste). `null` quand personne n'est
   * connecté.
   *
   * Cette distinction n'était nulle part, et c'est ce qui a coûté le plus cher :
   * une connexion locale a exactement l'allure d'une vraie — même nom, même
   * accueil, même rail — mais le process main n'a alors AUCUN jeton nominatif.
   * Ses appels `/v1/admin/*` repartent donc avec le jeton opérateur partagé,
   * qui n'appartient à personne ; amn-api l'accepte pour lister ou créer une
   * organisation, mais refuse d'ouvrir un contexte client (« Connectez-vous
   * avec votre compte AMN DevSec… ») parce qu'il n'a personne à inscrire au
   * journal d'accès. D'où le message contradictoire : l'opérateur EST connecté,
   * mais pas à amn-api. Cet état a maintenant un nom, et l'interface le dit.
   */
  sessionKind: SessionKind;
  /**
   * Substitue l'organisation courante (contexte client), ou la rend (`null`).
   * Appelé par `OrgContextProvider` ; personne d'autre n'a de raison de le faire.
   */
  overrideOrg: (org: OrgIdentity | null) => void;
  isAuthenticated: boolean;
  /**
   * Vrai tant que la session stockée n'a pas été revalidée auprès d'amn-api.
   * L'app attend : monter la synchro avant de savoir pour quelle organisation
   * elle tourne, c'est afficher un espace de travail vide puis le remplacer.
   */
  bootstrapping: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /**
   * Réinjecte le jeton nominatif stocké dans le process principal, et dit si
   * amn-api le reconnaît encore.
   *
   * Existe pour une désynchronisation précise : le renderer croit avoir une
   * session amn-api (elle est en localStorage, le profil s'affiche) pendant que
   * le process principal, lui, n'a plus de jeton nominatif en mémoire — ses
   * appels repartent alors avec le jeton opérateur PARTAGÉ, et amn-api refuse
   * d'ouvrir un dossier client faute de savoir qui inscrire au journal. Le
   * refus est juste côté serveur et incompréhensible côté opérateur, qui vient
   * précisément de se connecter avec son compte.
   */
  reauthenticate: () => Promise<boolean>;
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
  const [sessionOrg, setOrg] = useState<OrgIdentity | null>(() => stored?.org ?? null);
  // Organisation substituée par un contexte client. Volontairement PAS
  // persistée : elle est reconstruite au démarrage par la revalidation du jeton
  // de support, qui est la seule source qui fasse autorité.
  const [contextOrg, setContextOrg] = useState<OrgIdentity | null>(null);
  const org = contextOrg ?? sessionOrg;
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
    let unreachable: Error | null = null;
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
      const message = cleanErrorMessage(err, 'Échec de la connexion.');
      // Le refus d'édition ci-dessus n'est pas un « essayez autre chose » : il
      // ne doit pas retomber sur un compte local du même poste.
      if (message.startsWith('Ce compte appartient')) throw new Error(message);
      // amn-api A RÉPONDU, et il refuse. Sa phrase est la réponse — « Email ou
      // mot de passe incorrect. », « Votre accès a été suspendu. ». Retomber
      // ici sur le compte local du même poste (mêmes adresses, autre mot de
      // passe) ouvrait une session d'apparence normale mais SANS jeton
      // nominatif : le rail se remplissait, une organisation cliente pouvait
      // même être créée avec le jeton partagé, et l'ouvrir échouait ensuite sur
      // « Connectez-vous avec votre compte AMN DevSec » — sans que rien nulle
      // part n'ait dit que la connexion à amn-api n'avait pas eu lieu.
      //
      // Le repli local reste, pour ce à quoi il sert vraiment : travailler quand
      // amn-api est injoignable. Pas pour rattraper un refus.
      if (!isApiUnreachable(err)) throw new Error(message);
      unreachable = new Error(message);
    }

    // Repli local, édition interne seulement.
    if (IS_BUSINESS) throw unreachable;

    const result = await bridge().auth.login(email, password);
    if (!result.ok || !result.user) {
      throw new Error(result.error ?? unreachable?.message ?? 'Échec de la connexion.');
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
    setContextOrg(null);
  }, []);

  const reauthenticate = useCallback(async (): Promise<boolean> => {
    const current = read<StoredSession>(SESSION_STORAGE_KEY);
    if (!current?.token) return false;
    const session = await bridge().remote.session.restore(current.token).catch(() => null);
    if (!session) return false;
    setUser(userFromSession(session));
    setOrg(session.org);
    return true;
  }, []);

  const overrideOrg = useCallback((next: OrgIdentity | null) => setContextOrg(next), []);

  // Une session amn-api porte toujours son organisation (`/v1/auth/login` la
  // rend, `/v1/auth/me` la revalide) ; le repli local n'en a jamais. La nature
  // de la session se lit donc dans `sessionOrg` — celle de la SESSION, pas
  // celle qu'un contexte client substitue par-dessus.
  const sessionKind: SessionKind = user ? (sessionOrg ? 'api' : 'local') : null;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      org,
      overrideOrg,
      sessionKind,
      isAuthenticated: user !== null,
      bootstrapping,
      login,
      reauthenticate,
      logout,
    }),
    [user, org, overrideOrg, sessionKind, bootstrapping, login, logout, reauthenticate],
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
