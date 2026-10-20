/**
 * L'ACCUEIL VIVANT ET AJMANI, CÔTÉ INTERNE — ce que l'édition interne branche (S2).
 *
 * L'édition cliente reçoit `vivant.business.tsx` à la place : le rideau de
 * lancement d'avant (`SplashScreen`), ni réglage du ton ni réactions. Rien de
 * ce que ce fichier importe — Ajmani, ses phrases, l'Accueil vivant — n'entre
 * dans son paquet.
 *
 *   · `Lancement` / `lancementJoue` : l'animation de lancement, posée par
 *     `src/App.tsx` à la place de `SplashScreen` (même contrat) ;
 *   · `ReactionsGuide` : la petite tête qui réagit aux moments fêtés, montée
 *     une fois dans `src/App.tsx` ;
 *   · `RegistreSection` : le ton d'Ajmani, dans Paramètres.
 */
export { Lancement, lancementJoue } from '../refonte/accueil/Lancement';
// Le nom exporté ne cite pas Ajmani : `src/App.tsx` (partagé) le nomme, et ce mot est interdit dans le paquet client.
export { ReactionsAjmani as ReactionsGuide } from '../refonte/accueil/ajmani/ReactionsAjmani';
export { RegistreSection } from '../refonte/accueil/ajmani/RegistreSection';
