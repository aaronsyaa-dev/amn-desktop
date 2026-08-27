import type { OrgIdentity, RemoteSession, User, UserRole } from '../shared/api';

/**
 * LA SESSION STOCKÉE — UN SEUL ÉCRIVAIN, UNE SEULE FORME
 * ══════════════════════════════════════════════════════
 *
 * ## Le défaut que ce module existe pour rendre impossible
 *
 * Deux endroits écrivaient cette entrée de `localStorage` : `AuthContext`
 * (à la connexion) et `OrgContextContext` (à la bascule d'organisation). Ils
 * n'écrivaient pas la même chose.
 *
 *   · `AuthContext` écrivait `{ token, user, org, role }`, avec `user` sous la
 *     forme LOCALE — `{ id, email, name }`, le nom affiché compris.
 *   · `OrgContextContext` écrivait `{ token, user, org }` — sans le rôle, et
 *     avec `user` sous la forme SERVEUR (`{ id, orgId, role, status, … }`),
 *     donc sans nom affichable.
 *
 * Conséquence mesurée : après UNE bascule d'organisation, le rôle disparaissait
 * du stockage et n'y revenait jamais. Toute la navigation continuait de
 * fonctionner — d'où la difficulté à le voir — mais chaque écran qui demande
 * « quel est mon rôle ? » recevait `null`, et refusait. Il fallait se
 * déconnecter et se reconnecter pour réparer, sans que rien ne le suggère.
 *
 * La parade n'est pas de corriger le second écrivain : c'est qu'il n'y en ait
 * plus qu'un. La clé, la forme et la sérialisation vivent ici, et nulle part
 * ailleurs — `npm run check:roles` refuse tout autre accès à cette clé.
 *
 * ## Ce que « rôle » veut dire ici
 *
 * Le rôle EFFECTIF dans l'organisation ACTIVE, jamais celui de l'organisation
 * d'origine du compte. La distinction n'est pas théorique : Aaron est
 * propriétaire chez AMN DevSec et peut n'être que membre chez une cliente qui
 * l'a invité. Lire le rôle d'origine lui donnerait chez elle des pouvoirs
 * qu'une invitation n'accorde pas — voir `effectiveRole` dans
 * `amn-api/src/middleware/tenantAuth.js`, qui applique exactement la même
 * règle côté serveur.
 *
 * Ce rôle sert au droit d'ÉCRITURE côté écran. Ce n'est pas une barrière de
 * sécurité : amn-api reste seul juge, et l'isolation par organisation ne
 * dépend jamais de cette valeur.
 */

/**
 * La clé. Déclarée ici et importée partout ailleurs — jamais retapée.
 *
 * Le second écrivain la portait en toutes lettres (`'amn-desktop.auth.session'`),
 * ce qui rendait le désaccord invisible à toute recherche sur le symbole.
 */
export const SESSION_STORAGE_KEY = 'amn-desktop.auth.session';

/** La forme conservée. Le rôle en fait partie, au même titre que le jeton. */
export interface StoredSession {
  token: string;
  /** Forme LOCALE — celle qu'affichent les écrans, avec le nom lisible. */
  user: User;
  org: OrgIdentity;
  /**
   * Le rôle effectif dans `org`.
   *
   * Optionnel dans le TYPE, et seulement pour une raison : les sessions
   * écrites par une version antérieure n'en ont pas. `readStoredSession` rend
   * alors `null`, et la revalidation au démarrage le rétablit depuis le
   * serveur — voir AuthContext. Le champ n'est jamais omis à l'écriture.
   */
  role?: UserRole | null;
}

/**
 * Le rôle effectif porté par une session amn-api.
 *
 * `session.user.role` est normalisé au rôle EFFECTIF par les deux ponts (voir
 * `lib/bridge.ts` et `main/remoteApi.ts`) : c'est le contrat, et cette
 * fonction est là pour que les appelants le lisent d'un seul endroit plutôt
 * que de creuser dans la forme d'une session.
 */
export function sessionRole(session: RemoteSession): UserRole | null {
  return session.user?.role ?? null;
}

/**
 * Nom affichable par défaut, tiré de l'adresse — remplaçable dans Paramètres.
 *
 * CHAQUE mot prend sa majuscule, pas seulement le premier. `marie.dupont`
 * donnait « Marie dupont », et cette chaîne-là s'affiche en grand sur le tout
 * premier écran qu'une cliente voit, avant même qu'elle ait eu l'occasion de
 * renseigner son nom. Une faute d'orthographe sur son propre nom, en accueil :
 * c'est le genre de détail qui décide de la confiance qu'on accorde au reste.
 */
function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? email;
  const cleaned = local.replace(/[._-]+/g, ' ').trim();
  if (!cleaned) return email;
  return cleaned
    .split(' ')
    .map((mot) => (mot ? mot.charAt(0).toUpperCase() + mot.slice(1) : mot))
    .join(' ');
}

/**
 * La forme LOCALE d'un compte, à partir d'une session amn-api.
 *
 * Vit ici, avec la forme stockée, parce que c'est exactement là qu'elle a
 * divergé : la bascule d'organisation rangeait la forme SERVEUR
 * (`{ id, orgId, role, status, … }`) sous la même clé, donc sans nom
 * affichable. Une seule fabrique, un seul résultat possible.
 */
export function localUserFromSession(session: RemoteSession): User {
  return { id: 0, email: session.user.email, name: nameFromEmail(session.user.email) };
}

/** La forme stockée d'une session amn-api, prête à écrire. */
export function storedFromSession(session: RemoteSession): StoredSession {
  return {
    token: session.token,
    user: localUserFromSession(session),
    org: session.org,
    role: sessionRole(session),
  };
}

export function readStoredSession(): StoredSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    return parsed && typeof parsed.token === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Écrit la session, dans SA forme, avec le rôle. Le seul écrivain de cette clé.
 *
 * Prend une `StoredSession` déjà constituée plutôt qu'une session brute :
 * `storedFromSession` est là pour la fabriquer, et la revalidation au
 * démarrage a besoin d'écrire un jeton qu'elle possède déjà sans que le
 * serveur le lui redonne.
 */
export function writeStoredSession(next: StoredSession): void {
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* Stockage refusé (navigation privée) : l'état en mémoire porte la
       session pour cette page, et la revalidation la rétablira ensuite. */
  }
}

/** Met à jour l'organisation SANS toucher au reste. Rend faux si rien n'était stocké. */
export function patchStoredOrg(org: OrgIdentity): boolean {
  const current = readStoredSession();
  if (!current) return false;
  writeStoredSession({ ...current, org });
  return true;
}

export function clearStoredSession(): void {
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* rien à faire : sans stockage, il n'y a rien à effacer. */
  }
}
