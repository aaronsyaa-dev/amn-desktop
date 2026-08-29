import { API_UNREACHABLE_PREFIX, GUEST_QUOTA_PREFIX, lireStatut } from '../shared/api';
import type { GuestQuotaState } from '../shared/api';

/**
 * Message d'erreur lisible, débarrassé de l'emballage IPC d'Electron.
 *
 * Une erreur levée dans `ipcMain.handle` traverse le pont enrobée :
 *
 *   Error invoking remote method 'remote:sessionLogin': Error: Email ou mot de
 *   passe incorrect.
 *
 * amn-api écrit pourtant ses refus POUR l'utilisateur final. Les afficher tels
 * quels donnait, sur l'écran de connexion d'une cliente, une phrase qui parle
 * de méthode distante avant de dire ce qui ne va pas — et qui expose au passage
 * des noms de canaux internes.
 */
const IPC_WRAPPER = /^Error invoking remote method '[^']*':\s*(?:[A-Za-z]*Error:\s*)?/;

export function cleanErrorMessage(error: unknown, fallback = 'Une erreur est survenue.'): string {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const cleaned = raw
    .replace(IPC_WRAPPER, '')
    .replace(API_UNREACHABLE_PREFIX, '')
    // Le code HTTP sert à la file d'envoi, pas à l'utilisateur : « [amn-statut:503]
    // Service Unavailable » affiché tel quel ne dit rien à personne.
    .replace(/\[amn-statut:\d{3}\]\s*/, '')
    .trim();
  return cleaned || fallback;
}

/**
 * Vrai quand amn-api n'a pas répondu du tout — par opposition à un refus, qui
 * est une réponse.
 *
 * Sert au seul endroit où la différence change la conduite à tenir : le repli
 * sur un compte local à la connexion (voir AuthContext). Un refus d'amn-api
 * doit s'afficher tel quel ; retomber dessus sur un compte local ouvrirait une
 * session qui a l'air normale mais n'ouvre aucun dossier client.
 */
export function isApiUnreachable(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  return raw.includes(API_UNREACHABLE_PREFIX);
}

/**
 * Lit le refus « quota invité épuisé » porté par une erreur, ou `null`.
 *
 * Même mécanique qu'`isApiUnreachable` : le marqueur voyage dans le message
 * parce que c'est tout ce qui survit au pont IPC. La différence est qu'ici on
 * récupère aussi les chiffres — combien de temps par jour, combien consommé,
 * quand l'accès rouvre — parce qu'un blocage qui ne dit pas jusqu'à quand
 * n'est pas un blocage, c'est une panne.
 */
export function readGuestQuotaRefusal(error: unknown): GuestQuotaState | null {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const at = raw.indexOf(GUEST_QUOTA_PREFIX);
  if (at === -1) return null;
  const payload = raw.slice(at + GUEST_QUOTA_PREFIX.length).split('|')[0];
  try {
    const parsed = JSON.parse(payload) as Partial<GuestQuotaState>;
    return {
      minutesPerDay: Number(parsed.minutesPerDay ?? 0),
      minutesUsed: Number(parsed.minutesUsed ?? 0),
      resetsAt: String(parsed.resetsAt ?? ''),
    };
  } catch {
    // Le marqueur est là mais la charge utile est illisible : on bloque quand
    // même, avec des chiffres vides. Laisser passer serait le pire des deux.
    return { minutesPerDay: 0, minutesUsed: 0, resetsAt: '' };
  }
}

/**
 * Le code HTTP porté par une erreur d'écriture, ou `undefined`.
 *
 * `undefined` veut dire « aucune réponse » — réseau coupé, serveur éteint — et
 * non « statut inconnu ». La file d'envoi lit cette absence comme le cas le
 * plus réessayable de tous ; confondre les deux ferait boucler un refus.
 */
export function statutErreur(error: unknown): number | undefined {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  return lireStatut(raw);
}
