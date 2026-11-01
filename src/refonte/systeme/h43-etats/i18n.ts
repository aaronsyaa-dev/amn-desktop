import { definirMots } from '../../../socle/mots';

/**
 * LES MOTS DE LA PAGE DE DÉMONSTRATION H43 (« États et messages ») — fr et en.
 *
 * Même schéma que `src/socle/i18n.ts` : l'anglais est la base, le français est typé contre lui. Ne sont ici que
 * les textes PROPRES À LA PAGE (en-tête, étiquettes de tuiles) et ceux des modèles 6 et 7, dont le contenu
 * dépend de l'écran qui les emploie. Les autres modèles portent leurs textes dans `src/socle/mots/situations.ts`.
 *
 * Aucun nom propre : `{nom}`, `{objet}`, `{client}` sont des variables, remplies par les valeurs d'exemple
 * (`exemples.ts`) ou, dans un écran, par les vraies données.
 */
const EN = {
  'entete.etiquette': 'SYSTEM',
  'entete.titre': 'States and messages',
  'entete.sous': 'Even when there is nothing, when it loads or when it breaks: always a simple explanation and a possible action. Never a dead zone.',

  'tuile.vide': 'EMPTY, WITH AN INVITATION',
  'tuile.chargement': 'LOADING',
  'tuile.hors': 'CONNECTION LOST',
  'tuile.acces': 'ACCESS DENIED',
  'tuile.aucun': 'NO RESULT',
  'tuile.confirmation': 'CONFIRMATION',
  'tuile.succes': 'SUCCESS, WITH UNDO',
  'tuile.collab': 'TWO PEOPLE, ONE PAGE',

  'confirmation.titre': 'Delete “{nom}”?',
  'confirmation.texte': 'The {objet} will go to the bin for 30 days. You will be able to restore it.',
  'confirmation.action': 'Move to the bin',
  'succes.titre': 'Invoice sent to {client}',
} as const;

const FR: Record<keyof typeof EN, string> = {
  'entete.etiquette': 'SYSTÈME',
  'entete.titre': 'États et messages',
  'entete.sous': 'Même quand il n’y a rien, quand ça charge ou quand ça casse\u00A0: toujours une explication simple et une action possible. Jamais de zone morte.',

  'tuile.vide': 'VIDE, AVEC UNE INVITATION',
  'tuile.chargement': 'CHARGEMENT',
  'tuile.hors': 'CONNEXION PERDUE',
  'tuile.acces': 'ACCÈS NON AUTORISÉ',
  'tuile.aucun': 'AUCUN RÉSULTAT',
  'tuile.confirmation': 'CONFIRMATION',
  'tuile.succes': 'SUCCÈS, AVEC RETOUR POSSIBLE',
  'tuile.collab': 'DEUX PERSONNES, UNE PAGE',

  'confirmation.titre': 'Supprimer «\u00A0{nom}\u00A0»\u00A0?',
  'confirmation.texte': 'Le {objet} ira dans la corbeille pendant 30 jours. Vous pourrez le restaurer.',
  'confirmation.action': 'À la corbeille',
  'succes.titre': 'Facture envoyée à {client}',
};

export const EN_H43 = EN;
export const FR_H43 = FR;
export const { useMots: useMotsH43, traduire: traduireH43 } = definirMots(EN, FR);
