/**
 * L'APERÇU DE LA RECHERCHE ⌘K — le volet de droite de H41 v3, calculé. Pur, sans React, sans horloge.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * La ligne choisie dans la liste se montre à droite : pour un client, ses chiffres (« Facturé en 2026 »,
 * « En retard », « Rendez-vous »), la courbe de sa facturation sur 10 mois et ses trois derniers événements ;
 * pour une facture, son montant, son échéance et son état ; pour le reste, ce que la ligne dit déjà. Tout est
 * LU dans les collections que l'appelant passe (factures, rendez-vous, fiches clients) : aucun chiffre ne vient
 * d'ailleurs, et ce qui n'a pas de source n'est pas montré (voir la fin de ce commentaire).
 *
 * Les règles, une par chiffre :
 *   Facturé en {année}   somme TTC des factures émises ou payées dont l'émission tombe dans l'année en cours
 *                        (les avoirs, brouillons et annulées ne comptent pas) ;
 *   évolution            le même calcul sur la même période de l'année précédente (du 1er janvier au même jour),
 *                        en pourcentage arrondi ; rien si l'année précédente est à zéro ;
 *   En retard            ce qui reste dû sur les factures émises et échues (avoirs déduits, `resteDu`), et la
 *                        plus ancienne d'entre elles (numéro, jours de retard = aujourd'hui − échéance) ;
 *   Rendez-vous          le prochain rendez-vous prévu avec ce client, à partir de maintenant ;
 *   courbe               10 mois glissants jusqu'au mois en cours, la même somme mois par mois ;
 *   activité récente     les 3 derniers faits : événements de la fiche, factures émises, factures encaissées.
 *
 * Pas de source dans l'application, donc pas montré (écart documenté, jamais de chiffre inventé) : l'effectif
 * du client (« 12 personnes »), les tickets urgents (« 1 urgent »), les contacts et le responsable du suivi,
 * la note épinglée de la fiche, et l'action « Appeler ».
 */

export interface FactureApercu {
  id: string;
  numero: string;
  clientId: number;
  statut: 'draft' | 'issued' | 'paid' | 'cancelled';
  /** Un avoir ne se facture pas : il ne compte jamais. */
  avoir: boolean;
  /** Jours ISO (« 2026-10-12 ») ; vides tant que la facture ne les a pas. */
  emiseLe: string;
  echeance: string;
  payeeLe: string;
  totalCentimes: number;
  /** Ce qui reste réellement dû (avoirs déduits). */
  resteDuCentimes: number;
}

export interface RendezVousApercu {
  clientId: number | null;
  /** Instant ISO absolu. */
  debut: string;
  statut: 'scheduled' | 'done' | 'cancelled';
}

export interface ClientApercu {
  id: number;
  /** Création de la fiche (ISO). */
  creeLe?: string;
  evenements?: readonly { titre: string; date: string }[];
}

export interface SourcesApercu {
  clients: readonly ClientApercu[];
  factures: readonly FactureApercu[];
  rendezVous: readonly RendezVousApercu[];
}

export type FaitActivite =
  | { genre: 'evenement'; le: string; heure: boolean; titre: string }
  | { genre: 'emission'; le: string; heure: boolean; numero: string; montantCentimes: number }
  | { genre: 'encaissement'; le: string; heure: boolean; numero: string; montantCentimes: number };

export interface ApercuClient {
  genre: 'client';
  /** Création de la fiche (ISO), ou `null`. */
  depuis: string | null;
  annee: number;
  factureCentimes: number;
  /** En pourcentage arrondi ; `null` : pas de base de comparaison. */
  evolution: number | null;
  retard: { centimes: number; numero: string; jours: number } | null;
  /** Le prochain rendez-vous (instant ISO), ou `null`. */
  rendezVous: string | null;
  /** 10 sommes mensuelles, la plus ancienne d'abord, et leurs mois (« 2026-01 »… « 2026-10 »). */
  courbe: { valeurs: number[]; premier: string; dernier: string };
  activite: FaitActivite[];
}

export interface ApercuFacture {
  genre: 'facture';
  numero: string;
  totalCentimes: number;
  resteDuCentimes: number;
  echeance: string;
  etat: 'retard' | 'payee' | 'emise' | 'brouillon' | 'annulee';
  /** Jours de retard, s'il y en a. */
  jours: number;
}

export type Apercu = ApercuClient | ApercuFacture;

export const MOIS_COURBE = 10;
export const FAITS_ACTIVITE = 3;

const JOUR_MS = 86_400_000;

/** Le jour ISO local d'un instant. */
export function jourIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function debutJour(iso: string): number {
  const [a, m, j] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(a, (m || 1) - 1, j || 1);
}

/** `b − a`, en jours entiers. */
export function joursEntre(a: string, b: string): number {
  return Math.round((debutJour(b) - debutJour(a)) / JOUR_MS);
}

/** Les factures qui comptent dans un chiffre d'affaires : émises ou payées, jamais un avoir. */
const facturee = (f: FactureApercu): boolean => !f.avoir && (f.statut === 'issued' || f.statut === 'paid') && Boolean(f.emiseLe);

export function estEnRetard(f: FactureApercu, aujourdhui: string): boolean {
  return !f.avoir && f.statut === 'issued' && Boolean(f.echeance) && f.echeance.slice(0, 10) < aujourdhui && f.resteDuCentimes > 0;
}

/** Les 10 mois glissants qui finissent au mois de `jour` (« 2026-01 »… « 2026-10 »). */
export function moisGlissants(jour: string, n = MOIS_COURBE): string[] {
  const a = Number(jour.slice(0, 4));
  const m = Number(jour.slice(5, 7)) - 1;
  return Array.from({ length: n }, (_, i) => {
    const k = a * 12 + m - (n - 1 - i);
    return `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, '0')}`;
  });
}

export function apercuClient(clientId: number, sources: SourcesApercu, maintenant: Date): ApercuClient {
  const aujourdhui = jourIso(maintenant);
  const annee = maintenant.getFullYear();
  const client = sources.clients.find((c) => c.id === clientId);
  const siennes = sources.factures.filter((f) => f.clientId === clientId);

  const finPeriode = aujourdhui.slice(5); // « 10-30 » : la même période l'an dernier
  const somme = (an: number, jusquA?: string) =>
    siennes.filter((f) => facturee(f) && f.emiseLe.startsWith(String(an)) && (!jusquA || f.emiseLe.slice(5, 10) <= jusquA)).reduce((n, f) => n + f.totalCentimes, 0);
  const factureCentimes = somme(annee);
  const avant = somme(annee - 1, finPeriode);
  const evolution = avant > 0 ? Math.round(((factureCentimes - avant) / avant) * 100) : null;

  const retards = siennes.filter((f) => estEnRetard(f, aujourdhui)).sort((a, b) => a.echeance.localeCompare(b.echeance) || a.numero.localeCompare(b.numero));
  const retard = retards.length > 0 ? { centimes: retards.reduce((n, f) => n + f.resteDuCentimes, 0), numero: retards[0].numero, jours: joursEntre(retards[0].echeance, aujourdhui) } : null;

  const t = maintenant.getTime();
  const prochain = sources.rendezVous
    .filter((r) => r.clientId === clientId && r.statut === 'scheduled' && Number.isFinite(Date.parse(r.debut)) && Date.parse(r.debut) >= t)
    .sort((a, b) => Date.parse(a.debut) - Date.parse(b.debut))[0];

  const mois = moisGlissants(aujourdhui);
  const valeurs = mois.map((m) => siennes.filter((f) => facturee(f) && f.emiseLe.startsWith(m)).reduce((n, f) => n + f.totalCentimes, 0));

  const faits: FaitActivite[] = [];
  for (const e of client?.evenements ?? []) if (e.date && e.titre) faits.push({ genre: 'evenement', le: e.date, heure: e.date.length > 10, titre: e.titre });
  for (const f of siennes) {
    if (!f.avoir && f.statut === 'paid' && f.payeeLe) faits.push({ genre: 'encaissement', le: f.payeeLe, heure: f.payeeLe.length > 10, numero: f.numero, montantCentimes: f.totalCentimes });
    if (facturee(f)) faits.push({ genre: 'emission', le: f.emiseLe, heure: f.emiseLe.length > 10, numero: f.numero, montantCentimes: f.totalCentimes });
  }
  // Le plus récent d'abord ; à jour égal, un encaissement passe devant l'émission de la même facture.
  const rang = { encaissement: 0, evenement: 1, emission: 2 } as const;
  faits.sort((a, b) => b.le.slice(0, 10).localeCompare(a.le.slice(0, 10)) || b.le.localeCompare(a.le) || rang[a.genre] - rang[b.genre]);

  return {
    genre: 'client',
    depuis: client?.creeLe && Number.isFinite(Date.parse(client.creeLe)) ? client.creeLe : null,
    annee,
    factureCentimes,
    evolution,
    retard,
    rendezVous: prochain?.debut ?? null,
    courbe: { valeurs, premier: mois[0], dernier: mois[mois.length - 1] },
    activite: faits.slice(0, FAITS_ACTIVITE),
  };
}

export function apercuFacture(factureId: string, sources: SourcesApercu, maintenant: Date): ApercuFacture | null {
  const f = sources.factures.find((x) => x.id === factureId);
  if (!f) return null;
  const aujourdhui = jourIso(maintenant);
  const retard = estEnRetard(f, aujourdhui);
  const etat: ApercuFacture['etat'] = retard ? 'retard' : f.statut === 'paid' ? 'payee' : f.statut === 'issued' ? 'emise' : f.statut === 'draft' ? 'brouillon' : 'annulee';
  return { genre: 'facture', numero: f.numero, totalCentimes: f.totalCentimes, resteDuCentimes: f.resteDuCentimes, echeance: f.echeance, etat, jours: retard ? joursEntre(f.echeance, aujourdhui) : 0 };
}

/**
 * L'aperçu d'une ligne, par la clé de l'élément qu'elle concerne (`client:12`, `facture:abc`) ; `null` : la ligne
 * n'a pas d'aperçu chiffré (le volet montre alors ce que la ligne dit).
 */
export function apercuDeCle(cle: string | undefined, sources: SourcesApercu, maintenant: Date): Apercu | null {
  if (!cle) return null;
  const i = cle.indexOf(':');
  const type = cle.slice(0, i);
  const id = cle.slice(i + 1);
  if (type === 'client') {
    const n = Number(id);
    return Number.isFinite(n) ? apercuClient(n, sources, maintenant) : null;
  }
  if (type === 'facture') return apercuFacture(id, sources, maintenant);
  return null;
}
