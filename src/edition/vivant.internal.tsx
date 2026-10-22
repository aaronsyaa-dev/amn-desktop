/**
 * L'ACCUEIL DE LA REFONTE, CÔTÉ INTERNE — ce que l'édition interne branche (S2).
 *
 * L'édition cliente reçoit `vivant.business.tsx` à la place : le rideau de
 * lancement d'avant (`SplashScreen`), ni ambiance noire, ni ton, ni toasts.
 * Rien de ce que ce fichier importe n'entre dans son paquet.
 *
 *   · `Lancement` / `lancementJoue` : le lancement court (logo), posé par
 *     `src/App.tsx` à la place de `SplashScreen` (même contrat) ;
 *   · `Ambiance` : le fond noir et gris (jetons du socle) et la police Inter ;
 *   · `ReactionsGuide` : les petits toasts des moments fêtés ;
 *   · `RegistreSection` : le ton des messages, dans Paramètres.
 *
 * Les noms exportés ne citent pas Ajmani : `src/App.tsx` (partagé) les nomme,
 * et ce mot est interdit dans le paquet client.
 */
export { Lancement, lancementJoue } from '../refonte/accueil/Lancement';
export { Ambiance } from '../refonte/accueil/Ambiance';
export { ToastsAjmani as ReactionsGuide } from '../refonte/accueil/ajmani/Toasts';
export { RegistreSection } from '../refonte/accueil/ajmani/RegistreSection';
