/**
 * QUI PEUT SUPPRIMER UN MESSAGE — la règle, isolée de tout écran (BLOC 10).
 *
 * Un fil d'équipe est un document partagé : la suppression y retire du texte
 * de l'écran de quelqu'un d'autre, pas seulement du sien. La règle doit donc
 * être écrite une fois, lisible, et éprouvée — pas dispersée en conditions
 * dans le JSX, où personne ne peut la relire d'un trait.
 *
 * Elle tient en deux phrases :
 *
 *   · on peut TOUJOURS retirer ce qu'on a soi-même écrit. Ça ne demande aucun
 *     rôle, et surtout pas la présence d'un serveur : sur une installation
 *     locale, sans session distante, le rôle vaut `null` et l'auteure doit
 *     malgré tout pouvoir se relire et se corriger ;
 *   · on peut retirer le message d'un autre UNIQUEMENT en tant qu'`owner` ou
 *     `admin`. C'est un geste de modération, et il est nommé comme tel dans
 *     l'interface — pas déguisé en même bouton.
 *
 * Le cas d'Ajmani est délibéré : ses réponses n'appartiennent à personne, donc
 * personne ne les « supprime en tant qu'auteur ». Seule la modération les
 * retire. Sinon n'importe quel compte pourrait effacer l'analyse qu'un autre
 * vient de demander.
 *
 * `guest` n'obtient jamais la modération, même si un jour la liste des rôles
 * s'allonge : le contrôle nomme les deux rôles admis plutôt que d'exclure
 * ceux qu'il connaît aujourd'hui.
 */

import { AJMANI_EMAIL } from './ajmaniIdentity';

/** Les seuls rôles qui retirent le message d'un autre. */
const ROLES_MODERATION = ['owner', 'admin'] as const;

/** La même adresse, quelle que soit la casse ou les espaces autour. */
function memeAdresse(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Le compte connecté est-il l'auteur de ce message ? */
export function isOwnMessage(
  currentEmail: string | null | undefined,
  message: { authorEmail: string },
): boolean {
  // Ajmani n'est l'auteur « propre » de personne, même si un compte portait
  // par accident son adresse réservée.
  if (memeAdresse(message.authorEmail, AJMANI_EMAIL)) return false;
  return memeAdresse(currentEmail, message.authorEmail);
}

/** Ce rôle modère-t-il le fil ? */
export function canModerateMessages(role: string | null | undefined): boolean {
  if (!role) return false;
  return (ROLES_MODERATION as readonly string[]).includes(role);
}

/**
 * Ce compte peut-il supprimer ce message ?
 *
 * Réunit les deux titres ci-dessus. L'interface n'a rien à recomposer : elle
 * pose la question, et distingue ensuite les deux cas par `isOwnMessage` pour
 * choisir le libellé.
 */
export function canDeleteMessage(
  role: string | null | undefined,
  currentEmail: string | null | undefined,
  message: { authorEmail: string },
): boolean {
  return isOwnMessage(currentEmail, message) || canModerateMessages(role);
}

/** Le libellé du geste, qui doit dire lequel des deux titres il exerce. */
export function deleteMessageLabel(
  currentEmail: string | null | undefined,
  message: { authorEmail: string },
): string {
  return isOwnMessage(currentEmail, message)
    ? 'Supprimer mon message'
    : 'Supprimer ce message (modération)';
}
