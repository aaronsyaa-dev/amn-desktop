import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { isAdminRole } from '../auth/roles';
import { storedFromSession, writeStoredSession } from '../auth/session';
import { bridge } from '../lib/bridge';
import { cleanErrorMessage } from '../lib/errorMessage';
import { motsPurge, purgeContextMirror } from './SyncContext';
import type { AdminOrganization, MyOrganization, SupportContext } from '../shared/api';

/**
 * Le contexte actif d'AMN Desktop — AMN DevSec, ou le dossier d'une cliente.
 *
 * C'est la pièce que le rail pilote, et la seule qui sache basculer les deux
 * choses qui doivent bouger ensemble :
 *
 *   1. le justificatif du pont (requêtes ET WebSocket), pour que les écrans
 *      lisent réellement les données de l'organisation affichée ;
 *   2. la portée du miroir local, pour que rien de l'une ne survive en cache
 *      pendant qu'on regarde l'autre.
 *
 * Le jeton de support est conservé en `localStorage` pour une raison précise :
 * le bandeau « vous consultez X » doit revenir tel quel après un redémarrage.
 * Un contexte perdu au relancement afficherait les écrans d'une cliente sans
 * rien qui l'explique — exactement ce qu'un bandeau non masquable existe pour
 * empêcher. Au démarrage, le jeton est revalidé auprès d'amn-api : s'il a
 * expiré ou été révoqué, l'app revient franchement à AMN DevSec.
 */

const SUPPORT_TOKEN_KEY = 'amn.support.token';

/**
 * Le refus quand la session n'est pas une session amn-api.
 *
 * Écrit ici plutôt que laissé à amn-api : le serveur, lui, ne voit qu'un jeton
 * partagé et répond « Connectez-vous avec votre compte AMN DevSec » — une
 * phrase juste pour lui, mais qui se lit comme une erreur à qui vient
 * précisément de se connecter avec son compte nominatif. C'est l'application
 * qui sait POURQUOI elle n'a pas de jeton nominatif, donc c'est elle qui doit
 * le dire, et dire le geste qui répare.
 */
/**
 * Le refus d'amn-api quand l'appel n'est pas nominatif.
 *
 * Reconnu sur sa phrase parce que c'est ce que le pont remonte : le message du
 * serveur, pas son code. Une correspondance approximative suffit et vaut mieux
 * qu'une égalité stricte, qu'une reformulation côté serveur casserait en
 * silence.
 */
function isSharedCredentialRefusal(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  return raw.includes('compte AMN DevSec');
}

export const LOCAL_SESSION_REFUSAL =
  'Votre session est locale à ce poste, pas une session amn-api : elle n’ouvre aucun dossier client. ' +
  'Déconnectez-vous, puis reconnectez-vous avec votre compte AMN DevSec (mot de passe amn-api, pas celui du poste).';

interface OrgContextValue {
  /** Toutes les organisations gérées, AMN DevSec exclue. Triées par nom. */
  organizations: AdminOrganization[];
  /** Vrai pendant le premier chargement de la liste. */
  loadingOrgs: boolean;
  /** Message d'amn-api si la liste n'a pas pu être lue (console indisponible). */
  orgsError: string | null;
  refreshOrganizations: () => Promise<void>;

  /** Le contexte client actif, ou `null` quand on est chez AMN DevSec. */
  support: SupportContext | null;
  /** Vrai tant que le jeton conservé n'a pas été revalidé au démarrage. */
  restoring: boolean;
  /** Organisation en cours d'ouverture (id), pour l'état visuel du rail. */
  entering: string | null;
  /**
   * La bascule en cours, telle que l'affiche le voile de transition.
   *
   * Changer de contexte, c'est changer tout ce que l'app montre : le faire
   * apparaître d'un coup, écran par écran, donnerait l'impression d'un
   * rechargement raté. Le voile occupe cette seconde-là et annonce où l'on
   * arrive — c'est aussi ce qui rend impossible d'apercevoir, même un instant,
   * les données d'une organisation sous le nom d'une autre.
   */
  transition: ContextTransition | null;
  /**
   * Pourquoi la dernière bascule a échoué, tel que le dit amn-api.
   *
   * Le cas courant est une organisation suspendue : le rail ne l'interdit pas
   * au clic (elle y figure, grisée), donc le refus doit s'expliquer quelque
   * part. Sans ça, cliquer sur son icône ne produirait rigoureusement rien —
   * le pire des retours.
   */
  actionError: string | null;
  dismissActionError: () => void;
  /**
   * Affiche le refus « session locale » sans passer par une bascule.
   *
   * Pour les endroits qui doivent l'annoncer AVANT qu'on clique sur une
   * organisation — la pastille du rail, le formulaire de création. Un seul
   * chemin d'affichage (le bandeau de ContextError) pour un seul message.
   */
  signalLocalSession: () => void;

  enterOrganization: (orgId: string) => Promise<void>;
  leaveOrganization: () => Promise<void>;

  /* ------------------------- Appartenance (BLOC C) ------------------------- */

  /**
   * MES organisations — celles dont le compte est réellement membre.
   *
   * Rien à voir avec `organizations` ci-dessus, qui liste les clientes
   * SUPERVISÉES. Les deux coexistent dans le rail, séparées, parce qu'elles ne
   * veulent pas dire la même chose : « où je travaille » et « ce dont je
   * m'occupe ». Les mélanger ferait passer une session de support d'une heure
   * pour une appartenance, ce qui est exactement l'inverse du but.
   */
  myOrganizations: MyOrganization[];
  loadingMine: boolean;
  /** L'organisation qui porte la session en cours. */
  activeOrgId: string | null;
  /** Bascule sur une organisation dont on est membre. Recharge l'application. */
  switchToOrganization: (orgId: string) => Promise<void>;
}

export interface ContextTransition {
  kind: 'enter' | 'leave';
  name: string;
  logoDataUrl: string | null;
}

/** Durée plancher d'une bascule : en dessous, l'animation lit comme un raté. */
const MIN_TRANSITION_MS = 420;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Rend la main à React le temps qu'il commite le rendu en cours.
 *
 * Indispensable avant de toucher au justificatif du pont, et pas seulement
 * pour l'esthétique : tant que l'arbre de l'organisation précédente est monté,
 * sa synchronisation écoute encore. Basculer le jeton sous ses pieds
 * reconnecte la WebSocket sur l'AUTRE organisation, et ce fournisseur-là —
 * toujours vivant — écrirait les enregistrements reçus dans SON miroir. C'est
 * exactement comme ça que des fiches d'une cliente se retrouvaient en cache
 * chez nous après une simple visite. Deux trames suffisent à garantir que le
 * démontage est commité.
 */
function nextCommit(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

const OrgContext = createContext<OrgContextValue | undefined>(undefined);

function readStoredToken(): string {
  try {
    return window.localStorage.getItem(SUPPORT_TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeStoredToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(SUPPORT_TOKEN_KEY, token);
    else window.localStorage.removeItem(SUPPORT_TOKEN_KEY);
  } catch {
    /* mode privé — le contexte vivra le temps de la session, sans plus */
  }
}

export function OrgContextProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { org: activeOrg, role, overrideOrg, sessionKind, reauthenticate } = useAuth();

  const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [orgsError, setOrgsError] = useState<string | null>(null);

  const storedToken = useRef(readStoredToken());
  const [support, setSupport] = useState<SupportContext | null>(null);
  const [restoring, setRestoring] = useState(() => Boolean(storedToken.current));
  const [entering, setEntering] = useState<string | null>(null);
  const [transition, setTransition] = useState<ContextTransition | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const dismissActionError = useCallback(() => setActionError(null), []);
  const signalLocalSession = useCallback(() => setActionError(LOCAL_SESSION_REFUSAL), []);

  // L'organisation « courante » au sens de l'app suit le contexte. Un effet
  // plutôt qu'un appel dispersé dans enter/leave/restore : il ne peut alors pas
  // exister de chemin qui change le contexte sans changer ce que l'app affiche
  // comme émetteur — y compris sur un devis imprimé.
  useEffect(() => {
    overrideOrg(
      support
        ? {
            id: support.orgId,
            name: support.orgName,
            plan: support.plan,
            logoDataUrl: support.logoDataUrl,
            // Modules et accent de la cliente : sans eux, `AuthContext` ne
            // pouvait jamais appliquer son réglage réel pendant un contexte
            // de support — c'était la cause du bug d'accent qui ne
            // s'appliquait jamais malgré un enregistrement réussi côté
            // serveur.
            modules: support.modules,
            locks: support.locks ?? [],
            accent: support.accent,
          }
        : null,
    );
  }, [support, overrideOrg]);

  /* ------------------------- Appartenance (BLOC C) ------------------------- */

  const [myOrganizations, setMyOrganizations] = useState<MyOrganization[]>([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);

  const refreshMine = useCallback(async () => {
    try {
      const mine = await bridge().remote.session.listMyOrganizations();
      setMyOrganizations(mine.organizations ?? []);
      setActiveOrgId(mine.activeOrgId ?? null);
    } catch {
      // Une session locale ou un jeton partagé n'appartient à personne : ce
      // n'est pas une panne, c'est une absence d'appartenance. Le rail
      // n'affiche alors simplement pas cette section.
      setMyOrganizations([]);
      setActiveOrgId(null);
    } finally {
      setLoadingMine(false);
    }
  }, []);

  useEffect(() => {
    void refreshMine();
  }, [refreshMine]);

  /**
   * Bascule sur une organisation dont on est membre.
   *
   * L'application est RECHARGÉE après la bascule, et c'est un choix, pas une
   * facilité. Changer d'organisation change tout ce que l'app tient en
   * mémoire : le miroir de synchronisation, la WebSocket ouverte, les
   * fournisseurs de données montés. Les remettre à jour un par un demanderait
   * de n'en oublier aucun — et celui qu'on oublierait afficherait les
   * enregistrements de l'organisation précédente sous le nom de la nouvelle.
   *
   * Un rechargement complet garantit qu'il ne reste rien de l'ancienne portée.
   * C'est une seconde d'attente contre une classe entière de fuites.
   */
  const switchToOrganization = useCallback(
    async (orgId: string) => {
      if (orgId === activeOrgId) return;
      try {
        const session = await bridge().remote.session.switchOrganization(orgId);
        /*
          UNE SEULE FABRIQUE, UN SEUL ÉCRIVAIN (voir auth/session.ts).

          Ces lignes écrivaient la session « à la main », sous la clé retapée
          en toutes lettres, et dans une forme qui n'était pas celle
          qu'AuthContext écrit à la connexion : le RÔLE manquait, et `user`
          était la forme serveur — donc sans nom affichable.

          Le rôle absent était le vrai dégât. Après une seule bascule, plus
          rien ne savait quel rôle avait la personne, et rien ne le
          rétablissait : les écrans qui demandent « puis-je modifier ceci ? »
          recevaient `null` et refusaient, à quelqu'un qui avait pourtant tous
          les droits. Tout le reste marchait, ce qui rendait le défaut
          presque invisible — il fallait se déconnecter pour en sortir.

          `storedFromSession` prend le rôle EFFECTIF de la nouvelle
          organisation (les ponts l'ont normalisé) : c'est bien le rôle de
          l'appartenance dans l'organisation où l'on entre, jamais celui de
          l'organisation d'origine.
        */
        writeStoredSession(storedFromSession(session));
        // Le contexte de support éventuel n'a plus lieu d'être : on quitte
        // l'organisation, pas seulement l'écran.
        window.localStorage.removeItem(SUPPORT_TOKEN_KEY);
        window.location.reload();
      } catch (err) {
        setActionError(cleanErrorMessage(err, 'Impossible de changer d’organisation.'));
      }
    },
    [activeOrgId],
  );

  const refreshOrganizations = useCallback(async () => {
    /*
      La console d'administration n'existe QUE pour AMN DevSec.

      Depuis l'appartenance multiple, un compte d'AMN DevSec basculé sur une
      organisation cliente n'y a plus droit — et c'est voulu (on n'emporte pas
      ses pouvoirs d'une organisation à l'autre). Le rail continuait pourtant
      d'appeler cette route à chaque montage, et récoltait un 404 visible dans
      la console du navigateur : une requête qu'on sait perdue d'avance, faite
      quand même. Trouvé en observant le trafic réel d'un poste basculé.

      Le plan de l'organisation ACTIVE est le bon signal : c'est exactement ce
      sur quoi le serveur décide, donc les deux ne peuvent pas diverger.
    */
    if (activeOrg && activeOrg.plan !== 'internal') {
      setOrganizations([]);
      setOrgsError(null);
      setLoadingOrgs(false);
      return;
    }
    /*
      Le MÊME défaut, sur l'autre axe — trouvé de la même façon, en regardant
      le trafic réel d'un compte de test.

      Le garde au-dessus couvre l'organisation ; il ne couvrait pas le rôle.
      `foundingOrgAdmin` (amn-api, middleware/tenantAuth.js) exige d'être chez
      AMN DevSec ET d'y être owner ou admin. Un compte `member` de l'interne
      passait donc ce garde et récoltait un 403 à chaque montage du rail.

      Ce n'est pas qu'une requête gaspillée. Des 403 réguliers venus de comptes
      légitimes, c'est le bruit dans lequel un vrai refus se perd — la
      supervision du serveur devient moins lisible à chaque poste ouvert.
    */
    if (!isAdminRole(role)) {
      setOrganizations([]);
      setOrgsError(null);
      setLoadingOrgs(false);
      return;
    }
    try {
      const all = await bridge().remote.admin.listOrganizations();
      // AMN DevSec est le contexte par défaut du rail, pas une entrée de la
      // liste des clientes : elle a sa propre place, tout en haut.
      setOrganizations(
        all
          .filter((org) => org.plan !== 'internal')
          .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      );
      setOrgsError(null);
    } catch (err) {
      setOrgsError(cleanErrorMessage(err, 'Console des organisations indisponible.'));
    } finally {
      setLoadingOrgs(false);
    }
  }, [activeOrg, role]);

  useEffect(() => {
    void refreshOrganizations();
  }, [refreshOrganizations]);

  /*
    LA LISTE SUIT LA TOUR. Une organisation créée par Mohamed n'apparaissait
    chez Aaron qu'au prochain rechargement : la liste était lue une fois, au
    montage. Le serveur annonce désormais chaque naissance, changement ou
    disparition (trame `org:changed`, livrée à tout membre d'AMN DevSec), et
    le rail se relit à l'instant.
  */
  useEffect(() => bridge().remote.onOrgChanged?.(() => void refreshOrganizations()) ?? undefined, [refreshOrganizations]);

  // Reprise du contexte au démarrage. Tant qu'elle n'a pas abouti, le pont
  // parle encore au nom d'AMN DevSec : c'est pour ça que le layout client
  // attend `restoring === false` avant d'afficher le moindre écran.
  useEffect(() => {
    const token = storedToken.current;
    if (!token) return;
    let active = true;
    (async () => {
      const context = await bridge().remote.support.restore(token).catch(() => null);
      if (!active) return;
      if (context) {
        setSupport(context);
      } else {
        writeStoredToken(null);
        storedToken.current = '';
      }
      setRestoring(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  /**
   * Referme un contexte côté serveur et efface son miroir local.
   *
   * Le jeton est passé en argument, pas relu depuis le stockage : l'appelant
   * l'a déjà oublié quand il arrive ici (c'est ce qui fait sortir l'interface
   * tout de suite). Le relire donnerait une chaîne vide — et donc aucun appel
   * de fermeture, donc aucune ligne « quitté » au journal.
   */
  const closeCurrent = useCallback(async (context: SupportContext, token: string) => {
    if (token) await bridge().remote.support.leave(token).catch(() => undefined);
    const mots = motsPurge(purgeContextMirror(context.orgId));
    // Rare, mais jamais silencieux : ce qui n'est pas parti ne partira plus.
    if (mots) setActionError(mots);
  }, []);

  const enterOrganization = useCallback(
    async (orgId: string) => {
      if (support?.orgId === orgId) {
        navigate('/');
        return;
      }
      // Refus AVANT le réseau. amn-api n'ouvre un contexte client qu'à un
      // compte nominatif — il n'a personne à inscrire au journal derrière un
      // jeton partagé. Le savoir ici évite un aller-retour dont le message
      // reviendrait incompréhensible (voir LOCAL_SESSION_REFUSAL), et évite
      // surtout de lever le voile de transition sur un échec prévisible.
      if (sessionKind !== 'api') {
        setActionError(LOCAL_SESSION_REFUSAL);
        return;
      }
      const target = organizations.find((o) => o.id === orgId);
      setEntering(orgId);
      setTransition({
        kind: 'enter',
        name: target?.name ?? 'Organisation cliente',
        logoDataUrl: target?.logoDataUrl ?? null,
      });
      const started = Date.now();
      setActionError(null);
      try {
        // Le voile est levé et les deux arborescences sont démontées AVANT tout
        // changement de justificatif — voir `nextCommit`.
        await nextCommit();
        // Si un contexte était déjà ouvert, on le referme d'abord : deux jetons
        // de support vivants en même temps, ce sont deux entrées « enter » au
        // journal pour un seul opérateur, et un jeton orphelin valable une heure.
        if (support) await closeCurrent(support, storedToken.current || readStoredToken());
        let session;
        try {
          session = await bridge().remote.support.enter(orgId);
        } catch (err) {
          // amn-api refuse quand la requête n'est pas nominative. Vu d'ici,
          // c'est presque toujours une DÉSYNCHRONISATION et non un problème de
          // compte : le renderer a bien une session amn-api en mémoire (le
          // profil s'affiche, le rail se remplit), mais le process principal
          // n'a plus le jeton nominatif — ses appels repartent alors avec le
          // jeton opérateur partagé, qui n'appartient à personne.
          //
          // On réinjecte le jeton stocké et on retente UNE fois. C'est la
          // réparation exacte, faite à la place de l'opérateur, plutôt que de
          // lui relayer un « connectez-vous » alors qu'il est connecté.
          if (!isSharedCredentialRefusal(err)) throw err;
          const healed = await reauthenticate();
          if (!healed) throw err;
          session = await bridge().remote.support.enter(orgId);
        }
        writeStoredToken(session.token);
        storedToken.current = session.token;
        setSupport(session.context);
        // On atterrit sur l'accueil de la cliente, jamais sur l'écran qu'on
        // regardait : les deux arborescences n'ont pas les mêmes routes, et
        // « rester où on était » n'a aucun sens d'un contexte à l'autre.
        navigate('/');
      } catch (err) {
        // Le refus le plus fréquent est « organisation suspendue », et amn-api
        // l'écrit pour être lu tel quel. On le remonte sans le traduire.
        setActionError(cleanErrorMessage(err, 'Impossible d’ouvrir cette organisation.'));
        // La liste a peut-être bougé depuis le dernier chargement (une autre
        // machine a suspendu l'organisation) : on la resynchronise pour que le
        // rail cesse tout de suite de la présenter comme ouvrable.
        void refreshOrganizations();
      } finally {
        setEntering(null);
        // Le voile ne se lève qu'une fois la bascule réellement faite, jamais
        // avant : c'est lui qui garantit qu'on ne voit pas un écran à moitié
        // rempli des données de l'organisation précédente.
        await sleep(Math.max(0, MIN_TRANSITION_MS - (Date.now() - started)));
        setTransition(null);
      }
    },
    [support, navigate, closeCurrent, organizations, refreshOrganizations, sessionKind, reauthenticate],
  );

  /*
    L'EXPIRATION EST APPLIQUÉE, PAS SEULEMENT AFFICHÉE (BLOC D)
    ═══════════════════════════════════════════════════════════

    Défaut observé : une session de support expirée laissait l'opérateur dans
    le contexte de la cliente. Le bandeau tombait bien sur « expirée » — il
    recalcule son compte à rebours toutes les trente secondes — mais rien ne
    fermait le contexte : le jeton restait en place, les écrans de la cliente
    restaient montés, et le miroir local continuait de servir SES données.

    Le serveur, lui, refusait déjà tout (`resolveSession` supprime une session
    échue). Le résultat était donc le pire des deux : un opérateur convaincu
    d'être encore chez elle, devant des données qu'il ne pouvait plus
    rafraîchir, avec un bandeau qui se contredisait lui-même.

    Ici, l'expiration DÉCLENCHE la sortie. Trois voies, parce qu'une seule ne
    couvre pas les trois façons d'atteindre l'échéance :

      1. le minuteur, pour l'app restée ouverte ;
      2. le contrôle au montage, pour un jeton déjà échu retrouvé au démarrage
         (la revalidation serveur le refuse aussi, mais ceci ferme le cas où
         elle n'aboutit pas — hors ligne, par exemple) ;
      3. le retour au premier plan, parce qu'une machine en veille peut
         traverser l'échéance sans qu'aucun minuteur ne s'exécute à l'heure.

    La sortie est SILENCIEUSE côté réseau : le jeton étant échu, appeler
    `support.leave` ne ferait qu'un 401 et n'inscrirait rien au journal. On
    purge, on sort, et on dit pourquoi — parce que se retrouver ailleurs sans
    explication est la seule chose pire que de rester.
  */
  const expireContext = useCallback(
    (contexte: SupportContext) => {
      const mots = motsPurge(purgeContextMirror(contexte.orgId));
      setSupport(null);
      writeStoredToken(null);
      storedToken.current = '';
      setActionError(
        `La session de support sur ${contexte.orgName} a expiré. Son espace est refermé — ` +
          'rouvrez-en une depuis la Tour de contrôle si vous en avez encore besoin.' +
          // Une expiration n'est décidée par personne : c'est le seul cas où on
          // peut perdre du travail sans avoir rien fait pour ça.
          (mots ? ` ${mots}` : ''),
      );
      navigate('/');
    },
    [navigate],
  );

  useEffect(() => {
    if (!support) return undefined;

    const echeance = Date.parse(support.expiresAt);
    // Une date illisible ne doit pas faire vivre un contexte éternellement :
    // on préfère fermer que garder ouvert sur une valeur qu'on ne comprend pas.
    if (!Number.isFinite(echeance)) {
      expireContext(support);
      return undefined;
    }

    const restant = echeance - Date.now();
    if (restant <= 0) {
      expireContext(support);
      return undefined;
    }

    // `setTimeout` est borné à ~24,8 jours ; une session de support vaut une
    // heure, donc la valeur tient toujours. Le garde-fou coûte une ligne et
    // évite un débordement qui déclencherait la sortie immédiatement.
    const delai = Math.min(restant, 2_147_483_000);
    const minuteur = window.setTimeout(() => expireContext(support), delai);

    const auRetour = () => {
      if (document.visibilityState === 'visible' && Date.parse(support.expiresAt) <= Date.now()) {
        expireContext(support);
      }
    };
    document.addEventListener('visibilitychange', auRetour);
    window.addEventListener('focus', auRetour);

    return () => {
      window.clearTimeout(minuteur);
      document.removeEventListener('visibilitychange', auRetour);
      window.removeEventListener('focus', auRetour);
    };
  }, [support, expireContext]);

  const leaveOrganization = useCallback(async () => {
    if (!support) {
      navigate('/');
      return;
    }
    // On quitte l'écran AVANT de rendre la main au réseau : l'opérateur doit
    // sortir d'un contexte client instantanément, même si amn-api met deux
    // secondes à confirmer. La fermeture côté serveur suit.
    const leaving = support;
    const leavingToken = storedToken.current || readStoredToken();
    setTransition({ kind: 'leave', name: 'AMN DevSec', logoDataUrl: null });
    const started = Date.now();
    // Même raison qu'à l'entrée : l'arborescence de la cliente doit être
    // démontée avant que le jeton ne redevienne le nôtre, sinon sa
    // synchronisation reçoit — et met en cache — nos enregistrements.
    await nextCommit();
    setSupport(null);
    writeStoredToken(null);
    storedToken.current = '';
    navigate('/');
    await closeCurrent(leaving, leavingToken);
    await sleep(Math.max(0, MIN_TRANSITION_MS - (Date.now() - started)));
    setTransition(null);
  }, [support, navigate, closeCurrent]);

  const value = useMemo<OrgContextValue>(
    () => ({
      organizations,
      loadingOrgs,
      orgsError,
      refreshOrganizations,
      support,
      restoring,
      entering,
      transition,
      actionError,
      dismissActionError,
      signalLocalSession,
      enterOrganization,
      leaveOrganization,
      myOrganizations,
      loadingMine,
      activeOrgId,
      switchToOrganization,
    }),
    [
      organizations,
      loadingOrgs,
      orgsError,
      refreshOrganizations,
      support,
      restoring,
      entering,
      transition,
      actionError,
      dismissActionError,
      signalLocalSession,
      enterOrganization,
      leaveOrganization,
      /*
        CES QUATRE-LÀ MANQUAIENT, ET C'EST TOUT LE DÉFAUT.

        L'objet ci-dessus PUBLIE `myOrganizations`, `loadingMine`,
        `activeOrgId` et `switchToOrganization` ; le tableau de dépendances,
        lui, ne les surveillait pas. Le memo ne se recalculait donc pas quand
        ils changeaient : les consommateurs gardaient les valeurs figées au
        premier rendu — liste vide, `activeOrgId` nul, `loadingMine` vrai.

        Ce n'était pas franc, et c'est ce qui l'a rendu si difficile à voir :
        le memo se recalculait quand même dès qu'une autre dépendance de la
        liste bougeait (`organizations`, `support`, `transition`…), et
        ramassait au passage les valeurs à jour. Tant que la Tour de contrôle
        rechargeait sa propre liste, tout paraissait normal.

        Après une bascule vers une organisation CLIENTE, plus rien ne bougeait
        de ce côté — `refreshOrganizations` s'arrête volontairement quand
        l'organisation active n'est pas `internal`. Le rail restait donc figé
        sur son premier rendu : les organisations rejointes disparaissaient, le
        bouton « chez moi » se croyait actif, et son clic était inerte (il teste
        `homeOrg`, qui était nul). On se retrouvait coincé dans l'organisation
        où l'on venait d'entrer, avec le rôle qui va avec.

        Mesuré : la réponse serveur portait bien deux organisations et la bonne
        organisation active, à l'instant même où le rail n'en affichait aucune.
      */
      myOrganizations,
      loadingMine,
      activeOrgId,
      switchToOrganization,
    ],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrgContext(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrgContext must be used within an OrgContextProvider');
  return ctx;
}

/**
 * Le contexte de support, ou `null` — sans exiger le fournisseur.
 *
 * Pour les écrans PARTAGÉS entre les deux éditions. `useOrgContext` lève quand
 * le fournisseur manque, ce qui est juste pour les écrans internes (l'absence y
 * serait un bug) mais faux ici : l'édition Business n'a pas de rail, pas de
 * contexte client, et donc pas de fournisseur — sans que rien ne soit cassé.
 *
 * Un hook plutôt qu'un `try/catch` autour de `useOrgContext` : on ne peut pas
 * appeler un hook conditionnellement, et attraper l'exception d'un hook laisse
 * React dans un état qu'il n'a pas prévu.
 */
export function useSupportContext(): SupportContext | null {
  return useContext(OrgContext)?.support ?? null;
}

/**
 * Initiales d'une organisation — le repli quand aucun logo n'est défini.
 * Deux lettres au maximum : au-delà, le cercle du rail devient illisible.
 */
export function orgInitials(name: string): string {
  const words = name.trim().split(/[\s-]+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
