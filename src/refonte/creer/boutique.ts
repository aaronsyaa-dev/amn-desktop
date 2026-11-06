/**
 * MR08 · BOUTIQUE EN LIGNE — logique pure (visiteurs en direct, semaine, entonnoir, objectif).
 *
 * Règles de la fiche MR08, rubrique 6. Les visites sont comptées SANS identifiant persistant
 * ni cookie publicitaire : on ne reçoit que des sessions anonymes (page, étape, dernière activité).
 * Le module actuel ne mesure pas les visites en direct (seulement un compteur quotidien) : voir `STATUT.md`.
 */

import { ajouterJours, borner, ecartJours, lundiDe, type Jour } from './commun';

export type EtapeSession = 'regarde' | 'produit' | 'panier' | 'paiement';
const RANG_ETAPE: Record<EtapeSession, number> = { regarde: 0, produit: 1, panier: 2, paiement: 3 };

export interface SessionEntree {
  /** Identifiant de session éphémère, jamais persistant. */
  id: string;
  /** Dernière activité, ms. */
  derniereActiviteMs: number;
  page: string;
  etape: EtapeSession;
  /** Largeur d'écran : l'appareil est déduit du format, jamais d'un identifiant. */
  largeurEcran?: number;
  /** Temps passé sur la page, secondes. */
  dureeSec?: number;
}

export const FENETRE_DIRECT_MIN = 5;
export const VISITES_AFFICHEES = 5;

/** Visiteurs en ce moment = sessions actives sur les 5 dernières minutes ; les plus avancées dans l'achat d'abord, 5 au plus. */
export function visiteursEnDirect(sessions: readonly SessionEntree[], maintenantMs: number): { nombre: number; lignes: SessionEntree[] } {
  const actives = sessions.filter((s) => maintenantMs - s.derniereActiviteMs <= FENETRE_DIRECT_MIN * 60_000 && s.derniereActiviteMs <= maintenantMs);
  const lignes = [...actives].sort((a, b) => RANG_ETAPE[b.etape] - RANG_ETAPE[a.etape] || b.derniereActiviteMs - a.derniereActiviteMs).slice(0, VISITES_AFFICHEES);
  return { nombre: actives.length, lignes };
}

export type Appareil = 'telephone' | 'tablette' | 'ordinateur';
export function appareilDeLEcran(largeur: number | undefined): Appareil {
  if (largeur === undefined) return 'ordinateur';
  return largeur < 768 ? 'telephone' : largeur < 1200 ? 'tablette' : 'ordinateur';
}

export interface CommandeBoutique { payeeLe: Jour; totalCents: number; remboursee?: boolean; lignes?: { produitId: string; nom: string; quantite: number }[] }

export interface SemaineBoutique {
  chiffreAffairesCents: number;
  commandes: number;
  /** Arrondi à l'euro (274,29 → 274 €). */
  panierMoyenCents: number;
  /** Variation en % par rapport au même nombre de jours de la semaine précédente ; `null` si la référence est nulle. */
  variationCaPct: number | null;
  variationCommandes: number;
}

const payees = (cs: readonly CommandeBoutique[], de: Jour, a: Jour): CommandeBoutique[] => cs.filter((c) => !c.remboursee && c.payeeLe >= de && c.payeeLe <= a);
const caDe = (cs: readonly CommandeBoutique[]): number => cs.reduce((s, c) => s + c.totalCents, 0);

/** Semaine du lundi à aujourd'hui, comparée aux mêmes jours de la semaine d'avant. CA = commandes payées hors remboursées ; panier moyen = CA ÷ commandes. */
export function bilanDeLaSemaine(commandes: readonly CommandeBoutique[], aujourdhui: Jour): SemaineBoutique {
  const lundi = lundiDe(aujourdhui);
  const n = ecartJours(lundi, aujourdhui);
  const actuelles = payees(commandes, lundi, aujourdhui);
  const avant = payees(commandes, ajouterJours(lundi, -7), ajouterJours(lundi, -7 + n));
  const ca = caDe(actuelles);
  const caAvant = caDe(avant);
  return {
    chiffreAffairesCents: ca,
    commandes: actuelles.length,
    panierMoyenCents: actuelles.length ? Math.round(ca / actuelles.length / 100) * 100 : 0,
    variationCaPct: caAvant > 0 ? Math.round(((ca - caAvant) / caAvant) * 100) : null,
    variationCommandes: actuelles.length - avant.length,
  };
}

/** « Ce qui se vend » : quantités vendues de la semaine, 5 produits au plus ; barre = quantité ÷ plus forte quantité. */
export function ceQuiSeVend(commandes: readonly CommandeBoutique[], aujourdhui: Jour, max = 5): { produitId: string; nom: string; quantite: number; barre: number }[] {
  const cumul = new Map<string, { nom: string; q: number }>();
  for (const c of payees(commandes, lundiDe(aujourdhui), aujourdhui)) for (const l of c.lignes ?? []) {
    const x = cumul.get(l.produitId) ?? { nom: l.nom, q: 0 };
    x.q += l.quantite;
    cumul.set(l.produitId, x);
  }
  const liste = [...cumul.entries()].map(([produitId, v]) => ({ produitId, nom: v.nom, quantite: v.q })).sort((a, b) => b.quantite - a.quantite || a.nom.localeCompare(b.nom, 'fr')).slice(0, max);
  const plusFort = liste[0]?.quantite ?? 0;
  return liste.map((l) => ({ ...l, barre: plusFort > 0 ? l.quantite / plusFort : 0 }));
}

/* -------- Entonnoir d'achat -------- */

export interface ChiffresEntonnoir { visites: number; fichesVues: number; ajoutsPanier: number; paiementsCommences: number; commandesPayees: number }
export const ETAPES_ENTONNOIR = ['visites', 'fichesVues', 'ajoutsPanier', 'paiementsCommences', 'commandesPayees'] as const;
export type EtapeEntonnoir = (typeof ETAPES_ENTONNOIR)[number];

export interface Entonnoir {
  etapes: { etape: EtapeEntonnoir; valeur: number; /** Taux de passage depuis l'étape précédente, en % entier ; `null` pour la première. */ taux: number | null }[];
  /** Passage où l'on perd le plus (taux le plus bas) : signalé en orange ; ce n'est pas une erreur, c'est le point où agir. */
  ecartLePlusFort: EtapeEntonnoir | null;
}

export function construireEntonnoir(c: ChiffresEntonnoir): Entonnoir {
  const valeurs = ETAPES_ENTONNOIR.map((e) => c[e]);
  const etapes = ETAPES_ENTONNOIR.map((etape, i) => ({
    etape,
    valeur: valeurs[i],
    taux: i === 0 ? null : valeurs[i - 1] > 0 ? Math.round((valeurs[i] / valeurs[i - 1]) * 100) : null,
  }));
  const candidats = etapes.filter((e) => e.taux !== null);
  const pire = candidats.sort((a, b) => (a.taux as number) - (b.taux as number))[0];
  return { etapes, ecartLePlusFort: pire ? pire.etape : null };
}

/**
 * Hauteur de la bande d'une étape : proportionnelle à la RACINE du rapport avec la première,
 * sinon les trois dernières étapes disparaissent. Les valeurs écrites restent exactes.
 */
export function hauteurDeBande(valeur: number, maxValeur: number, hauteurMaxPx: number, minPx = 3): number {
  if (maxValeur <= 0 || valeur <= 0) return 0;
  return Math.max(minPx, Math.round(Math.sqrt(borner(valeur / maxValeur, 0, 1)) * hauteurMaxPx));
}

/* -------- Paniers, objectif, état -------- */

export interface PanierEntree { id: string; derniereActiviteMs: number; converti: boolean; contactAutorise?: boolean; adresseConnue?: boolean }
export const DELAI_ABANDON_H = 24;

/** Paniers abandonnés = non transformés 24 h après la dernière activité ; « avec une adresse » = client identifié qui a accepté d'être contacté. */
export function paniersAbandonnes(paniers: readonly PanierEntree[], maintenantMs: number): { abandonnes: number; contactables: number } {
  const ab = paniers.filter((p) => !p.converti && maintenantMs - p.derniereActiviteMs >= DELAI_ABANDON_H * 3_600_000);
  return { abandonnes: ab.length, contactables: ab.filter((p) => p.contactAutorise && p.adresseConnue).length };
}

export interface ObjectifTrimestre { montantCents: number; debut: Jour; fin: Jour }

/** Objectif du trimestre : valeur = CA payé de la période ; « moins de n semaines comme celle-ci » = reste ÷ CA de la semaine en cours, arrondi au supérieur. */
export function avancementObjectif(o: ObjectifTrimestre, commandes: readonly CommandeBoutique[], aujourdhui: Jour): { caCents: number; pct: number; resteCents: number; semainesRestantes: number | null } {
  const ca = caDe(payees(commandes, o.debut, o.fin < aujourdhui ? o.fin : aujourdhui));
  const reste = Math.max(0, o.montantCents - ca);
  const caSemaine = caDe(payees(commandes, lundiDe(aujourdhui), aujourdhui));
  return {
    caCents: ca,
    pct: o.montantCents > 0 ? Math.min(100, Math.round((ca / o.montantCents) * 100)) : 0,
    resteCents: reste,
    semainesRestantes: reste === 0 ? 0 : caSemaine > 0 ? Math.ceil(reste / caSemaine) : null,
  };
}

export type EtatBoutique = 'ouverte' | 'en-pause' | 'fermee';
/** « Ouverte 24 h sur 24 » : état calculé (ouverte, en pause, fermée) à partir du réglage. */
export function etatDeLaBoutique(r: { active: boolean; enPause?: boolean }): EtatBoutique {
  return !r.active ? 'fermee' : r.enPause ? 'en-pause' : 'ouverte';
}
