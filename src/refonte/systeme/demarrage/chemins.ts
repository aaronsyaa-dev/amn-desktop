/**
 * LES ADRESSES DE DÉMARRAGE (H42) ET DU CHOIX DU MÉTIER (H47).
 *
 * Ni l'une ni l'autre n'est un module : elles ne sont ni au registre (le total reste celui du registre) ni au
 * catalogue. Le câblage (`appRoot.internal.tsx`, sous `AppLayout`) lit ces deux constantes ; rien d'autre ne les écrit.
 */
export const ROUTE_DEMARRAGE = '/demarrage';
export const ROUTE_METIER = '/demarrage/metier';
