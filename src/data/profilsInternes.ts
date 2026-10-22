/**
 * LES PROFILS INTERNES — une mission par personne, d'un geste (Bloc 7).
 *
 * Trois postes chez AMN DevSec, trois barres : Supervision (veiller et
 * décider), Commercial (les organisations, ce qu'elles achètent), Support
 * (répondre, accompagner). Un profil dit ce qu'il GARDE ; tout le reste du
 * catalogue interne s'allège, sauf ce qui ne s'allège jamais. Il se choisit
 * à la première ouverture, se change dans la Bibliothèque, et reste par
 * personne, mémorisé côté serveur : le téléphone suit.
 */
export type ProfilInterne = 'supervision' | 'commercial' | 'support';

export const PROFILS_INTERNES: Record<ProfilInterne, readonly string[]> = {
  // Veiller et décider : le mur, les incidents, les sites, la Garde entière.
  supervision: ['home', 'tasks', 'notes', 'tour', 'supervision', 'sites', 'tracker', 'access', 'ssl', 'scanner', 'customAlerts', 'gardeSalle', 'gardeAjmani', 'gardePile', 'gardeBureaux', 'gardeCommune', 'gardeCalendrier'],
  // Les organisations, ce qu'elles achètent, ce qu'on leur propose.
  commercial: ['home', 'agenda', 'clients', 'pipeline', 'invoices', 'reminders', 'tasks', 'notes', 'orgs', 'orgCompare', 'clientReport', 'generator', 'socMaturity', 'gardeAjmani', 'gardePile', 'gardeBureaux'],
  // Répondre et accompagner : les demandes, les organisations, la parole.
  support: ['home', 'tasks', 'notes', 'agenda', 'orgs', 'access', 'dm', 'groups', 'announcements', 'calls', 'gardeSalle', 'gardeAjmani', 'gardePile', 'gardeBureaux', 'gardeCommune'],
};

export const PROFILS_INTERNES_ORDRE: readonly ProfilInterne[] = ['supervision', 'commercial', 'support'];

/** Ce qu'il faut alléger pour n'avoir que ce profil : tout le catalogue moins ce qu'il garde. */
export function allegementsPourProfil(profil: ProfilInterne, catalogue: readonly string[], toujoursOuverts: readonly string[]): string[] {
  const garde = new Set(PROFILS_INTERNES[profil]);
  return catalogue.filter((k) => !garde.has(k) && !toujoursOuverts.includes(k));
}

/** Le choix mémorisé par personne — pour ne pas reposer la question. */
export const CLE_PROFIL = (email: string) => `amn.profil-interne.${email || 'anonyme'}`;
