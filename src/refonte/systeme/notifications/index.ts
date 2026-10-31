/**
 * L'ÉCRAN H40 « NOTIFICATIONS » — ce que le reste de la refonte importe, et rien d'autre.
 *
 *   import { PageNotifications, useNotificationsNonLues } from '../systeme/notifications';
 *
 * Jamais importé par un fichier partagé avec l'édition cliente : l'écran vit et meurt avec l'édition interne.
 */
export { PageNotifications, DELAI_CHARGEMENT_MS, type PageNotificationsProps, type InfoAnnulable } from './PageNotifications';
export { useNotificationsNonLues, useNotificationsNonLuesAvec, useAlimenterNotifications, useAlimenterNotificationsAvec, useNotifications, useReglagesNotifications } from './useNotifications';
export { pastilleCloche, compteurs, grouper, trier, heureAffichee, optionsReport, type Notification, type TypeNotification, type Onglet } from './modele';
