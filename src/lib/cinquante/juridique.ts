/**
 * JURIDIQUE — ce qui engage (`38a` → `38e`).
 * ═══════════════════════════════════════════
 *
 * Cinq moteurs. Le Clausier lit la FICHE CLIENT réelle (un particulier n'a
 * pas de société), le RGPD interroge les collections réelles des autres
 * modules sur une personne — « jamais d'une liste type ».
 */

const JOUR_MS = 86_400_000;
const norme = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/* ══════════════════════════════════════════════════════════════════════════
   38a · CLAUSIER — le pliage
   ══════════════════════════════════════════════════════════════════════════ */

/** Un pli : 18 px entre les paragraphes, le numéro et la raison. */
export const PLI_PX = 18;
export type CleReponse = 'client' | 'duree' | 'lieu' | 'paiement' | 'soustraitance';
export type Reponses = Record<CleReponse, string>;

export interface Clause {
  kind: 'clause';
  numero: number;
  titre: string;
  texte: string;
  source: string;
  /** La clause s'applique si toutes ces réponses valent la valeur donnée (vide = toujours). */
  siReponses?: Partial<Reponses>;
  /** La clause est OBLIGATOIRE quand cette réponse a cette valeur. */
  obligatoireSi?: Partial<Reponses>;
  /** La raison écrite dans le pli quand la clause est repliée. */
  raisonRepli?: string;
  /** La dernière mise à jour juridique de la clause. */
  majLe?: string;
}
export interface ContratGenere {
  kind: 'contrat';
  titre: string;
  client: string;
  reponses: Reponses;
  genereLe: string;
  /** Les clauses dépliées à la main malgré les réponses. */
  depliees?: number[];
}
export type EnregistrementClausier = Clause | ContratGenere;

/** La réponse que donne la FICHE : une fiche sans société est un particulier. */
export const typeSelonFiche = (fiche: { company?: string } | null) => (fiche ? (fiche.company?.trim() ? 'professionnel' : 'particulier') : null);

const repond = (conditions: Partial<Reponses> | undefined, r: Reponses) =>
  !conditions || (Object.entries(conditions) as Array<[CleReponse, string]>).every(([k, v]) => r[k] === v);

export interface Paragraphe {
  clause: Clause;
  replie: boolean;
  raison: string | null;
  /** Repliée alors qu'une réponse la rend obligatoire : le générateur ne tranche pas. */
  contradiction: boolean;
}

/**
 * LE PLIAGE. Chaque clause s'applique ou se replie selon les réponses ; « rien
 * n'est supprimé en silence ». « Une clause obligatoire pour une réponse donnée
 * ne peut pas être repliée par une autre réponse : le générateur signale la
 * contradiction au lieu de trancher. » Les réponses sont comparées à la fiche :
 * celle qui vient de la fiche est la réponse VRAIE pour l'obligation.
 */
export function plier(clauses: Clause[], contrat: ContratGenere, fiche: { company?: string } | null) {
  const vraies: Reponses = { ...contrat.reponses };
  const selonFiche = typeSelonFiche(fiche);
  const ecart = selonFiche !== null && selonFiche !== contrat.reponses.client ? { saisie: contrat.reponses.client, fiche: selonFiche } : null;
  if (selonFiche) vraies.client = selonFiche;
  const paragraphes: Paragraphe[] = [...clauses]
    .sort((a, b) => a.numero - b.numero)
    .map((c) => {
      const depliee = contrat.depliees?.includes(c.numero) ?? false;
      const replie = !depliee && !repond(c.siReponses, contrat.reponses);
      const obligatoire = repond(c.obligatoireSi, vraies) && !!c.obligatoireSi;
      return { clause: c, replie, raison: replie ? c.raisonRepli ?? 'ne s’applique pas' : null, contradiction: replie && obligatoire };
    });
  /** L'ambre : le pli qui contredit la fiche du client. */
  const ambre = paragraphes.find((p) => p.contradiction) ?? null;
  return { paragraphes, ecart, ambre };
}

/* ══════════════════════════════════════════════════════════════════════════
   38b · SIGNATURE À DISTANCE — le témoin
   ══════════════════════════════════════════════════════════════════════════ */

export interface Signataire {
  role: string;
  nom: string;
  signeLe?: string;
  ouvertures?: number;
}
export interface CircuitSignature {
  kind: 'circuit';
  document: string;
  client: string;
  envoyeLe: string;
  /** L'ordre est fixé à l'envoi et ne se modifie pas. */
  signataires: Signataire[];
  debutContratLe?: string;
  relances?: Array<{ le: string; a: string }>;
}
export type EnregistrementSignature = CircuitSignature;

/** Un circuit abandonné quinze jours est clos, non signé. */
export const ABANDON_J = 15;

export function temoin(c: CircuitSignature, maintenant: Date) {
  const i = c.signataires.findIndex((s) => !s.signeLe);
  if (i < 0) return { index: -1, detenteur: null, depuisJ: 0, signe: true, abandonne: false, fin: c.signataires[c.signataires.length - 1]?.signeLe ?? null };
  /* Le témoin arrive chez le signataire quand le précédent a signé (ou à l'envoi). */
  const depuis = i === 0 ? c.envoyeLe : (c.signataires[i - 1].signeLe as string);
  const depuisJ = Math.floor((maintenant.getTime() - new Date(depuis).getTime()) / JOUR_MS);
  return { index: i, detenteur: c.signataires[i], depuisJ, signe: false, abandonne: depuisJ >= ABANDON_J, fin: null };
}
/** « Une relance ne part qu'à la personne qui tient le témoin, jamais à tout le circuit. » */
export const destinataireRelance = (c: CircuitSignature, maintenant: Date) => temoin(c, maintenant).detenteur?.nom ?? null;

/* ══════════════════════════════════════════════════════════════════════════
   38c · RGPD — l'empreinte d'une personne
   ══════════════════════════════════════════════════════════════════════════ */

/** « Positions en couronne : 50 % + 34 % · cos θ, 190 + 140 · sin θ dans un conteneur de 380 px. » */
export const COURONNE = { hauteur: 380, centreY: 190, rayonXPct: 34, rayonY: 140, carte: 196 } as const;
export function positionCouronne(i: number, n: number) {
  const th = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return { xPct: 50 + COURONNE.rayonXPct * Math.cos(th), y: COURONNE.centreY + COURONNE.rayonY * Math.sin(th), xVb: 500 + COURONNE.rayonXPct * 10 * Math.cos(th) };
}

export interface Traitement {
  kind: 'traitement';
  nom: string;
  module: string;
  collection: string;
  baseLegale: string;
  /** Durée de conservation en jours ; null quand elle court « le temps de la relation ». */
  dureeJours: number | null;
  dureeLibelle: string;
  /** Une donnée liée à une facture n'est jamais purgée automatiquement. */
  lieAFacture?: boolean;
}
export interface DemandeRgpd {
  kind: 'demande';
  personne: string;
  type: 'acces' | 'effacement';
  le: string;
}
export interface Purge {
  kind: 'purge';
  collection: string;
  nombre: number;
  le: string;
}
export interface Revue {
  kind: 'revue';
  le: string;
}
export type EnregistrementRgpd = Traitement | DemandeRgpd | Purge | Revue;

/** Ce qu'une collection garde d'une personne : les enregistrements, leur âge, une description. */
export interface Trouve {
  traitement: Traitement;
  nombre: number;
  plusAncien: string | null;
  description: string;
  ids: string[];
}

/**
 * L'EMPREINTE — la requête réelle : chaque traitement du registre nomme une
 * collection ; on y cherche la personne (nom, société, destinataire, appelant).
 * Une donnée passe en ambre dès que son âge dépasse la durée du registre.
 */
export function empreinte(
  personne: string,
  traitements: Traitement[],
  sources: Record<string, Array<{ id: string; texte: string; date: string | null; description?: string }>>,
  maintenant: Date,
) {
  const cible = norme(personne);
  const trouves: Trouve[] = [];
  for (const t of traitements) {
    const lignes = (sources[t.collection] ?? []).filter((l) => norme(l.texte).includes(cible));
    if (!lignes.length) continue;
    const dates = lignes.map((l) => l.date).filter((d): d is string => !!d).sort();
    trouves.push({ traitement: t, nombre: lignes.length, plusAncien: dates[0] ?? null, description: lignes[0].description ?? '', ids: lignes.map((l) => l.id) });
  }
  const depassements = trouves
    .filter((x) => x.traitement.dureeJours !== null && x.plusAncien)
    .map((x) => ({ x, ageJ: Math.floor((maintenant.getTime() - new Date(x.plusAncien as string).getTime()) / JOUR_MS) }))
    .filter(({ x, ageJ }) => ageJ > (x.traitement.dureeJours as number))
    .sort((a, b) => b.ageJ - (b.x.traitement.dureeJours ?? 0) - (a.ageJ - (a.x.traitement.dureeJours ?? 0)));
  return { trouves, ambre: depassements[0] ?? null };
}

/* ══════════════════════════════════════════════════════════════════════════
   38d · IMPACT RSE — les cubes
   ══════════════════════════════════════════════════════════════════════════ */

/** « Un cube = 100 kg, arrondi à l'unité la plus proche ; le total affiché est la somme des cubes. » */
export const KG_PAR_CUBE = 100;
export const CUBES_PAR_RANGEE = 5;
export interface SourceEmission {
  kind: 'source';
  nom: string;
  poste: string;
  volume: number;
  unite: string;
  /** Facteur d'émission (kg CO₂e par unité), tiré de la base publique de référence. */
  facteurKg: number;
  referenceFacteur: string;
  annee: number;
  ordre: number;
}
export interface BilanActivite {
  kind: 'activite';
  annee: number;
  interventions: number;
}
export type EnregistrementRse = SourceEmission | BilanActivite;

export const cubesDe = (s: Pick<SourceEmission, 'volume' | 'facteurKg'>) => Math.round((s.volume * s.facteurKg) / KG_PAR_CUBE);

export function empilement(enr: EnregistrementRse[], annee: number) {
  const cette = enr.filter((e): e is SourceEmission => e.kind === 'source' && e.annee === annee).sort((a, b) => a.ordre - b.ordre);
  const avant = enr.filter((e): e is SourceEmission => e.kind === 'source' && e.annee === annee - 1);
  const colonnes = cette.map((s) => {
    const n = cubesDe(s);
    const precedent = avant.find((p) => p.nom === s.nom);
    const n0 = precedent ? cubesDe(precedent) : 0;
    return { source: s, cubes: n, avant: n0, apparus: Math.max(0, n - n0), disparus: Math.max(0, n0 - n) };
  });
  /** L'ambre : les cubes apparus dans la source de plus forte hausse — seulement là. */
  const hausse = [...colonnes].filter((c) => c.apparus > 0).sort((a, b) => b.apparus - a.apparus)[0] ?? null;
  const total = colonnes.reduce((s, c) => s + c.cubes, 0);
  const totalAvant = avant.reduce((s, p) => s + cubesDe(p), 0);
  const activite = enr.find((e): e is BilanActivite => e.kind === 'activite' && e.annee === annee);
  return {
    colonnes,
    hausse,
    totalCubes: total,
    variationCubes: avant.length ? total - totalAvant : null,
    parInterventionKg: activite && activite.interventions ? Math.round((total * KG_PAR_CUBE) / activite.interventions) : null,
    rangees: Math.max(1, ...colonnes.map((c) => Math.ceil(Math.max(c.cubes, c.avant) / CUBES_PAR_RANGEE))),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   38e · VÉRIFICATION D'IDENTITÉ — les goupilles
   ══════════════════════════════════════════════════════════════════════════ */

export const SERRURE = { goupille: 210, haut: 24, ligne: 100, pilote: 76, bas: 180, decalageMax: 40 } as const;
/** Seuils : un justificatif de moins de trois mois, une correspondance d'au moins 90 %. */
export const JUSTIFICATIF_MAX_J = 91;
export const CORRESPONDANCE_MIN = 90;
/** Le décalage est proportionnel à l'écart : 11 px par mois d'ancienneté en trop, 2 px par point sous 90 %. */
export const PX_PAR_JOUR = 11 / 30.4;
export const PX_PAR_POINT = 2;

export interface Controle {
  cle: 'piece' | 'selfie' | 'adresse' | 'siren' | 'iban';
  nom: string;
  /** Selon le contrôle : date du justificatif, score de correspondance, ou résultat binaire. */
  dateJustificatif?: string;
  score?: number;
  ok?: boolean;
  detail: string;
}
export interface Verification {
  kind: 'verification';
  client: string;
  professionnel: boolean;
  demandeeLe: string;
  controles: Controle[];
  valideeLe?: string;
  justificatifDemandeLe?: string;
}
export interface ReglageKyc {
  kind: 'reglage';
  conservationAns: number;
  seuilCaAnnuelCents: number;
}
export type EnregistrementKyc = Verification | ReglageKyc;

export function decalage(c: Controle, maintenant: Date): { px: number; raison: string | null } {
  if (c.dateJustificatif) {
    const age = (maintenant.getTime() - new Date(c.dateJustificatif).getTime()) / JOUR_MS;
    const trop = age - JUSTIFICATIF_MAX_J;
    return trop > 0 ? { px: Math.min(SERRURE.decalageMax, Math.max(2, Math.round(trop * PX_PAR_JOUR))), raison: 'justificatif de plus de 3 mois' } : { px: 0, raison: null };
  }
  if (typeof c.score === 'number') {
    const manque = CORRESPONDANCE_MIN - c.score;
    return manque > 0 ? { px: Math.min(SERRURE.decalageMax, Math.round(manque * PX_PAR_POINT)), raison: `correspondance à ${c.score} %` } : { px: 0, raison: null };
  }
  return c.ok === false ? { px: SERRURE.decalageMax, raison: c.detail } : { px: 0, raison: null };
}

/** « Un client ne passe jamais “vérifié” avec une goupille désalignée. » */
export function serrure(v: Verification, maintenant: Date) {
  const goupilles = v.controles.map((c) => ({ c, ...decalage(c, maintenant) }));
  const bloquantes = goupilles.filter((g) => g.px > 0);
  const ambre = [...bloquantes].sort((a, b) => b.px - a.px)[0] ?? null;
  return { goupilles, ouverte: bloquantes.length === 0, ambre };
}
