import { lireMetier } from './demarrage/metier';
import { lireMemoireStockee } from './demarrage/memoire';
import { ROUTE_DEMARRAGE } from './demarrage/chemins';

/**
 * OÙ ALLER APRÈS LA CONNEXION (G06 §6) — l'accueil réglé, et à la TOUTE PREMIÈRE connexion, Démarrage (H42).
 *
 * « Toute première » = sur ce poste, pour ce compte : aucun métier choisi, aucune étape mémorisée, et Démarrage
 * jamais proposé. La page ne s'impose qu'une fois (un drapeau local la marque proposée) : « Plus tard » ferme
 * pour de bon, et la page reste joignable par la recherche et par la carte de l'Accueil.
 */
export function cleProposee(email: string): string {
  return `amn.demarrage.propose.${email.trim().toLowerCase()}`;
}

export function destinationApresConnexion(email: string, stockage: Pick<Storage, 'getItem' | 'setItem'> | null = lireStockage()): string {
  const adresse = email.trim().toLowerCase();
  if (!adresse || !stockage) return '/';
  try {
    if (stockage.getItem(cleProposee(adresse)) !== null) return '/';
    const dejaCommence = lireMetier(adresse) !== null || Object.keys(lireMemoireStockee(adresse).faites).length > 0;
    stockage.setItem(cleProposee(adresse), new Date().toISOString());
    return dejaCommence ? '/' : ROUTE_DEMARRAGE;
  } catch {
    return '/';
  }
}

function lireStockage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
