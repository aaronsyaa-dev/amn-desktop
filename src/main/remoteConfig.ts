import 'dotenv/config';

/**
 * Central-API configuration, read only in the main process. The operator
 * token deliberately never reaches the renderer (see src/main/remoteApi.ts —
 * all amn-api calls are proxied over IPC), unlike the browser fallback in
 * src/lib/bridge.ts, which has no choice but to hold its own token
 * client-side and is documented as dev/test-only for that reason.
 */
export const remoteConfig = {
  apiUrl: (process.env.AMN_API_URL || '').replace(/\/$/, ''),
  operatorToken: process.env.AMN_API_OPERATOR_TOKEN || '',
  /**
   * Jeton de session de l'utilisateur connecté (amn-api). Vide tant que
   * personne ne s'est connecté. Rempli par `RemoteApiClient.login()`.
   *
   * Contrairement au jeton opérateur — partagé, embarqué dans le build, et qui
   * résout toujours vers AMN DevSec — celui-ci est nominatif et porte
   * l'organisation. C'est ce qui rend une installation cliente réellement
   * isolée : son build ne contient AUCUN jeton, la connexion en fabrique un.
   */
  sessionToken: '',
  /**
   * Jeton de session de SUPPORT — actif uniquement pendant qu'AMN Desktop est
   * dans le contexte d'une organisation cliente (voir docs/BUSINESS.md).
   *
   * Il ne remplace pas `sessionToken`, il le recouvre : la session de
   * l'opérateur reste en place pour les routes d'administration, tandis que
   * tout le reste — collections, WebSocket — part avec celui-ci et lit donc le
   * dossier de la cliente. Vidé en quittant le contexte et à la déconnexion.
   */
  supportToken: '',
};

/**
 * D'où vient le justificatif partagé de CE build — et la trace que
 * `scripts/publish-release.mjs` relit dans l'artefact avant de le publier sur
 * le canal des clientes.
 *
 * `__AMN_TOKEN_BAKED__` est une constante littérale posée par Vite : le
 * ternaire se replie donc à la compilation en UNE seule de ces deux chaînes.
 * Un build Business qui embarquerait le jeton opérateur porterait la mauvaise,
 * et la publication serait refusée — voir vite.main.config.ts, qui explique
 * pourquoi ce contrôle ne pouvait pas se faire en cherchant le nom de la
 * variable d'environnement.
 */
export const TOKEN_PROVENANCE: string = __AMN_TOKEN_BAKED__
  ? 'amn-jeton-operateur-embarque'
  : 'amn-aucun-jeton-operateur';

/**
 * Le justificatif présenté à amn-api pour chaque appel.
 *
 * Trois niveaux, du plus spécifique au plus général :
 *   1. le jeton de support, quand l'app travaille dans le dossier d'une
 *      cliente. C'est ce qui rend le contexte client réel plutôt que cosmétique ;
 *   2. la session nominative de l'opérateur ;
 *   3. le jeton opérateur partagé, mode historique des postes internes.
 *
 * La session gagne sur le jeton opérateur : sur le poste d'Aaron, où les deux
 * existent, se connecter avec un compte nominatif doit vraiment changer
 * d'organisation — pas se superposer silencieusement à AMN DevSec.
 */
export function apiCredential(): string {
  return remoteConfig.supportToken || remoteConfig.sessionToken || remoteConfig.operatorToken;
}

/**
 * Le justificatif de l'opérateur LUI-MÊME, sans le contexte client.
 *
 * Les routes `/v1/admin/*` doivent partir avec celui-ci : administrer une
 * organisation cliente (la suspendre, lui réémettre un accès, en créer une
 * autre) reste un geste d'AMN DevSec, et amn-api refuse d'ailleurs un jeton de
 * support sur cette console. Sans cette distinction, ouvrir un contexte client
 * couperait l'accès au rail et au panneau d'administration depuis l'intérieur
 * même de ce contexte.
 */
export function ownerCredential(): string {
  return remoteConfig.sessionToken || remoteConfig.operatorToken;
}

/**
 * True quand l'app a de quoi parler à amn-api.
 *
 * Une installation cliente n'embarque que `AMN_API_URL` : elle est donc « non
 * configurée » jusqu'à la connexion, puis configurée une fois la session
 * ouverte. C'est voulu — la synchro ne doit pas démarrer avant de savoir POUR
 * QUELLE organisation elle démarre.
 */
export function isRemoteConfigured(): boolean {
  return Boolean(remoteConfig.apiUrl && apiCredential());
}
