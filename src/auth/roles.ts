/**
 * LES RÔLES QUI ADMINISTRENT — une liste, un seul endroit
 * ══════════════════════════════════════════════════════
 *
 * « owner ou admin » était écrit en toutes lettres à cinq endroits du poste et
 * à sept du serveur, sans que rien ne les croise. C'est exactement le motif
 * qui a coûté le rôle d'Aaron : plusieurs listes qui disent la même chose
 * jusqu'au jour où l'une bouge.
 *
 * Ce fichier est la liste du POSTE. `npm run check:roles` la croise avec celle
 * du serveur (`foundingOrgAdmin`, middleware/tenantAuth.js) et refuse toute
 * autre écriture en dur dans `src/`.
 *
 * Ce qu'elle NE dit pas, volontairement : elle ne dit pas ce qu'on a le droit
 * de faire. Un rôle administrateur d'une organisation cliente n'est pas
 * opérateur d'AMN DevSec — c'est l'organisation ACTIVE qui en décide, pas le
 * rôle seul. Voir `OrgContextContext`, qui croise les deux.
 */

import type { UserRole } from '../shared/api';

/** Les rôles qui administrent leur propre organisation. */
export const ADMIN_ROLES: readonly UserRole[] = ['owner', 'admin'];

/**
 * Ce rôle administre-t-il son organisation ?
 *
 * Total sur `null`/`undefined` : une session locale, ou une session pas encore
 * relue, n'administre rien. Le refus par défaut est le bon sens ici — un doute
 * ne doit jamais ouvrir une porte.
 */
export function isAdminRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return (ADMIN_ROLES as readonly string[]).includes(role);
}
