/**
 * Contract shared between the Electron main process and the renderer.
 *
 * The renderer never imports Electron or the database directly: it talks to a
 * `bridge` (see src/lib/bridge.ts) whose shape is {@link AmnBridge}. In Electron
 * that bridge is `window.amn` (exposed by the preload script over IPC, backed by
 * SQLite + bcrypt in the main process). In a plain browser — used for headless
 * verification and vanilla `vite` dev — the same interface is fulfilled by a
 * local fallback that still performs real bcrypt verification.
 *
 * This indirection is what lets the same UI run in both environments and makes
 * swapping the local backend for a central API later a one-file change.
 */

export interface User {
  id: number;
  email: string;
  name: string;
}

export interface AuthResult {
  ok: boolean;
  user?: User;
  error?: string;
}

/* --------------------------- Organisation (amn-api) --------------------------- */

/**
 * Plan de l'organisation, tel que le renvoie amn-api.
 *
 * `internal` est AMN DevSec — la seule organisation qui a accès aux produits
 * de cybersécurité (Trackers, Scanner, Comply, SSL Monitor). Tous les autres
 * plans sont des organisations clientes : elles reçoivent l'édition Business.
 */
export type OrgPlan = 'internal' | 'business_standard' | 'business_premium';

export interface OrgIdentity {
  id: string;
  name: string;
  plan: OrgPlan;
  /** Logo en data-URL, ou absent/`null` — le rail retombe alors sur les initiales. */
  logoDataUrl?: string | null;
  /**
   * Modules ouverts à cette organisation, décidés par le serveur (BLOC E).
   * `null`/absent = tous. Le poste les APPREND, il ne les choisit pas.
   *
   * Retire des écrans et de la navigation ; ce n'est PAS une frontière de
   * sécurité — l'isolation des données reste celle d'amn-api, par `org_id`.
   */
  modules?: string[] | null;
  /**
   * Identifiant de couleur d'accent (BLOC C), ou `null` = le défaut.
   * Un identifiant de palette, jamais un code couleur : le contraste est
   * validé une fois pour toutes dans `src/lib/accent.ts`.
   */
  accent?: string | null;
  /**
   * La langue de l'organisation ('fr' | 'en'), choisie à l'atelier, ou
   * `null` = français. Le poste la suit, sauf choix de la personne
   * (Réglages → Langue) — voir src/i18n.
   */
  language?: string | null;
  /** Les places de la formule (Bloc 1) ; `null` = sans limite (AMN DevSec). */
  seats?: number | null;
  /**
   * L'adresse publique de l'application où cette organisation travaille
   * (Bloc 7). Le poste s'en sert pour renvoyer un compte ouvert sur la
   * mauvaise édition ; `null` tant que le serveur ne la connaît pas.
   */
  appUrl?: string | null;
}

export type OrgStatus = 'active' | 'suspended';

/**
 * Une organisation vue depuis la console AMN DevSec (`GET /v1/admin/organizations`).
 *
 * C'est ce qui alimente le rail et le panneau « Organisations clientes » de la
 * Tour de contrôle : le nom et le logo pour la reconnaître, le statut pour
 * savoir si elle tourne, le compte d'utilisateurs et la dernière activité pour
 * savoir si elle vit. Rien de son travail — la console ne le lit pas.
 */
export interface AdminOrganization {
  id: string;
  name: string;
  plan: OrgPlan;
  status: OrgStatus;
  logoDataUrl: string | null;
  /** Modules ouverts ; `null` = tous. Réglable depuis la console. */
  modules?: string[] | null;
  /** Couleur d'accent (identifiant de palette) ; `null` = défaut. */
  accent?: string | null;
  /** Métier de l'organisation (BLOC 6) ; `null` = inconnu, libellés génériques. */
  trade?: string | null;
  /** Langue de l'organisation ('fr' | 'en') ; `null` = français. */
  language?: string | null;
  /** Les places posées ; `null` = la formule décide (2 standard, 5 premium). */
  seats?: number | null;
  userCount: number;
  /** ISO, ou null si l'organisation n'a encore rien produit. */
  lastActivityAt: string | null;
  createdAt: string;
}

/**
 * Le pouls d'une organisation cliente (BLOC E) — des chiffres, jamais son
 * travail.
 *
 * Tout ce qui suit est un COMPTE calculé par amn-api sur ses vraies tables au
 * moment de l'appel : si la cliente saisit une facture, `records.last7Days`
 * monte de un. C'est la condition posée pour la banderole de la Tour de
 * contrôle — « réel » y était le mot clé, et un chiffre figé aurait été pire
 * qu'aucun chiffre, parce qu'on finit par lui faire confiance.
 */
export interface OrgPulse {
  orgId: string;
  records: {
    total: number;
    last7Days: number;
    last30Days: number;
    /** ISO de la dernière écriture, ou null si l'organisation n'a rien produit. */
    lastAt: string | null;
  };
  /**
   * Chaque module de l'organisation : combien d'enregistrements, quand le
   * dernier a bougé, combien ont bougé cette semaine.
   *
   * Des noms, des comptes et des dates. AUCUN CONTENU — c'est la limite qui
   * sépare diagnostiquer de lire, et un test d'amn-api la vérifie
   * (test/pulse.test.js). Elle permet de répondre à « ma facture a disparu »
   * sans ouvrir une session de support sur le dossier de la cliente, geste
   * lourd qui s'inscrit à SON journal d'accès.
   */
  byCollection: Array<{
    collection: string;
    count: number;
    /** ISO de la dernière écriture dans ce module, ou null. */
    lastAt?: string | null;
    /** Écritures des sept derniers jours dans ce module. */
    last7Days?: number;
  }>;
  /**
   * Jours DISTINCTS où quelque chose a bougé sur les trente derniers.
   * Un total brut ne distingue pas une organisation qui travaille tous les
   * jours d'une qui a tout saisi en une soirée ; celui-ci si.
   */
  activeDaysLast30: number;
  sites: { total: number; online: number };
  events: { last7Days: number; critical7Days: number };
  users: { total: number; active: number };
}

/**
 * LE RELEVÉ DU PARC (BLOCS E ET F)
 * ════════════════════════════════
 *
 * Ce que la Tour de contrôle sait de ses clientes, en un appel.
 *
 * Le bandeau comptait des organisations : « 4 clientes ». C'est un état civil,
 * pas une mesure — une cliente créée il y a six mois et jamais rouverte y
 * pesait autant qu'une autre qui facture tous les jours.
 *
 * Le relevé ne rend que des NOMBRES et des dates. Jamais de contenu, jamais
 * d'identité : on apprend qu'un espace est vivant, pas qui s'y trouve. C'est
 * la même limite que celle du pouls, et elle est tenue côté serveur.
 */
export interface ParcOrgInsight {
  id: string;
  name: string;
  status: string;
  /**
   * Sockets ouvertes et AUTHENTIFIÉES pour cette organisation, à l'instant de
   * l'appel.
   *
   * Des connexions, pas des personnes : la même personne avec deux fenêtres en
   * vaut deux. L'écran allume son point sur « au moins une », ce qui est
   * exact ; annoncer « deux personnes » ne le serait pas.
   */
  connections: number;
  /** ISO de la dernière écriture réelle, ou null si l'espace n'a rien produit. */
  lastActivityAt: string | null;
  /** Ce qu'elle a écrit sur la fenêtre courante. */
  records7d: number;
  /** La fenêtre d'avant, pour que « en hausse » repose sur deux nombres. */
  previous7d: number;
}

export interface ParcInsights {
  orgs: ParcOrgInsight[];
  totals: {
    organizations: number;
    /** Celles qui ont ÉCRIT sur la fenêtre — pas celles qui existent. */
    active7d: number;
    /** Combien d'espaces ont au moins une connexion ouverte. */
    connectedOrgs: number;
    records7d: number;
    previous7d: number;
  };
  /** La largeur de fenêtre employée, pour que l'écran l'annonce sans la deviner. */
  windowDays: number;
  at: string;
}

/** L'état d'une ronde de supervision de fond (BLOC F). */
export interface SupervisionSweep {
  name: string;
  everyMs: number;
  lastRunAt: string | null;
  dueAt: string | null;
  /** Calculé par le serveur : deux horloges donneraient deux verdicts. */
  overdue: boolean;
}

export interface SupervisionState {
  uptimeSeconds: number;
  sweeps: SupervisionSweep[];
}

/**
 * Un lien de téléchargement de l'installeur Business (BLOC C).
 *
 * Émis pour une organisation, mais il ne vaut PAS comme justificatif : le jeton
 * vit dans sa propre table côté serveur, jamais dans `sessions`, donc il
 * n'ouvre aucune route authentifiée. C'est la même forme que les liens d'appel
 * et les clés de commande.
 */
export interface DownloadLink {
  token: string;
  /** L'URL complète, fabriquée par le serveur : collable telle quelle. */
  url: string;
  expiresAt: string;
  release: { version: string; filename: string; byteSize: number; sha256: string };
}

/** Une version publiée de l'édition Business. */
export interface BusinessRelease {
  id: string;
  version: string;
  platform: string;
  filename: string;
  byteSize: number;
  sha256: string;
  createdAt: string;
  retiredAt: string | null;
}

/** Un compte d'une organisation cliente, tel que le rend la console. */
export interface AdminOrgUser {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  status: 'invited' | 'active' | 'suspended';
  invitedAt: string | null;
  joinedAt: string | null;
}

/**
 * Les rôles d'un compte dans son organisation.
 *
 * Nommé plutôt que répété : ces quatre valeurs apparaissaient en toutes
 * lettres à quatre endroits, et `lib/roleLabels.ts` a besoin d'en parler pour
 * les traduire dans la langue du métier (BLOC 6).
 *
 * `guest` n'est pas un siège de travail : c'est un accès occasionnel externe,
 * borné par un quota quotidien décompté côté serveur.
 */
export type UserRole = 'owner' | 'admin' | 'member' | 'guest';

export interface CreateOrganizationInput {
  /** Raison sociale — apparaît dans l'app de la cliente ET sur ses devis. */
  name: string;
  ownerEmail: string;
  plan: OrgPlan;
  /** Logo déjà redimensionné, en data-URL. Vide = initiales. */
  logoDataUrl?: string;
  /**
   * Le MÉTIER de l'organisation (BLOC 6), conservé côté serveur.
   *
   * Facultatif, et il le restera : la boîte de dialogue rapide du rail ne le
   * demande pas, et une organisation sans métier est parfaitement valable —
   * elle affiche les libellés de rôle génériques. En inventer un afficherait
   * des intitulés faux avec l'aplomb d'une donnée saisie.
   */
  trade?: string;
  /**
   * La LANGUE de l'organisation ('fr' | 'en'), choisie à l'atelier.
   *
   * Facultative : absente, l'organisation parle français — le produit actuel
   * ne perd rien. Chaque poste peut ensuite la suivre ou la remplacer par un
   * choix personnel (Réglages), qui reste local à ce poste-là.
   */
  language?: string;
  /** Les places de la formule : 1, 2, 5, 10 ou 25. */
  seats?: number;
}

/**
 * Ce que rend la création d'une organisation. Le jeton d'invitation n'est
 * affiché qu'UNE fois — amn-api n'en garde que l'empreinte.
 */
export interface CreateOrganizationResult {
  organization: AdminOrganization;
  owner: { id: string; email: string; role: string; status: string } | null;
  /**
   * `url` est l'adresse complète d'activation, composée PAR LE SERVEUR.
   * `null` quand aucune adresse publique n'est configurée (APP_PUBLIC_URL) —
   * le poste ne la fabrique jamais, il ne connaît que `file://` une fois
   * installé. Le jeton reste rendu à côté, pour qui saurait le coller ailleurs.
   */
  invitation: { token: string; url: string | null; expiresAt: string } | null;
  /**
   * L'adresse de l'application web, telle que le SERVEUR la connaît.
   *
   * Même règle que `invitation.url` : composée côté amn-api à partir
   * d'APP_BUSINESS_PUBLIC_URL — l'adresse de l'application des CLIENTES, et non
   * la nôtre —, `null` si elle n'est pas configurée. Le message de remise
   * en a besoin pour dire à la cliente où ouvrir l'application depuis son
   * téléphone — sans elle, elle n'a que l'installeur Windows, donc rien tant
   * qu'elle n'est pas devant son ordinateur.
   */
  appUrl: string | null;
}

export interface OrgInvitationResult {
  user: AdminOrgUser;
  invitation: { token: string; url: string | null; expiresAt: string };
}

export interface TempPasswordResult {
  user: { id: string; email: string; role: string; status: string };
  /** En clair, une seule fois : seule l'empreinte est stockée côté serveur. */
  password: string;
  /** L'adresse de l'application web — ce mot de passe repart dans un message. */
  appUrl: string | null;
}

/** Ce qu'AMN DevSec a fait sur le dossier d'une cliente, et quand. */
export type OrgAccessAction =
  | 'enter'
  | 'leave'
  | 'suspend'
  | 'reactivate'
  | 'invite'
  | 'password'
  /**
   * Un compte de l'organisation a été supprimé depuis notre supervision.
   *
   * Inscrit au journal DE LA CLIENTE, et pas seulement au nôtre : c'est chez
   * elle qu'un accès a disparu, et elle doit pouvoir le lire depuis ses
   * propres paramètres sans nous le demander.
   */
  | 'user_removed';

export interface OrgAccessEntry {
  id: number;
  orgId: string;
  orgName: string;
  actorEmail: string;
  action: OrgAccessAction;
  detail: string | null;
  createdAt: string;
}

/**
 * Le contexte client actif — ce que l'app affiche dans son bandeau permanent.
 *
 * Rendu par `support.enter()` ET par `support.restore()`, cette seconde voie
 * étant celle qui compte : le bandeau doit revenir tel quel après un
 * redémarrage de l'app, sinon « non masquable » ne veut rien dire.
 */
export interface SupportContext {
  orgId: string;
  orgName: string;
  plan: OrgPlan;
  status: OrgStatus;
  logoDataUrl: string | null;
  /**
   * Modules ouverts à cette organisation (BLOC E) ; `null`/absent = tous.
   * Sans ce champ, un contexte de support retombait silencieusement sur
   * « tous les modules » quel que soit le réglage réel de la cliente.
   */
  modules?: string[] | null;
  /**
   * Couleur d'accent de cette organisation (BLOC C) ; `null`/absent = défaut.
   * Même remarque : oublié ici, un accent choisi pour une cliente ne
   * s'appliquait jamais dans le contexte de support ouvert sur elle.
   */
  accent?: string | null;
  /** L'opérateur AMN DevSec au nom de qui l'accès est ouvert. */
  actorEmail: string;
  /** ISO — au-delà, amn-api refuse le jeton et l'app quitte le contexte. */
  expiresAt: string;
}

/** Une session de support fraîchement ouverte : le contexte + son jeton. */
export interface SupportSession {
  token: string;
  context: SupportContext;
}

/**
 * Marqueur porté par une erreur « amn-api n'a pas répondu ».
 *
 * Il distingue les deux échecs de connexion que l'application confondait, et
 * qui n'appellent pas la même conduite :
 *
 *   - **amn-api a répondu et refuse** (mot de passe faux, compte inconnu,
 *     organisation suspendue). Sa phrase est la réponse ; il n'y a rien à
 *     tenter d'autre ;
 *   - **amn-api est injoignable** (pas de réseau, `AMN_API_URL` absente). Là,
 *     et là seulement, un poste interne a le droit de retomber sur son compte
 *     local pour continuer à travailler hors ligne.
 *
 * Le marqueur voyage dans le MESSAGE parce que c'est tout ce qui survit au
 * passage IPC d'Electron : une erreur levée dans `ipcMain.handle` arrive dans
 * le renderer réduite à sa chaîne. `cleanErrorMessage` le retire avant
 * affichage, `isApiUnreachable` le lit — voir src/lib/errorMessage.ts.
 */
export const API_UNREACHABLE_PREFIX = '[amn-api-injoignable] ';

/**
 * Marqueur d'une REDIRECTION d'édition : le compte est valide, mais son
 * espace vit sur l'autre application, et la page de connexion l'y emmène.
 * Même mécanique que les autres marqueurs — ce n'est pas un refus, et
 * l'écran ne doit pas le peindre en rouge.
 */
export const REDIRECTION_PREFIX = '[amn-redirection] ';

/**
 * Marqueur du refus « quota invité épuisé » (BLOC D).
 *
 * Même procédé que `API_UNREACHABLE_PREFIX`, et pour la même raison : une
 * erreur qui traverse le pont IPC d'Electron ne conserve que son `message`.
 * Le champ `code` de la réponse amn-api serait donc perdu entre le processus
 * principal et l'interface, et il ne resterait qu'à reconnaître la panne à sa
 * phrase — ce qui casse au premier mot changé.
 */
export const GUEST_QUOTA_PREFIX = '[quota-invite-epuise] ';

/**
 * LE CODE HTTP D'UN REFUS, ACCROCHÉ AU MESSAGE.
 *
 * La file d'envoi (`src/lib/fileEnvoi.ts`) doit distinguer « plus tard » de
 * « non » : un 503 se renvoie, un 422 ne se renverra jamais avec succès et
 * doit sortir de la file en le disant. Sans le code, il ne resterait qu'à
 * reconnaître le refus à sa phrase — qui change au premier mot que le serveur
 * reformule, et qui est traduite.
 *
 * Même procédé que les deux marqueurs ci-dessus, et pour la même raison : une
 * propriété posée sur l'objet `Error` ne survit pas au pont IPC d'Electron,
 * seul le `message` traverse. `cleanErrorMessage` le retire avant affichage.
 */
export const STATUT_PREFIX = '[amn-statut:';

/** Accroche le code au message. */
export function marquerStatut(message: string, statut: number): string {
  return `${STATUT_PREFIX}${statut}] ${message}`;
}

/**
 * Relit le code accroché par `marquerStatut`.
 *
 * Rend `undefined` quand il n'y en a pas — ce qui veut dire « la requête n'a
 * jamais eu de réponse », et non « statut inconnu ». La file d'envoi lit
 * précisément cette absence comme le cas du réseau coupé, donc le plus
 * réessayable de tous.
 */
export function lireStatut(message: string): number | undefined {
  /*
    Pas d'ancrage sur le début : sous Electron le message traverse le pont IPC
    enrobé d'un « Error invoking remote method '…': », donc le marqueur n'est
    plus en tête. Un `^` ici rendrait le code invisible sur le poste, et
    visible sur le web — la file aurait réessayé indéfiniment un refus, mais
    seulement dans l'application installée.
  */
  const m = /\[amn-statut:(\d{3})\]/.exec(message);
  return m ? Number(m[1]) : undefined;
}

/**
 * Ce qu'il faut afficher quand le temps du jour est épuisé. Les minutes
 * viennent du serveur : le poste ne décide de rien, il rend compte.
 */
export interface GuestQuotaState {
  minutesPerDay: number;
  minutesUsed: number;
  /** ISO — minuit dans le fuseau de l'organisation. */
  resetsAt: string;
}

export interface RemoteSessionUser {
  id: string;
  orgId: string;
  email: string;
  /**
   * `guest` = accès occasionnel externe, borné par un quota quotidien décompté
   * côté serveur. Ce n'est pas un siège de travail : un employé permanent est
   * un `member`.
   */
  role: UserRole;
  /**
   * Ce mot de passe a-t-il été émis par le support plutôt que choisi par elle ?
   *
   * Rendu par amn-api à la connexion et à chaque `/me`. Le message de remise
   * demande de le changer ; sans ce drapeau, l'application ne pouvait rien
   * rappeler et la consigne ne tenait qu'à la mémoire de quelqu'un qui lit un
   * message une fois. Il retombe quand un nouveau mot de passe est CHOISI —
   * pas quand un bandeau est fermé.
   *
   * Optionnel : un serveur antérieur à ce champ ne le renvoie pas, et
   * « absent » doit valoir « rien à signaler », jamais un avertissement
   * affiché à tort.
   */
  passwordFromSupport?: boolean;
}

/**
 * Session amn-api d'un utilisateur nommé.
 *
 * C'est ce qui remplace le jeton opérateur partagé dès qu'une vraie personne
 * se connecte : toutes les requêtes et la WebSocket portent alors CE jeton, et
 * amn-api en déduit l'organisation. Une organisation cliente ne peut donc pas
 * voir les données d'une autre, même si le poste a été configuré à la main.
 */
export interface RemoteSession {
  token: string;
  expiresAt: string;
  user: RemoteSessionUser;
  org: OrgIdentity;
  /** État MFA du compte, tel que le serveur l'affirme à la connexion. */
  mfa?: MfaStatus;
  /** Vrai quand la session a été ouverte avec un code de secours. */
  usedBackupCode?: boolean;
}

/* ------------------------------ MFA / TOTP ----------------------------- */

/**
 * Ce que le serveur dit de la double authentification d'un compte.
 *
 * `available` est distinct de `enabled` : un serveur sans `MFA_SECRET_KEY` ne
 * SAIT PAS faire de MFA, ce qui n'est pas la même chose qu'un compte qui n'en
 * a pas. L'interface doit pouvoir expliquer laquelle des deux situations elle
 * affiche, sinon « activer » resterait grisé sans raison visible.
 */
export interface MfaStatus {
  available: boolean;
  enabled: boolean;
  /** Obligatoire pour ce rôle (owner/admin : ils ouvrent des sessions de support). */
  required: boolean;
  activatedAt: string | null;
  /** Un enrôlement est commencé mais pas confirmé. */
  pending: boolean;
  backupCodesRemaining: number;
  backupCodesTotal: number;
}

/** Ce que rend `/mfa/setup` : de quoi scanner OU recopier à la main. */
export interface MfaEnrolment {
  secret: string;
  /** Le même secret groupé par quatre, pour la saisie manuelle. */
  readableSecret: string;
  otpauthUri: string;
}

/**
 * Le résultat d'une première étape de connexion.
 *
 * Deux formes possibles, et l'appelant DOIT les distinguer : soit la session
 * est là, soit il reste un facteur à fournir. Les mélanger dans un seul type
 * optionnel produirait exactement le bug qu'on veut éviter — traiter un défi
 * comme une session.
 */
/**
 * Une organisation dont le compte est membre.
 *
 * `home` distingue l'organisation D'ORIGINE (celle qui a créé le compte) de
 * celles qu'on a rejointes sur invitation. La nuance compte à l'écran : on ne
 * quitte pas la sienne comme on quitte celle d'un associé.
 */
/** Une ligne de commande, telle que le site l'a envoyée. */
export interface OrderLine {
  label: string;
  sku: string;
  /** Décimale acceptée — 2,5 h de prestation. */
  quantity: number;
  /** Prix unitaire HORS TAXES, en centimes entiers. */
  unitPriceCents: number;
  vatRate: number;
}

export type OrderStatus =
  | 'new'
  | 'confirmed'
  | 'preparing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

/**
 * Une commande passée sur le site public.
 *
 * Écrite par amn-api à la réception, puis pilotée depuis le desktop. Le
 * `reference` est celui du SITE : c'est ce que le client final a sous les yeux,
 * et en inventer un second rendrait tout échange avec lui incompréhensible.
 */
export interface OrderData {
  reference: string;
  placedAt: string;
  status: OrderStatus;
  source: 'site' | 'manual';
  customer: { name: string; email: string; phone: string; address: string };
  lines: OrderLine[];
  note: string;
  /** Ce qui a déjà été réglé en ligne, en centimes. */
  paidCents: number;
  /** Total TTC au centime, calculé par le serveur à la réception. */
  totalCents: number;
  /**
   * La facture tirée de cette commande, s'il y en a une.
   *
   * Renseigné, il empêche d'en tirer une seconde — le garde-fou est ce champ,
   * pas la mémoire de la personne qui clique.
   */
  invoiceId: string | null;
  updatedAt: string;
}

export interface Order extends OrderData {
  id: string;
}

export interface MyOrganization {
  id: string;
  name: string;
  plan: string;
  /** Le rôle DANS cette organisation-là — `owner` chez soi, souvent `member` ailleurs. */
  role: string;
  logoDataUrl: string | null;
  accent: string | null;
  joinedAt: string | null;
  home: boolean;
}

export interface MyOrganizations {
  organizations: MyOrganization[];
  /** Celle qui porte la session en cours. */
  activeOrgId: string;
}

/**
 * Le verdict d'une vérification de mise à jour, à la demande.
 *
 * `unconfigured` est le cas de l'édition Business aujourd'hui : elle n'est
 * branchée sur aucun canal (voir `setupAutoUpdate`), donc répondre « à jour »
 * serait faux — on ne sait pas, faute d'avoir où regarder. L'écran le dit.
 */
/**
 * L'état d'une vérification de mise à jour, NOMMÉ plutôt que booléen.
 *
 * « Rien à faire », « je n'ai pas pu regarder » et « il n'y a rien à quoi me
 * comparer » se ressemblent dans le code et n'ont rien à voir à l'écran : le
 * premier rassure, les deux autres demandent quelque chose. Les confondre,
 * c'est afficher « à jour » à quelqu'un qui ne l'est pas.
 *
 * `ready` a été ajouté avec le canal Business (BLOC O) : une version
 * TÉLÉCHARGÉE ET VÉRIFIÉE qui n'attend qu'un geste n'est pas dans le même état
 * qu'une version qui existe quelque part (`available`). L'une demande un clic,
 * l'autre demande de patienter.
 */
export type UpdateCheck =
  | { status: 'uptodate'; version: string }
  | { status: 'available'; version: string }
  | { status: 'downloading'; version?: string }
  | { status: 'ready'; version: string }
  | { status: 'unconfigured'; reason: string }
  | { status: 'error'; message: string };

export type LoginOutcome =
  | { kind: 'session'; session: RemoteSession }
  | { kind: 'mfa'; challenge: string; expiresAt: string; email: string };

/* ------------------------------ Profiles ------------------------------ */

/**
 * Per-user profile. Shared across both operators (see amn-api profiles
 * collection) so each sees the other's photo and presence text everywhere.
 */
export interface UserProfile {
  email: string;
  name: string;
  /** Data-URL of an uploaded avatar, or '' for initials fallback. */
  photoDataUrl: string;
  /** Short custom presence text, e.g. "en mission chez client". */
  presenceText: string;
  updatedAt: string;
}

export interface UpdateProfileInput {
  name?: string;
  photoDataUrl?: string;
  presenceText?: string;
}

export interface ChangePasswordInput {
  email: string;
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResult {
  ok: boolean;
  error?: string;
}

/* --------------------------- Notification prefs --------------------------- */

/**
 * Ce qui peut déclencher une notification.
 *
 * Toutes les clés vivent ici, mais TOUTES NE CONCERNENT PAS TOUT LE MONDE :
 * un parc de sites supervisés, une alerte d'attaque et une mention dans un fil
 * d'équipe n'existent que chez AMN DevSec. C'est
 * `NOTIFICATION_PREFS` (@edition/exclusive) qui décide de ce qui est PROPOSÉ à
 * l'écran, édition par édition — une cliente ne doit pas régler des
 * événements qui ne lui arriveront jamais.
 */
export interface NotificationPrefs {
  siteOffline: boolean;
  criticalAlert: boolean;
  mention: boolean;
  taskAssigned: boolean;
  /**
   * Le rappel avant un rendez-vous.
   *
   * La seule notification qu'une cliente reçoive réellement — et la seule qui
   * n'avait pas de réglage : `AppointmentReminders` notifiait sans rien
   * consulter, donc l'écran des notifications proposait quatre interrupteurs
   * sans effet et taisait le seul événement vrai.
   */
  appointmentReminder: boolean;
  /**
   * L'activité des organisations clientes (BLOC G).
   *
   * N'existe que dans l'édition interne : une cliente n'a pas de parc à
   * surveiller. Le réglage n'apparaît donc que dans la liste d'AMN DevSec
   * (voir NOTIFICATION_PREFS dans @edition/exclusive), et il est réellement
   * consulté avant d'émettre — l'écran des notifications de ce projet a déjà
   * porté quatre interrupteurs sans effet, on ne recommence pas.
   */
  clientActivity: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  siteOffline: true,
  criticalAlert: true,
  mention: true,
  taskAssigned: true,
  appointmentReminder: true,
  clientActivity: true,
};

export interface AppInfo {
  name: string;
  version: string;
  platform: string;
  isElectron: boolean;
}

/** Local Ollama availability + installed models. */
export interface OllamaStatus {
  available: boolean;
  models: string[];
}

/** A single cyber/tech watch entry, parsed from a public RSS/Atom source. */
export interface WatchItem {
  id: string;
  /** Free-text category (feed-derived), e.g. "Vulnérabilité", "Cybersécurité". */
  category: string;
  /** Top-level grouping used by the UI filter. Absent (old cache) means 'security'. */
  group?: 'security' | 'tech';
  title: string;
  summary: string;
  source: string;
  /** ISO date. */
  date: string;
  /** Canonical article URL, when available. */
  link?: string;
}

/** Result of a watch-feed fetch, with graceful-degradation metadata. */
export interface WatchFeedResult {
  items: WatchItem[];
  /** ISO timestamp of the last successful fetch, or null if never fetched. */
  fetchedAt: string | null;
  /** True when at least one source was unreachable on the last refresh. */
  degraded: boolean;
}

export interface MessageAttachment {
  /**
   * Data-URL of an inline media file. Images are client-side resized before
   * send; short videos and voice notes are embedded as-is (size-capped in the
   * composer). Kept inline so the existing `messages` sync path carries them
   * unchanged — see the composer's size guard.
   */
  dataUrl: string;
  name: string;
  /** Media kind. Absent means 'image' (backwards-compatible with old records). */
  kind?: 'image' | 'video' | 'audio';
  /** Original MIME type, used to pick the right <video>/<audio> source type. */
  mime?: string;
}

export interface MessageReaction {
  emoji: string;
  authorEmail: string;
}

export interface Message {
  id: number;
  authorEmail: string;
  authorName: string;
  body: string;
  /** ISO timestamp */
  createdAt: string;
  attachments: MessageAttachment[];
  /** Id of the message this one replies to, if any. */
  replyToId: number | null;
  reactions: MessageReaction[];
  pinned: boolean;
}

export interface SendMessageInput {
  authorEmail: string;
  body: string;
  attachments?: MessageAttachment[];
  replyToId?: number | null;
}

/** Reaction emoji set — deliberately small and fixed, no full picker. */
export const REACTION_EMOJIS = ['👍', '👀', '✅', '🔥', '❗'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export type ClientStatus = 'active' | 'paused' | 'prospect';

export interface ClientEvent {
  id: number;
  clientId: number;
  title: string;
  detail: string;
  /** ISO timestamp */
  date: string;
}

export interface Client {
  id: number;
  name: string;
  company: string;
  status: ClientStatus;
  email: string;
  phone: string;
  notes: string;
  /** Data-URL of an uploaded avatar, or empty. */
  imageDataUrl: string;
  /** amn-api site ids supervised for this client — feeds the health score. */
  linkedSiteIds: string[];
  createdAt: string;
  updatedAt: string;
  events: ClientEvent[];
}

export interface CreateClientInput {
  name: string;
  company?: string;
  status?: ClientStatus;
  email?: string;
  phone?: string;
}

export interface UpdateClientInput {
  name?: string;
  company?: string;
  status?: ClientStatus;
  email?: string;
  phone?: string;
  notes?: string;
  imageDataUrl?: string;
  linkedSiteIds?: string[];
}

export interface AddClientEventInput {
  clientId: number;
  title: string;
  detail?: string;
}

/* ------------------------------- Quotes ------------------------------- */

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'refused';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'late';

export interface Quote {
  id: number;
  clientId: number;
  /**
   * Clé d'enregistrement du client, telle que l'écrit le miroir SQLite
   * (`src/main/clientsSync.ts`). Présente uniquement sur les devis remontés par
   * ce chemin ; `clientId` est alors absent, et c'est ce champ qui rattache le
   * devis à sa fiche.
   */
  clientSyncId?: string;
  /** Short mission title, e.g. "Supervision annuelle + audit initial". */
  title: string;
  /** Longer mission description. */
  detail: string;
  /** Tracker catalog offer id (see src/data/trackerCatalog.ts), free text. */
  trackerTier: string;
  priceEuro: number;
  status: QuoteStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuoteInput {
  clientId: number;
  title: string;
  detail?: string;
  trackerTier: string;
  priceEuro: number;
}

export interface UpdateQuoteInput {
  title?: string;
  detail?: string;
  trackerTier?: string;
  priceEuro?: number;
  status?: QuoteStatus;
  paymentStatus?: PaymentStatus;
}

/* ------------------------------ Facturation ------------------------------ */

/**
 * Le cycle de vie d'une facture — délibérément à sens unique.
 *
 * Une facture émise est un document comptable : la loi interdit de la modifier
 * ou de la supprimer, et impose une numérotation continue sans trou. D'où
 * l'absence de retour de `issued` vers `draft`, et d'où `cancelled`, qui
 * ANNULE sans effacer : le numéro reste dans la séquence, la facture reste
 * dans la liste, et la raison de l'annulation est conservée.
 */
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled';

export interface InvoiceLine {
  id: string;
  /** Désignation de la prestation — mention obligatoire. */
  label: string;
  /** Décimale acceptée : 2,5 jours, 1,5 h. */
  quantity: number;
  /** Prix unitaire HORS TAXES, en centimes entiers (voir src/lib/money.ts). */
  unitPriceCents: number;
  /** Taux de TVA en pourcentage : 20, 10, 5.5, 2.1, 0. */
  vatRate: number;
}

/**
 * Les coordonnées du client TELLES QU'ELLES ÉTAIENT à l'émission.
 *
 * Une facture émise ne doit plus jamais changer. Si elle lisait la fiche
 * client en direct, renommer une société ou corriger une adresse réécrirait
 * rétroactivement des documents déjà envoyés et déjà comptabilisés — donc on
 * fige une copie au moment de l'émission.
 */
export interface InvoiceParty {
  name: string;
  company: string;
  email: string;
  address: string;
  /** N° de TVA intracommunautaire du client, si fourni (autoliquidation, UE). */
  vatNumber: string;
}

export interface Invoice {
  id: string;
  /**
   * Numéro légal, séquentiel et définitif. Vide tant que la facture est un
   * brouillon : un brouillon n'a pas de numéro, sinon abandonner un brouillon
   * ferait un trou dans la séquence.
   */
  number: string;
  /** Fiche client d'origine (`Client.id`), pour les liens et les regroupements. */
  clientId: number;
  billTo: InvoiceParty;
  /** Date d'émission (ISO, jour). Vide tant que brouillon. */
  issuedAt: string;
  /** Date d'échéance de règlement (ISO, jour) — mention obligatoire. */
  dueAt: string;
  lines: InvoiceLine[];
  status: InvoiceStatus;
  /** Date d'encaissement (ISO, jour) ; vide tant qu'impayée. */
  paidAt: string;
  /** Moyen de règlement constaté, texte libre court. */
  paymentMethod: string;
  /** Raison d'annulation — obligatoire pour annuler, conservée telle quelle. */
  cancelReason: string;
  /** Conditions particulières, remerciements, référence de commande. */
  notes: string;
  /** Devis converti à l'origine de cette facture, s'il y en a un. */
  quoteId: number | null;
  /**
   * Projet auquel cet enregistrement se rattache (A.3), ou absent.
   *
   * Un simple identifiant : le projet ne tient aucune liste et ne recopie
   * rien — il retrouve ce qui le concerne en filtrant cette collection. Cet
   * enregistrement garde donc un seul endroit où il vit.
   */
  projectId?: string;

  createdAt: string;
  updatedAt: string;
}

/**
 * L'identité légale de l'émetteur — un enregistrement unique par organisation.
 *
 * Elle vit dans sa propre collection plutôt que dans les Paramètres du profil
 * parce qu'elle appartient à l'ENTREPRISE, pas à la personne connectée : deux
 * comptes de la même organisation doivent facturer sous la même raison
 * sociale, et ces champs ont valeur légale sur le document émis.
 */
export interface BillingIdentity {
  /** Raison sociale ou nom d'exercice. */
  legalName: string;
  address: string;
  /** Forme juridique : SAS, SARL, EI, auto-entrepreneur… */
  legalForm: string;
  /** SIREN ou SIRET. */
  siret: string;
  /** N° de TVA intracommunautaire ; vide si franchise en base. */
  vatNumber: string;
  /** Ville du greffe d'immatriculation (RCS). */
  rcsCity: string;
  /** Capital social, texte libre (« 1 000 € ») — sans objet pour une EI. */
  capital: string;
  email: string;
  phone: string;
  iban: string;
  bic: string;
  /**
   * Franchise en base de TVA (art. 293 B du CGI). Quand elle est active, le
   * document ne porte aucune TVA et affiche la mention obligatoire à la place.
   */
  vatExempt: boolean;
  /** Délai de règlement par défaut, en jours (30 est l'usage). */
  paymentTermDays: number;
  /** Taux annuel des pénalités de retard, en pourcentage — mention obligatoire. */
  latePenaltyRate: number;
}

/* -------------------------------- Tasks -------------------------------- */

export type SharedTaskStatus = 'todo' | 'doing' | 'done';

export interface SharedTask {
  id: number;
  title: string;
  detail: string;
  assigneeEmail: string;
  status: SharedTaskStatus;
  siteId: string | null;
  clientId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSharedTaskInput {
  title: string;
  detail?: string;
  assigneeEmail: string;
  siteId?: string | null;
  clientId?: number | null;
}

export interface UpdateSharedTaskInput {
  title?: string;
  detail?: string;
  assigneeEmail?: string;
  status?: SharedTaskStatus;
  siteId?: string | null;
  clientId?: number | null;
}

/* ------------------------------ Decisions ------------------------------ */

export interface Decision {
  id: number;
  title: string;
  detail: string;
  authorEmail: string;
  authorName: string;
  createdAt: string;
}

export interface CreateDecisionInput {
  title: string;
  detail?: string;
  authorEmail: string;
}

/* --------------------------- Knowledge base ---------------------------- */

export interface KnowledgeDoc {
  id: number;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateKnowledgeDocInput {
  title: string;
  body?: string;
}

export interface UpdateKnowledgeDocInput {
  title?: string;
  body?: string;
}

/* ---------------------- Recurring checklists (mock) --------------------- */

export type ChecklistFrequency = 'weekly' | 'monthly';

/** Static catalog of recurring checks — content is hardcoded, not stored. */
export interface ChecklistItemDef {
  id: string;
  label: string;
  detail: string;
  frequency: ChecklistFrequency;
}

/** The only thing actually persisted per item: when it was last checked. */
export interface ChecklistStateEntry {
  itemId: string;
  lastCheckedAt: string | null;
}

/* ---------------------------- Learning goals ---------------------------- */

export interface LearningGoal {
  id: number;
  ownerEmail: string;
  title: string;
  platform: string;
  progressPct: number;
  targetDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLearningGoalInput {
  ownerEmail: string;
  title: string;
  platform?: string;
  progressPct?: number;
  targetDate?: string | null;
}

export interface UpdateLearningGoalInput {
  title?: string;
  platform?: string;
  progressPct?: number;
  targetDate?: string | null;
}

/* ------------------------- Objectives (home) ------------------------- */

export interface Objective {
  id: number;
  label: string;
  unit: string;
  targetValue: number;
  currentValue: number;
  periodLabel: string;
  updatedAt: string;
}

export interface UpdateObjectiveInput {
  label?: string;
  unit?: string;
  targetValue?: number;
  currentValue?: number;
  periodLabel?: string;
}

/* ------------------------- amn-api (real sites) ------------------------- */

/**
 * Shapes mirror exactly what amn-api actually returns — see
 * amn-api/src/db/schema.sql. Deliberately thinner than the old mock Site
 * model (no revenue, no visitor trends, no fixed vulnerability count): those
 * never had a real data source. Business analytics is an explicit future
 * tracker tier ("AMN Suite") rather than something faked here.
 */
export type RemoteEventType =
  | 'connection'
  | 'request'
  | 'security_alert'
  | 'payment'
  | 'heartbeat'
  /** Dependency map reported by the tracker, scanned against OSV.dev (Suite). */
  | 'dependencies'
  /** Result of amn-api's own availability probe (Suite). */
  | 'availability'
  /** Result of an OSV.dev dependency scan (Suite). */
  | 'dependency_scan'
  /** Scheduled weekly digest produced by amn-api (Suite). */
  | 'weekly_report';
export type RemoteSeverity = 'critical' | 'warning' | 'info';

/** Tracker tier a site is supervised at — gates which detections amn-api runs. */
export type TrackerTier = 'sentinel' | 'sentinel-plus' | 'suite';

/**
 * What kind of threat an alert describes. Set by amn-api's detection engine in
 * `payload.kind` (see amn-api/src/tracker/engine.js); alerts forwarded straight
 * from a site's own tracker may carry none.
 */
/**
 * Les natures d'alerte, telles qu'amn-api les émet réellement.
 *
 * Cette liste est la TROISIÈME du même sujet — il y a celle du serveur
 * (`kind: '…'` dans src/tracker) et celle des libellés (lib/trackerAlerts).
 * Sept natures manquaient ici : les quatre familles d'injection, la sonde de
 * disponibilité, l'expiration de certificat et l'analyse de dépendances. Elles
 * s'affichaient donc en clé brute — « ssl_expiry » au lieu de « Certificat
 * proche de l'expiration ».
 *
 * `npm run check:supervision` croise désormais les trois listes avec ce que le
 * serveur émet vraiment, pour que l'oubli suivant fasse échouer un contrôle au
 * lieu de s'afficher chez une cliente.
 */
export type AlertKind =
  | 'brute_force'
  | 'rate_limit'
  | 'injection'
  | 'ip_reputation'
  | 'bot'
  | 'traffic_anomaly'
  | 'site_unreachable'
  | 'availability_down'
  | 'availability_ping'
  | 'ssl_expiry'
  | 'dependency_scan'
  | 'vulnerable_dependency'
  // Les familles d'injection, telles que le moteur de signatures les nomme.
  | 'sql'
  | 'xss'
  | 'nosql'
  | 'traversal';

export interface RemoteSiteState {
  siteId: string;
  /** Raw status as stored by amn-api ('online' on any event, 'unknown' before the first one). */
  status: string;
  activeVisitors: number;
  lastSeenAt: string | null;
  lastAlertAt: string | null;
  updatedAt: string;
}

export interface RemoteSite {
  id: string;
  name: string;
  createdAt: string;
  state: RemoteSiteState | null;
  /** Supervision tier. Absent on responses from an amn-api older than the tiers. */
  tier?: TrackerTier;
  /** Public URL, used by the Suite tier's independent availability probe. */
  url?: string | null;
  blockOnRateLimit?: boolean;
}

/** One hour of the traffic curve shown in a site's control desk. */
export interface TrafficPoint {
  /** 'YYYY-MM-DDTHH' bucket key (UTC). */
  hour: string;
  /** Start of the bucket as a full ISO timestamp, for formatting. */
  at: string;
  count: number;
}

/** Security score for a site, computed by amn-api from the alerts it received. */
export interface SiteScore {
  score: number;
  tone: 'good' | 'watch' | 'risk';
  reasons: string[];
  counts: Record<string, number>;
  byKind: Record<string, number>;
  alertCount: number;
}

/**
 * Everything a site's control desk needs, in one call: the traffic curve, the
 * alert history and the score. The score is computed server-side so the figure
 * shown here, in a generated report and in the weekly digest can never drift.
 */
export interface SiteSummary {
  site: { id: string; name: string; tier: TrackerTier; url: string | null; createdAt: string };
  state: RemoteSiteState | null;
  windowHours: number;
  traffic: TrafficPoint[];
  totalRequests: number;
  alerts: RemoteEvent[];
  score: SiteScore;
}

/* --------------------------- AMN SSL Monitor (BLOC 6) --------------------------- */

/**
 * TLS certificate state of one supervised host. The handshake runs on amn-api,
 * never on this machine, so both operators read the same figure and the
 * monitoring keeps working with every desktop closed.
 */
export interface SslStatus {
  host: string;
  /** Certificate authority, e.g. "Let's Encrypt". */
  issuer: string | null;
  subject: string | null;
  validFrom: string | null;
  validTo: string | null;
  /** Days until expiry; ≤ 0 means already expired. Null = never checked. */
  daysLeft: number | null;
  lastCheckedAt: string | null;
  /** Why the last check failed, when it did. */
  error: string | null;
  /** The supervised site this host belongs to, when there is one. */
  site: { id: string; name: string } | null;
}

/* ------------------------ Analyses récurrentes (BLOC 5) ------------------------ */

/** Which product a recurring run belongs to. */
export type ProductScheduleKind = 'scan' | 'comply';

export interface ProductSchedule {
  id: string;
  kind: ProductScheduleKind;
  url: string;
  /** Scanner tier; null for Comply. */
  tier: ScanTier | null;
  intervalDays: number;
  lastRunAt: string | null;
  nextRunAt: string;
  /** Score of the last automatic run — what the next one is compared against. */
  lastScore: number | null;
  /** Compliance points that passed last time (Comply only). */
  lastPassed: string[];
  createdAt: string;
}

export interface CreateScheduleInput {
  kind: ProductScheduleKind;
  url: string;
  tier?: ScanTier;
  intervalDays?: number;
}

/** A compliance point that used to pass and no longer does. */
export interface ComplyRegression {
  key: string;
  label: string;
  /** `échoue` = still reported but failing; `disparu` = gone from the report. */
  reason: 'échoue' | 'disparu';
}

/**
 * Pushed by amn-api when a scheduled run comes back worse than the previous
 * one — a dropped security score, or a compliance point that was good and no
 * longer is.
 */
export interface ProductRegression {
  kind: ProductScheduleKind;
  url: string;
  scoreBefore: number | null;
  scoreAfter: number | null;
  /** Id of the scan / comply check that produced this verdict. */
  runId: string;
  message: string;
  at: string;
  lost?: ComplyRegression[];
}

/* ------------------------------ Bureau SOC (BLOC 4) ------------------------------ */

/** One incident in the cross-site feed: an alert plus the site it fired on. */
export interface OrgIncident extends RemoteEvent {
  siteName: string;
}

/** Hourly event count for one site — the raw material of the heatmap. */
export interface OrgHourlyBucket {
  siteId: string;
  /** `YYYY-MM-DDTHH`, UTC. */
  hour: string;
  count: number;
}

/**
 * Visitor volume per country. Country granularity ONLY — amn-api stores no
 * city, no coordinates and performs no IP-to-location lookup.
 */
export interface OrgCountryBucket {
  /** ISO-3166-1 alpha-2. */
  country: string;
  count: number;
}

/** Everything the SOC control desk needs, aggregated server-side per org. */
export interface OrgOverview {
  days: number;
  since: string;
  sites: Array<{ id: string; name: string; tier: TrackerTier; url: string | null }>;
  incidents: OrgIncident[];
  hourly: OrgHourlyBucket[];
  countries: OrgCountryBucket[];
}

/** The client-embeddable security badge for one site. */
export interface SiteBadge {
  /** Public, unguessable id. Not a credential — it only unlocks name + score. */
  token: string;
  svgUrl: string;
  linkUrl: string;
  /** Ready-to-paste HTML for the client's own site. */
  snippet: string;
}

/**
 * L'état de la page de statut PUBLIQUE d'un site (BLOC 30).
 *
 * Volontairement minuscule : publiée ou non, et son adresse. Le jeton lui-même
 * n'a pas à remonter jusqu'à l'écran — ce qu'on y fait, c'est copier un lien
 * ou le retirer, et un jeton affiché finit copié ailleurs qu'il ne faut.
 */
export interface SiteStatusPage {
  published: boolean;
  url: string | null;
}

/** Structured weekly summary behind the Suite tier's recurring report. */
export interface SiteDigest {
  siteId: string;
  siteName: string;
  tier: TrackerTier;
  periodStart: string;
  periodEnd: string;
  score: number;
  scoreTone: string;
  scoreReasons: string[];
  totalEvents: number;
  totalAlerts: number;
  criticalAlerts: number;
  alertsByKind: Record<string, number>;
  availability: { probes: number; ok: number; ratio: number } | null;
  recommendations: string[];
}

export interface RemoteEvent {
  id: number;
  siteId: string;
  type: RemoteEventType;
  severity: RemoteSeverity | null;
  message: string | null;
  payload: Record<string, unknown>;
  occurredAt: string;
  /**
   * L'incident auquel cette alerte a été rattachée, s'il y en a un.
   *
   * Optionnel, et il le restera : les alertes enregistrées avant l'existence
   * des incidents n'en ont pas, et une alerte dont le rattachement a échoué
   * doit exister quand même — l'observation prime sur son regroupement.
   */
  incidentId?: string | null;
}

/** Les trois états d'un incident. Il n'y en a pas de quatrième. */
export type IncidentStatus = 'new' | 'acknowledged' | 'resolved';

/**
 * Les deux façons de fermer un incident, et elles ne disent pas la même chose.
 *
 * `resolved` : c'était vrai, c'est traité. `false_positive` : ce n'en était
 * pas un. Les distinguer est ce qui permettra un jour de corriger une
 * détection qui se trompe — au lieu d'apprendre aux opérateurs à ne plus la
 * lire.
 */
export type IncidentResolution = 'resolved' | 'false_positive';

/**
 * UN INCIDENT — le regroupement des alertes d'un même acteur sur un même site.
 *
 * Une alerte est une observation et ne se modifie jamais ; ce qu'on en décide
 * vit ici. Voir amn-api/src/tracker/incidents.js pour les trois bornes de la
 * corrélation, dont la principale : un incident résolu n'absorbe plus rien.
 */
export interface Incident {
  id: string;
  siteId: string;
  /**
   * Le nom du site, résolu par le serveur.
   *
   * Il manquait, et ça se voyait au pire endroit : trois cartes rouges
   * strictement identiques sur l'accueil — « Site injoignable — sonde et
   * traceur muets », trois fois — pour trois sites différents. Rien ne
   * permettait de savoir lesquels, ni s'il s'agissait d'un doublon
   * d'affichage. Un identifiant ne se lit pas ; un nom, si.
   *
   * `null` si le site a été retiré depuis : l'incident survit à son site, et
   * son histoire reste lisible.
   */
  siteName?: string | null;
  /** L'IP mise en cause, ou un acteur symbolique `infra:…` quand personne n'agit. */
  actor: string;
  actorKind: 'ip' | 'infrastructure' | 'inconnu';
  status: IncidentStatus;
  severity: RemoteSeverity;
  /** Les natures réunies. Plusieurs = une campagne, et c'est le cas qui vaut. */
  kinds: string[];
  alertCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolution: IncidentResolution | null;
  note: string;
  /** Calculé par le serveur : le même texte part à l'écran, au rapport et à la notification. */
  title: string;
  /** L'étouffoir qui fait taire cet incident, s'il y en a un. */
  suppressedBy?: string | null;
  /**
   * La fenêtre de maintenance pendant laquelle il est né, s'il y en a une.
   *
   * Il est dans la file, il se traite normalement — il n'a simplement réveillé
   * personne. L'écran le dit plutôt que de le masquer : un incident critique
   * qu'on découvre au matin sans savoir pourquoi le téléphone n'a pas sonné
   * est plus inquiétant que le même, étiqueté.
   */
  maintenanceId?: string | null;
}

/**
 * L'ESCALADE D'UN INCIDENT, poussée par amn-api.
 *
 * Elle ne dit pas « il s'est passé quelque chose » — le fil d'événements le
 * dit déjà. Elle dit « PERSONNE N'A ENCORE REGARDÉ », ce qu'un poste ouvert ne
 * peut pas déduire seul : c'est le serveur qui compte les minutes depuis la
 * première alerte, et lui seul sait que le délai est dépassé.
 */
export interface IncidentEscalation {
  incidentId: string;
  /** 1 = première alerte d'escalade, 2 = relance. Il n'y a pas de niveau 3. */
  level: number;
  title: string;
  body: string;
}

/** Un incident avec la chronologie complète de ses alertes. */
export interface IncidentDetail {
  incident: Incident;
  events: RemoteEvent[];
}

/**
 * Les mesures de la supervision.
 *
 * Pas de délai de détection : il demanderait de savoir quand l'attaque a
 * commencé, ce que nous ne savons pas. Les deux délais rendus ici sont
 * entièrement dans nos données, et en MÉDIANE — un incident laissé ouvert un
 * week-end décale une moyenne au point de la rendre inutile.
 */
/**
 * UN ÉTOUFFOIR DE FAUX POSITIF.
 *
 * Portée : un site, un acteur, une nature — les trois. Voir le long
 * commentaire d'amn-api `src/tracker/incidents.js` pour le raisonnement, dont
 * la raison pour laquelle une indisponibilité ne s'étouffe jamais.
 */
export interface AlertSuppression {
  id: string;
  siteId: string;
  siteName: string | null;
  actor: string;
  kind: string;
  /** Le libellé français de la nature, calculé par le serveur. */
  libelle: string;
  /** La note obligatoire : ce qui a été vérifié, et pourquoi. */
  note: string;
  createdBy: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  /**
   * Qui a rendu la parole.
   *
   * Le serveur l'enregistre depuis le premier jour ; rien ne le LISAIT. Une
   * supervision où l'on sait qui a fait taire une détection mais pas qui l'a
   * réveillée n'a qu'une moitié de piste : c'est la levée qui explique
   * pourquoi une alerte est réapparue un matin sans que rien n'ait changé
   * chez la cliente.
   */
  revokedBy: string | null;
  /** Ni révoqué ni expiré. */
  actif: boolean;
  /**
   * Ce que la règle a réellement absorbé — le seul chiffre qui permette de la
   * juger autrement que sur l'intention de qui l'a posée. Rien en trente jours
   * et elle n'avait pas lieu d'être ; deux mille et elle cachait peut-être
   * autre chose.
   */
  absorbe: { incidents: number; alertes: number };
}

/**
 * UNE FENÊTRE DE MAINTENANCE — quand l'indisponibilité était PRÉVUE.
 *
 * À ne pas confondre avec un étouffoir, qui est son opposé sur trois axes :
 *
 * |            | Étouffoir             | Fenêtre                       |
 * |------------|-----------------------|-------------------------------|
 * | Portée     | site + acteur + nature| le site ENTIER                |
 * | Durée      | trente jours          | quelques heures, 24 h au plus |
 * | Posée      | après coup            | AVANT, sur un créneau         |
 * | Nature     | jamais la disponibilité | surtout la disponibilité    |
 *
 * Ce qu'elle fait est étroit et c'est voulu : elle ne supprime rien — les
 * sondes tournent, les alertes sont enregistrées, l'incident est créé — elle
 * coupe seulement le RÉVEIL. Au matin l'incident est là, étiqueté, et se clôt
 * d'un geste. Voir amn-api `src/tracker/incidents.js` pour le raisonnement.
 */
export interface MaintenanceWindow {
  id: string;
  siteId: string;
  siteName: string | null;
  /** Ce qui est prévu, en une phrase. Obligatoire — le serveur la réclame. */
  reason: string;
  startsAt: string;
  endsAt: string;
  createdBy: string | null;
  createdAt: string;
  cancelledAt: string | null;
  cancelledBy: string | null;
  /** Calculé par le serveur : les trois états n'appellent pas les mêmes gestes. */
  etat: 'a-venir' | 'en-cours' | 'terminee' | 'annulee';
  /**
   * Ce qu'elle a réellement couvert. Même rôle que le décompte d'un
   * étouffoir : rien de couvert et la fenêtre était inutile — ou la migration
   * ne s'est pas faite.
   */
  couvert: { incidents: number; alertes: number };
}

export interface IncidentMetrics {
  windowDays: number;
  total: number;
  open: number;
  new: number;
  acknowledged: number;
  resolved: number;
  falsePositives: number;
  /** Incidents critiques ENCORE ouverts — le chiffre qui fait agir. */
  critical: number;
  medianTimeToAcknowledgeMs: number | null;
  medianTimeToResolveMs: number | null;
  /** Une médiane rassurante peut cacher un dossier oublié depuis trois mois. */
  oldestOpenAt: string | null;
}

/**
 * LE RAPPORT MENSUEL DE SUPERVISION
 *
 * Ce que l'organisation reçoit une fois par mois : la seule chose qui rende
 * visible un travail dont, le plus souvent, elle ne voit rien passer.
 *
 * Les champs sont en français parce que le document l'est : ce rapport part
 * chez une cliente, et le traduire à l'affichage aurait fait diverger le
 * chiffre de l'écran et celui du PDF — c'est le PDF qui aurait été cru.
 *
 * Ce que ce type NE porte PAS est délibéré, et documenté côté serveur
 * (amn-api `src/reports/monthly.js`) : aucune note globale inventée, aucun
 * délai de détection, aucun pourcentage de disponibilité.
 */
export interface MonthlyReport {
  organisation: { id: string; nom: string };
  /** `AAAA-MM`. */
  mois: string;
  /** « août 2026 » — déjà mis en forme par le serveur, source unique. */
  moisLisible: string;
  periode: { debut: string; fin: string };
  parc: { sites: number; noms: string[] };
  incidents: {
    total: number;
    traites: number;
    fauxPositifs: number;
    encoreOuverts: number;
    critiques: number;
    delaiMedianPriseEnChargeMs: number | null;
    delaiMedianResolutionMs: number | null;
    plusLongResoluMs: number | null;
    parNature: { kind: string; libelle: string; n: number }[];
    marquants: {
      titre: string;
      statut: IncidentStatus;
      resolution: IncidentResolution | null;
      premierVu: string;
      alertes: number;
    }[];
  };
  disponibilite: {
    /** Des interruptions CONSTATÉES, jamais un pourcentage extrapolé. */
    interruptions: number;
    commentaire: string;
  };
  certificats: {
    surveilles: number;
    aRenouveler: number;
    details: { hote: string; joursRestants: number }[];
  };
  analyses: { scans: number; conformite: number };
}

/**
 * Message pushed from amn-api's WebSocket stream, relayed verbatim by main.
 * amn-api emits each ingest under both `tracker:event` (canonical) and `event`
 * (kept so already-deployed desktop builds keep working); main forwards one.
 */
export interface RemoteEventPush {
  type: 'event' | 'tracker:event';
  siteId: string;
  siteName: string;
  event: RemoteEvent;
}

export interface RegisterSiteResult {
  id: string;
  name: string;
  createdAt: string;
  /** Plaintext API key — shown once, never retrievable again. */
  apiKey: string;
}

export type RemoteConnectionStatus = 'connecting' | 'online' | 'offline' | 'unconfigured';

/* --------------------- Shared collections (real sync) --------------------- */

/**
 * A generic synced record. `data` is the full domain object (a task, a
 * decision, a message, a profile…) as stored/merged; `id` is a stable string
 * id chosen by the client. `deleted` is a soft-delete tombstone so removals
 * propagate to the other operator too.
 */
export interface RemoteRecord {
  id: string;
  collection: string;
  data: Record<string, unknown>;
  updatedAt: string;
  deleted: boolean;
}

/** Collections synced through amn-api. */
/**
 * UN BLOC DE CONTENU (BLOC 3)
 * ═══════════════════════════
 *
 * Cinq formes, et cinq seulement. La tentation d'un éditeur ouvert est
 * permanente ; elle est écartée ici pour une raison précise : chaque forme
 * nouvelle doit se synchroniser, se rendre en lecture seule, survivre à une
 * édition simultanée et se relire dans six mois. Cinq formes couvrent ce qui a
 * été demandé (fiche de production, brief, page d'équipe, courses, budget) et
 * restent lisibles.
 *
 * La VIDÉO est un lien externe, jamais un fichier hébergé. Héberger de la
 * vidéo, c'est du stockage, de la bande passante et du transcodage — trois
 * métiers qu'AMN DevSec ne fait pas, pour un besoin (« montrer un rush ») que
 * n'importe quel lien satisfait.
 */
export type PageBlock =
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'image'; url: string; caption?: string }
  | { id: string; type: 'video'; url: string; caption?: string }
  | {
      id: string;
      type: 'checklist';
      items: {
        id: string;
        text: string;
        done: boolean;
        /**
         * Le lien du produit (BLOC 2). Optionnel, et c'est ce qui permet à la
         * liste de courses d'être une checklist ordinaire plutôt qu'un
         * sixième type de bloc : on retrouve la référence exacte au lieu de
         * chercher « la lessive, celle en bidon bleu ».
         */
        url?: string;
        /** Le prix en centimes, quand on le connaît. Sert au total du bloc. */
        priceCents?: number;
      }[];
      /**
       * Affiche le lien, le prix et le total. Un drapeau plutôt qu'un type de
       * bloc distinct : une checklist de tournage n'a que faire de trois
       * colonnes de plus, et une liste de courses est exactement une checklist
       * — cocher au fur et à mesure EST le geste.
       */
      shopping?: boolean;
    }
  | {
      id: string;
      type: 'table';
      /** En-têtes de colonnes. La largeur du tableau, c'est cette liste. */
      columns: string[];
      /** Chaque ligne a exactement `columns.length` cellules — voir `normalizePage`. */
      rows: string[][];
    };

/**
 * Un module du catalogue, tel qu'une organisation le voit (BLOC 4).
 *
 * `enabled` et `requested` sont calculés PAR LE SERVEUR pour cette
 * organisation : `modules: null` en base veut dire « tous », et un client qui
 * comparerait deux listes lui-même devrait connaître cette convention pour ne
 * pas afficher un catalogue entièrement fermé.
 */
export interface ModuleOffer {
  key: string;
  label: string;
  /** Ce que le module fait, en une phrase, sans jargon interne. */
  summary: string;
  enabled: boolean;
  /** Une demande est déjà en attente pour ce module. */
  requested: boolean;
}

/** Une demande de module. Lue par un humain — rien ne s'ouvre ni ne se facture tout seul. */
export interface ModuleRequest {
  id: string;
  orgId: string;
  moduleKey: string;
  message: string;
  requestedByEmail: string;
  status: 'pending' | 'done' | 'declined';
  createdAt: string;
  handledAt: string | null;
  handledByEmail: string | null;
  handledNote: string | null;
}

/** Une demande vue par AMN DevSec : la même, plus le nom de l'organisation. */
export interface ModuleRequestForOperator extends ModuleRequest {
  orgName: string;
}

/** Un compte de MON organisation, tel que je le vois (BLOC 6). */
export interface OrgMember {
  id: string;
  email: string;
  role: UserRole;
  status: string;
  invitedAt: string | null;
  joinedAt: string | null;
  /** Dernière connexion, lue dans le journal (ligne `login`). `null` : jamais entrée. */
  lastSeenAt?: string | null;
}

/** Une ligne du journal d'une personne : connexion ou geste, dans son organisation. */
export interface MemberJournalEntry {
  id: number;
  orgId: string;
  actorId: string | null;
  actorEmail: string;
  action: string;
  detail: string | null;
  createdAt: string;
}

/**
 * Une invitation émise. Le lien n'est rendu qu'UNE fois.
 *
 * `url` est nulle quand amn-api ne connaît pas l'adresse publique de
 * l'application (`APP_PUBLIC_URL`) : le jeton seul reste alors la seule chose
 * transmissible, et l'écran doit le dire plutôt que de laisser copier un lien
 * qui n'existe pas.
 */
export interface MemberInvitation {
  user: OrgMember;
  invitation: { token: string; url: string | null; expiresAt: string };
}

/* ───────────── La file des demandes (Blocs 1, 3, 4) ───────────── */

export type SupportRequestKind = 'message' | 'seat' | 'password_reset';
export type SupportRequestStatus = 'pending' | 'answered' | 'closed';

/** Une demande d'une cliente à son prestataire — et la réponse, quand elle vient. */
export interface SupportRequest {
  id: string;
  orgId: string | null;
  kind: SupportRequestKind;
  subject: string;
  body: string;
  requestedByEmail: string;
  status: SupportRequestStatus;
  reply: string | null;
  handledByEmail: string | null;
  handledAt: string | null;
  createdAt: string;
}

/** Ce que la Tour annonce quand une organisation naît, change ou disparaît. */
export interface OrgChange {
  kind: 'created' | 'updated' | 'removed';
  organization: AdminOrganization;
}

export interface SupportRequestForOperator extends SupportRequest {
  /** `null` quand l'adresse est inconnue de nous (mot de passe oublié). */
  orgName: string | null;
}

/* ───────────── La sentinelle des entrées (Bloc 5) ───────────── */

export type InputAlertFamily = 'sql_injection' | 'xss' | 'path_traversal' | 'command_injection';

/** Une tentative d'injection détectée dans un champ — un événement de sécurité, pas un blocage. */
export interface InputAlert {
  id: string;
  orgId: string | null;
  orgName?: string | null;
  userEmail: string | null;
  ip: string | null;
  route: string;
  field: string;
  family: InputAlertFamily;
  sample: string;
  statusCode: number | null;
  createdAt: string;
}

/* ───────────── Le lien de bienvenue (Bloc 2) ───────────── */

export type WelcomeLinkState = 'ready' | 'used' | 'expired';

export interface AdminWelcomeLink {
  id: string;
  orgId: string;
  userId: string;
  email: string | null;
  createdByEmail: string;
  createdAt: string;
  expiresAt: string;
  revealedAt: string | null;
  consumedAt: string | null;
  revokedAt: string | null;
  state: WelcomeLinkState;
}

/** Un lien émis. L'URL n'est rendue qu'UNE fois — le serveur n'en garde que l'empreinte. */
export interface WelcomeLinkIssued {
  link: AdminWelcomeLink;
  token: string;
  url: string | null;
  expiresAt: string;
}

/** Ce que la page publique sait AVANT la politique d'utilisation. */
export interface WelcomePreview {
  status: WelcomeLinkState;
  orgName?: string;
  productName?: string;
  firstName?: string | null;
  expiresAt?: string;
  alreadyRevealed?: boolean;
}

/** Les accès, rendus une fois après acceptation de la politique. */
export interface WelcomeAccess {
  email: string;
  password: string;
  appUrl: string | null;
  productName: string;
  installer: { url: string; version: string } | null;
  expiresAt: string;
}

/** Les rôles autorisés à MODIFIER une page. Lire ne se restreint jamais. */
export type PageEditorRole = 'owner' | 'admin' | 'member';

/**
 * UNE PAGE.
 *
 * `editorRoles` porte l'exigence « édition par rôle, lecture par tous » : tout
 * le monde voit la page à jour, seuls les rôles listés peuvent la changer.
 * C'est un réglage d'ÉCRITURE, pas une barrière de confidentialité — les
 * données d'une organisation restent isolées par organisation, comme partout
 * ailleurs.
 *
 * `scope` dit à quel module la page appartient (`equipe`, `personnel`,
 * `evenement`…). Un seul moteur, plusieurs modules : c'est ce qui évite de
 * réécrire la logique de blocs à chaque fois.
 */
export interface PageData {
  title: string;
  /** Emoji ou pictogramme court, purement visuel. */
  icon?: string;
  blocks: PageBlock[];
  editorRoles: PageEditorRole[];
  /** Le module propriétaire. Absent = page libre. */
  scope?: string;
  /** Le gabarit d'origine, gardé pour information. */
  template?: string;
  updatedBy?: string;
}

export type SyncedCollection =
  | 'tasks'
  | 'decisions'
  | 'knowledge'
  | 'objectives'
  | 'messages'
  | 'profiles'
  | 'clients'
  | 'quotes'
  | 'trackers'
  | 'notes'
  | 'reports'
  /** Rendez-vous du module Calendrier (édition Business). */
  /**
   * Pages composées de blocs (BLOC 3) — le moteur de contenu configurable.
   *
   * Une seule collection pour tout ce qui est « une page qu'on écrit à
   * plusieurs » : fiche de production, brief, page d'information d'équipe,
   * et les pages du module Personnel. Les modules qui l'emploient ne
   * dupliquent pas la logique de blocs, ils déclarent un `scope`.
   */
  | 'pages'
  | 'appointments'
  /**
   * Médiathèque autonome. L'édition interne dérive ses médias des pièces
   * jointes du chat d'équipe, mais une organisation qui travaille seule n'a
   * pas de chat, donc rien à dériver — d'où un stockage propre.
   */
  | 'media'
  /**
   * Per-finding remediation state ("corrigé"), keyed `<host>::<findingId>`.
   * Synced so a vulnerability one operator marks fixed is fixed for both, and
   * so the history survives the scan it came from (BLOC 5).
   */
  | 'remediation'
  /** Public URL of a site, keyed by site id (Sites registry). */
  | 'siteMeta'
  /** Internal discussion thread attached to a site. */
  | 'siteNotes'
  /**
   * Factures émises. Séparées de `quotes` et non pas un statut de plus :
   * un devis est une proposition modifiable, une facture est un document
   * comptable figé, numéroté et daté. Les confondre, c'est perdre la
   * numérotation continue qu'exige la loi.
   */
  | 'invoices'
  /**
   * Identité légale de l'émetteur — un unique enregistrement d'id `identity`.
   * Une collection plutôt qu'un réglage local : elle doit suivre
   * l'organisation d'un appareil à l'autre, comme les factures qu'elle
   * alimente.
   */
  | 'billing'
  /**
   * Le dossier client — notes INTERNES d'AMN DevSec sur une organisation
   * cliente (contact, historique, particularités).
   *
   * Point capital : ces enregistrements vivent dans le tenant d'AMN DevSec et
   * portent l'id de la cliente comme identifiant d'enregistrement. Ils ne sont
   * donc jamais dans SES données, et l'isolation par `org_id` d'amn-api suffit
   * à garantir qu'elle ne peut pas les lire — il n'y a aucune règle
   * supplémentaire à ne pas oublier, ce qui est précisément le but.
   */
  | 'orgDossier'
  /**
   * Projets (moteur A). Un projet est un POINT DE RATTACHEMENT : les tâches,
   * rendez-vous, notes et factures qui le concernent restent dans leurs
   * collections d'origine et portent simplement son identifiant. Un projet
   * n'est donc jamais une seconde base parallèle — c'est une vue.
   */
  | 'projects'
  /**
   * Le réglage du moteur pour cette organisation : statuts, structures,
   * champs affichés. Un unique enregistrement d'id `config`.
   */
  | 'projectConfig'
  /**
   * Dépenses. Une dépense est un montant PAYÉ, avec sa catégorie, son jour,
   * une note courte et — c'est ce qui la distingue d'une ligne de tableur —
   * la photo du justificatif.
   */
  | 'expenses'
  /**
   * Le réglage du module Dépenses : la liste courte des catégories, et les
   * budgets. Un unique enregistrement d'id `config`, comme `projectConfig`.
   */
  | 'expenseConfig'
  /**
   * Temps passé, un enregistrement par période travaillée. Celui dont
   * `endedAt` est vide est le chronomètre EN COURS. Le chronomètre vit donc
   * dans la collection synchronisée et non dans un état local, ce qui permet
   * de le lancer depuis le téléphone et de l'arrêter depuis le poste.
   */
  | 'timeEntries'
  /**
   * Le réglage du module Temps : le tarif horaire proposé quand un temps
   * devient une ligne de facture. Un unique enregistrement d'id `config`.
   */
  | 'timeConfig'
  // Commandes reçues du site public. Déposées par amn-api (voir
  // docs/COMMANDES.md côté serveur), lues et pilotées ici comme n'importe quel
  // enregistrement partagé.
  | 'orders'
  /**
   * Les événements du module Événements.
   *
   * POURQUOI CE NOM EST EN FRANÇAIS, seul de toute cette liste : `events`
   * était déjà pris. Côté amn-api, un « event » est une observation BRUTE
   * remontée par un tracker installé chez une cliente — une connexion, une
   * requête, un battement de cœur. Deux sens différents sur un même mot, dans
   * un dépôt où l'un des deux est déjà partout, se paie en relectures ratées
   * pendant des années. Le nom français lève l'ambiguïté à la lecture, ce qui
   * est exactement son travail.
   */
  | 'evenements';

export interface PresenceEntry {
  email: string;
  online: boolean;
}

/* ------------------------------ Appels audio (WebRTC) ------------------------------ */

/**
 * One WebRTC signalling message, relayed operator-to-operator by the amn-api
 * hub. The hub never inspects `payload` — the audio itself is peer-to-peer and
 * never transits amn-api.
 *
 * `undelivered` is synthesised locally when the hub reports that the callee had
 * no open socket: it is what turns a dead ring into an immediate "hors ligne".
 */
export type CallSignalKind =
  | 'offer'
  | 'answer'
  | 'ice'
  | 'hangup'
  | 'reject'
  | 'busy'
  | 'undelivered'
  /**
   * Renegotiation of an ALREADY established call — adding or removing the
   * screen-share video track (BLOC B). Distinct kinds rather than reusing
   * offer/answer: a second `offer` on a live call would otherwise be read as a
   * new incoming call, and the callee would answer "occupé" to the very call
   * it is already in.
   */
  | 'renegotiate'
  | 'renegotiate-answer';

export interface CallSignal {
  type: 'signal';
  kind: CallSignalKind;
  /** Identifies one call attempt end-to-end; stale signals are ignored. */
  callId: string;
  /** The other operator's email, stamped by the hub — never client-supplied. */
  from: string;
  payload: unknown;
}

export interface OutgoingCallSignal {
  to: string;
  kind: CallSignalKind;
  callId: string;
  payload?: unknown;
}


/* ---------------------- Lien d'appel anonyme (BLOC B.2) --------------------- */

/**
 * Un lien qu'on envoie à quelqu'un SANS COMPTE pour qu'il puisse appeler.
 *
 * Le jeton en clair n'est rendu qu'à la création, une seule fois : amn-api n'en
 * garde que l'empreinte. Il n'est donc pas relisible ensuite, y compris par
 * nous — un lien perdu se réémet, il ne se retrouve pas.
 */
export interface CallLink {
  id: string;
  /** Mémo privé de l'hôte. N'est JAMAIS exposé au visiteur. */
  label: string;
  expiresAt: string;
  state: 'ready' | 'expired' | 'used';
}

/** Ce que rend la création — la seule occasion de lire le jeton. */
export interface CreatedCallLink {
  id: string;
  token: string;
  /**
   * L'adresse complète à envoyer, composée PAR LE SERVEUR.
   *
   * `null` quand aucune adresse publique n'est configurée côté serveur
   * (`APP_PUBLIC_URL`). Le poste ne la fabrique jamais lui-même : installé, il
   * ne connaît que `file://`, et une adresse composée là-bas donne un chemin
   * sur la machine de qui l'émet — le défaut exact observé en v1.2.27.
   */
  url: string | null;
  expiresAt: string;
  label: string;
}


/* -------------------- Sessions ouvertes et journal d'accès ------------------ */

/**
 * Un appareil connecté à ce compte.
 *
 * `id` est un identifiant COURT dérivé de l'empreinte du jeton, jamais
 * l'empreinte elle-même : il suffit à désigner la session à fermer, et ne
 * permet pas de la rejouer s'il fuyait.
 */
export interface ActiveSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  /** Vrai pour l'appareil depuis lequel on regarde — à ne pas fermer par mégarde. */
  current: boolean;
  /** Renseigné quand la session est une session de support ouverte sur une cliente. */
  supportOrgId: string | null;
}

/** Une ouverture de l'espace d'une organisation, telle que la cliente la voit. */
export interface OrgAccessRecord {
  actorEmail: string;
  action: string;
  detail: string;
  createdAt: string;
}

/* ------------------------------ Scanner (Produits) ------------------------------ */

/** Scan depth. Each tier is a superset of the previous one. */
export type ScanTier = 'lite' | 'pro' | 'elite';

export type ScanStatus = 'pending' | 'running' | 'done' | 'error';

/** Ordered least → most serious; drives colour and sort everywhere. */
export type ScanSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

/** One detected weakness, with the concrete fix for it. */
export interface ScanFinding {
  id: string;
  title: string;
  severity: ScanSeverity;
  /**
   * transport | headers | cookies | disclosure | email | cms | cve | injection |
   * xss | ports | exposure
   *
   * `email` (SPF/DMARC) et `exposure` (fichiers sensibles, méthodes HTTP) sont
   * venus combler deux angles morts : le scanner ne regardait pas le DNS, donc
   * pas l'usurpation d'email — le risque le plus probable pour une PME.
   */
  category: string;
  detail: string;
  recommendation: string;
  /** What was observed (header value, tested parameter…), when relevant. */
  evidence: string | null;
  /** OWASP Top 10 bucket, e.g. "A05:2021 – Security Misconfiguration". */
  owasp: string | null;
  cve: string | null;
}

export type ScanSeveritySummary = Record<ScanSeverity, number>;

/** Elite-only before/after delta against the previous scan of the same URL. */
export interface ScanComparison {
  previousScanId: string;
  previousScannedAt: string;
  previousScore: number | null;
  resolved: ScanFinding[];
  introduced: ScanFinding[];
  unchangedCount: number;
  summaryBefore: ScanSeveritySummary;
  summaryAfter: ScanSeveritySummary;
}

export interface ScanResults {
  target: { url: string; host: string; ip: string | null };
  cms: { name: string; version: string | null; ecosystem: string } | null;
  httpStatus: number;
  findings: ScanFinding[];
  summary: ScanSeveritySummary;
  scannedAt: string;
  comparison?: ScanComparison | null;
}

export interface Scan {
  id: string;
  url: string;
  tier: ScanTier;
  status: ScanStatus;
  score: number | null;
  results: ScanResults | Record<string, never>;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

/** Live progress frame pushed over the WebSocket while a scan runs. */
export interface ScanProgress {
  scanId: string;
  status: ScanStatus;
  /** Human-readable step, e.g. "Analyse des en-têtes de sécurité…". */
  step: string;
  pct: number;
  score?: number;
  error?: string;
  /** Present on the terminal `done` frame: the finished scan row. */
  scan?: Scan;
}

/* ------------------------- Comply (conformité RGPD) ------------------------ */

/** One RGPD point that is missing or at risk, with its concrete fix. */
export interface ComplyFinding {
  id: string;
  title: string;
  severity: ScanSeverity;
  /** consent | transparency | security | trackers */
  category: string;
  detail: string;
  recommendation: string;
  evidence: string | null;
  /** Legal reference, e.g. "RGPD art. 7" — the Comply analogue of `owasp`. */
  article: string | null;
}

/** A pass/fail line per checked point, so the UI can show what *did* pass too. */
export interface ComplyCheckItem {
  key: string;
  label: string;
  passed: boolean;
}

export interface ComplyResults {
  target: { url: string; host: string; ip: string | null };
  httpStatus: number;
  checks: ComplyCheckItem[];
  findings: ComplyFinding[];
  /** Names of the third-party trackers detected in the page. */
  trackers: string[];
  summary: ScanSeveritySummary;
  checkedAt: string;
}

export interface ComplyCheck {
  id: string;
  url: string;
  status: ScanStatus;
  score: number | null;
  results: ComplyResults | Record<string, never>;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

/** Live progress frame pushed over the WebSocket while a check runs. */
/**
 * Un référentiel de conformité proposé par le serveur.
 *
 * `planned` est aussi important que `available` : masquer ce qui viendra
 * donnerait l'impression que Comply ne saura jamais rien faire d'autre que le
 * RGPD. Mais un `planned` ne s'analyse PAS — c'est le serveur qui refuse, pas
 * l'interface qui grise, pour que le refus tienne même si la requête est
 * fabriquée à la main.
 */
export interface ComplyReferential {
  id: string;
  label: string;
  /** Le territoire où il s'applique : « Union européenne », « Californie »… */
  jurisdiction: string;
  status: 'available' | 'planned';
}

export interface ComplyReferentialCatalog {
  referentials: ComplyReferential[];
  /** Celui qui s'applique quand aucun n'est demandé. */
  default: string;
}

export interface ComplyProgress {
  checkId: string;
  status: ScanStatus;
  step: string;
  pct: number;
  score?: number;
  error?: string;
  /** Present on the terminal `done` frame: the finished check row. */
  check?: ComplyCheck;
}

/* --------------------------------- Vault --------------------------------- */

/**
 * Local-only password vault. Deliberately NOT part of {@link SyncedCollection}:
 * these entries must never reach amn-api or Supabase, so they never go through
 * `useSync`/`upsert` — the bridge's own `vault` namespace talks straight to
 * on-disk storage (encrypted in Electron, plain localStorage in the browser).
 */
export type VaultCategory = 'api' | 'accounts' | 'servers' | 'trackers' | 'orgs' | 'other';

export interface VaultEntry {
  id: string;
  label: string;
  username: string;
  password: string;
  /** Optional; '' when unset. */
  url: string;
  /** Optional; '' when unset. */
  notes: string;
  category: VaultCategory;
  createdAt: string;
  updatedAt: string;
}

/** One remote-control input event, sent over the call's data channel (B.2). */
export interface RemoteInputEvent {
  kind: 'move' | 'down' | 'up' | 'wheel' | 'key';
  /** Normalised 0..1 position on the shared screen. */
  x?: number;
  y?: number;
  /** 0 left, 1 middle, 2 right. */
  button?: number;
  delta?: number;
  /** Windows virtual-key code. */
  vk?: number;
  pressed?: boolean;
}

export interface AmnBridge {
  auth: {
    login(email: string, password: string): Promise<AuthResult>;
    changePassword(input: ChangePasswordInput): Promise<ChangePasswordResult>;
  };
  profiles: {
    /** All operator profiles, so avatars/presence text render everywhere. */
    list(): Promise<UserProfile[]>;
    get(email: string): Promise<UserProfile>;
    updateSelf(email: string, patch: UpdateProfileInput): Promise<UserProfile>;
  };
  prefs: {
    get(email: string): Promise<NotificationPrefs>;
    update(email: string, patch: Partial<NotificationPrefs>): Promise<NotificationPrefs>;
  };
  messages: {
    list(): Promise<Message[]>;
    send(input: SendMessageInput): Promise<Message>;
    /** Toggles the given emoji reaction from this author on/off. */
    react(id: number, emoji: string, authorEmail: string): Promise<Message>;
    setPinned(id: number, pinned: boolean): Promise<Message>;
  };
  clients: {
    list(): Promise<Client[]>;
    create(input: CreateClientInput): Promise<Client>;
    update(id: number, patch: UpdateClientInput): Promise<Client>;
    addEvent(input: AddClientEventInput): Promise<Client>;
    remove(id: number): Promise<void>;
  };
  quotes: {
    list(): Promise<Quote[]>;
    create(input: CreateQuoteInput): Promise<Quote>;
    update(id: number, patch: UpdateQuoteInput): Promise<Quote>;
    remove(id: number): Promise<void>;
  };
  tasks: {
    list(): Promise<SharedTask[]>;
    create(input: CreateSharedTaskInput): Promise<SharedTask>;
    update(id: number, patch: UpdateSharedTaskInput): Promise<SharedTask>;
    remove(id: number): Promise<void>;
  };
  decisions: {
    list(): Promise<Decision[]>;
    create(input: CreateDecisionInput): Promise<Decision>;
    remove(id: number): Promise<void>;
  };
  knowledge: {
    list(): Promise<KnowledgeDoc[]>;
    create(input: CreateKnowledgeDocInput): Promise<KnowledgeDoc>;
    update(id: number, patch: UpdateKnowledgeDocInput): Promise<KnowledgeDoc>;
    remove(id: number): Promise<void>;
  };
  checklist: {
    getState(): Promise<ChecklistStateEntry[]>;
    check(itemId: string): Promise<ChecklistStateEntry>;
  };
  learning: {
    list(): Promise<LearningGoal[]>;
    create(input: CreateLearningGoalInput): Promise<LearningGoal>;
    update(id: number, patch: UpdateLearningGoalInput): Promise<LearningGoal>;
    remove(id: number): Promise<void>;
  };
  objectives: {
    list(): Promise<Objective[]>;
    update(id: number, patch: UpdateObjectiveInput): Promise<Objective>;
  };
  /**
   * Talks to the central amn-api. In Electron, the operator token never
   * leaves the main process — the renderer only sees the results, over IPC.
   */
  remote: {
    /**
     * Session amn-api de l'utilisateur connecté.
     *
     * Tant qu'aucune session n'est ouverte, les appels partent avec le jeton
     * opérateur partagé (AMN DevSec) s'il est configuré — c'est le mode
     * historique des postes d'Aaron et Mohamed. Dès qu'une session existe,
     * elle prend le pas : c'est elle qui détermine l'organisation, donc les
     * données visibles.
     */
    session: {
      /** Échange email/mot de passe contre une session. Lève l'erreur d'amn-api telle quelle. */
      /**
       * Première étape : email + mot de passe.
       *
       * Rend soit une session, soit un DÉFI quand la MFA est active. Le défi
       * n'est pas un jeton de session et n'ouvre rien — il s'échange contre
       * une session via {@link loginMfa}.
       */
      login(email: string, password: string): Promise<LoginOutcome>;
      /** Seconde étape : le code du téléphone, ou un code de secours. */
      loginMfa(input: { challenge: string; code?: string; backupCode?: string }): Promise<RemoteSession>;
      /** Revalide un jeton stocké au démarrage. `null` si amn-api l'a refusé. */
      restore(token: string): Promise<RemoteSession | null>;
      /** Termine la session côté serveur et repasse au jeton opérateur (ou à rien). */
      clear(): Promise<void>;
      /**
       * Accepte une invitation : fixe le mot de passe et ACTIVE le compte.
       *
       * Le serveur renvoie une session complète, donc l'invitée est connectée
       * dans la foulée — lui redemander de saisir le mot de passe qu'elle vient
       * de choisir serait une étape de plus sans rien vérifier de plus.
       *
       * Le jeton est à usage unique et daté : une deuxième tentative avec le
       * même lien échoue, ce qui est le comportement voulu et ce que l'écran
       * doit savoir dire.
       */
      acceptInvitation(token: string, password: string): Promise<LoginOutcome>;
      /**
       * Change le mot de passe du compte connecté.
       *
       * Distinct de `auth.changePassword`, qui vise le compte LOCAL (SQLite).
       * Un compte amn-api créé avec un mot de passe temporaire doit pouvoir
       * s'en défaire, sinon ce mot de passe transmis de vive voix reste
       * définitif.
       */
      changePassword(currentPassword: string, newPassword: string): Promise<void>;
      /**
       * Les organisations dont le compte connecté est MEMBRE.
       *
       * À ne pas confondre avec `listOrganizations()` de la console admin, qui
       * rend les organisations qu'AMN DevSec supervise. Les deux listes
       * coexistent et répondent à deux questions différentes : « les miennes »
       * et « celles dont je m'occupe ».
       */
      listMyOrganizations(): Promise<MyOrganizations>;
      /**
       * Bascule sur une autre de MES organisations.
       *
       * Le serveur RÉÉMET la session : le jeton rendu remplace l'ancien, qui
       * est mort à cet instant. C'est pourquoi cette méthode rend une session
       * complète et non un simple accusé — l'appelant doit adopter le nouveau
       * justificatif, exactement comme après une connexion.
       */
      switchOrganization(orgId: string): Promise<RemoteSession & { role: string }>;
    };
    listSites(): Promise<RemoteSite[]>;
    getSiteEvents(siteId: string, opts?: { since?: string; limit?: number }): Promise<RemoteEvent[]>;
    registerSite(name: string): Promise<RegisterSiteResult>;
    /** Renames a registered site. */
    updateSite(id: string, name: string): Promise<RemoteSite>;
    /** Changes a site's supervision tier / probe URL without touching its name. */
    configureSite(id: string, patch: { tier?: TrackerTier; url?: string | null }): Promise<RemoteSite>;
    /** Traffic curve + alert history + security score for a site's control desk. */
    getSiteSummary(id: string, hours?: number): Promise<SiteSummary>;
    /** Structured weekly digest, on demand (used to generate a report). */
    getSiteDigest(id: string): Promise<SiteDigest>;
    /** Deletes a registered site (cascades its state + events). */
    deleteSite(id: string): Promise<void>;
    /** Current live-connection status (WebSocket to amn-api). */
    getConnectionStatus(): Promise<RemoteConnectionStatus>;
    /** Subscribes to live event pushes. Returns an unsubscribe function. */
    onEvent(callback: (push: RemoteEventPush) => void): () => void;
    /** Subscribes to connection status changes. Returns an unsubscribe function. */
    onConnectionStatusChange(callback: (status: RemoteConnectionStatus) => void): () => void;

    /* --- Shared collections (tasks/decisions/… synced between operators) --- */
    listRecords(collection: SyncedCollection): Promise<RemoteRecord[]>;
    /**
     * TOUT L'ESPACE EN UN ALLER-RETOUR.
     *
     * MESURÉ en entrant dans le dossier d'une organisation cliente :
     * vingt-huit `listRecords`, une par collection. Le temps SERVEUR est
     * négligeable — deux millisecondes chacune — mais un navigateur n'ouvre que
     * six connexions par origine, donc vingt-huit requêtes font cinq vagues
     * successives. À 300 ms de latence, une seconde et demie passée à attendre.
     *
     * Rend une carte `collection → enregistrements`. Une collection demandée et
     * vide est PRÉSENTE et vide : l'absence d'une clé signifie que le serveur
     * ne l'a pas traitée, ce qui n'est pas la même chose.
     */
    listRecordsBulk(collections: SyncedCollection[]): Promise<Record<string, RemoteRecord[]>>;
    upsertRecord(
      collection: SyncedCollection,
      id: string,
      data: Record<string, unknown>,
    ): Promise<RemoteRecord>;
    deleteRecord(collection: SyncedCollection, id: string): Promise<RemoteRecord>;
    /** Live record changes pushed from amn-api. Returns an unsubscribe function. */
    onRecord(callback: (record: RemoteRecord) => void): () => void;

    /* --- Presence --- */
    /** Tells the main process which operator is signed in (for presence + attribution). */
    setIdentity(email: string | null): void;
    getPresence(): Promise<PresenceEntry[]>;
    onPresence(callback: (users: PresenceEntry[]) => void): () => void;

    /* --- Appels audio (WebRTC) --- */
    /**
     * Relays one signalling message to the other operator through amn-api.
     * Resolves false when the live socket is down — the caller must then fail
     * the call rather than ring into nothing.
     */
    sendCallSignal(signal: OutgoingCallSignal): Promise<boolean>;
    /** Signalling messages addressed to this operator. Returns an unsubscribe. */
    onCallSignal(callback: (signal: CallSignal) => void): () => void;

    /* --- Les membres de MON organisation (BLOCS 6 et 7) --- */
    /**
     * MES COLLÈGUES — pas la console d'administration d'AMN DevSec.
     *
     * Ces routes agissent sur l'organisation de la session, jamais sur une
     * autre : le serveur prend l'organisation dans `req.auth`, donc aucun
     * identifiant fabriqué dans un corps de requête ne peut la détourner.
     * C'est ce qui les distingue de `remote.admin.*`, réservé à AMN DevSec.
     *
     * Elles existaient côté serveur depuis longtemps sans qu'aucun écran ne
     * les appelle : une organisation cliente devait donc nous écrire pour
     * ajouter quelqu'un chez elle.
     */
    members: {
      /** Tous les comptes de l'organisation. Lisible par n'importe quel membre. */
      list(): Promise<OrgMember[]>;
      /**
       * Invite une adresse. Rend un lien à USAGE UNIQUE, affiché une seule
       * fois : amn-api n'a aucun transport mail, et le jeton n'est pas
       * conservé en clair. À transmettre soi-même.
       */
      invite(input: { email: string; role: UserRole }): Promise<MemberInvitation>;
      /** Retire un compte : ses sessions tombent, sa place se libère. Propriétaire ou admin. */
      remove(userId: string): Promise<void>;
      /** L'historique d'une personne — connexions et gestes — depuis le journal. */
      journal(userId: string): Promise<MemberJournalEntry[]>;
      /** Change le rôle d'un membre. Réservé à owner/admin par le serveur. */
      setRole(userId: string, role: UserRole): Promise<OrgMember>;
      /** Suspend ou réactive un membre. */
      setStatus(userId: string, status: 'active' | 'suspended'): Promise<OrgMember>;
    };

    /* --- Écrire à son prestataire, demander une place (Blocs 1, 4) --- */
    assistance: {
      /** Les demandes de CETTE organisation, avec leurs réponses. */
      list(): Promise<SupportRequest[]>;
      /** Envoie une demande. `seat` = une place de plus ; `message` = objet + texte. */
      send(input: { kind: 'message' | 'seat'; subject?: string; body?: string }): Promise<SupportRequest>;
    };

    /* --- Sans session : mot de passe oublié, lien de bienvenue (Blocs 2, 3) --- */
    /**
     * « Mot de passe oublié » : prévient le prestataire. La réponse est la
     * même que l'adresse existe ou non — amn-api n'a pas de transport mail,
     * rien n'est envoyé, et c'est dit honnêtement.
     */
    forgotPassword(email: string): Promise<{ ok: boolean; message: string }>;
    welcome: {
      inspect(token: string): Promise<WelcomePreview>;
      reveal(token: string): Promise<WelcomeAccess>;
      confirm(token: string): Promise<{ ok: boolean; status: WelcomeLinkState }>;
    };
    /** La réponse du prestataire arrive sur la socket de l'organisation (Bloc 4). */
    onSupportAnswered(callback: (request: SupportRequest) => void): () => void;

    /* --- Le catalogue des modules, et les demander (BLOC 4) --- */
    /**
     * MODULES : UNE IDENTITÉ, PAS UNE CLÉ NUE
     *
     * Le catalogue vit sur le SERVEUR (`MODULE_CATALOGUE`, amn-api) et non dans
     * une édition du desktop, pour la même raison que la liste des modules
     * ouverts : c'est le serveur qui arbitre, le poste apprend.
     *
     * Le catalogue montre AUSSI ce qui n'est pas ouvert ici. Montrer une porte
     * fermée est le prix à payer pour qu'une demande soit possible : une
     * cliente qui ignore qu'un module existe ne le réclamera jamais, et la
     * seule façon de le lui apprendre serait de l'appeler pour le lui vendre.
     *
     * Aucun prix n'y figure. Le chantier demandait la fondation d'une
     * tarification par module, pas la tarification : un prix suppose une
     * monnaie, une périodicité, une TVA, un prorata et un moyen de paiement,
     * cinq décisions qui ne sont pas prises. En afficher un ici en ferait un
     * engagement.
     */
    modules: {
      /** Le catalogue complet, avec ce qui est ouvert et ce qui est déjà demandé. */
      catalogue(): Promise<ModuleOffer[]>;
      /**
       * Demande un module. Rend `created: false` quand la demande existait
       * déjà : recliquer par hésitation ne doit ni échouer ni faire doublon.
       * Lève quand le module est déjà ouvert (409) — un écran qui le propose
       * alors qu'on l'a se trompe, et le taire cacherait le défaut.
       */
      request(input: { module: string; message?: string }): Promise<{ request: ModuleRequest; created: boolean }>;
      /** Ce que cette organisation a déjà demandé, traité ou non. */
      requests(): Promise<ModuleRequest[]>;
    };

    /* --- Liens d'appel anonymes (BLOC B.2) --- */
    callLinks: {
      /** Émet un lien. Le jeton en clair n'est lisible QUE dans cette réponse. */
      create(input: { label?: string; minutes?: number }): Promise<CreatedCallLink>;
      /** Les liens émis par CE compte, avec leur état calculé. */
      list(): Promise<CallLink[]>;
      /** Révoque un lien avant son échéance. */
      revoke(id: string): Promise<void>;
    };

    /* --- Hygiène du compte --- */
    /** Les appareils connectés à ce compte. */
    listSessions(): Promise<ActiveSession[]>;
    /** Ferme une session à distance. */
    revokeSession(id: string): Promise<void>;
    /**
     * Le journal des ouvertures de SON espace, lisible par l'organisation
     * elle-même — la promesse de transparence du site, rendue vérifiable.
     */
    accessLog(): Promise<OrgAccessRecord[]>;
    /**
     * L'export de portabilité — TOUTES les données de l'organisation.
     *
     * Rendu par amn-api, qui est le seul à savoir ce qu'il détient. Le
     * remplacer par une liste tenue côté poste est exactement ce qui avait
     * rendu la « sauvegarde complète » incomplète : elle énumérait neuf
     * collections à la main et en ignorait treize — factures, rendez-vous,
     * dépenses, temps, commandes, notes, médias, comptes-rendus…
     */
    exportOrganization(): Promise<Record<string, unknown>>;
    /**
     * Règle l'apparence de MON organisation (BLOC C).
     *
     * Distincte de `admin.updateOrganization`, et c'est tout l'intérêt : celle-ci
     * est appelée par la cliente sur sa PROPRE organisation, celle-là par AMN
     * DevSec sur celle d'autrui. La couleur appartient à la cliente ; le
     * générateur ne fait que proposer un point de départ.
     */
    setOrganizationAccent(accent: string | null): Promise<OrgIdentity>;

    /* --- Scanner --- */
    /**
     * Queues a passive security scan of `url` at `tier`. Resolves as soon as
     * amn-api has accepted it (status `pending`); follow the run through
     * {@link onScanProgress} and re-read the finished scan with {@link getScan}.
     * The scan itself runs on amn-api, never from this machine.
     */
    startScan(url: string, tier: ScanTier): Promise<Scan>;
    listScans(): Promise<Scan[]>;
    getScan(id: string): Promise<Scan>;
    /** URL of the printable Elite report (opened, then printed to PDF). */
    scanReportUrl(id: string): Promise<string>;
    /* --- AMN SSL Monitor (BLOC 6) --- */
    /** Certificate state of every supervised host, checked by amn-api. */
    listSslStatus(): Promise<SslStatus[]>;
    /** Re-checks one host immediately instead of waiting for the sweep. */
    checkSsl(host: string): Promise<SslStatus>;

    /* --- Incidents : la file de travail de la supervision --- */
    /**
     * `'open'` (défaut) rend ce qui reste à faire — les nouveaux ET les pris
     * en charge. Un incident acquitté n'est pas terminé : le sortir de la file
     * le ferait oublier.
     */
    /**
     * `suppressed` : `'exclus'` (défaut) écarte ce qui est mis en sourdine,
     * `'seuls'` ne rend que ça — la réponse à « qu'est-ce que cette règle a
     * mangé ? », qui est la seule question qui permette de juger un étouffoir.
     */
    listIncidents(options?: {
      status?: 'open' | 'all' | IncidentStatus;
      siteId?: string;
      suppressed?: 'exclus' | 'seuls' | 'tous';
    }): Promise<Incident[]>;
    getIncident(id: string): Promise<IncidentDetail>;
    incidentMetrics(days?: number): Promise<IncidentMetrics>;
    /** « Je m'en occupe. » Refusé si quelqu'un l'a déjà pris. */
    acknowledgeIncident(id: string): Promise<Incident>;
    /** Une note est OBLIGATOIRE pour un faux positif — le serveur la réclame. */
    /**
     * `suppress` n'a de sens qu'avec `'false_positive'` : c'est au moment où
     * l'on écrit la note qu'on sait pourquoi on fait taire quelque chose. Un
     * écran « règles de suppression » rempli plus tard, de mémoire, se
     * remplirait de règles dont personne ne saurait plus dire ce qu'elles
     * taisent.
     */
    resolveIncident(
      id: string,
      resolution: IncidentResolution,
      note?: string,
      suppress?: { kind: string },
    ): Promise<{ incident: Incident; suppression: AlertSuppression | null }>;
    /**
     * Les maintenances annoncées. `includePast` rend l'historique, qui sert à
     * expliquer après coup pourquoi une nuit n'a réveillé personne.
     */
    listMaintenance(includePast?: boolean): Promise<MaintenanceWindow[]>;
    /** Annoncer une indisponibilité prévue. La raison est obligatoire. */
    declareMaintenance(input: {
      siteId: string;
      startsAt: string;
      endsAt: string;
      reason: string;
    }): Promise<MaintenanceWindow>;
    /** Annuler une fenêtre à venir, ou écourter une fenêtre en cours. */
    cancelMaintenance(id: string): Promise<MaintenanceWindow>;
    /** Ce qui est actuellement tu, et ce que chaque règle a réellement absorbé. */
    listSuppressions(includeInactive?: boolean): Promise<AlertSuppression[]>;
    /** Rend la parole. Ne réveille PAS rétroactivement les incidents déjà tus. */
    revokeSuppression(id: string): Promise<AlertSuppression>;
    reopenIncident(id: string): Promise<Incident>;

    /* --- Rapport mensuel de supervision --- */
    /**
     * Les chiffres du mois `AAAA-MM`. Sans argument : le dernier mois
     * COMPLET, jamais celui en cours — un rapport « du mois en cours » le 3
     * du mois annonce trois jours d'activité et se lit comme un mois calme.
     */
    monthlyReport(month?: string): Promise<MonthlyReport>;
    /**
     * L'URL du même rapport en document imprimable (ouvert, puis imprimé en
     * PDF). Même chemin que {@link scanReportUrl} : le document est derrière
     * le jeton, qu'un `window.open()` nu ne sait pas envoyer.
     */
    monthlyReportUrl(month?: string): Promise<string>;
    /**
     * Escalades poussées par le serveur. Rend une fonction de désabonnement.
     *
     * L'écran n'a rien à recalculer : le serveur a déjà décidé que le délai
     * était dépassé, et le poste se contente de le dire.
     */
    onIncidentEscalation(callback: (escalation: IncidentEscalation) => void): () => void;

    /* --- Analyses récurrentes (BLOC 5) --- */
    listSchedules(): Promise<ProductSchedule[]>;
    /** Arms (or re-arms) a recurring Scanner/Comply run. */
    createSchedule(input: CreateScheduleInput): Promise<ProductSchedule>;
    deleteSchedule(id: string): Promise<void>;
    /** Regression notices pushed by amn-api. Returns an unsubscribe function. */
    onProductRegression(callback: (regression: ProductRegression) => void): () => void;
    /** Une demande de cliente arrive dans la file (Bloc 4). Réservé à AMN DevSec : exclusif. */
    onSupportRequest?(callback: (request: SupportRequestForOperator) => void): () => void;
    /** Une organisation naît, change ou disparaît (Tour) — le rail se relit. */
    onOrgChanged?(callback: (change: OrgChange) => void): () => void;
    /** Une tentative d'injection vient d'être détectée chez une cliente (Bloc 5). Exclusif. */
    onInputAlert?(callback: (alert: InputAlert) => void): () => void;

    /* --- Bureau de contrôle SOC (BLOC 4) --- */
    /**
     * Cross-site aggregation over the last `days` days, computed by amn-api.
     * Scoped to the operator's organization — an aggregate can never mix
     * two tenants.
     */
    getOrgOverview(days: number): Promise<OrgOverview>;
    /** Issues (once) and returns the site's public embeddable security badge. */
    getSiteBadge(siteId: string): Promise<SiteBadge>;

    /* --- La page de statut publique d'un site (BLOC 30) --- */
    /** Publiée ou non, et son adresse. Ne publie rien. */
    getSiteStatusPage(siteId: string): Promise<SiteStatusPage>;
    /**
     * Ouvre l'adresse publique. Idempotent : republier rend la MÊME adresse,
     * pour qu'un lien déjà envoyé aux clients de la cliente ne meure pas.
     */
    publishSiteStatusPage(siteId: string): Promise<SiteStatusPage>;
    /** Referme l'adresse. Elle répond 404 dans la seconde qui suit. */
    revokeSiteStatusPage(siteId: string): Promise<SiteStatusPage>;

    /** Live scan progress pushed from amn-api. Returns an unsubscribe function. */
    onScanProgress(callback: (progress: ScanProgress) => void): () => void;

    /* --- Console AMN DevSec (organisations clientes) --- */
    /**
     * La console inter-organisations d'amn-api. Ces appels partent TOUJOURS
     * avec le justificatif propre de l'opérateur, même quand l'app est dans
     * un contexte client : administrer une organisation et travailler dans son
     * dossier sont deux gestes différents, et amn-api refuse d'ailleurs le
     * second jeton sur ces routes.
     */
    admin: {
      listOrganizations(): Promise<AdminOrganization[]>;
      createOrganization(input: CreateOrganizationInput): Promise<CreateOrganizationResult>;
      updateOrganization(
        id: string,
        patch: {
          name?: string;
          logoDataUrl?: string | null;
          /** Modules ouverts ; `null` remet « tous », `[]` = aucun optionnel. */
          modules?: string[] | null;
          /** Quota invité en minutes/jour ; `null` remet le défaut serveur. */
          guestDailyMinutes?: number | null;
          /** Fuseau de l'organisation (remise à zéro du quota) ; `null` = défaut. */
          timezone?: string | null;
          /** Identifiant de couleur d'accent ; `null` = défaut. */
          accent?: string | null;
          /** Métier ; `null` efface le métier et rend les libellés génériques. */
          trade?: string | null;
          /** Langue de l'organisation ('fr' | 'en') ; `null` = français. */
          language?: string | null;
          /** Les places (1, 2, 5, 10, 25) ; `null` = la formule décide. */
          seats?: number | null;
        },
      ): Promise<AdminOrganization>;
      setOrganizationStatus(id: string, status: OrgStatus): Promise<AdminOrganization>;
      /**
       * Change la formule d'une organisation cliente.
       *
       * ATTENTION à ce que ça veut dire — et surtout à ce que ça ne veut PAS
       * dire aujourd'hui. Seule la valeur `internal` a un effet technique :
       * c'est elle qui autorise l'édition interne, et le serveur refuse donc de
       * l'attribuer ou de la retirer par cette route. Entre `business_standard`
       * et `business_premium`, RIEN ne change dans le produit : aucune limite,
       * aucun module, aucun quota n'en dépend. C'est une étiquette
       * commerciale, et l'écran le dit pour qu'on ne la prenne pas pour une
       * barrière.
       */
      setOrganizationPlan(id: string, plan: OrgPlan): Promise<AdminOrganization>;
      /**
       * SUPPRIME une organisation cliente, définitivement.
       *
       * `confirm` doit être le nom EXACT de l'organisation. Ce n'est pas une
       * politesse d'interface : le serveur le vérifie, parce qu'une boîte de
       * dialogue ne protège que du clic distrait, jamais d'un appel scripté ni
       * d'un identifiant recopié depuis la mauvaise ligne.
       *
       * Rend le compte de ce qui a été détruit — après coup, plus personne ne
       * peut le reconstituer.
       */
      deleteOrganization(
        id: string,
        confirm: string,
      ): Promise<{ organization: AdminOrganization; removed: { users: number; records: number; sites: number } }>;
      listUsers(orgId: string): Promise<AdminOrgUser[]>;
      /**
       * SUPPRIME un compte d'une organisation cliente.
       *
       * Le cas réel : un départ chez elle, ou un compte créé par erreur. La
       * suppression coupe l'accès immédiatement — ses sessions tombent avec sa
       * ligne — mais LAISSE son travail : fiches, factures et rendez-vous
       * appartiennent à l'organisation, pas à la personne qui les a saisis.
       *
       * Le serveur refuse le dernier propriétaire actif : une organisation que
       * personne ne peut plus administrer de l'intérieur n'est pas un état
       * qu'on veut pouvoir atteindre par distraction.
       */
      deleteUser(orgId: string, userId: string): Promise<{ id: string; email: string }>;
      /**
       * OUVRE un compte chez une cliente, et rend son lien d'activation.
       *
       * Le compte est créé sans mot de passe : c'est la personne qui choisit le
       * sien en suivant le lien. Aaron ouvre la porte, il ne fabrique pas la
       * clé — et ne la connaît donc jamais.
       */
      createUser(
        orgId: string,
        input: { email: string; role: 'owner' | 'admin' | 'member' },
      ): Promise<{
        user: AdminOrgUser;
        invitation: { token: string; url: string | null; expiresAt: string };
      }>;
      /** Réémet un lien d'activation (7 jours, usage unique). */
      /**
       * Réémet un accès à un compte QUI EXISTE dans cette organisation. Pas de
       * rôle en paramètre : amn-api ne crée plus de compte par cette route, donc
       * il n'y a plus de rôle à choisir (voir routes/admin.js).
       */
      reissueInvitation(orgId: string, email: string): Promise<OrgInvitationResult>;
      /** Remet un mot de passe temporaire, affiché une seule fois. */
      resetPassword(orgId: string, userId: string): Promise<TempPasswordResult>;
      /** Journal des accès au dossier des clientes (Tour de contrôle). */
      accessLog(opts?: { orgId?: string; limit?: number }): Promise<OrgAccessEntry[]>;
      /** Le pouls d'une cliente : des comptes calculés, jamais son contenu. */
      organizationPulse(orgId: string): Promise<OrgPulse>;
      /**
       * Les demandes de module des clientes (BLOC 4).
       *
       * `resolve` marque une demande traitée et RIEN D'AUTRE : ouvrir le
       * module reste `updateOrganization({ modules })`, un geste séparé.
       * Dépiler une liste ne doit pas ouvrir des modules par inadvertance, et
       * le jour où un module aura un prix, « j'ai lu » ne devra jamais valoir
       * « je facture ».
       */
      moduleRequests(status?: 'pending' | 'done' | 'declined'): Promise<ModuleRequestForOperator[]>;
      resolveModuleRequest(
        id: string,
        input: { status: 'done' | 'declined'; note?: string },
      ): Promise<ModuleRequestForOperator>;
      /** La file des demandes des clientes (Blocs 1, 3, 4). */
      supportRequests(status?: SupportRequestStatus): Promise<SupportRequestForOperator[]>;
      /** Répondre (`answered`, avec un texte) ou clore. */
      answerSupportRequest(
        id: string,
        input: { status: 'answered' | 'closed'; reply?: string },
      ): Promise<SupportRequestForOperator>;
      /** Émet un lien de bienvenue pour un compte d'une cliente (Bloc 2). L'URL n'est rendue qu'une fois. */
      /** Les tentatives d'injection détectées par la sentinelle des entrées (Bloc 5). */
      inputAlerts(opts?: { limit?: number; orgId?: string }): Promise<InputAlert[]>;
      createWelcomeLink(orgId: string, userId: string): Promise<WelcomeLinkIssued>;
      listWelcomeLinks(orgId: string): Promise<AdminWelcomeLink[]>;
      revokeWelcomeLink(orgId: string, linkId: string): Promise<void>;
      /** L'état réel des rondes de supervision de fond (BLOC F). */
      supervision(): Promise<SupervisionState>;
      /**
       * Le relevé du parc : activité réelle et connexions ouvertes (BLOCS E, F).
       *
       * Un seul appel pour toutes les clientes. Une requête par organisation
       * aurait multiplié les allers-retours au rythme des signatures, et c'est
       * ce qui rend ce genre d'écran lent au moment où il devient utile.
       */
      insights(): Promise<ParcInsights>;
      /**
       * Émet un lien de téléchargement de l'installeur Business.
       *
       * Rejette avec `code: 'no_release'` quand aucune version n'est publiée —
       * volontairement, plutôt que de rendre un lien qui ne mènerait nulle part
       * et qu'on enverrait à une cliente sans le savoir.
       */
      downloadLink(orgId?: string): Promise<DownloadLink>;
      /** Les versions publiées, et laquelle est courante. */
      releases(): Promise<{ releases: BusinessRelease[]; current: BusinessRelease | null }>;
    };

    /* --- Contexte client (session de support) --- */
    /**
     * Bascule le justificatif de TOUTE l'app (requêtes et WebSocket) sur une
     * organisation cliente, ou l'en fait revenir.
     *
     * C'est volontairement le pont qui porte cette bascule, et pas seulement le
     * renderer : le jeton de support doit gouverner le flux temps réel autant
     * que les requêtes, sinon l'app afficherait le dossier de la cliente tout
     * en recevant en direct les enregistrements d'AMN DevSec.
     */
    support: {
      /** Ouvre l'accès (journalisé côté serveur) et l'applique aussitôt. */
      enter(orgId: string): Promise<SupportSession>;
      /**
       * Réapplique un jeton conservé au redémarrage, en le revalidant auprès
       * d'amn-api. `null` si le jeton a expiré ou été révoqué — l'app revient
       * alors à AMN DevSec plutôt que d'afficher un bandeau qui ment.
       */
      restore(token: string): Promise<SupportContext | null>;
      /** Referme l'accès côté serveur et revient à AMN DevSec. */
      leave(token: string): Promise<void>;
    };

    /* --- Double authentification (MFA/TOTP) --- */
    mfa: {
      status(): Promise<MfaStatus>;
      /** Prépare un enrôlement. N'ACTIVE rien : il faut confirmer par un code. */
      setup(): Promise<MfaEnrolment>;
      /** Confirme l'enrôlement. Rend les codes de secours — UNE seule fois. */
      activate(code: string): Promise<{ backupCodes: string[]; mfa: MfaStatus }>;
      /** Régénère les codes ; invalide tous les anciens. Mot de passe ET code. */
      regenerateBackupCodes(input: {
        password: string;
        code: string;
      }): Promise<{ backupCodes: string[]; mfa: MfaStatus }>;
      /** Désactive. Refusé pour les rôles où la MFA est obligatoire. */
      disable(input: { password: string; code: string }): Promise<MfaStatus>;
    };

    /* --- Comply (RGPD) --- */
    /**
     * Queues a conformity check of `url` against one referential. Same shape as
     * {@link startScan}: resolves once amn-api accepted it, then follow it
     * through {@link onComplyProgress} and re-read it with
     * {@link getComplyCheck}.
     *
     * `referential` omitted = celui par défaut du serveur. C'est LE SERVEUR qui
     * arbitre ce qui est analysable : demander un référentiel dont les règles ne
     * sont pas validées juridiquement se solde par un refus, jamais par un
     * rapport vide — un score de 100 sur un référentiel sans règle se lirait
     * « conforme », et c'est le genre de mensonge qu'une cliente transmet à son
     * avocat.
     */
    startComply(url: string, referential?: string): Promise<ComplyCheck>;
    /** Le catalogue des référentiels, disponibles ET annoncés. */
    listComplyReferentials(): Promise<ComplyReferentialCatalog>;
    listComplyChecks(): Promise<ComplyCheck[]>;
    getComplyCheck(id: string): Promise<ComplyCheck>;
    onComplyProgress(callback: (progress: ComplyProgress) => void): () => void;
  };
  /** Native OS / desktop integration (Electron main process). */
  system: {
    /**
     * Native OS notification. Fire-and-forget.
     *
     * `kind: 'call'` marks a notification that must not disappear on its own:
     * an incoming call is only worth announcing while it is still ringing, and
     * a toast that auto-dismisses after 5 s is exactly how a call gets missed.
     */
    notify(input: { title: string; body: string; kind?: 'default' | 'call' }): void;
    /** Whether the app is set to launch at OS login (Electron only). */
    getAutoLaunch(): Promise<boolean>;
    /** Enables/disables launch at OS login; resolves to the new value. */
    setAutoLaunch(enabled: boolean): Promise<boolean>;
    /** App name / version / platform for the About screen. */
    getAppInfo(): Promise<AppInfo>;
    /**
     * Whether this machine can be driven remotely at all (B.2). False in the
     * browser and on any platform without native input injection, so the UI
     * can refuse the request honestly instead of granting a control that would
     * do nothing.
     */
    canBeRemoteControlled(): Promise<boolean>;
    /**
     * Applies one remote input event to THIS machine. Only ever called while
     * the operator has explicitly granted control — the consent lives in the
     * renderer's call state, and the main process is a dumb executor.
     */
    injectRemoteInput(event: RemoteInputEvent): Promise<boolean>;
  };
  /** Cyber/tech watch feed, fetched from public RSS sources (Electron main). */
  watch: {
    /** Cached watch items (refreshed on a TTL in the main process). */
    list(): Promise<WatchFeedResult>;
    /** Force an immediate refresh from the sources, bypassing the TTL cache. */
    refresh(): Promise<WatchFeedResult>;
  };
  /** Local Ollama AI (per-machine, optional). Degrades to the mock if absent. */
  ollama: {
    /** Whether Ollama is running locally + the installed model names. */
    status(): Promise<OllamaStatus>;
    /** One non-streaming completion. Rejects on failure (caller falls back). */
    chat(input: { model: string; system: string; prompt: string }): Promise<{ text: string }>;
  };
  /** Auto-update (Electron main; Squirrel/autoUpdater). No-ops in the browser. */
  updates: {
    /** Fires when an update has been downloaded and is ready to install. */
    onDownloaded(cb: (info: { version: string; notes?: string }) => void): () => void;
    /** Quit and install the staged update (relaunches the app). */
    install(): void;
    /**
     * Vérifie MAINTENANT, sans attendre le cycle de fond.
     *
     * Le verdict est un état nommé, jamais un booléen : « pas de mise à jour »
     * et « je n'ai pas pu regarder » ne se ressemblent que pour qui écrit le
     * code — pour la personne devant l'écran, l'un rassure et l'autre demande
     * une action. Les confondre, c'est afficher « à jour » à quelqu'un qui ne
     * l'est pas.
     */
    check(): Promise<UpdateCheck>;
  };
  /**
   * Local password vault. Never synced — see VaultEntry. Encrypted at rest in
   * Electron (OS keychain via safeStorage); plain localStorage in the browser
   * fallback, which `isEncrypted()` reports so the UI can warn honestly.
   */
  vault: {
    isEncrypted(): Promise<boolean>;
    list(): Promise<VaultEntry[]>;
    /** Replaces the whole entry list — single local writer, no merge needed. */
    save(entries: VaultEntry[]): Promise<void>;
  };
  env: {
    /** true when backed by the Electron main process (SQLite), false in browser fallback. */
    isElectron: boolean;
  };
}

/** IPC channel names, kept in one place to avoid string drift. */
export const IPC = {
  authLogin: 'auth:login',
  authChangePassword: 'auth:changePassword',
  profilesList: 'profiles:list',
  profilesGet: 'profiles:get',
  profilesUpdateSelf: 'profiles:updateSelf',
  prefsGet: 'prefs:get',
  prefsUpdate: 'prefs:update',
  messagesList: 'messages:list',
  messagesSend: 'messages:send',
  messagesReact: 'messages:react',
  messagesSetPinned: 'messages:setPinned',
  clientsList: 'clients:list',
  clientsCreate: 'clients:create',
  clientsUpdate: 'clients:update',
  clientsAddEvent: 'clients:addEvent',
  clientsRemove: 'clients:remove',
  quotesList: 'quotes:list',
  quotesCreate: 'quotes:create',
  quotesUpdate: 'quotes:update',
  quotesRemove: 'quotes:remove',
  tasksList: 'tasks:list',
  tasksCreate: 'tasks:create',
  tasksUpdate: 'tasks:update',
  tasksRemove: 'tasks:remove',
  decisionsList: 'decisions:list',
  decisionsCreate: 'decisions:create',
  decisionsRemove: 'decisions:remove',
  knowledgeList: 'knowledge:list',
  knowledgeCreate: 'knowledge:create',
  knowledgeUpdate: 'knowledge:update',
  knowledgeRemove: 'knowledge:remove',
  checklistGetState: 'checklist:getState',
  checklistCheck: 'checklist:check',
  learningList: 'learning:list',
  learningCreate: 'learning:create',
  learningUpdate: 'learning:update',
  learningRemove: 'learning:remove',
  objectivesList: 'objectives:list',
  objectivesUpdate: 'objectives:update',
  remoteListSites: 'remote:listSites',
  remoteSiteEvents: 'remote:siteEvents',
  remoteRegisterSite: 'remote:registerSite',
  remoteUpdateSite: 'remote:updateSite',
  remoteConfigureSite: 'remote:configureSite',
  remoteSiteSummary: 'remote:siteSummary',
  remoteSiteDigest: 'remote:siteDigest',
  remoteDeleteSite: 'remote:deleteSite',
  remoteConnectionStatus: 'remote:connectionStatus',
  remoteListRecords: 'remote:listRecords',
  remoteListRecordsBulk: 'remote:listRecordsBulk',
  remoteUpsertRecord: 'remote:upsertRecord',
  remoteDeleteRecord: 'remote:deleteRecord',
  remoteSetIdentity: 'remote:setIdentity',
  remoteSessionLogin: 'remote:sessionLogin',
  remoteSessionRestore: 'remote:sessionRestore',
  remoteSessionClear: 'remote:sessionClear',
  remoteSessionChangePassword: 'remote:sessionChangePassword',
  remoteSessionAcceptInvitation: 'remote:sessionAcceptInvitation',
  remoteSessionMyOrganizations: 'remote:sessionMyOrganizations',
  remoteSessionSwitchOrg: 'remote:sessionSwitchOrg',
  remoteMembersList: 'remote:membersList',
  remoteMembersInvite: 'remote:membersInvite',
  remoteMembersSetRole: 'remote:membersSetRole',
  remoteMembersSetStatus: 'remote:membersSetStatus',
  remoteMembersRemove: 'remote:membersRemove',
  remoteMembersJournal: 'remote:membersJournal',
  remoteSupportList: 'remote:supportList',
  remoteSupportSend: 'remote:supportSend',
  remoteForgotPassword: 'remote:forgotPassword',
  remoteWelcomeInspect: 'remote:welcomeInspect',
  remoteWelcomeReveal: 'remote:welcomeReveal',
  remoteWelcomeConfirm: 'remote:welcomeConfirm',
  remoteSupportAnsweredPush: 'remote:supportAnsweredPush',
  remoteSupportRequestPush: 'remote:supportRequestPush',
  remoteOrgChangedPush: 'remote:orgChangedPush',
  remoteInputAlertPush: 'remote:inputAlertPush',
  remoteAdminInputAlerts: 'remote:adminInputAlerts',
  remoteModuleCatalogue: 'remote:moduleCatalogue',
  remoteModuleRequest: 'remote:moduleRequest',
  remoteModuleRequests: 'remote:moduleRequests',
  remoteCallLinkCreate: 'remote:callLinkCreate',
  remoteCallLinkList: 'remote:callLinkList',
  remoteCallLinkRevoke: 'remote:callLinkRevoke',
  remoteListSessions: 'remote:listSessions',
  remoteRevokeSession: 'remote:revokeSession',
  remoteAccessLog: 'remote:accessLog',
  remoteExportOrganization: 'remote:exportOrganization',
  remoteSetOrgAccent: 'remote:setOrgAccent',
  remoteGetPresence: 'remote:getPresence',
  /** Push channels (main -> renderer via webContents.send, not invoke/handle). */
  remoteStartScan: 'remote:startScan',
  remoteListScans: 'remote:listScans',
  remoteGetScan: 'remote:getScan',
  remoteScanReportUrl: 'remote:scanReportUrl',
  remoteScanProgressPush: 'remote:scanProgressPush',
  remoteMfaStatus: 'remote:mfaStatus',
  remoteMfaSetup: 'remote:mfaSetup',
  remoteMfaActivate: 'remote:mfaActivate',
  remoteMfaBackupCodes: 'remote:mfaBackupCodes',
  remoteMfaDisable: 'remote:mfaDisable',
  remoteLoginMfa: 'remote:loginMfa',
  remoteStartComply: 'remote:startComply',
  remoteListComplyChecks: 'remote:listComplyChecks',
  remoteListComplyReferentials: 'remote:listComplyReferentials',
  remoteGetComplyCheck: 'remote:getComplyCheck',
  remoteComplyProgressPush: 'remote:complyProgressPush',
  remoteEventPush: 'remote:eventPush',
  remoteConnectionStatusPush: 'remote:connectionStatusPush',
  remoteRecordPush: 'remote:recordPush',
  remotePresencePush: 'remote:presencePush',
  remoteListSslStatus: 'remote:listSslStatus',
  remoteCheckSsl: 'remote:checkSsl',
  remoteListIncidents: 'remote:listIncidents',
  remoteGetIncident: 'remote:getIncident',
  remoteIncidentMetrics: 'remote:incidentMetrics',
  remoteAcknowledgeIncident: 'remote:acknowledgeIncident',
  remoteResolveIncident: 'remote:resolveIncident',
  remoteReopenIncident: 'remote:reopenIncident',
  remoteListMaintenance: 'remote:listMaintenance',
  remoteDeclareMaintenance: 'remote:declareMaintenance',
  remoteCancelMaintenance: 'remote:cancelMaintenance',
  remoteListSuppressions: 'remote:listSuppressions',
  remoteRevokeSuppression: 'remote:revokeSuppression',
  remoteMonthlyReport: 'remote:monthlyReport',
  remoteMonthlyReportUrl: 'remote:monthlyReportUrl',
  remoteIncidentEscalationPush: 'remote:incidentEscalationPush',
  remoteListSchedules: 'remote:listSchedules',
  remoteCreateSchedule: 'remote:createSchedule',
  remoteDeleteSchedule: 'remote:deleteSchedule',
  remoteProductRegressionPush: 'remote:productRegressionPush',
  remoteAdminListOrgs: 'remote:adminListOrgs',
  remoteAdminCreateOrg: 'remote:adminCreateOrg',
  remoteAdminUpdateOrg: 'remote:adminUpdateOrg',
  remoteAdminSetOrgStatus: 'remote:adminSetOrgStatus',
  remoteAdminSetOrgPlan: 'remote:adminSetOrgPlan',
  remoteAdminDeleteOrg: 'remote:adminDeleteOrg',
  remoteAdminListUsers: 'remote:adminListUsers',
  remoteAdminDeleteUser: 'remote:adminDeleteUser',
  remoteAdminCreateUser: 'remote:adminCreateUser',
  remoteAdminReissueInvitation: 'remote:adminReissueInvitation',
  remoteAdminResetPassword: 'remote:adminResetPassword',
  remoteAdminAccessLog: 'remote:adminAccessLog',
  remoteAdminOrgPulse: 'remote:adminOrgPulse',
  remoteAdminModuleRequests: 'remote:adminModuleRequests',
  remoteAdminResolveModuleRequest: 'remote:adminResolveModuleRequest',
  remoteAdminSupportRequests: 'remote:adminSupportRequests',
  remoteAdminAnswerSupportRequest: 'remote:adminAnswerSupportRequest',
  remoteAdminWelcomeLinkCreate: 'remote:adminWelcomeLinkCreate',
  remoteAdminWelcomeLinkList: 'remote:adminWelcomeLinkList',
  remoteAdminWelcomeLinkRevoke: 'remote:adminWelcomeLinkRevoke',
  remoteAdminSupervision: 'remote:adminSupervision',
  remoteAdminInsights: 'remote:adminInsights',
  remoteAdminDownloadLink: 'remote:adminDownloadLink',
  remoteAdminReleases: 'remote:adminReleases',
  remoteSupportEnter: 'remote:supportEnter',
  remoteSupportRestore: 'remote:supportRestore',
  remoteSupportLeave: 'remote:supportLeave',
  remoteGetOrgOverview: 'remote:getOrgOverview',
  remoteGetSiteBadge: 'remote:getSiteBadge',
  remoteGetSiteStatusPage: 'remote:getSiteStatusPage',
  remotePublishSiteStatusPage: 'remote:publishSiteStatusPage',
  remoteRevokeSiteStatusPage: 'remote:revokeSiteStatusPage',
  remoteSendCallSignal: 'remote:sendCallSignal',
  remoteCallSignalPush: 'remote:callSignalPush',
  systemNotify: 'system:notify',
  systemCanRemoteControl: 'system:canRemoteControl',
  systemInjectRemoteInput: 'system:injectRemoteInput',
  systemGetAutoLaunch: 'system:getAutoLaunch',
  systemSetAutoLaunch: 'system:setAutoLaunch',
  systemGetAppInfo: 'system:getAppInfo',
  watchList: 'watch:list',
  watchRefresh: 'watch:refresh',
  ollamaStatus: 'ollama:status',
  ollamaChat: 'ollama:chat',
  updateDownloaded: 'update:downloaded',
  updateInstall: 'update:install',
  updateCheck: 'update:check',
  vaultIsEncrypted: 'vault:isEncrypted',
  vaultList: 'vault:list',
  vaultSave: 'vault:save',
} as const;
