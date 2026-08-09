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
};

/**
 * Le justificatif présenté à amn-api pour chaque appel.
 *
 * La session gagne sur le jeton opérateur : sur le poste d'Aaron, où les deux
 * existent, se connecter avec un compte nominatif doit vraiment changer
 * d'organisation — pas se superposer silencieusement à AMN DevSec.
 */
export function apiCredential(): string {
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
