import { useMemo } from 'react';
import type { AdminOrganization, FleetIncident, RemoteSite, SslStatus } from '../../shared/api';
import type { GardeDossier } from '../../shared/garde';
import { useCollection } from '../../state/SyncContext';
import { useSourceBureaux } from './source';
import { useMaintenant } from './useSupervisor';
import { jourDe, serie, useReleves, valeurIlYA, type Releves } from './releves';
import type { Actif, ControleCle, ControlesOrg, EtatControle, Playbook, Secret, SourceRelevee } from './types';

/**
 * CYBER — ce que le bureau de Harun sait du parc (cahier 11 `45b`, cahier 13).
 *
 * Le score de posture d'une organisation est la part de ses contrôles
 * conformes, sur ceux qu'on a relevés : on ne note pas ce qu'on n'a pas
 * regardé. Deux contrôles se déduisent des faits, sans déclaration :
 *   · les CERTIFICATS, des relevés SSL de ses sites (expiré ou en erreur =
 *     non conforme, moins de 14 jours = partiel) ;
 *   · l'EXPOSITION devient CRITIQUE quand un incident critique est ouvert chez
 *     elle — c'est la brèche du rempart, la seule case rouge de la matrice.
 * Les six autres viennent du relevé de nuit, du desktop de la cliente, ou
 * d'une déclaration — la source est toujours dite.
 */

export const CONTROLES: { cle: ControleCle; nom: string; court: string }[] = [
  { cle: 'certificats', nom: 'Certificats', court: 'CERTIFICATS' },
  { cle: 'courriel', nom: 'Courriel SPF · DKIM · DMARC', court: 'COURRIEL' },
  { cle: 'mfa', nom: 'Double authentification', court: 'DOUBLE AUTH.' },
  { cle: 'sauvegardes', nom: 'Sauvegardes', court: 'SAUVEGARDES' },
  { cle: 'mises_a_jour', nom: 'Mises à jour des postes', court: 'MISES À JOUR' },
  { cle: 'exposition', nom: 'Exposition', court: 'EXPOSITION' },
  { cle: 'fuites', nom: 'Mots de passe fuités', court: 'FUITES' },
  { cle: 'journalisation', nom: 'Journalisation', court: 'JOURNAUX' },
];

const VALEUR: Record<EtatControle, number> = { conforme: 1, partiel: 0.5, non_conforme: 0, critique: 0 };

export interface EtatReleve {
  etat: EtatControle;
  source: SourceRelevee;
  at: string | null;
  /** Ce qui l'a fait tel : « expire dans 3 j », « incident critique ouvert ». */
  pourquoi?: string;
}

export interface Breche {
  titre: string;
  n: number;
  prisPar: string | null;
  depuis: string;
  prisLe: string | null;
  incidentId: string | null;
}

export interface PostureOrg {
  id: string;
  nom: string;
  org: AdminOrganization;
  controles: Record<ControleCle, EtatReleve | null>;
  score: number | null;
  /** Les points ouverts, un par défaut — leurs phrases, dans l'ordre de gravité. */
  points: string[];
  tendance: number | null;
  /** Pas de relevé d'il y a sept jours : trop récente pour avoir une tendance. */
  nouvelle: boolean;
  breche: Breche | null;
  courbe: (number | null)[];
  hotes: string[];
}

export type GraviteAlerte = 'critique' | 'haute' | 'moyenne' | 'faible';
export const DELAI_ALERTE_MS: Record<GraviteAlerte, number> = { critique: 3_600_000, haute: 4 * 3_600_000, moyenne: 12 * 3_600_000, faible: 24 * 3_600_000 };
export const CRANS: Record<GraviteAlerte, number> = { critique: 4, haute: 3, moyenne: 2, faible: 1 };

export interface AlerteCyber {
  id: string;
  gravite: GraviteAlerte;
  orgId: string | null;
  orgNom: string;
  titre: string;
  n: number;
  qui: string | null;
  depuis: string;
  resteMs: number;
  statut: 'ouverte' | 'prise';
  dossier: GardeDossier;
}

export interface Echeance {
  id: string;
  date: string;
  jours: number;
  type: 'certificat' | 'domaine' | 'licence' | 'renouvellement' | 'secret';
  quoi: string;
  orgId: string | null;
  orgNom: string;
  renouvelleSeul: boolean;
  source: 'ssl' | 'inventaire' | 'secret';
}

export interface GroupeIncidents {
  orgId: string;
  orgNom: string;
  critique: boolean;
  n: number;
  titre: string;
  depuis: string;
  prisPar: string | null;
  prisLe: string | null;
  incidents: FleetIncident[];
}

export interface ModeleCyber {
  pret: boolean;
  pannes: string[];
  maintenant: number;
  orgs: PostureOrg[];
  /** La moyenne exacte des scores connus — celle de la barre d'état. */
  parc: number | null;
  ambre: PostureOrg | null;
  rouge: PostureOrg | null;
  alertes: AlerteCyber[];
  alerteAmbre: AlerteCyber | null;
  incidents: GroupeIncidents[];
  echeances: Echeance[];
  echeancesProches: Echeance[];
  actifs: (Actif & { id: string })[];
  actifsSurveilles: number;
  playbooks: (Playbook & { id: string })[];
  sslEnDefaut: number;
  critiquesNonPris: number;
  rondesNuit: number | null;
}

/** Les équipes de la Garde dont les remontées sont des alertes de sécurité. */
export const EQUIPES_CYBER = ['securite', 'sites'];

const GRAVITE_DOSSIER: Record<GardeDossier['gravite'], GraviteAlerte> = { critique: 'critique', haute: 'haute', normale: 'moyenne' };

export interface EntreesCyber {
  organisations: AdminOrganization[];
  controles: (ControlesOrg & { id: string })[];
  actifs: (Actif & { id: string })[];
  secrets: (Secret & { id: string })[];
  playbooks: (Playbook & { id: string })[];
  dossiers: GardeDossier[];
  incidents: FleetIncident[];
  ssl: SslStatus[];
  sites: RemoteSite[];
  releves: Releves;
  maintenant: number;
  rondesNuit: number | null;
}

const JOUR = 86_400_000;

/** Au-dessous de trois contrôles relevés, un score dirait plus qu'on ne sait : l'organisation est « non relevée ». */
export const CONTROLES_MIN = 3;

export function scoreDe(controles: Record<ControleCle, EtatReleve | null>): number | null {
  const connus = CONTROLES.map((c) => controles[c.cle]).filter((x): x is EtatReleve => Boolean(x));
  if (connus.length < CONTROLES_MIN) return null;
  return Math.round((100 * connus.reduce((s, x) => s + VALEUR[x.etat], 0)) / connus.length);
}

export function modeleCyber(e: EntreesCyber): Omit<ModeleCyber, 'pret' | 'pannes'> {
  const parOrgControles = new Map(e.controles.map((c) => [c.id, c]));
  const hotesParOrg = new Map<string, SslStatus[]>();
  const orgDuSite = new Map(e.sites.map((s) => [s.id, s.clientOrgId ?? null]));
  for (const s of e.ssl) {
    const orgId = s.site ? orgDuSite.get(s.site.id) : null;
    if (orgId) hotesParOrg.set(orgId, [...(hotesParOrg.get(orgId) ?? []), s]);
  }
  const incidentsParOrg = new Map<string, FleetIncident[]>();
  for (const i of e.incidents) if (i.status !== 'resolved') incidentsParOrg.set(i.orgId, [...(incidentsParOrg.get(i.orgId) ?? []), i]);
  const dossiersCritiques = new Map<string, GardeDossier>();
  for (const d of e.dossiers) if (d.gravite === 'critique' && d.orgId && !dossiersCritiques.has(d.orgId)) dossiersCritiques.set(d.orgId, d);
  const actifsParOrg = new Map<string, (Actif & { id: string })[]>();
  for (const a of e.actifs) actifsParOrg.set(a.orgId, [...(actifsParOrg.get(a.orgId) ?? []), a]);

  const orgs: PostureOrg[] = e.organisations.map((org) => {
    const declares = parOrgControles.get(org.id)?.controles ?? {};
    const controles = {} as Record<ControleCle, EtatReleve | null>;
    for (const c of CONTROLES) {
      const d = declares[c.cle];
      controles[c.cle] = d ? { etat: d.etat, source: d.source, at: d.at, pourquoi: d.note } : null;
    }
    // Les certificats, des relevés SSL.
    const hotes = hotesParOrg.get(org.id) ?? [];
    if (hotes.length) {
      const expire = hotes.find((h) => h.error || (h.daysLeft !== null && h.daysLeft < 0));
      const proche = hotes.filter((h) => h.daysLeft !== null && h.daysLeft >= 0 && h.daysLeft < 14).sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0))[0];
      const dernier = hotes.map((h) => h.lastCheckedAt).filter(Boolean).sort().pop() ?? null;
      controles.certificats = expire
        ? { etat: 'non_conforme', source: 'releve', at: dernier, pourquoi: expire.error ? `${expire.host} : ${expire.error}` : `${expire.host} a expiré` }
        : proche
          ? { etat: 'partiel', source: 'releve', at: dernier, pourquoi: `${proche.host} expire dans ${proche.daysLeft} j` }
          : { etat: 'conforme', source: 'releve', at: dernier };
    }
    // La brèche : un incident critique ouvert (ou le dossier critique de la Garde).
    const ouverts = incidentsParOrg.get(org.id) ?? [];
    const critiques = ouverts.filter((i) => i.severity === 'critical');
    const dossier = dossiersCritiques.get(org.id) ?? null;
    let breche: Breche | null = null;
    if (dossier || critiques.length) {
      const premier = [...critiques].sort((a, b) => a.firstSeenAt.localeCompare(b.firstSeenAt))[0];
      const pris = critiques.find((i) => i.acknowledgedBy);
      breche = {
        titre: dossier?.titre ?? premier.title,
        n: dossier?.n ?? critiques.length,
        prisPar: dossier?.prisPar ?? pris?.acknowledgedBy ?? null,
        prisLe: dossier?.prisLe ?? pris?.acknowledgedAt ?? null,
        depuis: dossier?.depuis ?? premier.firstSeenAt,
        incidentId: premier?.id ?? null,
      };
      controles.exposition = { etat: 'critique', source: 'releve', at: breche.depuis, pourquoi: 'incident critique ouvert' };
    }
    const score = scoreDe(controles);
    // Les points ouverts : un par défaut, les plus graves d'abord.
    const points: string[] = [];
    for (const etat of ['critique', 'non_conforme', 'partiel'] as EtatControle[]) {
      for (const c of CONTROLES) {
        const x = controles[c.cle];
        if (x?.etat === etat) points.push(x.pourquoi ? `${c.nom} : ${x.pourquoi}` : `${c.nom} ${etat === 'partiel' ? 'partiel' : 'non conforme'}`);
      }
    }
    for (const a of actifsParOrg.get(org.id) ?? []) if (a.defaut) points.push(`${a.nom} : ${a.defaut}`);
    for (const i of ouverts) if (i.severity === 'warning') points.push(i.title);
    const tendanceAvant = valeurIlYA(e.releves, 7, (r) => r.orgs[org.id]?.score, e.maintenant);
    const nouvelle = tendanceAvant === null;
    const courbe = serie(e.releves, 8, 7, (r) => r.orgs[org.id]?.score ?? null, e.maintenant);
    courbe[courbe.length - 1] = score;
    return {
      id: org.id,
      nom: org.name,
      org,
      controles,
      score,
      points,
      tendance: score !== null && tendanceAvant !== null ? score - tendanceAvant : null,
      nouvelle,
      breche,
      courbe,
      hotes: hotes.map((h) => h.host),
    };
  });

  // De la plus fragile à la plus solide ; celles qu'on n'a pas relevées, à la fin.
  orgs.sort((a, b) => (a.score ?? 101) - (b.score ?? 101) || a.nom.localeCompare(b.nom, 'fr'));
  const notes = orgs.filter((o) => o.score !== null);
  const parc = notes.length ? Math.round(notes.reduce((s, o) => s + (o.score ?? 0), 0) / notes.length) : null;
  // L'AMBRE : la plus forte baisse de la semaine, hors brèche (le rouge la tient déjà).
  const baisses = orgs.filter((o) => (o.tendance ?? 0) < 0 && !o.breche).sort((a, b) => (a.tendance ?? 0) - (b.tendance ?? 0));
  const ambre = baisses[0] ?? null;
  const rouge = orgs.filter((o) => o.breche).sort((a, b) => (b.breche?.n ?? 0) - (a.breche?.n ?? 0))[0] ?? null;

  // Les alertes : les dossiers de sécurité et de sites de la Garde.
  const noms = new Map(e.organisations.map((o) => [o.id, o.name]));
  const alertes: AlerteCyber[] = e.dossiers
    .filter((d) => EQUIPES_CYBER.includes(d.equipe) || d.gravite === 'critique')
    .map((d) => {
      const gravite = GRAVITE_DOSSIER[d.gravite];
      return {
        id: d.id,
        gravite,
        orgId: d.orgId,
        orgNom: d.orgNom ?? (d.orgId ? noms.get(d.orgId) ?? '—' : 'AMN DevSec'),
        titre: d.titre,
        n: d.n,
        qui: d.prisPar ?? null,
        depuis: d.depuis,
        resteMs: Date.parse(d.depuis) + DELAI_ALERTE_MS[gravite] - e.maintenant,
        statut: d.prisPar ? ('prise' as const) : ('ouverte' as const),
        dossier: d,
      };
    })
    .sort((a, b) => CRANS[b.gravite] - CRANS[a.gravite] || a.resteMs - b.resteMs);
  // L'ambre des alertes : la haute sans personne dont le délai tombe le plus tôt.
  const alerteAmbre = alertes.filter((a) => a.gravite === 'haute' && !a.qui).sort((a, b) => a.resteMs - b.resteMs)[0] ?? null;

  // Les incidents ouverts, un groupe par organisation et par gravité.
  const groupes: GroupeIncidents[] = [];
  for (const [orgId, liste] of incidentsParOrg) {
    for (const critique of [true, false]) {
      const l = liste.filter((i) => (i.severity === 'critical') === critique && i.severity !== 'info');
      if (!l.length) continue;
      const premier = [...l].sort((a, b) => a.firstSeenAt.localeCompare(b.firstSeenAt))[0];
      const pris = l.find((i) => i.acknowledgedBy);
      groupes.push({
        orgId,
        orgNom: premier.orgName || noms.get(orgId) || '—',
        critique,
        n: l.length,
        titre: l.length > 1 ? `${l.length} incidents ${critique ? 'critiques' : ''} regroupés`.replace('  ', ' ') : premier.title,
        depuis: premier.firstSeenAt,
        prisPar: pris?.acknowledgedBy ?? null,
        prisLe: pris?.acknowledgedAt ?? null,
        incidents: l,
      });
    }
  }
  groupes.sort((a, b) => Number(b.critique) - Number(a.critique) || a.depuis.localeCompare(b.depuis));

  // Les échéances : certificats relevés, actifs déclarés, secrets à faire tourner.
  const echeances: Echeance[] = [];
  const aujourdHui = Date.parse(`${jourDe(e.maintenant)}T00:00:00`);
  const jours = (date: string) => Math.round((Date.parse(`${date.slice(0, 10)}T00:00:00`) - aujourdHui) / JOUR);
  for (const s of e.ssl) {
    if (!s.validTo) continue;
    const orgId = s.site ? orgDuSite.get(s.site.id) ?? null : null;
    const date = s.validTo.slice(0, 10);
    echeances.push({ id: `ssl:${s.host}`, date, jours: jours(date), type: 'certificat', quoi: `Certificat · ${s.host}`, orgId, orgNom: orgId ? noms.get(orgId) ?? '—' : 'AMN DevSec', renouvelleSeul: /let'?s ?encrypt|r3|r10|r11|e5|e6/i.test(s.issuer ?? ''), source: 'ssl' });
  }
  for (const a of e.actifs) {
    if (!a.echeance) continue;
    const type = a.echeanceType ?? (a.famille === 'domaine' ? 'domaine' : a.famille === 'certificat' ? 'certificat' : 'renouvellement');
    const libelle = type === 'certificat' ? 'Certificat' : type === 'domaine' ? 'Domaine' : type === 'licence' ? 'Licence' : 'Renouvellement';
    echeances.push({ id: `actif:${a.id}`, date: a.echeance, jours: jours(a.echeance), type, quoi: `${libelle} · ${a.nom}`, orgId: a.orgId, orgNom: noms.get(a.orgId) ?? '—', renouvelleSeul: Boolean(a.renouvelleSeul), source: 'inventaire' });
  }
  for (const s of e.secrets) {
    const base = s.derniereRotation ? Date.parse(s.derniereRotation) : null;
    if (base === null || !s.periodeJours) continue;
    const date = jourDe(base + s.periodeJours * JOUR);
    echeances.push({ id: `secret:${s.id}`, date, jours: jours(date), type: 'secret', quoi: `Secret · ${s.nom}`, orgId: s.orgId, orgNom: noms.get(s.orgId) ?? '—', renouvelleSeul: false, source: 'secret' });
  }
  echeances.sort((a, b) => a.date.localeCompare(b.date) || a.quoi.localeCompare(b.quoi, 'fr'));
  const echeancesProches = echeances.filter((x) => x.jours >= 0 && x.jours <= 14);

  const hotes = new Set(e.ssl.map((s) => s.host));
  return {
    maintenant: e.maintenant,
    orgs,
    parc,
    ambre,
    rouge,
    alertes,
    alerteAmbre,
    incidents: groupes,
    echeances,
    echeancesProches,
    actifs: e.actifs,
    actifsSurveilles: e.actifs.length + e.sites.length + hotes.size,
    playbooks: e.playbooks,
    sslEnDefaut: e.ssl.filter((s) => s.error || (s.daysLeft !== null && s.daysLeft < 14)).length,
    critiquesNonPris: orgs.filter((o) => o.breche && !o.breche.prisPar).length,
    rondesNuit: e.rondesNuit,
  };
}

export function useCyber(): ModeleCyber {
  const src = useSourceBureaux();
  const controles = useCollection<ControlesOrg>('postureControles');
  const actifs = useCollection<Actif>('inventaire');
  const secrets = useCollection<Secret>('rotationsSecrets');
  const playbooks = useCollection<Playbook>('playbooks');
  const releves = useReleves();
  const maintenant = useMaintenant(60_000);
  return useMemo(() => {
    const m = modeleCyber({
      organisations: src.organisations,
      controles: controles as (ControlesOrg & { id: string })[],
      actifs: actifs as (Actif & { id: string })[],
      secrets: secrets as (Secret & { id: string })[],
      playbooks: playbooks as (Playbook & { id: string })[],
      dossiers: src.accueil?.pile.dossiers ?? [],
      incidents: src.incidents,
      ssl: src.ssl,
      sites: src.sites,
      releves,
      maintenant,
      rondesNuit: src.accueil?.cloture?.rondesNuit ?? null,
    });
    return { ...m, pret: src.pret, pannes: src.pannes };
  }, [src, controles, actifs, secrets, playbooks, releves, maintenant]);
}
