/**
 * L'IDENTITÉ RÉSERVÉE D'AJMANI — deux chaînes, et rien d'autre.
 *
 * Extraite d'`ajmaniChat.ts` au Bloc 10, pour une raison précise : ce
 * fichier-là tire le pont, le moteur d'assistant et les icônes derrière lui.
 * Toute règle qui a seulement besoin de savoir « ce message est-il d'Ajmani ? »
 * — la suppression, par exemple — devait sinon embarquer la moitié de
 * l'application, et devenait de ce fait inéprouvable hors navigateur.
 *
 * `ajmaniChat.ts` réexporte les deux noms : aucun appelant n'a bougé.
 */

/** L'adresse sous laquelle Ajmani publie dans le fil d'équipe. */
export const AJMANI_EMAIL = 'ajmani@amn-devsec.com';

/** Le nom affiché à côté de ses réponses. */
export const AJMANI_NAME = 'Ajmani';
