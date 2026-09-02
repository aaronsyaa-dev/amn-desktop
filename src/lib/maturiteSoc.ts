import type { AdminOrganization, InputAlert, ModuleRequestForOperator, OrgPulse, SupportRequestForOperator } from '../shared/api';

/**
 * LA MATURITÉ SOC — six signaux réels par organisation, et rien d'inventé.
 *
 * Chaque signal se lit dans une donnée que le serveur tient déjà : le pouls
 * de l'organisation (activité, membres, sites, événements), les entrées
 * suspectes vues par la sentinelle, les demandes qui attendent. Le niveau
 * n'est pas une note sur 100 qu'on ne saurait pas expliquer : c'est le
 * nombre de signaux au vert, et chaque signal dit ce qui lui manque.
 */
export type Signal = 'activite' | 'equipe' | 'sites' | 'critiques' | 'entrees' | 'demandes';
export const SIGNAUX: Signal[] = ['activite', 'equipe', 'sites', 'critiques', 'entrees', 'demandes'];
export type Niveau = 'fragile' | 'enProgres' | 'solide';

export interface Lecture {
  signal: Signal;
  ok: boolean;
  /** Le chiffre qui a décidé, en clair. */
  valeur: string;
}
export interface Maturite {
  org: AdminOrganization;
  lectures: Lecture[];
  verts: number;
  niveau: Niveau;
}

const JOURS_ACTIFS_MIN = 8;
const ATTENTE_MAX_JOURS = 3;
const JOUR = 86_400_000;

export function niveauDe(verts: number): Niveau {
  if (verts >= 5) return 'solide';
  if (verts >= 3) return 'enProgres';
  return 'fragile';
}

export function lireMaturite(
  org: AdminOrganization,
  pouls: OrgPulse | null,
  entrees: InputAlert[],
  support: SupportRequestForOperator[],
  modules: ModuleRequestForOperator[],
  maintenant = Date.now(),
): Maturite {
  const trenteJours = new Date(maintenant - 30 * JOUR).toISOString();
  const entreesRecentes = entrees.filter((e) => e.orgId === org.id && e.createdAt >= trenteJours).length;
  const limite = new Date(maintenant - ATTENTE_MAX_JOURS * JOUR).toISOString();
  const enAttente = support.filter((s) => s.orgId === org.id && s.status === 'pending' && s.createdAt < limite).length
    + modules.filter((m) => m.orgId === org.id && m.status === 'pending' && String(m.createdAt ?? '') < limite).length;
  const lectures: Lecture[] = [
    { signal: 'activite', ok: (pouls?.activeDaysLast30 ?? 0) >= JOURS_ACTIFS_MIN, valeur: `${pouls?.activeDaysLast30 ?? 0}/30` },
    { signal: 'equipe', ok: (pouls?.users.active ?? 0) >= 2, valeur: String(pouls?.users.active ?? 0) },
    { signal: 'sites', ok: (pouls?.sites.total ?? 0) > 0 && pouls?.sites.online === pouls?.sites.total, valeur: `${pouls?.sites.online ?? 0}/${pouls?.sites.total ?? 0}` },
    { signal: 'critiques', ok: (pouls?.events.critical7Days ?? 0) === 0, valeur: String(pouls?.events.critical7Days ?? 0) },
    { signal: 'entrees', ok: entreesRecentes === 0, valeur: String(entreesRecentes) },
    { signal: 'demandes', ok: enAttente === 0, valeur: String(enAttente) },
  ];
  const verts = lectures.filter((l) => l.ok).length;
  return { org, lectures, verts, niveau: niveauDe(verts) };
}
