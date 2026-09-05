import type { GardeSalle } from '../shared/garde';

/**
 * LES PRISES DE LA GARDE, MODULE PAR MODULE (Bloc 10).
 *
 * Chaque agent déclare ce qu'il lit et ce qu'il modifie (`prises.lit`,
 * `prises.modifie`) en noms de tables ou de collections. Cette table dit à
 * quel module du poste ces noms correspondent — pour que la Bibliothèque
 * puisse écrire, sur la tuile du module : « Garde · lu par Sites · modifié
 * par Comptes ». Un module absent d'ici ne dit rien : la Garde n'y touche pas.
 */
const TABLES_PAR_MODULE: Record<string, readonly string[]> = {
  tasks: ['tasks (AMN DevSec)', 'tasks'],
  announcements: ['announcements'],
  sites: ['sites', 'site_state', 'maintenance_windows'],
  supervision: ['incidents'],
  tracker: ['site_state'],
  ssl: ['sites'],
  orgs: ['organizations', 'users', 'org_access_log'],
  members: ['users'],
  library: ['module_requests'],
  assistance: ['support_requests'],
  reports: ['reports'],
  access: ['org_access_log'],
  gardeSalle: ['garde_agents', 'garde_rondes'],
  gardePile: ['garde_remontees'],
};

const NOM_EQUIPE: Record<string, string> = { sites: 'Sites', securite: 'Sécurité', comptes: 'Comptes', registre: 'Registre', clientes: 'Clientes', produit: 'Produit', taches: 'Tâches', memoire: 'Mémoire' };

export function prisesParModule(salle: Pick<GardeSalle, 'equipes'>): Record<string, { lit: string[]; modifie: string[] }> {
  const resultat: Record<string, { lit: Set<string>; modifie: Set<string> }> = {};
  for (const equipe of salle.equipes) {
    const nom = NOM_EQUIPE[equipe.key] ?? equipe.nom;
    for (const agent of equipe.agents) {
      for (const [module, tables] of Object.entries(TABLES_PAR_MODULE)) {
        const touche = (liste: readonly string[] | undefined) => (liste ?? []).some((x) => tables.includes(x));
        if (!touche(agent.prises?.lit) && !touche(agent.prises?.modifie)) continue;
        resultat[module] ??= { lit: new Set(), modifie: new Set() };
        if (touche(agent.prises?.lit)) resultat[module].lit.add(nom);
        if (touche(agent.prises?.modifie)) resultat[module].modifie.add(nom);
      }
    }
  }
  return Object.fromEntries(Object.entries(resultat).map(([k, v]) => [k, { lit: [...v.lit], modifie: [...v.modifie] }]));
}
