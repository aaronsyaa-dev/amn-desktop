import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { bridge } from '../lib/bridge';
import { setEnabledModules } from '../data/spaces';
import { applyAccent } from '../lib/accent';
import { clearGuestQuotaBlock } from '../state/guestQuotaStore';
import { cleanErrorMessage, isApiUnreachable } from '../lib/errorMessage';
import { IS_BUSINESS, CLIENT_PRODUCT_NAME } from '../edition/edition';
import type { OrgIdentity, RemoteSession, RemoteSessionUser, User,
  LoginOutcome,
} from '../shared/api';
import {
  clearStoredSession,
  patchStoredOrg,
  localUserFromSession,
  readStoredSession,
  sessionRole,
  storedFromSession,
  writeStoredSession,
  type StoredSession,
} from './session';

const AUTH_STORAGE_KEY = 'amn-desktop.auth.user';

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

/** Voir `AuthContextValue.sessionKind`. */
export type SessionKind = 'api' | 'local' | null;

interface AuthContextValue {
  user: User | null;
  /**
   * Le rôle dans l'organisation courante — `null` hors session amn-api.
   *
   * Sert au droit d'ÉCRITURE côté écran (voir lib/pageBlocks.ts). Ce n'est pas
   * une barrière de sécurité : amn-api reste seul juge de ce qu'un compte peut
   * écrire, et l'isolation par organisation ne dépend jamais de cette valeur.
   */
  role: RemoteSessionUser['role'] | null;
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
  /**
   * Met à jour l'organisation DE LA SESSION après que la cliente a changé un
   * réglage qui lui appartient (sa couleur d'accent — BLOC C).
   *
   * Distinct d'`overrideOrg`, qui SUBSTITUE une organisation le temps d'un
   * contexte client sans toucher à la session. Ici on modifie bien la sienne,
   * donc l'état et le stockage doivent suivre : sans ça, un redémarrage
   * réafficherait l'ancienne couleur jusqu'au prochain `/v1/auth/me`.
   */
  patchSessionOrg: (org: OrgIdentity) => void;
  /**
   * Le mot de passe courant a-t-il été émis par le support ?
   *
   * Le message de remise dit « changez-le dès votre première connexion ».
   * L'application ne le rappelait nulle part : la consigne ne tenait qu'à la
   * mémoire de quelqu'un qui lit un message une seule fois, à propos d'un mot
   * de passe qui a voyagé par courriel et que deux personnes connaissent.
   *
   * Le fait vient d'amn-api, pas d'un état local : un drapeau côté poste
   * disparaîtrait au changement d'appareil, et elle cesserait d'être prévenue
   * en se connectant depuis son téléphone.
   */
  passwordFromSupport: boolean;
  /**
   * À appeler après un changement de mot de passe réussi.
   *
   * Le serveur a déjà baissé le drapeau (voir routes/auth.js) ; ceci évite un
   * aller-retour pour que le bandeau disparaisse dans le même geste que la
   * validation, au lieu du prochain démarrage.
   */
  clearPasswordFromSupport: () => void;
  isAuthenticated: boolean;
  /**
   * Vrai tant que la session stockée n'a pas été revalidée auprès d'amn-api.
   * L'app attend : monter la synchro avant de savoir pour quelle organisation
   * elle tourne, c'est afficher un espace de travail vide puis le remplacer.
   */
  bootstrapping: boolean;
  /**
   * Première étape. Rend `{ kind: 'mfa' }` quand un second facteur est dû —
   * l'écran de connexion doit alors demander le code et appeler `completeMfa`.
   */
  login: (email: string, password: string) => Promise<LoginOutcome>;
  /** Seconde étape : code du téléphone ou code de secours. */
  completeMfa: (input: {
    challenge: string;
    code?: string;
    backupCode?: string;
  }) => Promise<RemoteSession>;
  /**
   * Accepte une invitation et ouvre la session.
   *
   * Distinct de `login` sur un point qui compte : il n'y a AUCUN repli local.
   * Une invitée n'a pas de compte sur ce poste — c'est la définition d'une
   * invitation — donc si amn-api est injoignable, la seule réponse honnête est
   * de le dire, pas d'ouvrir une session locale qui ne serait rattachée à rien.
   */
  acceptInvitation: (token: string, password: string) => Promise<LoginOutcome>;
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const stored = useMemo(() => readStoredSession(), []);
  const [user, setUser] = useState<User | null>(
    () => stored?.user ?? read<User>(AUTH_STORAGE_KEY),
  );
  const [sessionOrg, setOrg] = useState<OrgIdentity | null>(() => stored?.org ?? null);
  const [role, setRole] = useState<RemoteSessionUser['role'] | null>(() => stored?.role ?? null);
  // Organisation substituée par un contexte client. Volontairement PAS
  // persistée : elle est reconstruite au démarrage par la revalidation du jeton
  // de support, qui est la seule source qui fasse autorité.
  const [contextOrg, setContextOrg] = useState<OrgIdentity | null>(null);
  const org = contextOrg ?? sessionOrg;
  const [bootstrapping, setBootstrapping] = useState(() => Boolean(stored?.token));
  // Pas persisté : la valeur est celle que le serveur vient de dire. La relire
  // d'un stockage local ferait survivre un avertissement à sa résolution, ou
  // l'inverse — et l'inverse est pire.
  const [passwordFromSupport, setPasswordFromSupport] = useState(false);

  /*
    QUI, OÙ, AVEC QUEL RÔLE — LES TROIS ENSEMBLE, OU RIEN
    ─────────────────────────────────────────────────────
    `setUser` et `setRole` ne sont appelés QUE dans les deux fonctions qui
    suivent, et `npm run check:roles` refuse tout autre appel dans ce fichier.

    Ce n'est pas de la coquetterie : le défaut corrigé ici venait exactement
    de leur séparation. Quatre chemins réglaient l'utilisateur sans toucher au
    rôle — la revalidation au démarrage, la reconnexion silencieuse, le repli
    local, et la déconnexion. Chacun laissait donc un rôle faux : périmé dans
    un cas, absent dans les trois autres. Aucun ne plantait, aucun ne se
    voyait, et l'application refusait poliment à quelqu'un qui avait tous les
    droits.

    Une identité incomplète n'est plus représentable : on l'adopte entière,
    ou on l'oublie entière.
  */
  const adopterIdentite = useCallback(
    (next: { user: User; org: OrgIdentity | null; role: RemoteSessionUser['role'] | null }) => {
      setUser(next.user);
      setOrg(next.org);
      setRole(next.role);
    },
    [],
  );

  const oublierIdentite = useCallback(() => {
    setUser(null);
    setOrg(null);
    setRole(null);
  }, []);

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
        /*
          Le rôle est RÉÉCRIT ici, pas seulement lu au démarrage.

          C'est la ligne qui manquait. Une session ouverte par une version
          antérieure — ou par une bascule d'organisation — n'a pas de rôle en
          stockage ; sans cette réécriture, il restait `null` pour toujours,
          puisque plus rien après ne le renseignait. La revalidation parle au
          serveur : c'est le moment exact où l'on connaît la vérité, et donc
          celui où il faut la consigner.
        */
        const aStocker = { ...storedFromSession(session), token: stored.token };
        adopterIdentite({ user: aStocker.user, org: aStocker.org, role: aStocker.role ?? null });
        writeStoredSession(aStocker);
        setPasswordFromSupport(Boolean(session.user.passwordFromSupport));
      } else {
        clearStoredSession();
        oublierIdentite();
      }
      setBootstrapping(false);
    })();
    return () => {
      active = false;
    };
  }, [stored, adopterIdentite, oublierIdentite]);

  /**
   * Adopte une session amn-api : garde-fou d'édition, stockage, état.
   *
   * Extrait parce que trois chemins y arrivent désormais — connexion directe,
   * seconde étape MFA, acceptation d'invitation — et qu'un garde-fou d'édition
   * qui existerait sur deux d'entre eux seulement serait pire qu'aucun.
   */
  const adoptSession = useCallback(async (session: RemoteSession, refusal: string) => {
    if (!IS_BUSINESS && session.org.plan !== 'internal') {
      await bridge().remote.session.clear().catch(() => undefined);
      throw new Error(refusal);
    }
    const toStore: StoredSession = storedFromSession(session);
    writeStoredSession(toStore);
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    adopterIdentite({ user: toStore.user, org: toStore.org, role: toStore.role ?? null });
    setPasswordFromSupport(Boolean(session.user.passwordFromSupport));
  }, [adopterIdentite]);

  /**
   * Seconde étape : le code du téléphone, ou un code de secours.
   *
   * Séparée de `login` et non fondue dedans : le défi ne doit jamais pouvoir
   * être confondu avec une session, et deux fonctions distinctes rendent la
   * confusion impossible à écrire par distraction.
   */
  const completeMfa = useCallback(
    async (input: { challenge: string; code?: string; backupCode?: string }) => {
      const session = await bridge().remote.session.loginMfa(input);
      await adoptSession(
        session,
        `Ce compte appartient à une organisation cliente. Utilisez l’application ${CLIENT_PRODUCT_NAME}.`,
      );
      return session;
    },
    [adoptSession],
  );

  const login = useCallback(async (email: string, password: string): Promise<LoginOutcome> => {
    let unreachable: Error | null = null;
    try {
      const outcome = await bridge().remote.session.login(email, password);

      // MFA active : rien n'est adopté ici. L'écran de connexion demande le
      // second facteur, et c'est `completeMfa` qui ouvrira la session.
      if (outcome.kind === 'mfa') return outcome;
      const session = outcome.session;

      /*
        Garde-fou d'édition. Un build interne embarque les produits exclusifs
        d'AMN DevSec : une organisation cliente n'a rien à y faire, même avec
        des identifiants valides. L'inverse est permis — Aaron peut ouvrir
        l'application CLIENTE avec son propre compte pour vérifier ce que voit
        sa cliente.

        Le message nomme l'AUTRE édition, jamais celle-ci, et il le fait par
        `CLIENT_PRODUCT_NAME` : écrit en dur, il disait « AMN Business »
        — l'édition interne — à une utilisatrice cliente qu'il fallait envoyer
        vers « AMN Desktop ». Le seul message dont le rôle est d'orienter
        envoyait au mauvais endroit.
      */
      await adoptSession(
        session,
        `Ce compte appartient à une organisation cliente. Utilisez l’application ${CLIENT_PRODUCT_NAME}.`,
      );
      return { kind: 'session', session };
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
    /*
      Le repli local ne parle pas à amn-api : il n'a donc AUCUN rôle à
      annoncer, et `null` est la seule réponse honnête. Il laissait jusqu'ici
      en place le rôle du compte précédent — un poste partagé pouvait donc
      ouvrir une session locale et hériter à l'écran des droits de quelqu'un
      d'autre.
    */
    adopterIdentite({ user: result.user, org: null, role: null });
    // Le repli local n'a pas de MFA : il ne parle pas à amn-api.
    return { kind: 'session', session: null as unknown as RemoteSession };
  }, [adoptSession, adopterIdentite]);

  const acceptInvitation = useCallback(
    async (token: string, password: string): Promise<LoginOutcome> => {
      const outcome = await bridge().remote.session.acceptInvitation(token, password);
      // Réémission d'accès sur un compte à MFA active : le second facteur reste
      // dû, exactement comme à la connexion.
      if (outcome.kind === 'mfa') return outcome;

      // Même garde-fou d'édition qu'à la connexion : un build interne embarque
      // les produits exclusifs, une organisation cliente n'a rien à y faire même
      // avec une invitation parfaitement valide.
      await adoptSession(
        outcome.session,
        `Cette invitation concerne une organisation cliente. Utilisez l’application ${CLIENT_PRODUCT_NAME}.`,
      );
      return outcome;
    },
    [adoptSession],
  );

  const logout = useCallback(() => {
    // Le mur « quota épuisé » appartient au compte qui part : le laisser en
    // place accueillerait le compte suivant avec le blocage du précédent.
    clearGuestQuotaBlock();
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    clearStoredSession();
    // Les miroirs de collections sont indexés par poste, pas par organisation :
    // les laisser en place ferait apparaître les données du compte précédent
    // pendant la première seconde du suivant. On les efface à la déconnexion.
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith('amn.sync.')) window.localStorage.removeItem(key);
    }
    void bridge().remote.session.clear().catch(() => undefined);
    // Le rôle part avec le reste : le laisser en place accueillait le compte
    // suivant avec les droits du précédent.
    oublierIdentite();
    setContextOrg(null);
  }, [oublierIdentite]);

  const reauthenticate = useCallback(async (): Promise<boolean> => {
    const current = readStoredSession();
    if (!current?.token) return false;
    const session = await bridge().remote.session.restore(current.token).catch(() => null);
    if (!session) return false;
    // Même exigence qu'au démarrage : ce que le serveur vient de dire est
    // consigné, en mémoire ET en stockage. Sans quoi la reconnexion
    // silencieuse « réparait » la session tout en laissant le rôle faux.
    const aStocker = { ...storedFromSession(session), token: current.token };
    adopterIdentite({ user: aStocker.user, org: aStocker.org, role: aStocker.role ?? null });
    writeStoredSession(aStocker);
    return true;
  }, [adopterIdentite]);

  const overrideOrg = useCallback((next: OrgIdentity | null) => setContextOrg(next), []);

  /*
    Les modules ouverts suivent l'organisation ACTIVE — celle du contexte client
    quand il y en a un, la sienne sinon. C'est ce qui fait que le support voit
    l'application de la cliente telle qu'elle est chez elle, modules retirés
    compris, au lieu d'une version complète qui n'existe nulle part.

    Réglé dans un effet, avant peinture, pour qu'aucun rendu n'affiche la
    navigation de l'organisation précédente le temps d'une image.
  */
  useLayoutEffect(() => {
    setEnabledModules(org?.modules ?? null);
    // La couleur d'accent suit la même organisation, et par le même chemin :
    // décidée par le serveur, appliquée par le poste. Avant peinture, pour
    // qu'aucun rendu n'affiche la couleur de l'organisation précédente.
    applyAccent(org?.accent ?? null);
  }, [org]);

  // Une session amn-api porte toujours son organisation (`/v1/auth/login` la
  // rend, `/v1/auth/me` la revalide) ; le repli local n'en a jamais. La nature
  // de la session se lit donc dans `sessionOrg` — celle de la SESSION, pas
  // celle qu'un contexte client substitue par-dessus.
  const clearPasswordFromSupport = useCallback(() => setPasswordFromSupport(false), []);

  const patchSessionOrg = useCallback((next: OrgIdentity) => {
    setOrg(next);
    try {
      // L'organisation seule : ce n'est pas un changement d'identité (ni le
      // compte ni le rôle ne bougent), donc pas d'`adopterIdentite` ici.
      patchStoredOrg(next);
    } catch {
      /* Le stockage peut être refusé (mode privé) : l'état en mémoire suffit
         pour cette session, et `/v1/auth/me` rétablira la vérité au prochain
         démarrage. */
    }
  }, []);

  const sessionKind: SessionKind = user ? (sessionOrg ? 'api' : 'local') : null;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      org,
      role,
      overrideOrg,
      patchSessionOrg,
      passwordFromSupport,
      clearPasswordFromSupport,
      sessionKind,
      isAuthenticated: user !== null,
      bootstrapping,
      login,
      completeMfa,
      acceptInvitation,
      reauthenticate,
      logout,
    }),
    [
      user,
      org,
      role,
      overrideOrg,
      patchSessionOrg,
      passwordFromSupport,
      clearPasswordFromSupport,
      sessionKind,
      bootstrapping,
      login,
      // `completeMfa` était publié sans être surveillé — même classe de défaut
      // que celui qui a coûté son rôle à Aaron, trouvé par `check:roles` en
      // écrivant ce contrôle. Sans effet visible ici (il ne dépend que de
      // fonctions stables), et corrigé quand même : la règle est que ce qu'on
      // publie, on le surveille.
      completeMfa,
      acceptInvitation,
      logout,
      reauthenticate,
    ],
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
