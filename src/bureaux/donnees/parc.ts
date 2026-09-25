import type { AdminOrganization, FleetIncident, ModuleRequestForOperator, SupportRequestForOperator } from '../../shared/api';
import type { GardeDossier } from '../../shared/garde';

/**
 * LE PARC VU PAR SUPERVISOR — les points ouverts de chaque organisation, leur
 * poids, qui la suit (cahier 11 `45a`, cahier 12 `46a`–`46c`).
 *
 * Pur, sans React : `check:bureaux` l'éprouve sur des parcs inventés, et les
 * écrans ne font que dessiner ce qu'il rend. Le poids se calcule depuis les
 * points ouverts, JAMAIS à la main ; changer un poids de la légende change le
 * tri — c'est pour ça qu'ils sont écrits dans la légende.
 */

export type Cause = 'critique' | 'incident' | 'jeton' | 'arrivee' | 'demande' | 'alerte';

/** Les poids affichés dans la légende de l'horizon, dans cet ordre. */
export const POIDS: Record<Cause, number> = { critique: 10, incident: 3, jeton: 4, arrivee: 4, demande: 2, alerte: 1 };
export const CAUSES: Cause[] = ['critique', 'incident', 'jeton', 'arrivee', 'demande', 'alerte'];
export const LIBELLE_CAUSE: Record<Cause, string> = {
  critique: 'Critique',
  incident: 'Incident',
  jeton: 'Jeton de places',
  arrivee: 'Arrivée',
  demande: 'Demande',
  alerte: 'Alerte de la Garde',
};

/** Une arrivée : une organisation qui n'a encore rien produit, depuis moins de trente jours. */
export const FENETRE_ARRIVEE_MS = 30 * 86_400_000;

export type Suivi = { type: 'humain'; email: string; depuis: string | null } | { type: 'garde' } | { type: 'personne' } | { type: 'rien' };

export interface OrgPoints {
  id: string;
  nom: string;
  statut: AdminOrganization['status'];
  points: Record<Cause, number>;
  poids: number;
  suivi: Suivi;
  /** La raison principale, en une phrase. */
  raison: string;
  /** Le dossier critique, s'il y en a un, et s'il est pris. */
  critique: { titre: string; n: number; prisPar: string | null; depuis: string } | null;
  org: AdminOrganization;
}

export interface SuiviRecord {
  id: string;
  par?: string;
  at?: string;
  /** Un suivi relâché garde sa trace mais ne compte plus. */
  relache?: boolean;
}

export interface EntreesParc {
  organisations: AdminOrganization[];
  dossiers: GardeDossier[];
  supports: SupportRequestForOperator[];
  modulesDemandes: ModuleRequestForOperator[];
  incidents: FleetIncident[];
  suivis: SuiviRecord[];
  maintenant: number;
}

const zero = (): Record<Cause, number> => ({ critique: 0, incident: 0, jeton: 0, arrivee: 0, demande: 0, alerte: 0 });

export function poidsDe(points: Record<Cause, number>): number {
  return CAUSES.reduce((s, c) => s + points[c] * POIDS[c], 0);
}

const pluriel = (n: number, un: string, des: string) => `${n} ${n > 1 ? des : un}`;

/** La phrase d'une organisation : ses causes, de la plus lourde à la plus légère. */
function raisonDe(p: Record<Cause, number>, critique: OrgPoints['critique'], org: AdminOrganization, alerteTitre: string | null): string {
  const morceaux: string[] = [];
  if (critique) morceaux.push(critique.n > 1 ? `${critique.n} incidents critiques regroupés en un dossier` : critique.titre);
  if (p.jeton) morceaux.push(p.jeton > 1 ? `${p.jeton} jetons de places à valider` : 'Jeton de places à valider');
  if (p.arrivee) morceaux.push('arrivée, espace pas encore activé');
  if (p.demande) morceaux.push(pluriel(p.demande, 'demande', 'demandes'));
  if (p.incident) morceaux.push(pluriel(p.incident, 'incident', 'incidents'));
  if (p.alerte && !morceaux.length) morceaux.push(alerteTitre ?? pluriel(p.alerte, 'alerte de la Garde', 'alertes de la Garde'));
  else if (p.alerte) morceaux.push(pluriel(p.alerte, 'alerte', 'alertes'));
  if (!morceaux.length) return org.status === 'suspended' ? 'Suspendue, rien d’ouvert' : 'Rien d’ouvert';
  const phrase = morceaux.join(', ');
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

/**
 * Les points ouverts de chaque organisation.
 *
 * · critique ×10 — un dossier critique de la Garde (deux cents incidents
 *   regroupés restent UN dossier) ; sans Garde, un incident critique ouvert.
 * · incident ×3 — un incident ouvert non critique (avertissement).
 * · jeton ×4 — une demande de places en attente.
 * · arrivée ×4 — rien produit, créée depuis moins de trente jours.
 * · demande ×2 — une demande de la cliente, ou une demande de module.
 * · alerte ×1 — un dossier de la Garde qui n'est pas critique.
 */
export function pointsDuParc(e: EntreesParc): OrgPoints[] {
  const parOrg = new Map<string, { p: Record<Cause, number>; critique: OrgPoints['critique']; pris: Set<string>; alerteTitre: string | null; ackPar: string | null }>();
  const de = (id: string) => {
    let x = parOrg.get(id);
    if (!x) {
      x = { p: zero(), critique: null, pris: new Set(), alerteTitre: null, ackPar: null };
      parOrg.set(id, x);
    }
    return x;
  };
  for (const d of e.dossiers) {
    if (!d.orgId) continue;
    const x = de(d.orgId);
    if (d.gravite === 'critique') {
      x.p.critique += 1;
      if (!x.critique || d.n > x.critique.n) x.critique = { titre: d.titre, n: d.n, prisPar: d.prisPar ?? null, depuis: d.depuis };
    } else {
      x.p.alerte += 1;
      x.alerteTitre = x.alerteTitre ?? d.titre;
    }
    if (d.prisPar) x.pris.add(d.prisPar);
  }
  const critiquesIncidents = new Map<string, FleetIncident[]>();
  for (const i of e.incidents) {
    if (i.status === 'resolved') continue;
    const x = de(i.orgId);
    if (i.severity === 'critical') critiquesIncidents.set(i.orgId, [...(critiquesIncidents.get(i.orgId) ?? []), i]);
    else if (i.severity === 'warning') x.p.incident += 1;
    if (i.acknowledgedBy) x.ackPar = x.ackPar ?? i.acknowledgedBy;
  }
  // Sans dossier de la Garde, les incidents critiques d'une organisation font UN point critique.
  for (const [orgId, liste] of critiquesIncidents) {
    const x = de(orgId);
    if (x.p.critique > 0) continue;
    x.p.critique = 1;
    const plusAncien = [...liste].sort((a, b) => a.firstSeenAt.localeCompare(b.firstSeenAt))[0];
    const pris = liste.find((i) => i.acknowledgedBy)?.acknowledgedBy ?? null;
    x.critique = { titre: plusAncien.title, n: liste.length, prisPar: pris, depuis: plusAncien.firstSeenAt };
  }
  for (const s of e.supports) {
    if (!s.orgId || s.status !== 'pending') continue;
    if (s.kind === 'seat') de(s.orgId).p.jeton += 1;
    else if (s.kind === 'message') de(s.orgId).p.demande += 1;
  }
  for (const m of e.modulesDemandes) {
    if (m.status === 'pending') de(m.orgId).p.demande += 1;
  }
  const suivis = new Map<string, SuiviRecord>();
  for (const s of e.suivis) if (s.id.startsWith('org:') && s.par && !s.relache) suivis.set(s.id.slice(4), s);

  return e.organisations.map((org) => {
    const x = parOrg.get(org.id) ?? { p: zero(), critique: null, pris: new Set<string>(), alerteTitre: null, ackPar: null };
    const p = { ...x.p };
    if (!org.lastActivityAt && org.status === 'active' && e.maintenant - Date.parse(org.createdAt) < FENETRE_ARRIVEE_MS) p.arrivee = 1;
    const poids = poidsDe(p);
    const explicite = suivis.get(org.id);
    let suivi: Suivi;
    if (explicite?.par) suivi = { type: 'humain', email: explicite.par, depuis: explicite.at ?? null };
    else if (x.critique?.prisPar) suivi = { type: 'humain', email: x.critique.prisPar, depuis: null };
    else if (x.pris.size) suivi = { type: 'humain', email: [...x.pris][0], depuis: null };
    else if (x.ackPar) suivi = { type: 'humain', email: x.ackPar, depuis: null };
    else if (poids === 0) suivi = { type: 'rien' };
    // La Garde seule : rien d'autre que ses propres alertes. Une organisation
    // suivie par la Garde seule ne peut pas être ambre (cahier 11, `45a`).
    else if (CAUSES.every((c) => c === 'alerte' || p[c] === 0)) suivi = { type: 'garde' };
    else suivi = { type: 'personne' };
    return { id: org.id, nom: org.name, statut: org.status, points: p, poids, suivi, raison: raisonDe(p, x.critique, org, x.alerteTitre), critique: x.critique, org };
  });
}

/** Le tri de l'horizon : ce qui demande un humain, de gauche à droite. */
export function trierParPoids(orgs: OrgPoints[]): OrgPoints[] {
  return [...orgs].sort((a, b) => b.poids - a.poids || a.nom.localeCompare(b.nom, 'fr'));
}

export const demandeUnHumain = (o: OrgPoints) => o.poids > 0 && o.suivi.type !== 'garde';
export const sansPersonne = (o: OrgPoints) => o.poids > 0 && o.suivi.type === 'personne';

/**
 * L'AMBRE DE L'HORIZON : la plus lourde des organisations qui ont des points
 * et personne pour les suivre. Les autres « sans personne » portent la
 * mention à l'encre ; le titre les compte.
 */
export function orgAmbre(orgs: OrgPoints[]): OrgPoints | null {
  return trierParPoids(orgs.filter(sansPersonne))[0] ?? null;
}

/** LE ROUGE : le seul segment critique de l'écran — la plus lourde des organisations au critique. */
export function orgRouge(orgs: OrgPoints[]): OrgPoints | null {
  return trierParPoids(orgs.filter((o) => o.points.critique > 0))[0] ?? null;
}

/* ═══ L'horizon à 200 organisations — `46a` ════════════════════════════ */

export const HORIZON = {
  toursMax: 10,
  toursSerrees: 16,
  poidsMin: 6,
  plateauMax: 120,
  ligneMax: 300,
  hauteurTours: 240,
} as const;

export interface Horizon {
  /** Les tours, dans l'ordre de l'horizon. `null` si les demandes débordent (plus de 16). */
  tours: OrgPoints[] | null;
  /** Combien d'organisations demandent un humain quand les tours débordent. */
  debordement: number;
  /** Le plateau : les autres organisations avec des points. */
  plateau: OrgPoints[];
  /** Au-delà de 120 colonnes, le plateau devient un histogramme par poids 1 à 5 (6 = « 6 et plus »). */
  histogramme: number[] | null;
  /** La ligne d'horizon : les organisations sans rien. */
  ligne: OrgPoints[];
  /** L'échelle commune aux tours et au plateau, en px par point. */
  pxParPoint: number;
}

export function horizon(orgs: OrgPoints[]): Horizon {
  const tri = trierParPoids(orgs);
  const avecPoints = tri.filter((o) => o.poids > 0);
  const ligne = tri.filter((o) => o.poids === 0);
  // D'abord toute organisation au critique, puis tout « sans personne », puis les plus lourdes.
  const prioritaires = avecPoints.filter((o) => o.points.critique > 0 || o.suivi.type === 'personne');
  let tours: OrgPoints[] | null;
  let debordement = 0;
  if (prioritaires.length > HORIZON.toursSerrees) {
    tours = null;
    debordement = prioritaires.length;
  } else if (prioritaires.length > HORIZON.toursMax) {
    tours = prioritaires;
  } else {
    const reste = avecPoints.filter((o) => !prioritaires.includes(o) && o.poids >= HORIZON.poidsMin);
    tours = trierParPoids([...prioritaires, ...reste.slice(0, HORIZON.toursMax - prioritaires.length)]);
  }
  // Tant que le parc tient dans l'horizon, chaque organisation a sa tour —
  // c'est le cas des neuf organisations du cahier 11. Le plateau ne commence
  // qu'au-delà de dix.
  if (tours && orgs.length <= HORIZON.toursMax) {
    tours = tri;
    return { tours, debordement, plateau: [], histogramme: null, ligne: [], pxParPoint: echelle(tours) };
  }
  const dansTours = new Set((tours ?? prioritaires).map((o) => o.id));
  const plateau = avecPoints.filter((o) => !dansTours.has(o.id));
  let histogramme: number[] | null = null;
  if (plateau.length > HORIZON.plateauMax) {
    histogramme = [0, 0, 0, 0, 0, 0];
    for (const o of plateau) histogramme[Math.min(6, Math.max(1, o.poids)) - 1] += 1;
  }
  return { tours, debordement, plateau, histogramme, ligne, pxParPoint: echelle(tours ?? prioritaires) };
}

/** `px = 240 / poids maximal` — la plus haute tour touche le haut de la boîte. */
export function echelle(tours: OrgPoints[]): number {
  const max = Math.max(1, ...tours.map((o) => o.poids));
  return HORIZON.hauteurTours / max;
}

/** Le bandeau sous le pupitre : les poids de TOUT le parc, dans l'ordre de l'horizon. */
export function poidsDuBandeau(orgs: OrgPoints[]): number[] {
  return trierParPoids(orgs).map((o) => o.poids);
}
