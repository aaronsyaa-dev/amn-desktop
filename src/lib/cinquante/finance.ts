/**
 * FINANCE — la banque, le fisc et l'avenir de la trésorerie (`36a` → `36i`).
 * ════════════════════════════════════════════════════════════════════════
 *
 * Neuf moteurs, un par module. Les règles de `MODULES-NOUVEAUX.md`
 * (§ 16 à 24) y sont écrites telles quelles ; `check:cinquante` les éprouve.
 * Tout montant est en CENTIMES.
 */
import { type Id } from './guichet';

const JOUR_MS = 86_400_000;
const borne = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** Le numéro de semaine ISO 8601 d'une date (S47…). */
export function semaineIso(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const jour = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - jour);
  const debut = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - debut.getTime()) / JOUR_MS + 1) / 7);
}

/* ══════════════════════════════════════════════════════════════════════════
   36a · TRÉSORERIE PRÉVUE — le cône
   ══════════════════════════════════════════════════════════════════════════ */

/** « Échelle verticale commune, 0 à 24 000 €, avec le zéro toujours visible. » */
export const CONE = { semaines: 12, maxCents: 2_400_000, viewBox: { l: 1000, h: 260 }, yZero: 210, yMax: 10 } as const;

export interface SoldeTresorerie {
  kind: 'solde';
  soldeCents: number;
  le: string;
}
export type NatureFlux = 'certaine' | 'probable' | 'sortie-fixe' | 'sortie-variable';
export interface FluxPrevu {
  kind: 'flux';
  libelle: string;
  le: string;
  montantCents: number; // positif = entrée, négatif = sortie
  nature: NatureFlux;
}
/** Une semaine passée : ce qui est réellement entré et sorti (douze derniers mois). */
export interface SemaineHistorique {
  kind: 'historique';
  debut: string;
  entreesCents: number;
  sortiesCents: number;
}
export type EnregistrementTresorerie = SoldeTresorerie | FluxPrevu | SemaineHistorique;

/** Le y d'un solde dans le `viewBox` : 0 € à 210, 24 000 € à 10. */
export const yCone = (cents: number) => CONE.yZero - (cents / CONE.maxCents) * (CONE.yZero - CONE.yMax);

export function ecartType(valeurs: number[]): number {
  if (valeurs.length < 2) return 0;
  const m = valeurs.reduce((s, v) => s + v, 0) / valeurs.length;
  return Math.sqrt(valeurs.reduce((s, v) => s + (v - m) ** 2, 0) / (valeurs.length - 1));
}

export interface Cone {
  soldeCents: number;
  /** 13 points : aujourd'hui, puis chaque fin de semaine. */
  central: number[];
  ecart: number[];
  /** La première semaine (1 → 12) où `central − écart < 0`, ou null. */
  critique: number | null;
  sigmaHebdoCents: number;
  semaines: number[];
}

/**
 * LE CÔNE. La ligne centrale cumule tous les flux prévus (certains,
 * probables, sorties) semaine par semaine. « L'élargissement vient de la
 * variance réelle des encaissements des douze derniers mois, jamais d'un
 * pourcentage fixe » : l'écart à la semaine k est σ × √k, σ étant l'écart
 * type des encaissements hebdomadaires relevés — les incertitudes de semaines
 * indépendantes s'ajoutent en variance, pas en largeur.
 */
export function cone(enr: EnregistrementTresorerie[], maintenant: Date): Cone | null {
  const solde = enr
    .filter((e): e is SoldeTresorerie => e.kind === 'solde')
    .sort((a, b) => b.le.localeCompare(a.le))[0];
  if (!solde) return null;
  const depuis = maintenant.getTime() - 365 * JOUR_MS;
  const histo = enr.filter((e): e is SemaineHistorique => e.kind === 'historique' && new Date(e.debut).getTime() >= depuis);
  const sigma = ecartType(histo.map((h) => h.entreesCents));
  const flux = enr.filter((e): e is FluxPrevu => e.kind === 'flux');
  const central = [solde.soldeCents];
  const ecart = [0];
  const semaines = [semaineIso(maintenant)];
  let critique: number | null = null;
  for (let k = 1; k <= CONE.semaines; k += 1) {
    const debut = maintenant.getTime() + (k - 1) * 7 * JOUR_MS;
    const fin = debut + 7 * JOUR_MS;
    const net = flux.filter((f) => new Date(f.le).getTime() >= debut && new Date(f.le).getTime() < fin).reduce((s, f) => s + f.montantCents, 0);
    central.push(central[k - 1] + net);
    ecart.push(sigma * Math.sqrt(k));
    semaines.push(semaineIso(new Date(fin - JOUR_MS)));
    if (critique === null && central[k] - ecart[k] < 0) critique = k;
  }
  return { soldeCents: solde.soldeCents, central, ecart, critique, sigmaHebdoCents: sigma, semaines };
}

/** Ce qui fait le cône, sur l'horizon : entrées certaines, probables, sorties variables. */
export function compositionCone(enr: EnregistrementTresorerie[], maintenant: Date) {
  const fin = maintenant.getTime() + CONE.semaines * 7 * JOUR_MS;
  const dans = enr.filter((e): e is FluxPrevu => e.kind === 'flux' && new Date(e.le).getTime() >= maintenant.getTime() && new Date(e.le).getTime() < fin);
  const somme = (n: NatureFlux) => dans.filter((f) => f.nature === n).reduce((s, f) => s + Math.abs(f.montantCents), 0);
  return { certaines: somme('certaine'), probables: somme('probable'), variables: somme('sortie-variable'), fixes: somme('sortie-fixe') };
}

/**
 * La mensualité SUPPORTABLE — lue dans Trésorerie prévue : l'excédent
 * mensuel moyen (entrées − sorties) des semaines relevées, ramené au mois.
 * Sans historique, il n'y a pas de seuil : on ne l'invente pas.
 */
export function mensualiteSupportable(enr: EnregistrementTresorerie[], maintenant: Date): number | null {
  const depuis = maintenant.getTime() - 365 * JOUR_MS;
  const histo = enr.filter((e): e is SemaineHistorique => e.kind === 'historique' && new Date(e.debut).getTime() >= depuis);
  if (histo.length < 4) return null;
  const netHebdo = histo.reduce((s, h) => s + h.entreesCents - h.sortiesCents, 0) / histo.length;
  const mensuel = (netHebdo * 52) / 12;
  return mensuel > 0 ? Math.round(mensuel / 1000) * 1000 : 0;
}

/* ══════════════════════════════════════════════════════════════════════════
   36b · SCÉNARIOS — la console
   ══════════════════════════════════════════════════════════════════════════ */

export const CONSOLE = { piste: 200, curseurL: 40, curseurH: 18 } as const;
export type CleHypothese = 'prix' | 'volume' | 'embauche' | 'camionnette' | 'delai';
export interface Hypothese {
  cle: CleHypothese;
  nom: string;
  min: number;
  max: number;
  pas: number;
}
/** Le modèle de budget : ce que vaut chaque hypothèse en euros. */
export interface ModeleBudget {
  kind: 'modele';
  exercice: number;
  caBaseCents: number;
  /** Part du chiffre d'affaires qui est une charge variable (produits, déplacements). */
  tauxVariable: number;
  chargesFixesCents: number;
  /** Coût mensuel d'une embauche, du mois d'arrivée à décembre. */
  salaireMensuelCents: number;
  /** Coût mensuel de la camionnette, du mois d'achat à décembre (13 = l'an prochain). */
  camionnetteMensuelleCents: number;
  /** Coût annuel d'un jour de délai client (le découvert qu'il faut porter). */
  coutJourDelaiCents: number;
  hypotheses: Hypothese[];
}
export type Valeurs = Record<CleHypothese, number>;
export interface ScenarioBudget {
  kind: 'scenario';
  nom: string;
  valeurs: Valeurs;
  enregistreLe: string;
  ordre: number;
}
export type EnregistrementScenarios = ModeleBudget | ScenarioBudget;

/** Le résultat net de l'exercice pour une position de la console. */
export function resultat(m: ModeleBudget, v: Valeurs): number {
  const ca = m.caBaseCents * (1 + v.prix / 100) * (1 + v.volume / 100);
  const variables = m.caBaseCents * (1 + v.volume / 100) * m.tauxVariable;
  const moisEmbauche = v.embauche >= 13 ? 0 : 13 - v.embauche;
  const moisCamion = v.camionnette >= 13 ? 0 : 13 - v.camionnette;
  return Math.round(
    ca - variables - m.chargesFixesCents - moisEmbauche * m.salaireMensuelCents - moisCamion * m.camionnetteMensuelleCents - v.delai * m.coutJourDelaiCents,
  );
}

/** « top = 100 − (valeur − min) / (max − min) × 100 % » */
export const topCurseur = (h: Pick<Hypothese, 'min' | 'max'>, valeur: number) =>
  100 - (borne(valeur, h.min, h.max) - h.min) / (h.max - h.min || 1) * 100;

/**
 * LE POIDS d'une hypothèse : sa part dans l'écart de résultat entre les
 * scénarios extrêmes, « calculée en faisant varier une hypothèse à la fois »
 * — on part du plus prudent, on ne porte QU'ELLE à sa valeur du plus
 * ambitieux, et on mesure ce que gagne le résultat. Les parts sont
 * rapportées à leur somme, pour qu'elles fassent 100 %.
 */
export function poids(m: ModeleBudget, prudent: Valeurs, ambitieux: Valeurs) {
  const base = resultat(m, prudent);
  const effets = m.hypotheses.map((h) => ({ cle: h.cle, effet: Math.abs(resultat(m, { ...prudent, [h.cle]: ambitieux[h.cle] }) - base) }));
  const total = effets.reduce((s, e) => s + e.effet, 0) || 1;
  return effets.map((e) => ({ ...e, part: e.effet / total })).sort((a, b) => b.part - a.part);
}

/* ══════════════════════════════════════════════════════════════════════════
   36c · SIMULATEUR DE PRÊT — même prêt, trois durées
   ══════════════════════════════════════════════════════════════════════════ */

/** « Capital et intérêts partagent une seule échelle verticale : 24 000 € = 180 px. » */
export const PRET = { capitalPx: 180 } as const;
export interface DemandePret {
  kind: 'pret';
  objet: string;
  capitalCents: number;
  tauxAnnuel: number; // 0.042
  dureesAns: number[];
  debut: string;
  demandeLe?: string;
  dureeDemandeeAns?: number;
}
export type EnregistrementPret = DemandePret;

/** La mensualité d'un prêt amortissable à taux fixe. */
export function mensualite(capitalCents: number, tauxAnnuel: number, mois: number): number {
  const t = tauxAnnuel / 12;
  if (t === 0) return capitalCents / mois;
  return (capitalCents * t) / (1 - (1 + t) ** -mois);
}

export function durees(p: Pick<DemandePret, 'capitalCents' | 'tauxAnnuel' | 'dureesAns'>, supportableCents: number | null) {
  const lignes = [...p.dureesAns].sort((a, b) => a - b).map((ans) => {
    const m = mensualite(p.capitalCents, p.tauxAnnuel, ans * 12);
    const interets = Math.round(m * ans * 12 - p.capitalCents);
    return { ans, mensualiteCents: Math.round(m), interetsCents: interets, coiffePx: (interets / p.capitalCents) * PRET.capitalPx };
  });
  /** L'ambre : « la durée la plus courte qui passe sous ce seuil ; si aucune ne passe, pas d'ambre. » */
  const ambre = supportableCents === null ? null : lignes.find((l) => l.mensualiteCents <= supportableCents) ?? null;
  /* L'échelle des mensualités : le seuil à 60 %, sauf si une mensualité la dépasse. */
  const echelle = Math.max(supportableCents === null ? 0 : supportableCents / 0.6, ...lignes.map((l) => l.mensualiteCents * 1.05));
  return { lignes, ambre, echelle };
}

/* ══════════════════════════════════════════════════════════════════════════
   36d · ANALYTIQUE — la pente
   ══════════════════════════════════════════════════════════════════════════ */

export const PENTE = { viewBoxH: 320, xGauche: 220, xDroite: 780, ecartMinPx: 14 } as const;
export interface PosteMarge {
  poste: string;
  prevuCents: number;
  reelCents: number;
  detailPrevu?: string;
  detailReel?: string;
}
export interface ProjetClos {
  kind: 'projet';
  nom: string;
  closLe: string;
  margePrevue: number; // en %
  margeReelle: number;
  postes: PosteMarge[];
  cause?: string;
}
export type EnregistrementAnalytique = ProjetClos;

/** « Position verticale : 300 − (marge + 10) × 5 dans un viewBox de hauteur 320. » */
export const yMarge = (marge: number) => 300 - (borne(marge, -10, 50) + 10) * 5;

/**
 * Les étiquettes d'un côté : « au-dessous de 14 px d'écart, la seconde se
 * décale et un filet la relie à son trait ». Rend, pour chaque projet, le y
 * de son étiquette (en px du conteneur de 320) et s'il a fallu décaler.
 */
export function etiquettes(valeurs: Array<{ id: string; y: number }>) {
  const tries = [...valeurs].sort((a, b) => a.y - b.y);
  const sortie = new Map<string, { y: number; decale: boolean }>();
  let prec = -Infinity;
  for (const v of tries) {
    const y = v.y - prec < PENTE.ecartMinPx ? prec + PENTE.ecartMinPx : v.y;
    sortie.set(v.id, { y, decale: y !== v.y });
    prec = y;
  }
  return sortie;
}

export function trimestreDe(d: Date) {
  const t = Math.floor(d.getMonth() / 3);
  return { debut: new Date(d.getFullYear(), t * 3, 1), fin: new Date(d.getFullYear(), t * 3 + 3, 1) };
}

/* ══════════════════════════════════════════════════════════════════════════
   36e · RAPPROCHEMENT — la fermeture éclair
   ══════════════════════════════════════════════════════════════════════════ */

export interface LigneBanque {
  kind: 'banque';
  le: string;
  libelle: string;
  montantCents: number;
  valideeLe?: string;
}
export interface Ecriture {
  kind: 'ecriture';
  le: string;
  libelle: string;
  montantCents: number;
  compte?: string;
}
export interface RegleRapprochement {
  kind: 'regle';
  libelle: string;
  cible: string;
  /** Tolérance en centimes — « ne s'applique qu'aux frais bancaires ». */
  toleranceCents: number;
  fraisBancaires: boolean;
  motif: string; // début de libellé, en majuscules
}
export type EnregistrementRapprochement = LigneBanque | Ecriture | RegleRapprochement;

export interface Paire {
  banque: Id<LigneBanque>;
  ecriture: Id<Ecriture>;
  regle: Id<RegleRapprochement> | null;
}

/**
 * LE RAPPROCHEMENT. « Une paire ne se ferme que si le montant correspond
 * exactement ; une tolérance ne s'applique qu'aux frais bancaires. » Chaque
 * ligne cherche, par date, l'écriture libre de même montant (ou dans la
 * tolérance d'une règle de frais bancaires dont le motif ouvre son libellé).
 */
export function fermeture(enr: Array<Id<EnregistrementRapprochement>>) {
  const banque = enr.filter((e): e is Id<LigneBanque> => e.kind === 'banque').sort((a, b) => a.le.localeCompare(b.le));
  const ecritures = enr.filter((e): e is Id<Ecriture> => e.kind === 'ecriture').sort((a, b) => a.le.localeCompare(b.le));
  const regles = enr.filter((e): e is Id<RegleRapprochement> => e.kind === 'regle');
  const libres = new Set(ecritures.map((e) => e.id));
  const paires: Paire[] = [];
  const ouvertesBanque: Array<Id<LigneBanque>> = [];
  for (const l of banque) {
    const regle = regles.find((r) => l.libelle.toUpperCase().startsWith(r.motif.toUpperCase())) ?? null;
    const tolerance = regle?.fraisBancaires ? regle.toleranceCents : 0;
    const e = ecritures.find((x) => libres.has(x.id) && Math.abs(x.montantCents - l.montantCents) <= tolerance && Math.sign(x.montantCents) === Math.sign(l.montantCents));
    if (e) {
      libres.delete(e.id);
      paires.push({ banque: l, ecriture: e, regle });
    } else ouvertesBanque.push(l);
  }
  const ouvertesEcritures = ecritures.filter((e) => libres.has(e.id));
  /** « L'ambre va à la ligne ouverte de plus gros montant absolu. » */
  const toutes = [
    ...ouvertesBanque.map((l) => ({ cote: 'banque' as const, id: l.id, montant: l.montantCents })),
    ...ouvertesEcritures.map((e) => ({ cote: 'ecriture' as const, id: e.id, montant: e.montantCents })),
  ];
  const ambre = [...toutes].sort((a, b) => Math.abs(b.montant) - Math.abs(a.montant))[0] ?? null;
  const aJustifier = toutes.reduce((s, x) => s + Math.abs(x.montant), 0);
  return { paires, ouvertesBanque, ouvertesEcritures, ambre, aJustifier, regles };
}

/* ══════════════════════════════════════════════════════════════════════════
   36f · PRÉVISION FISCALE — le filigrane
   ══════════════════════════════════════════════════════════════════════════ */

export interface SoldeFiscal {
  kind: 'solde';
  soldeCents: number;
  le: string;
}
export interface EcheanceFiscale {
  kind: 'echeance';
  impot: string;
  court: string;
  echeance: string;
  montantCents: number;
  /** Une échéance estimée (la TVA suivante) reste hors du filigrane. */
  estimation?: boolean;
  payeeLe?: string;
  /** La TVA en cours se calcule : collectée − déductible, à la date du jour. */
  tva?: { collecteeCents: number; deductibleCents: number; projeteeCents: number; clotureLe: string };
}
export type EnregistrementFiscal = SoldeFiscal | EcheanceFiscale;

export const montantEcheance = (e: EcheanceFiscale) => (e.tva ? e.tva.collecteeCents - e.tva.deductibleCents : e.montantCents);

export function filigrane(enr: EnregistrementFiscal[], maintenant: Date) {
  const solde = enr.filter((e): e is SoldeFiscal => e.kind === 'solde').sort((a, b) => b.le.localeCompare(a.le))[0] ?? null;
  const echeances = enr
    .filter((e): e is EcheanceFiscale => e.kind === 'echeance' && !e.payeeLe)
    .sort((a, b) => a.echeance.localeCompare(b.echeance));
  const connues = echeances.filter((e) => !e.estimation);
  const segments = connues.map((e) => ({
    e,
    montantCents: montantEcheance(e),
    /** « Un segment dont l'échéance est passée sans paiement devient rouge. » */
    enRetard: new Date(e.echeance) < maintenant,
    constituePct: e.tva ? Math.round((montantEcheance(e) / Math.max(1, e.tva.projeteeCents)) * 100) : 100,
  }));
  /** « La somme des segments égale exactement la part fiscale. » */
  const partFiscale = segments.reduce((s, x) => s + x.montantCents, 0);
  const soldeCents = solde?.soldeCents ?? 0;
  const pct = (c: number) => (soldeCents > 0 ? (c / soldeCents) * 100 : 0);
  const prochaine = segments.find((s) => !s.enRetard) ?? null;
  return {
    soldeCents,
    partFiscale,
    /** « la part libre égale solde − part fiscale » */
    partLibre: soldeCents - partFiscale,
    librePct: pct(Math.max(0, soldeCents - partFiscale)),
    segments: segments.map((s) => ({ ...s, largeurPct: pct(s.montantCents) })),
    prochaine,
    estimations: echeances.filter((e) => e.estimation),
    aucunSolde: !solde,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   36g · MULTI-DEVISES — les bulles
   ══════════════════════════════════════════════════════════════════════════ */

export interface TauxDevise {
  kind: 'taux';
  devise: string;
  /** Combien d'euros vaut une unité de la devise. */
  eur: number;
  le: string;
}
export interface FactureDevise {
  kind: 'facture';
  client: string;
  ville: string;
  devise: string;
  montant: number; // en unités de la devise (centimes de devise)
  tauxEmission: number;
  emiseLe: string;
  echeance: string;
  encaisseeLe?: string;
  tauxEncaissement?: number;
}
export type EnregistrementDevises = TauxDevise | FactureDevise;

/** « diamètre 60 × √(montant / 1000) px » — c'est la SURFACE qui est proportionnelle. */
export const diametreBulle = (euros: number) => 60 * Math.sqrt(Math.max(0, euros) / 1000);
/** L'anneau : le coût d'une variation de 1 % du taux, 1 px pour 3 €. */
export const EUROS_PAR_PX_ANNEAU = 3;
export const epaisseurAnneau = (euros: number) => Math.max(1, Math.round((euros * 0.01) / EUROS_PAR_PX_ANNEAU));
/** Sous ce diamètre, le libellé passe dessous. */
export const PETITE_BULLE_PX = 70;

export function bulles(enr: EnregistrementDevises[]) {
  const taux = new Map<string, TauxDevise>();
  for (const t of enr.filter((e): e is TauxDevise => e.kind === 'taux')) {
    const x = taux.get(t.devise);
    if (!x || t.le > x.le) taux.set(t.devise, t);
  }
  const ouvertes = enr.filter((e): e is FactureDevise => e.kind === 'facture' && !e.encaisseeLe);
  const devises = [...new Set(ouvertes.map((f) => f.devise))].map((devise) => {
    const fs = ouvertes.filter((f) => f.devise === devise);
    const t = taux.get(devise);
    const montant = fs.reduce((s, f) => s + f.montant, 0);
    const eurJourCents = t ? Math.round(montant * t.eur) : 0;
    const eurEmissionCents = Math.round(fs.reduce((s, f) => s + f.montant * f.tauxEmission, 0));
    const latentCents = eurJourCents - eurEmissionCents;
    return {
      devise,
      factures: fs,
      montant,
      taux: t ?? null,
      eurJourCents,
      latentCents,
      variationPct: eurEmissionCents ? (latentCents / eurEmissionCents) * 100 : 0,
      diametre: diametreBulle(eurJourCents / 100),
      anneau: epaisseurAnneau(eurJourCents / 100),
    };
  });
  devises.sort((a, b) => b.eurJourCents - a.eurJourCents);
  /** L'ambre : l'anneau de la devise qui a le plus BAISSÉ depuis l'émission. */
  const baisses = devises.filter((d) => d.variationPct < 0).sort((a, b) => a.variationPct - b.variationPct);
  const ambre = baisses[0] ?? null;
  const plusExposee = [...devises].sort((a, b) => b.anneau - a.anneau)[0] ?? null;
  return {
    devises,
    ambre,
    plusExposee,
    totalCents: devises.reduce((s, d) => s + d.eurJourCents, 0),
    latentCents: devises.reduce((s, d) => s + d.latentCents, 0),
    tauxLe: [...taux.values()].map((t) => t.le).sort().pop() ?? null,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   36h · NOTES DE FRAIS — la lecture
   ══════════════════════════════════════════════════════════════════════════ */

/** « En dessous de 70 % de confiance, le champ passe en ambre et bloque la validation. » */
export const CONFIANCE_MIN = 0.7;
export interface LigneTicket {
  texte: string;
  droite?: string;
  /** Le numéro de la zone lue, s'il y en a une. */
  zone?: number;
  style?: 'fort' | 'normal' | 'petit' | 'filet';
}
export interface ChampLu {
  zone: number;
  champ: string;
  valeur: string;
  confiance: number;
  confirmeLe?: string;
  note?: string;
}
export interface NoteDeFrais {
  kind: 'note';
  personne: string;
  le: string;
  montantCents: number;
  ticket: LigneTicket[];
  champs: ChampLu[];
  statut: 'a-verifier' | 'validee' | 'remboursee';
  valideeLe?: string;
}
export type EnregistrementNotes = NoteDeFrais;

/** « Chaque champ extrait est relié à une zone du ticket : un champ sans zone n'est jamais pré-rempli. » */
export function champsLisibles(n: NoteDeFrais) {
  const zones = new Set(n.ticket.map((l) => l.zone).filter((z): z is number => z !== undefined));
  return n.champs.filter((c) => zones.has(c.zone));
}
export const bloquant = (c: ChampLu) => c.confiance < CONFIANCE_MIN && !c.confirmeLe;
export function champAmbre(n: NoteDeFrais) {
  return (
    champsLisibles(n)
      .filter(bloquant)
      .sort((a, b) => a.confiance - b.confiance)[0] ?? null
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   36i · FACTURES ENTRANTES — le casier
   ══════════════════════════════════════════════════════════════════════════ */

/** « Une facture n'entre dans un casier d'échéance que si fournisseur, montant et échéance ont été lus à 90 % au moins. » */
export const CONFIANCE_CASIER = 0.9;
export interface FactureEntrante {
  kind: 'facture';
  fournisseur: string | null;
  montantCents: number | null;
  echeance: string | null;
  confiance: { fournisseur: number; montant: number; echeance: number };
  recueLe: string;
  reference?: string;
  motif?: string;
  payeeLe?: string;
  fournisseurConnu: boolean;
}
export type EnregistrementFacturesEntrantes = FactureEntrante;
export type Casier = 'semaine' | 'mois' | 'plus-tard' | 'verifier';
export const CASIERS: Casier[] = ['semaine', 'mois', 'plus-tard', 'verifier'];

export function casierDe(f: FactureEntrante, maintenant: Date): Casier {
  const c = f.confiance;
  if (!f.fournisseur || f.montantCents === null || !f.echeance) return 'verifier';
  if (c.fournisseur < CONFIANCE_CASIER || c.montant < CONFIANCE_CASIER || c.echeance < CONFIANCE_CASIER) return 'verifier';
  const e = new Date(f.echeance);
  if (e.getTime() < maintenant.getTime() + 7 * JOUR_MS) return 'semaine';
  if (e.getFullYear() === maintenant.getFullYear() && e.getMonth() === maintenant.getMonth()) return 'mois';
  return 'plus-tard';
}

export function tri(factures: Array<Id<FactureEntrante>>, maintenant: Date) {
  const aPayer = factures.filter((f) => !f.payeeLe);
  return CASIERS.map((casier) => {
    /** « Les casiers se classent par date d'échéance, jamais par montant. » */
    const plis = aPayer.filter((f) => casierDe(f, maintenant) === casier).sort((a, b) => (a.echeance ?? '9').localeCompare(b.echeance ?? '9'));
    const complets = plis.every((p) => p.montantCents !== null);
    /** « Les totaux sont la somme exacte des plis » — un montant manquant rend le total incomplet, pas faux. */
    return { casier, plis, totalCents: complets ? plis.reduce((s, p) => s + (p.montantCents ?? 0), 0) : null };
  });
}

export function delaiMoyenPaiement(factures: FactureEntrante[]) {
  const payees = factures.filter((f) => f.payeeLe);
  if (!payees.length) return null;
  return Math.round(payees.reduce((s, f) => s + (new Date(f.payeeLe as string).getTime() - new Date(f.recueLe).getTime()) / JOUR_MS, 0) / payees.length);
}
