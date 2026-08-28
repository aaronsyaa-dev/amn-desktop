import fs from 'node:fs';
import path from 'node:path';

/**
 * OÙ EST amn-api — la seule réponse, pour les huit contrôles qui la posaient.
 *
 * Plusieurs garde-fous de ce dépôt comparent ce que le POSTE déclare à ce que
 * le SERVEUR fait vraiment : les natures d'alerte, les rôles, les actions du
 * journal d'audit, les noms de produit, les collections synchronisées. Chacun
 * répétait la même liste de chemins candidats, et il fallait donc les modifier
 * tous les huit pour en ajouter un.
 *
 * ## `AMN_API_ROOT` d'abord
 *
 * Ajouté pour la CI, où `actions/checkout` ne sait écrire QUE dans l'espace de
 * travail : le dépôt voisin ne peut pas atterrir à `../amn-api`, il faut
 * pouvoir dire où il est. Ça sert aussi à quiconque range ses dépôts
 * autrement.
 *
 * ## Rendre `null` est une réponse, pas un échec
 *
 * Sur un poste où amn-api n'est pas cloné, ces contrôles doivent passer en le
 * DISANT plutôt qu'échouer : ils vérifient par ailleurs des choses utiles, et
 * un contrôle qui échoue pour une raison sans rapport finit désactivé.
 *
 * En CI, c'est l'inverse — un vert qui n'a rien comparé ne prouve rien — et
 * c'est la tâche `croises` du workflow qui refuse alors de continuer, avec le
 * remède écrit dans son message.
 */
export function trouverApiRoot(root) {
  const candidats = [
    process.env.AMN_API_ROOT,
    '/workspace/amn-api',
    path.join(root, '..', 'amn-api'),
  ].filter(Boolean);

  return (
    candidats.find((c) => {
      try {
        return fs.existsSync(path.join(c, 'src', 'db', 'tenancy.js'));
      } catch {
        return false;
      }
    }) ?? null
  );
}
