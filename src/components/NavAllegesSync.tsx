import { useNavAlleges } from '../state/useNavAlleges';

/**
 * Charge les modules allégés de la personne dès l'entrée dans l'application.
 *
 * Le magasin (useNavAlleges) ne lit le serveur que quand un composant s'y
 * abonne. Sans ce composant, la barre du téléphone d'une personne qui n'a
 * jamais ouvert la Bibliothèque sur cet appareil ignorait ce qu'elle avait
 * allégé ailleurs — mesuré par la sonde du Bloc 3. Monté une fois dans
 * chaque disposition, il ne rend rien.
 */
export function NavAllegesSync() {
  useNavAlleges();
  return null;
}
