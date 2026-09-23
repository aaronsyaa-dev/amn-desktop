/**
 * GUICHET — ce que le client fait SEUL, jour et nuit (`34a` → `34f`).
 * ═══════════════════════════════════════════════════════════════════
 *
 * Six moteurs, un par module. Chacun prend les enregistrements réels de sa
 * collection et rend la géométrie de son instrument : des pourcentages, des
 * angles, des hauteurs — jamais une position posée à la main. Les règles de
 * `MODULES-NOUVEAUX.md` y sont écrites telles quelles, et `check:cinquante`
 * les éprouve sur des données qui ne sont pas celles des captures.
 *
 * Tout montant est en CENTIMES, comme dans le reste du produit.
 */

export type Id<T> = T & { id: string };

const JOUR_MS = 86_400_000;
/**
 * Le jour CALENDAIRE LOCAL d'un instant. Jamais `iso.slice(0, 10)` : une vente
 * de 00:30 à Paris est la veille en UTC, et le décompte glisserait d'un jour
 * pendant la première heure de chaque journée.
 */
export function jourLocal(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
const joursEntre = (a: Date, b: Date) => (b.getTime() - a.getTime()) / JOUR_MS;
/** Le nombre de jours calendaires de `debut` à `fin`, les deux compris (au moins 1). */
export function joursCalendairesInclus(debut: string, fin: Date): number {
  const a = new Date(`${jourLocal(debut)}T00:00:00`);
  const b = new Date(`${jourLocal(fin)}T00:00:00`);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / JOUR_MS) + 1);
}

/* ══════════════════════════════════════════════════════════════════════════
   34a · BOUTIQUE — les paniers laissés
   ══════════════════════════════════════════════════════════════════════════ */

/** Les cinq étapes du parcours, de gauche à droite. `vu` n'a pas de panier. */
export const ETAPES_ACHAT = ['vu', 'panier', 'livraison', 'paiement', 'paye'] as const;
export type EtapeAchat = (typeof ETAPES_ACHAT)[number];
/** Les étapes où un panier peut rester : toutes sauf `vu` (pas de panier) et `paye` (fini). */
export type EtapeAbandon = 'panier' | 'livraison' | 'paiement';

export interface ArticlePanier {
  produit: string;
  quantite: number;
  prixCents: number;
}

export interface PanierBoutique {
  kind: 'panier';
  ouvertLe: string;
  /** La dernière étape atteinte ; `paye` pour une commande payée. */
  etape: Exclude<EtapeAchat, 'vu'>;
  articles: ArticlePanier[];
  /** L'acheteur a laissé une adresse : seule condition pour pouvoir le relancer. */
  adresse: boolean;
  /** Quand l'acheteur est parti (ou a payé). Sert à l'ordre d'abandon. */
  arreteLe: string;
  relanceLe?: string;
}

export interface VisitesBoutique {
  kind: 'visites';
  jour: string;
  nombre: number;
}

export interface ReglageBoutique {
  kind: 'reglage';
  fraisPortCents: number;
  portOffertDesCents?: number;
}

export type EnregistrementBoutique = PanierBoutique | VisitesBoutique | ReglageBoutique;

/** Au-delà de douze paniers dans une colonne, la pile s'arrête et annonce le reste. */
export const PILE_MAX = 12;

export const montantPanier = (p: Pick<PanierBoutique, 'articles'>) =>
  p.articles.reduce((s, a) => s + a.quantite * a.prixCents, 0);

export interface ColonneAchat {
  etape: EtapeAchat;
  /** Nombre d'acheteurs qui ont ATTEINT l'étape. */
  atteints: number;
  /** Les paniers laissés à cette étape, dans l'ordre d'abandon, tous. */
  laisses: Id<PanierBoutique>[];
  /** Ce que la pile montre (douze au plus). */
  pile: Id<PanierBoutique>[];
  /** Ce qu'elle annonce au-delà (« + 7 »), 0 sinon. */
  reste: number;
  laissesCents: number;
}

export interface ParcoursAchat {
  colonnes: ColonneAchat[];
  /** L'étape qui porte l'ambre — calculée, jamais fixée d'avance ; `null` sans panier laissé. */
  etapeAmbre: EtapeAbandon | null;
  payes: { n: number; cents: number; moyenCents: number };
  laisses: { n: number; cents: number; relancables: number };
  /** Ce que contenaient les paniers laissés, par produit, du plus fréquent au moins fréquent. */
  contenu: Array<{ produit: string; quantite: number; prixCents: number }>;
}

export function parcoursAchat(
  enregistrements: Id<EnregistrementBoutique>[],
  maintenant: Date,
  jours = 30,
): ParcoursAchat {
  const depuis = maintenant.getTime() - jours * JOUR_MS;
  const paniers = enregistrements.filter(
    (e): e is Id<PanierBoutique> => e.kind === 'panier' && new Date(e.ouvertLe).getTime() >= depuis,
  );
  const visites = enregistrements
    .filter((e): e is Id<VisitesBoutique> => e.kind === 'visites' && new Date(`${e.jour}T12:00:00`).getTime() >= depuis)
    .reduce((s, v) => s + v.nombre, 0);

  const rang: Record<Exclude<EtapeAchat, 'vu'>, number> = { panier: 1, livraison: 2, paiement: 3, paye: 4 };
  const ontAtteint = (i: number) => paniers.filter((p) => rang[p.etape] >= i).length;

  const colonnes: ColonneAchat[] = ETAPES_ACHAT.map((etape, i) => {
    const laisses =
      etape === 'vu' || etape === 'paye'
        ? []
        : paniers
            .filter((p) => p.etape === etape)
            .sort((a, b) => a.arreteLe.localeCompare(b.arreteLe));
    return {
      etape,
      // « Vu » compte les visites ; les autres, les paniers qui ont atteint l'étape.
      atteints: etape === 'vu' ? Math.max(visites, paniers.length) : ontAtteint(i),
      laisses,
      pile: laisses.slice(0, PILE_MAX),
      reste: Math.max(0, laisses.length - PILE_MAX),
      laissesCents: laisses.reduce((s, p) => s + montantPanier(p), 0),
    };
  });

  // L'ambre va à l'étape qui a le PLUS de paniers laissés. À égalité, la plus
  // en amont : c'est là que l'acheteur a le moins investi, donc le plus perdu.
  let etapeAmbre: EtapeAbandon | null = null;
  let plus = 0;
  for (const c of colonnes) {
    if (c.laisses.length > plus) {
      plus = c.laisses.length;
      etapeAmbre = c.etape as EtapeAbandon;
    }
  }

  const payes = paniers.filter((p) => p.etape === 'paye');
  const payesCents = payes.reduce((s, p) => s + montantPanier(p), 0);
  const tousLaisses = paniers.filter((p) => p.etape !== 'paye');

  const parProduit = new Map<string, { quantite: number; prixCents: number }>();
  for (const p of tousLaisses) {
    for (const a of p.articles) {
      const cur = parProduit.get(a.produit) ?? { quantite: 0, prixCents: a.prixCents };
      cur.quantite += a.quantite;
      parProduit.set(a.produit, cur);
    }
  }

  return {
    colonnes,
    etapeAmbre,
    payes: { n: payes.length, cents: payesCents, moyenCents: payes.length ? Math.round(payesCents / payes.length) : 0 },
    laisses: {
      n: tousLaisses.length,
      cents: tousLaisses.reduce((s, p) => s + montantPanier(p), 0),
      relancables: tousLaisses.filter((p) => p.adresse).length,
    },
    contenu: [...parProduit.entries()]
      .map(([produit, v]) => ({ produit, ...v }))
      .sort((a, b) => b.quantite - a.quantite || a.produit.localeCompare(b.produit)),
  };
}

/**
 * Le seuil de port offert à proposer : la médiane des paniers laissés à
 * l'étape Livraison, arrondie à la dizaine d'euros inférieure. C'est là que
 * les frais de port apparaissent ; un seuil sous la médiane repêche la moitié
 * de ceux qui sont partis en les voyant.
 */
export function seuilPortPropose(colonne: ColonneAchat): number | null {
  if (colonne.etape !== 'livraison' || colonne.laisses.length === 0) return null;
  const montants = colonne.laisses.map(montantPanier).sort((a, b) => a - b);
  const m = montants[Math.floor((montants.length - 1) / 2)];
  return Math.floor(m / 1000) * 1000;
}

/* ══════════════════════════════════════════════════════════════════════════
   34b · BILLETTERIE — le tourniquet
   ══════════════════════════════════════════════════════════════════════════ */

export interface TarifBillet {
  nom: string;
  prixCents: number;
  quota: number;
}

export interface EvenementBilletterie {
  kind: 'evenement';
  titre: string;
  /** Début de l'événement (ISO). */
  date: string;
  jauge: number;
  tarifs: TarifBillet[];
  ouvertureLe: string;
}

export type ProfilAcheteur = 'client' | 'prospect' | 'inconnu';

export interface BilletVendu {
  kind: 'billet';
  evenementId: string;
  tarif: string;
  acheteur: string;
  profil: ProfilAcheteur;
  venduLe: string;
  montantCents: number;
  fraisCents: number;
  scanneLe?: string;
  rembourseLe?: string;
}

export type EnregistrementBilletterie = EvenementBilletterie | BilletVendu;

/** Géométrie du tourniquet : `viewBox="-170 -170 340 340"`, crans de 16 × 30 posés à 150 du centre. */
export const TOURNIQUET = {
  viewBox: '-170 -170 340 340',
  rayonMoyeu: 52,
  cranLargeur: 16,
  cranHauteur: 30,
  cranRayon: 150,
  brasLongueur: 96,
  brasEpaisseur: 14,
  /** Le libellé du moyeu, sur deux lignes, à ces hauteurs pour un rayon de 52. */
  libelleY: [22, 33] as const,
} as const;

export interface Tourniquet {
  /** Un cran par place : `angle = 360 / jauge`. */
  crans: Array<{ angle: number; plein: boolean }>;
  /** Le jour même, les crans comptent les ENTRÉES ; avant, les ventes. */
  mode: 'ventes' | 'entrees';
  /** Rotation du rotor : un tiers de tour par entrée scannée, le jour même. */
  rotationRotor: number;
  vendus: number;
  libres: number;
  entrees: number;
}

export function tourniquet(evt: EvenementBilletterie, billets: BilletVendu[], maintenant: Date): Tourniquet {
  const valides = billets.filter((b) => !b.rembourseLe);
  const jourJ = jourLocal(evt.date) === jourLocal(maintenant);
  const entrees = valides.filter((b) => b.scanneLe).length;
  const vendus = Math.min(evt.jauge, valides.length);
  const pleins = jourJ ? entrees : vendus;
  const pas = 360 / evt.jauge;
  return {
    crans: Array.from({ length: evt.jauge }, (_, i) => ({ angle: i * pas, plein: i < pleins })),
    mode: jourJ ? 'entrees' : 'ventes',
    rotationRotor: jourJ ? (entrees * 120) % 360 : 0,
    vendus,
    libres: evt.jauge - vendus,
    entrees,
  };
}

/**
 * La prévision de remplissage : le rythme de vente MOYEN depuis l'ouverture
 * de la billetterie, pas celui des derniers jours.
 */
export function previsionRemplissage(
  evt: EvenementBilletterie,
  billets: BilletVendu[],
  maintenant: Date,
): { rythmeParJour: number; joursPourRemplir: number | null; completLe: Date | null; avantLaDateJours: number | null } {
  const valides = billets.filter((b) => !b.rembourseLe);
  const libres = evt.jauge - valides.length;
  // En jours CALENDAIRES, bornes comprises : ouverte le 10, on est le 18, cela
  // fait « neuf jours » de vente — c'est ce que dit la phrase du cahier.
  const jours = joursCalendairesInclus(evt.ouvertureLe, maintenant);
  const rythme = valides.length / jours;
  if (libres <= 0) return { rythmeParJour: rythme, joursPourRemplir: 0, completLe: maintenant, avantLaDateJours: null };
  if (rythme <= 0) return { rythmeParJour: 0, joursPourRemplir: null, completLe: null, avantLaDateJours: null };
  const j = Math.ceil(libres / rythme);
  const complet = new Date(maintenant.getTime() + j * JOUR_MS);
  const avant = Math.floor(joursEntre(complet, new Date(evt.date)));
  return { rythmeParJour: rythme, joursPourRemplir: j, completLe: complet, avantLaDateJours: avant >= 0 ? avant : null };
}

/** Les ventes jour par jour depuis l'ouverture, pour les bâtonnets empilés de 12 px. */
export function ventesParJour(evt: EvenementBilletterie, billets: BilletVendu[], maintenant: Date): number[] {
  const debut = new Date(`${jourLocal(evt.ouvertureLe)}T00:00:00`);
  const n = Math.max(1, Math.floor(joursEntre(debut, maintenant)) + 1);
  const cases = Array.from({ length: n }, () => 0);
  for (const b of billets) {
    if (b.rembourseLe) continue;
    const i = Math.floor(joursEntre(debut, new Date(b.venduLe)));
    if (i >= 0 && i < n) cases[i] += 1;
  }
  return cases;
}

/* ══════════════════════════════════════════════════════════════════════════
   34c · DONS — le pont
   ══════════════════════════════════════════════════════════════════════════ */

export interface Palier {
  desCents: number;
  contrepartie: string;
}

export interface CampagneDons {
  kind: 'campagne';
  titre: string;
  objectifCents: number;
  seuilCents: number;
  clotureLe: string;
  paliers: Palier[];
}

export interface Contribution {
  kind: 'contribution';
  campagneId: string;
  nom: string;
  montantCents: number;
  recuLe: string;
}

export type EnregistrementDons = CampagneDons | Contribution;

export interface Pont {
  /** Une planche par contribution, dans l'ordre d'arrivée : `montant / objectif × 100 %`. */
  planches: Array<{ id: string; largeurPct: number; teinte: 0 | 1; derniere: boolean }>;
  collecteCents: number;
  /** Là où finit le tablier. */
  collectePct: number;
  /** La pile du seuil, plantée à `seuil / objectif`. */
  seuilPct: number;
  /** Ce qui manque pour l'autre rive ; 0 quand le tablier la touche. */
  trouCents: number;
  /** Où poser la plaque ambre : dans le trou, au plus près du bout du tablier. */
  plaque: { gauchePct: number; dansLeTrou: boolean } | null;
}

/**
 * LA GÉOMÉTRIE VERTICALE DU PONT, et pourquoi la plaque ne peut pas couvrir
 * la pile du seuil.
 *
 * Le tablier occupe les 40 premiers pixels ; la plaque y est posée à 7 px, sur
 * 26 px de haut, donc elle finit à 33 px — AU-DESSUS du tablier. La pile, elle,
 * part de 40 px et descend dans la rivière. Les deux ne partagent aucune
 * rangée : la règle « la plaque ne recouvre jamais la pile » est tenue par
 * construction, et `check:cinquante` vérifie que ces trois nombres la tiennent.
 */
export const PONT = { tablier: 40, plaqueHaut: 7, plaqueHauteur: 26 } as const;

/**
 * Une plaque d'une ligne (« 2 280 € POUR L'AUTRE RIVE ») mesure environ 196 px,
 * soit ≈ 26 % d'un tablier de ~765 px (dominante à 1180 px). Sert à savoir si
 * elle tient dans le trou.
 */
export const PLAQUE_PONT_PCT = 26;

export function pont(camp: CampagneDons, contributions: Id<Contribution>[]): Pont {
  const ordre = [...contributions].sort((a, b) => a.recuLe.localeCompare(b.recuLe));
  const collecte = ordre.reduce((s, c) => s + c.montantCents, 0);
  const planches = ordre.map((c, i) => ({
    id: c.id,
    largeurPct: (c.montantCents / camp.objectifCents) * 100,
    teinte: (i % 2) as 0 | 1,
    derniere: i === ordre.length - 1,
  }));
  const collectePct = Math.min(100, (collecte / camp.objectifCents) * 100);
  const seuilPct = (camp.seuilCents / camp.objectifCents) * 100;
  const trou = Math.max(0, camp.objectifCents - collecte);
  let plaque: Pont['plaque'] = null;
  if (trou > 0) {
    // Dans la partie GAUCHE du trou, 8 px (≈ 1 %) après le bout du tablier. Si
    // le trou est plus étroit que la plaque, elle s'aligne sur l'autre rive :
    // elle reste sur une ligne, sans retour, plutôt que de déborder de la carte.
    const gauche = collectePct + 1;
    plaque = gauche + PLAQUE_PONT_PCT <= 100
      ? { gauchePct: gauche, dansLeTrou: true }
      : { gauchePct: Math.max(0, 100 - PLAQUE_PONT_PCT), dansLeTrou: false };
  }
  return { planches, collecteCents: collecte, collectePct, seuilPct, trouCents: trou, plaque };
}

/** Le rythme des sept derniers jours et ce qu'il annonce avant la clôture. */
export function previsionDons(camp: CampagneDons, contributions: Contribution[], maintenant: Date) {
  const depuis = maintenant.getTime() - 7 * JOUR_MS;
  const recent = contributions.filter((c) => new Date(c.recuLe).getTime() >= depuis).reduce((s, c) => s + c.montantCents, 0);
  // Un rythme se dit en euros entiers : « 190 € par jour », pas « 190,43 € ».
  const parJour = Math.round(recent / 7 / 100) * 100;
  const collecte = contributions.reduce((s, c) => s + c.montantCents, 0);
  // Les jours CALENDAIRES jusqu'à la clôture, aujourd'hui exclu : une clôture
  // le 27 vue le 18 laisse « neuf jours », quelle que soit l'heure.
  const joursRestants = Math.max(0, joursCalendairesInclus(maintenant.toISOString(), new Date(camp.clotureLe)) - 1);
  const jours = (cible: number) =>
    collecte >= cible ? 0 : parJour > 0 ? Math.ceil((cible - collecte) / parJour) : null;
  const pourSeuil = jours(camp.seuilCents);
  const pourObjectif = jours(camp.objectifCents);
  return {
    parJourCents: parJour,
    joursRestants,
    joursPourSeuil: pourSeuil,
    seuilAvantCloture: pourSeuil !== null && pourSeuil <= joursRestants,
    objectifAvantCloture: pourObjectif !== null && pourObjectif <= joursRestants,
  };
}

/** Les contreparties : chaque contribution prend le palier le plus haut qu'elle atteint. */
export function contreparties(camp: CampagneDons, contributions: Contribution[]) {
  const paliers = [...camp.paliers].sort((a, b) => a.desCents - b.desCents);
  const comptes = paliers.map(() => 0);
  for (const c of contributions) {
    let k = 0;
    for (let i = 0; i < paliers.length; i += 1) if (c.montantCents >= paliers[i].desCents) k = i;
    comptes[k] += 1;
  }
  return paliers.map((p, i) => ({ ...p, n: comptes[i] }));
}

export function mediane(valeurs: number[]): number {
  if (valeurs.length === 0) return 0;
  const v = [...valeurs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
}

/* ══════════════════════════════════════════════════════════════════════════
   34d · ACOMPTE EN LIGNE — le sas
   ══════════════════════════════════════════════════════════════════════════ */

export interface DevisAcompte {
  client: string;
  montantCents: number;
  /** 0,3 pour un acompte de 30 %. */
  tauxAcompte: number;
  envoyeLe: string;
  signeLe?: string;
  /** Un PAIEMENT RÉEL — jamais une promesse au téléphone. */
  acompteRecuLe?: string;
  planifieLe?: string;
  annuleLe?: string;
  lienRenvoyeLe?: string;
  note?: string;
}

/** L'échelle de la barre d'attente d'un jeton du sas. */
export const SAS_ECHELLE_JOURS = 14;

export const acompteDe = (d: Pick<DevisAcompte, 'montantCents' | 'tauxAcompte'>) =>
  Math.round(d.montantCents * d.tauxAcompte);

export interface Sas {
  envoyes: Id<DevisAcompte>[];
  dansLeSas: Array<Id<DevisAcompte> & { acompteCents: number; attenteJours: number; barrePct: number }>;
  lances: Id<DevisAcompte>[];
  /** Le montant du libellé ambre : la somme EXACTE des jetons présents. */
  attenduCents: number;
}

export function sas(devis: Id<DevisAcompte>[], maintenant: Date): Sas {
  const vivants = devis.filter((d) => !d.annuleLe);
  const dansLeSas = vivants
    .filter((d) => d.signeLe && !d.acompteRecuLe)
    .map((d) => {
      const attente = joursEntre(new Date(d.signeLe as string), maintenant);
      return {
        ...d,
        acompteCents: acompteDe(d),
        attenteJours: Math.max(0, Math.floor(attente)),
        barrePct: Math.min(1, Math.max(0, attente / SAS_ECHELLE_JOURS)) * 100,
      };
    })
    .sort((a, b) => b.attenteJours - a.attenteJours);
  return {
    envoyes: vivants.filter((d) => !d.signeLe).sort((a, b) => a.envoyeLe.localeCompare(b.envoyeLe)),
    dansLeSas,
    lances: vivants.filter((d) => d.signeLe && d.acompteRecuLe),
    attenduCents: dansLeSas.reduce((s, d) => s + d.acompteCents, 0),
  };
}

/** Du oui à l'argent, sur 90 jours : les quatre tranches du délai signature → acompte. */
export function delaisSignatureAcompte(devis: DevisAcompte[], maintenant: Date) {
  const depuis = maintenant.getTime() - 90 * JOUR_MS;
  const signes = devis.filter((d) => d.signeLe && new Date(d.signeLe).getTime() >= depuis);
  const t = { heure: 0, deuxJours: 0, plusTard: 0, jamais: 0 };
  for (const d of signes) {
    if (d.annuleLe && !d.acompteRecuLe) t.jamais += 1;
    else if (!d.acompteRecuLe) continue; // encore dans le sas : pas encore de délai
    else {
      const h = (new Date(d.acompteRecuLe).getTime() - new Date(d.signeLe as string).getTime()) / 3_600_000;
      if (h <= 1) t.heure += 1;
      else if (h <= 48) t.deuxJours += 1;
      else t.plusTard += 1;
    }
  }
  const total = t.heure + t.deuxJours + t.plusTard + t.jamais;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  return { ...t, total, pct: { heure: pct(t.heure), deuxJours: pct(t.deuxJours), plusTard: pct(t.plusTard), jamais: pct(t.jamais) } };
}

/* ══════════════════════════════════════════════════════════════════════════
   34e · CHATBOT — la FAQ en creux
   ══════════════════════════════════════════════════════════════════════════ */

export const SUJETS_FAQ = ['tarifs', 'prestations', 'zone', 'rendezvous', 'paiement'] as const;
export type SujetFaq = (typeof SUJETS_FAQ)[number];
export type IssueQuestion = 'faq' | 'humain' | 'sans-suite';

export interface QuestionChatbot {
  kind: 'question';
  sujet: SujetFaq;
  /** Les mots mêmes du client. */
  texte: string;
  /** La réponse de la FAQ ; absente = un creux. */
  reponse?: string;
  demandes: Array<{ le: string; issue: IssueQuestion }>;
}

export interface ReglageChatbot {
  kind: 'reglage';
  faqMiseAJourLe: string;
}

export type EnregistrementChatbot = QuestionChatbot | ReglageChatbot;

/** Hauteur d'une tuile : 52 px, plus 4 px par demande. */
export const hauteurTuile = (fois: number) => 52 + 4 * fois;

export interface ColonneFaq {
  sujet: SujetFaq;
  total: number;
  sansReponse: number;
  tuiles: Array<Id<QuestionChatbot> & { fois: number; hauteur: number; creux: boolean }>;
}

export function faqEnCreux(
  enregistrements: Id<EnregistrementChatbot>[],
  maintenant: Date,
): { colonnes: ColonneFaq[]; creuxAmbre: string | null; issues: Record<IssueQuestion, number>; total: number } {
  const mois = maintenant.toISOString().slice(0, 7);
  const questions = enregistrements.filter((e): e is Id<QuestionChatbot> => e.kind === 'question');
  const issues: Record<IssueQuestion, number> = { faq: 0, humain: 0, 'sans-suite': 0 };
  const colonnes = SUJETS_FAQ.map((sujet) => {
    const tuiles = questions
      .filter((q) => q.sujet === sujet)
      .map((q) => {
        const duMois = q.demandes.filter((d) => d.le.slice(0, 7) === mois);
        for (const d of duMois) issues[d.issue] += 1;
        return { ...q, fois: duMois.length, hauteur: hauteurTuile(duMois.length), creux: !q.reponse };
      })
      .filter((t) => t.fois > 0)
      // Les réponses d'abord, puis les creux : la pile se lit de la FAQ vers ses trous.
      .sort((a, b) => Number(a.creux) - Number(b.creux) || b.fois - a.fois);
    return {
      sujet,
      total: tuiles.reduce((s, t) => s + t.fois, 0),
      sansReponse: tuiles.filter((t) => t.creux).reduce((s, t) => s + t.fois, 0),
      tuiles,
    };
  });
  // L'ambre va au creux le plus demandé — recalculé à chaque ouverture.
  let creuxAmbre: string | null = null;
  let max = 0;
  for (const c of colonnes) for (const t of c.tuiles) if (t.creux && t.fois > max) { max = t.fois; creuxAmbre = t.id; }
  return { colonnes, creuxAmbre, issues, total: issues.faq + issues.humain + issues['sans-suite'] };
}

/* ══════════════════════════════════════════════════════════════════════════
   34f · STANDARD — les promesses
   ══════════════════════════════════════════════════════════════════════════ */

export interface TourDeParole {
  qui: 'appelant' | 'assistant';
  debutS: number;
  finS: number;
}

export interface Engagement {
  seconde: number;
  citation: string;
  dansLeMandat: boolean;
  /** Ce que l'assistant en a fait (« créneau réservé pour 48 h ») ou pourquoi c'est hors mandat. */
  note: string;
  /** Un engagement hors mandat n'est jamais effacé en silence : la personne est rappelée. */
  rappeleLe?: string;
}

export interface AppelStandard {
  kind: 'appel';
  debutLe: string;
  dureeS: number;
  appelant: string;
  issue: string;
  tours: TourDeParole[];
  engagements: Engagement[];
  /** Ce que la phrase de pied explique quand l'engagement est hors mandat. */
  explication?: string;
}

export interface MandatStandard {
  kind: 'mandat';
  peut: string[];
  nePeutPas: string[];
}

export type EnregistrementStandard = AppelStandard | MandatStandard;

/** La grille partagée des pistes, de l'axe, des épingles, des fils et des cartes. */
export const GRILLE_STANDARD = '92px minmax(0,1fr)';
export const FIL_VIEWBOX = { largeur: 1000, hauteur: 44 } as const;

export interface Promesses {
  /** `seconde / durée × 100 %`, pour chaque tour et chaque épingle. */
  tours: Array<TourDeParole & { gauchePct: number; largeurPct: number }>;
  epingles: Array<Engagement & { gauchePct: number; dansUnTourAssistant: boolean; ambre: boolean }>;
  /**
   * Les fils : de l'épingle (x en millièmes) au CENTRE de sa carte. Les cartes
   * sont dans une grille sans gouttière, donc le centre de la carte i sur n
   * tombe exactement à (2i + 1) / 2n.
   */
  fils: Array<{ de: number; vers: number; ambre: boolean }>;
  graduations: Array<{ minute: number; gauchePct: number }>;
}

export function promesses(appel: AppelStandard): Promesses {
  const pct = (s: number) => (s / appel.dureeS) * 100;
  const tours = appel.tours.map((t) => ({ ...t, gauchePct: pct(t.debutS), largeurPct: pct(t.finS - t.debutS) }));
  const ordre = [...appel.engagements].sort((a, b) => a.seconde - b.seconde);
  const premierHors = ordre.findIndex((e) => !e.dansLeMandat);
  const epingles = ordre.map((e, i) => ({
    ...e,
    gauchePct: pct(e.seconde),
    dansUnTourAssistant: appel.tours.some((t) => t.qui === 'assistant' && e.seconde >= t.debutS && e.seconde <= t.finS),
    ambre: i === premierHors,
  }));
  const n = epingles.length;
  const fils = epingles.map((e, i) => ({
    de: (e.gauchePct / 100) * FIL_VIEWBOX.largeur,
    vers: ((2 * i + 1) / (2 * n)) * FIL_VIEWBOX.largeur,
    ambre: e.ambre,
  }));
  const graduations = [];
  for (let m = 1; m * 60 < appel.dureeS; m += 1) graduations.push({ minute: m, gauchePct: pct(m * 60) });
  return { tours, epingles, fils, graduations };
}

/** L'appel à montrer : le plus récent qui porte un engagement hors mandat pas encore rappelé, sinon le dernier. */
export function appelAMontrer(appels: Id<AppelStandard>[]): Id<AppelStandard> | null {
  const tries = [...appels].sort((a, b) => b.debutLe.localeCompare(a.debutLe));
  return tries.find((a) => a.engagements.some((e) => !e.dansLeMandat && !e.rappeleLe)) ?? tries[0] ?? null;
}

export const dureeLisible = (s: number) => `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}`;
export const minuteSeconde = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
