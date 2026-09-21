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
  /**
   * L'ATTEINTE DE L'AXE, de 0 à 1, contre le seuil du signal lui-même.
   *
   * Le niveau se compte en signaux au vert ; la carte de chaleur du comparatif
   * (`30e`) a besoin, elle, d'une nuance : « deux jours actifs sur huit » n'est
   * pas « zéro ». Elle se prend donc ICI, au même endroit que le seuil, pour
   * qu'un seuil déplacé déplace aussi la nuance.
   *
   * TROIS AXES NE CONNAISSENT QUE 0 OU 1, et ce n'est pas une approximation :
   * leur règle est « aucun ». Il n'existe aucun crédit partiel pour trois
   * critiques plutôt que cinq, et inventer une courbe (1/(1+n), par exemple)
   * aurait fabriqué une échelle que le produit n'a pas.
   */
  part: number;
}
export interface Maturite {
  org: AdminOrganization;
  lectures: Lecture[];
  verts: number;
  niveau: Niveau;
}

const JOURS_ACTIFS_MIN = 8;
const MEMBRES_ACTIFS_MIN = 2;
const ATTENTE_MAX_JOURS = 3;
/** Les seuils, publiés : les écrans qui les citent ne doivent pas les recopier. */
export const SEUILS = { joursActifs: JOURS_ACTIFS_MIN, membresActifs: MEMBRES_ACTIFS_MIN, attenteMaxJours: ATTENTE_MAX_JOURS } as const;
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
  const borne = (x: number) => Math.max(0, Math.min(1, x));
  const jours = pouls?.activeDaysLast30 ?? 0;
  const membres = pouls?.users.active ?? 0;
  const sitesTotal = pouls?.sites.total ?? 0;
  const sitesEnLigne = pouls?.sites.online ?? 0;
  const critiques = pouls?.events.critical7Days ?? 0;
  const lectures: Lecture[] = [
    { signal: 'activite', ok: jours >= JOURS_ACTIFS_MIN, valeur: `${jours}/30`, part: borne(jours / JOURS_ACTIFS_MIN) },
    { signal: 'equipe', ok: membres >= MEMBRES_ACTIFS_MIN, valeur: String(membres), part: borne(membres / MEMBRES_ACTIFS_MIN) },
    { signal: 'sites', ok: sitesTotal > 0 && sitesEnLigne === sitesTotal, valeur: `${sitesEnLigne}/${sitesTotal}`, part: sitesTotal > 0 ? borne(sitesEnLigne / sitesTotal) : 0 },
    { signal: 'critiques', ok: critiques === 0, valeur: String(critiques), part: critiques === 0 ? 1 : 0 },
    { signal: 'entrees', ok: entreesRecentes === 0, valeur: String(entreesRecentes), part: entreesRecentes === 0 ? 1 : 0 },
    { signal: 'demandes', ok: enAttente === 0, valeur: String(enAttente), part: enAttente === 0 ? 1 : 0 },
  ];
  const verts = lectures.filter((l) => l.ok).length;
  return { org, lectures, verts, niveau: niveauDe(verts) };
}
