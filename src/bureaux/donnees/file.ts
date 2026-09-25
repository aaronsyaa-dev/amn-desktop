import type { AdminOrganization, FleetIncident, ModuleRequestForOperator, SupportRequestForOperator } from '../../shared/api';
import type { GardeDossier } from '../../shared/garde';
import type { SuiviRecord } from './parc';
import { FENETRE_ARRIVEE_MS } from './parc';

/**
 * LA FILE « À TRAITER » — cahier 12, `46c`.
 *
 * Tout ce qui attend un humain, d'où que ça vienne : demandes des clientes,
 * incidents, jetons de places, alertes que la Garde n'a pas réglées,
 * arrivées. Chaque élément porte une MÈCHE dont la longueur est le délai
 * promis pour son type ; la file se trie par TEMPS RESTANT, jamais par date
 * d'arrivée.
 */

export type TypeFile = 'critique' | 'jeton' | 'incident' | 'alerte' | 'demande' | 'arrivee';

/** Les délais promis, par type. */
export const DELAI_PROMIS_MS: Record<TypeFile, number> = {
  critique: 1 * 3_600_000,
  jeton: 4 * 3_600_000,
  incident: 4 * 3_600_000,
  alerte: 12 * 3_600_000,
  demande: 24 * 3_600_000,
  arrivee: 3 * 86_400_000,
};
export const LIBELLE_TYPE: Record<TypeFile, string> = {
  critique: 'CRITIQUE',
  jeton: 'JETON',
  incident: 'INCIDENT',
  alerte: 'ALERTE',
  demande: 'DEMANDE',
  arrivee: 'ARRIVÉE',
};

export interface ElementFile {
  /** La clé de suivi : `support:<id>`, `module:<id>`, `dossier:<id>`, `incident:<id>`, `arrivee:<orgId>`. */
  cle: string;
  type: TypeFile;
  orgId: string | null;
  orgNom: string;
  phrase: string;
  detail: string;
  depuis: string;
  /** Temps restant avant l'échéance promise ; négatif = dépassée. */
  resteMs: number;
  /** Part brûlée de la mèche, 0 → 1 (plafonnée). */
  brule: number;
  qui: string | null;
  /** D'où vient l'élément, pour ses gestes. */
  source:
    | { kind: 'support'; demande: SupportRequestForOperator }
    | { kind: 'module'; demande: ModuleRequestForOperator }
    | { kind: 'dossier'; dossier: GardeDossier }
    | { kind: 'incident'; incident: FleetIncident; groupe: number }
    | { kind: 'arrivee'; org: AdminOrganization };
}

export interface EntreesFile {
  organisations: AdminOrganization[];
  dossiers: GardeDossier[];
  supports: SupportRequestForOperator[];
  modulesDemandes: ModuleRequestForOperator[];
  incidents: FleetIncident[];
  suivis: SuiviRecord[];
  maintenant: number;
}

function reste(type: TypeFile, depuis: string, maintenant: number) {
  const ecoule = Math.max(0, maintenant - Date.parse(depuis));
  const promis = DELAI_PROMIS_MS[type];
  return { resteMs: promis - ecoule, brule: Math.min(1, ecoule / promis) };
}

export function fileATraiter(e: EntreesFile): ElementFile[] {
  const noms = new Map(e.organisations.map((o) => [o.id, o.name]));
  const nom = (id: string | null, repli: string | null = null) => (id ? noms.get(id) ?? repli ?? 'Organisation inconnue' : repli ?? '—');
  const suivis = new Map(e.suivis.filter((s) => s.par && !s.relache).map((s) => [s.id, s.par as string]));
  const r: ElementFile[] = [];

  const critiquesAvecDossier = new Set<string>();
  for (const d of e.dossiers) {
    const type: TypeFile = d.gravite === 'critique' ? 'critique' : 'alerte';
    if (type === 'critique' && d.orgId) critiquesAvecDossier.add(d.orgId);
    const cle = `dossier:${d.id}`;
    r.push({
      cle,
      type,
      orgId: d.orgId,
      orgNom: d.orgId ? nom(d.orgId, d.orgNom) : d.orgNom ?? 'La Garde',
      phrase: d.titre,
      detail: d.n > 1 ? `${d.n} remontées regroupées` : d.contexte,
      depuis: d.depuis,
      ...reste(type, d.depuis, e.maintenant),
      qui: suivis.get(cle) ?? d.prisPar ?? null,
      source: { kind: 'dossier', dossier: d },
    });
  }
  // Les incidents critiques sans dossier : un élément par organisation.
  const critiquesSeuls = new Map<string, FleetIncident[]>();
  for (const i of e.incidents) {
    if (i.status === 'resolved') continue;
    if (i.severity === 'critical') {
      if (!critiquesAvecDossier.has(i.orgId)) critiquesSeuls.set(i.orgId, [...(critiquesSeuls.get(i.orgId) ?? []), i]);
      continue;
    }
    if (i.severity !== 'warning') continue;
    const cle = `incident:${i.id}`;
    r.push({
      cle,
      type: 'incident',
      orgId: i.orgId,
      orgNom: i.orgName || nom(i.orgId),
      phrase: i.title,
      detail: `${i.siteName ?? 'site'} · ${i.alertCount} alerte${i.alertCount > 1 ? 's' : ''}`,
      depuis: i.firstSeenAt,
      ...reste('incident', i.firstSeenAt, e.maintenant),
      qui: suivis.get(cle) ?? i.acknowledgedBy ?? null,
      source: { kind: 'incident', incident: i, groupe: 1 },
    });
  }
  for (const [orgId, liste] of critiquesSeuls) {
    const tri = [...liste].sort((a, b) => a.firstSeenAt.localeCompare(b.firstSeenAt));
    const premier = tri[0];
    const cle = `incident:${premier.id}`;
    r.push({
      cle,
      type: 'critique',
      orgId,
      orgNom: premier.orgName || nom(orgId),
      phrase: liste.length > 1 ? `${liste.length} incidents critiques` : premier.title,
      detail: premier.title,
      depuis: premier.firstSeenAt,
      ...reste('critique', premier.firstSeenAt, e.maintenant),
      qui: suivis.get(cle) ?? liste.find((i) => i.acknowledgedBy)?.acknowledgedBy ?? null,
      source: { kind: 'incident', incident: premier, groupe: liste.length },
    });
  }
  for (const s of e.supports) {
    if (s.status !== 'pending' || s.kind === 'password_reset') continue;
    const type: TypeFile = s.kind === 'seat' ? 'jeton' : 'demande';
    const cle = `support:${s.id}`;
    const orgNom = s.orgName ?? nom(s.orgId);
    r.push({
      cle,
      type,
      orgId: s.orgId,
      orgNom,
      phrase: s.subject || (type === 'jeton' ? `${orgNom} demande des places` : 'Une demande'),
      detail: s.body,
      depuis: s.createdAt,
      ...reste(type, s.createdAt, e.maintenant),
      qui: suivis.get(cle) ?? null,
      source: { kind: 'support', demande: s },
    });
  }
  for (const m of e.modulesDemandes) {
    if (m.status !== 'pending') continue;
    const cle = `module:${m.id}`;
    r.push({
      cle,
      type: 'demande',
      orgId: m.orgId,
      orgNom: m.orgName,
      phrase: `${m.orgName} demande le module ${m.moduleKey}`,
      detail: m.message,
      depuis: m.createdAt,
      ...reste('demande', m.createdAt, e.maintenant),
      qui: suivis.get(cle) ?? null,
      source: { kind: 'module', demande: m },
    });
  }
  for (const o of e.organisations) {
    if (o.lastActivityAt || o.status !== 'active') continue;
    if (e.maintenant - Date.parse(o.createdAt) >= FENETRE_ARRIVEE_MS) continue;
    const cle = `arrivee:${o.id}`;
    r.push({
      cle,
      type: 'arrivee',
      orgId: o.id,
      orgNom: o.name,
      phrase: `${o.name} n’a pas encore commencé`,
      detail: 'Espace créé, rien produit encore',
      depuis: o.createdAt,
      ...reste('arrivee', o.createdAt, e.maintenant),
      qui: suivis.get(cle) ?? null,
      source: { kind: 'arrivee', org: o },
    });
  }
  return r.sort((a, b) => a.resteMs - b.resteMs || a.depuis.localeCompare(b.depuis));
}

/**
 * L'AMBRE DE LA FILE : la mèche et le « reste » du premier délai qui tombera
 * sans personne. Un critique déjà pris a une mèche grise ; un élément suivi
 * n'est jamais ambre.
 */
export function elementAmbre(file: ElementFile[]): ElementFile | null {
  return file.find((x) => !x.qui) ?? null;
}

/** « reste 50 min », « reste 3 h », « dépassé de 2 h ». */
export function texteReste(ms: number): string {
  const abs = Math.abs(ms);
  const t = abs < 3_600_000 ? `${Math.max(1, Math.round(abs / 60_000))} min` : abs < 2 * 86_400_000 ? `${Math.round(abs / 3_600_000)} h` : `${Math.round(abs / 86_400_000)} j`;
  return ms >= 0 ? `reste ${t}` : `dépassé de ${t}`;
}
