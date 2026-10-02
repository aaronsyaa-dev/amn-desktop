import { bridge } from '../lib/bridge';

/**
 * Vrai si la session regarde l'organisation d'ORIGINE du compte.
 *
 * Ce qui vient du stockage local d'un poste (magasin hérité, notes
 * personnelles) appartient à l'organisation d'origine du compte. Un compte
 * membre de plusieurs organisations peut être ailleurs sans contexte client :
 * téléverser ce stockage-là l'écrirait chez une autre organisation.
 *
 * Le jeton partagé d'AMN DevSec n'appartient à personne : le serveur rend une
 * liste vide, et c'est bien l'organisation fondatrice. Une erreur répond non.
 */
export async function organisationDOrigineActive(): Promise<boolean> {
  try {
    const mine = await bridge().remote.session.listMyOrganizations();
    if (mine.organizations.length === 0) return true;
    return mine.organizations.some((o) => o.home && o.id === mine.activeOrgId);
  } catch {
    return false;
  }
}
