/**
 * L'ACCUEIL DE LA REFONTE, CÔTÉ CLIENTE — rien de nouveau, délibérément.
 *
 * Le lancement reste le rideau `SplashScreen` d'avant, à l'identique ; le
 * fond noir, le réglage du ton et les toasts d'Ajmani n'existent pas. Ce fichier
 * n'importe rien de `src/refonte/**` : le paquet client ne contient ni
 * Ajmani, ni ses phrases.
 */
export { SplashScreen as Lancement, hasSplashPlayed as lancementJoue } from '../components/SplashScreen';

export function Ambiance(): null {
  return null;
}

export function ReactionsGuide(): null {
  return null;
}

export function RegistreSection(): null {
  return null;
}
