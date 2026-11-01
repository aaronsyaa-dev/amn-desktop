import { definirMots } from '../../../socle/mots';

/**
 * LES MOTS DE LA PAGE DE DÉMONSTRATION H43 (« États et messages », v3) — fr et en.
 *
 * Même schéma que `src/socle/i18n.ts` : l'anglais est la base, le français est typé contre lui. Ne sont ici que
 * les textes PROPRES À LA PLANCHE (en-tête, règles, barres de titre des mini-fenêtres, en-têtes de tableau, champ
 * de saisie) et ceux des modèles 6 et 7, dont le contenu dépend de l'écran qui les emploie. Les autres modèles
 * portent leurs textes dans `src/socle/mots/situations.ts`.
 *
 * Aucun nom propre : `{nom}`, `{objet}`, `{client}`, `{prenom}` sont des variables, remplies par les valeurs
 * d'exemple (`exemples.ts`) ou, dans un écran, par les vraies données. Les fils (« Contacts / Clients ») nomment des
 * modules de l'application, pas des exemples.
 */
const EN = {
  'entete.etiquette': 'SYSTEM · REFERENCE',
  'entete.titre': 'States and messages',
  'entete.sous': 'Even when there is nothing, when it loads or when it breaks: a simple explanation and a possible action.',
  'entete.regles': 'The rules of the models',
  'regle.1': 'One cause, one action',
  'regle.2': 'Never an error code',
  'regle.3': 'The object name changes, the shape stays',

  'fenetre.1': 'Empty',
  'fenetre.2': 'Loading',
  'fenetre.3': 'Offline',
  'fenetre.4': 'Missing rights',
  'fenetre.5': 'No result',
  'fenetre.6': 'Confirmation',
  'fenetre.7': 'Quiet success',
  'fenetre.8': 'Two people',
  'fenetre.9': 'Error',
  'fil.1': 'People / Clients',
  'fil.2': 'Money / Invoicing',
  'fil.3': 'Talk / Messaging',
  'fil.4': 'Tools / Vault',
  'fil.5': 'Write / Documents',
  'fil.6': 'People / Clients',
  'fil.7': 'Money / Invoicing',
  'fil.8': 'Write / Notes and pages',
  'fil.9': 'Money / Forecasts',

  'vide.colonne.client': 'Client',
  'vide.colonne.contact': 'Contact',
  'vide.colonne.echange': 'Last exchange',
  'hors.objet': 'message',
  'hors.objets': 'messages',
  'hors.saisie': 'Write to {prenom}, kept on this device',
  'aucun.recherche': 'Search the documents',
  'aucun.effacer': 'Clear the search',
  'statut.envoyee': 'Sent',
  'statut.retard': 'Late',
  'statut.payee': 'Paid',
  'erreur.courbe': 'Last known values of the curve, greyed out',

  'confirmation.titre': 'Delete “{nom}”?',
  'confirmation.texte': 'The {objet} will go to the bin for 30 days. You will be able to restore it.',
  'confirmation.action': 'Move to the bin',
  'succes.titre': 'Invoice sent to {client}',
} as const;

const FR: Record<keyof typeof EN, string> = {
  'entete.etiquette': 'SYSTÈME · RÉFÉRENCE',
  'entete.titre': 'États et messages',
  'entete.sous': 'Même quand il n’y a rien, quand ça charge ou quand ça casse : une explication simple et une action possible.',
  'entete.regles': 'Les règles des modèles',
  'regle.1': 'Une cause, une action',
  'regle.2': 'Jamais de code d’erreur',
  'regle.3': 'Le nom de l’objet change, la forme reste',

  'fenetre.1': 'Vide',
  'fenetre.2': 'Chargement',
  'fenetre.3': 'Hors ligne',
  'fenetre.4': 'Droits manquants',
  'fenetre.5': 'Aucun résultat',
  'fenetre.6': 'Confirmation',
  'fenetre.7': 'Succès discret',
  'fenetre.8': 'Deux personnes',
  'fenetre.9': 'Erreur',
  'fil.1': 'Contacts / Clients',
  'fil.2': 'L’argent / Facturation',
  'fil.3': 'Échanger / Messagerie',
  'fil.4': 'Outils / Coffre-fort',
  'fil.5': 'Écrire / Documents',
  'fil.6': 'Contacts / Clients',
  'fil.7': 'L’argent / Facturation',
  'fil.8': 'Écrire / Notes et pages',
  'fil.9': 'L’argent / Prévisions',

  'vide.colonne.client': 'Client',
  'vide.colonne.contact': 'Contact',
  'vide.colonne.echange': 'Dernier échange',
  'hors.objet': 'message',
  'hors.objets': 'messages',
  'hors.saisie': 'Écrire à {prenom}, gardé sur cet appareil',
  'aucun.recherche': 'Chercher dans les documents',
  'aucun.effacer': 'Effacer la recherche',
  'statut.envoyee': 'Envoyée',
  'statut.retard': 'Retard',
  'statut.payee': 'Payée',
  'erreur.courbe': 'Dernières valeurs connues de la courbe, grisées',

  'confirmation.titre': 'Supprimer « {nom} » ?',
  'confirmation.texte': 'Le {objet} ira dans la corbeille pendant 30 jours. Vous pourrez le restaurer.',
  'confirmation.action': 'À la corbeille',
  'succes.titre': 'Facture envoyée à {client}',
};

export const EN_H43 = EN;
export const FR_H43 = FR;
export const { useMots: useMotsH43, traduire: traduireH43 } = definirMots(EN, FR);
